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
 * Create a new Descript project from a script using the agent endpoint.
 * Underlord will narrate the script using the specified voice (e.g. "Pedram Shojai").
 */
export async function createProjectWithVoice(params: {
  projectName: string;
  scriptText: string;
  voiceName?: string;
}): Promise<DescriptAgentCreateResponse> {
  const voice = params.voiceName ?? "Pedram Shojai";
  const prompt = `Create a new video project. Narrate the following script using the "${voice}" AI voice. Apply Studio Sound to enhance audio quality. Add captions. Here is the script:\n\n${params.scriptText}`;

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
  format?: "mp4" | "mov";
  resolution?: "1080p" | "720p" | "4k";
}): Promise<DescriptExportResponse> {
  return descriptFetch<DescriptExportResponse>("/jobs/export", {
    method: "POST",
    body: JSON.stringify({
      project_id: params.projectId,
      ...(params.compositionId ? { composition_id: params.compositionId } : {}),
      format: params.format ?? "mp4",
      resolution: params.resolution ?? "1080p",
    }),
  });
}

/**
 * List all projects in the authenticated drive.
 */
export async function listProjects(): Promise<{ data: Array<{ id: string; name: string; project_url: string }> }> {
  return descriptFetch<{ data: Array<{ id: string; name: string; project_url: string }> }>("/projects");
}
