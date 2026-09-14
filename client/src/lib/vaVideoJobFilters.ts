export type VAVideoFilter =
  | "processing"
  | "review"
  | "seo"
  | "all"
  | "published"
  | "failed"
  | "finished";

const PROCESSING_VIDEO_STATUSES = new Set([
  "pending",
  "queued",
  "importing",
  "editing",
  "processing",
  "rendering",
  "approved",
  "uploading",
  "publishing",
]);

export function isVideoJobProcessing(status: string): boolean {
  return PROCESSING_VIDEO_STATUSES.has(status);
}

export function matchesVAVideoFilter(
  job: { status: string; archivedAt: number | null },
  filter: VAVideoFilter,
): boolean {
  if (filter === "finished") return Boolean(job.archivedAt);
  if (job.archivedAt) return false;
  if (filter === "processing") return isVideoJobProcessing(job.status);
  if (filter === "review") return job.status === "ready_for_review";
  if (filter === "seo") return job.status === "uploaded_unlisted";
  if (filter === "published") return job.status === "published";
  if (filter === "failed") return job.status === "failed";
  return true;
}

export function getInitialVAView(search: string): {
  activeTab: "syndication" | "video" | "substack";
  videoFilter: VAVideoFilter;
} {
  const params = new URLSearchParams(search);
  const requestedTab = params.get("tab");
  const requestedFilter = params.get("filter");
  const validFilters: VAVideoFilter[] = [
    "processing",
    "review",
    "seo",
    "all",
    "published",
    "failed",
    "finished",
  ];

  return {
    activeTab:
      requestedTab === "video" || requestedTab === "substack"
        ? requestedTab
        : "syndication",
    videoFilter: validFilters.includes(requestedFilter as VAVideoFilter)
      ? (requestedFilter as VAVideoFilter)
      : "review",
  };
}
