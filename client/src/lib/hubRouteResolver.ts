export type HubBundle = "core" | "content" | "growth" | "analytics";

const analyticsPaths = new Set(["/tantra-funnel", "/reconciliation", "/interconnected-command", "/orobiome-funnel"]);
const contentPaths = new Set([
  "/content-pipeline", "/podcast-production", "/seo", "/scoreboard",
  "/competitive-intelligence", "/keyword-strategy", "/ch-pages", "/qr-generator",
  "/backlink-outreach", "/video-to-blog", "/blog-to-youtube", "/review-queue",
  "/ask-urban-monk", "/presence-assessment", "/syndication", "/va", "/ads",
  "/lead-scrubber", "/email-optimizer", "/klaviyo-flow-optimizer", "/kids-research",
  "/kids-review", "/collective-sourcing", "/soro-intelligence", "/plain-text-email",
  "/va-tasks", "/kajabi-live", "/advertorial-builder", "/webinar", "/webinar-intelligence",
  "/viral-studio", "/video-variants", "/video-production", "/ebook-generator",
]);
const growthPaths = new Set([
  "/upstream", "/meta-ads", "/ad-attribution", "/campaign-monitor", "/historical-posts",
  "/reddit-personas", "/reddit-roas", "/youtube-pipeline", "/substack", "/deep-dive",
  "/system-health", "/funnels", "/ascension", "/ab-tests", "/claims-review", "/yt-analytics",
  "/ga4-analytics", "/analyze", "/transcript-engine", "/corpus-builder", "/pattern-extractor",
  "/script-factory", "/performance-loop", "/funnel-economics", "/funnel-advisor", "/mof-content",
]);
const corePaths = new Set(["/interconnected-email-revenue"]);

const legacyToolAliases: Record<string, string> = {
  "/youtube-to-blog": "/video-to-blog",
};

function pathMatches(path: string, candidates: Set<string>) {
  return [...candidates].some((candidate) => path === candidate || path.startsWith(`${candidate}/`));
}

function normalizeHubToolPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const match = /^\/hub(?:\/(?:core|content|growth|analytics))?(\/.*)?$/.exec(normalized);
  if (match) return legacyToolAliases[match[1] || "/"] || match[1] || "/";
  const nestedBundleMatch = /^\/(?:core|content|growth|analytics)(\/.*)$/.exec(normalized);
  const toolPath = nestedBundleMatch ? nestedBundleMatch[1] : normalized;
  return legacyToolAliases[toolPath] || toolPath;
}

export function getHubBundleForPath(path: string): HubBundle {
  const toolPath = normalizeHubToolPath(path);
  if (pathMatches(toolPath, analyticsPaths)) return "analytics";
  if (pathMatches(toolPath, contentPaths)) return "content";
  if (pathMatches(toolPath, growthPaths)) return "growth";
  if (pathMatches(toolPath, corePaths)) return "core";
  return "core";
}

export function getHubNavigationHref(path: string, currentPathname: string, search = ""): string | null {
  const current = /^\/hub\/(content|growth|analytics)(?:\/|$)/.exec(currentPathname)?.[1] as HubBundle | undefined;
  if (!current) return null;
  const target = getHubBundleForPath(path);
  return target === current ? null : `/hub/${target}${path}${search}`;
}

export function getHubPublicHref(path: string, search = "") {
  const toolPath = normalizeHubToolPath(path);
  const bundle = getHubBundleForPath(toolPath);
  return bundle === "core" ? `/hub${toolPath}${search}` : `/hub/${bundle}${toolPath}${search}`;
}
