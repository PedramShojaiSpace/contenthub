/**
 * Competitive Intelligence — DataForSEO
 *
 * Panels:
 *   0. Tracked Competitors — saved list of competitor domains to monitor
 *   1. Domain Overview — organic ranking distribution for your domain
 *   2. Competitor Domains — top competing domains sorted by keyword overlap (DataForSEO-discovered)
 *   3. Keyword Gap — keywords a selected competitor ranks for that you don't (two modes)
 *   4. Shared Keywords — keywords both you and a competitor rank for (intersection)
 *   5. Keyword Research — search volume, CPC, difficulty, intent for any keywords
 *   6. Keyword History — sidebar showing past searches with favorites toggle
 */
import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BarChart3,
  Search,
  TrendingUp,
  Zap,
  PenSquare,
  Video,
  ChevronRight,
  Users,
  Target,
  AlertCircle,
  Plus,
  Trash2,
  BookMarked,
  Star,
  History,
  X,
  ArrowRight,
  Globe,
} from "lucide-react";

const MY_DOMAIN = "theurbanmonk.com";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color = "text-primary",
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function LoadingRows({ count = 6 }: { count?: number }) {
  return (
    <div className="p-4 space-y-2">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function KeywordSparkline({
  data,
}: {
  data: Array<{ year: number; month: number; search_volume: number }> | null | undefined;
}) {
  if (!data || data.length < 2) return <span className="text-muted-foreground text-xs">—</span>;
  const sorted = [...data]
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .slice(-12)
    .map((d) => ({ v: d.search_volume }));
  const max = Math.max(...sorted.map((d) => d.v));
  const min = Math.min(...sorted.map((d) => d.v));
  const trend = sorted[sorted.length - 1].v >= sorted[0].v;
  const color = trend ? "#22c55e" : "#f97316";
  return (
    <div className="w-20 h-8 inline-block">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sorted} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`sg-${min}-${max}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="bg-popover border border-border rounded px-2 py-1 text-[10px] text-foreground shadow">
                  {fmt(payload[0].value as number)}
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sg-${min}-${max})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ d }: { d: number | null | undefined }) {
  if (d == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color =
    d < 30
      ? "bg-green-500/10 text-green-600 border-green-500/30"
      : d < 60
      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
      : "bg-red-500/10 text-red-600 border-red-500/30";
  const label = d < 30 ? "Easy" : d < 60 ? "Medium" : "Hard";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${color}`}
    >
      {d} · {label}
    </span>
  );
}

// ─── Keyword History Sidebar ──────────────────────────────────────────────────

function KeywordHistorySidebar({
  onSelectKeyword,
  onClose,
}: {
  onSelectKeyword: (keyword: string) => void;
  onClose: () => void;
}) {
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.dfs.getKeywordHistory.useQuery({
    favoritesOnly,
    limit: 100,
  });

  const toggleFavMutation = trpc.dfs.toggleKeywordFavorite.useMutation({
    onSuccess: () => utils.dfs.getKeywordHistory.invalidate(),
  });

  const deleteMutation = trpc.dfs.deleteKeywordSearch.useMutation({
    onSuccess: () => {
      utils.dfs.getKeywordHistory.invalidate();
      toast.success("Removed from history");
    },
  });

  const searches = data?.searches ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-foreground">Keyword History</span>
          {searches.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {searches.length}
            </Badge>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={() => setFavoritesOnly(false)}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
            !favoritesOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFavoritesOnly(true)}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
            favoritesOnly
              ? "bg-amber-500 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="w-3 h-3" />
          Favorites
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : searches.length === 0 ? (
          <div className="p-4 text-center">
            <History className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground">
              {favoritesOnly
                ? "No favorites yet. Star a keyword to save it here."
                : "No searches yet. Research a keyword to see it here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {searches.map((item) => (
              <div
                key={item.id}
                className="px-3 py-2.5 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  {/* Star toggle */}
                  <button
                    onClick={() => toggleFavMutation.mutate({ id: item.id })}
                    className={`mt-0.5 shrink-0 transition-colors ${
                      item.isFavorite
                        ? "text-amber-500"
                        : "text-muted-foreground hover:text-amber-500 opacity-0 group-hover:opacity-100"
                    }`}
                    title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={`w-3.5 h-3.5 ${item.isFavorite ? "fill-current" : ""}`} />
                  </button>

                  {/* Keyword + metrics */}
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => onSelectKeyword(item.keyword)}
                    title={`Re-search: ${item.keyword}`}
                  >
                    <p className="text-xs font-medium text-foreground truncate leading-tight">
                      {item.keyword}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.searchVolume != null ? `${fmt(item.searchVolume)}/mo` : "—"}
                      {item.difficulty != null ? ` · KD ${item.difficulty}` : ""}
                      {item.intent ? ` · ${item.intent}` : ""}
                    </p>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate({ id: item.id })}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from history"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tracked Competitor List ──────────────────────────────────────────────────

