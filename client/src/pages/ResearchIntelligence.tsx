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
  ArrowLeft,
  ArrowRight,
  Brain,
  Video,
  Swords,
  Play,
  CircleDot,
  ExternalLink,
  Lightbulb,
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
  return <Badge className="bg-secondary text-muted-foreground">Gap {s}/10</Badge>;
}

function StatusBadge({ status }: { status: ResearchQuery["status"] }) {
  if (status === "published") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Published</Badge>;
  if (status === "in_progress") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
  return <Badge className="bg-secondary text-muted-foreground"><AlertCircle className="w-3 h-3 mr-1" />Unused</Badge>;
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-400" />
            Upload Gumshoe AI Report
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Upload the two export files from your weekly Gumshoe AI report run. The system will
            parse all personas, queries, competitor mentions, and topic tags, then score each
            query by LLM search gap opportunity.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Week Label */}
          <div className="space-y-2">
            <Label className="text-foreground/80">Week Label</Label>
            <Input
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              placeholder="e.g. April 8 2026"
              className="bg-muted border-border text-foreground"
            />
          </div>

          {/* JSON Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              jsonFile ? "border-amber-500/50 bg-amber-500/5" : "border-border hover:border-zinc-500"
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
            <FileJson className={`w-8 h-8 mx-auto mb-2 ${jsonFile ? "text-amber-400" : "text-muted-foreground"}`} />
            {jsonFile ? (
              <p className="text-amber-400 font-medium">{jsonFile.name}</p>
            ) : (
              <>
                <p className="text-foreground/80 font-medium">Drop export.json here</p>
                <p className="text-muted-foreground text-sm mt-1">Full report with personas, queries, and LLM answers</p>
              </>
            )}
          </div>

          {/* CSV Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              csvFile ? "border-amber-500/50 bg-amber-500/5" : "border-border hover:border-zinc-500"
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
            <FileText className={`w-8 h-8 mx-auto mb-2 ${csvFile ? "text-amber-400" : "text-muted-foreground"}`} />
            {csvFile ? (
              <p className="text-amber-400 font-medium">{csvFile.name}</p>
            ) : (
              <>
                <p className="text-foreground/80 font-medium">Drop questions_export.csv here</p>
                <p className="text-muted-foreground text-sm mt-1">Structured query rows with topic tag columns</p>
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
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{queries.length}</div>
            <div className="text-muted-foreground text-sm">Total Queries</div>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-900/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{gapQueries.length}</div>
            <div className="text-muted-foreground text-sm">Gap Opportunities</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">{personas.length}</div>
            <div className="text-muted-foreground text-sm">Personas</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {(leaderboard as Array<{ brand: string }>).length}
            </div>
            <div className="text-muted-foreground text-sm">Competitor Brands</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gap Queries */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-foreground font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" />
            LLM Search Gaps — Urban Monk Not Appearing
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {gapQueries.length === 0 ? (
              <div className="text-muted-foreground text-sm py-8 text-center">No gap queries found.</div>
            ) : (
              gapQueries.map((q) => (
                <Card key={q.id} className="bg-card border-border hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm leading-relaxed">{q.query}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-muted-foreground border-border text-xs">
                            {q.personaName}
                          </Badge>
                          <GapBadge score={q.gapScore} />
                          <StatusBadge status={q.status} />
                          {q.topicTags && (() => {
                            try {
                              const tags = JSON.parse(q.topicTags) as string[];
                              return tags.slice(0, 2).map((t) => (
                                <Badge key={t} className="bg-muted text-muted-foreground text-xs border-border">{t}</Badge>
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
          <h3 className="text-foreground font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Competitor Leaderboard
          </h3>
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              {(leaderboard as Array<{ brand: string; mentionCount: number; avgRank: number }>).length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-4">No data yet.</div>
              ) : (
                (leaderboard as Array<{ brand: string; mentionCount: number; avgRank: number }>).map((item, i) => (
                  <div key={item.brand} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 ${i < 3 ? "text-amber-400" : "text-muted-foreground"}`}>
                        #{i + 1}
                      </span>
                      <span className="text-foreground/80 text-sm truncate max-w-[140px]">{item.brand}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-xs">{Number(item.mentionCount)} mentions</span>
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
        <h3 className="text-foreground font-semibold flex items-center gap-2 mb-3">
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
                  : "bg-card border-border text-foreground/80 hover:border-border"
              }`}
            >
              <div className="font-medium text-sm">{p}</div>
              <div className="text-xs mt-1 text-muted-foreground">
                {count} queries · <span className="text-red-400">{gaps} gaps</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Persona Detail */}
      <div className="md:col-span-3 space-y-4">
        {!selectedPersona ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Select a persona to view their queries and topic priorities.
          </div>
        ) : (
          <>
            {/* Topic Tag Heatmap */}
            {sortedTags.length > 0 && (
              <div>
                <h4 className="text-foreground/80 text-sm font-medium mb-2">Topic Priorities for {selectedPersona}</h4>
                <div className="flex flex-wrap gap-2">
                  {sortedTags.map(([tag, count]) => (
                    <Badge
                      key={tag}
                      className={`text-xs ${
                        count >= 5
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : count >= 3
                          ? "bg-secondary text-foreground/80"
                          : "bg-muted text-muted-foreground"
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
                  className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <p className="text-foreground text-sm">{q.query}</p>
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
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Loading coverage data...
      </div>
    );
  }

  if ((snapshots as CoverageSnapshot[]).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
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
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{latest?.totalQueries ?? 0}</div>
            <div className="text-muted-foreground text-sm">Total Queries</div>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-end gap-2">
              <div className="text-2xl font-bold text-red-400">{latest?.gapCount ?? 0}</div>
              {gapDelta !== null && (
                <div className={`text-sm mb-0.5 ${gapDelta < 0 ? "text-green-400" : gapDelta > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {gapDelta > 0 ? `+${gapDelta}` : gapDelta} vs last week
                </div>
              )}
            </div>
            <div className="text-muted-foreground text-sm">Open Gaps</div>
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
            <div className="text-muted-foreground text-sm">Gaps Addressed</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-950/30 border-amber-900/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">
              {latest && latest.totalQueries > 0
                ? `${Math.round(((latest.mentionedCount) / latest.totalQueries) * 100)}%`
                : "0%"}
            </div>
            <div className="text-muted-foreground text-sm">Mention Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Line chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
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
          <div className="flex gap-6 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /> Gap Queries — queries where Urban Monk is not mentioned</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Mentioned — queries where Urban Monk appears in LLM answers</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" /> Addressed — gap queries with published content</div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot history table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Snapshot History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...(snapshots as CoverageSnapshot[])].reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="text-foreground/80 text-sm font-medium">{s.weekLabel}</div>
                <div className="flex gap-4 text-xs">
                  <span className="text-muted-foreground">{s.totalQueries} queries</span>
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

// ─── Competitor Intelligence ─────────────────────────────────────────────────

const COMPETITOR_PROFILES = [
  {
    brand: "Headspace",
    tier: 1,
    mentionCount: 304,
    whyAIRecommends: "Clinically validated mindfulness programs, peer-reviewed research citations, structured 30-day courses, mainstream press coverage",
    weakness: "No Eastern lineage, no functional medicine integration, app-only format, no practitioner training",
    displacementAngle: "Position Urban Monk as the East-West integrative alternative: same evidence base, deeper lineage, clinical credentials",
    queryOwnership: ["meditation apps", "stress relief", "sleep improvement", "mindfulness courses"],
    color: "blue",
  },
  {
    brand: "Calm",
    tier: 1,
    mentionCount: 255,
    whyAIRecommends: "10-minute daily practice format, sleep stories, celebrity partnerships, massive press coverage",
    weakness: "Entertainment-first, not education-first. No clinical depth, no Eastern wisdom, no practitioner pathway",
    displacementAngle: "Own the 'beyond the app' narrative: when Calm stops working, Urban Monk is the next step",
    queryOwnership: ["sleep improvement", "daily meditation", "stress management", "relaxation"],
    color: "indigo",
  },
  {
    brand: "Insight Timer",
    tier: 1,
    mentionCount: 205,
    whyAIRecommends: "Free access model, 54 query coverage, community size, instructor diversity",
    weakness: "No coherent curriculum, no clinical credentialing, no outcomes tracking, no Eastern lineage",
    displacementAngle: "Compete on depth: Insight Timer is a marketplace; Urban Monk is a school with a master teacher",
    queryOwnership: ["free meditation", "guided meditation", "meditation community", "mindfulness teachers"],
    color: "purple",
  },
  {
    brand: "Sounds True",
    tier: 2,
    mentionCount: 169,
    whyAIRecommends: "Deep course library, credentialed instructors, spiritual + psychological integration, long track record",
    weakness: "No functional medicine, no clinical testing integration, no East-West synthesis at clinical level",
    displacementAngle: "Urban Monk has the spiritual depth of Sounds True PLUS clinical credentials and functional medicine protocols",
    queryOwnership: ["spiritual growth", "holistic psychology", "transformation courses", "Eastern wisdom"],
    color: "amber",
  },
  {
    brand: "Mindvalley",
    tier: 2,
    mentionCount: 145,
    whyAIRecommends: "Transformation platform, instructor diversity, community features, high production value",
    weakness: "Lacks clinical credentialing, no Eastern lineage authenticity, no functional medicine, entertainment-heavy",
    displacementAngle: "Urban Monk is the credentialed alternative: same transformation promise, real clinical outcomes, authentic lineage",
    queryOwnership: ["personal transformation", "online wellness education", "holistic health courses", "life optimization"],
    color: "orange",
  },
];

function CompetitorIntelligence({ reportId }: { reportId: number }) {
  const { data: leaderboard = [] } = trpc.research.getCompetitorLeaderboard.useQuery({ reportId, limit: 20 });
  const [selected, setSelected] = useState<string | null>(null);

  const selectedProfile = COMPETITOR_PROFILES.find((p) => p.brand === selected);
  const lbMap = new Map(
    (leaderboard as Array<{ brand: string; mentionCount: number; avgRank: number }>).map((l) => [l.brand, l])
  );

  return (
    <div className="space-y-6">
      {/* Tier Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-950/20 border-red-900/30">
          <CardContent className="p-4">
            <div className="text-sm font-semibold text-red-400 mb-1">Tier 1 — App-First Mindfulness</div>
            <div className="text-muted-foreground text-xs">Headspace · Calm · Insight Timer</div>
            <div className="text-xs text-muted-foreground mt-2">Win condition: AI cites them for accessibility + clinical validation. Displace with depth + lineage.</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-950/20 border-amber-900/30">
          <CardContent className="p-4">
            <div className="text-sm font-semibold text-amber-400 mb-1">Tier 2 — Transformation Platforms</div>
            <div className="text-muted-foreground text-xs">Mindvalley · Sounds True · The Shift Network</div>
            <div className="text-xs text-muted-foreground mt-2">Win condition: AI cites them for course depth + community. Displace with clinical credentials + authentic lineage.</div>
          </CardContent>
        </Card>
        <Card className="bg-green-950/20 border-green-900/30">
          <CardContent className="p-4">
            <div className="text-sm font-semibold text-green-400 mb-1">Urban Monk Target Position</div>
            <div className="text-muted-foreground text-xs">East-West Integrative · Clinical Credentials · Authentic Lineage</div>
            <div className="text-xs text-muted-foreground mt-2">The unoccupied intersection: Eastern lineage + OMD credentials + functional medicine + daily practice.</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Competitor List */}
        <div className="space-y-2">
          <h3 className="text-foreground font-semibold flex items-center gap-2 mb-3">
            <Swords className="w-4 h-4 text-red-400" />
            Competitor Profiles
          </h3>
          {COMPETITOR_PROFILES.map((p) => {
            const lb = lbMap.get(p.brand);
            return (
              <button
                key={p.brand}
                onClick={() => setSelected(p.brand === selected ? null : p.brand)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected === p.brand
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-card border-border text-foreground/80 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.brand}</span>
                  <Badge className="bg-secondary text-muted-foreground text-xs">
                    {lb ? Number(lb.mentionCount) : p.mentionCount} mentions
                  </Badge>
                </div>
                <div className="text-xs mt-1 text-muted-foreground">Tier {p.tier}</div>
              </button>
            );
          })}
        </div>

        {/* Competitor Detail */}
        <div className="lg:col-span-2">
          {!selectedProfile ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Select a competitor to view their AI citation profile and displacement strategy.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-bold text-lg">{selectedProfile.brand}</h3>
                <Badge className="bg-secondary text-muted-foreground">Tier {selectedProfile.tier}</Badge>
              </div>

              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Why AI Recommends Them</div>
                    <p className="text-foreground/80 text-sm">{selectedProfile.whyAIRecommends}</p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Their Weakness</div>
                    <p className="text-red-400/80 text-sm">{selectedProfile.weakness}</p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="text-xs text-amber-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" /> Displacement Strategy
                    </div>
                    <p className="text-foreground text-sm font-medium">{selectedProfile.displacementAngle}</p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Queries They Own</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProfile.queryOwnership.map((q) => (
                        <Badge key={q} className="bg-muted text-muted-foreground text-xs border-border">{q}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Video Pipeline ───────────────────────────────────────────────────────────

const VIDEO_PIPELINE = [
  { priority: 1, title: "East Meets West: The Burnout Recovery Framework", persona: "Burnout Recovery Seeker", cluster: "Evidence-Based + Holistic", competitorWeakness: "Calm/Headspace have no Eastern lineage", status: "not_started" as const },
  { priority: 2, title: "The 2 AM Wake-Up: What Your Liver Is Trying to Tell You", persona: "All Personas", cluster: "Stress Relief + Practical", competitorWeakness: "No competitor owns this specific hook", status: "not_started" as const },
  { priority: 3, title: "Functional Medicine for Executives: A 90-Day Protocol", persona: "Midlife Vitality Optimizer", cluster: "Program Depth + Outcomes", competitorWeakness: "IFM is practitioner-only", status: "not_started" as const },
  { priority: 4, title: "Qigong in 5 Minutes: The Daily Practice That Changes Everything", persona: "Stressed Parent + Corporate", cluster: "Practical Daily Use + Time", competitorWeakness: "No major competitor owns qigong", status: "not_started" as const },
  { priority: 5, title: "The Gut-Brain-Sleep Triangle: Why You Can't Fix One Without the Others", persona: "Chronic Condition Navigator", cluster: "Holistic Approach + Evidence", competitorWeakness: "Competitors treat these as separate topics", status: "not_started" as const },
  { priority: 6, title: "My Journey: Pre-Med to Monk to Doctor", persona: "Spiritual Growth Explorer", cluster: "Instructor Credibility", competitorWeakness: "Unique narrative no competitor can replicate", status: "not_started" as const },
  { priority: 7, title: "The Science of Meditation: What Actually Works (And What Doesn't)", persona: "Holistic Health Student", cluster: "Evidence-Based Methods", competitorWeakness: "Headspace/Calm lack clinical depth", status: "not_started" as const },
  { priority: 8, title: "Digital Detox That Works: The Nervous System Approach", persona: "Digital Detox Pursuer", cluster: "Practical + Holistic", competitorWeakness: "Digital Wellness Institute lacks depth", status: "not_started" as const },
  { priority: 9, title: "Leaky Gut: The Root Cause Nobody Is Talking About", persona: "Chronic Condition Navigator", cluster: "Evidence-Based + Holistic", competitorWeakness: "Competitors avoid clinical specificity", status: "not_started" as const },
  { priority: 10, title: "The Urban Monk Morning Routine: 20 Minutes to Transform Your Day", persona: "All Personas", cluster: "Practical Daily Use", competitorWeakness: "Directly competes with Headspace Daily", status: "not_started" as const },
  { priority: 11, title: "Taoist Philosophy for Modern Life: Ancient Wisdom, Practical Application", persona: "Spiritual Growth Explorer", cluster: "Program Depth + Instructor", competitorWeakness: "Sounds True/Shift Network lack clinical integration", status: "not_started" as const },
  { priority: 12, title: "Oral Microbiome: The Missing Link in Your Gut Health Protocol", persona: "Holistic Health Student", cluster: "Evidence-Based + Holistic", competitorWeakness: "No major competitor owns this topic", status: "not_started" as const },
  { priority: 13, title: "Stress Is a Physical Substance: The Cortisol Accumulation Model", persona: "Burnout Recovery Seeker", cluster: "Evidence-Based + Stress Relief", competitorWeakness: "Unique framing from the three-discovery framework", status: "not_started" as const },
  { priority: 14, title: "The Parent's Wellness Protocol: 5-Minute Practices for Impossible Schedules", persona: "Stressed Parent Multitasker", cluster: "Flexible + Practical + Time", competitorWeakness: "Calm targets parents but lacks depth", status: "not_started" as const },
  { priority: 15, title: "Corporate Wellness That Actually Works: Beyond the Meditation App", persona: "Corporate Wellness Advocate", cluster: "Evidence-Based + Outcomes", competitorWeakness: "Calm Business lacks Eastern integration", status: "not_started" as const },
  { priority: 16, title: "LPS: The Hidden Toxin Driving Your Fatigue, Brain Fog, and Inflammation", persona: "Midlife Vitality + Chronic", cluster: "Evidence-Based + Holistic", competitorWeakness: "Unique discovery, no competitor owns this", status: "not_started" as const },
  { priority: 17, title: "The Urban Monk Academy: What You Get for $297/Year", persona: "All Personas", cluster: "Program Depth + Value", competitorWeakness: "Direct conversion video", status: "not_started" as const },
  { priority: 18, title: "Vagus Nerve Stimulation: The Fastest Path to Nervous System Reset", persona: "All Personas", cluster: "Evidence-Based + Practical", competitorWeakness: "Emerging topic, early-mover advantage", status: "not_started" as const },
  { priority: 19, title: "Sleep Optimization: The Functional Medicine Approach", persona: "All Personas", cluster: "Stress Relief + Practical", competitorWeakness: "Competitors treat sleep as separate from gut/detox", status: "not_started" as const },
  { priority: 20, title: "The 6-Week Gut Health Protocol: A Doctor's Step-by-Step Guide", persona: "Chronic Condition + Holistic", cluster: "Program Depth + Outcomes", competitorWeakness: "Directly positions the consumer course", status: "not_started" as const },
];

type VideoStatus = "not_started" | "scripted" | "recorded" | "edited" | "published";

const STATUS_LABELS: Record<VideoStatus, string> = {
  not_started: "Not Started",
  scripted: "Scripted",
  recorded: "Recorded",
  edited: "Edited",
  published: "Published",
};

function VideoStatusBadge({ status }: { status: VideoStatus }) {
  if (status === "published") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Published</Badge>;
  if (status === "edited") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"><CircleDot className="w-3 h-3 mr-1" />Edited</Badge>;
  if (status === "recorded") return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs"><Play className="w-3 h-3 mr-1" />Recorded</Badge>;
  if (status === "scripted") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs"><FileText className="w-3 h-3 mr-1" />Scripted</Badge>;
  return <Badge className="bg-secondary text-muted-foreground text-xs"><Clock className="w-3 h-3 mr-1" />Not Started</Badge>;
}

function VideoPipeline() {
  const [statuses, setStatuses] = useState<Record<number, VideoStatus>>(() => {
    try {
      const saved = localStorage.getItem("video_pipeline_statuses");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const updateStatus = (priority: number, status: VideoStatus) => {
    const next = { ...statuses, [priority]: status };
    setStatuses(next);
    try { localStorage.setItem("video_pipeline_statuses", JSON.stringify(next)); } catch { /* ignore */ }
  };

  const published = VIDEO_PIPELINE.filter((v) => (statuses[v.priority] ?? "not_started") === "published").length;
  const inProgress = VIDEO_PIPELINE.filter((v) => {
    const s = statuses[v.priority] ?? "not_started";
    return s !== "not_started" && s !== "published";
  }).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{VIDEO_PIPELINE.length}</div>
            <div className="text-muted-foreground text-sm">Priority Videos</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-950/20 border-amber-900/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">{inProgress}</div>
            <div className="text-muted-foreground text-sm">In Production</div>
          </CardContent>
        </Card>
        <Card className="bg-green-950/20 border-green-900/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{published}</div>
            <div className="text-muted-foreground text-sm">Published</div>
          </CardContent>
        </Card>
      </div>

      {/* Production Notes */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="text-xs text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> Production Workflow (Huberman Model)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs text-muted-foreground">
            <div className="bg-muted/50 rounded p-2"><span className="text-foreground font-medium block mb-1">1. Script</span>Teleprompter DOCX. Dr. Shojai records intro + key segments (30-45 min).</div>
            <div className="bg-muted/50 rounded p-2"><span className="text-foreground font-medium block mb-1">2. Record</span>Direct to camera. Descript voice model for supporting content.</div>
            <div className="bg-muted/50 rounded p-2"><span className="text-foreground font-medium block mb-1">3. Edit</span>Editor assembles: camera + voice-over + ManoBanano image overlays.</div>
            <div className="bg-muted/50 rounded p-2"><span className="text-foreground font-medium block mb-1">4. Clip</span>3-5 Reels clipped from direct-to-camera segments for Instagram/TikTok.</div>
            <div className="bg-muted/50 rounded p-2"><span className="text-foreground font-medium block mb-1">5. Derive</span>Carousel + blog post from transcript. Email digest. Buffer schedule.</div>
          </div>
        </CardContent>
      </Card>

      {/* Video List */}
      <div className="space-y-2">
        {VIDEO_PIPELINE.map((v) => {
          const status = statuses[v.priority] ?? "not_started";
          return (
            <Card key={v.priority} className={`border-border transition-colors ${
              status === "published" ? "bg-green-950/10" : "bg-card"
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 font-bold text-sm">
                    {v.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium text-sm">{v.title}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-muted-foreground border-border text-xs">{v.persona}</Badge>
                      <Badge className="bg-muted text-muted-foreground text-xs border-border">{v.cluster}</Badge>
                      <VideoStatusBadge status={status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">💡 {v.competitorWeakness}</p>
                  </div>
                  <select
                    value={status}
                    onChange={(e) => updateStatus(v.priority, e.target.value as VideoStatus)}
                    className="bg-muted border border-border rounded text-xs text-foreground px-2 py-1.5 shrink-0 cursor-pointer"
                  >
                    {(Object.keys(STATUS_LABELS) as VideoStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
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
      <span className="text-muted-foreground text-sm">Report:</span>
      {reports.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            selectedId === r.id
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : "bg-card border-border text-muted-foreground hover:border-border"
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

  const [, navigate] = useLocation();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6 text-amber-400" />
              Research Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">
              Gumshoe AI competitive analysis — LLM search gaps and content opportunities
            </p>
          </div>
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
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading reports...</div>
      ) : !hasReports ? (
        /* No reports yet — show upload as primary CTA */
        <div className="space-y-8">
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-foreground text-lg font-semibold mb-2">No reports ingested yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload your weekly Gumshoe AI export files to start tracking LLM search gaps and
              competitor brand positioning.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground text-sm">
              <ArrowRight className="w-4 h-4" />
              Export <code className="bg-muted px-1 rounded">export.json</code> and{" "}
              <code className="bg-muted px-1 rounded">questions_export.csv</code> from Gumshoe AI
            </div>
          </div>
          <UploadPanel onSuccess={handleIngestSuccess} />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList className="bg-card border border-border">
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
              <TabsTrigger value="competitors" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                <Swords className="w-4 h-4 mr-1.5" />
                Competitors
              </TabsTrigger>
              <TabsTrigger value="videos" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                <Video className="w-4 h-4 mr-1.5" />
                Video Pipeline
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
              <div className="text-muted-foreground text-center py-12">Select a report to view gaps.</div>
            )}
          </TabsContent>

          <TabsContent value="personas" className="mt-6">
            {effectiveReportId ? (
              <PersonaBrowser reportId={effectiveReportId} />
            ) : (
              <div className="text-muted-foreground text-center py-12">Select a report to view personas.</div>
            )}
          </TabsContent>

          <TabsContent value="trend" className="mt-6">
            <CoverageTrendChart />
          </TabsContent>

          <TabsContent value="competitors" className="mt-6">
            {effectiveReportId ? (
              <CompetitorIntelligence reportId={effectiveReportId} />
            ) : (
              <div className="text-muted-foreground text-center py-12">Select a report to view competitor intelligence.</div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            <VideoPipeline />
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <UploadPanel onSuccess={handleIngestSuccess} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
