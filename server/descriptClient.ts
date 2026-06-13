/**
 * Descript Partner API Client
 * Base URL: https://descriptapi.com/v1
 * Auth: Bearer token in Authorization header
 * Docs: https://docs.descriptapi.com
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

export interface DescriptImportResponse {
  job_id: string;
  drive_id: string;
  project_id: string;
  project_url: string;
}

export interface DescriptJobStatus {
  job_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  error?: string;
  result?: {
    project_id: string;
    project_url: string;
    composition_id?: string;
  };
}

export interface DescriptAgentResponse {
  job_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  error?: string;
}

export interface DescriptExportResponse {
  job_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  download_url?: string;
  error?: string;
}

export async function createProjectFromScript(params: {
  projectName: string;
  scriptText: string;
  driveId?: string;
}): Promise<DescriptImportResponse> {
  return descriptFetch<DescriptImportResponse>("/jobs/import/project_media", {
    method: "POST",
    body: JSON.stringify({
      project_name: params.projectName,
      ...(params.driveId ? { drive_id: params.driveId } : {}),
      add_media: {
        "script.txt": {
          text: params.scriptText,
        },
      },
      add_compositions: [
        {
          name: params.projectName,
          clips: [{ media: "script.txt" }],
        },
      ],
    }),
  });
}

export async function getJobStatus(jobId: string): Promise<DescriptJobStatus> {
  return descriptFetch<DescriptJobStatus>(`/jobs/${jobId}`);
}

export async function runUnderlordAgent(params: {
  projectId: string;
  prompt: string;
}): Promise<DescriptAgentResponse> {
  return descriptFetch<DescriptAgentResponse>("/agent/underlord", {
    method: "POST",
    body: JSON.stringify({
      project_id: params.projectId,
      prompt: params.prompt,
    }),
  });
}

export async function getAgentJobStatus(jobId: string): Promise<DescriptAgentResponse> {
  return descriptFetch<DescriptAgentResponse>(`/agent/underlord/${jobId}`);
}

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

export async function getExportJobStatus(jobId: string): Promise<DescriptExportResponse> {
  return descriptFetch<DescriptExportResponse>(`/jobs/export/${jobId}`);
}

export async function getDrives(): Promise<{ drives: Array<{ id: string; name: string }> }> {
  return descriptFetch<{ drives: Array<{ id: string; name: string }> }>("/drives");
}
