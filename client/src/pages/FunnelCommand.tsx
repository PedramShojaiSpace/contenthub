import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpCircle,
  BarChart3,
  Users,
  DollarSign,
  Target,
  Zap,
  FileText,
  Calendar,
} from "lucide-react";
import { Streamdown } from "streamdown";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(rate: number | null) {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function TrendIcon({ trend }: { trend: "up" | "flat" | "down" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

const FUNNEL_COLORS: Record<string, string> = {
  lights_on: "bg-amber-50 border-amber-200",
  oral_biome: "bg-teal-50 border-teal-200",
  gut: "bg-green-50 border-green-200",
};

const FUNNEL_ACCENT: Record<string, string> = {
  lights_on: "text-amber-700",
  oral_biome: "text-teal-700",
  gut: "text-green-700",
};

const FUNNEL_BADGE: Record<string, string> = {
  lights_on: "bg-amber-100 text-amber-800 border-amber-200",
  oral_biome: "bg-teal-100 text-teal-800 border-teal-200",
  gut: "bg-green-100 text-green-800 border-green-200",
};

// ── Components ────────────────────────────────────────────────────────────────

function ScorecardPanel({
  days,
  upgradeRate,
}: {
  days: number;
  upgradeRate: number;
}) {
  const { data, isLoading } = trpc.funnelCommand.getScorecards.useQuery({ days, academyUpgradeRate: upgradeRate });
  const contentCounts = trpc.funnelCommand.getContentByFunnel.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["lights_on", "oral_biome", "gut"].map(id => (
          <div key={id} className="h-64 rounded-xl border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {data?.scorecards.map(sc => (
        <div
          key={sc.funnelId}
          className={`rounded-xl border p-5 flex flex-col gap-3 ${FUNNEL_COLORS[sc.funnelId] ?? "bg-card border-border"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-base ${FUNNEL_ACCENT[sc.funnelId] ?? ""}`}>
                {sc.label}
              </span>
              <TrendIcon trend={sc.revenueTrend} />
            </div>
            <Badge variant="outline" className={`text-xs ${FUNNEL_BADGE[sc.funnelId] ?? ""}`}>
              {days}d
            </Badge>
          </div>

          {/* Revenue */}
          <div>
            <p className="text-2xl font-bold text-foreground">{fmt$(sc.revenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              vs {fmt$(sc.priorRevenue)} prior {days}d
            </p>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Buyers</span>
              <span className="font-medium">{sc.buyers}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Take-rate</span>
              <span className="font-medium">{fmtPct(sc.takeRate)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Avg order</span>
              <span className="font-medium">{fmt$(sc.avgOrderCents)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">EV / buyer</span>
              <span className="font-medium text-primary">{fmt$(sc.evPerBuyerCents)}</span>
            </div>
          </div>

          {/* Content count */}
          {contentCounts.data && (
            <div className="pt-1 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                {contentCounts.data[sc.funnelId] ?? 0} content items tagged
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TakeRateTable({ days }: { days: number }) {
  const { data, isLoading } = trpc.funnelCommand.getTakeRateCohorts.useQuery({ days });

  if (isLoading) {
    return <div className="h-48 rounded-xl border bg-muted/30 animate-pulse" />;
  }

  const cohorts = data?.cohorts ?? [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Funnel</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Clicks</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sales</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Take-rate</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg order</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No attribution data for this period. UTM-tagged ad clicks will appear here once the attribution bridge is live.
                </td>
              </tr>
            ) : (
              cohorts.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.utmSource}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">{row.utmCampaign}</td>
                  <td className="px-4 py-3">
                    {row.funnelId ? (
                      <Badge variant="outline" className={`text-xs ${FUNNEL_BADGE[row.funnelId] ?? ""}`}>
                        {row.funnelLabel}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Untagged</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{row.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{row.sales}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {row.takeRate !== null ? (
                      <span className={row.takeRate > 0.02 ? "text-emerald-600" : "text-muted-foreground"}>
                        {fmtPct(row.takeRate)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{fmt$(row.revenue)}</td>
                  <td className="px-4 py-3 text-right">{fmt$(row.avgOrderCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AscensionPanel() {
  const { data, isLoading } = trpc.funnelCommand.getAscensionSummary.useQuery();

  if (isLoading) {
    return <div className="h-32 rounded-xl border bg-muted/30 animate-pulse" />;
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl border bg-amber-50 border-amber-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Total Lights On Buyers</span>
        </div>
        <p className="text-3xl font-bold text-foreground">{data.totalLightsOnBuyers}</p>
      </div>
      <div className="rounded-xl border bg-purple-50 border-purple-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <ArrowUpCircle className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-700">Eligible for Year 2 Offer</span>
        </div>
        <p className="text-3xl font-bold text-foreground">{data.eligibleForY2}</p>
        <p className="text-xs text-muted-foreground mt-1">Purchased &gt; 300 days ago</p>
      </div>
      <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Year 2 Revenue Potential</span>
        </div>
        <p className="text-3xl font-bold text-foreground">{fmt$(data.potentialRevenueCents)}</p>
        <p className="text-xs text-muted-foreground mt-1">At {fmt$(data.y2PriceCents)} per buyer</p>
      </div>
    </div>
  );
}

function WeeklyDigestPanel() {
  const { data, isLoading } = trpc.funnelCommand.getWeeklyDigest.useQuery();

  if (isLoading) {
    return <div className="h-48 rounded-xl border bg-muted/30 animate-pulse" />;
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No weekly digest yet. The first digest will appear here after the Monday 8am UTC cron runs.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Week of {data.weekStartDate} — {data.weekEndDate}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {data.totalSpend && <span>Spend: ${Number(data.totalSpend).toFixed(0)}</span>}
          {data.totalLeads && <span>Leads: {data.totalLeads}</span>}
          {data.avgCpl && <span>CPL: ${Number(data.avgCpl).toFixed(2)}</span>}
        </div>
      </div>
      <div className="prose prose-sm max-w-none">
        <Streamdown>{data.digestMarkdown}</Streamdown>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FunnelCommand() {
  const [days, setDays] = useState(30);
  const [upgradeRate, setUpgradeRate] = useState(0.12);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funnel Command</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Owner's Monday view — three funnels, one screen.
          </p>
        </div>
        <div className="flex items-center gap-6 bg-card border rounded-xl px-5 py-3">
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Window: {days} days</label>
            <Slider
              min={7}
              max={90}
              step={7}
              value={[days]}
              onValueChange={([v]) => setDays(v)}
              className="w-32"
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <label className="text-xs text-muted-foreground font-medium">
              Y2 upgrade rate: {(upgradeRate * 100).toFixed(0)}%
            </label>
            <Slider
              min={0.02}
              max={0.30}
              step={0.01}
              value={[upgradeRate]}
              onValueChange={([v]) => setUpgradeRate(v)}
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* Scorecards */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Funnel Scorecards</h2>
        </div>
        <ScorecardPanel days={days} upgradeRate={upgradeRate} />
      </section>

      {/* Tabs: Take-rate | Ascension | Weekly Digest */}
      <Tabs defaultValue="takeRate">
        <TabsList className="mb-4">
          <TabsTrigger value="takeRate" className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Take-Rate Cohorts
          </TabsTrigger>
          <TabsTrigger value="ascension" className="flex items-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Ascension Pipeline
          </TabsTrigger>
          <TabsTrigger value="digest" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Weekly Digest
          </TabsTrigger>
        </TabsList>

        <TabsContent value="takeRate">
          <TakeRateTable days={days} />
        </TabsContent>

        <TabsContent value="ascension">
          <div className="space-y-4">
            <div className="rounded-xl border bg-amber-50/50 border-amber-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Year 2 Ascension Strategy</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Per project strategy: Lights On Year 1 = $299. Year 2 = avatar-specific curriculum at $598+.
                    Buyers who completed Year 1 (&gt;300 days ago) are eligible for the Year 2 offer.
                    The Academy itself is reserved for higher-tier pricing.
                  </p>
                </div>
              </div>
            </div>
            <AscensionPanel />
          </div>
        </TabsContent>

        <TabsContent value="digest">
          <WeeklyDigestPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
