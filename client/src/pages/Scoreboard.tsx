/**
 * Content Scoreboard
 * ──────────────────
 * Single-view performance dashboard for all published blog posts.
 * Shows Yoast SEO score, GSC traffic, position trend (↑↓), social push
 * channels, health signal, and a "Publish Next" recommendation panel
 * with cluster view toggle and competitor gap column.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  TrendingUp,
  Minus,
  Search,
  MousePointerClick,
  Eye,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  BarChart3,
  Globe,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  PenLine,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Swords,
  Layers,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PostRow = {
  id: number;
  title: string;
  publishUrl: string | null;
  wpPostId: number | null;
  publishedAt: number | null;
  focusKeyword: string | null;
  yoastScore: string | null;
  yoastScoreFetchedAt: number | null;
  pushedChannels: { id: string; name: string; service: string }[];
  gscClicks: number | null;
  gscImpressions: number | null;
  gscCtr: number | null;
  gscPosition: number | null;
  trendDirection: "up" | "down" | "flat" | null;
  trendDelta: number | null;
  health: "green" | "amber" | "red";
};

type Recommendation = {
  rank: number;
  keyword: string;
  suggestedTitle: string;
  rationale: string;
  estimatedDifficulty: "low" | "medium" | "high";
  topicCluster?: string;
  gscPosition: number | null;
  gscImpressions: number | null;
  gscClicks: number | null;
  competitorDomain: string | null;
  competitorTitle: string | null;
  source: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const d = Math.floor(sec / 86400);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function YoastBadge({ score }: { score: string | null }) {
  if (!score) return <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">No score</Badge>;
  if (score === "good") return <Badge className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 hover:bg-green-500/20">● Good</Badge>;
  if (score === "ok") return <Badge className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">● OK</Badge>;
  return <Badge className="text-xs bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/20">● Needs work</Badge>;
}

function HealthDot({ health }: { health: "green" | "amber" | "red" }) {
  if (health === "green") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (health === "amber") return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
}

function TrendBadge({ direction, delta }: { direction: "up" | "down" | "flat" | null; delta: number | null }) {
  if (!direction) {
    return <span className="text-xs text-muted-foreground italic">—</span>;
  }
  if (direction === "flat") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        flat
      </span>
    );
  }
  if (direction === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-500">
        <ArrowUpRight className="w-3.5 h-3.5" />
        {delta != null ? `+${delta}` : "↑"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400">
      <ArrowDownRight className="w-3.5 h-3.5" />
      {delta != null ? `-${delta}` : "↓"}
    </span>
  );
}

const SERVICE_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
  facebook: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  linkedin: "bg-sky-600/15 text-sky-700 dark:text-sky-400 border-sky-600/30",
  twitter: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  youtube: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  tiktok: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

const SERVICE_LABELS: Record<string, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  twitter: "X",
  youtube: "YT",
  tiktok: "TT",
};

function ChannelBadges({ channels }: { channels: { id: string; name: string; service: string }[] }) {
  if (channels.length === 0) return <span className="text-xs text-muted-foreground italic">Not pushed</span>;
  const seen = new Set<string>();
  return (
    <div className="flex flex-wrap gap-1">
      {channels.filter((c) => {
        const key = c.service.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map((c) => {
        const svc = c.service.toLowerCase();
        const colorClass = SERVICE_COLORS[svc] ?? "bg-muted text-muted-foreground border-muted-foreground/30";
        const label = SERVICE_LABELS[svc] ?? svc.slice(0, 2).toUpperCase();
        return (
          <span key={svc} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${colorClass}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Difficulty badge ──────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: "low" | "medium" | "high" }) {
  if (level === "low") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 font-semibold">Easy win</span>;
  if (level === "medium") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">Medium</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-semibold">Competitive</span>;
}

// ── Topic cluster pill ────────────────────────────────────────────────────────

const CLUSTER_COLORS: Record<string, string> = {
  "Sleep": "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  "Gut Health": "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30",
  "Stress & Anxiety": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  "Energy": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  "Detox": "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
  "Longevity": "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  "Mindfulness": "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  "Nutrition": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  "Breathwork": "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  "Other": "bg-muted text-muted-foreground border-muted-foreground/30",
};

function ClusterPill({ cluster }: { cluster: string }) {
  const colorClass = CLUSTER_COLORS[cluster] ?? CLUSTER_COLORS["Other"];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colorClass}`}>
      {cluster}
    </span>
  );
}

// ── Competitor gap cell ───────────────────────────────────────────────────────

function CompetitorCell({ domain, title }: { domain: string | null; title: string | null }) {
  if (!domain) {
    return <span className="text-[10px] text-muted-foreground/50 italic">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-red-500/80 flex items-center gap-1">
        <Swords className="w-3 h-3" />
        {domain.replace(/^www\./, "")}
      </span>
      {title && (
        <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2 max-w-[160px]">
          {title}
        </span>
      )}
    </div>
  );
}

// ── Pillar Coverage Bar ──────────────────────────────────────────────────────

function PillarCoverageBar() {
  const coverageQuery = trpc.scoreboard.getPillarCoverage.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const pillars: { pillar: string; count: number }[] = (coverageQuery.data ?? []) as { pillar: string; count: number }[];

  if (coverageQuery.isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2 flex-1">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-7 w-20" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pillars.length === 0) return null;

  const maxCount = Math.max(...pillars.map((p) => p.count), 1);

  return (
    <Card className="bg-card border-border">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pillar Coverage</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            {pillars.map(({ pillar, count }) => {
              const colorClass = CLUSTER_COLORS[pillar] ?? CLUSTER_COLORS["Other"];
              const isUnderserved = count < 2;
              return (
                <div
                  key={pillar}
                  className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                    isUnderserved
                      ? "border-red-400/40 bg-red-500/8 ring-1 ring-red-400/30"
                      : `border-border/60 ${colorClass.split(" ")[0]}`
                  }`}
                  title={isUnderserved ? `${pillar}: only ${count} post${count === 1 ? "" : "s"} — needs more content` : `${pillar}: ${count} posts`}
                >
                  <span className={`text-[10px] font-semibold ${
                    isUnderserved ? "text-red-500 dark:text-red-400" : colorClass.split(" ").slice(1).join(" ")
                  }`}>
                    {pillar}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-base font-bold leading-none ${
                      isUnderserved ? "text-red-500 dark:text-red-400" : "text-foreground"
                    }`}>
                      {count}
                    </span>
                    {isUnderserved && count === 0 && (
                      <span className="text-[9px] text-red-400 font-semibold">NONE</span>
                    )}
                  </div>
                  {/* Mini bar */}
                  <div className="w-full h-1 rounded-full bg-muted/60 mt-0.5">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        isUnderserved ? "bg-red-400" : "bg-primary/60"
                      }`}
                      style={{ width: `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1 shrink-0 pt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[10px] text-muted-foreground">Underserved (&lt;2 posts)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Publish Next Panel ────────────────────────────────────────────────────────

