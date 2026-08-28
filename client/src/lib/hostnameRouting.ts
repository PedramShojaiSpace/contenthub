const UPSTREAM_HOSTNAME = "upstream.theurbanmonk.com";

export function normalizeHostname(hostname: string | undefined | null): string {
  return (hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/**
 * Keeps the customer-facing Upstream hostname on a clean root URL while the
 * Content Hub continues to serve its own root application at every other host.
 */
export function shouldRenderUpstreamAtRoot(hostname: string | undefined | null, pathname: string): boolean {
  return normalizeHostname(hostname) === UPSTREAM_HOSTNAME && pathname === "/";
}
