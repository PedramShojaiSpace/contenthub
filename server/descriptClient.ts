/**
 * Descript Partner API Client
 * Base URL: https://descriptapi.com/v1
 * Auth: Bearer token in Authorization header
 * Docs: https://docs.descriptapi.com
 *
 * Key insight: The agent endpoint (/jobs/agent) can CREATE a new project from a prompt
 * (pass project_name instead of project_id). This is how we use Pedram's AI voice —
 * we instruct Underlord to narrate the script using the "Pedram Shojai" voice.
 *
 * Actual job status response uses job_state: "running" | "stopped" | "cancelled"
 * and result.status: "success" | "failed" | "partial"
 */

const DESCRIPT_BASE_URL = "https://descriptapi.com/v1";

function getDescriptToken(): string {
  const token = process.env.DESCRIPT_API_KEY;
  if (!token) throw new Error("DESCRIPT_API_KEY is not set");
  return token;
}

async function descriptFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getDescriptToken();
  const url = `${DESCRIPT_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Descript API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Response Types (matching actual API) ────────────────────────────────────

export interface DescriptAgentCreateResponse {
  job_id: string;
  drive_id: string;
  project_id: string;
  project_url: string;
}

export interface DescriptJobStatusResponse {
  job_id: string;
  job_type: string;
  job_state: "running" | "stopped" | "cancelled";
  created_at: string;
  stopped_at?: string;
  drive_id: string;
  project_id?: string;
  project_url?: string;
  progress?: { label: string; last_update_at: string };
  result?: {
    status: "success" | "failed" | "partial";
    agent_response?: string;
    project_changed?: boolean;
    media_seconds_used?: number;
    ai_credits_used?: number;
    download_url?: string;
    share_url?: string;
    media_status?: Record<string, { status: string; duration_seconds?: number }>;
    created_compositions?: Array<{ id: string; name: string }>;
  };
}

export interface DescriptExportResponse {
  job_id: string;
  drive_id: string;
  project_id: string;
  project_url: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Format a script for natural TTS delivery.
 * - Adds ellipses after transitional phrases to create natural pauses
 * - Converts long run-on sentences into shorter, breathable chunks
 * - Adds em-dashes for natural mid-sentence breaks
 * - Ensures paragraph breaks become full pauses
 * - Removes double spaces and cleans up formatting artifacts
 */
function formatScriptForTTS(text: string): string {
  return text
    // Paragraph breaks → double newline with pause cue
    .replace(/\n{2,}/g, "\n\n")
    // Add a brief pause after transitional openers
    .replace(/\b(Now,|So,|And,|But,|Well,|Look,|Here's the thing,|The truth is,|Think about it,|Here's what I mean,|Let me explain,|In other words,|The bottom line is,|What this means is,|What that means for you is)/g, "$1...")
    // Add pause before contrasting conjunctions mid-sentence
    .replace(/ (but|yet|however|although|though|while|whereas) /g, " — $1 ")
    // Break up sentences longer than ~120 chars at natural comma points
    .replace(/([^.!?]{80,}),\s+([A-Za-z])/g, (match, p1, p2) => `${p1}...\n${p2}`)
    // Ensure sentences end with proper terminal punctuation before a pause
    .replace(/([^.!?…])\n/g, "$1.\n")
    // Clean up any double ellipses or triple periods
    .replace(/\.{4,}/g, "...")
    .replace(/\.\.\./g, "...")
    // Clean up double spaces
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Apply phonetic substitutions so Descript TTS pronounces names correctly.
 * Pedram = Peh-drom (NOT Pee-dram)
 * Shojai = Sho-jai
 */
function applyPhoneticSubstitutions(text: string): string {
  return text
    .replace(/\bPedram\b/g, "Peh-drom")
    .replace(/\bpedram\b/g, "peh-drom")
    .replace(/\bShojai\b/g, "Sho-jai")
    .replace(/\bshojai\b/g, "sho-jai");
}

export async function createProjectWithVoice(params: {
  projectName: string;
  scriptText: string;
  voiceName?: string;
  ctaText?: string;
  ctaUrl?: string;
}): Promise<DescriptAgentCreateResponse> {
  const voice = params.voiceName ?? "Pedram FOR GUT COURSE READ";
  // Format for natural TTS delivery first, then apply phonetic corrections
  const formattedScript = formatScriptForTTS(params.scriptText);
  const phoneticScript = applyPhoneticSubstitutions(formattedScript);

  // Build optional CTA end-screen instruction
  const ctaInstruction = params.ctaText
    ? `\n\nAfter the narration ends, add a title card end screen that stays visible for 5 seconds. The card should display this text in white on a dark background: "${params.ctaText}" with the URL "${params.ctaUrl ?? 'theurbanmonk.com'}" below it.`
    : "";

  const prompt = `Create a new video project. Narrate the following script using the "${voice}" AI voice. Speak naturally with appropriate pacing and pauses — do not rush through the text. Apply Studio Sound to enhance audio quality. Add captions.${ctaInstruction} Here is the script:\n\n${phoneticScript}`;

  return descriptFetch<DescriptAgentCreateResponse>("/jobs/agent", {
    method: "POST",
    body: JSON.stringify({
      project_name: params.projectName,
      prompt,
    }),
  });
}

/**
 * Run Underlord on an existing project (e.g. add B-roll, remove filler words).
 */
export async function runUnderlordAgent(params: {
  projectId: string;
  prompt: string;
  compositionId?: string;
}): Promise<DescriptAgentCreateResponse> {
  return descriptFetch<DescriptAgentCreateResponse>("/jobs/agent", {
    method: "POST",
    body: JSON.stringify({
      project_id: params.projectId,
      ...(params.compositionId ? { composition_id: params.compositionId } : {}),
      prompt: params.prompt,
    }),
  });
}

/**
 * Get the status of any job (import, agent, export).
 * job_state: "running" | "stopped" | "cancelled"
 * When stopped, check result.status for "success" | "failed" | "partial"
 */
export async function getJobStatus(jobId: string): Promise<DescriptJobStatusResponse> {
  return descriptFetch<DescriptJobStatusResponse>(`/jobs/${jobId}`);
}

/**
 * Export a project to MP4.
 */
export async function exportProject(params: {
  projectId: string;
  compositionId?: string;
}): Promise<DescriptExportResponse> {
  return descriptFetch<DescriptExportResponse>("/jobs/publish", {
    method: "POST",
    body: JSON.stringify({
      project_id: params.projectId,
      ...(params.compositionId ? { composition_id: params.compositionId } : {}),
    }),
  });
}

/**
 * Import a video from a public/pre-signed URL into a new Descript project.
 * Used to import the HeyGen avatar MP4 so Underlord can add B-roll on top.
 * Returns job_id, project_id, project_url (same shape as DescriptAgentCreateResponse).
 */
export async function importVideoFromUrl(params: {
  projectName: string;
  videoUrl: string;
  compositionName?: string;
}): Promise<DescriptAgentCreateResponse> {
  const fileName = "avatar.mp4";
  const compositionName = params.compositionName ?? params.projectName.substring(0, 80);

  return descriptFetch<DescriptAgentCreateResponse>("/jobs/import/project_media", {
    method: "POST",
    body: JSON.stringify({
      project_name: params.projectName,
      add_media: {
        [fileName]: { url: params.videoUrl },
      },
      add_compositions: [
        {
          name: compositionName,
          clips: [{ media: fileName }],
        },
      ],
    }),
  });
}

/**
 * Add stock footage media files to an existing Descript project.
 * This must be called BEFORE running Underlord so the agent has footage to cut to.
 *
 * Uses the /jobs/import/project_media endpoint with an existing project_id.
 * Each media file is given a descriptive name so Underlord can reference it by type.
 *
 * @param projectId - The Descript project ID to add media to
 * @param mediaFiles - Array of {name, url} objects (name should describe the clip content)
 * @returns job_id of the import job (poll with getJobStatus to confirm completion)
 */
export async function addMediaToProject(params: {
  projectId: string;
  mediaFiles: Array<{ name: string; url: string }>;
}): Promise<{ job_id: string }> {
  // Build the add_media map: { "filename.mp4": { url: "..." }, ... }
  const addMedia: Record<string, { url: string }> = {};
  for (const file of params.mediaFiles) {
    // Sanitize filename: replace spaces/special chars with underscores
    const safeName = file.name
      .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 80);
    const fileName = safeName.endsWith(".mp4") ? safeName : `${safeName}.mp4`;
    addMedia[fileName] = { url: file.url };
  }

  const result = await descriptFetch<{ job_id: string; project_id?: string }>("/jobs/import/project_media", {
    method: "POST",
    body: JSON.stringify({
      project_id: params.projectId,
      add_media: addMedia,
      // No add_compositions — we're just adding media to the library,
      // not creating new compositions. Underlord will place them.
    }),
  });

  return { job_id: result.job_id };
}

/**
 * List all projects in the authenticated drive.
 */
export async function listProjects(): Promise<{ data: Array<{ id: string; name: string; project_url: string }> }> {
  return descriptFetch<{ data: Array<{ id: string; name: string; project_url: string }> }>("/projects");
}
