/**
 * LinkedInNewsfeed.tsx — Doovo replacement.
 *
 * Discovers articles from Google News RSS + PubMed, generates Pedram-voice
 * LinkedIn commentary, and lets the team approve posts directly into the
 * Command Center LinkedIn Kanban column.
 *
 * Layout: 3-column card grid (pending) + sidebar tabs for approved/dismissed.
 *
 * v132 additions:
 *   - "Push to Buffer" button on approved article cards
 *   - bufferSentAt timestamp tracked per article
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import {
  RefreshCw,
  ThumbsUp,
  X,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  Newspaper,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

// ─── Topic colour map ──────────────────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  integrative_medicine: "bg-emerald-100 text-emerald-800 border-emerald-200",
  longevity: "bg-violet-100 text-violet-800 border-violet-200",
  gut_health: "bg-amber-100 text-amber-800 border-amber-200",
  sleep_science: "bg-blue-100 text-blue-800 border-blue-200",
  mental_health: "bg-rose-100 text-rose-800 border-rose-200",
  cardiometabolic: "bg-red-100 text-red-800 border-red-200",
};

const TOPIC_LABELS: Record<string, string> = {
  integrative_medicine: "Integrative Medicine",
  longevity: "Longevity",
  gut_health: "Gut Health",
  sleep_science: "Sleep Science",
  mental_health: "Mental Health",
  cardiometabolic: "Cardiometabolic",
};

// ─── Article type ──────────────────────────────────────────────────────────────

interface Article {
  id: number;
  title: string;
  source: string | null;
  url: string;
  imageUrl: string | null;
  description: string | null;
  commentary: string | null;
  topic: string | null;
  status: "pending" | "approved" | "dismissed";
  fetchedAt: Date;
  approvedAt: Date | null;
  contentItemId: number | null;
  bufferSentAt: Date | null;
}

// ─── Pending article card ──────────────────────────────────────────────────────

function ArticleCard({
  article,
  onApprove,
  onDismiss,
  onRegenerate,
  onOpenDetail,
}: {
  article: Article;
  onApprove: (id: number) => void;
  onDismiss: (id: number) => void;
  onRegenerate: (id: number) => void;
  onOpenDetail: (article: Article) => void;
}) {
  const topicKey = article.topic ?? "";
  const topicColor = TOPIC_COLORS[topicKey] ?? "bg-slate-100 text-slate-700 border-slate-200";
  const topicLabel = TOPIC_LABELS[topicKey] ?? topicKey;

  const commentaryPreview = article.commentary
    ? article.commentary.slice(0, 220) + (article.commentary.length > 220 ? "…" : "")
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      {/* Card header */}
      <div className="p-4 pb-2 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="outline" className={`text-xs font-medium shrink-0 ${topicColor}`}>
            {topicLabel}
          </Badge>
          <Badge variant="outline" className="text-xs text-slate-500 shrink-0">
            {article.source ?? "Unknown"}
          </Badge>
        </div>

        {/* Title */}
        <h3
          className="font-semibold text-slate-900 text-sm leading-snug mb-2 cursor-pointer hover:text-blue-700 line-clamp-3"
          onClick={() => onOpenDetail(article)}
        >
          {article.title}
        </h3>

        {/* Commentary preview */}
        {commentaryPreview ? (
          <p
            className="text-xs text-slate-600 leading-relaxed cursor-pointer"
            onClick={() => onOpenDetail(article)}
          >
            {commentaryPreview}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">No commentary yet</p>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3 pt-2 border-t border-slate-100 flex items-center gap-1.5">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-600 p-1 rounded"
          title="Open article"
        >
          <ExternalLink size={13} />
        </a>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-slate-500 hover:text-slate-700 h-7 px-2"
          onClick={() => onRegenerate(article.id)}
          title="Regenerate commentary"
        >
          <RotateCcw size={12} className="mr-1" />
          Regen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
          onClick={() => onDismiss(article.id)}
          title="Dismiss"
        >
          <X size={12} className="mr-1" />
          Skip
        </Button>
        <Button
          size="sm"
          className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => onApprove(article.id)}
          title="Approve → LinkedIn Kanban"
        >
          <ThumbsUp size={12} className="mr-1" />
          Approve
        </Button>
      </div>
    </div>
  );
}

