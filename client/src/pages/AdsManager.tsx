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
      </Tabs>
    </div>
  );
}
