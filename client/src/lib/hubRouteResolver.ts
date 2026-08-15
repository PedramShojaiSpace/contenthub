export type HubBundle = "core" | "content" | "growth" | "analytics";

const analyticsPaths = new Set(["/tantra-funnel", "/reconciliation", "/interconnected-command"]);
const contentPaths = new Set([
  "/content-pipeline", "/podcast-production", "/seo", "/scoreboard",
  "/competitive-intelligence", "/keyword-strategy", "/ch-pages", "/qr-generator",
  "/backlink-outreach", "/video-to-blog", "/blog-to-youtube", "/review-queue",
  "/ask-urban-monk", "/presence-assessment", "/syndication", "/va", "/ads",
  "/lead-scrubber", "/email-optimizer", "/klaviyo-flow-optimizer", "/kids-research",
  "/kids-review", "/collective-sourcing", "/soro-intelligence", "/plain-text-email",
  "/va-tasks", "/kajabi-live", "/advertorial-builder",
]);
const growthPaths = new Set([
  "/upstream", "/meta-ads", "/ad-attribution", "/campaign-monitor", "/historical-posts",
  "/reddit-personas", "/reddit-roas", "/youtube-pipeline", "/substack", "/deep-dive",
  "/system-health", "/funnels", "/ascension", "/ab-tests", "/claims-review", "/yt-analytics",
  "/ga4-analytics", "/analyze", "/transcript-engine", "/corpus-builder", "/pattern-extractor",
  "/script-factory", "/performance-loop", "/funnel-economics", "/funnel-advisor", "/mof-content",
]);

function pathMatches(path: string, candidates: Set<string>) {
  return [...candidates].some((candidate) => path === candidate || path.startsWith(`${candidate}/`));
}

export function getHubBundleForPath(path: string): HubBundle {
  if (pathMatches(path, analyticsPaths)) return "analytics";
  if (pathMatches(path, contentPaths)) return "content";
  if (pathMatches(path, growthPaths)) return "growth";
  return "core";
}

export function getHubNavigationHref(path: string, currentPathname: string, search = ""): string | null {
  const current = /^\/hub\/(content|growth|analytics)(?:\/|$)/.exec(currentPathname)?.[1] as HubBundle | undefined;
  if (!current) return null;
  const target = getHubBundleForPath(path);
  return target === current ? null : `/hub/${target}${path}${search}`;
}

export function getHubPublicHref(path: string, search = "") {
  const bundle = getHubBundleForPath(path);
  return bundle === "core" ? `/hub${path}${search}` : `/hub/${bundle}${path}${search}`;
}
