import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Youtube,
  FileText,
  Globe,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ExternalLink,
  RefreshCw,
  Clock,
  BookOpen,
  Link2,
  ChevronDown,
  ChevronUp,
  AlignLeft,
  Copy,
} from "lucide-react";

// ── Step indicator ────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done" | "error";

function StepBadge({ step, status }: { step: number; status: StepStatus }) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0";
  if (status === "done") return <div className={`${base} bg-emerald-500 text-white`}><CheckCircle2 className="w-4 h-4" /></div>;
  if (status === "active") return <div className={`${base} bg-amber-500 text-white`}><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (status === "error") return <div className={`${base} bg-red-500 text-white`}>!</div>;
  return <div className={`${base} bg-muted text-muted-foreground`}>{step}</div>;
}

// ── Recent items list ─────────────────────────────────────────────────────────

function RecentVideoBlogs() {
  const { data, isLoading } = trpc.videoToBlog.listVideoBlogs.useQuery();

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading recent items…</div>;
  if (!data?.items.length) return (
    <div className="text-sm text-muted-foreground italic">No YouTube → Blog items yet. Generate your first one above.</div>
  );

  return (
    <div className="space-y-2">
      {data.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.focusKeyword && <span className="mr-2">🎯 {item.focusKeyword}</span>}
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={item.wpPostId ? "default" : "secondary"} className="text-xs">
              {item.wpPostId ? "Published to WP" : "Draft"}
            </Badge>
            {item.youtubeVideoId && (
              <a
                href={`https://www.youtube.com/watch?v=${item.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VideoToBlog() {
  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pipeline state
  const [videoInfo, setVideoInfo] = useState<{
    videoId: string;
    title: string;
    description: string;
    channelName: string;
    thumbnail: string;
    transcript: string;
    transcriptLength: number;
    hasTranscript: boolean;
  } | null>(null);

  const [blogResult, setBlogResult] = useState<{
    contentItemId?: number;
    videoId: string;
    title: string;
    slug: string;
    metaDescription: string;
    focusKeyword: string;
    article: string;
    articleWithEmbed: string;
    embedHtml: string;
    wordCount: number;
  } | null>(null);

  const [wpResult, setWpResult] = useState<{
    wpPostId: number;
    link: string;
    editLink: string;
    status: string;
  } | null>(null);

  const [ytUpdateResult, setYtUpdateResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const [ytDescResult, setYtDescResult] = useState<{ description: string } | null>(null);
  const [showArticlePreview, setShowArticlePreview] = useState(false);

  // tRPC mutations
  const fetchVideoInfo = trpc.videoToBlog.fetchVideoInfo.useMutation({
    onSuccess: (data) => {
      setVideoInfo(data);
      if (!data.hasTranscript) {
        toast.warning("No transcript found for this video. The blog will be generated from the title and description only.");
      } else {
        toast.success(`Transcript fetched — ${data.transcriptLength.toLocaleString()} characters`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const generateBlog = trpc.videoToBlog.generateBlogFromVideo.useMutation({
    onSuccess: (data) => {
      setBlogResult(data);
      toast.success(`Blog generated — ${data.wordCount.toLocaleString()} words`);
    },
    onError: (err) => toast.error(err.message),
  });

  const publishToWP = trpc.videoToBlog.publishToWordPress.useMutation({
    onSuccess: (data) => {
      setWpResult(data);
      toast.success("Published to WordPress as draft!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateYtDesc = trpc.videoToBlog.updateYouTubeDescription.useMutation({
    onSuccess: (data) => {
      setYtUpdateResult(data);
      if (data.success) {
        toast.success("Blog URL pushed to YouTube description!");
      } else {
        toast.error(data.error ?? "YouTube description update failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const generateYtDesc = trpc.videoToBlog.generateYouTubeDescription.useMutation({
    onSuccess: (data) => {
      setYtDescResult(data);
      toast.success("YouTube description generated — ready to copy!");
    },
    onError: (err) => toast.error(err.message),
  });

  // Step statuses
  const step1Status: StepStatus = fetchVideoInfo.isPending ? "active" : videoInfo ? "done" : "pending";
  const step2Status: StepStatus = generateBlog.isPending ? "active" : blogResult ? "done" : videoInfo ? "pending" : "pending";
  const step3Status: StepStatus = publishToWP.isPending ? "active" : wpResult ? "done" : blogResult ? "pending" : "pending";
  const step4Status: StepStatus = updateYtDesc.isPending ? "active" : ytUpdateResult?.success ? "done" : ytUpdateResult?.error ? "error" : wpResult ? "pending" : "pending";
  const step5Status: StepStatus = generateYtDesc.isPending ? "active" : ytDescResult ? "done" : videoInfo ? "pending" : "pending";

  const handleReset = () => {
    setYoutubeUrl("");
    setVideoInfo(null);
    setBlogResult(null);
    setWpResult(null);
    setYtUpdateResult(null);
    setYtDescResult(null);
    setCustomInstructions("");
    setFocusKeyword("");
    fetchVideoInfo.reset();
    generateBlog.reset();
    publishToWP.reset();
    updateYtDesc.reset();
    generateYtDesc.reset();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Youtube className="w-6 h-6 text-red-500" />
            YouTube → Blog Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            Paste a YouTube URL to automatically generate a matching SEO blog post with the video embedded, publish it to WordPress, and push the blog link back into the YouTube description.
          </p>
        </div>
        {(videoInfo || blogResult) && (
          <Button variant="outline" size="sm" onClick={handleReset} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Start Over
          </Button>
        )}
      </div>

      {/* Pipeline Steps Overview */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { step: 1, label: "Fetch Video", icon: Youtube, status: step1Status },
          { step: 2, label: "Generate Blog", icon: FileText, status: step2Status },
          { step: 3, label: "Publish to WP", icon: Globe, status: step3Status },
          { step: 4, label: "Update YouTube", icon: Link2, status: step4Status },
          { step: 5, label: "YT Description", icon: AlignLeft, status: step5Status },
        ].map(({ step, label, icon: Icon, status }) => (
          <div
            key={step}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
              status === "done" ? "border-emerald-500/40 bg-emerald-500/5" :
              status === "active" ? "border-amber-500/40 bg-amber-500/5" :
              status === "error" ? "border-red-500/40 bg-red-500/5" :
              "border-border bg-muted/20"
            }`}
          >
            <StepBadge step={step} status={status} />
            <span className="text-xs text-center text-muted-foreground font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Enter YouTube URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <StepBadge step={1} status={step1Status} />
            Fetch Video Info & Transcript
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={fetchVideoInfo.isPending || !!videoInfo}
              className="font-mono text-sm"
            />
            <Button
              onClick={() => fetchVideoInfo.mutate({ youtubeUrl })}
              disabled={!youtubeUrl.trim() || fetchVideoInfo.isPending || !!videoInfo}
            >
              {fetchVideoInfo.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Fetching…</>
              ) : (
                <><ArrowRight className="w-4 h-4 mr-1.5" />Fetch</>
              )}
            </Button>
          </div>

          {videoInfo && (
            <div className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-32 h-20 object-cover rounded-md shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="min-w-0">
                <p className="font-semibold text-sm line-clamp-2">{videoInfo.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{videoInfo.channelName}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant={videoInfo.hasTranscript ? "default" : "secondary"} className="text-xs">
                    {videoInfo.hasTranscript
                      ? `✓ Transcript (${(videoInfo.transcriptLength / 1000).toFixed(1)}k chars)`
                      : "No transcript"}
                  </Badge>
                  <a
                    href={`https://www.youtube.com/watch?v=${videoInfo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on YouTube
                  </a>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Generate Blog */}
      {videoInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge step={2} status={step2Status} />
              Generate SEO Blog Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Focus Keyword <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="e.g. intermittent fasting benefits"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                disabled={generateBlog.isPending || !!blogResult}
              />
            </div>

            <button
              className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Advanced options
            </button>

            {showAdvanced && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  placeholder="e.g. Emphasize the Qigong breathing technique mentioned at 8:30. Add a section on morning routines."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  disabled={generateBlog.isPending || !!blogResult}
                  rows={3}
                />
              </div>
            )}

            {!blogResult ? (
              <Button
                onClick={() =>
                  generateBlog.mutate({
                    videoId: videoInfo.videoId,
                    videoTitle: videoInfo.title,
                    transcript: videoInfo.transcript,
                    customInstructions: customInstructions || undefined,
                    focusKeyword: focusKeyword || undefined,
                  })
                }
                disabled={generateBlog.isPending}
                className="w-full"
              >
                {generateBlog.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Generating blog post… (30–60 seconds)</>
                ) : (
                  <><FileText className="w-4 h-4 mr-1.5" />Generate Blog Post</>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold text-sm">{blogResult.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{blogResult.wordCount.toLocaleString()} words</span>
                    {blogResult.focusKeyword && <span className="flex items-center gap-1">🎯 {blogResult.focusKeyword}</span>}
                    {blogResult.metaDescription && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{blogResult.metaDescription.length} char meta</span>}
                  </div>
                  {blogResult.metaDescription && (
                    <p className="text-xs text-muted-foreground italic">"{blogResult.metaDescription}"</p>
                  )}
                </div>

                <button
                  className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => setShowArticlePreview(!showArticlePreview)}
                >
                  {showArticlePreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showArticlePreview ? "Hide" : "Preview"} article
                </button>

                {showArticlePreview && (
                  <Textarea
                    value={blogResult.article}
                    readOnly
                    rows={20}
                    className="font-mono text-xs"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Publish to WordPress */}
      {blogResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge step={3} status={step3Status} />
              Publish to WordPress (Draft)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!wpResult ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The blog post will be published to <strong>theurbanmonk.com</strong> as a draft with the YouTube video embedded at the top. You can review and publish it from the WordPress editor.
                </p>
                <Button
                  onClick={() =>
                    publishToWP.mutate({
                      contentItemId: blogResult.contentItemId,
                      videoId: blogResult.videoId,
                      title: blogResult.title,
                      slug: blogResult.slug,
                      article: blogResult.article,
                      embedHtml: blogResult.embedHtml,
                      metaDescription: blogResult.metaDescription,
                      focusKeyword: blogResult.focusKeyword,
                    })
                  }
                  disabled={publishToWP.isPending}
                  className="w-full"
                >
                  {publishToWP.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Publishing to WordPress…</>
                  ) : (
                    <><Globe className="w-4 h-4 mr-1.5" />Publish as Draft</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-sm">Published as draft (WP ID: {wpResult.wpPostId})</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={wpResult.editLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Edit in WordPress
                    </Button>
                  </a>
                  <a
                    href={wpResult.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Globe className="w-3.5 h-3.5 mr-1.5" />
                      Preview Post
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Push blog URL to YouTube description */}
      {wpResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge step={4} status={step4Status} />
              Push Blog URL to YouTube Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ytUpdateResult ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will prepend the following line to the YouTube video description:
                </p>
                <div className="p-3 rounded-md bg-muted font-mono text-xs">
                  📖 Read the full article: {blogResult?.title}<br />
                  {wpResult.link}
                </div>
                <Button
                  onClick={() =>
                    updateYtDesc.mutate({
                      videoId: videoInfo!.videoId,
                      blogUrl: wpResult.link,
                      blogTitle: blogResult!.title,
                      contentItemId: blogResult?.contentItemId,
                    })
                  }
                  disabled={updateYtDesc.isPending}
                  className="w-full"
                >
                  {updateYtDesc.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Updating YouTube description…</>
                  ) : (
                    <><Youtube className="w-4 h-4 mr-1.5" />Push Blog URL to YouTube</>
                  )}
                </Button>
              </div>
            ) : ytUpdateResult.success ? (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Blog URL added to YouTube description!</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">YouTube update failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{ytUpdateResult.error}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    You can manually add this link to the YouTube description:
                  </p>
                  <div className="mt-2 p-2 rounded bg-muted font-mono text-xs break-all">
                    📖 Read the full article: {blogResult?.title}{"\n"}{wpResult.link}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success summary */}
      {ytUpdateResult?.success && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Closed loop complete! 🎉</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The blog post is live on WordPress as a draft with the video embedded, and the blog URL has been added to the YouTube description. The video and blog post now point to each other.
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <a href={wpResult?.editLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Globe className="w-3.5 h-3.5 mr-1.5" />
                      Edit WordPress Draft
                    </Button>
                  </a>
                  <a href={`https://www.youtube.com/watch?v=${videoInfo?.videoId}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Youtube className="w-3.5 h-3.5 mr-1.5" />
                      View YouTube Video
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Process Another Video
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Generate SEO YouTube Description */}
      {videoInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge step={5} status={step5Status} />
              Generate SEO YouTube Description
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a fully optimized YouTube description using the Urban Monk framework (Hook → Body → Timestamps → Channel Footer).
              {wpResult && " The blog post URL will be automatically injected as a CTA."}
            </p>
            {!ytDescResult ? (
              <Button
                onClick={() =>
                  generateYtDesc.mutate({
                    videoId: videoInfo.videoId,
                    videoTitle: videoInfo.title,
                    transcript: videoInfo.transcript,
                    blogUrl: wpResult?.link,
                    blogTitle: blogResult?.title,
                  })
                }
                disabled={generateYtDesc.isPending}
                className="w-full"
              >
                {generateYtDesc.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Generating description…</>
                ) : (
                  <><AlignLeft className="w-4 h-4 mr-1.5" />Generate YouTube Description</>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Description ready
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(ytDescResult.description);
                      toast.success("Copied to clipboard!");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy to Clipboard
                  </Button>
                </div>
                <Textarea
                  value={ytDescResult.description}
                  onChange={(e) => setYtDescResult({ description: e.target.value })}
                  className="font-mono text-xs min-h-[320px] resize-y"
                  placeholder="Generated description will appear here…"
                />
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={`https://studio.youtube.com/video/${videoInfo.videoId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Open YouTube Studio
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setYtDescResult(null);
                      generateYtDesc.reset();
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can edit the description above before copying. Click "Open YouTube Studio" to paste it directly into your video.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Recent items */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent YouTube → Blog Items</h2>
        <RecentVideoBlogs />
      </div>
    </div>
  );
}