function PublishNextPanel() {
  const [expanded, setExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "cluster">("list");
  const [activeCluster, setActiveCluster] = useState<string | null>(null);

  const recsQuery = trpc.scoreboard.getPublishNextRecommendations.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 30, // cache 30 min — LLM calls are expensive
  });

  const recs: Recommendation[] = (recsQuery.data ?? []) as Recommendation[];

  // Build cluster groups
  const clusterGroups = useMemo(() => {
    const groups = new Map<string, Recommendation[]>();
    for (const rec of recs) {
      const cluster = rec.topicCluster ?? "Other";
      if (!groups.has(cluster)) groups.set(cluster, []);
      groups.get(cluster)!.push(rec);
    }
    return groups;
  }, [recs]);

  const clusters = Array.from(clusterGroups.keys());

  const displayRecs = useMemo(() => {
    if (viewMode === "cluster" && activeCluster) {
      return clusterGroups.get(activeCluster) ?? [];
    }
    return recs;
  }, [recs, viewMode, activeCluster, clusterGroups]);

  return (
    <Card className="bg-card border-border border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Publish Next — Strategic Recommendations
            <Badge className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 ml-1">
              {recs.length > 0 ? `${recs.length} opportunities` : recsQuery.isLoading ? "Loading…" : "0"}
            </Badge>
          </CardTitle>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Keywords where you're already ranking (pos 4–20) but not yet getting clicks — publish these next for fastest traffic gains.
        </p>
        {expanded && recs.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-muted/40 rounded-md p-0.5">
              <button
                onClick={() => { setViewMode("list"); setActiveCluster(null); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-3 h-3" />
                List
              </button>
              <button
                onClick={() => { setViewMode("cluster"); if (!activeCluster && clusters.length > 0) setActiveCluster(clusters[0]); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${viewMode === "cluster" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-3 h-3" />
                By Topic
              </button>
            </div>

            {/* Cluster filter pills (only in cluster mode) */}
            {viewMode === "cluster" && (
              <div className="flex flex-wrap gap-1.5">
                {clusters.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCluster(c)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                      activeCluster === c
                        ? (CLUSTER_COLORS[c] ?? CLUSTER_COLORS["Other"]) + " ring-1 ring-offset-1 ring-current"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                    }`}
                  >
                    {c} ({clusterGroups.get(c)?.length ?? 0})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {recsQuery.isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : recs.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <Lightbulb className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Connect Google Search Console and publish a few blog posts to unlock recommendations.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayRecs.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                >
                  {/* Rank */}
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{rec.rank}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground leading-snug">{rec.suggestedTitle}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <DifficultyBadge level={rec.estimatedDifficulty} />
                        {rec.topicCluster && <ClusterPill cluster={rec.topicCluster} />}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded">
                        🔑 {rec.keyword}
                      </span>
                      {rec.gscPosition != null && (
                        <span className="text-[10px] text-amber-500 font-semibold">
                          Currently pos {rec.gscPosition.toFixed(1)}
                        </span>
                      )}
                      {rec.gscImpressions != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {rec.gscImpressions.toLocaleString()} impressions/mo
                        </span>
                      )}
                      {rec.source === "gsc_striking_distance" && (
                        <span className="text-[10px] text-primary/70 font-medium">📈 Striking distance</span>
                      )}
                      {rec.source === "llm_family" && (
                        <span className="text-[10px] text-purple-500/80 font-medium">✨ AI suggested</span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{rec.rationale}</p>

                    {/* Competitor gap row */}
                    {(rec.competitorDomain || rec.competitorTitle) && (
                      <div className="mt-1.5 flex items-start gap-1.5">
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">vs #1:</span>
                        <CompetitorCell domain={rec.competitorDomain} title={rec.competitorTitle} />
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <a
                    href={`/creation-studio?keyword=${encodeURIComponent(rec.keyword)}&title=${encodeURIComponent(rec.suggestedTitle)}`}
                    className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 mt-0.5 font-medium"
                    title="Open in Creation Studio"
                  >
                    <PenLine className="w-3 h-3" />
                    Write
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Scoreboard() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "green" | "amber" | "red">("all");
  const [sortBy, setSortBy] = useState<"publishedAt" | "clicks" | "position" | "health" | "trend">("publishedAt");

  const postsQuery = trpc.scoreboard.getPublishedPosts.useQuery(undefined, { retry: false });

  const fetchYoastScore = trpc.content.fetchYoastScore.useMutation({
    onSuccess: () => {
      utils.scoreboard.getPublishedPosts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const posts: PostRow[] = (postsQuery.data ?? []) as PostRow[];

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalPosts = posts.length;
  const greenPosts = posts.filter((p) => p.health === "green").length;
  const redPosts = posts.filter((p) => p.health === "red").length;
  const totalClicks = posts.reduce((s, p) => s + (p.gscClicks ?? 0), 0);
  const avgPosition = posts.filter((p) => p.gscPosition != null).length > 0
    ? (posts.filter((p) => p.gscPosition != null).reduce((s, p) => s + p.gscPosition!, 0) /
       posts.filter((p) => p.gscPosition != null).length).toFixed(1)
    : "—";
  const trendingUp = posts.filter((p) => p.trendDirection === "up").length;

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = [...posts];
    if (filter !== "all") rows = rows.filter((p) => p.health === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.focusKeyword ?? "").toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      if (sortBy === "clicks") return (b.gscClicks ?? -1) - (a.gscClicks ?? -1);
      if (sortBy === "position") {
        if (a.gscPosition == null && b.gscPosition == null) return 0;
        if (a.gscPosition == null) return 1;
        if (b.gscPosition == null) return -1;
        return a.gscPosition - b.gscPosition;
      }
      if (sortBy === "health") {
        const order = { green: 0, amber: 1, red: 2 };
        return order[a.health] - order[b.health];
      }
      if (sortBy === "trend") {
        const tOrder = { up: 0, flat: 1, down: 2 };
        const aO = a.trendDirection ? tOrder[a.trendDirection] : 3;
        const bO = b.trendDirection ? tOrder[b.trendDirection] : 3;
        return aO - bO;
      }
      return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
    });
    return rows;
  }, [posts, filter, search, sortBy]);

  const handleRefresh = () => {
    utils.scoreboard.getPublishedPosts.invalidate();
    toast.info("Refreshing scoreboard data…");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Content Scoreboard
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            All published blog posts — Yoast SEO + Google Search Console (last 28 days)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {postsQuery.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Published Posts" value={totalPosts} icon={Globe} />
          <StatCard label="Winning (Green)" value={greenPosts} sub="Yoast good + GSC clicks" icon={CheckCircle2} color="text-green-500" />
          <StatCard label="Needs Attention" value={redPosts} sub="Yoast bad or no score" icon={XCircle} color="text-red-500" />
          <StatCard
            label="Total Clicks (28d)"
            value={totalClicks >= 1000 ? `${(totalClicks / 1000).toFixed(1)}K` : totalClicks}
            sub="Google Search Console"
            icon={MousePointerClick}
          />
          <StatCard
            label="Trending Up"
            value={trendingUp}
            sub="Position improving"
            icon={TrendingUp}
            color="text-green-500"
          />
        </div>
      )}

      {/* Pillar Coverage Bar */}
      <PillarCoverageBar />

      {/* Publish Next recommendations */}
      <PublishNextPanel />

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search posts or keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "green", "amber", "red"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === "all" ? "All" : f === "green" ? "✓ Winning" : f === "amber" ? "⚠ Watch" : "✗ Fix"}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <span className="text-xs text-muted-foreground self-center">Sort:</span>
          {(["publishedAt", "clicks", "position", "trend", "health"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sortBy === s ? "secondary" : "ghost"}
              onClick={() => setSortBy(s)}
              className="text-xs h-8"
            >
              {s === "publishedAt" ? "Newest" : s === "clicks" ? "Clicks" : s === "position" ? "Position" : s === "trend" ? "Trending" : "Health"}
            </Button>
          ))}
        </div>
      </div>

      {/* Posts table */}
      {postsQuery.isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="text-lg font-semibold text-foreground">No posts found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {posts.length === 0
                ? "Publish blog posts from the Command Center to see them here."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Post</span>
              <span>Yoast</span>
              <span>GSC Traffic</span>
              <span>Avg Position</span>
              <span>Trend</span>
              <span>Pushed To</span>
              <span></span>
            </div>

            {filtered.map((post) => (
              <div
                key={post.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors items-start md:items-center"
              >
                {/* Post title + meta */}
                <div className="flex items-start gap-2 min-w-0">
                  <HealthDot health={post.health} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-snug">{post.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {post.focusKeyword && (
                        <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          🔑 {post.focusKeyword}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{timeAgo(post.publishedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Yoast score */}
                <div className="flex flex-col gap-1">
                  <YoastBadge score={post.yoastScore} />
                  {post.yoastScoreFetchedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      checked {timeAgo(post.yoastScoreFetchedAt)}
                    </span>
                  )}
                </div>

                {/* GSC clicks + impressions */}
                <div className="flex flex-col gap-0.5">
                  {post.gscClicks != null ? (
                    <>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3 text-primary" />
                        {post.gscClicks.toLocaleString()} clicks
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {post.gscImpressions != null && post.gscImpressions >= 1000
                          ? `${(post.gscImpressions / 1000).toFixed(1)}K`
                          : (post.gscImpressions ?? 0).toLocaleString()} impr.
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No GSC data</span>
                  )}
                </div>

                {/* Avg position */}
                <div>
                  {post.gscPosition != null ? (
                    <span className={`text-sm font-semibold ${
                      post.gscPosition <= 3 ? "text-green-500" :
                      post.gscPosition <= 10 ? "text-amber-500" :
                      "text-muted-foreground"
                    }`}>
                      #{post.gscPosition.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </div>

                {/* Position trend */}
                <div className="flex flex-col gap-0.5">
                  <TrendBadge direction={post.trendDirection} delta={post.trendDelta} />
                  {post.trendDirection === null && (
                    <span className="text-[10px] text-muted-foreground/60">Need 2+ snapshots</span>
                  )}
                </div>

                {/* Pushed channels */}
                <ChannelBadges channels={post.pushedChannels} />

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    disabled={fetchYoastScore.isPending}
                    onClick={() => fetchYoastScore.mutate({ contentItemId: post.id })}
                    title="Refresh Yoast score from WordPress"
                  >
                    <RefreshCw className={`w-3 h-3 ${fetchYoastScore.isPending ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Yoast</span>
                  </Button>
                  {post.publishUrl && (
                    <a
                      href={post.publishUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Open live post"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Winning — Yoast Good + GSC clicks</span>
        <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Watch — Yoast OK or no GSC data yet</span>
        <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" /> Fix — Yoast Bad or score not fetched</span>
        <span className="flex items-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5 text-green-500" /> Trend — position improving vs last snapshot</span>
        <span className="ml-auto">GSC data: last 28 days · 3-day lag · Trend snapshots hourly</span>
      </div>
    </div>
  );
}
