import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Globe,
  MousePointerClick,
  Eye,
  Target,
  Unlink,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Zap,
  PenSquare,
  Video,
  Pencil,
  Repeat2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  format = "number",
}: {
  label: string;
  value: number;
  delta?: number;
  icon: React.ElementType;
  format?: "number" | "percent";
}) {
  const formatted =
    format === "percent"
      ? `${(value * 100).toFixed(1)}%`
      : value >= 1000
      ? `${(value / 1000).toFixed(1)}K`
      : value.toString();

  const deltaFormatted =
    delta === undefined
      ? null
      : format === "percent"
      ? `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`
      : delta >= 0
      ? `+${delta.toFixed(0)}`
      : `${delta.toFixed(0)}`;

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{formatted}</p>
            {deltaFormatted && (
              <div
                className={`flex items-center gap-1 mt-1 text-sm ${
                  delta! > 0 ? "text-green-500" : delta! < 0 ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {delta! > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : delta! < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>{deltaFormatted} vs last week</span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectPanel({ onConnected }: { onConnected: () => void }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/gsc/auth-url", { credentials: "include" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "width=600,height=700,noopener");
        toast.info("Complete the Google authorization in the popup, then click Refresh below.");
      } else {
        toast.error("Failed to get authorization URL");
      }
    } catch {
      toast.error("Failed to connect to Google Search Console");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Search className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Connect Google Search Console</h2>
        <p className="text-muted-foreground mt-2">
          See exactly which keywords are driving traffic to theurbanmonk.com, which pages rank best, and your fastest
          opportunities to climb from page 2 to page 1.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleConnect} disabled={connecting} className="gap-2">
          {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          Connect Google Search Console
        </Button>
        <Button variant="outline" onClick={onConnected} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Already connected — Refresh
        </Button>
      </div>
    </div>
  );
}

function SiteSelector({
  currentSiteUrl,
  onSelect,
}: {
  currentSiteUrl: string | null;
  onSelect: (url: string) => void;
}) {
  const sitesQuery = trpc.gsc.listSites.useQuery(undefined, { retry: false });
  const setSiteUrl = trpc.gsc.setSiteUrl.useMutation({
    onSuccess: () => toast.success("Site updated"),
    onError: (e) => toast.error(e.message),
  });

  if (sitesQuery.isLoading) return <Skeleton className="h-9 w-48" />;
  if (sitesQuery.error) return null;

  const sites = sitesQuery.data?.sites ?? [];
  if (sites.length === 0) return <p className="text-sm text-muted-foreground">No Search Console properties found.</p>;

  return (
    <Select
      value={currentSiteUrl ?? ""}
      onValueChange={(val) => {
        setSiteUrl.mutate({ siteUrl: val });
        onSelect(val);
      }}
    >
      <SelectTrigger className="w-64 bg-background border-border">
        <SelectValue placeholder="Select a property…" />
      </SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s} value={s}>
            {s.replace(/^(https?:\/\/)?(sc-domain:)?/, "")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function SeoDashboard() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const statusQuery = trpc.gsc.status.useQuery(undefined, { retry: false });
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const activeSite = selectedSite ?? statusQuery.data?.siteUrl ?? null;

  const wowQuery = trpc.gsc.weekOverWeek.useQuery(undefined, {
    enabled: !!statusQuery.data?.connected && !!activeSite,
    retry: false,
  });
  const topQueriesQuery = trpc.gsc.topQueries.useQuery(
    { limit: 20 },
    { enabled: !!statusQuery.data?.connected && !!activeSite, retry: false }
  );
  const topPagesQuery = trpc.gsc.topPages.useQuery(
    { limit: 20 },
    { enabled: !!statusQuery.data?.connected && !!activeSite, retry: false }
  );
  const strikingQuery = trpc.gsc.strikingDistance.useQuery(undefined, {
    enabled: !!statusQuery.data?.connected && !!activeSite,
    retry: false,
  });

  const trackedQuery = trpc.gsc.trackedKeywords.useQuery(undefined, {
    enabled: !!statusQuery.data?.connected,
    retry: false,
  });

  // DataForSEO volume lookup for striking-distance keywords
  // Only fires once we have striking keywords to look up
  const strikingKeywords = (strikingQuery.data ?? []).map((r: { query: string }) => r.query);
  const volumeQuery = trpc.dfs.keywordVolumeForList.useQuery(
    { keywords: strikingKeywords },
    {
      enabled: strikingKeywords.length > 0,
      retry: false,
      staleTime: 1000 * 60 * 60, // 1 hour — volume data doesn't change frequently
    }
  );
  const volumeMap: Record<string, number | null> = volumeQuery.data?.volumeMap ?? {};

  // Build a quick-lookup set: "keyword::type" -> true
  const trackedSet = new Set(
    (trackedQuery.data ?? []).map((r) => `${r.keyword}::${r.contentType}`)
  );
  const isTracked = (keyword: string, type: "video" | "blog") =>
    trackedSet.has(`${keyword.toLowerCase().trim()}::${type}`);

  const trackKeyword = trpc.gsc.trackKeywordSend.useMutation({
    onSuccess: () => utils.gsc.trackedKeywords.invalidate(),
  });

  const disconnect = trpc.gsc.disconnect.useMutation({
    onSuccess: () => {
      utils.gsc.status.invalidate();
      toast.success("Google Search Console disconnected");
    },
  });

  const isRefreshing =
    wowQuery.isFetching ||
    topQueriesQuery.isFetching ||
    topPagesQuery.isFetching ||
    strikingQuery.isFetching;

  const handleRefresh = async () => {
    try {
      await Promise.all([
        utils.gsc.status.invalidate(),
        utils.gsc.weekOverWeek.invalidate(),
        utils.gsc.topQueries.invalidate(),
        utils.gsc.topPages.invalidate(),
        utils.gsc.strikingDistance.invalidate(),
        utils.gsc.trackedKeywords.invalidate(),
      ]);
      toast.success("SEO data refreshed from Google Search Console");
    } catch (err: any) {
      toast.error(`Refresh failed: ${err?.message ?? "Unknown error"}`);
    }
  };

  if (statusQuery.isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!statusQuery.data?.connected) {
    return (
      <div className="p-8">
        <ConnectPanel onConnected={handleRefresh} />
      </div>
    );
  }

  const wow = wowQuery.data;
  type QRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };
  type PRow = { page: string; clicks: number; impressions: number; ctr: number; position: number };
  const queries: QRow[] = (topQueriesQuery.data ?? []) as QRow[];
  const pages: PRow[] = (topPagesQuery.data ?? []) as PRow[];
  const striking: QRow[] = (strikingQuery.data ?? []) as QRow[];

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SEO Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Google Search Console — last 28 days</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SiteSelector currentSiteUrl={activeSite} onSelect={setSelectedSite} />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect.mutate()}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Unlink className="w-4 h-4" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* No site selected */}
      {!activeSite && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Select a Search Console property above to load your SEO data.</p>
        </div>
      )}

      {/* Week-over-week summary cards */}
      {activeSite && (
        <>
          {wowQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : wow ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Clicks (this week)"
                value={wow.thisWeekClicks}
                delta={wow.clicksDelta}
                icon={MousePointerClick}
              />
              <StatCard
                label="Impressions (this week)"
                value={wow.thisWeekImpressions}
                delta={wow.impressionsDelta}
                icon={Eye}
              />
              <StatCard
                label="Clicks last week"
                value={wow.lastWeekClicks}
                icon={Target}
              />
              <StatCard
                label="Impressions last week"
                value={wow.lastWeekImpressions}
                icon={Search}
              />
            </div>
          ) : null}

          {/* Three data panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Queries */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  Top Keywords by Clicks
                </CardTitle>
                <p className="text-xs text-muted-foreground">Last 28 days</p>
              </CardHeader>
              <CardContent className="p-0">
                {topQueriesQuery.isLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
                  </div>
                ) : queries.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No data available yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {queries.map((row, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/30 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                          <span className="text-sm text-foreground truncate">{row.query}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setLocation(`/studio?keyword=${encodeURIComponent(row.query)}&platform=blog`);
                              toast.info(`Opening Blog Generator with keyword: "${row.query}"`);
                            }}
                            title={`Generate article for "${row.query}"`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700"
                          >
                            <PenSquare className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MousePointerClick className="w-3 h-3" />
                              {row.clicks}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {row.impressions >= 1000 ? `${(row.impressions / 1000).toFixed(1)}K` : row.impressions}
                            </span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              #{row.position.toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Top Pages by Clicks
                </CardTitle>
                <p className="text-xs text-muted-foreground">Last 28 days</p>
              </CardHeader>
              <CardContent className="p-0">
                {topPagesQuery.isLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
                  </div>
                ) : pages.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No data available yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {pages.map((row, i) => {
                      const path = row.page.replace(/^https?:\/\/[^/]+/, "") || "/";
                      // Build WordPress post editor URL:
                      // WP search by slug — open wp-admin search for this path
                      // WORDPRESS_URL is server-only; use the known production URL directly
                      const WP_BASE = "https://theurbanmonk.com";
                      const slug = path.replace(/^\//, "").replace(/\/$/, "");
                      const wpEditUrl = slug
                        ? `${WP_BASE}/wp-admin/edit.php?s=${encodeURIComponent(slug)}&post_type=post`
                        : `${WP_BASE}/wp-admin/`;
                      return (
                        <div key={i} className="px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                              <a
                                href={row.page}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline truncate flex items-center gap-1"
                              >
                                {path}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" />
                                {row.clicks}
                              </span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                #{row.position.toFixed(1)}
                              </Badge>
                            </div>
                          </div>
                          {/* WordPress quick-edit button — visible on hover */}
                          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={wpEditUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                              Update Content in WordPress
                            </a>
                            <span className="text-[10px] text-muted-foreground italic">Refresh this page to boost rankings</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Striking Distance */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Striking Distance Keywords
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Positions 11–20 with &gt;50 impressions — your fastest wins
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {strikingQuery.isLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-8" />
                    ))}
                  </div>
                ) : striking.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No striking-distance keywords found. This means you're either ranking in the top 10 already, or not
                    yet getting impressions in positions 11–20.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {striking.map((row, i) => (
                      <div key={i} className="px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                            <span className="text-sm text-foreground truncate">{row.query}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="w-3 h-3" />
                              {row.impressions >= 1000 ? `${(row.impressions / 1000).toFixed(1)}K` : row.impressions}
                            </span>
                            {/* DataForSEO monthly search volume badge */}
                            {volumeMap[row.query] != null && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0 border-blue-500/40 text-blue-600 dark:text-blue-400"
                                title="Monthly search volume (DataForSEO)"
                              >
                                {volumeMap[row.query]! >= 1000
                                  ? `${(volumeMap[row.query]! / 1000).toFixed(1)}K/mo`
                                  : `${volumeMap[row.query]}/mo`}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400"
                            >
                              #{row.position.toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                        {/* Content-created badges */}
                        <div className="flex items-center gap-1.5 mt-1">
                          {isTracked(row.query, "video") && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/15 text-primary border border-primary/25">
                              <Video className="w-2.5 h-2.5" /> Video made
                            </span>
                          )}
                          {isTracked(row.query, "blog") && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                              <PenSquare className="w-2.5 h-2.5" /> Blog made
                            </span>
                          )}
                        </div>
                        {/* Create content buttons — visible on hover */}
                        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                            onClick={() => {
                              const encoded = encodeURIComponent(row.query);
                              trackKeyword.mutate({ keyword: row.query, contentType: "video" });
                              setLocation(`/video-production?keyword=${encoded}`);
                              toast.info(`Opening Video Production with keyword: "${row.query}"`);
                            }}
                          >
                            <Video className="w-3 h-3" />
                            Video Script
                          </button>
                          <button
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                            onClick={() => {
                              const encoded = encodeURIComponent(row.query);
                              trackKeyword.mutate({ keyword: row.query, contentType: "blog" });
                              setLocation(`/studio?keyword=${encoded}&platform=blog`);
                              toast.info(`Opening Blog Generator with keyword: "${row.query}"`);
                            }}
                          >
                            <PenSquare className="w-3 h-3" />
                            Blog Post
                          </button>
                          <span className="text-[10px] text-muted-foreground ml-1 italic">Create content targeting this keyword</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        {/* ─── Content Flywheel Panel ─────────────────────────────────────────── */}
        {statusQuery.data?.connected && (
          <ContentFlywheelPanel setLocation={setLocation} />
        )}
        </>
      )}
    </div>
    </DashboardLayout>
  );
}

// ─── Content Flywheel Component ──────────────────────────────────────────────
type MovingPost = {
  url: string;
  title: string;
  focusKeyword: string | null;
  currentPosition: number;
  previousPosition: number;
  positionDelta: number;
  direction: "up" | "down" | "new";
  currentClicks: number;
  currentImpressions: number;
  signal: "rising_star" | "slipping" | "breakthrough" | "needs_refresh";
  recommendation: string;
  contentItemId: number | null;
};

function ContentFlywheelPanel({ setLocation }: { setLocation: (path: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, any>>({});
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);

  const movingQuery = trpc.gsc.getMovingPosts.useQuery({ minMovement: 3 }, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const suggestMutation = trpc.gsc.suggestFollowUp.useMutation({
    onSuccess: (data, variables) => {
      setSuggestions(prev => ({ ...prev, [variables.url]: data }));
      setLoadingSuggestion(null);
    },
    onError: () => {
      setLoadingSuggestion(null);
      toast.error("Failed to generate suggestion");
    },
  });

  const handleSuggest = (post: MovingPost) => {
    setLoadingSuggestion(post.url);
    setExpandedId(post.url);
    suggestMutation.mutate({
      url: post.url,
      title: post.title,
      focusKeyword: post.focusKeyword,
      signal: post.signal,
      currentPosition: post.currentPosition,
      positionDelta: post.positionDelta,
      contentType: "both",
    });
  };

  const signalConfig = {
    breakthrough: { label: "Breakthrough", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25", icon: <Flame className="w-3 h-3" /> },
    rising_star: { label: "Rising Star", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25", icon: <Star className="w-3 h-3" /> },
    slipping: { label: "Slipping", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25", icon: <TrendingDown className="w-3 h-3" /> },
    needs_refresh: { label: "Needs Refresh", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25", icon: <RefreshCw className="w-3 h-3" /> },
  };

  const posts: MovingPost[] = movingQuery.data?.posts ?? [];
  const hasHistoricalData = movingQuery.data?.hasHistoricalData ?? false;

  return (
    <Card className="mt-6 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Repeat2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Content Flywheel</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Posts moving in Google rankings — act on momentum signals</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => movingQuery.refetch()}
            disabled={movingQuery.isFetching}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${movingQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {movingQuery.isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : movingQuery.error ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Connect Google Search Console to enable the Content Flywheel.
          </div>
        ) : !hasHistoricalData ? (
          <div className="text-sm text-muted-foreground text-center py-6 space-y-2">
            <Repeat2 className="w-8 h-8 mx-auto opacity-30" />
            <p className="font-medium">Building your position history...</p>
            <p className="text-xs max-w-sm mx-auto">The flywheel needs 14+ days of GSC position snapshots to detect movement. Check back in 2 weeks. Position data is recorded automatically each time you visit the SEO Dashboard.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No significant ranking movements detected in the last 28 days.</p>
            <p className="text-xs mt-1">Posts need to move 3+ positions to appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {posts.length} post{posts.length !== 1 ? "s" : ""} with significant ranking movement — analyzed {movingQuery.data?.totalAnalyzed ?? 0} pages
            </p>
            {posts.map((post) => {
              const cfg = signalConfig[post.signal];
              const isExpanded = expandedId === post.url;
              const suggestion = suggestions[post.url];
              const isLoadingThis = loadingSuggestion === post.url;

              return (
                <div key={post.url} className="border border-border rounded-lg overflow-hidden">
                  {/* Post row */}
                  <div className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className="text-sm font-medium truncate max-w-xs">{post.title}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {post.direction === "up" ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                          ) : post.direction === "down" ? (
                            <ArrowDownRight className="w-3 h-3 text-orange-500" />
                          ) : (
                            <Star className="w-3 h-3 text-blue-500" />
                          )}
                          Pos {post.currentPosition}
                          {post.previousPosition > 0 && (
                            <span className={post.direction === "up" ? "text-emerald-500" : "text-orange-500"}>
                              {post.direction === "up" ? " ▲" : " ▼"}{Math.abs(post.positionDelta).toFixed(0)}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{post.currentClicks} clicks</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.currentImpressions.toLocaleString()} impr.</span>
                        {post.focusKeyword && (
                          <span className="flex items-center gap-1"><Target className="w-3 h-3" />{post.focusKeyword}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{post.recommendation}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => handleSuggest(post)}
                        disabled={isLoadingThis}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        {isLoadingThis ? "Thinking..." : "AI Brief"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          const encoded = encodeURIComponent(post.focusKeyword ?? post.title);
                          setLocation(`/studio?keyword=${encoded}&platform=blog`);
                        }}
                      >
                        <PenSquare className="w-3 h-3 mr-1" /> Blog
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          const encoded = encodeURIComponent(post.focusKeyword ?? post.title);
                          setLocation(`/video-production?keyword=${encoded}`);
                        }}
                      >
                        <Video className="w-3 h-3 mr-1" /> Video
                      </Button>
                    </div>
                  </div>

                  {/* AI Suggestion Panel */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-3">
                      {isLoadingThis ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      ) : suggestion ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Blog Idea */}
                          {suggestion.blogIdea && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <PenSquare className="w-3 h-3" /> Blog Follow-Up
                              </div>
                              <p className="font-medium">{suggestion.blogIdea.title}</p>
                              <p className="text-muted-foreground">Keyword: <span className="text-foreground">{suggestion.blogIdea.focusKeyword}</span></p>
                              <p className="text-muted-foreground leading-relaxed">{suggestion.blogIdea.angle}</p>
                              {suggestion.blogIdea.outline?.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {suggestion.blogIdea.outline.map((h: string, i: number) => (
                                    <div key={i} className="text-muted-foreground">• {h}</div>
                                  ))}
                                </div>
                              )}
                              <Button
                                size="sm"
                                className="mt-2 h-6 text-[10px] px-2"
                                onClick={() => {
                                  const encoded = encodeURIComponent(suggestion.blogIdea.focusKeyword ?? "");
                                  setLocation(`/studio?keyword=${encoded}&platform=blog`);
                                }}
                              >
                                <PenSquare className="w-2.5 h-2.5 mr-1" /> Generate This Blog
                              </Button>
                            </div>
                          )}
                          {/* Video Idea */}
                          {suggestion.videoIdea && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 font-semibold text-primary">
                                <Video className="w-3 h-3" /> Video Follow-Up
                              </div>
                              <p className="font-medium">{suggestion.videoIdea.title}</p>
                              <p className="text-muted-foreground">Platform: <span className="text-foreground">{suggestion.videoIdea.platform}</span></p>
                              <p className="text-muted-foreground italic leading-relaxed">"{suggestion.videoIdea.hook}"</p>
                              <p className="text-muted-foreground">CTA: {suggestion.videoIdea.cta}</p>
                              <Button
                                size="sm"
                                className="mt-2 h-6 text-[10px] px-2"
                                onClick={() => {
                                  const encoded = encodeURIComponent(suggestion.videoIdea.title ?? "");
                                  setLocation(`/video-production?keyword=${encoded}`);
                                }}
                              >
                                <Video className="w-2.5 h-2.5 mr-1" /> Create Video Script
                              </Button>
                            </div>
                          )}
                          {/* Reasoning */}
                          {suggestion.reasoning && (
                            <div className="md:col-span-2 text-muted-foreground border-t border-border pt-2 mt-1">
                              <span className="font-medium text-foreground">Why this works: </span>{suggestion.reasoning}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