function TrackedCompetitors({
  onSelectCompetitor,
  selectedCompetitor,
}: {
  onSelectCompetitor: (domain: string) => void;
  selectedCompetitor: string | null;
}) {
  const [newDomain, setNewDomain] = useState("");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.dfs.listTrackedCompetitors.useQuery();
  const addMutation = trpc.dfs.addTrackedCompetitor.useMutation({
    onSuccess: (result) => {
      if (result.alreadyExists) {
        toast.info(`${result.domain} is already in your tracking list`);
      } else {
        toast.success(`Added ${result.domain} to your tracking list`);
        setNewDomain("");
      }
      utils.dfs.listTrackedCompetitors.invalidate();
    },
    onError: () => toast.error("Failed to add competitor"),
  });
  const removeMutation = trpc.dfs.removeTrackedCompetitor.useMutation({
    onSuccess: () => {
      utils.dfs.listTrackedCompetitors.invalidate();
      toast.success("Removed from tracking list");
    },
    onError: () => toast.error("Failed to remove competitor"),
  });

  const handleAdd = () => {
    const domain = newDomain.trim();
    if (!domain) return;
    addMutation.mutate({ domain });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={BookMarked}
          title="Tracked Competitors"
          subtitle="Your saved list of competitor domains — click any to run gap analysis"
          color="text-indigo-500"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder="competitor.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={addMutation.isPending || !newDomain.trim()}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <LoadingRows count={3} />
        ) : !data?.competitors.length ? (
          <p className="text-sm text-muted-foreground py-2">
            No competitors tracked yet. Add a domain above to start monitoring it.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {data.competitors.map((item: { id: number; domain: string; label: string | null; addedAt: Date }) => {
              const isSelected = selectedCompetitor === item.domain;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors ${
                    isSelected ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => onSelectCompetitor(item.domain)}
                  >
                    <span className="text-sm font-medium text-foreground truncate block">
                      {item.label || item.domain}
                    </span>
                    {item.label && (
                      <span className="text-xs text-muted-foreground">{item.domain}</span>
                    )}
                  </button>
                  {isSelected && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary shrink-0">
                      Active
                    </Badge>
                  )}
                  <button
                    onClick={() => removeMutation.mutate({ id: item.id })}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="Remove from tracking list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Domain Overview ──────────────────────────────────────────────────────────

function DomainOverview() {
  const { data, isLoading } = trpc.dfs.domainRankOverview.useQuery({ domain: MY_DOMAIN });
  const metrics = data?.metrics?.organic;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={BarChart3}
          title={`${MY_DOMAIN} — Organic Ranking Overview`}
          subtitle="Total keywords ranked in Google, by position bucket"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !metrics ? (
          <p className="text-sm text-muted-foreground">No ranking data found for this domain.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { label: "Top 3", value: metrics.pos_1 + metrics.pos_2_3, color: "text-green-500" },
              { label: "Pos 4–10", value: metrics.pos_4_10, color: "text-emerald-500" },
              { label: "Pos 11–20", value: metrics.pos_11_20, color: "text-amber-500" },
              { label: "Pos 21–30", value: metrics.pos_21_30, color: "text-orange-500" },
              { label: "Total Keywords", value: metrics.count, color: "text-primary" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/30 p-3 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{fmt(item.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DataForSEO-Discovered Competitor Domains ─────────────────────────────────

function DiscoveredCompetitors({
  onSelectCompetitor,
  onTrackCompetitor,
  selectedCompetitor,
  trackedDomains,
}: {
  onSelectCompetitor: (domain: string) => void;
  onTrackCompetitor: (domain: string) => void;
  selectedCompetitor: string | null;
  trackedDomains: Set<string>;
}) {
  const { data, isLoading } = trpc.dfs.competitors.useQuery({ domain: MY_DOMAIN, limit: 20 });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Users}
          title="Discovered Competitors"
          subtitle="Domains DataForSEO found competing with you — click to analyze, bookmark to track"
          color="text-rose-500"
        />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingRows />
        ) : !data?.items?.length ? (
          <p className="p-4 text-sm text-muted-foreground">No competitor data found.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.items.map((item, i) => {
              const organic = item.full_domain_metrics?.organic;
              const isSelected = selectedCompetitor === item.domain;
              const isTracked = trackedDomains.has(item.domain);
              return (
                <div
                  key={i}
                  className={`px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors ${
                    isSelected ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <button
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    onClick={() => onSelectCompetitor(item.domain)}
                  >
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.domain}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.intersections} shared keywords
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {organic && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">{fmt(organic.count)} total kw</p>
                        <p className="text-xs text-emerald-500">{fmt(organic.pos_1)} top-3</p>
                      </div>
                    )}
                    <button
                      onClick={() => onTrackCompetitor(item.domain)}
                      className={`p-1.5 rounded transition-colors ${
                        isTracked
                          ? "text-indigo-500 bg-indigo-500/10"
                          : "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                      }`}
                      title={isTracked ? "Already tracked" : "Add to tracking list"}
                    >
                      <BookMarked className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Keyword Gap (competitor-based, existing panel) ───────────────────────────

function KeywordGapCompetitor({
  competitor,
  onCreateContent,
}: {
  competitor: string;
  onCreateContent: (keyword: string, type: "video" | "blog") => void;
}) {
  const { data, isLoading } = trpc.dfs.rankedKeywords.useQuery(
    { domain: competitor, limit: 100 },
    { enabled: !!competitor }
  );
  const items = data?.items ?? [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Zap}
          title={`Keyword Gap — ${competitor}`}
          subtitle="Keywords this competitor ranks for in top 20 (by search volume) — your content opportunities"
          color="text-amber-500"
        />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingRows count={10} />
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No gap keywords found.</p>
        ) : (
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {items.map((item, i) => {
              const kw = item.keyword_data.keyword;
              const vol = item.keyword_data.keyword_info.search_volume;
              const pos = item.ranked_serp_element.serp_item.rank_group;
              return (
                <div key={i} className="px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                      <span className="text-sm text-foreground truncate">{kw}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{fmt(vol)}/mo</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        #{pos}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                      onClick={() => onCreateContent(kw, "video")}
                    >
                      <Video className="w-3 h-3" />
                      Video Script
                    </button>
                    <button
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                      onClick={() => onCreateContent(kw, "blog")}
                    >
                      <PenSquare className="w-3 h-3" />
                      Blog Post
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Keyword Gap View (domain vs domain) ─────────────────────────────────────

function KeywordGapView({
  onCreateContent,
}: {
  onCreateContent: (keyword: string, type: "video" | "blog") => void;
}) {
  const [myDomain, setMyDomain] = useState(MY_DOMAIN);
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [queryParams, setQueryParams] = useState<{ myDomain: string; competitorDomain: string; limit: number } | null>(null);

  const { data, isLoading, error } = trpc.dfs.keywordGap.useQuery(
    queryParams ?? { myDomain: MY_DOMAIN, competitorDomain: "", limit: 50 },
    { enabled: !!queryParams }
  );

  const handleRun = () => {
    const comp = competitorDomain.trim();
    if (!comp) {
      toast.error("Enter a competitor domain");
      return;
    }
    setQueryParams({ myDomain: myDomain.trim() || MY_DOMAIN, competitorDomain: comp, limit: 50 });
  };

  const items = data?.items ?? [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Globe}
          title="Keyword Gap Analysis"
          subtitle="Enter two domains to surface keywords the competitor ranks for that you don't — sorted by volume"
          color="text-cyan-500"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Domain inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Your Domain</label>
            <Input
              value={myDomain}
              onChange={(e) => setMyDomain(e.target.value)}
              placeholder="theurbanmonk.com"
              className="text-sm"
            />
          </div>
          <div className="flex items-end pb-1">
            <ArrowRight className="w-4 h-4 text-muted-foreground mx-1 hidden sm:block" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Competitor Domain</label>
            <Input
              value={competitorDomain}
              onChange={(e) => setCompetitorDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRun()}
              placeholder="competitor.com"
              className="text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleRun}
              disabled={isLoading || !competitorDomain.trim()}
              className="gap-2 w-full sm:w-auto"
            >
              <Search className="w-4 h-4" />
              {isLoading ? "Analyzing…" : "Find Gaps"}
            </Button>
          </div>
        </div>

        {isLoading && <LoadingRows count={8} />}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Failed to fetch keyword gap data. Check that both domains are valid.
          </div>
        )}

        {!isLoading && queryParams && items.length === 0 && !error && (
          <p className="text-sm text-muted-foreground py-2">
            No gap keywords found. The competitor may not have enough ranking data, or you already rank for their top keywords.
          </p>
        )}

        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{items.length}</span> keywords{" "}
                <span className="text-cyan-500 font-medium">{queryParams?.competitorDomain}</span> ranks for that{" "}
                <span className="text-foreground font-medium">{queryParams?.myDomain}</span> does not
              </p>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 bg-muted/20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Keyword</span>
                <span className="text-right">Volume</span>
                <span className="text-right">CPC</span>
                <span className="text-center">Their Rank</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="px-4 py-2.5 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-center hover:bg-muted/30 group transition-colors"
                  >
                    <span className="text-sm text-foreground truncate">{item.keyword}</span>
                    <span className="text-right text-sm font-medium text-foreground">
                      {fmt(item.search_volume)}
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      {item.cpc != null ? `$${Number(item.cpc).toFixed(2)}` : "—"}
                    </span>
                    <div className="flex justify-center">
                      {item.competitor_rank != null ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            item.competitor_rank <= 3
                              ? "border-green-500/40 text-green-600"
                              : item.competitor_rank <= 10
                              ? "border-emerald-500/40 text-emerald-600"
                              : "border-muted-foreground/40 text-muted-foreground"
                          }`}
                        >
                          #{item.competitor_rank}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                        onClick={() => onCreateContent(item.keyword, "blog")}
                        title="Generate article from this keyword"
                      >
                        <PenSquare className="w-3 h-3" />
                        Article
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shared Keywords (Intersection) ──────────────────────────────────────────

function SharedKeywords({ competitor }: { competitor: string }) {
  const { data, isLoading } = trpc.dfs.domainIntersection.useQuery(
    { target1: MY_DOMAIN, target2: competitor, limit: 50 },
    { enabled: !!competitor }
  );
  const items = data?.items ?? [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Target}
          title={`Shared Keywords — ${competitor}`}
          subtitle="Keywords both you and this competitor rank for — see where you're winning or losing"
          color="text-blue-500"
        />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingRows count={8} />
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No shared keywords found.</p>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            <div className="px-4 py-2 bg-muted/20 grid grid-cols-4 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Keyword</span>
              <span className="text-center">You</span>
              <span className="text-center">Them</span>
            </div>
            {items.map((item, i) => {
              const kw = item.keyword_data.keyword;
              const myPos = item.first_domain_serp_element?.serp_item.rank_group;
              const theirPos = item.second_domain_serp_element?.serp_item.rank_group;
              const youWin = myPos != null && theirPos != null && myPos < theirPos;
              const theyWin = myPos != null && theirPos != null && theirPos < myPos;
              return (
                <div key={i} className="px-4 py-2.5 grid grid-cols-4 gap-2 items-center hover:bg-muted/30">
                  <span className="col-span-2 text-sm text-foreground truncate">{kw}</span>
                  <span className={`text-center text-xs font-medium ${youWin ? "text-green-500" : "text-muted-foreground"}`}>
                    {myPos != null ? `#${myPos}` : "—"}
                  </span>
                  <span className={`text-center text-xs font-medium ${theyWin ? "text-red-500" : "text-muted-foreground"}`}>
                    {theirPos != null ? `#${theirPos}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Keyword Research ─────────────────────────────────────────────────────────

function KeywordResearch({
  onCreateContent,
  initialKeyword,
  onKeywordSearched,
}: {
  onCreateContent: (keyword: string, type: "video" | "blog") => void;
  initialKeyword?: string;
  onKeywordSearched?: () => void;
}) {
  const [inputValue, setInputValue] = useState(initialKeyword ?? "");
  const [keywords, setKeywords] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const saveSearchMutation = trpc.dfs.saveKeywordSearch.useMutation({
    onSuccess: () => utils.dfs.getKeywordHistory.invalidate(),
  });

  // Auto-run search when initialKeyword is provided
  useEffect(() => {
    if (initialKeyword && initialKeyword.trim()) {
      setInputValue(initialKeyword);
      const kws = [initialKeyword.trim()];
      setKeywords(kws);
    }
  }, [initialKeyword]);

  const { data, isLoading } = trpc.dfs.keywordOverview.useQuery(
    { keywords },
    { enabled: keywords.length > 0, retry: false }
  );

  // Auto-save to history when results arrive
  useEffect(() => {
    if (!data?.items) return;
    for (const item of data.items) {
      saveSearchMutation.mutate({
        keyword: item.keyword,
        searchVolume: item.search_volume ?? undefined,
        difficulty: item.keyword_difficulty ?? undefined,
        cpc: item.cpc != null ? String(item.cpc.toFixed(2)) : undefined,
        intent: item.search_intent_info?.main_intent ?? undefined,
        trendData: item.monthly_searches ? JSON.stringify(item.monthly_searches) : undefined,
      });
    }
    onKeywordSearched?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleSearch = () => {
    const kws = inputValue
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (kws.length === 0) {
      toast.error("Enter at least one keyword");
      return;
    }
    setKeywords(kws);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Search}
          title="Keyword Research"
          subtitle="Enter up to 20 keywords (comma or newline separated) to get search volume, CPC, difficulty, and intent"
          color="text-violet-500"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="gut health, urban monk, meditation for stress, ..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isLoading} className="gap-2 shrink-0">
            <Search className="w-4 h-4" />
            Research
          </Button>
        </div>

        {isLoading && <LoadingRows count={4} />}

        {data?.items && data.items.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2 bg-muted/20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Keyword</span>
              <span className="text-right">Volume</span>
              <span className="text-center">Trend (12mo)</span>
              <span className="text-right">CPC</span>
              <span className="text-right">Difficulty</span>
              <span className="text-right">Intent</span>
              <span className="text-right">Generate</span>
            </div>
            <div className="divide-y divide-border">
              {data.items.map((item, i) => (
                <div key={i} className="px-4 py-2 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center hover:bg-muted/30 group transition-colors">
                  <span className="text-sm text-foreground truncate">{item.keyword}</span>
                  <span className="text-right text-sm font-medium text-foreground">
                    {fmt(item.search_volume)}
                  </span>
                  <div className="flex justify-center">
                    <KeywordSparkline data={item.monthly_searches} />
                  </div>
                  <span className="text-right text-xs text-muted-foreground">
                    {item.cpc != null ? `$${item.cpc.toFixed(2)}` : "—"}
                  </span>
                  <div className="flex justify-end">
                    <DifficultyBadge d={item.keyword_difficulty} />
                  </div>
                  <span className="text-right text-xs text-muted-foreground capitalize">
                    {item.search_intent_info?.main_intent ?? "—"}
                  </span>
                  {/* Generate Article button */}
                  <div className="flex justify-end">
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                      onClick={() => onCreateContent(item.keyword, "blog")}
                      title={`Generate article: "${item.keyword}"`}
                    >
                      <PenSquare className="w-3 h-3" />
                      Article
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data?.items && data.items.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.items.slice(0, 5).map((item) => (
              <div key={item.keyword} className="flex items-center gap-1">
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                  onClick={() => onCreateContent(item.keyword, "video")}
                >
                  <Video className="w-3 h-3" />
                  {item.keyword.slice(0, 20)}{item.keyword.length > 20 ? "…" : ""} → Video
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                  onClick={() => onCreateContent(item.keyword, "blog")}
                >
                  <PenSquare className="w-3 h-3" />
                  Blog
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompetitiveIntelligence() {
  const [, setLocation] = useLocation();
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const utils = trpc.useUtils();

  // Read ?keyword= URL param so Kanban cards can deep-link to keyword research
  const initialKeyword = new URLSearchParams(window.location.search).get("keyword") ?? undefined;

  // Auto-open history sidebar when there's a keyword param (user came from Kanban)
  useEffect(() => {
    if (initialKeyword) {
      // Don't auto-open history on deep-link — focus is on the research result
    }
  }, [initialKeyword]);

  const statusQuery = trpc.dfs.status.useQuery(undefined, { retry: false });
  const trackedQuery = trpc.dfs.listTrackedCompetitors.useQuery();
  const addMutation = trpc.dfs.addTrackedCompetitor.useMutation({
    onSuccess: () => utils.dfs.listTrackedCompetitors.invalidate(),
  });

  const trackedDomains = new Set(
    (trackedQuery.data?.competitors ?? []).map((c: { domain: string }) => c.domain)
  );

  const handleCreateContent = useCallback((keyword: string, type: "video" | "blog") => {
    const encoded = encodeURIComponent(keyword);
    if (type === "video") {
      setLocation(`/video-production?keyword=${encoded}`);
      toast.info(`Opening Video Production with keyword: "${keyword}"`);
    } else {
      setLocation(`/studio?keyword=${encoded}&platform=blog`);
      toast.info(`Opening Blog Generator with keyword: "${keyword}"`);
    }
  }, [setLocation]);

  const handleTrackCompetitor = (domain: string) => {
    if (trackedDomains.has(domain)) {
      toast.info(`${domain} is already in your tracking list`);
      return;
    }
    addMutation.mutate({ domain });
    toast.success(`Added ${domain} to your tracking list`);
  };

  const handleHistorySelect = useCallback((keyword: string) => {
    // Navigate to this page with the keyword param to re-run the search
    setLocation(`/competitive-intelligence?keyword=${encodeURIComponent(keyword)}`);
    setShowHistory(false);
    toast.info(`Re-searching: "${keyword}"`);
  }, [setLocation]);

  if (statusQuery.isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (!statusQuery.data?.connected) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">DataForSEO Not Connected</h2>
          <p className="text-muted-foreground text-sm">
            DataForSEO credentials are not configured. Please contact your administrator to set the
            DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Competitive Intelligence</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                DataForSEO — keyword gaps, competitor analysis, and search volume research
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5 text-xs py-1 px-2.5 border-green-500/40 text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Connected · {statusQuery.data.login}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory((v) => !v)}
                className={`gap-2 ${showHistory ? "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400" : ""}`}
              >
                <History className="w-4 h-4" />
                History
              </Button>
            </div>
          </div>

          {/* Tracked Competitors + Domain Overview side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrackedCompetitors
              onSelectCompetitor={setSelectedCompetitor}
              selectedCompetitor={selectedCompetitor}
            />
            <DomainOverview />
          </div>

          {/* Keyword Research */}
          <KeywordResearch
            onCreateContent={handleCreateContent}
            initialKeyword={initialKeyword}
            onKeywordSearched={() => {
              // Refresh history after a new search
              utils.dfs.getKeywordHistory.invalidate();
            }}
          />

          {/* Keyword Gap View (domain vs domain) */}
          <KeywordGapView onCreateContent={handleCreateContent} />

          {/* Discovered Competitors + Gap Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DiscoveredCompetitors
              onSelectCompetitor={setSelectedCompetitor}
              onTrackCompetitor={handleTrackCompetitor}
              selectedCompetitor={selectedCompetitor}
              trackedDomains={trackedDomains}
            />

            {selectedCompetitor ? (
              <div className="space-y-6">
                <KeywordGapCompetitor competitor={selectedCompetitor} onCreateContent={handleCreateContent} />
                <SharedKeywords competitor={selectedCompetitor} />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 min-h-[200px]">
                <div className="text-center space-y-2 p-6">
                  <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Click a competitor domain (tracked or discovered) to see keyword gaps and shared rankings
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyword History Sidebar */}
      {showHistory && (
        <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          <KeywordHistorySidebar
            onSelectKeyword={handleHistorySelect}
            onClose={() => setShowHistory(false)}
          />
        </div>
      )}
    </div>
  );
}
