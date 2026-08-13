import { lazy } from "react";
import { Route } from "wouter";
import { HubShell } from "./HubShell";

const TantraFunnelDashboard = lazy(() => import("./pages/TantraFunnelDashboard"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const InterconnectedCommandCenter = lazy(() => import("./pages/InterconnectedCommandCenter"));

export default function HubAnalyticsApp() {
  return <HubShell>
    <Route path="/tantra-funnel" component={TantraFunnelDashboard} />
    <Route path="/reconciliation" component={Reconciliation} />
    <Route path="/interconnected-command" component={InterconnectedCommandCenter} />
  </HubShell>;
}
