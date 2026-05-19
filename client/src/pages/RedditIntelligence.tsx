import { useState } from "react";
import type { RedditSubreddit, RedditPost } from "../../../drizzle/schema";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RefreshCw,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  X,
  ExternalLink,
  MessageSquare,
  ArrowUp,
  Brain,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All Topics" },
  { value: "meditation", label: "Meditation" },
  { value: "biohacking", label: "Biohacking" },
  { value: "supplements", label: "Supplements" },
  { value: "movement", label: "Movement / Yoga" },
  { value: "recovery", label: "Sleep & Recovery" },
  { value: "stress", label: "Stress & Anxiety" },
  { value: "productivity", label: "Productivity" },
  { value: "nutrition", label: "Nutrition" },
  { value: "tcm", label: "TCM / Qigong" },
  { value: "general", label: "General" },
];

function scoreColor(score: number | null) {
  if (!score) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-green-100 text-green-800 border-green-200";
  if (score >= 6) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-muted text-muted-foreground";
}

function scoreLabel(score: number | null) {
  if (!score) return "Unscored";
  if (score >= 8) return "High Value";
  if (score >= 6) return "Good Fit";
  if (score >= 4) return "Moderate";
  return "Low";
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onRefresh,
}: {
  post: {
    id: number;
    redditId: string;
    subreddit: string;
    category: string;
    title: string;
    selftext: string | null;
    score: number;
    numComments: number;
    permalink: string;
    engagementScore: number | null;
    aiSummary: string | null;
    aiRecommendation: string | null;
    aiDraftComment: string | null;
    isAnalyzed: boolean;
    isFlagged: boolean;
    isDismissed: boolean;
    createdUtc: number | null;
  };
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText] = useState(post.aiDraftComment ?? "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [copied, setCopied] = useState(false);

  const analyzeMutation = trpc.reddit.analyzePost.useMutation({
    onSuccess: () => { toast.success("Analysis complete"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const flagMutation = trpc.reddit.flagPost.useMutation({
    onSuccess: () => onRefresh(),
  });
  const dismissMutation = trpc.reddit.dismissPost.useMutation({
    onSuccess: () => onRefresh(),
  });
  const regenerateMutation = trpc.reddit.regenerateDraft.useMutation({
    onSuccess: (data) => {
      setDraftText(data.draft);
      toast.success("Draft regenerated");
    },
    onError: (e) => toast.error(e.message),
  });

  const copyDraft = () => {
    navigator.clipboard.writeText(draftText || post.aiDraftComment || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timeAgo = post.createdUtc
    ? (() => {
        const diff = Date.now() / 1000 - post.createdUtc;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
      })()
    : "";

  return (
    <Card
      className={`border transition-all ${
        post.isFlagged ? "border-amber-300 bg-amber-50/30" : "border-border"
      }`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-[10px] font-mono">
                r/{post.subreddit}
              </Badge>
              {post.isAnalyzed && post.engagementScore !== null && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${scoreColor(post.engagementScore)}`}
                >
                  {post.engagementScore}/10 · {scoreLabel(post.engagementScore)}
                </Badge>
              )}
              {post.isFlagged && (
                <Badge className="text-[10px] bg-amber-500 text-white">
                  Flagged for Engagement
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                {timeAgo}
              </span>
            </div>
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm leading-snug hover:text-primary transition-colors line-clamp-2"
            >
              {post.title}
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            {post.score.toLocaleString()} pts
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {post.numComments.toLocaleString()} comments
          </span>
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-primary ml-auto"
          >
            <ExternalLink className="w-3 h-3" />
            Open thread
          </a>
        </div>

        {/* AI summary (if analyzed) */}
        {post.isAnalyzed && post.aiSummary && (
          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Thread summary: </span>
            {post.aiSummary}
          </div>
        )}

        {/* Expand/collapse for full AI analysis */}
        {post.isAnalyzed && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> Hide engagement details
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Show engagement details
              </>
            )}
          </button>
        )}

        {expanded && post.isAnalyzed && (
          <div className="space-y-3 pt-1">
            {post.aiRecommendation && (
              <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
                <p className="text-[11px] font-semibold text-primary mb-1 uppercase tracking-wide">
                  Your Angle
                </p>
                <p className="text-xs text-foreground">{post.aiRecommendation}</p>
              </div>
            )}

            {/* Draft comment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Draft Comment
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setEditingDraft(!editingDraft)}
                  >
                    {editingDraft ? "Done" : "Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2"
                    onClick={copyDraft}
                  >
                    {copied ? (
                      <CheckCheck className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {editingDraft ? (
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="text-xs min-h-[100px]"
                />
              ) : (
                <div className="bg-muted/40 rounded-md p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {draftText || post.aiDraftComment}
                </div>
              )}

              {/* Regenerate with custom instructions */}
              <div className="flex gap-2">
                <Input
                  placeholder="Custom instructions (optional)..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="text-xs h-7 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-3 gap-1"
                  disabled={regenerateMutation.isPending}
                  onClick={() =>
                    regenerateMutation.mutate({
                      postId: post.id,
                      customInstructions: customInstructions || undefined,
                    })
                  }
                >
                  <RefreshCw
                    className={`w-3 h-3 ${regenerateMutation.isPending ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          {!post.isAnalyzed ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] gap-1"
              disabled={analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate({ postId: post.id })}
            >
              <Brain
                className={`w-3 h-3 ${analyzeMutation.isPending ? "animate-pulse" : ""}`}
              />
              {analyzeMutation.isPending ? "Analyzing…" : "Analyze"}
            </Button>
          ) : null}

          <Button
            size="sm"
            variant={post.isFlagged ? "default" : "outline"}
            className={`h-7 text-[10px] gap-1 ${
              post.isFlagged
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                : ""
            }`}
            onClick={() =>
              flagMutation.mutate({ postId: post.id, isFlagged: !post.isFlagged })
            }
          >
            {post.isFlagged ? (
              <BookmarkCheck className="w-3 h-3" />
            ) : (
              <Bookmark className="w-3 h-3" />
            )}
            {post.isFlagged ? "Flagged" : "Flag"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-destructive ml-auto"
            onClick={() => dismissMutation.mutate({ postId: post.id })}
          >
            <X className="w-3 h-3" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Subreddit Manager ────────────────────────────────────────────────────────

function SubredditManager() {
  const [newSub, setNewSub] = useState("");
  const [newCat, setNewCat] = useState("general");

  const { data: subs, refetch } = trpc.reddit.listSubreddits.useQuery();
  const addMutation = trpc.reddit.addSubreddit.useMutation({
    onSuccess: () => { setNewSub(""); refetch(); toast.success("Subreddit added"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = trpc.reddit.toggleSubreddit.useMutation({
    onSuccess: () => refetch(),
  });
  const removeMutation = trpc.reddit.removeSubreddit.useMutation({
    onSuccess: () => { refetch(); toast.success("Removed"); },
  });
  const seedMutation = trpc.reddit.seedDefaults.useMutation({
    onSuccess: (d) => {
      refetch();
      if (d.seeded > 0) toast.success(`Seeded ${d.seeded} default subreddits`);
      else toast.info("Defaults already loaded");
    },
  });

  const grouped = (subs ?? []).reduce(
    (acc: Record<string, RedditSubreddit[]>, s: RedditSubreddit) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    },
    {} as Record<string, RedditSubreddit[]>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="subreddit name (no r/)"
          value={newSub}
          onChange={(e) => setNewSub(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSub.trim())
              addMutation.mutate({ subreddit: newSub.trim(), category: newCat });
          }}
        />
        <Select value={newCat} onValueChange={setNewCat}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() =>
            newSub.trim() &&
            addMutation.mutate({ subreddit: newSub.trim(), category: newCat })
          }
          disabled={!newSub.trim() || addMutation.isPending}
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
        {(!subs || subs.length === 0) && (
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            Load Defaults
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, catSubs]) => (
          <div key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(catSubs ?? []).map((s: RedditSubreddit) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    s.isActive
                      ? "bg-background border-border"
                      : "bg-muted/30 border-border/50 opacity-60"
                  }`}
                >
                  <span className="font-mono text-xs truncate">r/{s.subreddit}</span>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: s.id, isActive: !s.isActive })
                      }
                      className="text-muted-foreground hover:text-primary"
                    >
                      {s.isActive ? (
                        <ToggleRight className="w-4 h-4 text-primary" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => removeMutation.mutate({ id: s.id })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {(!subs || subs.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No subreddits tracked yet. Add one above or load the defaults.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RedditIntelligence() {
  const [activeTab, setActiveTab] = useState("feed");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [onlyHighValue, setOnlyHighValue] = useState(false);

  const { data: stats, refetch: refetchStats } = trpc.reddit.getStats.useQuery();
  const {
    data: posts,
    isLoading,
    refetch: refetchFeed,
  } = trpc.reddit.getFeed.useQuery({
    category: categoryFilter === "all" ? undefined : categoryFilter,
    onlyFlagged: onlyFlagged || undefined,
    minScore: onlyHighValue ? 50 : undefined,
    limit: 60,
  });

  const refreshMutation = trpc.reddit.refreshFeed.useMutation({
    onSuccess: (d) => {
      toast.success(
        `Refreshed ${d.subredditsScanned} subreddits — ${d.totalNew} new threads found`
      );
      refetchFeed();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const debugFetchMutation = trpc.reddit.debugFetch.useMutation({
    onSuccess: (d) => {
      const summary = d.results.map((r) => `${r.method}: ${r.status} (${r.postCount} posts)${r.error ? ` — ${r.error}` : ""}`).join("\n");
      toast.success(`Debug results for r/${d.subreddit}:\n${summary}`, { duration: 15000 });
      console.log("[Reddit Debug]", d);
    },
    onError: (e) => toast.error(`Debug failed: ${e.message}`),
  });

  const { data: latestDigest, refetch: refetchDigest } = trpc.reddit.getLatestDigest.useQuery();
  const { data: allDigests } = trpc.reddit.getDigests.useQuery();

  const generateDigestMutation = trpc.reddit.generateTrendDigest.useMutation({
    onSuccess: (d) => {
      toast.success(`Trend digest generated for week of ${d.weekStart} — ${d.postsAnalyzed} posts analyzed across ${d.subredditsScanned} subreddits`);
      refetchDigest();
    },
    onError: (e) => toast.error(`Digest failed: ${e.message}`),
  });

  const batchAnalyzeMutation = trpc.reddit.batchAnalyze.useMutation({
    onSuccess: (d) => {
      toast.success(`Analyzed ${d.analyzed} posts`);
      refetchFeed();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleRefresh = () => {
    refetchFeed();
    refetchStats();
  };

  // Sort: flagged first, then by engagement score, then by reddit score
  const sortedPosts = [...(posts ?? [])].sort((a: RedditPost, b: RedditPost) => {
    if (a.isFlagged && !b.isFlagged) return -1;
    if (!a.isFlagged && b.isFlagged) return 1;
    const aScore = a.engagementScore ?? 0;
    const bScore = b.engagementScore ?? 0;
    if (bScore !== aScore) return bScore - aScore;
    return b.score - a.score;
  });

  const unanalyzedCount = (posts ?? []).filter((p: RedditPost) => !p.isAnalyzed).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reddit Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover trending conversations where Dr. Shojai's expertise can add real value.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={refreshMutation.isPending}
            onClick={() =>
              refreshMutation.mutate({
                category: categoryFilter === "all" ? undefined : categoryFilter,
              })
            }
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
            {refreshMutation.isPending ? "Fetching…" : "Refresh Feed"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs opacity-60 hover:opacity-100"
            disabled={debugFetchMutation.isPending}
            onClick={() => debugFetchMutation.mutate({ subreddit: "ibs" })}
            title="Test Reddit fetch from server — check browser console for full results"
          >
            {debugFetchMutation.isPending ? "Testing…" : "Debug Fetch"}
          </Button>
          {unanalyzedCount > 0 && (
            <Button
              size="sm"
              className="gap-1"
              disabled={batchAnalyzeMutation.isPending}
              onClick={() => batchAnalyzeMutation.mutate({ limit: 10 })}
            >
              <Sparkles
                className={`w-4 h-4 ${batchAnalyzeMutation.isPending ? "animate-pulse" : ""}`}
              />
              {batchAnalyzeMutation.isPending
                ? "Analyzing…"
                : `Analyze Top ${Math.min(10, unanalyzedCount)}`}
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Threads", value: stats.total, icon: <MessageSquare className="w-4 h-4" /> },
            { label: "Analyzed", value: stats.analyzed, icon: <Brain className="w-4 h-4" /> },
            { label: "High Value (7+)", value: stats.highValue, icon: <Zap className="w-4 h-4 text-amber-500" /> },
            { label: "Flagged", value: stats.flagged, icon: <Bookmark className="w-4 h-4 text-amber-500" /> },
          ].map((s) => (
            <Card key={s.label} className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="text-muted-foreground">{s.icon}</div>
                <div>
                  <p className="text-xl font-bold leading-none">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="feed">Thread Feed</TabsTrigger>
          <TabsTrigger value="flagged">
            Flagged
            {stats?.flagged ? (
              <Badge className="ml-1.5 h-4 text-[10px] bg-amber-500 text-white">
                {stats.flagged}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="subreddits">Manage Subreddits</TabsTrigger>
          <TabsTrigger value="digest" className="gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Trend Digest
          </TabsTrigger>
        </TabsList>

        {/* ── Feed tab ── */}
        <TabsContent value="feed" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant={onlyHighValue ? "default" : "outline"}
              className="h-8 text-xs gap-1"
              onClick={() => setOnlyHighValue(!onlyHighValue)}
            >
              <Zap className="w-3 h-3" />
              High engagement only
            </Button>

            <span className="text-xs text-muted-foreground ml-auto">
              {sortedPosts.length} threads
              {unanalyzedCount > 0 && ` · ${unanalyzedCount} unanalyzed`}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sortedPosts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No threads yet</p>
              <p className="text-sm mt-1">
                Click "Refresh Feed" to pull the latest hot threads from your tracked
                subreddits.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedPosts.map((post) => (
                <PostCard key={post.id} post={post} onRefresh={handleRefresh} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Flagged tab ── */}
        <TabsContent value="flagged" className="space-y-4 mt-4">
          {(posts ?? []).filter((p: RedditPost) => p.isFlagged).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No flagged threads</p>
              <p className="text-sm mt-1">
                Flag threads you want to engage with — they'll appear here for quick
                access.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {(posts ?? [])
                .filter((p: RedditPost) => p.isFlagged)
                .sort((a: RedditPost, b: RedditPost) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
                .map((post) => (
                  <PostCard key={post.id} post={post} onRefresh={handleRefresh} />
                ))}
            </div>
          )}
        </TabsContent>

        {/* ── Subreddits tab ── */}
        <TabsContent value="subreddits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracked Subreddits</CardTitle>
            </CardHeader>
            <CardContent>
              <SubredditManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trend Digest tab ── */}
        <TabsContent value="digest" className="mt-4 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Weekly Trend Digest</h2>
              <p className="text-sm text-muted-foreground">
                AI-generated briefing clustering the most-discussed topics across all your subreddits.
              </p>
            </div>
            <Button
              onClick={() => generateDigestMutation.mutate()}
              disabled={generateDigestMutation.isPending}
              className="gap-2"
            >
              <Sparkles className={`w-4 h-4 ${generateDigestMutation.isPending ? "animate-pulse" : ""}`} />
              {generateDigestMutation.isPending ? "Generating…" : "Generate This Week's Digest"}
            </Button>
          </div>

          {/* Latest digest */}
          {latestDigest ? (
            <div className="space-y-4">
              {/* Meta bar */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  Week of {latestDigest.weekStart}
                </Badge>
                <span>{latestDigest.postsAnalyzed} posts analyzed</span>
                <span>·</span>
                <span>{latestDigest.subredditsScanned} subreddits</span>
                <span>·</span>
                <span>Generated {new Date(latestDigest.generatedAt).toLocaleDateString()}</span>
              </div>

              {/* Top topics chips */}
              {Array.isArray(latestDigest.topTopics) && latestDigest.topTopics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(latestDigest.topTopics as { topic: string; count: number; subreddits: string[] }[]).map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm"
                    >
                      <span className="font-medium text-primary">{t.topic}</span>
                      <span className="text-muted-foreground text-xs">({t.count})</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Briefing */}
              <Card>
                <CardContent className="pt-5">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {latestDigest.briefing.split("\n").map((line, i) => {
                      if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(3)}</h2>;
                      if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
                      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
                      if (line.trim() === "") return <div key={i} className="h-2" />;
                      return <p key={i} className="text-sm leading-relaxed">{line}</p>;
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Previous digests */}
              {allDigests && allDigests.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Previous Digests</h3>
                  <div className="flex flex-wrap gap-2">
                    {allDigests.slice(1).map((d) => (
                      <Badge
                        key={d.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted text-xs"
                        title={`${d.postsAnalyzed} posts · ${d.subredditsScanned} subreddits`}
                      >
                        Week of {d.weekStart}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">No digest generated yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  First refresh your feed and analyze some posts, then click "Generate This Week's Digest" above.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
