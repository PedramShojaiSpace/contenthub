import { useEffect } from "react";
import { getHubPublicHref } from "@/lib/hubRouteResolver";

/** Redirects a path that was loaded through the wrong Hub bundle. */
export function HubCrossBundleRedirect() {
  useEffect(() => {
    const destination = getHubPublicHref(window.location.pathname, window.location.search);
    if (destination !== `${window.location.pathname}${window.location.search}`) {
      window.location.replace(destination);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
