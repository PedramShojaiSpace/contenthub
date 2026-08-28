export const UPSTREAM_HOSTNAME = "upstream.theurbanmonk.com";
export const UPSTREAM_FALLBACK_URL = "https://content.theurbanmonk.com/hub/growth/upstream";

export function normalizeRequestHostname(hostname: string | undefined | null): string {
  return (hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function isUpstreamHostname(hostname: string | undefined | null): boolean {
  return normalizeRequestHostname(hostname) === UPSTREAM_HOSTNAME;
}

/** Preserve campaign query parameters while sending the inactive host to its verified public fallback. */
export function getUpstreamFallbackLocation(originalUrl: string): string {
  const incoming = new URL(originalUrl, "https://upstream.theurbanmonk.com");
  const destination = new URL(UPSTREAM_FALLBACK_URL);
  destination.search = incoming.search;
  return destination.toString();
}
