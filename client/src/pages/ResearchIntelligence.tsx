import { useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload,
  TrendingUp,
  LineChart as LineChartIcon,
  Users,
  Target,
  BarChart3,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Trophy,
  FileJson,
  FileText,
  ArrowRight,
  Brain,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchQuery {
  id: number;
  reportId: number;
  personaName: string | null;
  query: string;
  topicTags: string | null;
  gapScore: number | null;
  urbanMonkMentioned: number | null;
  status: "unused" | "in_progress" | "published" | null;
  contentItemId: number | null;
}

interface ResearchReport {
  id: number;
  reportName: string | null;
  reportFocus: string | null;
  weekLabel: string | null;
  totalQueries: number | null;
  totalPersonas: number | null;
  totalCompetitorMentions: number | null;
  createdAt: Date;
}

// ─── Gap Score Badge ──────────────────────────────────────────────────────────

function GapBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  if (s >= 8) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Gap {s}/10 🔥</Badge>;
  if (s >= 5) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Gap {s}/10</Badge>;
  return <Badge className="bg-zinc-700 text-zinc-400">Gap {s}/10</Badge>;
}

function StatusBadge({ status }: { status: ResearchQuery["status"] }) {
  if (status === "published") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Published</Badge>;
  if (status === "in_progress") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
  return <Badge className="bg-zinc-700 text-zinc-500"><AlertCircle className="w-3 h-3 mr-1" />Unused</Badge>;
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

function UploadPanel({ onSuccess }: { onSuccess: () => void }) {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [weekLabel, setWeekLabel] = useState(() => {
    const now = new Date();
    return `${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  });
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const ingest = trpc.research.ingest.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Report ingested: ${data.totalQueries} queries, ${data.gapQueries} gaps found, ${data.totalCompetitorMentions} competitor mentions.`
      );
      setJsonFile(null);
      setCsvFile(null);
      onSuccess();
    },
    onError: (err) => toast.error(`Ingestion failed: ${err.message}`),
  });

  const handleSubmit = async () => {
    if (!jsonFile || !csvFile) {
      toast.error("Please select both the JSON and CSV files from Gumshoe.");
      return;
    }
    if (!weekLabel.trim()) {
      toast.error("Please enter a week label.");
      return;
    }

    const jsonText = await jsonFile.text();
    const csvText = await csvFile.text();

    ingest.mutate({ jsonText, csvText, weekLabel: weekLabel.trim() });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-400" />
            Upload Gumshoe AI Report
          </CardTitle>
          <p className="text-zinc-400 text-sm">
            Upload the two export files from your weekly Gumshoe AI report run. The system will
            parse all personas, queries, competitor mentions, and topic tags, then score each
            query by LLM search gap opportunity.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Week Label */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Week Label</Label>
            <Input
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              placeholder="e.g. April 8 2026"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          {/* JSON Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              jsonFile ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-700 hover:border-zinc-500"
            }`}
            onClick={() => jsonRef.current?.click()}
          >
            <input
              ref={jsonRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)}
            />
            <FileJson className={`w-8 h-8 mx-auto mb-2 ${jsonFile ? "text-amber-400" : "text-zinc-500"}`} />
            {jsonFile ? (
              <p className="text-amber-400 font-medium">{jsonFile.name}</p>
            ) : (
              <>
                <p className="text-zinc-300 font-medium">Drop export.json here</p>
                <p className="text-zinc-500 text-sm mt-1">Full report with personas, queries, and LLM answers</p>
              </>
            )}
          </div>

          {/* CSV Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              csvFile ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-700 hover:border-zinc-500"
            }`}
            onClick={() => csvRef.current?.click()}
          >
            <input
              ref={csvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
            <FileText className={`w-8 h-8 mx-auto mb-2 ${csvFile ? "text-amber-400" : "text-zinc-500"}`} />
            {csvFile ? (
              <p className="text-amber-400 font-medium">{csvFile.name}</p>
            ) : (
              <>
                <p className="text-zinc-300 font-medium">Drop questions_export.csv here</p>
                <p className="text-zinc-500 text-sm mt-1">Structured query rows with topic tag columns</p>
              </>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!jsonFile || !csvFile || ingest.isPending}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            {ingest.isPending ? "Ingesting report..." : "Ingest Report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Gap Dashboard ────────────────────────────────────────────────────────────

function GapDashboard({ reportId }: { reportId: number }) {
  const [, navigate] = useLocation();
  const { data: queries = [] } = trpc.research.listQueries.useQuery({ reportId });
  const { data: leaderboard = [] } = trpc.research.getCompetitorLeaderboard.useQuery({
    reportId,
    limit: 10,
  });

  const gapQueries = (queries as ResearchQuery[])
    .filter((q) => !q.urbanMonkMentioned)
    .sort((a, b) => (b.gapScore ?? 0) - (a.gapScore ?? 0));
  const personas = Array.from(new Set((queries as ResearchQuery[]).map((q) => q.personaName).filter(Boolean))) as string[];

  const [pendingGapQuery, setPendingGapQuery] = useState<ResearchQuery | null>(null);

  const generateBrief = trpc.research.generateBriefFromGap.useMutation({
    onSuccess: (data) => {
      // Navigate to Creation Studio with the brief pre-loaded
      // Store in sessionStorage for pickup, including gap query ID for auto-tagging
      sessionStorage.setItem("gumshoe_brief", data.brief);
      if (pendingGapQuery) {
        sessionStorage.setItem("gumshoe_gap_query_id", String(pendingGapQuery.id));
        sessionStorage.setItem("gumshoe_gap_query_text", pendingGapQuery.query);
        setPendingGapQuery(null);
      }
      navigate("/studio");
      toast.success("Brief generated — opening Creation Studio");
    },
    onError: (err) => {
      setPendingGapQuery(null);
      toast.error(`Brief generation failed: ${err.message}`);
    },
  });

  const handleCreateContent = (q: ResearchQuery) => {
    const tags = q.topicTags ? JSON.parse(q.topicTags) : [];
    const competitors = (leaderboard as Array<{ brand: string; mentionCount: number }>)
      .slice(0, 5)
      .map((c) => c.brand);

    setPendingGapQuery(q);
    generateBrief.mutate({
      query: q.query,
      personaName: q.personaName ?? "Unknown Persona",
      topicTags: tags,
      competitorBrands: competitors,
      platform: "all",
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{queries.length}</div>
            <div className="text-zinc-400 text-sm">Total Queries</div>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-900/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{gapQueries.length}</div>
            <div className="text-zinc-400 text-sm">Gap Opportunities</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">{personas.length}</div>
            <div className="text-zinc-400 text-sm">Personas</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">
              {(leaderboard as Array<{ brand: string }>).length}
            </div>
            <div className="text-zinc-400 text-sm">Competitor Brands</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gap Queries */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" />
            LLM Search Gaps — Urban Monk Not Appearing
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {gapQueries.length === 0 ? (
              <div className="text-zinc-500 text-sm py-8 text-center">No gap queries found.</div>
            ) : (
              gapQueries.map((q) => (
                <Card key={q.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-200 text-sm leading-relaxed">{q.query}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
                            {q.personaName}
                          </Badge>
                          <GapBadge score={q.gapScore} />
                          <StatusBadge status={q.status} />
                          {q.topicTags && (() => {
                            try {
                              const tags = JSON.parse(q.topicTags) as string[];
                              return tags.slice(0, 2).map((t) => (
                                <Badge key={t} className="bg-zinc-800 text-zinc-400 text-xs border-zinc-700">{t}</Badge>
                              ));
                            } catch { return null; }
                          })()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCreateContent(q)}
                        disabled={generateBrief.isPending}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0"
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Brief
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Competitor Leaderboard */}
        <div className="space-y-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Competitor Leaderboard
          </h3>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 space-y-2">
              {(leaderboard as Array<{ brand: string; mentionCount: number; avgRank: number }>).length === 0 ? (
                <div className="text-zinc-500 text-sm text-center py-4">No data yet.</div>
              ) : (
                (leaderboard as Array<{ brand: string; mentionCount: number; avgRank: number }>).map((item, i) => (
                  <div key={item.brand} className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 ${i < 3 ? "text-amber-400" : "text-zinc-500"}`}>
                        #{i + 1}
                      </span>
                      <span className="text-zinc-300 text-sm truncate max-w-[140px]">{item.brand}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-zinc-400 text-xs">{Number(item.mentionCount)} mentions</span>
                      <span className="text-zinc-600 text-xs">avg #{Math.round(Number(item.avgRank))}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Persona Browser ──────────────────────────────────────────────────────────

function PersonaBrowser({ reportId }: { reportId: number }) {
  const { data: queries = [] } = trpc.research.listQueries.useQuery({ reportId });
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

    const personas = Array.from(new Set((queries as ResearchQuery[]).map((q) => q.personaName).filter(Boolean))) as string[];

  const personaQueries = selectedPersona
    ? (queries as ResearchQuery[]).filter((q) => q.personaName === selectedPersona)
    : [];

  // Topic tag frequency for selected persona
  const tagFrequency: Record<string, number> = {};
  for (const q of personaQueries) {
    if (q.topicTags) {
      try {
        const tags = JSON.parse(q.topicTags) as string[];
        for (const t of tags) tagFrequency[t] = (tagFrequency[t] ?? 0) + 1;
      } catch { /* ignore */ }
    }
  }
  const sortedTags = Object.entries(tagFrequency).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Persona List */}
      <div className="space-y-2">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-amber-400" />
          Personas
        </h3>
        {personas.map((p) => {
          const count = (queries as ResearchQuery[]).filter((q) => q.personaName === p).length;
          const gaps = (queries as ResearchQuery[]).filter((q) => q.personaName === p && !q.urbanMonkMentioned).length;
          return (
            <button
              key={p}
              onClick={() => setSelectedPersona(p === selectedPersona ? null : p)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedPersona === p
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium text-sm">{p}</div>
              <div className="text-xs mt-1 text-zinc-500">
                {count} queries · <span className="text-red-400">{gaps} gaps</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Persona Detail */}
      <div className="md:col-span-3 space-y-4">
        {!selectedPersona ? (
          <div className="flex items-center justify-center h-48 text-zinc-500">
            Select a persona to view their queries and topic priorities.
          </div>
        ) : (
          <>
            {/* Topic Tag Heatmap */}
            {sortedTags.length > 0 && (
              <div>
                <h4 className="text-zinc-300 text-sm font-medium mb-2">Topic Priorities for {selectedPersona}</h4>
                <div className="flex flex-wrap gap-2">
                  {sortedTags.map(([tag, count]) => (
                    <Badge
                      key={tag}
                      className={`text-xs ${
                        count >= 5
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : count >= 3
                          ? "bg-zinc-700 text-zinc-300"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {tag} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Query List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {personaQueries.map((q) => (
                <div
                  key={q.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <p className="text-zinc-200 text-sm">{q.query}</p>
                    <div className="flex gap-2 mt-1.5">
                      <GapBadge score={q.gapScore} />
                      <StatusBadge status={q.status} />
                    </div>
                  </div>
                  {!q.urbanMonkMentioned && (
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 mt-1" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Coverage Trend Chart ────────────────────────────────────────────────────

interface CoverageSnapshot {
  id: number;
  reportId: number;
  weekLabel: string;
  totalQueries: number;
  mentionedCount: number;
  gapCount: number;
  addressedCount: number;
  snapshotAt: Date;
}

function CoverageTrendChart() {
  const { data: snapshots = [], isLoading } = trpc.research.getCoverageTrend.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500">
        Loading coverage data...
      </div>
    );
  }

  if ((snapshots as CoverageSnapshot[]).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
        <LineChartIcon className="w-10 h-10 text-zinc-700" />
        <p className="text-sm">No trend data yet. Upload your first Gumshoe report to start tracking.</p>
      </div>
    );
  }

  const chartData = (snapshots as CoverageSnapshot[]).map((s) => ({
    week: s.weekLabel,
    "Gap Queries": s.gapCount,
    "Mentioned": s.mentionedCount,
    "Addressed": s.addressedCount,
    total: s.totalQueries,
  }));

  // Calculate week-over-week delta for the latest two snapshots
  const sorted = [...(snapshots as CoverageSnapshot[])].sort(
    (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const gapDelta = previous ? (latest?.gapCount ?? 0) - (previous?.gapCount ?? 0) : null;
  const addressedDelta = previous ? (latest?.addressedCount ?? 0) - (previous?.addressedCount ?? 0) : null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{latest?.totalQueries ?? 0}</div>
            <div className="text-zinc-400 text-sm">Total Queries</div>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-end gap-2">
              <div className="text-2xl font-bold text-red-400">{latest?.gapCount ?? 0}</div>
              {gapDelta !== null && (
                <div className={`text-sm mb-0.5 ${gapDelta < 0 ? "text-green-400" : gapDelta > 0 ? "text-red-400" : "text-zinc-500"}`}>
                  {gapDelta > 0 ? `+${gapDelta}` : gapDelta} vs last week
                </div>
              )}
            </div>
            <div className="text-zinc-400 text-sm">Open Gaps</div>
          </CardContent>
        </Card>
        <Card className="bg-green-950/30 border-green-900/30">
          <CardContent className="p-4">
            <div className="flex items-end gap-2">
              <div className="text-2xl font-bold text-green-400">{latest?.addressedCount ?? 0}</div>
              {addressedDelta !== null && addressedDelta > 0 && (
                <div className="text-sm mb-0.5 text-green-400">+{addressedDelta} this week</div>
              )}
            </div>
            <div className="text-zinc-400 text-sm">Gaps Addressed</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-950/30 border-amber-900/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">
              {latest && latest.totalQueries > 0
                ? `${Math.round(((latest.mentionedCount) / latest.totalQueries) * 100)}%`
                : "0%"}
            </div>
            <div className="text-zinc-400 text-sm">Mention Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Line chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            LLM Coverage Trend — Week over Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mentionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="addressedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 12 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
                labelStyle={{ color: "#e4e4e7" }}
                itemStyle={{ color: "#a1a1aa" }}
              />
              <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
              <Area type="monotone" dataKey="Gap Queries" stroke="#ef4444" fill="url(#gapGrad)" strokeWidth={2} dot={{ fill: "#ef4444" }} />
              <Area type="monotone" dataKey="Mentioned" stroke="#f59e0b" fill="url(#mentionGrad)" strokeWidth={2} dot={{ fill: "#f59e0b" }} />
              <Area type="monotone" dataKey="Addressed" stroke="#22c55e" fill="url(#addressedGrad)" strokeWidth={2} dot={{ fill: "#22c55e" }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /> Gap Queries — queries where Urban Monk is not mentioned</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Mentioned — queries where Urban Monk appears in LLM answers</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" /> Addressed — gap queries with published content</div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot history table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-sm">Snapshot History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...(snapshots as CoverageSnapshot[])].reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="text-zinc-300 text-sm font-medium">{s.weekLabel}</div>
                <div className="flex gap-4 text-xs">
                  <span className="text-zinc-400">{s.totalQueries} queries</span>
                  <span className="text-red-400">{s.gapCount} gaps</span>
                  <span className="text-amber-400">{s.mentionedCount} mentioned</span>
                  <span className="text-green-400">{s.addressedCount} addressed</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Report Selector ──────────────────────────────────────────────────────────

function ReportSelector({
  reports,
  selectedId,
  onSelect,
}: {
  reports: ResearchReport[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (reports.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-zinc-400 text-sm">Report:</span>
      {reports.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            selectedId === r.id
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
          }`}
        >
          {r.weekLabel ?? r.reportName ?? `Report #${r.id}`}
          <span className="ml-2 text-xs text-zinc-600">
            {r.totalQueries ?? 0}q
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchIntelligence() {
  const utils = trpc.useUtils();
  const { data: reports = [], isLoading } = trpc.research.listReports.useQuery();
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("gaps");

  // Auto-select the most recent report
  const effectiveReportId =
    selectedReportId ?? ((reports as ResearchReport[])[0]?.id ?? null);

  const handleIngestSuccess = () => {
    utils.research.listReports.invalidate();
  };

  const hasReports = (reports as ResearchReport[]).length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-amber-400" />
            Research Intelligence
          </h1>
          <p className="text-zinc-400 mt-1">
            Gumshoe AI competitive analysis — LLM search gaps and content opportunities
          </p>
        </div>
      </div>

      {/* Upload + Report Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {hasReports && (
          <ReportSelector
            reports={reports as ResearchReport[]}
            selectedId={effectiveReportId}
            onSelect={setSelectedReportId}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500">Loading reports...</div>
      ) : !hasReports ? (
        /* No reports yet — show upload as primary CTA */
        <div className="space-y-8">
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-white text-lg font-semibold mb-2">No reports ingested yet</h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              Upload your weekly Gumshoe AI export files to start tracking LLM search gaps and
              competitor brand positioning.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-zinc-500 text-sm">
              <ArrowRight className="w-4 h-4" />
              Export <code className="bg-zinc-800 px-1 rounded">export.json</code> and{" "}
              <code className="bg-zinc-800 px-1 rounded">questions_export.csv</code> from Gumshoe AI
            </div>
          </div>
          <UploadPanel onSuccess={handleIngestSuccess} />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="gaps" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                <Target className="w-4 h-4 mr-1.5" />
                Gap Opportunities
              </TabsTrigger>
              <TabsTrigger value="personas" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                <Users className="w-4 h-4 mr-1.5" />
                Persona Browser
              </TabsTrigger>
              <TabsTrigger value="trend" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                <TrendingUp className="w-4 h-4 mr-1.5" />
                Coverage Trend
              </TabsTrigger>
              <TabsTrigger value="upload" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                <Upload className="w-4 h-4 mr-1.5" />
                Upload New Report
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="gaps" className="mt-6">
            {effectiveReportId ? (
              <GapDashboard reportId={effectiveReportId} />
            ) : (
              <div className="text-zinc-500 text-center py-12">Select a report to view gaps.</div>
            )}
          </TabsContent>

          <TabsContent value="personas" className="mt-6">
            {effectiveReportId ? (
              <PersonaBrowser reportId={effectiveReportId} />
            ) : (
              <div className="text-zinc-500 text-center py-12">Select a report to view personas.</div>
            )}
          </TabsContent>

          <TabsContent value="trend" className="mt-6">
            <CoverageTrendChart />
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <UploadPanel onSuccess={handleIngestSuccess} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
