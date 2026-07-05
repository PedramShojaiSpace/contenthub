import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Pause, Play, RefreshCw, AlertTriangle,
  DollarSign, ShoppingCart, Target, Eye, Zap, BarChart2
} from "lucide-react";

const REC_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pause:       { label: "PAUSE",       color: "text-red-700",    bg: "bg-red-50 border-red-200",    icon: <Pause className="w-3 h-3" /> },
  scale:       { label: "SCALE",       color: "text-green-700",  bg: "bg-green-50 border-green-200", icon: <TrendingUp className="w-3 h-3" /> },
  watch:       { label: "WATCH",       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200", icon: <Eye className="w-3 h-3" /> },
  test:        { label: "TESTING",     color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",   icon: <Zap className="w-3 h-3" /> },
  investigate: { label: "INVESTIGATE", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> },
};

function RecBadge({ rec }: { rec: string }) {
  const cfg = REC_CONFIG[rec] || REC_CONFIG.watch;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${cfg.color} ${cfg.bg}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function fmt$(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtRoas(roas: string | number) {
  const v = parseFloat(String(roas));
  return isNaN(v) ? "—" : `${v.toFixed(2)}x`;
}

export default function CampaignMonitor() {
  const [datePreset, setDatePreset] = useState("yesterday");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data: briefing, refetch: refetchBriefing, isLoading: briefingLoading } = trpc.adsMonitor.getTodayBriefing.useQuery();
  const { data: snapshots, refetch: refetchSnapshots, isLoading: snapshotsLoading } = trpc.adsMonitor.getTodaySnapshots.useQuery();
  const { data: summary } = trpc.adsMonitor.getSummary.useQuery({ days: 30 });

  const syncMutation = trpc.adsMonitor.runSync.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync complete: ${data.snapshotCount} ad sets analyzed. ${data.pauseCount} to pause, ${data.scaleCount} to scale.`);
      refetchBriefing();
      refetchSnapshots();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const pauseList = (snapshots as any[] || []).filter((s: any) => s.recommendation === "pause");
  const scaleList = (snapshots as any[] || []).filter((s: any) => s.recommendation === "scale");
  const watchList = (snapshots as any[] || []).filter((s: any) => s.recommendation === "watch" || s.recommendation === "test" || s.recommendation === "investigate");

  const totalSpend = (snapshots as any[] || []).reduce((s: number, r: any) => s + (r.spend_cents || 0), 0);
  const totalPurchases = (snapshots as any[] || []).reduce((s: number, r: any) => s + (r.purchases || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaign Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">Daily media buyer intelligence — automated performance analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last_3d">Last 3 days</SelectItem>
                <SelectItem value="last_7d">Last 7 days</SelectItem>
                <SelectItem value="last_14d">Last 14 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => syncMutation.mutate({ datePreset })}
              disabled={syncMutation.isPending}
              className="bg-[#2D5A27] hover:bg-[#1e3d1a] text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </div>

        {/* Action Alerts */}
        {(pauseList.length > 0 || scaleList.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pauseList.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Pause className="w-4 h-4 text-red-600" />
                  <span className="font-semibold text-red-700">⛔ Pause These Now ({pauseList.length})</span>
                </div>
                <ul className="space-y-1">
                  {pauseList.map((s: any, i: number) => (
                    <li key={i} className="text-sm text-red-800">
                      <span className="font-medium">{s.adset_name || s.campaign_name}</span>
                      <span className="text-red-600 ml-2">— {s.recommendation_reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scaleList.length > 0 && (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-700">🚀 Scale These ({scaleList.length})</span>
                </div>
                <ul className="space-y-1">
                  {scaleList.map((s: any, i: number) => (
                    <li key={i} className="text-sm text-green-800">
                      <span className="font-medium">{s.adset_name || s.campaign_name}</span>
                      <span className="text-green-600 ml-2">— {s.recommendation_reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign className="w-3 h-3" /> Total Spend</div>
              <div className="text-2xl font-bold text-gray-900">{fmt$(totalSpend)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{(snapshots as any[] || []).filter((s: any) => s.status === "ACTIVE").length} active ad sets</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><ShoppingCart className="w-3 h-3" /> Purchases</div>
              <div className="text-2xl font-bold text-gray-900">{totalPurchases}</div>
              <div className="text-xs text-gray-400 mt-0.5">Est. revenue {fmt$(totalPurchases * 39900)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><BarChart2 className="w-3 h-3" /> Blended ROAS</div>
              <div className="text-2xl font-bold text-gray-900">
                {totalSpend > 0 && totalPurchases > 0 ? `${((totalPurchases * 39900) / totalSpend).toFixed(2)}x` : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Target: 2.5x+</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Target className="w-3 h-3" /> Avg CPA</div>
              <div className="text-2xl font-bold text-gray-900">
                {totalPurchases > 0 ? fmt$(Math.round(totalSpend / totalPurchases)) : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Target: under $120</div>
            </CardContent>
          </Card>
        </div>

        {/* AI Briefing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Today's Media Buyer Briefing
              {briefingLoading && <span className="text-xs text-gray-400 font-normal">Loading...</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {briefing ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4 border">
                  {(briefing as any).briefing_text || "No briefing generated yet. Click Sync Now to generate."}
                </pre>
                <p className="text-xs text-gray-400 mt-2">
                  Generated {(briefing as any).generated_at ? new Date((briefing as any).generated_at).toLocaleString() : "—"}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No briefing for today yet.</p>
                <p className="text-xs mt-1">Click "Sync Now" to pull Meta data and generate your daily briefing.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ad Set Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ad Set Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {snapshotsLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading ad sets...</div>
            ) : (snapshots as any[] || []).length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No snapshot data for today.</p>
                <p className="text-xs mt-1">Click "Sync Now" to pull your Meta campaign data.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-3 px-4 font-medium">Ad Set / Campaign</th>
                      <th className="text-right py-3 px-3 font-medium">Spend</th>
                      <th className="text-right py-3 px-3 font-medium">Purchases</th>
                      <th className="text-right py-3 px-3 font-medium">ROAS</th>
                      <th className="text-right py-3 px-3 font-medium">CPA</th>
                      <th className="text-right py-3 px-3 font-medium">CTR</th>
                      <th className="text-right py-3 px-3 font-medium">Freq</th>
                      <th className="text-center py-3 px-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(snapshots as any[]).map((s: any, i: number) => (
                      <>
                        <tr
                          key={i}
                          className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                            s.recommendation === "pause" ? "bg-red-50/40" :
                            s.recommendation === "scale" ? "bg-green-50/40" : ""
                          }`}
                          onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900 truncate max-w-xs" title={s.adset_name || s.campaign_name}>
                              {s.adset_name || s.campaign_name}
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-xs" title={s.campaign_name}>
                              {s.campaign_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono">{fmt$(s.spend_cents || 0)}</td>
                          <td className="py-3 px-3 text-right font-mono">{s.purchases || 0}</td>
                          <td className={`py-3 px-3 text-right font-mono font-semibold ${
                            parseFloat(s.roas) >= 3 ? "text-green-700" :
                            parseFloat(s.roas) >= 2 ? "text-amber-700" :
                            parseFloat(s.roas) > 0 ? "text-red-700" : "text-gray-400"
                          }`}>{fmtRoas(s.roas)}</td>
                          <td className="py-3 px-3 text-right font-mono">
                            {s.cpa_cents ? fmt$(s.cpa_cents) : "—"}
                          </td>
                          <td className={`py-3 px-3 text-right font-mono ${
                            parseFloat(s.ctr) >= 1.5 ? "text-green-700" :
                            parseFloat(s.ctr) >= 0.8 ? "text-amber-700" : "text-red-700"
                          }`}>{parseFloat(s.ctr || "0").toFixed(2)}%</td>
                          <td className={`py-3 px-3 text-right font-mono ${
                            parseFloat(s.frequency) > 4 ? "text-red-700 font-semibold" :
                            parseFloat(s.frequency) > 2.5 ? "text-amber-700" : "text-gray-700"
                          }`}>{parseFloat(s.frequency || "0").toFixed(1)}</td>
                          <td className="py-3 px-4 text-center">
                            <RecBadge rec={s.recommendation || "watch"} />
                          </td>
                        </tr>
                        {expandedRow === i && (
                          <tr key={`${i}-expanded`} className="bg-gray-50 border-b">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="text-sm text-gray-700">
                                <span className="font-semibold">Reason: </span>
                                {s.recommendation_reason || "No reason provided."}
                              </div>
                              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span>Impressions: {(s.impressions || 0).toLocaleString()}</span>
                                <span>CPM: {s.cpm_cents ? fmt$(s.cpm_cents) : "—"}</span>
                                <span>Reach: {(s.reach || 0).toLocaleString()}</span>
                                <span>Budget: {s.daily_budget_cents ? fmt$(s.daily_budget_cents) + "/day" : "—"}</span>
                                <span>Status: {s.status || "—"}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 30-day summary */}
        {summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-medium">30-Day Tracked Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{fmt$((summary as any).total_spend || 0)}</div>
                  <div className="text-xs text-gray-400">Total Spend</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{fmt$((summary as any).total_revenue || 0)}</div>
                  <div className="text-xs text-gray-400">Total Revenue</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{parseFloat((summary as any).avg_roas || "0").toFixed(2)}x</div>
                  <div className="text-xs text-gray-400">Avg ROAS</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">{(summary as any).total_paused || 0}</div>
                  <div className="text-xs text-gray-400">Ad Sets Paused</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">{(summary as any).total_scaled || 0}</div>
                  <div className="text-xs text-gray-400">Ad Sets Scaled</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{(summary as any).days_tracked || 0}</div>
                  <div className="text-xs text-gray-400">Days Tracked</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
