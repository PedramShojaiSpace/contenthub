import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BarChart3, Copy, Loader2, TrendingUp, TrendingDown, Minus,
  Star, ArrowRight, RefreshCw, FlaskConical,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
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

const PLATFORMS = ["all", "tiktok", "instagram", "youtube", "linkedin", "x"] as const;
type PlatformFilter = (typeof PLATFORMS)[number];

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

// ─── FrameworkChart ───────────────────────────────────────────────────────────
function FrameworkChart() {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const query = trpc.viralStudio.getTopFrameworks.useQuery({
    platform: platformFilter === "all" ? undefined : platformFilter,
  } as any);

  const data = (query.data ?? []).map((row: any) => ({
    name: row.framework
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim(),
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
            {PLATFORMS.map((p) => (
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
          Generate a monthly performance report with AI-written narrative: what worked, what to double down on, what to drop, and a concrete action plan for next week. The framework win-rate chart below is populated automatically as you declare winners in the A/B Test Lab.
        </p>
      </div>

      {/* Framework Win-Rate Chart — always visible */}
      <FrameworkChart />

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
