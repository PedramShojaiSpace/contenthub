import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BarChart3, Copy, Loader2, TrendingUp, TrendingDown, Minus,
  Star, ArrowRight, RefreshCw, FlaskConical, LayoutGrid,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlatformStat {
  platform: string;
  postsPublished: number;
  totalReach: number;
  totalEngagement: number;
  engagementRate: number;
  topPost: string;
  trend: "up" | "down" | "flat";
}

interface AnalyticsReport {
  id: number;
  period: string;
  platformStats: PlatformStat[];
  topPerformingContent: string[];
  underperformingContent: string[];
  keyInsights: string[];
  nextWeekRecommendations: string[];
  contentPillarsToDouble: string[];
  contentPillarsToDrop: string[];
  overallNarrative: string;
  createdAt: Date | string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TREND_ICONS = {
  up: <TrendingUp className="w-3.5 h-3.5 text-green-500" />,
  down: <TrendingDown className="w-3.5 h-3.5 text-red-500" />,
  flat: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-pink-100 text-pink-700 border-pink-200",
  instagram: "bg-purple-100 text-purple-700 border-purple-200",
  youtube: "bg-red-100 text-red-700 border-red-200",
  linkedin: "bg-blue-100 text-blue-700 border-blue-200",
  x: "bg-gray-100 text-gray-700 border-gray-200",
};

// Recharts bar colors per platform (hex for recharts)
const PLATFORM_BAR_COLORS: Record<string, string> = {
  tiktok: "#ec4899",    // pink-500
  instagram: "#a855f7", // purple-500
  youtube: "#ef4444",   // red-500
  linkedin: "#3b82f6",  // blue-500
  x: "#6b7280",         // gray-500
};

const PLATFORMS_ORDERED = ["tiktok", "instagram", "youtube", "linkedin", "x"] as const;
type Platform = (typeof PLATFORMS_ORDERED)[number];

const PLATFORMS_FILTER = ["all", ...PLATFORMS_ORDERED] as const;
type PlatformFilter = (typeof PLATFORMS_FILTER)[number];

const FRAMEWORK_BAR_COLORS: Record<string, string> = {
  contradiction: "#ef4444",
  specificity: "#3b82f6",
  timeframe: "#f59e0b",
  pov: "#22c55e",
  "curiosity gap": "#a855f7",
  curiositygap: "#a855f7",
  "social proof": "#06b6d4",
  socialproof: "#06b6d4",
  transformation: "#f97316",
};

// Normalize framework keys to display labels
function fwLabel(fw: string): string {
  return fw
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ stat }: { stat: PlatformStat }) {
  const color = PLATFORM_COLORS[stat.platform] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={`text-xs capitalize ${color}`}>{stat.platform}</Badge>
        <div className="flex items-center gap-1">
          {TREND_ICONS[stat.trend]}
          <span className="text-xs text-muted-foreground">{stat.trend}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{stat.postsPublished}</p>
          <p className="text-xs text-muted-foreground">Posts</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">
            {stat.totalReach >= 1000 ? `${(stat.totalReach / 1000).toFixed(1)}K` : stat.totalReach}
          </p>
          <p className="text-xs text-muted-foreground">Reach</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{stat.engagementRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Eng. Rate</p>
        </div>
      </div>
      {stat.topPost && (
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-xs text-muted-foreground mb-0.5">Top Post</p>
          <p className="text-xs text-foreground line-clamp-2">{stat.topPost}</p>
        </div>
      )}
    </div>
  );
}

