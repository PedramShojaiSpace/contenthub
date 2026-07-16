import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart2,
  RefreshCw,
  MessageSquare,
  Lightbulb,
  ThumbsUp,
  Eye,
  Clock,
  Share2,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Send,
  Sparkles,
  CheckCircle,
  XCircle,
  BookOpen,
  Tag,
  ShoppingCart,
  DollarSign,
  Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "views" | "likes" | "comments" | "thumbnailCtr" | "avgViewPct" | "publishedAt";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

function fmtDuration(sec: number | null | undefined) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ctrColor(ctr: number | null | undefined) {
  if (ctr == null) return "text-muted-foreground";
  if (ctr >= 6) return "text-green-600 font-semibold";
  if (ctr >= 3) return "text-amber-600";
  return "text-red-500";
}

function retentionColor(pct: number | null | undefined) {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 50) return "text-green-600 font-semibold";
  if (pct >= 30) return "text-amber-600";
  return "text-red-500";
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data } = trpc.ytAnalytics.getChannelSummary.useQuery();

  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4 pb-4">
              <div className="h-4 bg-muted rounded w-20 mb-2" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Total Views", value: fmtNum(data.totalViews), icon: Eye, color: "text-blue-600" },
    { label: "Total Likes", value: fmtNum(data.totalLikes), icon: ThumbsUp, color: "text-rose-500" },
    { label: "Avg CTR", value: fmtPct(data.avgCtr), icon: TrendingUp, color: "text-green-600" },
    { label: "Avg Retention", value: fmtPct(data.avgRetention), icon: Clock, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              {s.label}
            </div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Video Analytics Table ────────────────────────────────────────────────────

function VideoTable() {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = trpc.ytAnalytics.listVideoSnapshots.useQuery({ limit: 50 });
  const fetchMutation = trpc.ytAnalytics.fetchVideoAnalytics.useMutation({
    onSuccess: (res) => {
      toast.success(`Refreshed ${res.upserted} videos`);
      refetch();
    },
    onError: (e) => toast.error(`Refresh failed: ${e.message}`),
  });

  const snapshots = data?.snapshots ?? [];

  const sorted = useMemo(() => {
    const filtered = snapshots.filter((v) =>
      v.title.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "publishedAt") {
        av = a.publishedAt ?? 0;
        bv = b.publishedAt ?? 0;
      } else {
        av = (a[sortKey] as number | null) ?? -1;
        bv = (b[sortKey] as number | null) ?? -1;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [snapshots, sortKey, sortDir, search]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "desc" ? (
      <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronUp className="w-3 h-3" />
    );
  }

  const colClass = "cursor-pointer select-none whitespace-nowrap flex items-center gap-1 hover:text-foreground";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <Input
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchMutation.mutate({ maxVideos: 25 })}
          disabled={fetchMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${fetchMutation.isPending ? "animate-spin" : ""}`} />
          Refresh from YouTube
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No video data yet</p>
          <p className="text-sm mt-1">Click "Refresh from YouTube" to pull your channel's analytics.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-12">Thumb</th>
                <th className="text-left px-3 py-2 font-medium min-w-[220px]">Title</th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className={colClass} onClick={() => toggleSort("views")}>
                    <Eye className="w-3 h-3" /> Views <SortIcon k="views" />
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className={colClass} onClick={() => toggleSort("likes")}>
                    <ThumbsUp className="w-3 h-3" /> Likes <SortIcon k="likes" />
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className={colClass} onClick={() => toggleSort("comments")}>
                    <MessageSquare className="w-3 h-3" /> Comments <SortIcon k="comments" />
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className={colClass} onClick={() => toggleSort("thumbnailCtr")}>
                    <TrendingUp className="w-3 h-3" /> CTR <SortIcon k="thumbnailCtr" />
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className={colClass} onClick={() => toggleSort("avgViewPct")}>
                    <Clock className="w-3 h-3" /> Retention <SortIcon k="avgViewPct" />
                  </span>
                </th>
                <th className="px-3 py-2 font-medium text-right">VidIQ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">
                    {v.thumbnailUrl ? (
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="w-12 h-8 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-8 bg-muted rounded" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`https://youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary line-clamp-2 font-medium"
                    >
                      {v.title}
                    </a>
                    {v.publishedAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(v.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(v.views)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(v.likes)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(v.comments)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${ctrColor(v.thumbnailCtr)}`}>
                    {fmtPct(v.thumbnailCtr)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${retentionColor(v.avgViewPct)}`}>
                    {fmtPct(v.avgViewPct)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.vidiqScore != null ? (
                      <Badge
                        variant="outline"
                        className={
                          v.vidiqScore >= 70
                            ? "border-green-500 text-green-600"
                            : v.vidiqScore >= 40
                            ? "border-amber-500 text-amber-600"
                            : "border-red-400 text-red-500"
                        }
                      >
                        {v.vidiqScore}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Comments Tab ─────────────────────────────────────────────────────────────

function CommentsTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read" | "replied" | "ignored">("unread");
  const [fetchFresh, setFetchFresh] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading, refetch } = trpc.ytAnalytics.listComments.useQuery({
    status: statusFilter,
    fetchFresh,
    limit: 50,
  });

  const suggestMutation = trpc.ytAnalytics.suggestReply.useMutation({
    onSuccess: (res) => {
      setReplyText(res.suggestion);
      toast.success("AI reply suggestion ready");
    },
    onError: (e) => toast.error(`Suggestion failed: ${e.message}`),
  });

  const postReplyMutation = trpc.ytAnalytics.postReply.useMutation({
    onSuccess: () => {
      toast.success("Reply posted to YouTube");
      setReplyingTo(null);
      setReplyText("");
      refetch();
    },
    onError: (e) => toast.error(`Reply failed: ${e.message}`),
  });

  const updateStatusMutation = trpc.ytAnalytics.updateCommentStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const comments = data?.comments ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFetchFresh(true);
            setTimeout(() => setFetchFresh(false), 100);
            refetch();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Fetch from YouTube
        </Button>
        <span className="text-sm text-muted-foreground">{comments.length} comments</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No comments found</p>
          <p className="text-sm mt-1">Click "Fetch from YouTube" to pull the latest comments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.id} className={c.replyStatus === "unread" ? "border-primary/30" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {c.authorProfileImageUrl ? (
                    <img
                      src={c.authorProfileImageUrl}
                      alt={c.authorName ?? ""}
                      className="w-9 h-9 rounded-full flex-shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">{c.authorName ?? "Anonymous"}</span>
                      {c.videoTitle && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          on: {c.videoTitle}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          c.replyStatus === "replied"
                            ? "border-green-500 text-green-600"
                            : c.replyStatus === "unread"
                            ? "border-primary text-primary"
                            : ""
                        }
                      >
                        {c.replyStatus}
                      </Badge>
                      {c.likeCount != null && c.likeCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" /> {c.likeCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{c.text}</p>

                    {/* Reply section */}
                    {replyingTo === c.commentId ? (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write your reply..."
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() =>
                              postReplyMutation.mutate({
                                commentId: c.commentId,
                                replyText,
                              })
                            }
                            disabled={!replyText.trim() || postReplyMutation.isPending}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Post Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              suggestMutation.mutate({
                                commentId: c.commentId,
                                commentText: c.text,
                                videoTitle: c.videoTitle ?? undefined,
                              })
                            }
                            disabled={suggestMutation.isPending}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            {suggestMutation.isPending ? "Generating..." : "AI Suggest"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                        {c.aiSuggestedReply && replyText === "" && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            <span className="font-medium">Last AI suggestion:</span> {c.aiSuggestedReply}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {c.replyStatus !== "replied" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReplyingTo(c.commentId);
                              setReplyText(c.aiSuggestedReply ?? "");
                            }}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                        )}
                        {c.replyStatus === "unread" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                commentId: c.commentId,
                                status: "read",
                              })
                            }
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Mark Read
                          </Button>
                        )}
                        {c.replyStatus !== "ignored" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                commentId: c.commentId,
                                status: "ignored",
                              })
                            }
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Ignore
                          </Button>
                        )}
                        {c.replyStatus === "replied" && c.replyText && (
                          <span className="text-xs text-muted-foreground italic">
                            Replied: {c.replyText.slice(0, 80)}...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Headline Generator ───────────────────────────────────────────────────────

const CTR_TIER_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low: "bg-red-100 text-red-800 border-red-300",
};

function HeadlineGenerator() {
  const [topic, setTopic] = useState("");
  const [pillar, setPillar] = useState<string>("general");
  const [result, setResult] = useState<{
    headlines: Array<{ title: string; hook: string; rationale: string; estimatedCtrTier: string }>;
    topic: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: history } = trpc.ytAnalytics.listHeadlineGenerations.useQuery({ limit: 10 });

  const generateMutation = trpc.ytAnalytics.generateHeadlines.useMutation({
    onSuccess: (res) => {
      setResult(res);
      toast.success("5 headline variants generated");
    },
    onError: (e) => toast.error(`Generation failed: ${e.message}`),
  });

  const selectMutation = trpc.ytAnalytics.selectHeadline.useMutation({
    onSuccess: () => toast.success("Headline selected"),
  });

  function copyTitle(title: string) {
    navigator.clipboard.writeText(title);
    setCopied(title);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Generator panel */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Generate 5 Title Variants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Video Topic</label>
              <Input
                placeholder="e.g. Why you're exhausted despite 8 hours of sleep"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Content Pillar</label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Wellness</SelectItem>
                  <SelectItem value="gut_health_metabolism">Gut Health & Metabolism</SelectItem>
                  <SelectItem value="nervous_system_stress">Nervous System & Stress</SelectItem>
                  <SelectItem value="consciousness_longevity">Consciousness & Longevity</SelectItem>
                  <SelectItem value="oral_health">Oral Health</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() =>
                generateMutation.mutate({
                  topic,
                  pillar: pillar as any,
                })
              }
              disabled={!topic.trim() || generateMutation.isPending}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? "Generating..." : "Generate Headlines"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Headlines for: {result.topic}
            </h3>
            {result.headlines.map((h, i) => (
              <Card key={i} className="hover:border-primary/40 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${CTR_TIER_COLORS[h.estimatedCtrTier] ?? ""}`}
                        >
                          {h.estimatedCtrTier.toUpperCase()} CTR
                        </Badge>
                      </div>
                      <p className="font-semibold text-foreground mb-1">{h.title}</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        <span className="font-medium">Why it works:</span> {h.hook}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Formula:</span> {h.rationale}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyTitle(h.title)}
                      >
                        {copied === h.title ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          "Copy"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* History panel */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Recent Generations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!history?.generations.length ? (
              <p className="text-sm text-muted-foreground">No generations yet.</p>
            ) : (
              <div className="space-y-3">
                {history.generations.map((g) => (
                  <div
                    key={g.id}
                    className="border-b border-border pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/30 rounded p-2 -mx-2 transition-colors"
                    onClick={() =>
                      setResult({
                        headlines: (g.headlines as any) ?? [],
                        topic: g.topic,
                      })
                    }
                  >
                    <p className="text-sm font-medium line-clamp-2">{g.topic}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(g.createdAt).toLocaleDateString()} ·{" "}
                      {(g.headlines as any[])?.length ?? 0} variants
                    </p>
                    {g.selectedTitle && (
                      <p className="text-xs text-green-600 mt-0.5 truncate">
                        ✓ {g.selectedTitle}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Kajabi Attribution Panel ────────────────────────────────────────────────

function KajabiAttributionPanel() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: tags, isLoading: tagsLoading } = trpc.attributionPanel.getKajabiTagSummary.useQuery();
  const { data: contacts, isLoading: contactsLoading } = trpc.attributionPanel.getKajabiContactsByTag.useQuery(
    { tagName: selectedTag ?? "" },
    { enabled: !!selectedTag }
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tag list */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-500" />
              Kajabi Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <p className="text-sm text-muted-foreground">Loading tags...</p>
            ) : !tags?.length ? (
              <p className="text-sm text-muted-foreground">No tags found in Kajabi.</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTag(t.name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                      selectedTag === t.name
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    <Badge variant="outline" className="ml-2 flex-shrink-0 text-xs">
                      {t.contactCount.toLocaleString()}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact list */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              {selectedTag ? `Contacts: ${selectedTag}` : "Select a tag to view contacts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTag ? (
              <p className="text-sm text-muted-foreground">Click a tag on the left to see its subscribers.</p>
            ) : contactsLoading ? (
              <p className="text-sm text-muted-foreground">Loading contacts...</p>
            ) : !contacts?.length ? (
              <p className="text-sm text-muted-foreground">No contacts found for this tag.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">{c.email}</td>
                        <td className="px-3 py-2">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-2">{contacts.length} contacts shown (max 200)</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Shopify Attribution Panel ────────────────────────────────────────────────

function ShopifyAttributionPanel() {
  const [daysBack, setDaysBack] = useState(90);
  const [view, setView] = useState<"source" | "campaign">("campaign");

  const { data: summary, isLoading: summaryLoading } = trpc.attributionPanel.getShopifyRevenueSummary.useQuery({ daysBack });
  const { data: bySource, isLoading: sourceLoading } = trpc.attributionPanel.getShopifyRevenueBySource.useQuery(
    { daysBack },
    { enabled: view === "source" }
  );
  const { data: byCampaign, isLoading: campaignLoading } = trpc.attributionPanel.getShopifyRevenueByCampaign.useQuery(
    { daysBack },
    { enabled: view === "campaign" }
  );

  const rows = view === "source" ? (bySource ?? []) : (byCampaign ?? []);
  const isLoading = view === "source" ? sourceLoading : campaignLoading;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 180 days</SelectItem>
            <SelectItem value="365">Last 365 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={view} onValueChange={(v) => setView(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="campaign">By Campaign</SelectItem>
            <SelectItem value="source">By Source</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="pt-4 pb-4"><div className="h-8 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="w-4 h-4 text-green-600" /> Total Revenue
              </div>
              <div className="text-2xl font-bold">${summary.totalRevenueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Last {summary.daysBack} days</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShoppingCart className="w-4 h-4 text-blue-600" /> Total Orders
              </div>
              <div className="text-2xl font-bold">{summary.totalOrders.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="w-4 h-4 text-amber-600" /> Avg Order Value
              </div>
              <div className="text-2xl font-bold">${summary.aovUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Breakdown table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading revenue data...</div>
      ) : !rows.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders found for this period</p>
          <p className="text-sm mt-1">Shopify orders with UTM data will appear here once they exist.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">{view === "campaign" ? "Campaign" : "Source"}</th>
                {view === "campaign" && <th className="text-left px-3 py-2 font-medium">Source</th>}
                <th className="text-right px-3 py-2 font-medium">Orders</th>
                <th className="text-right px-3 py-2 font-medium">Revenue</th>
                <th className="text-right px-3 py-2 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const totalRev = rows.reduce((s, x) => s + x.revenueUsd, 0);
                const pct = totalRev > 0 ? (r.revenueUsd / totalRev) * 100 : 0;
                return (
                  <tr key={i} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{view === "campaign" ? (r as any).campaign : (r as any).source}</td>
                    {view === "campaign" && <td className="px-3 py-2 text-muted-foreground text-xs">{(r as any).source || "—"}</td>}
                    <td className="px-3 py-2 text-right font-mono">{r.orders}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">${r.revenueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function YouTubeAnalytics() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" />
          YouTube Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Video performance, audience comments, and title optimization — all in one place.
        </p>
      </div>

      <SummaryCards />

      <Tabs defaultValue="videos">
        <TabsList className="mb-4">
          <TabsTrigger value="videos" className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" /> Video Performance
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Comments
          </TabsTrigger>
          <TabsTrigger value="headlines" className="flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" /> Headline Generator
          </TabsTrigger>
          <TabsTrigger value="kajabi" className="flex items-center gap-1.5">
            <Tag className="w-4 h-4" /> Email Attribution
          </TabsTrigger>
          <TabsTrigger value="shopify" className="flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Revenue Attribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          <VideoTable />
        </TabsContent>
        <TabsContent value="comments">
          <CommentsTab />
        </TabsContent>
        <TabsContent value="headlines">
          <HeadlineGenerator />
        </TabsContent>
        <TabsContent value="kajabi">
          <KajabiAttributionPanel />
        </TabsContent>
        <TabsContent value="shopify">
          <ShopifyAttributionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
