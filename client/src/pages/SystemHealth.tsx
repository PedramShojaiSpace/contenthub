/**
 * System Health — Observability Dashboard (Rec 6, Grok 3 Audit v2)
 *
 * Shows the live status of every integration and credential:
 * - Substack session cookie
 * - WordPress connection
 * - Meta Ads API
 * - Shopify webhook
 * - Buffer
 * - Gmail OAuth
 * - YouTube OAuth
 * - Apollo API key
 *
 * Each check is a lightweight ping. Red = broken, yellow = degraded, green = ok.
 * No auto-fix — just surface the problem and link to the fix.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Rss,
  Globe,
  Megaphone,
  ShoppingBag,
  Mail,
  Youtube,
  BookOpen,
  Users,
  Zap,
  Activity,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = "ok" | "degraded" | "error" | "unknown" | "checking";

interface HealthCheck {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: HealthStatus;
  detail?: string;
  fixUrl?: string;
  fixLabel?: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthStatus }) {
  const config: Record<HealthStatus, { label: string; color: string; icon: React.ReactNode }> = {
    ok: { label: "OK", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    degraded: { label: "Degraded", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
    error: { label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
    unknown: { label: "Unknown", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
    checking: { label: "Checking…", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  };
  const c = config[status];
  return (
    <Badge className={`text-xs border ${c.color} flex items-center gap-1`}>
      {c.icon}{c.label}
    </Badge>
  );
}

// ─── Health Check Card ────────────────────────────────────────────────────────

function HealthCard({ check }: { check: HealthCheck }) {
  return (
    <Card className={`border ${check.status === "error" ? "border-red-800/40 bg-red-950/10" : check.status === "degraded" ? "border-amber-800/40 bg-amber-950/10" : "border-zinc-800 bg-zinc-900/50"}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`mt-0.5 ${check.status === "error" ? "text-red-400" : check.status === "degraded" ? "text-amber-400" : check.status === "ok" ? "text-emerald-400" : "text-zinc-500"}`}>
              {check.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">{check.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{check.description}</p>
              {check.detail && (
                <p className={`text-xs mt-1 ${check.status === "error" ? "text-red-400" : check.status === "degraded" ? "text-amber-400" : "text-zinc-400"}`}>
                  {check.detail}
                </p>
              )}
              {check.fixUrl && check.status !== "ok" && (
                <a href={check.fixUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1.5">
                  <ExternalLink className="w-3 h-3" /> {check.fixLabel ?? "Fix this"}
                </a>
              )}
            </div>
          </div>
          <StatusBadge status={check.status} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SystemHealth() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Substack session
  const { data: substackHealth, isLoading: substackLoading, refetch: refetchSubstack } = trpc.substack.validateSession.useQuery(undefined, {
    queryKey: ["substack.validateSession", refreshKey],
    staleTime: 0,
  } as any);
  const { data: criticalHealth, isLoading: criticalLoading, refetch: refetchCritical } = trpc.integrationHealth.critical.useQuery(undefined, {
    staleTime: 0,
  });
  const service = (id: keyof NonNullable<typeof criticalHealth>["services"]) => criticalHealth?.services[id];
  const healthStatus = (id: keyof NonNullable<typeof criticalHealth>["services"]): HealthStatus =>
    criticalLoading ? "checking" : service(id)?.status ?? "unknown";

  const refreshAll = () => {
    setRefreshKey((key) => key + 1);
    void refetchSubstack();
    void refetchCritical();
  };

  const wpHealth = service("wordpress");
  const metaHealth = service("meta");
  const shopifyHealth = service("shopify");
  const webhookHealth = service("shopifyWebhook");
  const kajabiHealth = service("kajabi");
  const klaviyoHealth = service("klaviyo");
  const gmailHealth = service("gmail");
  const youtubeHealth = service("youtube");
  const apolloHealth = service("apollo");
  const bufferHealth = service("buffer");

  const checks: HealthCheck[] = [
    {
      id: "substack",
      label: "Substack Session",
      description: "Cookie-based auth for auto-publishing founder letters",
      icon: <Rss className="w-4 h-4" />,
      status: substackLoading ? "checking" : substackHealth?.valid ? "ok" : substackHealth ? "error" : "unknown",
      detail: substackHealth?.valid ? `Authenticated as ${substackHealth.email ?? "unknown"}` : substackHealth?.error,
      fixUrl: "https://substack.com",
      fixLabel: "Log in to Substack and refresh the cookie in Manus Secrets",
    },
    {
      id: "wordpress",
      label: "WordPress Connection",
      description: "REST API used to publish blog posts and fetch Yoast scores",
      icon: <Globe className="w-4 h-4" />,
      status: healthStatus("wordpress"),
      detail: wpHealth?.detail,
      fixUrl: "/wordpress-setup",
      fixLabel: "Open WordPress Setup",
    },
    {
      id: "meta",
      label: "Meta Ads API",
      description: "Access token for reading campaign insights and CAPI events",
      icon: <Megaphone className="w-4 h-4" />,
      status: healthStatus("meta"),
      detail: metaHealth?.detail,
      fixUrl: "https://business.facebook.com",
      fixLabel: "Refresh Meta access token",
    },
    {
      id: "shopify",
      label: "Shopify Storefront API",
      description: "Storefront API used for product and checkout experience",
      icon: <ShoppingBag className="w-4 h-4" />,
      status: healthStatus("shopify"),
      detail: shopifyHealth?.detail,
      fixUrl: "https://admin.shopify.com",
      fixLabel: "Check Shopify webhook settings",
    },
    {
      id: "shopify-webhook",
      label: "Shopify Paid-Order Webhook",
      description: "Inbound order/paid evidence used for first-party attribution",
      icon: <Activity className="w-4 h-4" />,
      status: healthStatus("shopifyWebhook"),
      detail: webhookHealth?.detail,
      fixUrl: "https://admin.shopify.com",
      fixLabel: "Check Shopify webhook settings",
    },
    {
      id: "kajabi",
      label: "Kajabi OAuth",
      description: "OAuth credential used for Kajabi sales and lifecycle operations",
      icon: <BookOpen className="w-4 h-4" />,
      status: healthStatus("kajabi"),
      detail: kajabiHealth?.detail,
      fixUrl: "https://app.kajabi.com",
      fixLabel: "Check Kajabi credentials",
    },
    {
      id: "klaviyo",
      label: "Klaviyo API",
      description: "Profile, list, flow, and email operations",
      icon: <Mail className="w-4 h-4" />,
      status: healthStatus("klaviyo"),
      detail: klaviyoHealth?.detail,
      fixUrl: "https://www.klaviyo.com",
      fixLabel: "Check Klaviyo settings",
    },
    {
      id: "gmail",
      label: "Gmail OAuth",
      description: "OAuth token for sending backlink outreach emails",
      icon: <Mail className="w-4 h-4" />,
      status: healthStatus("gmail"),
      detail: gmailHealth?.detail,
      fixUrl: "/backlink-outreach",
      fixLabel: "Open Backlink Outreach",
    },
    {
      id: "youtube",
      label: "YouTube OAuth",
      description: "OAuth token for uploading videos and reading channel analytics",
      icon: <Youtube className="w-4 h-4" />,
      status: healthStatus("youtube"),
      detail: youtubeHealth?.detail,
      fixUrl: "/youtube-pipeline",
      fixLabel: "Open YouTube Pipeline",
    },
    {
      id: "apollo",
      label: "Apollo API",
      description: "API key for daily lead draws and email enrichment",
      icon: <Users className="w-4 h-4" />,
      status: healthStatus("apollo"),
      detail: apolloHealth?.detail,
      fixUrl: "/lead-scrubber",
      fixLabel: "Open Lead Scrubber",
    },
    {
      id: "buffer",
      label: "Buffer Sync",
      description: "Access token for pushing social posts and syncing publish status",
      icon: <Zap className="w-4 h-4" />,
      status: healthStatus("buffer"),
      detail: bufferHealth?.detail,
      fixUrl: "/content-pipeline",
      fixLabel: "Open Content Pipeline",
    },
  ];

  const errorCount = checks.filter((c) => c.status === "error").length;
  const degradedCount = checks.filter((c) => c.status === "degraded").length;
  const okCount = checks.filter((c) => c.status === "ok").length;

  const overallStatus: HealthStatus = errorCount > 0 ? "error" : degradedCount > 0 ? "degraded" : okCount === checks.length ? "ok" : "unknown";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-blue-400" />
              <h1 className="text-2xl font-bold text-zinc-100">System Health</h1>
            </div>
            <p className="text-sm text-zinc-400">Live status of all integrations and credentials.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-200"
            onClick={refreshAll}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Overall status banner */}
        <Card className={`border ${overallStatus === "ok" ? "border-emerald-800/40 bg-emerald-950/20" : overallStatus === "error" ? "border-red-800/40 bg-red-950/20" : overallStatus === "degraded" ? "border-amber-800/40 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/50"}`}>
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={overallStatus} />
                <span className="text-sm text-zinc-300">
                  {overallStatus === "ok" && "All systems operational"}
                  {overallStatus === "error" && `${errorCount} integration${errorCount > 1 ? "s" : ""} need attention`}
                  {overallStatus === "degraded" && `${degradedCount} integration${degradedCount > 1 ? "s" : ""} degraded`}
                  {overallStatus === "unknown" && "Some integrations have not been checked yet"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="text-emerald-400">{okCount} ok</span>
              {degradedCount > 0 && <span className="text-amber-400">{degradedCount} degraded</span>}
              {errorCount > 0 && <span className="text-red-400">{errorCount} error</span>}
            </div>
          </CardContent>
        </Card>

        {/* Check cards */}
        <div className="space-y-3">
          {/* Errors first */}
          {checks.filter((c) => c.status === "error").map((c) => <HealthCard key={c.id} check={c} />)}
          {checks.filter((c) => c.status === "degraded").map((c) => <HealthCard key={c.id} check={c} />)}
          {checks.filter((c) => c.status === "checking").map((c) => <HealthCard key={c.id} check={c} />)}
          {checks.filter((c) => c.status === "ok").map((c) => <HealthCard key={c.id} check={c} />)}
          {checks.filter((c) => c.status === "unknown").map((c) => <HealthCard key={c.id} check={c} />)}
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Checks run on page load. Click the refresh button to re-run all checks.
          Some integrations (Gmail, YouTube, Apollo, Buffer) require navigating to their respective pages for full status.
        </p>
      </div>
    </div>
  );
}
