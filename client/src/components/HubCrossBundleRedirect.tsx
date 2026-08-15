import { useEffect } from "react";
import { useLocation } from "wouter";
import { getHubPublicHref } from "@/lib/hubRouteResolver";

/** Redirects a path that was loaded through the wrong Hub bundle. */
export function HubCrossBundleRedirect() {
  const [path] = useLocation();

  useEffect(() => {
    window.location.replace(getHubPublicHref(path, window.location.search));
  }, [path]);

  return null;
}