// ─── FrameworkChart (single-platform) ─────────────────────────────────────────
function FrameworkChart() {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const query = trpc.viralStudio.getTopFrameworks.useQuery({
    platform: platformFilter === "all" ? undefined : platformFilter,
  } as any);

  const data = (query.data ?? []).map((row: any) => ({
    name: fwLabel(row.framework),
    rawName: row.framework,
    winRate: row.totalTests > 0 ? Math.round((row.winCount / row.totalTests) * 100) : 0,
    wins: row.winCount,
    tests: row.totalTests,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-violet-500" />
            Hook Framework Win Rates
            <span className="text-xs font-normal text-muted-foreground">(from A/B Test Lab)</span>
          </CardTitle>
          {/* Platform filter pills */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {PLATFORMS_FILTER.map((p) => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-2.5 py-1 font-medium capitalize transition-colors ${
                  platformFilter === p
                    ? "bg-violet-600 text-white"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <FlaskConical className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No A/B test winners yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Declare winners in the A/B Test Lab to populate this chart
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `${value}% (${props.payload.wins}/${props.payload.tests} tests)`,
                    "Win Rate",
                  ]}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={FRAMEWORK_BAR_COLORS[entry.rawName.toLowerCase()] ?? "#8b5cf6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend table */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.map((row) => (
                <div key={row.rawName} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: FRAMEWORK_BAR_COLORS[row.rawName.toLowerCase()] ?? "#8b5cf6" }}
                  />
                  <span className="text-foreground font-medium">{row.name}</span>
                  <span className="text-muted-foreground ml-auto">{row.winRate}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PlatformComparisonChart ──────────────────────────────────────────────────
// Grouped bar chart: X-axis = framework, one bar per platform, side by side.
function PlatformComparisonChart() {
  const [visiblePlatforms, setVisiblePlatforms] = useState<Set<string>>(
    new Set(PLATFORMS_ORDERED)
  );

  const query = trpc.viralStudio.getAllPlatformFrameworks.useQuery();

  const rawRows: Array<{ platform: string; framework: string; winRate: number; winCount: number; totalTests: number }> =
    query.data ?? [];

  // Build a set of all unique frameworks present in the data
  const allFrameworks = Array.from(new Set(rawRows.map((r) => r.framework)));

  // Build grouped chart data: one entry per framework, with a key per platform
  const chartData = allFrameworks.map((fw) => {
    const entry: Record<string, any> = { framework: fwLabel(fw), rawFramework: fw };
    for (const p of PLATFORMS_ORDERED) {
      const row = rawRows.find((r) => r.framework === fw && r.platform === p);
      entry[p] = row?.winRate ?? 0;
      entry[`${p}_wins`] = row?.winCount ?? 0;
      entry[`${p}_tests`] = row?.totalTests ?? 0;
    }
    return entry;
  });

  // Best framework per platform summary
  const bestPerPlatform: Array<{ platform: string; framework: string; winRate: number }> =
    PLATFORMS_ORDERED.map((p) => {
      const rows = rawRows.filter((r) => r.platform === p);
      if (rows.length === 0) return null;
      const best = rows.reduce((a, b) => (a.winRate >= b.winRate ? a : b));
      return { platform: p, framework: best.framework, winRate: best.winRate };
    }).filter(Boolean) as Array<{ platform: string; framework: string; winRate: number }>;

  const togglePlatform = (p: string) => {
    setVisiblePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-emerald-500" />
            Platform Comparison
            <span className="text-xs font-normal text-muted-foreground">
              — framework win rates across all platforms
            </span>
          </CardTitle>
          {/* Platform toggle pills */}
          <div className="flex flex-wrap gap-1">
            {PLATFORMS_ORDERED.map((p) => {
              const active = visiblePlatforms.has(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border transition-all ${
                    active
                      ? "text-white border-transparent"
                      : "bg-background text-muted-foreground border-border opacity-50"
                  }`}
                  style={active ? { background: PLATFORM_BAR_COLORS[p] } : undefined}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <LayoutGrid className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No cross-platform data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run A/B tests on multiple platforms and declare winners to see comparisons here
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
                barCategoryGap="20%"
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="framework"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div
                        className="rounded-lg border border-border bg-popover p-3 shadow-md text-xs space-y-1"
                        style={{ minWidth: 160 }}
                      >
                        <p className="font-semibold text-foreground mb-1">{label}</p>
                        {payload.map((entry: any) => {
                          const p = entry.dataKey as string;
                          const wins = entry.payload[`${p}_wins`];
                          const tests = entry.payload[`${p}_tests`];
                          if (!visiblePlatforms.has(p)) return null;
                          return (
                            <div key={p} className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: PLATFORM_BAR_COLORS[p] }}
                              />
                              <span className="capitalize text-muted-foreground">{p}:</span>
                              <span className="font-medium text-foreground ml-auto">
                                {entry.value}%
                                {tests > 0 && (
                                  <span className="text-muted-foreground font-normal ml-1">
                                    ({wins}/{tests})
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs capitalize text-muted-foreground">{value}</span>
                  )}
                />
                {PLATFORMS_ORDERED.filter((p) => visiblePlatforms.has(p)).map((p) => (
                  <Bar
                    key={p}
                    dataKey={p}
                    name={p}
                    fill={PLATFORM_BAR_COLORS[p]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Best framework per platform summary table */}
            {bestPerPlatform.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Best Framework Per Platform
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {bestPerPlatform.map(({ platform, framework, winRate }) => (
                    <div
                      key={platform}
                      className="rounded-lg border border-border p-2.5 text-center space-y-1"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: PLATFORM_BAR_COLORS[platform] ?? "#6b7280" }}
                        />
                        <span className="text-xs font-medium capitalize text-foreground">
                          {platform}
                        </span>
                      </div>
                      <p
                        className="text-xs font-semibold"
                        style={{ color: FRAMEWORK_BAR_COLORS[framework.toLowerCase()] ?? "#8b5cf6" }}
                      >
                        {fwLabel(framework)}
                      </p>
                      <p className="text-xs text-muted-foreground">{winRate}% win rate</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [period, setPeriod] = useState<"last_7_days" | "last_30_days" | "last_90_days">("last_30_days");

  const generateMutation = trpc.viralStudio.generateAnalyticsNarrative.useMutation({
    onSuccess: (data: any) => {
      setReport(data as unknown as AnalyticsReport);
      toast.success("Analytics report generated!");
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const recentQuery = trpc.viralStudio.getRecentHooks.useQuery({ limit: 5 });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const PERIOD_LABELS = {
    last_7_days: "Last 7 Days",
    last_30_days: "Last 30 Days",
    last_90_days: "Last 90 Days",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Explainer */}
      <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-xl p-4">
        <h3 className="font-semibold text-cyan-900 mb-1 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Performance Analytics & Strategy Narrative
        </h3>
        <p className="text-sm text-cyan-700">
          Generate a monthly performance report with AI-written narrative: what worked, what to double down on, what to drop, and a concrete action plan for next week. The framework win-rate charts below are populated automatically as you declare winners in the A/B Test Lab.
        </p>
      </div>

      {/* Framework Win-Rate Chart — single platform filter */}
      <FrameworkChart />

      {/* Platform Comparison Chart — all platforms side by side */}
      <PlatformComparisonChart />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["last_7_days", "last_30_days", "last_90_days"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p ? "bg-cyan-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <Button
          onClick={() =>
            generateMutation.mutate({
              periodLabel: PERIOD_LABELS[period],
              topPosts: [],
              totalPosts: 0,
            })
          }
          disabled={generateMutation.isPending}
          className="bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          {generateMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Generate Report</>
          )}
        </Button>
      </div>

      {report ? (
        <div className="space-y-6">
          {/* Platform Stats Grid */}
          {report.platformStats?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Platform Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.platformStats.map((stat, i) => (
                  <StatCard key={i} stat={stat} />
                ))}
              </div>
            </div>
          )}

          {/* Overall Narrative */}
          {report.overallNarrative && (
            <div className="p-4 bg-muted/30 border border-border rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Strategy Narrative</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => handleCopy(report.overallNarrative)}
                >
                  <Copy className="w-3 h-3 mr-1" />Copy
                </Button>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {report.overallNarrative}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {report.contentPillarsToDouble?.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Double Down On
                </h3>
                <ul className="space-y-2">
                  {report.contentPillarsToDouble.map((pillar, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Star className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      {pillar}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.contentPillarsToDrop?.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Drop or Pivot
                </h3>
                <ul className="space-y-2">
                  {report.contentPillarsToDrop.map((pillar, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Minus className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      {pillar}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {report.keyInsights?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h3 className="text-sm font-semibold text-amber-800 mb-3">Key Insights</h3>
              <ul className="space-y-2">
                {report.keyInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.nextWeekRecommendations?.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Next Week Action Plan
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 text-blue-700"
                  onClick={() => handleCopy(report.nextWeekRecommendations.join("\n"))}
                >
                  <Copy className="w-3 h-3 mr-1" />Copy
                </Button>
              </div>
              <ol className="space-y-2">
                {report.nextWeekRecommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl text-center p-6">
          <BarChart3 className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Generate a report to see your performance analytics and strategy narrative
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Note: Analytics are based on content in your Command Center. Connect more platforms for richer data.
          </p>
        </div>
      )}

      {recentQuery.data && recentQuery.data.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Previous Reports</h3>
            <div className="space-y-2">
              {recentQuery.data.map((r: any) => (
                <button
                  key={r.id}
                  className="w-full text-left border border-border rounded-lg p-3 hover:border-cyan-300 transition-colors"
                  onClick={() => setReport(r as unknown as AnalyticsReport)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {r.period?.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-sm text-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