// ─── Approved article card (with Buffer push button) ──────────────────────────

function ApprovedArticleCard({
  article,
  onPushToBuffer,
  onOpenDetail,
  isPushing,
}: {
  article: Article;
  onPushToBuffer: (id: number) => void;
  onOpenDetail: (article: Article) => void;
  isPushing: boolean;
}) {
  const topicKey = article.topic ?? "";

  return (
    <div className="bg-white border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Clickable content area */}
      <div
        className="p-4 pb-2 flex-1 cursor-pointer"
        onClick={() => onOpenDetail(article)}
      >
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <Badge variant="outline" className={`text-xs shrink-0 ${TOPIC_COLORS[topicKey] ?? ""}`}>
            {TOPIC_LABELS[topicKey] ?? topicKey}
          </Badge>
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 shrink-0">
            ✓ Approved
          </Badge>
          {article.bufferSentAt && (
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50 shrink-0">
              ✓ In Buffer
            </Badge>
          )}
        </div>
        <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 line-clamp-2">
          {article.title}
        </h3>
        <p className="text-xs text-slate-500 mb-1">{article.source}</p>
        {article.commentary && (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {article.commentary.slice(0, 160)}…
          </p>
        )}
      </div>

      {/* Buffer push footer */}
      <div className="p-3 pt-2 border-t border-slate-100 flex items-center gap-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-600 p-1 rounded"
          title="Open article"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={13} />
        </a>
        <div className="flex-1" />
        {article.bufferSentAt ? (
          <span className="text-xs text-blue-600 flex items-center gap-1">
            <Check size={12} />
            Sent to Buffer
          </span>
        ) : (
          <Button
            size="sm"
            className="text-xs h-7 px-3 bg-[#2C4BFF] hover:bg-[#1a35e0] text-white"
            onClick={(e) => {
              e.stopPropagation();
              onPushToBuffer(article.id);
            }}
            disabled={isPushing}
            title="Push to LinkedIn Buffer queue"
          >
            {isPushing ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <Send size={12} className="mr-1" />
            )}
            {isPushing ? "Pushing…" : "Push to Buffer"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Detail dialog ─────────────────────────────────────────────────────────────

function ArticleDetailDialog({
  article,
  open,
  onClose,
  onApprove,
  onDismiss,
  onRegenerate,
  onCommentaryChange,
  onPushToBuffer,
  isPushing,
}: {
  article: Article | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: number) => void;
  onDismiss: (id: number) => void;
  onRegenerate: (id: number) => void;
  onCommentaryChange: (id: number, text: string) => void;
  onPushToBuffer: (id: number) => void;
  isPushing: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!article) return null;

  const handleCopy = () => {
    if (article.commentary) {
      navigator.clipboard.writeText(article.commentary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-snug pr-6">
            {article.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${TOPIC_COLORS[article.topic ?? ""] ?? ""}`}>
              {TOPIC_LABELS[article.topic ?? ""] ?? article.topic}
            </Badge>
            <Badge variant="outline" className="text-xs text-slate-500">
              {article.source}
            </Badge>
            {article.bufferSentAt && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                ✓ Pushed to Buffer {new Date(article.bufferSentAt).toLocaleDateString()}
              </Badge>
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Read article <ExternalLink size={11} />
            </a>
          </div>

          {/* Description */}
          {article.description && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
              {article.description}
            </div>
          )}

          {/* Commentary editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                LinkedIn Commentary (Pedram's Voice)
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-slate-500"
                  onClick={() => onRegenerate(article.id)}
                >
                  <RotateCcw size={11} className="mr-1" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-slate-500"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={11} className="mr-1 text-green-600" /> : <Copy size={11} className="mr-1" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <Textarea
              value={article.commentary ?? ""}
              onChange={(e) => onCommentaryChange(article.id, e.target.value)}
              className="text-sm min-h-[280px] font-mono leading-relaxed resize-none"
              placeholder="Commentary will appear here after generation…"
            />
          </div>

          {/* Actions */}
          {article.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { onDismiss(article.id); onClose(); }}
              >
                <X size={14} className="mr-1.5" />
                Skip Article
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => { onApprove(article.id); onClose(); }}
              >
                <ThumbsUp size={14} className="mr-1.5" />
                Approve → LinkedIn Kanban
              </Button>
            </div>
          )}
          {article.status === "approved" && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                <Check size={14} />
                Approved — moved to LinkedIn Kanban in Command Center
                {article.contentItemId && (
                  <span className="text-xs text-emerald-600">(Card #{article.contentItemId})</span>
                )}
              </div>
              {/* Buffer push action */}
              {article.bufferSentAt ? (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
                  <Check size={14} />
                  Pushed to LinkedIn Buffer on {new Date(article.bufferSentAt).toLocaleString()}
                </div>
              ) : (
                <Button
                  className="w-full bg-[#2C4BFF] hover:bg-[#1a35e0] text-white"
                  onClick={() => onPushToBuffer(article.id)}
                  disabled={isPushing}
                >
                  {isPushing ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Send size={14} className="mr-1.5" />
                  )}
                  {isPushing ? "Pushing to Buffer…" : "Push to LinkedIn Buffer Queue"}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LinkedInNewsfeed() {
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "dismissed">("pending");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [localCommentary, setLocalCommentary] = useState<Record<number, string>>({});
  const [pushingId, setPushingId] = useState<number | null>(null);

  // Fetch articles
  const { data: articles = [], refetch: refetchArticles, isLoading } = trpc.newsfeed.getArticles.useQuery({
    topic: topicFilter === "all" ? undefined : topicFilter,
    status: activeTab,
    limit: 100,
  });

  // Fetch topic list
  const { data: topics = [] } = trpc.newsfeed.getTopics.useQuery();

  // Mutations
  const refreshMutation = trpc.newsfeed.refreshFeed.useMutation({
    onSuccess: (data) => {
      toast.success(`Feed refreshed — ${data.inserted} new articles added`);
      refetchArticles();
    },
    onError: (err) => toast.error(`Refresh failed: ${err.message}`),
  });

  const approveMutation = trpc.newsfeed.approveArticle.useMutation({
    onSuccess: (data) => {
      toast.success(`Approved! LinkedIn card #${data.contentItemId} created in Command Center`);
      refetchArticles();
    },
    onError: (err) => toast.error(`Approve failed: ${err.message}`),
  });

  const dismissMutation = trpc.newsfeed.dismissArticle.useMutation({
    onSuccess: () => {
      refetchArticles();
    },
    onError: (err) => toast.error(`Dismiss failed: ${err.message}`),
  });

  const regenMutation = trpc.newsfeed.regenerateCommentary.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Commentary regenerated");
      setLocalCommentary((prev) => ({ ...prev, [variables.id]: data.commentary }));
      refetchArticles();
    },
    onError: (err) => toast.error(`Regeneration failed: ${err.message}`),
  });

  const bufferMutation = trpc.newsfeed.pushToBuffer.useMutation({
    onMutate: (variables) => {
      setPushingId(variables.id);
    },
    onSuccess: (_data, variables) => {
      toast.success("Commentary queued in LinkedIn Buffer!");
      setPushingId(null);
      refetchArticles();
      // Update selectedArticle if open
      if (selectedArticle?.id === variables.id) {
        setSelectedArticle((prev) => prev ? { ...prev, bufferSentAt: new Date() } : prev);
      }
    },
    onError: (err) => {
      toast.error(`Buffer push failed: ${err.message}`);
      setPushingId(null);
    },
  });

  // Merge local commentary edits with server data
  const mergedArticles: Article[] = articles.map((a) => ({
    ...a,
    commentary: localCommentary[a.id] ?? a.commentary,
  }));

  const pendingCount = mergedArticles.filter((a) => a.status === "pending").length;
  const approvedCount = mergedArticles.filter((a) => a.status === "approved").length;

  // Update selectedArticle when local commentary changes
  const handleCommentaryChange = (id: number, text: string) => {
    setLocalCommentary((prev) => ({ ...prev, [id]: text }));
    if (selectedArticle?.id === id) {
      setSelectedArticle((prev) => prev ? { ...prev, commentary: text } : prev);
    }
  };

  const handleOpenDetail = (article: Article) => {
    const merged = { ...article, commentary: localCommentary[article.id] ?? article.commentary };
    setSelectedArticle(merged);
  };

  const handlePushToBuffer = (id: number) => {
    bufferMutation.mutate({ id });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Newspaper size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">LinkedIn Newsfeed</h1>
              <p className="text-xs text-slate-500">
                Google News + PubMed → Pedram's voice → LinkedIn Kanban → Buffer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Topic filter */}
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh button */}
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              onClick={() => refreshMutation.mutate({ topic: topicFilter === "all" ? undefined : topicFilter })}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? (
                <Loader2 size={13} className="mr-1.5 animate-spin" />
              ) : (
                <RefreshCw size={13} className="mr-1.5" />
              )}
              {refreshMutation.isPending ? "Fetching…" : "Refresh Feed"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="bg-white border border-slate-200 h-9">
              <TabsTrigger value="pending" className="text-xs">
                Pending
                {pendingCount > 0 && (
                  <span className="ml-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs">
                Approved
                {approvedCount > 0 && (
                  <span className="ml-1.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {approvedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="dismissed" className="text-xs">
                Dismissed
              </TabsTrigger>
            </TabsList>

            {/* Pending tab */}
            <TabsContent value="pending" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : mergedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Newspaper size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No articles yet</p>
                  <p className="text-slate-400 text-sm mt-1 mb-4">
                    Click "Refresh Feed" to discover articles from Google News and PubMed
                  </p>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => refreshMutation.mutate({})}
                    disabled={refreshMutation.isPending}
                  >
                    {refreshMutation.isPending ? (
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw size={13} className="mr-1.5" />
                    )}
                    {refreshMutation.isPending ? "Fetching articles…" : "Refresh Feed Now"}
                  </Button>
                  {refreshMutation.isPending && (
                    <p className="text-xs text-slate-400 mt-2">
                      Fetching articles and generating commentary — this takes ~30–60 seconds…
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                  {mergedArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onApprove={(id) => approveMutation.mutate({ id })}
                      onDismiss={(id) => dismissMutation.mutate({ id })}
                      onRegenerate={(id) => regenMutation.mutate({ id })}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Approved tab — with Buffer push buttons */}
            <TabsContent value="approved" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : mergedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ThumbsUp size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No approved articles yet</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Approved articles appear here and in the LinkedIn Kanban column
                  </p>
                </div>
              ) : (
                <>
                  {/* Buffer push summary bar */}
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-xs text-blue-700">
                    <Send size={14} className="shrink-0" />
                    <span>
                      <strong>{mergedArticles.filter((a) => a.bufferSentAt).length}</strong> of{" "}
                      <strong>{mergedArticles.length}</strong> approved articles pushed to LinkedIn Buffer.
                      {mergedArticles.filter((a) => !a.bufferSentAt).length > 0 && (
                        <> <strong>{mergedArticles.filter((a) => !a.bufferSentAt).length}</strong> ready to push.</>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                    {mergedArticles.map((article) => (
                      <ApprovedArticleCard
                        key={article.id}
                        article={article}
                        onPushToBuffer={handlePushToBuffer}
                        onOpenDetail={handleOpenDetail}
                        isPushing={pushingId === article.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Dismissed tab */}
            <TabsContent value="dismissed" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : mergedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <X size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No dismissed articles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                  {mergedArticles.map((article) => (
                    <div key={article.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 opacity-60">
                      <h3 className="font-semibold text-slate-700 text-sm leading-snug mb-1 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-slate-400">{article.source}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Detail dialog */}
      <ArticleDetailDialog
        article={selectedArticle}
        open={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onApprove={(id) => approveMutation.mutate({ id })}
        onDismiss={(id) => dismissMutation.mutate({ id })}
        onRegenerate={(id) => regenMutation.mutate({ id })}
        onCommentaryChange={handleCommentaryChange}
        onPushToBuffer={handlePushToBuffer}
        isPushing={pushingId === (selectedArticle?.id ?? -1)}
      />
    </DashboardLayout>
  );
}
