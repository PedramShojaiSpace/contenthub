import { lazy } from "react";
import { Route, useLocation } from "wouter";
import { useEffect } from "react";
import { HubShell } from "./HubShell";
import { getHubPublicHref } from "./lib/hubRouteResolver";

const TantraFunnelDashboard = lazy(() => import("./pages/TantraFunnelDashboard"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const InterconnectedCommandCenter = lazy(() => import("./pages/InterconnectedCommandCenter"));

function CrossBundleRedirect() {
  const [path] = useLocation();
  useEffect(() => {
    window.location.replace(getHubPublicHref(path, window.location.search));
  }, [path]);
  return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}

export default function HubAnalyticsApp() {
  return <HubShell>
    <Route path="/tantra-funnel" component={TantraFunnelDashboard} />
    <Route path="/reconciliation" component={Reconciliation} />
    <Route path="/interconnected-command" component={InterconnectedCommandCenter} />
    <Route component={CrossBundleRedirect} />
  </HubShell>;
}
