import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Eye,
  MousePointer,
  Users,
  Activity,
  ChevronRight,
  RefreshCw,
  Pause,
  Play,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Zap,
  Rocket,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Target,
  BarChart2,
  Trophy,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]["value"];

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (s === "PAUSED") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Paused</Badge>;
  if (s === "ARCHIVED") return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Archived</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  sub,
  color = "text-foreground",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdsManager() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const connection = trpc.metaAds.validateConnection.useQuery(undefined, { retry: false });
  const overview = trpc.metaAds.getAccountOverview.useQuery({ datePreset }, { enabled: connection.data?.valid === true });
  const fatigue = trpc.metaAds.getFatigueAlerts.useQuery({ datePreset: "last_14d" }, { enabled: connection.data?.valid === true });
  const pixels = trpc.metaAds.getPixelDiagnostics.useQuery(undefined, { enabled: connection.data?.valid === true });

  const updateStatus = trpc.metaAds.updateCampaignStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Campaign ${vars.status === "ACTIVE" ? "activated" : "paused"} successfully`);
      overview.refetch();
    },
    onError: (err) => toast.error(`Failed to update campaign: ${err.message}`),
  });

  const campaignDetail = trpc.metaAds.getCampaignDetail.useQuery(
    { campaignId: expandedCampaign ?? "", datePreset },
    { enabled: !!expandedCampaign }
  );

  // ── Connection error state ──────────────────────────────────────────────────
  if (connection.isLoading) {
    return (
      <div className="p-8 flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Connecting to Meta Ads...
      </div>
    );
  }

  if (connection.isError || connection.data?.valid === false) {
    return (
      <div className="p-8 max-w-lg">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Meta Ads connection failed</p>
            <p className="text-sm text-red-700 mt-1">
              {connection.data?.error ?? connection.error?.message ?? "Could not validate the Meta access token."}
            </p>
            <p className="text-sm text-red-600 mt-2">
              Check that META_AD_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_APP_ID, and META_APP_SECRET are all set correctly in project secrets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const summary = overview.data?.summary;
  const campaigns = overview.data?.campaigns ?? [];

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ads Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live Meta campaign performance — Urban Monk Facebook Ad Account
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => overview.refetch()} disabled={overview.isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${overview.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fatigue">
            Creative Fatigue
            {(fatigue.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {fatigue.data?.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pixels">Pixel Health</TabsTrigger>
          <TabsTrigger value="organic2paid" className="gap-1.5">
            <Rocket className="w-3.5 h-3.5" />
            Organic → Paid
          </TabsTrigger>
          <TabsTrigger value="hooktesting" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Hook Testing
          </TabsTrigger>
          <TabsTrigger value="optimizer" className="gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" />
            Optimizer
          </TabsTrigger>
          <TabsTrigger value="digest" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Weekly Digest
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Summary cards */}
          {overview.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="pt-5 pb-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Total Spend"
                value={fmt$(summary?.totalSpend)}
                icon={DollarSign}
                sub={`${summary?.activeCampaigns ?? 0} active campaigns`}
              />
              <SummaryCard
                title="Impressions"
                value={fmtNum(summary?.totalImpressions)}
                icon={Eye}
                sub={`Avg CTR ${fmtPct(summary?.avgCtr)}`}
              />
              <SummaryCard
                title="Clicks"
                value={fmtNum(summary?.totalClicks)}
                icon={MousePointer}
              />
              <SummaryCard
                title="Leads"
                value={fmtNum(summary?.totalLeads)}
                icon={Users}
                sub={summary?.avgCpl ? `Avg CPL ${fmt$(summary.avgCpl)}` : undefined}
                color={summary?.avgCpl && summary.avgCpl < 20 ? "text-green-700" : "text-foreground"}
              />
            </div>
          )}

          {/* Campaign table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {overview.isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No campaigns found in this date range.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id}>
                      <div
                        className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                      >
                        <ChevronRight
                          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expandedCampaign === campaign.id ? "rotate-90" : ""}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">{campaign.objective}</p>
                        </div>
                        <StatusBadge status={campaign.effective_status} />
                        <div className="text-right w-24 shrink-0">
                          <p className="font-semibold">{fmt$(campaign.insights?.spend)}</p>
                          <p className="text-xs text-muted-foreground">spend</p>
                        </div>
                        <div className="text-right w-20 shrink-0">
                          <p className="font-semibold">{fmtPct(campaign.insights?.ctr)}</p>
                          <p className="text-xs text-muted-foreground">CTR</p>
                        </div>
                        <div className="text-right w-20 shrink-0">
                          <p className="font-semibold">{fmtNum(campaign.insights?.leads)}</p>
                          <p className="text-xs text-muted-foreground">leads</p>
                        </div>
                        <div className="text-right w-20 shrink-0">
                          <p className="font-semibold">{fmt$(campaign.insights?.cpl)}</p>
                          <p className="text-xs text-muted-foreground">CPL</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStatus = campaign.effective_status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                            updateStatus.mutate({ campaignId: campaign.id, status: newStatus });
                          }}
                          disabled={updateStatus.isPending}
                        >
                          {campaign.effective_status === "ACTIVE" ? (
                            <><Pause className="w-3 h-3 mr-1" />Pause</>
                          ) : (
                            <><Play className="w-3 h-3 mr-1" />Activate</>
                          )}
                        </Button>
                      </div>

                      {/* Expanded ad sets */}
                      {expandedCampaign === campaign.id && (
                        <div className="bg-muted/20 border-t px-6 py-4">
                          {campaignDetail.isLoading ? (
                            <div className="space-y-2">
                              {[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ad Sets</p>
                              {(campaignDetail.data?.adSets ?? []).map((adSet) => (
                                <div key={adSet.id} className="flex items-center gap-4 bg-white rounded-lg px-4 py-3 border">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{adSet.name}</p>
                                    <p className="text-xs text-muted-foreground">{adSet.optimization_goal}</p>
                                  </div>
                                  <StatusBadge status={adSet.effective_status} />
                                  <div className="text-right w-20 shrink-0">
                                    <p className="text-sm font-semibold">{fmt$(adSet.insights ? parseFloat(adSet.insights.spend) : null)}</p>
                                    <p className="text-xs text-muted-foreground">spend</p>
                                  </div>
                                  <div className="text-right w-20 shrink-0">
                                    <p className="text-sm font-semibold">{adSet.insights ? fmtPct(parseFloat(adSet.insights.ctr)) : "—"}</p>
                                    <p className="text-xs text-muted-foreground">CTR</p>
                                  </div>
                                  <div className="text-right w-20 shrink-0">
                                    <p className="text-sm font-semibold">{adSet.insights ? adSet.insights.frequency : "—"}</p>
                                    <p className="text-xs text-muted-foreground">freq</p>
                                  </div>
                                </div>
                              ))}
                              {(campaignDetail.data?.adSets ?? []).length === 0 && (
                                <p className="text-sm text-muted-foreground">No ad sets found.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Creative Fatigue Tab ─────────────────────────────────────────── */}
        <TabsContent value="fatigue" className="space-y-4 mt-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Creative Fatigue Monitor</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Ads are flagged when frequency exceeds 3.5 (audience has seen the ad too many times) or CTR drops below 0.5% with significant impressions. These ads need new creative.
              </p>
            </div>
          </div>

          {fatigue.isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
            </div>
          ) : (fatigue.data?.length ?? 0) === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-800">No creative fatigue detected</p>
              <p className="text-sm text-muted-foreground mt-1">All active ads are within healthy frequency and CTR ranges.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fatigue.data?.map((alert) => (
                <Card key={alert.adId} className={alert.severity === "critical" ? "border-red-300" : "border-amber-300"}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${alert.severity === "critical" ? "bg-red-100" : "bg-amber-100"}`}>
                        <ShieldAlert className={`w-4 h-4 ${alert.severity === "critical" ? "text-red-600" : "text-amber-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{alert.adName}</p>
                          <Badge variant={alert.severity === "critical" ? "destructive" : "outline"} className={alert.severity === "warning" ? "border-amber-400 text-amber-700" : ""}>
                            {alert.severity === "critical" ? "Critical" : "Warning"}
                          </Badge>
                          {alert.alertType === "high_frequency" && <Badge variant="outline">High Frequency</Badge>}
                          {alert.alertType === "low_ctr" && <Badge variant="outline">Low CTR</Badge>}
                          {alert.alertType === "both" && <Badge variant="outline">High Freq + Low CTR</Badge>}
                        </div>
                        <div className="flex gap-6 mt-2 text-sm">
                          <span className="text-muted-foreground">Frequency: <strong className={alert.frequency >= 5 ? "text-red-600" : "text-amber-600"}>{alert.frequency.toFixed(1)}</strong></span>
                          <span className="text-muted-foreground">CTR: <strong className={alert.ctr < 0.3 ? "text-red-600" : "text-amber-600"}>{fmtPct(alert.ctr)}</strong></span>
                          <span className="text-muted-foreground">Spend: <strong>{fmt$(alert.spend)}</strong></span>
                          <span className="text-muted-foreground">Impressions: <strong>{fmtNum(alert.impressions)}</strong></span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Pixel Health Tab ─────────────────────────────────────────────── */}
        <TabsContent value="pixels" className="space-y-4 mt-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-blue-800">Signal Diagnostics</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Pixel health determines the quality of conversion data Meta uses to optimize your campaigns. A healthy pixel is critical for accurate CPL and ROAS reporting.
              </p>
            </div>
          </div>

          {pixels.isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded" />)}
            </div>
          ) : (pixels.data?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No pixels found on this ad account.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pixels.data?.map((pixel) => (
                <Card key={pixel.pixelId} className={pixel.isHealthy ? "border-green-200" : "border-red-200"}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${pixel.isHealthy ? "bg-green-100" : "bg-red-100"}`}>
                        {pixel.isHealthy ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{pixel.pixelName}</p>
                          <Badge variant="outline" className="text-xs font-mono">{pixel.pixelId}</Badge>
                          {pixel.isHealthy ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>
                          ) : (
                            <Badge variant="destructive">Issues Detected</Badge>
                          )}
                        </div>
                        <div className="flex gap-6 mt-1.5 text-sm text-muted-foreground">
                          {pixel.lastFiredTime && (
                            <span>Last event: <strong>{new Date(pixel.lastFiredTime).toLocaleDateString()}</strong></span>
                          )}
                          {pixel.daysSinceLastFire != null && (
                            <span>Days since last fire: <strong className={pixel.daysSinceLastFire > 7 ? "text-red-600" : ""}>{pixel.daysSinceLastFire}</strong></span>
                          )}
                        </div>
                        {pixel.issues.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {pixel.issues.map((issue, i) => (
                              <li key={i} className="text-sm text-red-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {issue}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Organic-to-Paid Tab ─────────────────────────────────────────── */}
        <TabsContent value="organic2paid" className="space-y-4 mt-4">
          <OrganicToPaidTab />
        </TabsContent>

        {/* ── Hook Testing Tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="hooktesting" className="space-y-4 mt-4">
          <HookTestingTab />
        </TabsContent>

                {/* ── Optimizer Tab (Phase 3) ────────────────────────────────────────────── */}
        <TabsContent value="optimizer" className="space-y-4 mt-4">
          <OptimizerTab />
        </TabsContent>

        {/* ── Weekly Digest Tab (Phase 3) ────────────────────────────────────────── */}
        <TabsContent value="digest" className="space-y-4 mt-4">
          <WeeklyDigestTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Organic-to-Paid Tab Component
// ─────────────────────────────────────────────────────────────────────────────

type CandidateStatus = "flagged" | "recommended" | "approved" | "launched" | "dismissed";

const STATUS_LABELS: Record<CandidateStatus, { label: string; color: string }> = {
  flagged: { label: "Flagged", color: "bg-amber-100 text-amber-800" },
  recommended: { label: "Recommended", color: "bg-blue-100 text-blue-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  launched: { label: "Launched", color: "bg-purple-100 text-purple-800" },
  dismissed: { label: "Dismissed", color: "bg-gray-100 text-gray-500" },
};

function SignalStrengthBadge({ strength }: { strength: string }) {
  if (strength === "strong") return <Badge className="bg-green-100 text-green-800 border-green-200">Strong Signal</Badge>;
  if (strength === "moderate") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Moderate Signal</Badge>;
  return <Badge variant="outline">{strength}</Badge>;
}

function OrganicToPaidTab() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<CandidateStatus[]>(["flagged", "recommended", "approved"]);

  const candidates = trpc.metaAds.getPaidPromoCandidates.useQuery({ status: statusFilter });
  const runPoller = trpc.metaAds.runSignalPoller.useMutation({
    onSuccess: (data) => {
      toast.success(`Signal scan complete: ${data.videosChecked} videos checked, ${data.candidatesFlagged} flagged`);
      candidates.refetch();
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });
  const generateRec = trpc.metaAds.generateRecommendation.useMutation({
    onSuccess: () => { toast.success("Campaign recommendation generated!"); candidates.refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const approveRec = trpc.metaAds.approveRecommendation.useMutation({
    onSuccess: () => { toast.success("Approved — ready to launch"); candidates.refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const dismissCandidate = trpc.metaAds.dismissCandidate.useMutation({
    onSuccess: () => { toast.success("Dismissed"); candidates.refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const launchCampaign = trpc.metaAds.launchCampaign.useMutation({
    onSuccess: (data) => {
      toast.success("Campaign created in Meta (PAUSED) — review before activating");
      window.open(data.adsManagerUrl, "_blank");
      candidates.refetch();
    },
    onError: (e) => toast.error(`Launch failed: ${e.message}`),
  });

  const list = candidates.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Organic → Paid Signal Engine</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Videos outperforming channel averages are flagged as paid promotion candidates. Claude generates the campaign brief.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runPoller.mutate()}
          disabled={runPoller.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${runPoller.isPending ? "animate-spin" : ""}`} />
          Scan Now
        </Button>
      </div>

      {/* How it works */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Every 24 hours, the engine checks YouTube stats for all published videos.
              Videos with engagement rate &gt;3% or outlier score &gt;1.5x the channel average are flagged.
              Click <strong>Generate Brief</strong> to have Claude write a full campaign recommendation.
              Click <strong>Approve</strong> then <strong>Launch in Meta</strong> to create a PAUSED campaign ready for your review.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(["flagged", "recommended", "approved", "launched", "dismissed"] as CandidateStatus[]).map((s) => (
          <button
            key={s}
            onClick={() =>
              setStatusFilter((prev) =>
                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
              )
            }
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter.includes(s)
                ? STATUS_LABELS[s].color + " border-transparent"
                : "bg-background text-muted-foreground border-border"
            }`}
          >
            {STATUS_LABELS[s].label}
          </button>
        ))}
      </div>

      {/* Candidate list */}
      {candidates.isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-4"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No candidates match the selected filters. Click <strong>Scan Now</strong> to check for new high-performers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const rec = c.claudeRecommendation as any;
            const isExpanded = expandedId === c.id;
            const statusInfo = STATUS_LABELS[c.status as CandidateStatus] ?? { label: c.status, color: "bg-gray-100 text-gray-600" };

            return (
              <Card key={c.id} className="overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                        <SignalStrengthBadge strength={c.signalStrength ?? ""} />
                      </div>
                      <h3 className="font-medium mt-1.5 truncate">{c.youtubeTitle ?? `Video ${c.youtubeVideoId}`}</h3>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(c.viewCount ?? 0).toLocaleString()} views</span>
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{parseFloat(c.engagementRate ?? "0").toFixed(2)}% engagement</span>
                        <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" />{parseFloat(c.outlierScore ?? "0").toFixed(2)}x outlier</span>
                        {c.youtubeVideoId && (
                          <a href={`https://www.youtube.com/watch?v=${c.youtubeVideoId}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" />YouTube
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {c.status === "flagged" && (
                        <>
                          <Button size="sm" variant="outline"
                            onClick={() => generateRec.mutate({ candidateId: c.id })}
                            disabled={generateRec.isPending}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            {generateRec.isPending ? "Generating..." : "Generate Brief"}
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => dismissCandidate.mutate({ candidateId: c.id })}
                            disabled={dismissCandidate.isPending}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {c.status === "recommended" && (
                        <>
                          <Button size="sm" variant="outline"
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          >
                            {isExpanded ? "Hide" : "View Brief"}
                          </Button>
                          <Button size="sm"
                            onClick={() => approveRec.mutate({ candidateId: c.id })}
                            disabled={approveRec.isPending}
                          >
                            <ThumbsUp className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => dismissCandidate.mutate({ candidateId: c.id })}
                            disabled={dismissCandidate.isPending}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {c.status === "approved" && (
                        <>
                          <Button size="sm" variant="outline"
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          >
                            {isExpanded ? "Hide" : "View Brief"}
                          </Button>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => launchCampaign.mutate({ candidateId: c.id })}
                            disabled={launchCampaign.isPending}
                          >
                            <Rocket className="w-3.5 h-3.5 mr-1" />
                            {launchCampaign.isPending ? "Launching..." : "Launch in Meta"}
                          </Button>
                        </>
                      )}
                      {c.status === "launched" && c.metaCampaignId && (
                        <a
                          href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.metaCampaignId}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />View in Meta
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Expanded recommendation */}
                  {isExpanded && rec && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Campaign structure */}
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campaign</p>
                          <p className="text-sm font-medium">{rec.campaignName}</p>
                          <p className="text-xs text-muted-foreground">{rec.objective} · ${rec.dailyBudgetUsd}/day · {rec.recommendedRunDays} days</p>
                          <p className="text-xs text-muted-foreground mt-1">{rec.objectiveRationale}</p>
                        </div>
                        {/* Benchmarks */}
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected Performance</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                            <span className="text-muted-foreground">CPM</span><span>{rec.benchmarks?.expectedCPM}</span>
                            <span className="text-muted-foreground">CTR</span><span>{rec.benchmarks?.expectedCTR}</span>
                            <span className="text-muted-foreground">CPL</span><span>{rec.benchmarks?.expectedCPL}</span>
                            <span className="text-muted-foreground">Leads/day</span><span>{rec.benchmarks?.expectedLeadsPerDay}</span>
                          </div>
                        </div>
                        {/* Landing page */}
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Landing Page</p>
                          <a href={rec.landingPage?.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline break-all">
                            {rec.landingPage?.url?.split("?")[0]}
                          </a>
                          <p className="text-xs text-muted-foreground mt-1">{rec.landingPage?.rationale}</p>
                        </div>
                      </div>

                      {/* Ad copy */}
                      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ad Creative</p>
                        <p className="text-sm">{rec.creative?.primaryText}</p>
                        <div className="flex gap-4 text-xs">
                          <span><strong>Headline:</strong> {rec.creative?.headline}</span>
                          <span><strong>CTA:</strong> {rec.creative?.callToAction}</span>
                        </div>
                      </div>

                      {/* Targeting */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Targeting</p>
                        <p className="text-xs text-muted-foreground">Ages {rec.targeting?.ageMin}–{rec.targeting?.ageMax} · {rec.targeting?.geographicFocus}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(rec.targeting?.interests ?? []).map((i: string) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{i}</span>
                          ))}
                        </div>
                      </div>

                      {/* Why this video + notes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div><strong className="text-foreground">Why this video:</strong> {rec.whyThisVideo}</div>
                        <div><strong className="text-foreground">Notes:</strong> {rec.notes}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimizer Tab (Phase 3) — Guardrails config + optimization log
// ─────────────────────────────────────────────────────────────────────────────

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function OptimizerTab() {
  const utils = trpc.useUtils();
  const guardrails = trpc.metaAds.getGuardrails.useQuery();
  const optimizationLog = trpc.metaAds.getOptimizationLog.useQuery({ limit: 50 });
  const runNow = trpc.metaAds.runOptimizationNow.useMutation({
    onSuccess: (result) => {
      toast.success(`Optimization run complete — ${result.actionsToken?.length ?? 0} actions taken`);
      optimizationLog.refetch();
    },
    onError: (err) => toast.error(`Optimization failed: ${err.message}`),
  });
  const updateGuardrails = trpc.metaAds.updateGuardrails.useMutation({
    onSuccess: () => {
      toast.success("Guardrails saved");
      utils.metaAds.getGuardrails.invalidate();
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const g = guardrails.data;

  const [form, setForm] = useState({
    targetCpl: g?.targetCpl ?? "25",
    minDailyBudget: g?.minDailyBudget ?? "30",
    maxDailyBudget: g?.maxDailyBudget ?? "500",
    autoScaleEnabled: g?.autoScaleEnabled ?? true,
    autoPauseEnabled: g?.autoPauseEnabled ?? true,
    maxFrequencyBeforePause: g?.maxFrequencyBeforePause ?? "3.5",
    minCtrBeforePause: g?.minCtrBeforePause ?? "0.5",
    scaleUpMultiplier: g?.scaleUpMultiplier ?? "1.2",
    minSpendForAction: g?.minSpendForAction ?? "20",
  });

  // Sync form when guardrails load
  useState(() => {
    if (g) {
      setForm({
        targetCpl: g.targetCpl,
        minDailyBudget: g.minDailyBudget,
        maxDailyBudget: g.maxDailyBudget,
        autoScaleEnabled: g.autoScaleEnabled ?? true,
        autoPauseEnabled: g.autoPauseEnabled ?? true,
        maxFrequencyBeforePause: g.maxFrequencyBeforePause,
        minCtrBeforePause: g.minCtrBeforePause,
        scaleUpMultiplier: g.scaleUpMultiplier,
        minSpendForAction: g.minSpendForAction,
      });
    }
  });

  const handleSave = () => {
    updateGuardrails.mutate({
      targetCpl: parseFloat(form.targetCpl as string),
      minDailyBudget: parseFloat(form.minDailyBudget as string),
      maxDailyBudget: parseFloat(form.maxDailyBudget as string),
      autoScaleEnabled: form.autoScaleEnabled as boolean,
      autoPauseEnabled: form.autoPauseEnabled as boolean,
      maxFrequencyBeforePause: parseFloat(form.maxFrequencyBeforePause as string),
      minCtrBeforePause: parseFloat(form.minCtrBeforePause as string),
      scaleUpMultiplier: parseFloat(form.scaleUpMultiplier as string),
      minSpendForAction: parseFloat(form.minSpendForAction as string),
    });
  };

  const actionColor = (action: string) => {
    if (action === "scaled") return "text-green-700 bg-green-50";
    if (action === "paused") return "text-red-700 bg-red-50";
    if (action === "budget_adjusted") return "text-blue-700 bg-blue-50";
    return "text-gray-700 bg-gray-50";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automated Optimizer</h2>
          <p className="text-sm text-muted-foreground">
            Runs daily at 06:00 UTC — adjusts budgets, pauses underperformers, scales winners
          </p>
        </div>
        <Button
          onClick={() => runNow.mutate()}
          disabled={runNow.isPending}
          variant="outline"
          className="gap-2"
        >
          {runNow.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Run Now
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guardrails Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Budget Guardrails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {guardrails.isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Target CPL ($)</Label>
                    <Input
                      type="number"
                      value={form.targetCpl as string}
                      onChange={(e) => setForm({ ...form, targetCpl: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min Spend Before Action ($)</Label>
                    <Input
                      type="number"
                      value={form.minSpendForAction as string}
                      onChange={(e) => setForm({ ...form, minSpendForAction: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min Daily Budget ($)</Label>
                    <Input
                      type="number"
                      value={form.minDailyBudget as string}
                      onChange={(e) => setForm({ ...form, minDailyBudget: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Daily Budget ($)</Label>
                    <Input
                      type="number"
                      value={form.maxDailyBudget as string}
                      onChange={(e) => setForm({ ...form, maxDailyBudget: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Frequency Before Pause</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.maxFrequencyBeforePause as string}
                      onChange={(e) => setForm({ ...form, maxFrequencyBeforePause: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min CTR Before Pause (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.minCtrBeforePause as string}
                      onChange={(e) => setForm({ ...form, minCtrBeforePause: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Scale-Up Multiplier (e.g. 1.2 = +20%)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={form.scaleUpMultiplier as string}
                      onChange={(e) => setForm({ ...form, scaleUpMultiplier: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Auto-Scale Winners</Label>
                    <Switch
                      checked={form.autoScaleEnabled as boolean}
                      onCheckedChange={(v) => setForm({ ...form, autoScaleEnabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Auto-Pause Underperformers</Label>
                    <Switch
                      checked={form.autoPauseEnabled as boolean}
                      onCheckedChange={(v) => setForm({ ...form, autoPauseEnabled: v })}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={updateGuardrails.isPending}
                  className="w-full"
                  size="sm"
                >
                  {updateGuardrails.isPending ? "Saving..." : "Save Guardrails"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Optimization Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Optimization Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {optimizationLog.isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (optimizationLog.data?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No optimization actions yet</p>
                <p className="text-xs mt-1">Click "Run Now" to trigger the first optimization pass</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {optimizationLog.data?.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg border">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${actionColor(log.action)}`}>
                      {log.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{log.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{log.reason}</p>
                      {log.previousBudget && log.newBudget && (
                        <p className="text-xs text-muted-foreground">
                          ${log.previousBudget}/day → ${log.newBudget}/day
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Digest Tab (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

import ReactMarkdown from "react-markdown";

function WeeklyDigestTab() {
  const digests = trpc.metaAds.getWeeklyDigests.useQuery({ limit: 12 });
  const generateNow = trpc.metaAds.generateDigestNow.useMutation({
    onSuccess: () => {
      toast.success("Weekly digest generated");
      digests.refetch();
    },
    onError: (err) => toast.error(`Failed to generate digest: ${err.message}`),
  });
  const [selectedDigest, setSelectedDigest] = useState<number | null>(null);

  const selected = digests.data?.find((d) => d.id === selectedDigest) ?? digests.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Weekly Performance Digest</h2>
          <p className="text-sm text-muted-foreground">
            Generated every Monday at 08:00 UTC — Claude analyzes your week and recommends actions
          </p>
        </div>
        <Button
          onClick={() => generateNow.mutate()}
          disabled={generateNow.isPending}
          variant="outline"
          className="gap-2"
        >
          {generateNow.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Now
        </Button>
      </div>

      {digests.isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (digests.data?.length ?? 0) === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No digests yet</p>
          <p className="text-sm mt-1">Click "Generate Now" to create your first weekly digest</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Digest list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</p>
            {digests.data?.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDigest(d.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  (selected?.id === d.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-medium">{d.weekStartDate} – {d.weekEndDate}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">${d.totalSpend} spend</span>
                  <span className="text-xs text-muted-foreground">{d.totalLeads} leads</span>
                  <span className="text-xs text-muted-foreground">CPL ${d.avgCpl}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Digest content */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Week of {selected.weekStartDate}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>${selected.totalSpend} spend</span>
                      <span>{selected.totalLeads} leads</span>
                      <span>CPL ${selected.avgCpl}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{selected.digestMarkdown}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">Select a digest from the list</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HookTestingTab() {
  const [topic, setTopic] = useState("");
  const [targetProduct, setTargetProduct] = useState<"lightsOn" | "academy" | "upstream" | "kbmoTesting" | "general">("lightsOn");
  const [videoUrl, setVideoUrl] = useState("");
  const [dailyBudget, setDailyBudget] = useState(5);
  const [testDays, setTestDays] = useState(5);
  const [generatedHooks, setGeneratedHooks] = useState<null | {
    id: number;
    variants: {
      framework: string;
      frameworkLabel: string;
      hookText: string;
      overlayText: string;
      whyItWorks: string;
      estimatedCTRLift: string;
      deliveryNote: string;
    }[];
  }>(null);

  const hookGenerations = trpc.metaAds.getHookGenerations.useQuery({ limit: 10 });
  const abTests = trpc.metaAds.getHookAbTests.useQuery({ limit: 10 });

  const generateHooks = trpc.metaAds.generateHooks.useMutation({
    onSuccess: (data) => {
      setGeneratedHooks({ id: data.id, variants: data.variants });
      toast.success(`Generated ${data.variants.length} hook variants!`);
      hookGenerations.refetch();
    },
    onError: (err) => toast.error(`Hook generation failed: ${err.message}`),
  });

  const launchTest = trpc.metaAds.launchHookAbTest.useMutation({
    onSuccess: (data) => {
      toast.success(`A/B test launched! Campaign created — ${data.adIds.length} ads queued. Check Meta Ads Manager.`);
      abTests.refetch();
    },
    onError: (err) => toast.error(`Launch failed: ${err.message}`),
  });

  const checkWinner = trpc.metaAds.checkHookWinner.useMutation({
    onSuccess: (data) => {
      if (data.winner) {
        toast.success(`Winner found: ${data.winner.framework} (CTR: ${data.winner.ctr.toFixed(2)}%)`);
      } else {
        toast.info("No clear winner yet — test needs more data.");
      }
      abTests.refetch();
    },
    onError: (err) => toast.error(`Check failed: ${err.message}`),
  });

  const promoteWinner = trpc.metaAds.promoteHookWinner.useMutation({
    onSuccess: () => {
      toast.success("Winner promoted to full campaign!");
      abTests.refetch();
    },
    onError: (err) => toast.error(`Promotion failed: ${err.message}`),
  });

  // suppress unused var warning
  void hookGenerations;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Viral Hook A/B Testing</h2>
        <p className="text-sm text-muted-foreground">
          Generate 5 hook variants using 8 proven viral frameworks, run Meta A/B tests at $3–5/day per variant, then promote the winner.
        </p>
      </div>

      {/* Generate Hooks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Step 1 — Generate Hook Variants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Topic / Script Idea</label>
              <input
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Why you're always tired after 40"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Product</label>
              <Select value={targetProduct} onValueChange={(v) => setTargetProduct(v as typeof targetProduct)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lightsOn">Lights On ($369/yr)</SelectItem>
                  <SelectItem value="academy">Urban Monk Academy</SelectItem>
                  <SelectItem value="upstream">Upstream Course</SelectItem>
                  <SelectItem value="kbmoTesting">KBMO Testing</SelectItem>
                  <SelectItem value="general">General / Awareness</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => generateHooks.mutate({ topic, targetProduct, count: 5 })}
            disabled={generateHooks.isPending || !topic.trim()}
            className="gap-2"
          >
            {generateHooks.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate 5 Hook Variants
          </Button>
        </CardContent>
      </Card>

      {/* Generated Hooks */}
      {generatedHooks && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Step 2 — Review &amp; Launch A/B Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {generatedHooks.variants.map((v, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{v.frameworkLabel}</Badge>
                    <span className="text-xs text-green-400">{v.estimatedCTRLift} CTR lift</span>
                  </div>
                  <p className="text-sm font-medium">{v.hookText}</p>
                  <p className="text-xs text-muted-foreground mt-1">Overlay: {v.overlayText}</p>
                  <p className="text-xs text-muted-foreground">{v.whyItWorks}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video URL (for ads)</label>
                <input
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Budget / Variant ($)</label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Test Duration (days)</label>
                <input
                  type="number"
                  min={3}
                  max={14}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={testDays}
                  onChange={(e) => setTestDays(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              onClick={() =>
                launchTest.mutate({
                  hookGenerationId: generatedHooks.id,
                  topic,
                  targetProduct,
                  variants: generatedHooks.variants,
                  videoUrl,
                  dailyBudgetPerVariant: dailyBudget,
                  testDurationDays: testDays,
                })
              }
              disabled={launchTest.isPending || !videoUrl.trim()}
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {launchTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Launch A/B Test on Meta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active A/B Tests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Active &amp; Past A/B Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {abTests.isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : (abTests.data?.length ?? 0) === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No A/B tests yet — generate hooks above and launch your first test.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {abTests.data?.map((test) => (
                <div key={test.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{test.topic}</p>
                      <p className="text-xs text-muted-foreground">{test.targetProduct} · {test.variantCount} variants · ${test.dailyBudgetPerVariant}/day each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          test.status === "active" ? "border-green-500 text-green-400" :
                          test.status === "winner_selected" ? "border-yellow-500 text-yellow-400" :
                          test.status === "completed" ? "border-blue-500 text-blue-400" :
                          "border-border text-muted-foreground"
                        }
                      >
                        {test.status}
                      </Badge>
                      {test.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => checkWinner.mutate({ testId: test.id })}
                          disabled={checkWinner.isPending}
                        >
                          {checkWinner.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Check Winner
                        </Button>
                      )}
                      {test.status === "winner_selected" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => promoteWinner.mutate({ testId: test.id, fullDailyBudget: 50 })}
                          disabled={promoteWinner.isPending}
                        >
                          {promoteWinner.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
                          Promote Winner
                        </Button>
                      )}
                    </div>
                  </div>
                  {test.winnerFramework && (
                    <div className="mt-2 p-2 rounded bg-yellow-950/30 border border-yellow-700/30">
                      <p className="text-xs text-yellow-400 font-medium">Winner: {test.winnerFramework}</p>
                      {test.winnerCtr && <p className="text-xs text-muted-foreground mt-0.5">CTR: {test.winnerCtr}% · CPL: ${test.winnerCpl}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
