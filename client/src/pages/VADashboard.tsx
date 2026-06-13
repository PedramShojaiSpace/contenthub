/**
 * VA Dashboard — Syndication Task Queue + Video Review
 *
 * Tab 1 (Syndication): Medium, Quora, Reddit job queue with pre-written content
 * Tab 2 (Video Review): Descript-rendered videos awaiting VA approval before YouTube publish
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
  Video,
  Play,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Youtube,
  Edit2,
  Tag,
} from "lucide-react";

// ─── Syndication Types ────────────────────────────────────────────────────────
type Platform = "medium" | "quora" | "reddit";

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

// ─── Video Job Types ──────────────────────────────────────────────────────────
interface VideoJob {
  id: number;
  contentItemId: number;
  scriptText: string;
  brollPrompt: string | null;
  descriptProjectId: string | null;
  descriptImportJobId: string | null;
  descriptAgentJobId: string | null;
  descriptPublishJobId: string | null;
  descriptShareUrl: string | null;
  descriptDownloadUrl: string | null;
  s3VideoKey: string | null;
  s3VideoUrl: string | null;
  youtubeVideoId: string | null;
  youtubeTitle: string | null;
  youtubeDescription: string | null;
  youtubeTags: string | null;
  youtubeThumbnailUrl: string | null;
  status: string;
  errorMessage: string | null;
  retryCount: number | null;
  vaApprovedAt: number | null;
  publishedAt: number | null;
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
    postUrl: "https://www.quora.com",
    instructions: [
      "Search for the target question on Quora (link below)",
      "Find the most relevant question — look for ones with 1k+ followers",
      "Click 'Answer' on the question",
      "Copy the answer from below and paste it into the Quora editor",
      "Do NOT add any external links — Quora will flag promotional content",
      "Add your credentials: 'Dr. Pedram Shojai, Doctor of Oriental Medicine'",
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

// ─── Syndication Job Card ─────────────────────────────────────────────────────
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
          {/* Instructions */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Step-by-Step Instructions</p>
            <ol className="space-y-2">
              {config.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Content */}
          {adaptedContent ? (
            renderAdaptedContent(platform, adaptedContent)
          ) : isPending ? (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-300">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>AI is generating content for this platform... Check back in a few minutes.</span>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">Content not available.</p>
          )}

          {/* Actions */}
          {!isPosted && !isPending && (
            <div className="flex gap-3 flex-wrap">
              <a href={getCtaUrl()} target="_blank" rel="noopener noreferrer">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {config.ctaLabel}
                </Button>
              </a>
              {adaptedContent && (
                <Button
                  variant="outline"
                  className="text-sm border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => {
                    const text = JSON.stringify(adaptedContent, null, 2);
                    navigator.clipboard.writeText(text);
                    toast.success("Content copied to clipboard");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Content
                </Button>
              )}
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                onClick={() => setShowMarkPosted(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Posted
              </Button>
              {job.status !== "skipped" && (
                <Button
                  variant="ghost"
                  className="text-zinc-500 hover:text-zinc-300 text-sm"
                  onClick={() => skipJob.mutate({ jobId: job.id })}
                  disabled={skipJob.isPending}
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip
                </Button>
              )}
            </div>
          )}

          {isPosted && job.publishedUrl && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Posted at: </span>
              <a href={job.publishedUrl} target="_blank" rel="noopener noreferrer" className="underline truncate">
                {job.publishedUrl}
              </a>
            </div>
          )}
        </CardContent>
      )}

      {/* Mark as Posted Dialog */}
      <Dialog open={showMarkPosted} onOpenChange={setShowMarkPosted}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>Mark {config.label} Post as Done</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Paste the URL of your published {config.label} post below (optional but recommended for tracking).
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

