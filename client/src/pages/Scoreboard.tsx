/**
 * Content Scoreboard
 * ──────────────────
 * A single-view performance dashboard for all published blog posts.
 * Shows Yoast SEO score, Google Search Console traffic (clicks, impressions,
 * avg position), social push channels, and a computed health signal.
 *
 * Data sources:
 *  - content_items table (Yoast score, pushedChannels, publishUrl, focusKeyword)
 *  - Google Search Console via gscRouter.topPages (28-day window, live)
 *
 * Health signal logic:
 *  green  = Yoast "good" + GSC clicks > 0
 *  amber  = Yoast "ok" OR no GSC data yet
 *  red    = Yoast "bad" OR no Yoast score at all
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
  TrendingDown,
  Minus,
  Search,
  MousePointerClick,
  Eye,
  Target,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  BarChart3,
  Globe,
  Zap,
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
  health: "green" | "amber" | "red";
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Scoreboard() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "green" | "amber" | "red">("all");
  const [sortBy, setSortBy] = useState<"publishedAt" | "clicks" | "position" | "health">("publishedAt");

  const postsQuery = trpc.scoreboard.getPublishedPosts.useQuery(undefined, { retry: false });

  const fetchYoastScore = trpc.content.fetchYoastScore.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`Yoast score: ${data.seoScore ?? "unknown"}`);
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
  const totalImpressions = posts.reduce((s, p) => s + (p.gscImpressions ?? 0), 0);
  const avgPosition = posts.filter((p) => p.gscPosition != null).length > 0
    ? (posts.filter((p) => p.gscPosition != null).reduce((s, p) => s + p.gscPosition!, 0) /
       posts.filter((p) => p.gscPosition != null).length).toFixed(1)
    : "—";

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
      // publishedAt desc
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
            label="Avg. Position"
            value={avgPosition}
            sub="Posts with GSC data"
            icon={Target}
          />
        </div>
      )}

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
          {(["publishedAt", "clicks", "position", "health"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sortBy === s ? "secondary" : "ghost"}
              onClick={() => setSortBy(s)}
              className="text-xs h-8"
            >
              {s === "publishedAt" ? "Newest" : s === "clicks" ? "Clicks" : s === "position" ? "Position" : "Health"}
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
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Post</span>
              <span>Yoast</span>
              <span>GSC Traffic</span>
              <span>Avg Position</span>
              <span>Pushed To</span>
              <span></span>
            </div>

            {filtered.map((post) => (
              <div
                key={post.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors items-start md:items-center"
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
        <span className="ml-auto">GSC data: last 28 days · 3-day lag</span>
      </div>
    </div>
  );
}
