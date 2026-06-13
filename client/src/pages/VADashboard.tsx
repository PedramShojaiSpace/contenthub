/**
 * VA Dashboard — Syndication Task Queue
 *
 * This page is for the Virtual Assistant who handles manual syndication posting.
 * It shows all Medium, Quora, and Reddit jobs that are ready to post, with:
 * - Pre-written content to copy
 * - Direct links to where to post
 * - Step-by-step instructions for each platform
 * - A "Mark as Posted" button to confirm completion
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  SkipForward,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Platform = "medium" | "quora" | "reddit";
type JobStatus = "pending" | "adapting" | "ready" | "published" | "failed" | "skipped";

interface SyndicationJob {
  id: number;
  contentItemId: number;
  wordpressUrl: string;
  wordpressTitle: string;
  platform: string;
  status: string;
  scheduledAt: number;
  adaptedContent: string | null;
  publishedUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Platform Config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<Platform, {
  label: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  postUrl: string;
  instructions: string[];
  ctaLabel: string;
}> = {
  medium: {
    label: "Medium",
    icon: <BookOpen className="w-5 h-5" />,
    color: "border-green-500/30 bg-green-500/5",
    badgeColor: "bg-green-500/10 text-green-400 border-green-500/20",
    postUrl: "https://medium.com/p/import",
    instructions: [
      "Go to medium.com/p/import (link below)",
      "Paste the WordPress URL into the import field and click Import",
      "Medium will pull the full article and set the canonical URL automatically",
      "Review the imported article — check formatting, images, and subheadings",
      "Click Publish. Select 'Unlisted' first to preview, then set to 'Public'",
      "Copy the published Medium URL and paste it in the 'Published URL' field below",
      "Click Mark as Posted",
    ],
    ctaLabel: "Open Medium Import Tool",
  },
  quora: {
    label: "Quora",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "border-red-500/30 bg-red-500/5",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
    postUrl: "https://www.quora.com/search?q=",
    instructions: [
      "Click 'Search Quora for Question' below — this opens a search for the target question",
      "Find the exact question in the search results and click on it",
      "Click 'Answer' on the question page",
      "Paste the pre-written answer from the panel below",
      "Do NOT add any links to the answer body — Quora will flag promotional links",
      "Click Submit",
      "Copy the URL of your answer and paste it in the 'Published URL' field below",
      "Click Mark as Posted",
    ],
    ctaLabel: "Search Quora for Question",
  },
  reddit: {
    label: "Reddit",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "border-orange-500/30 bg-orange-500/5",
    badgeColor: "bg-orange-600/10 text-orange-300 border-orange-600/20",
    postUrl: "https://www.reddit.com/submit",
    instructions: [
      "Note the suggested subreddits listed below — choose the most relevant one",
      "Go to that subreddit (e.g. reddit.com/r/Microbiome)",
      "Click 'Create Post'",
      "Copy the post title from below and paste it into the Title field",
      "Copy the post body from below and paste it into the Text field",
      "The last line of the body already includes the source link — do not remove it",
      "Click Post",
      "Copy the URL of your Reddit post and paste it in the 'Published URL' field below",
      "Click Mark as Posted",
    ],
    ctaLabel: "Open Reddit Submit",
  },
};

// ─── Content Renderer ─────────────────────────────────────────────────────────
function renderAdaptedContent(platform: Platform, adaptedContent: Record<string, unknown>) {
  if (platform === "medium") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Headline</p>
          <p className="text-white font-semibold text-lg">{adaptedContent.title as string}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Article Body (Markdown)</p>
          <Textarea
            readOnly
            value={adaptedContent.bodyMarkdown as string}
            className="min-h-[200px] font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-300 resize-y"
          />
        </div>
        <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>Canonical URL will be set automatically when you use the Medium Import Tool — no action needed.</span>
        </div>
      </div>
    );
  }

  if (platform === "quora") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Target Question to Find on Quora</p>
          <p className="text-white font-semibold">{adaptedContent.targetQuestion as string}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Your Answer (Markdown)</p>
          <Textarea
            readOnly
            value={adaptedContent.answerMarkdown as string}
            className="min-h-[200px] font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-300 resize-y"
          />
        </div>
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>Do NOT add any external links to the answer body. Quora will flag or remove promotional links.</span>
        </div>
      </div>
    );
  }

  if (platform === "reddit") {
    const subreddits = (adaptedContent.suggestedSubreddits as string[]) ?? [];
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Suggested Subreddits</p>
          <div className="flex flex-wrap gap-2">
            {subreddits.map((sub) => (
              <a
                key={sub}
                href={`https://www.reddit.com/${sub}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded text-xs hover:bg-orange-500/20 transition-colors"
              >
                {sub} ↗
              </a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Post Title</p>
          <p className="text-white font-semibold">{adaptedContent.postTitle as string}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Post Body</p>
          <Textarea
            readOnly
            value={adaptedContent.postBody as string}
            className="min-h-[200px] font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-300 resize-y"
          />
        </div>
      </div>
    );
  }

  return <p className="text-zinc-400 text-sm">No content preview available.</p>;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onPosted }: { job: SyndicationJob; onPosted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showMarkPosted, setShowMarkPosted] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const platform = job.platform as Platform;
  const config = PLATFORM_CONFIG[platform];
  const isReady = job.status === "ready" || job.status === "published";
  const isPosted = job.status === "published" && job.publishedUrl;

  const markPosted = trpc.syndicationPipeline.markVaJobPosted.useMutation({
    onSuccess: () => {
      toast.success(`${config.label} post marked as done!`);
      setShowMarkPosted(false);
      onPosted();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const skipJob = trpc.syndicationPipeline.skipJob.useMutation({
    onSuccess: () => {
      toast.success(`${config.label} job skipped.`);
      onPosted();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  let adaptedContent: Record<string, unknown> | null = null;
  if (job.adaptedContent) {
    try {
      adaptedContent = JSON.parse(job.adaptedContent);
    } catch {
      adaptedContent = null;
    }
  }

  const scheduledDate = new Date(job.scheduledAt);
  const isOverdue = job.status === "pending" && scheduledDate < new Date();
  const isPending = job.status === "pending" || job.status === "adapting";

  const getQuoraSearchUrl = () => {
    if (adaptedContent?.targetQuestion) {
      return `https://www.quora.com/search?q=${encodeURIComponent(adaptedContent.targetQuestion as string)}`;
    }
    return "https://www.quora.com";
  };

  const getCtaUrl = () => {
    if (platform === "quora") return getQuoraSearchUrl();
    if (platform === "medium") return config.postUrl;
    if (platform === "reddit") {
      const subreddits = (adaptedContent?.suggestedSubreddits as string[]) ?? [];
      const firstSub = subreddits[0]?.replace("r/", "") ?? "";
      return firstSub ? `https://www.reddit.com/r/${firstSub}/submit` : config.postUrl;
    }
    return config.postUrl;
  };

  return (
    <Card className={`border ${config.color} bg-zinc-900/50`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg border ${config.badgeColor}`}>
              {config.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${config.badgeColor}`}>
                  {config.label}
                </Badge>
                {isPosted ? (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Posted
                  </Badge>
                ) : isPending ? (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                    <Clock className="w-3 h-3 mr-1" />
                    {isOverdue ? "Overdue" : `Due ${scheduledDate.toLocaleDateString()}`}
                  </Badge>
                ) : isReady ? (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                    Ready to Post
                  </Badge>
                ) : null}
                {job.status === "skipped" && (
                  <Badge variant="outline" className="text-xs bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                    Skipped
                  </Badge>
                )}
              </div>
              <p className="text-white font-medium text-sm mt-1 truncate">{job.wordpressTitle}</p>
              <a
                href={job.wordpressUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors truncate block"
              >
                {job.wordpressUrl}
              </a>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-zinc-400"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Step-by-step instructions */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-3">How to Post</p>
            <ol className="space-y-2">
              {config.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 text-xs flex items-center justify-center font-mono">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Content to copy */}
          {adaptedContent ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-200">Content to Post</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => {
                    const text = platform === "medium"
                      ? `${adaptedContent.title}\n\n${adaptedContent.bodyMarkdown}`
                      : platform === "quora"
                      ? adaptedContent.answerMarkdown as string
                      : `${adaptedContent.postTitle}\n\n${adaptedContent.postBody}`;
                    navigator.clipboard.writeText(text as string);
                    toast.success("Copied to clipboard!");
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy All
                </Button>
              </div>
              {renderAdaptedContent(platform, adaptedContent)}
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-400">
                Content will be generated automatically when this job is due ({scheduledDate.toLocaleDateString()}).
              </p>
            </div>
          ) : (
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <p className="text-sm text-zinc-400">No adapted content available yet. Try retrying the job.</p>
            </div>
          )}

          {/* Action buttons */}
          {!isPosted && job.status !== "skipped" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
              {isReady && (
                <a href={getCtaUrl()} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <ExternalLink className="w-3 h-3 mr-2" />
                    {config.ctaLabel}
                  </Button>
                </a>
              )}
              {isReady && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => setShowMarkPosted(true)}
                >
                  <CheckCircle2 className="w-3 h-3 mr-2" />
                  Mark as Posted
                </Button>
              )}
              {job.status !== "skipped" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-zinc-500 hover:text-zinc-300"
                  onClick={() => skipJob.mutate({ jobId: job.id })}
                  disabled={skipJob.isPending}
                >
                  <SkipForward className="w-3 h-3 mr-1" />
                  Skip
                </Button>
              )}
            </div>
          )}

          {isPosted && job.publishedUrl && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-emerald-400 font-medium">Posted successfully</p>
                <a
                  href={job.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-300 hover:underline truncate block"
                >
                  {job.publishedUrl}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      )}

      {/* Mark as Posted dialog */}
      <Dialog open={showMarkPosted} onOpenChange={setShowMarkPosted}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Mark {config.label} Post as Done</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Paste the URL of the post you just published on {config.label}. This is optional but helps track what was posted.
            </p>
            <Input
              placeholder={`https://www.${platform}.com/...`}
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowMarkPosted(false)} className="text-zinc-400">
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => markPosted.mutate({ jobId: job.id, publishedUrl: publishedUrl || undefined })}
                disabled={markPosted.isPending}
              >
                {markPosted.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm Posted
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VADashboard() {
  const [filter, setFilter] = useState<"all" | "todo" | "done">("todo");
  const { data: jobs, isLoading, refetch } = trpc.syndicationPipeline.listVaJobs.useQuery(undefined, {
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  const allJobs = (jobs ?? []) as SyndicationJob[];

  const filteredJobs = allJobs.filter((job) => {
    if (filter === "todo") return job.status === "ready" || job.status === "pending" || job.status === "adapting" || job.status === "failed";
    if (filter === "done") return job.status === "published" || job.status === "skipped";
    return true;
  });

  const todoCount = allJobs.filter((j) => j.status === "ready" || (j.status === "pending" && j.scheduledAt <= Date.now())).length;
  const doneCount = allJobs.filter((j) => j.status === "published").length;

  // Group by wordpress post
  const grouped = filteredJobs.reduce<Record<string, SyndicationJob[]>>((acc, job) => {
    const key = job.wordpressTitle;
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">VA Syndication Dashboard</h1>
              <p className="text-zinc-400 text-sm mt-1">
                Your daily posting queue for Medium, Quora, and Reddit. Content is pre-written — you just need to post it.
              </p>
            </div>
            <div className="flex gap-3 text-center flex-shrink-0">
              <div className="bg-zinc-800 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-amber-400">{todoCount}</p>
                <p className="text-xs text-zinc-400">To Do</p>
              </div>
              <div className="bg-zinc-800 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-emerald-400">{doneCount}</p>
                <p className="text-xs text-zinc-400">Done</p>
              </div>
            </div>
          </div>

          {/* Quick reference */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(["medium", "quora", "reddit"] as Platform[]).map((p) => (
              <div key={p} className={`rounded-lg p-3 border ${PLATFORM_CONFIG[p].color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${PLATFORM_CONFIG[p].badgeColor.split(" ")[1]}`}>
                    {PLATFORM_CONFIG[p].label}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">{PLATFORM_CONFIG[p].ctaLabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex gap-2 mb-6">
          {(["todo", "all", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              {f === "todo" ? "To Do" : f === "done" ? "Completed" : "All Jobs"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-400">Loading your queue...</span>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {filter === "todo" ? "All caught up!" : "No jobs found"}
            </h3>
            <p className="text-zinc-400 text-sm">
              {filter === "todo"
                ? "No posts are waiting to be syndicated right now. Check back after the next blog publishes."
                : "No syndication jobs match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([title, postJobs]) => (
              <div key={title}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-zinc-200 truncate">{title}</h2>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-500 flex-shrink-0">{postJobs.length} platform{postJobs.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-3">
                  {postJobs
                    .sort((a, b) => {
                      const order: Record<string, number> = { medium: 0, quora: 1, reddit: 2 };
                      return (order[a.platform] ?? 3) - (order[b.platform] ?? 3);
                    })
                    .map((job) => (
                      <JobCard key={job.id} job={job} onPosted={() => refetch()} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
