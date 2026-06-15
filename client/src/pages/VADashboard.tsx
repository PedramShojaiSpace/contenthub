/**
 * VA Dashboard — Syndication Task Queue + Video Review
 *
 * Tab 1 (Syndication): Medium, Quora, Reddit job queue with pre-written content
 * Tab 2 (Video Review): Descript-rendered videos awaiting VA approval before YouTube publish
 */
import { useState } from "react";
import { useLocation } from "wouter";
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
  ArrowLeft,
  Sparkles,
  Globe,
  Target,
  Hash,
  MessageCircle,
  Bot,
  Wand2,
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
  videoType: string | null;
  heygenVideoId: string | null;
  status: string;
  errorMessage: string | null;
  retryCount: number | null;
  vaApprovedAt: number | null;
  publishedAt: number | null;
  createdAt: Date;
  updatedAt: Date;
  blogUrl: string | null;
  blogEmbedStatus: string | null;
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
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Headline</p>
          <p className="text-foreground font-semibold text-lg">{adaptedContent.title as string}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Article Body (Markdown)</p>
          <Textarea
            readOnly
            value={adaptedContent.bodyMarkdown as string}
            className="min-h-[200px] font-mono text-xs bg-card border-border text-foreground/80 resize-y"
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
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Target Question to Find on Quora</p>
          <p className="text-foreground font-semibold">{adaptedContent.targetQuestion as string}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Answer (Markdown)</p>
          <Textarea
            readOnly
            value={adaptedContent.answerMarkdown as string}
            className="min-h-[200px] font-mono text-xs bg-card border-border text-foreground/80 resize-y"
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
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Suggested Subreddits</p>
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
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Post Title</p>
          <p className="text-foreground font-semibold">{adaptedContent.postTitle as string}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Post Body</p>
          <Textarea
            readOnly
            value={adaptedContent.postBody as string}
            className="min-h-[200px] font-mono text-xs bg-card border-border text-foreground/80 resize-y"
          />
        </div>
      </div>
    );
  }

  return <p className="text-muted-foreground text-sm">No content preview available.</p>;
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
    <Card className={`border ${config.color} bg-card`}>
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
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
                    Skipped
                  </Badge>
                )}
              </div>
              <p className="text-foreground font-medium text-sm mt-1 truncate">{job.wordpressTitle}</p>
              <a
                href={job.wordpressUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors truncate block"
              >
                {job.wordpressUrl}
              </a>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-muted-foreground"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-3">Step-by-Step Instructions</p>
            <ol className="space-y-2">
              {config.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground/80">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary text-foreground/80 text-xs flex items-center justify-center font-medium">
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
            <p className="text-muted-foreground text-sm">Content not available.</p>
          )}

          {/* Actions */}
          {!isPosted && !isPending && (
            <div className="flex gap-3 flex-wrap">
              <a href={getCtaUrl()} target="_blank" rel="noopener noreferrer">
                <Button className="bg-blue-600 hover:bg-blue-700 text-foreground text-sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {config.ctaLabel}
                </Button>
              </a>
              {adaptedContent && (
                <Button
                  variant="outline"
                  className="text-sm border-border text-foreground/80 hover:bg-muted"
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
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground text-sm"
                onClick={() => setShowMarkPosted(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Posted
              </Button>
              {job.status !== "skipped" && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground/80 text-sm"
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
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Mark {config.label} Post as Done</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste the URL of your published {config.label} post below (optional but recommended for tracking).
            </p>
            <Input
              placeholder={`https://www.${platform}.com/...`}
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              className="bg-muted border-border text-foreground"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowMarkPosted(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground"
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
    pending: { label: "Queued", className: "bg-muted text-muted-foreground border-border" },
    queued: { label: "Queued", className: "bg-muted text-muted-foreground border-border" },
    importing: { label: "Importing to Descript", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    editing: { label: "AI Editing", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    processing: { label: "AI Processing", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    rendering: { label: "Rendering Video", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    ready_for_review: { label: "Ready for Review ✅", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold" },
    approved: { label: "Approved", className: "bg-green-500/10 text-green-600 border-green-500/20" },
    uploading: { label: "Uploading to YouTube...", className: "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" },
    publishing: { label: "Uploading to YouTube...", className: "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" },
    uploaded_unlisted: { label: "Uploaded — SEO Review Needed", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold" },
    published: { label: "Published on YouTube 🎉", className: "bg-red-600/10 text-primary border-red-600/20 font-semibold" },
    failed: { label: "Failed ⚠️", className: "bg-red-900/20 text-red-500 border-red-900/30" },
    rejected: { label: "Rejected", className: "bg-muted text-muted-foreground border-border" },
    skipped: { label: "Skipped", className: "bg-muted text-muted-foreground border-border" },
  };
  const c = config[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
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
  const isApproved = job.status === "approved"; // reset from stuck — needs re-upload
  const isQueuedOrPending = job.status === "pending"; // waiting in queue — can force re-export
  const isUploadedUnlisted = job.status === "uploaded_unlisted";
  const isInProgress = ["queued", "importing", "processing", "rendering"].includes(job.status);
  const isUploading = job.status === "uploading" || job.status === "publishing";
  const isPublished = job.status === "published";
  const isFailed = job.status === "failed";
  const isAvatar = job.videoType === "avatar";
  const isRendering = job.status === "rendering"; // HeyGen rendering in progress

  // SEO panel state
  const [showSeoPanel, setShowSeoPanel] = useState(isUploadedUnlisted);
  const [seoTitle, setSeoTitle] = useState(job.youtubeTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(job.youtubeDescription ?? "");
  const [seoTags, setSeoTags] = useState(
    job.youtubeTags ? (JSON.parse(job.youtubeTags) as string[]).join(", ") : ""
  );
  const [seoPrimaryKeyword, setSeoPrimaryKeyword] = useState("");
  const [seoSecondaryKeyword, setSeoSecondaryKeyword] = useState("");
  const [seoSemanticKeywords, setSeoSemanticKeywords] = useState<string[]>([]);
  const [seoPinnedComment, setSeoPinnedComment] = useState("");
  const [seoHookLine, setSeoHookLine] = useState("");
  const [seoTitleStatus, setSeoTitleStatus] = useState<"green" | "amber" | "red">("amber");
  const [seoHookStatus, setSeoHookStatus] = useState<"green" | "amber" | "red">("amber");

  const approveJob = trpc.videoPipeline.approveVideoJob.useMutation({
    onSuccess: (data) => {
      toast.success("Publishing to YouTube in the background — this takes 10–20 minutes. The status will update automatically.", { duration: 8000 });
      // Start polling every 30s while uploading
      const pollInterval = setInterval(() => { onRefresh(); }, 30_000);
      setTimeout(() => clearInterval(pollInterval), 25 * 60 * 1000); // stop after 25 min
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

  const generateSeo = trpc.videoPipeline.generateSeoOptimization.useMutation({
    onSuccess: (data) => {
      if (data.success && data.seo) {
        setSeoTitle(data.seo.title);
        setSeoDescription(data.seo.description);
        setSeoTags(data.seo.tags.join(", "));
        setSeoPrimaryKeyword(data.seo.primaryKeyword);
        setSeoSecondaryKeyword(data.seo.secondaryKeyword);
        setSeoSemanticKeywords(data.seo.semanticKeywords);
        setSeoPinnedComment(data.seo.pinnedCommentSuggestion);
        setSeoHookLine(data.seo.hookLine);
        setSeoTitleStatus(data.seo.titleStatus);
        setSeoHookStatus(data.seo.hookLineStatus);
        toast.success("SEO copy generated — review and edit before publishing.", { duration: 5000 });
      }
    },
    onError: (err) => toast.error(`SEO generation failed: ${err.message}`),
  });

  const saveSeoMeta = trpc.videoPipeline.updateVideoMetadata.useMutation({
    onSuccess: () => {
      toast.success("SEO metadata saved.");
      onRefresh();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const makePublic = trpc.videoPipeline.makePublic.useMutation({
    onSuccess: (data) => {
      toast.success("Video is now PUBLIC on YouTube!", { duration: 8000 });
      onRefresh();
    },
    onError: (err) => toast.error(`Publish failed: ${err.message}`),
  });

  const retryUploadToYouTube = trpc.videoPipeline.retryUploadToYouTube.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "Retrying YouTube upload in the background.", { duration: 8000 });
      const pollInterval = setInterval(() => { onRefresh(); }, 30_000);
      setTimeout(() => clearInterval(pollInterval), 40 * 60 * 1000);
      onRefresh();
    },
    onError: (err) => toast.error(`Retry upload failed: ${err.message}`),
  });

  const forceReexport = trpc.videoPipeline.forceReexport.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "Force re-export started. Descript is re-processing (~15 min).", { duration: 10000 });
      const pollInterval = setInterval(() => { onRefresh(); }, 30_000);
      setTimeout(() => clearInterval(pollInterval), 40 * 60 * 1000);
      onRefresh();
    },
    onError: (err) => toast.error(`Force re-export failed: ${err.message}`),
  });

  const resetStuckJob = trpc.videoPipeline.resetStuckJob.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "Job reset. Click Approve & Upload to retry.");
      onRefresh();
    },
    onError: (err) => toast.error(`Reset failed: ${err.message}`),
  });

  // ── HeyGen Avatar mutations ───────────────────────────────────────────────
  const generateAvatarVideo = trpc.heygen.generateAvatarVideo.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "HeyGen avatar render started. Dashboard will update when done.", { duration: 10000 });
      // Poll every 30s while rendering
      const pollInterval = setInterval(() => { onRefresh(); }, 30_000);
      setTimeout(() => clearInterval(pollInterval), 90 * 60 * 1000); // stop after 90 min
      onRefresh();
    },
    onError: (err) => toast.error(`Avatar generation failed: ${err.message}`),
  });

  const retryAvatarVideo = trpc.heygen.retryAvatarVideo.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "HeyGen avatar render restarted.", { duration: 8000 });
      const pollInterval = setInterval(() => { onRefresh(); }, 30_000);
      setTimeout(() => clearInterval(pollInterval), 90 * 60 * 1000);
      onRefresh();
    },
    onError: (err) => toast.error(`Avatar retry failed: ${err.message}`),
  });

  // Yoast-style traffic light helper
  const statusDot = (s: "green" | "amber" | "red") => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
      s === "green" ? "bg-emerald-500" : s === "amber" ? "bg-amber-400" : "bg-red-500"
    }`} />
  );

  return (
    <Card className="border border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/10">
              <Video className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <VideoStatusBadge status={job.status} />
                {isAvatar && (
                  <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-400 border-violet-500/20 flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    Avatar
                  </Badge>
                )}
                {(isInProgress || isRendering) && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-foreground font-medium text-sm truncate">
                {job.youtubeTitle ?? "Urban Monk Video"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Job #{job.id} · Created {new Date(job.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-muted-foreground"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* In-progress message */}
          {isInProgress && !isAvatar && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-300">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Descript is processing this video. The pipeline polls every 15 minutes — check back soon.</span>
            </div>
          )}

          {/* HeyGen rendering banner */}
          {isRendering && (
            <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded text-sm text-violet-300">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span className="font-medium">HeyGen is rendering the cartoon avatar video — typically 10–30 minutes.</span>
              </div>
              {job.heygenVideoId && (
                <p className="text-xs text-violet-400/80 mt-1">HeyGen Job ID: {job.heygenVideoId}</p>
              )}
              <p className="text-xs text-violet-400/70 mt-1">The dashboard polls every 30 seconds. Once complete, the video will be uploaded to YouTube automatically.</p>
            </div>
          )}

          {/* Error message */}
          {isFailed && job.errorMessage && (
            <div className="p-3 bg-red-900/20 border border-red-900/30 rounded text-sm text-primary">
              <p className="font-medium mb-1">Error:</p>
              <p className="font-mono text-xs">{job.errorMessage}</p>
            </div>
          )}

          {/* Video preview */}
          {job.s3VideoUrl && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Video Preview</p>
              {job.s3VideoUrl.startsWith('https://share.descript.com') ? (
                // Descript share URL — open in Descript viewer (can't embed inline)
                <div className="rounded-lg border border-border bg-muted/30 p-5 flex flex-col items-center gap-3 text-center">
                  <Video className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Video is ready. Preview it in Descript before approving.</p>
                  <a
                    href={job.s3VideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                  >
                    <Play className="w-4 h-4" /> Watch in Descript
                  </a>
                </div>
              ) : (
                // Direct MP4 URL — inline video player
                <>
                  <div className="rounded-lg overflow-hidden bg-foreground/5 border border-border">
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
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3 h-3" /> Open in new tab
                  </a>
                </>
              )}
            </div>
          )}

          {/* Descript project link */}
          {job.descriptShareUrl && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Descript Project:</span>
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
          <div className="space-y-3 bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">YouTube Metadata</p>
              {isReadyForReview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-7 px-2"
                  onClick={() => setShowEditMeta(true)}
                >
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Title</p>
              <p className="text-foreground text-sm font-medium">{job.youtubeTitle ?? "Urban Monk Video"}</p>
            </div>
            {job.youtubeDescription && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-foreground/80 text-xs line-clamp-3">{job.youtubeDescription}</p>
              </div>
            )}
            {job.youtubeTags && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(JSON.parse(job.youtubeTags) as string[]).slice(0, 8).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-secondary text-foreground/80 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* YouTube video link — shown as soon as we have a video ID (unlisted or published) */}
          {job.youtubeVideoId && (
            <div className="p-3 bg-red-600/10 border border-red-600/20 rounded space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Youtube className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span className="font-medium text-foreground">{isPublished ? "Published on YouTube:" : "Uploaded to YouTube (unlisted):"}</span>
                <a
                  href={`https://www.youtube.com/watch?v=${job.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline truncate text-red-600 hover:text-red-700"
                >
                  {`https://www.youtube.com/watch?v=${job.youtubeVideoId}`}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <a
                  href={`https://studio.youtube.com/video/${job.youtubeVideoId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 font-medium"
                >
                  <Youtube className="w-3 h-3" />
                  YouTube Studio
                </a>
                <a
                  href={`https://app.vidiq.com/youtube/video/${job.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 font-medium"
                >
                  <span className="font-bold text-[10px]">VIQ</span>
                  Optimize in vidIQ
                </a>
                <a
                  href={`https://www.youtube.com/watch?v=${job.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-muted text-muted-foreground hover:bg-muted/80 font-medium"
                >
                  View on YouTube
                </a>
              </div>
              {/* Blog <-> Video closed loop link */}
              {job.blogUrl && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <BookOpen className="w-3 h-3" />
                    <span className="font-medium">Blog Post</span>
                    {job.blogEmbedStatus === "embedded" && (
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">Video Embedded ✓</span>
                    )}
                  </div>
                  <a
                    href={job.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline truncate text-emerald-600 hover:text-emerald-700 text-xs"
                  >
                    {job.blogUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Uploading progress banner */}
          {isUploading && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-600">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span className="font-medium">Uploading to YouTube as unlisted — this typically takes 15–30 minutes for a full episode.</span>
              </div>
              <p className="text-xs text-amber-500/80 mb-2">The dashboard polls every 30 seconds. If it has been more than 30 minutes with no change, use the Reset button below.</p>
              <button
                onClick={() => {
                  if (confirm("Reset this job back to 'approved' so you can retry the upload?")) {
                    resetStuckJob.mutate({ jobId: job.id });
                  }
                }}
                disabled={resetStuckJob.isPending}
                className="text-xs px-3 py-1.5 rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-medium disabled:opacity-50"
              >
                {resetStuckJob.isPending ? "Resetting..." : "Reset Stuck Job"}
              </button>
            </div>
          )}

          {/* ── SEO Review Panel (uploaded_unlisted status) ─────────────────── */}
          {isUploadedUnlisted && (
            <div className="border border-amber-500/30 rounded-lg bg-amber-500/5 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700">SEO Optimization — Review Before Publishing</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Youtube className="w-3.5 h-3.5" />
                  <a
                    href={`https://studio.youtube.com/video/${job.youtubeVideoId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-700"
                  >
                    View in YouTube Studio ↗
                  </a>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* AI Generate button */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Use the Yoast-style SEO protocol to generate optimized copy, then review and edit before publishing.</p>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex-shrink-0 ml-3"
                    onClick={() => generateSeo.mutate({ jobId: job.id })}
                    disabled={generateSeo.isPending}
                  >
                    {generateSeo.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {generateSeo.isPending ? "Generating..." : "Generate AI SEO Copy"}
                  </Button>
                </div>

                {/* Title field with Yoast traffic light */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {statusDot(seoTitleStatus)}
                    <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      YouTube Title
                    </label>
                    <span className={`text-xs ml-auto ${
                      seoTitle.length <= 60 ? "text-emerald-600" : seoTitle.length <= 70 ? "text-amber-500" : "text-red-500"
                    }`}>
                      {seoTitle.length}/60 chars {seoTitle.length <= 60 ? "✓" : seoTitle.length <= 70 ? "(amber)" : "(too long)"}
                    </span>
                  </div>
                  <Input
                    value={seoTitle}
                    onChange={(e) => {
                      setSeoTitle(e.target.value);
                      const len = e.target.value.length;
                      setSeoTitleStatus(len <= 60 ? "green" : len <= 70 ? "amber" : "red");
                    }}
                    maxLength={100}
                    className="bg-muted border-border text-foreground text-sm"
                    placeholder="Focus keyword: Compelling benefit | The Urban Monk"
                  />
                </div>

                {/* Hook line (meta desc equivalent) with Yoast traffic light */}
                {seoHookLine && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {statusDot(seoHookStatus)}
                      <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
                        Hook Line (First Description Line)
                      </label>
                      <span className={`text-xs ml-auto ${
                        seoHookLine.length >= 140 && seoHookLine.length <= 155 ? "text-emerald-600"
                        : seoHookLine.length >= 120 && seoHookLine.length <= 160 ? "text-amber-500" : "text-red-500"
                      }`}>
                        {seoHookLine.length} chars (target: 140–155)
                      </span>
                    </div>
                    <Input
                      value={seoHookLine}
                      onChange={(e) => {
                        setSeoHookLine(e.target.value);
                        const len = e.target.value.length;
                        setSeoHookStatus(len >= 140 && len <= 155 ? "green" : len >= 120 && len <= 160 ? "amber" : "red");
                      }}
                      className="bg-muted border-border text-foreground text-sm"
                      placeholder="Focus keyword appears here first — 140-155 chars"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Appears before "Show More" in YouTube search results. Must start with focus keyword.</p>
                  </div>
                )}

                {/* Keywords row */}
                {(seoPrimaryKeyword || seoSecondaryKeyword) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Target className="w-3 h-3 text-primary" />
                        <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Focus Keyphrase</label>
                      </div>
                      <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded text-sm text-primary font-medium">
                        {seoPrimaryKeyword}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Target className="w-3 h-3 text-muted-foreground" />
                        <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Secondary Keyphrase</label>
                      </div>
                      <div className="px-3 py-2 bg-muted border border-border rounded text-sm text-foreground/80">
                        {seoSecondaryKeyword}
                      </div>
                    </div>
                  </div>
                )}

                {/* Semantic keywords */}
                {seoSemanticKeywords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Hash className="w-3 h-3 text-muted-foreground" />
                      <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Semantic Keywords (LSI)</label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {seoSemanticKeywords.map((kw) => (
                        <span key={kw} className="px-2 py-0.5 bg-secondary text-foreground/70 rounded text-xs border border-border">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full description */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Full Description</label>
                    <span className="text-xs text-muted-foreground ml-auto">{seoDescription.length} chars</span>
                  </div>
                  <Textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className="min-h-[180px] bg-muted border-border text-foreground text-xs font-mono"
                    placeholder="Full YouTube description: hook, value, timestamps, bio, CTA, links, hashtags"
                  />
                </div>

                {/* Tags */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Tags (comma-separated)</label>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {seoTags.split(",").filter(t => t.trim()).length} tags
                    </span>
                  </div>
                  <Input
                    value={seoTags}
                    onChange={(e) => setSeoTags(e.target.value)}
                    className="bg-muted border-border text-foreground text-sm"
                    placeholder="gut health protocol, sleep optimization, urban monk..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">Target: 15–20 tags, ordered most-specific to most-broad.</p>
                </div>

                {/* Pinned comment suggestion */}
                {seoPinnedComment && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageCircle className="w-3 h-3 text-muted-foreground" />
                      <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Suggested Pinned Comment</label>
                    </div>
                    <div className="px-3 py-2 bg-muted border border-border rounded text-xs text-foreground/80 italic">
                      "{seoPinnedComment}"
                    </div>
                    <button
                      className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                      onClick={() => { navigator.clipboard.writeText(seoPinnedComment); toast.success("Copied to clipboard"); }}
                    >
                      <Copy className="w-3 h-3" /> Copy to clipboard
                    </button>
                  </div>
                )}

                {/* Save + Publish actions */}
                <div className="flex gap-3 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm border-border text-foreground/80 hover:bg-muted"
                    onClick={() => saveSeoMeta.mutate({
                      jobId: job.id,
                      youtubeTitle: seoTitle || undefined,
                      youtubeDescription: seoDescription || undefined,
                      youtubeTags: seoTags ? seoTags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
                    })}
                    disabled={saveSeoMeta.isPending}
                  >
                    {saveSeoMeta.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Save Changes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-foreground text-sm flex-1"
                    onClick={() => makePublic.mutate({ jobId: job.id })}
                    disabled={makePublic.isPending || !seoTitle}
                  >
                    {makePublic.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {makePublic.isPending ? "Publishing..." : "Publish to YouTube (Make Public)"}
                  </Button>
                </div>

                {/* Yoast-style SEO score summary */}
                <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {statusDot(seoTitleStatus)}
                    <span>Title: {seoTitle.length <= 60 ? "Good" : seoTitle.length <= 70 ? "Needs trim" : "Too long"}</span>
                  </div>
                  {seoHookLine && (
                    <div className="flex items-center gap-1.5">
                      {statusDot(seoHookStatus)}
                      <span>Hook: {seoHookLine.length >= 140 && seoHookLine.length <= 155 ? "Perfect" : "Adjust length"}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {statusDot(seoTags.split(",").filter(t => t.trim()).length >= 15 ? "green" : seoTags.split(",").filter(t => t.trim()).length >= 8 ? "amber" : "red")}
                    <span>Tags: {seoTags.split(",").filter(t => t.trim()).length} (target 15+)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {/* Generate Avatar Video — shown for non-avatar jobs in pending/approved/failed/ready_for_review */}
            {!isAvatar && !isRendering && !isUploading && !isPublished && !isUploadedUnlisted && (
              <Button
                variant="outline"
                className="text-sm border-violet-500/40 text-violet-400 hover:bg-violet-950/30"
                onClick={() => {
                  if (confirm("Generate a cartoon avatar video from this script using HeyGen? This will use your HeyGen Creator plan quota (~15 min/month). The avatar video will be uploaded to YouTube automatically when done.")) {
                    generateAvatarVideo.mutate({ jobId: job.id });
                  }
                }}
                disabled={generateAvatarVideo.isPending}
                title="Generate a HeyGen cartoon avatar video from this script"
              >
                {generateAvatarVideo.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Bot className="w-4 h-4 mr-2" />
                )}
                {generateAvatarVideo.isPending ? "Starting Avatar Render..." : "Generate Avatar Video"}
              </Button>
            )}

            {/* Retry Avatar — for failed avatar jobs */}
            {isAvatar && isFailed && (
              <Button
                className="bg-violet-600 hover:bg-violet-700 text-foreground text-sm"
                onClick={() => {
                  if (confirm("Retry the HeyGen avatar render? This will start a fresh render and use additional HeyGen quota.")) {
                    retryAvatarVideo.mutate({ jobId: job.id });
                  }
                }}
                disabled={retryAvatarVideo.isPending}
              >
                {retryAvatarVideo.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                {retryAvatarVideo.isPending ? "Restarting Render..." : "Retry Avatar Render"}
              </Button>
            )}

            {(isReadyForReview || isUploading) && (
              <>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-foreground text-sm"
                  onClick={() => approveJob.mutate({ jobId: job.id })}
                  disabled={approveJob.isPending}
                >
                  {approveJob.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Youtube className="w-4 h-4 mr-2" />
                  )}
                  {approveJob.isPending ? "Queuing for YouTube..." : "Approve & Upload to YouTube"}
                </Button>
                <Button
                  variant="outline"
                  className="text-sm border-border text-foreground/80 hover:bg-muted"
                  onClick={() => setShowReject(true)}
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            {/* Approved / Failed / Pending (Queued) — show Upload to YouTube + Force Re-export */}
            {(isApproved || isFailed || isQueuedOrPending) && (
              <>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-foreground text-sm"
                  onClick={() => retryUploadToYouTube.mutate({ jobId: job.id })}
                  disabled={retryUploadToYouTube.isPending}
                >
                  {retryUploadToYouTube.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Youtube className="w-4 h-4 mr-2" />
                  )}
                  {retryUploadToYouTube.isPending ? "Queuing for YouTube..." : "Upload to YouTube"}
                </Button>
                {/* Force Re-export: bypasses cache, triggers fresh Descript export */}
                <Button
                  variant="outline"
                  className="text-sm border-amber-500/60 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => {
                    if (confirm("This will bypass the cached Descript URL and trigger a full fresh export (~15 min), then upload to YouTube automatically. Continue?")) {
                      forceReexport.mutate({ jobId: job.id });
                    }
                  }}
                  disabled={forceReexport.isPending || job.status === "uploading"}
                  title="Bypass cache and force a fresh Descript export, then upload to YouTube"
                >
                  {forceReexport.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {forceReexport.isPending ? "Re-exporting from Descript..." : "Force Re-export from Descript"}
                </Button>
                {isFailed && (
                  <Button
                    variant="outline"
                    className="text-sm border-border text-foreground/80 hover:bg-muted"
                    onClick={() => retryJob.mutate({ jobId: job.id })}
                    disabled={retryJob.isPending}
                    title="Reset job back to pending to re-run the full pipeline from scratch"
                  >
                    {retryJob.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Full Retry
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Reject Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Provide a reason for rejection (optional). The job will be marked as failed.</p>
            <Textarea
              placeholder="e.g. Audio quality issue, wrong B-roll, script error..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="bg-muted border-border text-foreground"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowReject(false)} className="text-muted-foreground">Cancel</Button>
              <Button
                className="bg-red-700 hover:bg-red-800 text-foreground"
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
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit YouTube Metadata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Title (max 100 chars)</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={100}
                className="bg-muted border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">{editTitle.length}/100</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[150px] bg-muted border-border text-foreground text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Tags (comma-separated)</label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="gut health, microbiome, urban monk..."
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowEditMeta(false)} className="text-muted-foreground">Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-foreground"
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
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"syndication" | "video">("syndication");
  const [syndicationFilter, setSyndicationFilter] = useState<"all" | "todo" | "done">("todo");
  const [videoFilter, setVideoFilter] = useState<"all" | "review" | "seo" | "published" | "failed">("review");

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
    if (videoFilter === "seo") return job.status === "uploaded_unlisted";
    if (videoFilter === "published") return job.status === "published";
    if (videoFilter === "failed") return job.status === "failed";
    return true;
  });

  const syndicationTodoCount = allSyndicationJobs.filter(
    (j) => j.status === "ready" || (j.status === "pending" && j.scheduledAt <= Date.now())
  ).length;
  const videoReviewCount = allVideoJobs.filter((j) => j.status === "ready_for_review" || j.status === "uploaded_unlisted").length;

  // Group syndication jobs by wordpress post
  const grouped = filteredSyndicationJobs.reduce<Record<string, SyndicationJob[]>>((acc, job) => {
    const key = job.wordpressTitle;
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                onClick={() => navigate("/blog-to-youtube")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Content Hub
              </button>
              <h1 className="text-2xl font-bold text-foreground">VA Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Content syndication queue and video review for The Urban Monk.
              </p>
            </div>
            <div className="flex gap-3 text-center flex-shrink-0">
              <div className="bg-muted rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-amber-400">{syndicationTodoCount}</p>
                <p className="text-xs text-muted-foreground">Posts to Syndicate</p>
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-red-400">{videoReviewCount}</p>
                <p className="text-xs text-muted-foreground">Videos to Review</p>
              </div>
            </div>
          </div>

          {/* Main tabs */}
          <div className="flex gap-1 mt-5 bg-muted/50 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab("syndication")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "syndication"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
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
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Video className="w-4 h-4" />
              Video Review
              {videoReviewCount > 0 && (
                <span className="bg-red-500 text-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
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
                  <p className="text-xs text-muted-foreground">{PLATFORM_CONFIG[p].ctaLabel}</p>
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
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {f === "todo" ? "To Do" : f === "done" ? "Completed" : "All Jobs"}
                </button>
              ))}
            </div>

            {syndicationLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading your queue...</span>
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {syndicationFilter === "todo" ? "All caught up!" : "No jobs found"}
                </h3>
                <p className="text-muted-foreground text-sm">
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
                      <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
                      <div className="flex-1 h-px bg-muted" />
                      <span className="text-xs text-muted-foreground flex-shrink-0">
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
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm font-semibold text-primary mb-2">Video Review Instructions</p>
              <ol className="space-y-1 text-xs text-muted-foreground">
                <li>1. Watch the full video in Descript. Check audio, B-roll, and captions.</li>
                <li>2. Click <strong className="text-foreground">Approve &amp; Upload to YouTube</strong> — uploads as <em>unlisted</em> automatically.</li>
                <li>3. Once uploaded, go to the <strong className="text-foreground">SEO Review</strong> tab — generate AI SEO copy using the Yoast protocol.</li>
                <li>4. Review and edit the title (≤60 chars), hook line (140–155 chars), description, and tags.</li>
                <li>5. Click <strong className="text-foreground">Publish to YouTube (Make Public)</strong> to go live.</li>
                <li>6. If the video has issues, click <strong className="text-foreground">Reject</strong> with a reason — the team will re-render.</li>
              </ol>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {(["review", "seo", "all", "published", "failed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setVideoFilter(f as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    videoFilter === f
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {f === "review" ? "Needs Review" : f === "seo" ? "SEO Review" : f === "published" ? "Published" : f === "failed" ? "Failed" : "All"}
                </button>
              ))}
            </div>

            {videoLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading video jobs...</span>
              </div>
            ) : filteredVideoJobs.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {videoFilter === "review" ? "No videos waiting for review" : "No videos found"}
                </h3>
                <p className="text-muted-foreground text-sm">
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
