/**
 * Syndication Queue
 *
 * Shows the staggered multi-platform syndication pipeline for all published WordPress posts.
 * Each post generates 4 jobs: Substack (Day 1), Medium (Day 2), Quora (Day 3), Reddit (Day 4).
 *
 * The team can:
 * - View the status of each job (pending → adapting → ready → published / failed / skipped)
 * - Preview the AI-adapted content before it publishes
 * - Skip a job (e.g. decide not to publish to Medium for a particular post)
 * - Retry a failed job
 * - Copy the Quora answer for manual posting
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  RefreshCw,
  Eye,
  Copy,
  ExternalLink,
  Loader2,
  Rss,
  BookOpen,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyndicationStatus = "pending" | "adapting" | "ready" | "published" | "failed" | "skipped";
type SyndicationPlatform = "substack" | "medium" | "quora" | "reddit";

interface SyndicationJob {
  id: number;
  contentItemId: number;
  wordpressUrl: string;
  wordpressTitle: string;
  platform: SyndicationPlatform;
  status: SyndicationStatus;
  scheduledAt: number;
  adaptedContent: string | null;
  publishedUrl: string | null;
  errorMessage: string | null;
  retryCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<SyndicationPlatform, React.ReactNode> = {
  substack: <Rss className="w-4 h-4" />,
  medium: <BookOpen className="w-4 h-4" />,
  quora: <MessageSquare className="w-4 h-4" />,
  reddit: <MessageSquare className="w-4 h-4" />,
};

const PLATFORM_LABELS: Record<SyndicationPlatform, string> = {
  substack: "Substack",
  medium: "Medium",
  quora: "Quora",
  reddit: "Reddit",
};

const PLATFORM_COLORS: Record<SyndicationPlatform, string> = {
  substack: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-green-500/10 text-green-400 border-green-500/20",
  quora: "bg-red-500/10 text-red-400 border-red-500/20",
  reddit: "bg-orange-600/10 text-orange-300 border-orange-600/20",
};

const STATUS_CONFIG: Record<SyndicationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Scheduled", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: <Clock className="w-3 h-3" /> },
  adapting: { label: "Adapting…", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  ready: { label: "Ready", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: <Eye className="w-3 h-3" /> },
  published: { label: "Published", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
  skipped: { label: "Skipped", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: <SkipForward className="w-3 h-3" /> },
};

function formatScheduledAt(ts: number): string {
  const now = Date.now();
  const diff = ts - now;
  if (diff <= 0) return "Due now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `In ${days}d ${hours % 24}h`;
  return `In ${hours}h`;
}

// ─── Job Row Component ────────────────────────────────────────────────────────

function JobRow({ job, onRefresh }: { job: SyndicationJob; onRefresh: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<Record<string, string> | null>(null);

  const skipMutation = trpc.syndicationPipeline.skipJob.useMutation({
    onSuccess: () => { toast.success("Job skipped"); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const retryMutation = trpc.syndicationPipeline.retryJob.useMutation({
    onSuccess: () => { toast.success("Job queued for retry"); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const previewMutation = trpc.syndicationPipeline.previewAdaptation.useMutation({
    onSuccess: (data: { ok: boolean; content: Record<string, unknown> }) => {
      setPreviewContent(data.content as Record<string, string>);
      setPreviewOpen(true);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const statusCfg = STATUS_CONFIG[job.status];
  const platformColor = PLATFORM_COLORS[job.platform];

  const handleCopyQuora = () => {
    if (previewContent?.answerMarkdown) {
      navigator.clipboard.writeText(previewContent.answerMarkdown);
      toast.success("Quora answer copied to clipboard");
    } else if (job.adaptedContent) {
      try {
        const parsed = JSON.parse(job.adaptedContent);
        navigator.clipboard.writeText(parsed.answerMarkdown ?? "");
        toast.success("Quora answer copied to clipboard");
      } catch {
        toast.error("Could not parse adapted content");
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 py-3 px-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
        {/* Platform badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${platformColor}`}>
          {PLATFORM_ICONS[job.platform]}
          {PLATFORM_LABELS[job.platform]}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 truncate">{job.wordpressTitle}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {job.status === "pending"
              ? formatScheduledAt(job.scheduledAt)
              : job.status === "published" && job.publishedUrl
              ? <a href={job.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">View post <ExternalLink className="w-3 h-3" /></a>
              : job.status === "failed"
              ? <span className="text-red-400">{job.errorMessage?.slice(0, 80)}</span>
              : job.platform === "quora" && job.status === "published"
              ? "Ready for manual posting"
              : null}
          </p>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${statusCfg.color}`}>
          {statusCfg.icon}
          {statusCfg.label}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Preview / Copy */}
          {(job.status === "pending" || job.status === "ready") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={() => previewMutation.mutate({ jobId: job.id })}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Preview
            </Button>
          )}
          {job.status === "published" && job.platform === "quora" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={handleCopyQuora}
            >
              <Copy className="w-3 h-3" />
              Copy Answer
            </Button>
          )}
          {job.status === "published" && job.platform !== "quora" && job.adaptedContent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={() => {
                try { setPreviewContent(JSON.parse(job.adaptedContent!)); setPreviewOpen(true); } catch { toast.error("Cannot parse content"); }
              }}
            >
              <Eye className="w-3 h-3" />
              View
            </Button>
          )}

          {/* Skip */}
          {(job.status === "pending" || job.status === "ready") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
              onClick={() => skipMutation.mutate({ jobId: job.id })}
              disabled={skipMutation.isPending}
            >
              <SkipForward className="w-3 h-3" />
              Skip
            </Button>
          )}

          {/* Retry */}
          {job.status === "failed" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              onClick={() => retryMutation.mutate({ jobId: job.id })}
              disabled={retryMutation.isPending}
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {PLATFORM_LABELS[job.platform]} Adaptation Preview
            </DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="space-y-4">
              {/* Substack */}
              {job.platform === "substack" && (
                <>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Subject Line</p>
                    <p className="text-zinc-200 font-medium">{previewContent.title}</p>
                  </div>
                  {previewContent.subtitle && (
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Subtitle</p>
                      <p className="text-zinc-400 text-sm">{previewContent.subtitle}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Letter Body</p>
                    <div
                      className="prose prose-invert prose-sm max-w-none text-zinc-300"
                      dangerouslySetInnerHTML={{ __html: previewContent.bodyHtml ?? "" }}
                    />
                  </div>
                </>
              )}
              {/* Medium */}
              {job.platform === "medium" && (
                <>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Headline</p>
                    <p className="text-zinc-200 font-medium">{previewContent.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Article (Markdown)</p>
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap bg-zinc-900 rounded-lg p-4 overflow-y-auto max-h-96">
                      {previewContent.bodyMarkdown}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300"
                      onClick={() => { navigator.clipboard.writeText(previewContent.bodyMarkdown ?? ""); toast.success("Copied"); }}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy Markdown
                    </Button>
                  </div>
                </>
              )}
              {/* Quora */}
              {job.platform === "quora" && (
                <>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Target Question</p>
                    <p className="text-zinc-200 font-medium">"{previewContent.targetQuestion}"</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Answer</p>
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap bg-zinc-900 rounded-lg p-4 overflow-y-auto max-h-96">
                      {previewContent.answerMarkdown}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300"
                      onClick={() => { navigator.clipboard.writeText(previewContent.answerMarkdown ?? ""); toast.success("Copied"); }}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy Answer
                    </Button>
                    <a
                      href={`https://www.quora.com/search?q=${encodeURIComponent(previewContent.targetQuestion ?? "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300">
                        <ExternalLink className="w-3 h-3 mr-1" /> Find on Quora
                      </Button>
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SyndicationQueue() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "published" | "failed">("all");

  const { data: jobs = [], isLoading, refetch } = trpc.syndicationPipeline.listPendingJobs.useQuery(undefined, {
    refetchInterval: 30_000, // Refresh every 30s
  });

  const filteredJobs = jobs.filter((job: SyndicationJob) => {
    if (activeTab === "pending") return job.status === "pending" || job.status === "adapting" || job.status === "ready";
    if (activeTab === "published") return job.status === "published";
    if (activeTab === "failed") return job.status === "failed";
    return true;
  });

  // Group by content item for display
  const grouped = filteredJobs.reduce((acc: Record<string, SyndicationJob[]>, job: SyndicationJob) => {
    const key = `${job.contentItemId}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  const pendingCount = jobs.filter((j: SyndicationJob) => j.status === "pending" || j.status === "ready").length;
  const failedCount = jobs.filter((j: SyndicationJob) => j.status === "failed").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Syndication Queue</h1>
            <p className="text-sm text-zinc-400 mt-1">
              WordPress → Substack (Day 1) → Medium (Day 2) → Quora (Day 3)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                {pendingCount} pending
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                {failedCount} failed
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Pipeline explanation */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { platform: "WordPress", day: "Day 0", desc: "Canonical origin. Google indexes first.", color: "text-blue-400" },
                { platform: "Substack + Medium", day: "Day 1–2", desc: "Distinct founder letter + adapted article.", color: "text-orange-400" },
                { platform: "Quora", day: "Day 3", desc: "Fresh expert answer. Manual posting.", color: "text-red-400" },
              ].map((step) => (
                <div key={step.platform} className="space-y-1">
                  <p className={`text-sm font-semibold ${step.color}`}>{step.platform}</p>
                  <p className="text-xs text-zinc-500">{step.day}</p>
                  <p className="text-xs text-zinc-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">All</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-zinc-800">Pending</TabsTrigger>
            <TabsTrigger value="published" className="data-[state=active]:bg-zinc-800">Published</TabsTrigger>
            <TabsTrigger value="failed" className="data-[state=active]:bg-zinc-800">Failed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Rss className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No syndication jobs found.</p>
                <p className="text-xs mt-1">Jobs are created automatically when you publish a blog to WordPress.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([contentItemId, jobGroup]) => {
                  const sortedJobs = [...(jobGroup as SyndicationJob[])].sort((a, b) => a.scheduledAt - b.scheduledAt);
                  const title = sortedJobs[0]?.wordpressTitle ?? "Untitled";
                  const wpUrl = sortedJobs[0]?.wordpressUrl;
                  return (
                    <Card key={contentItemId} className="bg-zinc-900/50 border-zinc-800">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-sm font-medium text-zinc-200 leading-snug">
                            {title}
                          </CardTitle>
                          {wpUrl && (
                            <a href={wpUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {sortedJobs.map((job) => (
                          <JobRow key={job.id} job={job} onRefresh={refetch} />
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
