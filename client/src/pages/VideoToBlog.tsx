import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
  ArrowLeft,
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
  ShieldCheck,
  BarChart2,
  AlertTriangle,
  Upload,
  FileUp,
  X,
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
  const [, navigate] = useLocation();
  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Manual transcript upload state (fallback when YouTube has no transcript)
  const [manualTranscript, setManualTranscript] = useState("");
  const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);
  const transcriptFileRef = useRef<HTMLInputElement>(null);

  // vidIQ keyword research state
  const [vidiqKeyword, setVidiqKeyword] = useState(""); // triggers the query
  const [showVidiqPanel, setShowVidiqPanel] = useState(false);

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
    needsReauth?: boolean;
  } | null>(null);

  const [ytDescResult, setYtDescResult] = useState<{ description: string } | null>(null);
  const [showArticlePreview, setShowArticlePreview] = useState(false);

  // YouTube OAuth status
  const { data: ytStatus } = trpc.videoToBlog.getYouTubeStatus.useQuery();
  const { data: ytAuthUrlData } = trpc.videoToBlog.getYouTubeAuthUrl.useQuery(
    undefined,
    { enabled: ytStatus !== undefined } // always fetch so Reconnect button works even when connected
  );

  // Duplicate detection: debounce the URL input by 600ms, then query the DB
  const [debouncedUrl, setDebouncedUrl] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUrl(youtubeUrl), 600);
    return () => clearTimeout(t);
  }, [youtubeUrl]);

  // Only run the check when the URL looks like a valid YouTube URL
  const looksLikeYouTubeUrl = debouncedUrl.includes("youtube.com") || debouncedUrl.includes("youtu.be");
  const { data: duplicateCheck } = trpc.videoToBlog.checkYouTubeDuplicate.useQuery(
    { youtubeUrl: debouncedUrl },
    { enabled: looksLikeYouTubeUrl && !videoInfo, staleTime: 30_000 }
  );

  // tRPC mutations
  const fetchVideoInfo = trpc.videoToBlog.fetchVideoInfo.useMutation({
    onSuccess: (data) => {
      setVideoInfo(data);
      // Use LLM-suggested keyword from server if available; fall back to title-based suggestion
      if (!focusKeyword) {
        if (data.suggestedKeyword && data.suggestedKeyword.length > 2) {
          setFocusKeyword(data.suggestedKeyword);
        } else if (data.title) {
          // Strip channel suffix (" | The Urban Monk", " | Urban Monk", etc.) and take first 4 words
          const cleanTitle = data.title.replace(/\s*[|\-–—].*$/, "").trim();
          const words = cleanTitle.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
          setFocusKeyword(words);
        }
      }
      if (!data.hasTranscript) {
        toast.warning("No transcript found for this video. The blog will be generated from the title and description only.");
      } else {
        toast.success(`Transcript fetched — ${data.transcriptLength.toLocaleString()} characters`);
        // Kick off vidIQ keyword optimization using the LLM-suggested keyword
        if (data.suggestedKeyword && data.suggestedKeyword.length > 2) {
          vidiqSuggest.mutate({
            videoTitle: data.title,
            suggestedKeyword: data.suggestedKeyword,
          });
        }
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

  const utils = trpc.useUtils();
  const updateYtDesc = trpc.videoToBlog.updateYouTubeDescription.useMutation({
    onSuccess: (data) => {
      setYtUpdateResult(data);
      if (data.success) {
        toast.success("Blog URL pushed to YouTube description!");
      } else if (data.needsReauth) {
        // Token was cleared on the server — refetch status so the reconnect banner appears
        utils.videoToBlog.getYouTubeStatus.invalidate();
        utils.videoToBlog.getYouTubeAuthUrl.invalidate();
        toast.error("YouTube token expired — please reconnect your account.");
      } else {
        toast.error(data.error ?? "YouTube description update failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // vidIQ keyword research — fires when vidiqKeyword is set
  const vidiqResearch = trpc.vidiq.keywordResearch.useQuery(
    { keyword: vidiqKeyword, includeRelated: true },
    { enabled: vidiqKeyword.length > 2, staleTime: 5 * 60 * 1000 }
  );

  // vidIQ suggest best focus keyword from transcript
  const vidiqSuggest = trpc.vidiq.suggestFocusKeyword.useMutation({
    onSuccess: (data) => {
      if (data.recommended.keyword) {
        setFocusKeyword(data.recommended.keyword);
        setVidiqKeyword(data.recommended.keyword);
        setShowVidiqPanel(true);
        toast.success(`vidIQ: best keyword is "${data.recommended.keyword}" (score ${Math.round(data.recommended.overall)}/100)`);
      }
    },
    onError: () => {
      // silently fall back — LLM suggestion already set
    },
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
    setManualTranscript("");
    setShowTranscriptUpload(false);
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Hub
          </Button>
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

      {/* YouTube OAuth connect banner */}
      {ytStatus && !ytStatus.authorized && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Connect YouTube to enable Step 4</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Authorize the YouTube channel once so the tool can push blog URLs directly to video descriptions.</p>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              if (ytAuthUrlData?.url) window.location.href = ytAuthUrlData.url;
              else toast.error("Could not get YouTube auth URL — check that GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are set in Secrets.");
            }}
          >
            <Youtube className="w-3.5 h-3.5 mr-1.5" />
            Connect YouTube
          </Button>
        </div>
      )}
      {ytStatus?.authorized && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/30 dark:border-green-800">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-800 dark:text-green-300 font-medium flex-1">
            YouTube connected{ytStatus.channelTitle ? ` — ${ytStatus.channelTitle}` : ""} — Step 4 will push blog URLs automatically
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs h-7 px-2 border-green-400 text-green-800 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/40"
            onClick={() => {
              if (ytAuthUrlData?.url) window.location.href = ytAuthUrlData.url;
              else toast.error("Could not get YouTube auth URL — check that GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are set in Secrets.");
            }}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reconnect
          </Button>
        </div>
      )}

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

          {/* Duplicate detection warning */}
          {duplicateCheck?.duplicate && !videoInfo && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Already done — this video has been converted to a blog post.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 line-clamp-1">
                  <span className="font-medium">{duplicateCheck.duplicate.title}</span>
                  {duplicateCheck.duplicate.focusKeyword && (
                    <span className="ml-2 opacity-75">· 🎯 {duplicateCheck.duplicate.focusKeyword}</span>
                  )}
                  <span className="ml-2 opacity-75">
                    · {new Date(duplicateCheck.duplicate.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge
                    variant={duplicateCheck.duplicate.status === "published" ? "default" : "secondary"}
                    className="text-xs capitalize"
                  >
                    {duplicateCheck.duplicate.status}
                  </Badge>
                  {duplicateCheck.duplicate.publishUrl && (
                    <a
                      href={duplicateCheck.duplicate.publishUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View live post
                    </a>
                  )}
                  <span className="text-xs text-amber-600 dark:text-amber-500">
                    You can still proceed to generate a new version.
                  </span>
                </div>
              </div>
            </div>
          )}

          {videoInfo && (
            <div className="space-y-3">
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
                        : manualTranscript
                          ? `✓ Manual transcript (${(manualTranscript.length / 1000).toFixed(1)}k chars)`
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

              {/* Manual transcript upload — shown when YouTube has no transcript */}
              {!videoInfo.hasTranscript && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">No transcript found on YouTube</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          Upload or paste the transcript below to generate a full blog post.
                        </p>
                      </div>
                    </div>
                    {manualTranscript && (
                      <button
                        onClick={() => { setManualTranscript(""); setShowTranscriptUpload(false); }}
                        className="text-xs text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 flex items-center gap-1 shrink-0"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  {!showTranscriptUpload && !manualTranscript && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                        onClick={() => transcriptFileRef.current?.click()}
                      >
                        <FileUp className="w-4 h-4 mr-2" />
                        Upload .txt / .srt file
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                        onClick={() => setShowTranscriptUpload(true)}
                      >
                        <AlignLeft className="w-4 h-4 mr-2" />
                        Paste transcript
                      </Button>
                      <input
                        ref={transcriptFileRef}
                        type="file"
                        accept=".txt,.srt,.vtt,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const text = ev.target?.result as string;
                            setManualTranscript(text.trim());
                            setShowTranscriptUpload(false);
                            toast.success(`Transcript loaded — ${(text.length / 1000).toFixed(1)}k characters`);
                          };
                          reader.readAsText(file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}

                  {showTranscriptUpload && !manualTranscript && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Paste the full transcript here…"
                        rows={8}
                        className="text-sm font-mono resize-y bg-white dark:bg-gray-900 border-amber-300 dark:border-amber-700"
                        autoFocus
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            setManualTranscript(e.target.value.trim());
                            setShowTranscriptUpload(false);
                            toast.success(`Transcript saved — ${(e.target.value.trim().length / 1000).toFixed(1)}k characters`);
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={(e) => {
                            const ta = (e.currentTarget.closest('.space-y-2') as HTMLElement)?.querySelector('textarea') as HTMLTextAreaElement;
                            if (ta?.value.trim()) {
                              setManualTranscript(ta.value.trim());
                              setShowTranscriptUpload(false);
                              toast.success(`Transcript saved — ${(ta.value.trim().length / 1000).toFixed(1)}k characters`);
                            } else {
                              toast.error("Transcript is empty");
                            }
                          }}
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" /> Save Transcript
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowTranscriptUpload(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {manualTranscript && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Transcript ready — {(manualTranscript.length / 1000).toFixed(1)}k characters. Blog generation will use this transcript.
                    </div>
                  )}
                </div>
              )}
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Focus Keyword
                  <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">(required for Yoast SEO)</span>
                </label>
                {vidiqSuggest.isPending && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking vidIQ…
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. kung fu philosophy, intermittent fasting benefits"
                  value={focusKeyword}
                  onChange={(e) => {
                    setFocusKeyword(e.target.value);
                    setVidiqKeyword(e.target.value);
                  }}
                  disabled={generateBlog.isPending || !!blogResult}
                  className={!focusKeyword && videoInfo ? "border-amber-400 ring-1 ring-amber-400/50" : ""}
                />
                {focusKeyword.length > 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => {
                      setVidiqKeyword(focusKeyword);
                      setShowVidiqPanel(true);
                    }}
                    title="Research this keyword in vidIQ"
                  >
                    <BarChart2 className="w-3.5 h-3.5 mr-1" />
                    vidIQ
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                2–4 words. Used by Yoast to check your intro, subheadings, and meta description.
                {videoInfo && focusKeyword && !vidiqSuggest.isPending && (
                  <span className="text-green-600 dark:text-green-400 font-medium"> — vidIQ-optimized keyword.</span>
                )}
              </p>

              {/* vidIQ Keyword Research Panel */}
              {showVidiqPanel && vidiqResearch.data && (
                <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">vidIQ Keyword Data</span>
                    <button onClick={() => setShowVidiqPanel(false)} className="text-xs text-muted-foreground hover:text-foreground">× close</button>
                  </div>

                  {/* Primary keyword scores */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-background border border-border p-2">
                      <div className="text-lg font-bold text-foreground">{Math.round(vidiqResearch.data.volume)}</div>
                      <div className="text-xs text-muted-foreground">Volume</div>
                    </div>
                    <div className="rounded-md bg-background border border-border p-2">
                      <div className="text-lg font-bold text-foreground">{Math.round(vidiqResearch.data.competition)}</div>
                      <div className="text-xs text-muted-foreground">Competition</div>
                    </div>
                    <div className={`rounded-md border p-2 ${
                      vidiqResearch.data.overall >= 60 ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700" :
                      vidiqResearch.data.overall >= 40 ? "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700" :
                      "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700"
                    }`}>
                      <div className={`text-lg font-bold ${
                        vidiqResearch.data.overall >= 60 ? "text-green-700 dark:text-green-400" :
                        vidiqResearch.data.overall >= 40 ? "text-amber-700 dark:text-amber-400" :
                        "text-red-700 dark:text-red-400"
                      }`}>{Math.round(vidiqResearch.data.overall)}</div>
                      <div className="text-xs text-muted-foreground">Opportunity</div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    ~{vidiqResearch.data.estimatedMonthlySearch.toLocaleString()} searches/month
                  </div>

                  {/* Related keywords */}
                  {vidiqResearch.data.related.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Related keywords — click to use:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {vidiqResearch.data.related.slice(0, 8).map((r) => (
                          <button
                            key={r.keyword}
                            onClick={() => {
                              setFocusKeyword(r.keyword);
                              setVidiqKeyword(r.keyword);
                            }}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors hover:bg-primary hover:text-primary-foreground ${
                              focusKeyword === r.keyword
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border text-foreground"
                            }`}
                            title={`Volume: ${Math.round(r.volume)} | Competition: ${Math.round(r.competition)} | Score: ${Math.round(r.overall)}`}
                          >
                            {r.keyword} <span className="opacity-60">{Math.round(r.overall)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showVidiqPanel && vidiqResearch.isLoading && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading vidIQ data…
                </div>
              )}
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
                onClick={() => {
                  if (!focusKeyword.trim()) {
                    toast.warning("No focus keyword set — Yoast SEO checks will be skipped. Add a 2–4 word keyword for best results.");
                  }
                  generateBlog.mutate({
                    videoId: videoInfo.videoId,
                    videoTitle: videoInfo.title,
                    transcript: manualTranscript || videoInfo.transcript,
                    customInstructions: customInstructions || undefined,
                    focusKeyword: focusKeyword.trim() || undefined,
                  });
                }}
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
                       thumbnailUrl: videoInfo?.thumbnail,
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {ytUpdateResult.needsReauth
                      ? "Your YouTube authorization has expired. Please reconnect to continue."
                      : ytUpdateResult.error}
                  </p>
                  {(ytUpdateResult.needsReauth || (ytStatus && !ytStatus.authorized)) && (
                    <Button
                      size="sm"
                      className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        if (ytAuthUrlData?.url) window.location.href = ytAuthUrlData.url;
                        else toast.error("Could not get YouTube auth URL — check that GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are set in Secrets.");
                      }}
                    >
                      <Youtube className="w-3.5 h-3.5 mr-1.5" />
                      Reconnect YouTube Account
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Or manually add this link to the YouTube description:
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