// ─── Video Status Badge ───────────────────────────────────────────────────────
function VideoStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    queued: { label: "Queued", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
    importing: { label: "Importing to Descript", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    processing: { label: "AI Processing", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    rendering: { label: "Rendering Video", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    ready_for_review: { label: "Ready for Review", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    approved: { label: "Approved", className: "bg-green-500/10 text-green-400 border-green-500/20" },
    publishing: { label: "Uploading to YouTube", className: "bg-red-500/10 text-red-400 border-red-500/20" },
    published: { label: "Published on YouTube", className: "bg-red-600/10 text-red-300 border-red-600/20" },
    failed: { label: "Failed", className: "bg-red-900/20 text-red-400 border-red-900/30" },
    skipped: { label: "Skipped", className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
  };
  const c = config[status] ?? { label: status, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
  return (
    <Badge variant="outline" className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  );
}

// ─── Video Job Card ───────────────────────────────────────────────────────────
function VideoJobCard({ job, onRefresh }: { job: VideoJob; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editTitle, setEditTitle] = useState(job.youtubeTitle ?? "Urban Monk Video");
  const [editDescription, setEditDescription] = useState(job.youtubeDescription ?? "");
  const [editTags, setEditTags] = useState(
    job.youtubeTags ? (JSON.parse(job.youtubeTags) as string[]).join(", ") : ""
  );

  const isReadyForReview = job.status === "ready_for_review";
  const isInProgress = ["queued", "importing", "processing", "rendering"].includes(job.status);
  const isPublished = job.status === "published";
  const isFailed = job.status === "failed";

  const approveJob = trpc.videoPipeline.approveVideoJob.useMutation({
    onSuccess: (data) => {
      toast.success(`Video published to YouTube!`);
      onRefresh();
    },
    onError: (err) => toast.error(`Approve failed: ${err.message}`),
  });

  const rejectJob = trpc.videoPipeline.rejectVideoJob.useMutation({
    onSuccess: () => {
      toast.success("Video rejected.");
      setShowReject(false);
      onRefresh();
    },
    onError: (err) => toast.error(`Reject failed: ${err.message}`),
  });

  const retryJob = trpc.videoPipeline.retryVideoJob.useMutation({
    onSuccess: () => {
      toast.success("Job re-queued for retry.");
      onRefresh();
    },
    onError: (err) => toast.error(`Retry failed: ${err.message}`),
  });

  const updateMeta = trpc.videoPipeline.updateVideoMetadata.useMutation({
    onSuccess: () => {
      toast.success("Metadata saved.");
      setShowEditMeta(false);
      onRefresh();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  return (
    <Card className="border border-zinc-700/50 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/10">
              <Video className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <VideoStatusBadge status={job.status} />
                {isInProgress && (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                )}
              </div>
              <p className="text-white font-medium text-sm truncate">
                {job.youtubeTitle ?? "Urban Monk Video"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Job #{job.id} · Created {new Date(job.createdAt).toLocaleDateString()}
              </p>
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
          {/* In-progress message */}
          {isInProgress && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-300">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Descript is processing this video. The pipeline polls every 15 minutes — check back soon.</span>
            </div>
          )}

          {/* Error message */}
          {isFailed && job.errorMessage && (
            <div className="p-3 bg-red-900/20 border border-red-900/30 rounded text-sm text-red-300">
              <p className="font-medium mb-1">Error:</p>
              <p className="font-mono text-xs">{job.errorMessage}</p>
            </div>
          )}

          {/* Video preview */}
          {job.s3VideoUrl && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Video Preview</p>
              <div className="rounded-lg overflow-hidden bg-black border border-zinc-700">
                <video
                  controls
                  className="w-full max-h-[360px]"
                  src={job.s3VideoUrl}
                  preload="metadata"
                />
              </div>
              <a
                href={job.s3VideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <ExternalLink className="w-3 h-3" /> Open in new tab
              </a>
            </div>
          )}

          {/* Descript project link */}
          {job.descriptShareUrl && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Descript Project:</span>
              <a
                href={job.descriptShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline text-xs truncate"
              >
                Open in Descript ↗
              </a>
            </div>
          )}

          {/* YouTube metadata */}
          <div className="space-y-3 bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">YouTube Metadata</p>
              {isReadyForReview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-zinc-200 h-7 px-2"
                  onClick={() => setShowEditMeta(true)}
                >
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
              )}
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Title</p>
              <p className="text-white text-sm font-medium">{job.youtubeTitle ?? "Urban Monk Video"}</p>
            </div>
            {job.youtubeDescription && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Description</p>
                <p className="text-zinc-300 text-xs line-clamp-3">{job.youtubeDescription}</p>
              </div>
            )}
            {job.youtubeTags && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(JSON.parse(job.youtubeTags) as string[]).slice(0, 8).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Published YouTube link */}
          {isPublished && `https://www.youtube.com/watch?v=${job.youtubeVideoId}` && (
            <div className="flex items-center gap-2 p-3 bg-red-600/10 border border-red-600/20 rounded text-sm text-red-300">
              <Youtube className="w-4 h-4 flex-shrink-0" />
              <span>Published: </span>
              <a href={`https://www.youtube.com/watch?v=${job.youtubeVideoId}`} target="_blank" rel="noopener noreferrer" className="underline truncate">
                {`https://www.youtube.com/watch?v=${job.youtubeVideoId}`}
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {isReadyForReview && (
              <>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white text-sm"
                  onClick={() => approveJob.mutate({ jobId: job.id })}
                  disabled={approveJob.isPending}
                >
                  {approveJob.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Youtube className="w-4 h-4 mr-2" />
                  )}
                  Approve & Publish to YouTube
                </Button>
                <Button
                  variant="outline"
                  className="text-sm border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => setShowReject(true)}
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            {isFailed && (
              <Button
                variant="outline"
                className="text-sm border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => retryJob.mutate({ jobId: job.id })}
                disabled={retryJob.isPending}
              >
                {retryJob.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      )}

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>Reject Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Provide a reason for rejection (optional). The job will be marked as failed.</p>
            <Textarea
              placeholder="e.g. Audio quality issue, wrong B-roll, script error..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowReject(false)} className="text-zinc-400">Cancel</Button>
              <Button
                className="bg-red-700 hover:bg-red-800 text-white"
                onClick={() => rejectJob.mutate({ jobId: job.id, reason: rejectReason || undefined })}
                disabled={rejectJob.isPending}
              >
                {rejectJob.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Metadata Dialog */}
      <Dialog open={showEditMeta} onOpenChange={setShowEditMeta}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit YouTube Metadata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Title (max 100 chars)</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={100}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">{editTitle.length}/100</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[150px] bg-zinc-800 border-zinc-700 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Tags (comma-separated)</label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="gut health, microbiome, urban monk..."
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowEditMeta(false)} className="text-zinc-400">Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() =>
                  updateMeta.mutate({
                    jobId: job.id,
                    youtubeTitle: editTitle || undefined,
                    youtubeDescription: editDescription || undefined,
                    youtubeTags: editTags ? editTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
                  })
                }
                disabled={updateMeta.isPending}
              >
                {updateMeta.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
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
  const [activeTab, setActiveTab] = useState<"syndication" | "video">("syndication");
  const [syndicationFilter, setSyndicationFilter] = useState<"all" | "todo" | "done">("todo");
  const [videoFilter, setVideoFilter] = useState<"all" | "review" | "published" | "failed">("review");

  // Syndication data
  const { data: syndicationJobs, isLoading: syndicationLoading, refetch: refetchSyndication } =
    trpc.syndicationPipeline.listVaJobs.useQuery(undefined, { refetchInterval: 30_000 });

  // Video jobs data
  const { data: videoJobsData, isLoading: videoLoading, refetch: refetchVideo } =
    trpc.videoPipeline.getVideoJobs.useQuery({ limit: 50 }, { refetchInterval: 30_000 });

  const allSyndicationJobs = (syndicationJobs ?? []) as SyndicationJob[];
  const allVideoJobs = (videoJobsData ?? []) as VideoJob[];

  const filteredSyndicationJobs = allSyndicationJobs.filter((job) => {
    if (syndicationFilter === "todo") return job.status === "ready" || job.status === "pending" || job.status === "adapting" || job.status === "failed";
    if (syndicationFilter === "done") return job.status === "published" || job.status === "skipped";
    return true;
  });

  const filteredVideoJobs = allVideoJobs.filter((job) => {
    if (videoFilter === "review") return job.status === "ready_for_review";
    if (videoFilter === "published") return job.status === "published";
    if (videoFilter === "failed") return job.status === "failed";
    return true;
  });

  const syndicationTodoCount = allSyndicationJobs.filter(
    (j) => j.status === "ready" || (j.status === "pending" && j.scheduledAt <= Date.now())
  ).length;
  const videoReviewCount = allVideoJobs.filter((j) => j.status === "ready_for_review").length;

  // Group syndication jobs by wordpress post
  const grouped = filteredSyndicationJobs.reduce<Record<string, SyndicationJob[]>>((acc, job) => {
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
              <h1 className="text-2xl font-bold text-white">VA Dashboard</h1>
              <p className="text-zinc-400 text-sm mt-1">
                Content syndication queue and video review for The Urban Monk.
              </p>
            </div>
            <div className="flex gap-3 text-center flex-shrink-0">
              <div className="bg-zinc-800 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-amber-400">{syndicationTodoCount}</p>
                <p className="text-xs text-zinc-400">Posts to Syndicate</p>
              </div>
              <div className="bg-zinc-800 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-red-400">{videoReviewCount}</p>
                <p className="text-xs text-zinc-400">Videos to Review</p>
              </div>
            </div>
          </div>

          {/* Main tabs */}
          <div className="flex gap-1 mt-5 bg-zinc-800/50 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab("syndication")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "syndication"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Syndication
              {syndicationTodoCount > 0 && (
                <span className="bg-amber-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {syndicationTodoCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("video")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "video"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Video className="w-4 h-4" />
              Video Review
              {videoReviewCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {videoReviewCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-6 py-4">

        {/* ── Syndication Tab ─────────────────────────────────────────────────── */}
        {activeTab === "syndication" && (
          <>
            {/* Platform quick-reference */}
            <div className="grid grid-cols-3 gap-3 mb-6">
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

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {(["todo", "all", "done"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSyndicationFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    syndicationFilter === f
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  {f === "todo" ? "To Do" : f === "done" ? "Completed" : "All Jobs"}
                </button>
              ))}
            </div>

            {syndicationLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                <span className="ml-3 text-zinc-400">Loading your queue...</span>
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {syndicationFilter === "todo" ? "All caught up!" : "No jobs found"}
                </h3>
                <p className="text-zinc-400 text-sm">
                  {syndicationFilter === "todo"
                    ? "No posts are waiting to be syndicated right now."
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
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {postJobs.length} platform{postJobs.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {postJobs
                        .sort((a, b) => {
                          const order: Record<string, number> = { medium: 0, quora: 1, reddit: 2 };
                          return (order[a.platform] ?? 3) - (order[b.platform] ?? 3);
                        })
                        .map((job) => (
                          <JobCard key={job.id} job={job} onPosted={() => refetchSyndication()} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Video Review Tab ─────────────────────────────────────────────────── */}
        {activeTab === "video" && (
          <>
            {/* Instructions banner */}
            <div className="mb-6 p-4 bg-red-900/10 border border-red-900/20 rounded-lg">
              <p className="text-sm font-semibold text-red-300 mb-2">Video Review Instructions</p>
              <ol className="space-y-1 text-xs text-zinc-400">
                <li>1. Watch the full video in the preview player below.</li>
                <li>2. Check audio quality, B-roll relevance, and captions.</li>
                <li>3. Edit the YouTube title, description, and tags if needed.</li>
                <li>4. Click <strong className="text-white">Approve &amp; Publish to YouTube</strong> — the video uploads automatically.</li>
                <li>5. If the video has issues, click <strong className="text-white">Reject</strong> with a reason — the team will re-render.</li>
              </ol>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {(["review", "all", "published", "failed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setVideoFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    videoFilter === f
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  {f === "review" ? "Needs Review" : f === "published" ? "Published" : f === "failed" ? "Failed" : "All"}
                </button>
              ))}
            </div>

            {videoLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                <span className="ml-3 text-zinc-400">Loading video jobs...</span>
              </div>
            ) : filteredVideoJobs.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {videoFilter === "review" ? "No videos waiting for review" : "No videos found"}
                </h3>
                <p className="text-zinc-400 text-sm">
                  {videoFilter === "review"
                    ? "Videos will appear here once Descript finishes rendering them."
                    : "No video jobs match this filter."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredVideoJobs.map((job) => (
                  <VideoJobCard key={job.id} job={job} onRefresh={() => refetchVideo()} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
