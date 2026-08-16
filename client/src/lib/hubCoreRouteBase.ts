/**
 * Wouter must use the legacy /hub base when the Core entry is served as a
 * static fallback for a tool owned by another bundle. Otherwise its catch-all
 * redirect never receives the normalized tool-relative path.
 */
export function getHubCoreRouteBase(pathname: string): string {
  if (pathname === "/hub/core" || pathname.startsWith("/hub/core/")) return "/hub/core";
  if (pathname === "/hub" || pathname.startsWith("/hub/")) return "/hub";
  return "/";
}
