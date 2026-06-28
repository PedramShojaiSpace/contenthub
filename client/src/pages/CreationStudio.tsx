import DashboardLayout from "@/components/DashboardLayout";
import { Link , useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Facebook,
  Image,
  Linkedin,
  Loader2,
  Music2,
  Paperclip,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Twitter,
  Wand2,
  Youtube,
  Zap,
  LayoutGrid,
  BookMarked,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { slidesToDataUrls, type CarouselSlideData, type SlideType } from "@/components/CarouselSlideRenderer";
import { FlaskConical, Globe, Target, Swords, ArrowRight, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// Diagnostic component to show raw Buffer API response
function BufferDiagnostic() {
  const [show, setShow] = useState(false);
  const diagnose = trpc.syndication.diagnose.useQuery(undefined, {
    enabled: show,
    retry: false,
  });

  return (
    <div className="mt-2">
      <Button
        variant="outline"
        size="sm"
        className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
        onClick={() => setShow(true)}
        disabled={diagnose.isFetching}
      >
        {diagnose.isFetching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        Run Buffer Diagnostic
      </Button>
      {diagnose.data && (
        <div className="mt-2 p-2 rounded bg-black/30 text-xs font-mono text-amber-300 break-all whitespace-pre-wrap max-h-40 overflow-y-auto">
          <div>HTTP Status: {diagnose.data.status}</div>
          <div>Token present: {diagnose.data.tokenPresent ? "yes" : "no"}</div>
          <div>Response: {diagnose.data.body}</div>
        </div>
      )}
    </div>
  );
}

type Platform = "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "reframe" | "carousel" | "all";

// Per-platform generated output: text + auto-generated image
type PlatformOutput = {
  text: string;
  imageUrl?: string;
  title?: string;
};

const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "all", label: "All Platforms", icon: <Sparkles className="h-4 w-4" />, color: "text-primary" },
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-4 w-4" />, color: "text-sky-400" },
  { key: "meta", label: "Meta", icon: <Facebook className="h-4 w-4" />, color: "text-blue-400" },
  { key: "x", label: "X (Twitter)", icon: <Twitter className="h-4 w-4" />, color: "text-slate-300" },
  { key: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4" />, color: "text-red-400" },
  { key: "tiktok", label: "TikTok", icon: <Music2 className="h-4 w-4" />, color: "text-pink-400" },
  { key: "blog", label: "Blog Post", icon: <BookOpen className="h-4 w-4" />, color: "text-emerald-400" },
  { key: "reframe", label: "Reframe Post", icon: <LayoutGrid className="h-4 w-4" />, color: "text-violet-400" },
  { key: "carousel", label: "Carousel", icon: <LayoutGrid className="h-4 w-4" />, color: "text-fuchsia-400" },
];

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  meta: "Meta (Instagram/Facebook)",
  x: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  blog: "Blog Post (theurbanmonk.com)",
  reframe: "Reframe Post (Carousel)",
  carousel: "Carousel Post (Meta/LinkedIn)",
};

const PLATFORM_STYLE_LABELS: Record<string, { label: string; description: string }> = {
  linkedin: {
    label: "Corporate Wellness",
    description: "Bright, airy editorial — warm cream, terracotta accents, clarity & expertise",
  },
  meta: {
    label: "Lifestyle & Aspiration",
    description: "Warm, uplifting, authentic — sage greens, terracotta, golden morning light",
  },
  x: {
    label: "Bold & Clean",
    description: "High-contrast but bright — warm accent on light background, thought-provoking",
  },
  youtube: {
    label: "Inspiring Documentary",
    description: "Golden-hour warmth — inviting light, uplifting wellness documentary feel",
  },
  all: {
    label: "Urban Monk Signature",
    description: "Warm, bright, inspirational — golden light, sage greens, timeless wellness editorial",
  },
  tiktok: {
    label: "Kinetic & Bold",
    description: "High-energy vertical frame — vibrant warm colors, dynamic composition, hook-first visual storytelling",
  },
  blog: {
    label: "Editorial Feature",
    description: "Warm editorial hero — golden morning light, sage tones, uplifting & contemplative",
  },
};

export default function CreationStudio() {
  const [, navigate] = useLocation();
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null);
  const [selectedContentGoal, setSelectedContentGoal] = useState<"audience_growth" | "llm_seo" | "community_engagement" | null>(null);
  const [utmContentOverride, setUtmContentOverride] = useState<string>(""); // "" = use platform default

  // New unified state: each platform key maps to { text, imageUrl }
  const [generatedContent, setGeneratedContent] = useState<Record<string, PlatformOutput>>({});
  const [editedText, setEditedText] = useState<Record<string, string>>({});

  // Per-platform regenerating image state
  const [regeneratingImageFor, setRegeneratingImageFor] = useState<string | null>(null);

  // Manual image generator (separate section)
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [imageStylePlatform, setImageStylePlatform] = useState<Platform>("all");
  const [showStyleDetails, setShowStyleDetails] = useState(false);
  const [styleOverride, setStyleOverride] = useState("");

  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [savedItemIds, setSavedItemIds] = useState<Record<string, number>>({});
  const [attachingImage, setAttachingImage] = useState(false);
  const [attachedToIds, setAttachedToIds] = useState<number[]>([]);

  // Teleprompter script state
  const [teleprompterScript, setTeleprompterScript] = useState<string | null>(null);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [generatingTeleprompter, setGeneratingTeleprompter] = useState(false);

  // Blog → YouTube script state (generated after WP publish)
  const [blogYtScript, setBlogYtScript] = useState<string | null>(null);
  const [generatingBlogYtScript, setGeneratingBlogYtScript] = useState(false);
  const [blogYtScriptSaved, setBlogYtScriptSaved] = useState(false);

  // Video pipeline modal state
  const [showVideoPipelineModal, setShowVideoPipelineModal] = useState(false);
  const [videoPipelinePath, setVideoPipelinePath] = useState<"heygen_then_descript" | "heygen_only" | "descript_only">("heygen_then_descript");
  const [videoPipelineChannels, setVideoPipelineChannels] = useState<string[]>(["youtube"]);
  const [videoPipelineLaunched, setVideoPipelineLaunched] = useState(false);

  // Substack toggle: whether to cross-post this blog to Substack on WP publish
  const [sendToSubstack, setSendToSubstack] = useState(false);
  const [substackPublishResult, setSubstackPublishResult] = useState<{ postUrl: string; postId: string } | null>(null);

  // TikTok 60-second script state
  const [tiktokScript60, setTiktokScript60] = useState<string | null>(null);
  const [generatingTiktok60, setGeneratingTiktok60] = useState(false);
  const [tiktok60Saved, setTiktok60Saved] = useState(false);

  // Buffer syndication state
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [syndicatingPlatform, setSyndicatingPlatform] = useState<string | null>(null);
  const [syndicationResults, setSyndicationResults] = useState<Record<string, { success: boolean; error?: string }>>({})
  // Meta format selector (post / story) — required by Buffer API for facebook/instagram
  // Reels are video-only and must be uploaded manually from Descript — not supported via Buffer here
  const [metaPostType, setMetaPostType] = useState<"post" | "story">("post");

  // ── YouTube Competitive Intelligence state ──────────────────────────────────
  type YTVideo = {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    duration: number;
    viewCount: number;
    uploadDate: string;
    channelName: string;
    channelId: string;
    url: string;
  };
  type YTTranscript = { videoId: string; text: string; lang: string; error?: string };

  const [showYTPanel, setShowYTPanel] = useState(false);
  const [ytSearchQuery, setYtSearchQuery] = useState("");
  const [ytVideos, setYtVideos] = useState<YTVideo[]>([]);
  const [ytSelectedIds, setYtSelectedIds] = useState<string[]>([]);
  const [ytTranscripts, setYtTranscripts] = useState<YTTranscript[]>([]);
  const [ytBrief, setYtBrief] = useState("");
  const [ytStep, setYtStep] = useState<"idle" | "searched" | "transcripts" | "brief">("idle");
  const [ytGeneratedScript, setYtGeneratedScript] = useState("");
  const [ytScriptWordCount, setYtScriptWordCount] = useState(0);
  const [ytScriptTitle, setYtScriptTitle] = useState("");
  const [ytScriptDuration, setYtScriptDuration] = useState(8);
  const [ytRoutingResult, setYtRoutingResult] = useState<{destination: string; scriptId: number; jobId: number | null; title: string} | null>(null);

  const utils = trpc.useUtils();

  // Personas for selector
  const { data: personas = [] } = trpc.personas.list.useQuery();
  const { data: enrichmentSummary = [] } = trpc.personas.getEnrichmentSummary.useQuery();
  const enrichmentMap = Object.fromEntries(
    (enrichmentSummary as Array<{ id: number; painCount: number; isEnriched: boolean }>).map((e) => [e.id, e])
  );

  // CTA destination blocks for blog CTA dropdown
  const { data: ctaBlocksList = [] } = trpc.cta.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [selectedCtaBlockId, setSelectedCtaBlockId] = useState<number | null>(null);
  // Strike Zone SEO targeting — set from Keyword Strategy tool URL params
  const [focusKeyword, setFocusKeyword] = useState<string>("");
  const [currentPosition, setCurrentPosition] = useState<string>("");
  // generateImages toggle — controls whether auto-image generation runs alongside content
  const [generateImagesEnabled, setGenerateImagesEnabled] = useState(true);

  const generateContentMutation = trpc.ai.generateContent.useMutation({
    onSuccess: (data) => {
      // data is now Record<string, { text: string; imageUrl?: string }>
      const outputs: Record<string, PlatformOutput> = {};
      const texts: Record<string, string> = {};
      for (const [p, val] of Object.entries(data)) {
        const v = val as PlatformOutput;
        outputs[p] = { text: v.text, imageUrl: v.imageUrl };
        texts[p] = v.text;
      }
      setGeneratedContent(outputs);
      setEditedText(texts);
      if (platform !== "all") setImageStylePlatform(platform);
      toast.success("Content generated — auto-saving to archive...");

      // Auto-save each platform immediately to the database
      for (const [p, val] of Object.entries(outputs)) {
        const v = val as PlatformOutput;
        if (!v.text) continue;
        // Use AI-generated title if available, otherwise fall back to truncated idea
        const titleText = v.title ?? (idea.slice(0, 80) + (idea.length > 80 ? "..." : ""));
        autoSaveMutation.mutate(
          {
            title: titleText,
            rawIdea: idea,
            platform: p as any, // reframe excluded from save
            status: "drafting",
            textContent: v.text,
            gapQueryId: activeGapQueryId ?? undefined,
            personaId: selectedPersonaId ?? undefined,
            contentGoal: selectedContentGoal ?? undefined,
          },
          {
            onSuccess: (saved) => {
              if (saved?.id) {
                setSavedItemIds((prev) => ({ ...prev, [p]: saved.id }));
                // Attach image if available
                if (v.imageUrl) {
                  autoUpdateMutation.mutate({ id: saved.id, imageUrl: v.imageUrl });
                }
              }
            },
          }
        );
      }
    },
    onError: (err) => {
      toast.error("Generation failed: " + err.message);
    },
  });

  const generateImagePromptMutation = trpc.ai.generateImagePrompt.useMutation({
    onSuccess: (data) => {
      setImagePrompt(data.prompt);
      toast.success("Nano Banana image prompt generated!");
    },
    onError: (err) => {
      toast.error("Failed: " + err.message);
    },
  });

  const generateImageMutation = trpc.ai.generateImage.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setGeneratedImageUrl(data.url);
        toast.success("Image generated!");
      }
    },
    onError: (err) => {
      toast.error("Image generation failed: " + err.message);
    },
  });

  // Per-platform image regeneration
  const regenerateImageMutation = trpc.ai.generateImage.useMutation({
    onSuccess: (data, variables) => {
      if (data.url) {
        const p = regeneratingImageFor;
        if (p) {
          setGeneratedContent((prev) => ({
            ...prev,
            [p]: { ...prev[p], imageUrl: data.url },
          }));
          toast.success(`New image generated for ${PLATFORM_LABELS[p] || p}!`);
        }
      }
      setRegeneratingImageFor(null);
    },
    onError: (err) => {
      toast.error("Image regeneration failed: " + err.message);
      setRegeneratingImageFor(null);
    },
  });

  const createContentMutation = trpc.content.create.useMutation({
    onSuccess: (data) => {
      toast.success("Saved to Command Center!");
      if (data?.id && savingPlatform) {
        setSavedItemIds((prev) => ({ ...prev, [savingPlatform]: data.id }));
      }
      setSavingPlatform(null);
      utils.content.list.invalidate();
    },
    onError: (err) => {
      toast.error("Save failed: " + err.message);
      setSavingPlatform(null);
    },
  });

  const updateContentMutation = trpc.content.update.useMutation({
    onSuccess: () => {
      toast.success("Image attached to card!");
      setAttachingImage(false);
      utils.content.list.invalidate();
    },
    onError: (err) => {
      toast.error("Attach failed: " + err.message);
      setAttachingImage(false);
    },
  });

  // Silent auto-save mutation — fires automatically after generation, no toast
  const autoSaveMutation = trpc.content.create.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
    },
    onError: () => {
      // Silent failure — user can still manually save
    },
  });

  // Silent auto-update mutation — attaches image URL after auto-save
  const autoUpdateMutation = trpc.content.update.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
    },
    onError: () => {
      // Silent failure
    },
  });

  // Gumshoe Research Context — top gap queries from latest report
  const { data: topGaps = [] } = trpc.research.getTopGaps.useQuery({ limit: 5 }, { retry: false });
  const { data: competitorLeaderboard = [] } = trpc.research.getCompetitorLeaderboard.useQuery({ limit: 5 }, { retry: false });
  const [showResearchPanel, setShowResearchPanel] = useState(true);
  const [activeGapQueryId, setActiveGapQueryId] = useState<number | null>(null);
  const [activeGapQueryText, setActiveGapQueryText] = useState<string | null>(null);

  // Pick up a brief pre-loaded from the Research Intelligence page or LLM Projects
  useEffect(() => {
    const brief = sessionStorage.getItem("gumshoe_brief");
    const gapQueryId = sessionStorage.getItem("gumshoe_gap_query_id");
    const gapQueryText = sessionStorage.getItem("gumshoe_gap_query_text");
    if (brief) {
      setIdea(brief);
      sessionStorage.removeItem("gumshoe_brief");
      toast.success("Research brief loaded — ready to generate!");
    }
    if (gapQueryId) {
      setActiveGapQueryId(parseInt(gapQueryId, 10));
      sessionStorage.removeItem("gumshoe_gap_query_id");
    }
    if (gapQueryText) {
      setActiveGapQueryText(gapQueryText);
      sessionStorage.removeItem("gumshoe_gap_query_text");
    }

    // Pick up SEO keyword launched from SEO Dashboard or Keyword Strategy tool
    const urlParams = new URLSearchParams(window.location.search);
    const seoKeyword = urlParams.get("keyword");
    const seoPlatform = urlParams.get("platform") as Platform | null;
    const urlFocusKeyword = urlParams.get("focusKeyword");
    const urlCurrentPosition = urlParams.get("currentPosition");
    if (seoKeyword && !urlParams.get("source")) {
      const targetPlatform = seoPlatform ?? "blog";
      setPlatform(targetPlatform);
      // If a suggested title was passed (e.g. from the Content Scoreboard Write button),
      // use it as the idea so the AI generates content for that specific title.
      // Otherwise fall back to the raw keyword.
      const urlTitle = urlParams.get("title");
      setIdea(urlTitle ? urlTitle : seoKeyword);
      // Store SEO targeting params for the generation mutation.
      // Always reset both fields — prevents stale state from a previous keyword session
      // where a position was set but the new keyword has no position data.
      setFocusKeyword(urlFocusKeyword ?? seoKeyword);
      setCurrentPosition(urlCurrentPosition ?? "");
      const posNum = urlCurrentPosition ? parseFloat(urlCurrentPosition) : null;
      const isStrikeZone = posNum !== null && posNum >= 11 && posNum <= 30;
      if (isStrikeZone) {
        toast.success(`\u26a1 Strike Zone keyword loaded: "${seoKeyword}" (pos ${posNum.toFixed(1)}) \u2014 SEO brief injected!`);
      } else if (urlTitle) {
        toast.success(`Scoreboard recommendation loaded: "${urlTitle}" \u2014 ready to generate!`);
      } else {
        toast.success(`SEO keyword loaded: "${seoKeyword}" \u2014 ready to generate!`);
      }
      window.history.replaceState({}, "", "/studio");
    }

    // Pick up context launched from Reddit Intelligence tool
    const source = urlParams.get("source");
    if (source === "reddit") {
      const title = urlParams.get("title") ?? "";
      const subreddit = urlParams.get("subreddit") ?? "";
      if (title) {
        // Default to social content since Reddit insights map best to social/community posts
        setPlatform("all");
        const ideaText = subreddit
          ? `Reddit thread from r/${subreddit}: "${title}"\n\nCreate content inspired by this community conversation.`
          : `Reddit thread: "${title}"\n\nCreate content inspired by this community conversation.`;
        setIdea(ideaText);
        toast.success(`Reddit thread loaded — ready to generate content!`);
      }
      window.history.replaceState({}, "", "/studio");
    }

    // Pick up context launched from LLM Projects queue
    if (source === "llm_project") {
      const assetType = urlParams.get("type") ?? "blog";
      const title = urlParams.get("title") ?? "";
      const keyword = urlParams.get("keyword") ?? "";
      const question = urlParams.get("question") ?? "";
      // Map asset type to platform
      const platformMap: Record<string, Platform> = {
        faq: "blog",
        youtube: "youtube",
        blog: "blog",
        social: "all",
        email: "blog",
      };
      const targetPlatform = (platformMap[assetType] ?? "blog") as Platform;
      setPlatform(targetPlatform);
      // Build a pre-filled idea from the asset context
      const ideaParts: string[] = [];
      if (question) ideaParts.push(`Question to answer: ${question}`);
      if (title) ideaParts.push(`Title: ${title}`);
      if (keyword) ideaParts.push(`Target keyword: ${keyword}`);
      if (ideaParts.length > 0) {
        setIdea(ideaParts.join("\n"));
        toast.success(`LLM Project asset loaded — ${PLATFORM_LABELS[targetPlatform] ?? assetType} ready to generate!`);
      }
      // Clean URL without reload
      window.history.replaceState({}, "", "/studio");
    }
  }, []);

  // Buffer profiles
  const { data: bufferProfiles } = trpc.syndication.getProfiles.useQuery(undefined, {
    retry: false,
  });

  // DB-backed channel defaults — used to pre-select the syndication panel checkboxes
  const { data: channelDefaults } = trpc.syndication.getChannelDefaults.useQuery(undefined, {
    retry: false,
  });

  // Initialise selectedProfileIds from DB defaults (or native services as fallback)
  // Runs when profiles + defaults are both loaded, and when platform changes
  useEffect(() => {
    if (!bufferProfiles || bufferProfiles.length === 0) return;
    const PLATFORM_TO_SERVICES: Record<string, string[]> = {
      linkedin: ["linkedin"],
      meta: ["facebook", "instagram"],
      x: ["twitter"],
      youtube: ["youtube"],
      tiktok: ["tiktok"],
      all: ["linkedin", "facebook", "instagram", "twitter", "youtube", "tiktok"],
      blog: [],
      reframe: [],
      carousel: ["facebook", "instagram"],
    };
    const allowedServices = PLATFORM_TO_SERVICES[platform] ?? [];
    const platformProfiles = (bufferProfiles as { id: string; service: string }[]).filter(
      (pr) => allowedServices.includes(pr.service)
    );
    if (platformProfiles.length === 0) {
      setSelectedProfileIds([]);
      return;
    }
    // Use DB defaults if available for this platform
    const dbIds: string[] = channelDefaults?.[platform] ?? [];
    const validDbIds = dbIds.filter((id) => platformProfiles.some((pr) => pr.id === id));
    if (validDbIds.length > 0) {
      setSelectedProfileIds(validDbIds);
    } else {
      // Fallback: pre-select all native platform profiles
      setSelectedProfileIds(platformProfiles.map((pr) => pr.id));
    }
  }, [bufferProfiles, channelDefaults, platform]);

  const syndicationMutation = trpc.syndication.push.useMutation({
    onSuccess: (data) => {
      const p = syndicatingPlatform ?? "unknown";
      if (data.success) {
        setSyndicationResults((prev) => ({ ...prev, [p]: { success: true } }));
        toast.success(`Pushed to Buffer! ID: ${data.bufferId ?? "queued"}`);
      } else {
        setSyndicationResults((prev) => ({ ...prev, [p]: { success: false, error: data.error } }));
        toast.error("Buffer push failed: " + data.error);
      }
      setSyndicatingPlatform(null);
      utils.content.list.invalidate();
    },
    onError: (err) => {
      setSyndicatingPlatform(null);
      toast.error("Syndication error: " + err.message);
    },
  });

  const handleGenerate = () => {
    if (!idea.trim()) {
      toast.error("Please enter an idea first.");
      return;
    }
    generateContentMutation.mutate({
      idea,
      platform: platform as any,
      customInstructions: customInstructions || undefined,
      generateImages: generateImagesEnabled,
      personaId: selectedPersonaId ?? undefined,
      gapQueryText: activeGapQueryText ?? undefined,
      utmContentOverride: utmContentOverride || undefined,
      contentGoal: selectedContentGoal ?? undefined,
    });
  };

  // ── YouTube Competitive Intelligence mutations & handlers ──────────────────
  const ytSearchMutation = trpc.youtube.searchSimilar.useMutation({
    onSuccess: (data) => {
      setYtVideos(data.videos);
      setYtSelectedIds([]);
      setYtTranscripts([]);
      setYtBrief("");
      setYtStep("searched");
      if (data.videos.length === 0) {
        toast.error("No videos found — try a different search term.");
      } else {
        toast.success(`Found ${data.videos.length} competitor videos`);
      }
    },
    onError: (err) => toast.error("YouTube search failed: " + err.message),
  });

  const ytTranscriptMutation = trpc.youtube.fetchTranscripts.useMutation({
    onSuccess: (data) => {
      setYtTranscripts(data.transcripts);
      setYtStep("transcripts");
      const ok = data.transcripts.filter((t) => t.text && !t.error).length;
      const fail = data.transcripts.filter((t) => t.error).length;
      if (ok > 0) toast.success(`Fetched ${ok} transcript${ok > 1 ? "s" : ""}${fail > 0 ? ` (${fail} unavailable)` : ""}`);
      else toast.error("No transcripts available for selected videos — try different videos.");
    },
    onError: (err) => toast.error("Transcript fetch failed: " + err.message),
  });

  const ytAnalyzeMutation = trpc.youtube.analyzeCompetitors.useMutation({
    onSuccess: (data) => {
      setYtBrief(typeof data.brief === "string" ? data.brief : String(data.brief));
      setYtStep("brief");
      toast.success("Differentiation brief ready!");
    },
    onError: (err) => toast.error("Analysis failed: " + err.message),
  });

  // ── Summarize Video ──────────────────────────────────────────────────────────
  const [ytSummaries, setYtSummaries] = useState<Record<string, string>>({});
  const [ytSummarizing, setYtSummarizing] = useState<string | null>(null);
  const ytSummarizeMutation = trpc.youtube.summarizeVideo.useMutation({
    onSuccess: (data, vars) => {
      setYtSummaries((prev) => ({ ...prev, [vars.videoId]: data.outline }));
      setYtSummarizing(null);
      toast.success("Video summarized!");
    },
    onError: (err) => { setYtSummarizing(null); toast.error("Summarize failed: " + err.message); },
  });

  const handleYTSummarize = (videoId: string) => {
    const video = ytVideos.find((v) => v.id === videoId);
    if (!video) return;
    const transcript = ytTranscripts.find((t) => t.videoId === videoId);
    setYtSummarizing(videoId);
    ytSummarizeMutation.mutate({
      videoId,
      title: video.title,
      channelName: video.channelName,
      transcript: transcript?.text ?? "",
    });
  };

  // ── Teleprompter Script Generation ──────────────────────────────────────────
  const teleprompterMutation = trpc.research.generateTeleprompterScript.useMutation({
    onSuccess: (data) => {
      setTeleprompterScript(data.script);
      setShowTeleprompter(true);
      setGeneratingTeleprompter(false);
      toast.success("Teleprompter script ready!");
    },
    onError: (err) => {
      setGeneratingTeleprompter(false);
      toast.error("Script generation failed: " + err.message);
    },
  });

  const handleGenerateTeleprompter = () => {
    // Extract title from the YouTube content — use the first line of the generated text
    const youtubeText = editedText["youtube"] || generatedContent["youtube"]?.text || "";
    // The YouTube output typically starts with the title on the first line
    const firstLine = youtubeText.split("\n")[0].replace(/^#+\s*/, "").trim();
    const title = firstLine || idea;
    setGeneratingTeleprompter(true);
    setTeleprompterScript(null);
    setShowTeleprompter(false);
    teleprompterMutation.mutate({
      title,
      platform: "youtube",
    });
  };

  // ── TikTok 60-second Script Generation ───────────────────────────────
  const tiktok60Mutation = trpc.research.generateTeleprompterScript.useMutation({
    onSuccess: (data) => {
      setTiktokScript60(data.script);
      setGeneratingTiktok60(false);
      toast.success("TikTok 60-second script ready!");
    },
    onError: (err) => {
      setGeneratingTiktok60(false);
      toast.error("Script generation failed: " + err.message);
    },
  });

  const handleGenerateTiktok60 = () => {
    const title = (editedText["tiktok"] || generatedContent["tiktok"]?.text || "").split("\n")[0].replace(/^#+\s*/, "").trim() || idea;
    setGeneratingTiktok60(true);
    setTiktokScript60(null);
    tiktok60Mutation.mutate({ title, platform: "tiktok" });
  };

  // Shared utils for auto-linking scripts back to content items
  const studioUtils = trpc.useUtils();
  const studioLinkContentMutation = trpc.content.update.useMutation();

  const saveTiktok60Mutation = trpc.scripts.create.useMutation({
    onSuccess: (created, variables) => {
      setTiktok60Saved(true);
      toast.success("TikTok script saved to Script Library!");
      setTimeout(() => setTiktok60Saved(false), 3000);
      // Auto-link: set linkedScriptId on the originating content item
      if (created && variables.linkedContentItemId) {
        studioLinkContentMutation.mutate({
          id: variables.linkedContentItemId,
          linkedScriptId: created.id,
        });
        studioUtils.content.list.invalidate();
      }
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const handleSaveTiktok60ToLibrary = () => {
    if (!tiktokScript60) return;
    const title = (editedText["tiktok"] || generatedContent["tiktok"]?.text || "").split("\n")[0].replace(/^#+\s*/, "").trim() || idea || "TikTok 60-sec Script";
    saveTiktok60Mutation.mutate({
      title,
      scriptType: "reel",
      platform: "tiktok",
      productionStatus: "scripted",
      scriptBody: tiktokScript60,
      linkedContentItemId: savedItemIds["tiktok"] ?? undefined,
    });
  };

  // ── Save Teleprompter Script to Script Library ────────────────────────────────
  const [teleprompterSaved, setTeleprompterSaved] = useState(false);
  const saveTeleprompterMutation = trpc.scripts.create.useMutation({
    onSuccess: (created, variables) => {
      setTeleprompterSaved(true);
      toast.success("Script saved to Script Library!");
      setTimeout(() => setTeleprompterSaved(false), 3000);
      // Auto-link: set linkedScriptId on the originating content item
      if (created && variables.linkedContentItemId) {
        studioLinkContentMutation.mutate({
          id: variables.linkedContentItemId,
          linkedScriptId: created.id,
        });
        studioUtils.content.list.invalidate();
      }
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const handleSaveTeleprompterToLibrary = () => {
    if (!teleprompterScript) return;
    const youtubeText = editedText["youtube"] || generatedContent["youtube"]?.text || "";
    const firstLine = youtubeText.split("\n")[0].replace(/^#+\s*/, "").trim();
    const title = firstLine || idea || "Teleprompter Script";
    saveTeleprompterMutation.mutate({
      title,
      scriptType: "video",
      platform: "youtube",
      productionStatus: "scripted",
      scriptBody: teleprompterScript,
      linkedContentItemId: savedItemIds["youtube"] ?? undefined,
    });
  };

  // ── Blog → YouTube Script: mutation + handler ──────────────────────────────
  const blogYtScriptMutation = trpc.research.generateYouTubeScriptFromBlog.useMutation({
    onSuccess: (data) => {
      setBlogYtScript(data.script);
      setGeneratingBlogYtScript(false);
      toast.success("YouTube script ready! Copy, download, or save to Script Library.");
    },
    onError: (err) => {
      setGeneratingBlogYtScript(false);
      toast.error("Script generation failed: " + err.message);
    },
  });

  const saveBlogYtScriptMutation = trpc.scripts.create.useMutation({
    onSuccess: () => {
      setBlogYtScriptSaved(true);
      toast.success("Script saved to Script Library!");
      setTimeout(() => setBlogYtScriptSaved(false), 3000);
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const handleGenerateBlogYtScript = () => {
    if (!blogContent) return;
    setGeneratingBlogYtScript(true);
    setBlogYtScript(null);
    blogYtScriptMutation.mutate({
      title: blogContent.title,
      focusKeyword: blogContent.focusKeyword ?? undefined,
      articleBody: blogContent.body,
      publishUrl: wpPublishResult?.postUrl ?? undefined,
    });
  };

  const handleSaveBlogYtScriptToLibrary = () => {
    if (!blogYtScript || !blogContent) return;
    saveBlogYtScriptMutation.mutate({
      title: `YT Script: ${blogContent.title}`,
      scriptType: "video",
      platform: "youtube",
      productionStatus: "scripted",
      scriptBody: blogYtScript,
      linkedContentItemId: savedItemIds["blog"] ?? undefined,
    });
  };

  // ── Push to Video Pipeline ─────────────────────────────────────────────────
  const startVideoJobMutation = trpc.videoPipeline.startVideoJob.useMutation({
    onSuccess: (data) => {
      setVideoPipelineLaunched(true);
      setShowVideoPipelineModal(false);
      toast.success(data.message ?? "Video job queued! Check VA Dashboard for review.", {
        action: { label: "VA Dashboard →", onClick: () => window.location.href = "/va" },
      });
    },
    onError: (err) => {
      toast.error("Failed to queue video: " + err.message);
    },
  });

  const handlePushToVideoPipeline = () => {
    if (!blogYtScript || !blogContent) return;
    const contentItemId = savedItemIds["blog"];
    if (!contentItemId) {
      toast.error("Save the blog post to Kanban first before pushing to video pipeline.");
      return;
    }
    startVideoJobMutation.mutate({
      contentItemId,
      scriptTitle: blogContent.title,
      scriptText: blogYtScript,
      productionPath: videoPipelinePath,
      outputChannels: videoPipelineChannels as ("youtube" | "tiktok" | "meta" | "instagram" | "x")[],
    });
  };

  // ── Save to Script Library ────────────────────────────────────────────────────
  const [ytSavedToScript, setYtSavedToScript] = useState(false);
  const ytSaveToScriptMutation = trpc.youtube.saveToScript.useMutation({
    onSuccess: (data) => {
      setYtSavedToScript(true);
      toast.success(`Saved to Script Library as "${data.title}" — open Script Library to refine it.`);
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const handleYTSaveToScript = () => {
    if (!ytBrief) { toast.error("Generate a differentiation brief first."); return; }
    const title = `YT CI: ${ytSearchQuery || idea || "Competitor Analysis"} — ${new Date().toLocaleDateString()}`;
    ytSaveToScriptMutation.mutate({
      title,
      brief: ytBrief,
      topic: ytSearchQuery || idea,
      competitorAngle: ytVideos.slice(0, 3).map((v) => v.title).join(" | "),
    });
  };

  // ── Generate Script from Brief + Route to Production ───────────────────────────
  const ytGenerateScriptMutation = trpc.youtube.generateScriptFromBrief.useMutation({
    onSuccess: (data) => {
      setYtGeneratedScript(data.scriptBody);
      setYtScriptWordCount(data.wordCount);
      toast.success(`Script ready — ${data.wordCount.toLocaleString()} words (~${Math.round(data.wordCount / 130)} min)`);
    },
    onError: (err) => toast.error("Script generation failed: " + err.message),
  });

  const ytCreateVideoJobMutation = trpc.youtube.createVideoJobFromScript.useMutation({
    onSuccess: (data) => {
      setYtRoutingResult(data);
      if (data.destination === "heygen") {
        toast.success(`Video job #${data.jobId} created — HeyGen will render the avatar video. Track it in the VA Dashboard.`);
      } else if (data.destination === "record_self") {
        toast.success(`Script saved (ID ${data.scriptId}) — ready for you to record.`);
      } else {
        toast.success(`Script saved to Script Library (ID ${data.scriptId}).`);
      }
    },
    onError: (err) => toast.error("Routing failed: " + err.message),
  });

  const handleYTGenerateScript = () => {
    if (!ytBrief) { toast.error("Generate a differentiation brief first."); return; }
    const autoTitle = `${ytSearchQuery || idea || "Urban Monk"} — ${new Date().toLocaleDateString()}`;
    setYtScriptTitle(autoTitle);
    setYtGeneratedScript("");
    setYtRoutingResult(null);
    ytGenerateScriptMutation.mutate({
      brief: ytBrief,
      idea: ytSearchQuery || idea || "Urban Monk content",
      targetDurationMinutes: ytScriptDuration,
    });
  };

  const handleYTRouteScript = (destination: "heygen" | "script_library" | "record_self") => {
    if (!ytGeneratedScript) { toast.error("Generate a script first."); return; }
    ytCreateVideoJobMutation.mutate({
      title: ytScriptTitle || `YT Script — ${new Date().toLocaleDateString()}`,
      scriptBody: ytGeneratedScript,
      brief: ytBrief,
      destination,
      topic: ytSearchQuery || idea,
    });
  };

  const handleYTSearch = () => {
    const q = ytSearchQuery.trim() || idea.trim();
    if (!q) { toast.error("Enter a search term or fill in the idea field first."); return; }
    setYtVideos([]);
    setYtTranscripts([]);
    setYtBrief("");
    setYtStep("idle");
    ytSearchMutation.mutate({ query: q, limit: 5, sortBy: "views", uploadDate: "year" });
  };

  const handleYTFetchTranscripts = () => {
    if (ytSelectedIds.length === 0) { toast.error("Select at least one video."); return; }
    ytTranscriptMutation.mutate({ videoIds: ytSelectedIds });
  };

  const handleYTAnalyze = () => {
    const videosWithTranscripts = ytSelectedIds.map((id) => {
      const video = ytVideos.find((v) => v.id === id)!;
      const transcript = ytTranscripts.find((t) => t.videoId === id);
      return {
        videoId: id,
        title: video.title,
        channelName: video.channelName,
        viewCount: video.viewCount,
        transcript: transcript?.text ?? "",
      };
    }).filter((v) => v.title);
    if (videosWithTranscripts.length === 0) { toast.error("No valid videos to analyze."); return; }
    ytAnalyzeMutation.mutate({
      idea: idea.trim() || ytSearchQuery.trim(),
      videos: videosWithTranscripts,
    });
  };

  const handleYTInformScript = () => {
    if (!ytBrief) return;
    const briefSummary = ytBrief.slice(0, 800);
    setCustomInstructions((prev) =>
      prev ? prev + "\n\n[Competitor Differentiation Brief]\n" + briefSummary : "[Competitor Differentiation Brief]\n" + briefSummary
    );
    toast.success("Differentiation brief injected into Custom Instructions!");
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleRegenerateImage = (p: string) => {
    const text = editedText[p] || generatedContent[p]?.text;
    if (!text) return;
    setRegeneratingImageFor(p);
    // Use the idea + platform style directly for regeneration
    regenerateImageMutation.mutate({
      prompt: text.slice(0, 300),
      platform: p as any,
    });
  };

  const handleGenerateImagePrompt = (p: string) => {
    const text = editedText[p] || generatedContent[p]?.text;
    if (!text) {
      toast.error("Generate content first.");
      return;
    }
    generateImagePromptMutation.mutate({ textContent: text, platform: imageStylePlatform as any });
  };

  const handleGenerateImage = () => {
    if (!imagePrompt.trim()) {
      toast.error("Generate or enter an image prompt first.");
      return;
    }
    generateImageMutation.mutate({
      prompt: imagePrompt,
      platform: imageStylePlatform as any,
      styleOverride: styleOverride || undefined,
    });
  };

  const handleSave = (p: string) => {
    const text = editedText[p] || generatedContent[p]?.text;
    const imgUrl = generatedContent[p]?.imageUrl;
    if (!text) return;
    setSavingPlatform(p);
    createContentMutation.mutate({
      title: idea.slice(0, 80) + (idea.length > 80 ? "..." : ""),
      rawIdea: idea,
      platform: p as any,
      status: "drafting",
      textContent: text,
      gapQueryId: activeGapQueryId ?? undefined,
    });
  };

  const handleAttachImage = (itemId: number) => {
    if (!generatedImageUrl) {
      toast.error("No image to attach. Generate an image first.");
      return;
    }
    setAttachingImage(true);
    updateContentMutation.mutate({
      id: itemId,
      imageUrl: generatedImageUrl,
      imagePrompt: imagePrompt || undefined,
    });
    setAttachedToIds((prev) => [...prev, itemId]);
  };

  const handleSyndicate = (p: string) => {
    const itemId = savedItemIds[p];
    if (!itemId) {
      toast.error("Save this platform's content to a card first.");
      return;
    }
    if (!selectedProfileIds.length) {
      toast.error("Select at least one Buffer profile.");
      return;
    }
    const text = editedText[p] || generatedContent[p]?.text;
    if (!text) return;

    // CRITICAL FIX: Filter selectedProfileIds to only include channels matching the
    // target platform p — prevents X posts from being sent to TikTok or other channels
    // when multiple channels are checked in the profile selector.
    const PLATFORM_SERVICE_MAP: Record<string, string[]> = {
      linkedin: ["linkedin"],
      meta: ["facebook", "instagram"],
      x: ["twitter"],
      youtube: ["youtube"],
      tiktok: ["tiktok"],
      all: ["linkedin", "facebook", "instagram", "twitter", "youtube", "tiktok"],
      blog: [],
    };
    const allowedServices = PLATFORM_SERVICE_MAP[p] ?? [];
    const platformFilteredIds = (bufferProfiles ?? [])
      .filter((pr: { id: string; service: string }) =>
        selectedProfileIds.includes(pr.id) && allowedServices.includes(pr.service)
      )
      .map((pr: { id: string }) => pr.id);

    if (!platformFilteredIds.length) {
      toast.error(`No ${PLATFORM_LABELS[p] ?? p} channels selected. Check the Buffer channel selector above.`);
      return;
    }

    setSyndicatingPlatform(p);
    // Build channelServiceMap for Meta channels so Buffer API gets the required type field
    const channelServiceMap: Record<string, string> = {};
    (bufferProfiles ?? []).forEach((pr: { id: string; service: string }) => {
      channelServiceMap[pr.id] = pr.service;
    });
    syndicationMutation.mutate({
      contentItemId: itemId,
      text,
      profileIds: platformFilteredIds,
      imageUrl: generatedContent[p]?.imageUrl || generatedImageUrl || undefined,
      platform: p, // enforce X 280-char limit server-side
      metaPostType: (p === "meta") ? (metaPostType as "post" | "story" | "reel") : undefined,
      channelServiceMap: (p === "meta") ? channelServiceMap : undefined,
    });
  };
  // Direct push to Bufferr — saves card first if not already saved, then syndicates
  const handleSyndicateDirect = async (p: string) => {
    const text = editedText[p] || generatedContent[p]?.text;
    if (!text) {
      toast.error("No content to push.");
      return;
    }
    // Check if Buffer is configured
    if (!hasBufferToken) {
      toast.error("Buffer is not connected. Add your BUFFER_ACCESS_TOKEN in Settings → Secrets.");
      return;
    }
    if (!hasProfiles) {
      toast.error("No Buffer profiles found. Connect your social accounts in Buffer first.");
      return;
    }

    setSyndicatingPlatform(p);

    // If not saved yet, save first then syndicate
    let itemId = savedItemIds[p];
    if (!itemId) {
      // Save to Kanban first
      try {
        const result = await new Promise<{ id: number } | undefined>((resolve) => {
          setSavingPlatform(p);
          createContentMutation.mutate(
            {
              title: idea.slice(0, 80) + (idea.length > 80 ? "..." : ""),
              rawIdea: idea,
              platform: p as any, // reframe excluded from save
              status: "drafting",
              textContent: text,
              gapQueryId: activeGapQueryId ?? undefined,
            },
            {
              onSuccess: (data) => {
                if (data?.id) {
                  setSavedItemIds((prev) => ({ ...prev, [p]: data.id }));
                  resolve(data);
                } else {
                  resolve(undefined);
                }
                setSavingPlatform(null);
              },
              onError: () => {
                setSavingPlatform(null);
                resolve(undefined);
              },
            }
          );
        });
        if (result?.id) itemId = result.id;
      } catch {
        setSyndicatingPlatform(null);
        toast.error("Failed to save content before pushing.");
        return;
      }
    }

    // Use only Buffer profiles matching the current platform (not all profiles)
    const DIRECT_PLATFORM_TO_SERVICES: Record<string, string[]> = {
      linkedin: ["linkedin"],
      meta: ["facebook", "instagram"],
      x: ["twitter"],
      youtube: ["youtube"],
      tiktok: ["tiktok"],
      all: ["linkedin", "facebook", "instagram", "twitter", "youtube", "tiktok"],
      blog: [],
    };
    const allowedServices = DIRECT_PLATFORM_TO_SERVICES[p] ?? [];
    const allMatchingProfiles = (bufferProfiles ?? []).filter(
      (pr: { id: string; service: string }) => allowedServices.includes(pr.service)
    );
    if (!allMatchingProfiles.length) {
      setSyndicatingPlatform(null);
      toast.error(`No Buffer channels connected for ${p}. Check your Buffer account.`);
      return;
    }
    // Use DB defaults if available — otherwise fall back to all matching profiles
    const dbDefaultIds: string[] = channelDefaults?.[p] ?? [];
    const validDefaultIds = dbDefaultIds.filter(
      (id) => allMatchingProfiles.some((pr: { id: string }) => pr.id === id)
    );
    const profileIds = validDefaultIds.length > 0
      ? validDefaultIds
      : allMatchingProfiles.map((pr: { id: string }) => pr.id);
    if (!profileIds.length) {
      setSyndicatingPlatform(null);
      toast.error(`No Buffer channels connected for ${p}. Check your Buffer account.`);
      return;
    }

    // Build channelServiceMap for Meta channels so Buffer API gets the required type field
    const directChannelServiceMap: Record<string, string> = {};
    (bufferProfiles ?? []).forEach((pr: { id: string; service: string }) => {
      directChannelServiceMap[pr.id] = pr.service;
    });
    syndicationMutation.mutate({
      contentItemId: itemId ?? 0,
      text,
      profileIds,
      imageUrl: generatedContent[p]?.imageUrl || generatedImageUrl || undefined,
      platform: p, // enforce X 280-char limit server-side
      metaPostType: (p === "meta") ? (metaPostType as "post" | "story" | "reel") : undefined,
      channelServiceMap: (p === "meta") ? directChannelServiceMap : undefined,
    });
  };
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // Blog generation state
  const [blogContent, setBlogContent] = useState<{
    title: string;
    slug: string;
    metaDescription: string;
    focusKeyword?: string;
    semanticKeywords?: string[];
    hookFamily?: string;
    emotionalDriver?: string;
    faqSection?: string;
    waterfallMap?: string;
    body: string;          // Clean Markdown only — no embedded HTML
    imageUrl?: string;
    ctaBannerUrl?: string; // URL of the CTA banner image (for preview)
    ctaBannerHtml?: string; // Full HTML block to inject at WP publish time
  } | null>(null);
  const [isBlogGenerating, setIsBlogGenerating] = useState(false);
  const [blogViewMode, setBlogViewMode] = useState<"preview" | "edit">("preview");


  // --- Reframe Post state ---
  const [reframeSlides, setReframeSlides] = useState<Array<{
    number: number;
    text: string;
  }> | null>(null);
  const [reframeCaption, setReframeCaption] = useState<string>("");
  const [commonBelief, setCommonBelief] = useState<string>("");
  const [reframeRenderedUrls, setReframeRenderedUrls] = useState<string[]>([]);
  const [reframeIsRendering, setReframeIsRendering] = useState(false);

  const generateReframeMutation = trpc.ai.generateReframePost.useMutation({
    onSuccess: async (data: { slides: Array<{ number: number; text: string }>; caption: string; ctaLabel: string }) => {
      setReframeSlides(data.slides);
      setReframeCaption(data.caption ?? "");
      setReframeRenderedUrls([]);
      toast.success("Reframe Post generated — rendering images...");
      // Auto-render slides to canvas images
      setReframeIsRendering(true);
      try {
        const total = data.slides.length;
        const mapped: CarouselSlideData[] = data.slides.map((s, i) => ({
          slide: s.number,
          type: (i === 0 ? "cover" : i === total - 1 ? "cta" : "content") as SlideType,
          headline: s.text.split("\n")[0].slice(0, 80),
          body: s.text,
        }));
        const urls = await slidesToDataUrls(mapped);
        setReframeRenderedUrls(urls);
        toast.success(`${urls.length} slide images ready — download or upload to Facebook!`);
      } catch (err) {
        console.warn("[Reframe] Render failed:", err);
        toast.error("Image rendering failed — text slides still available above");
      } finally {
        setReframeIsRendering(false);
      }
    },
    onError: (err: { message: string }) => {
      toast.error("Reframe Post generation failed: " + err.message);
    },
  });

    const generateBlogMutation = trpc.ai.generateBlog.useMutation({
    onSuccess: (data) => {
      setBlogContent({
        title: data.title,
        slug: data.slug,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
        semanticKeywords: data.semanticKeywords,
        hookFamily: data.hookFamily,
        emotionalDriver: data.emotionalDriver,
        faqSection: data.faqSection,
        waterfallMap: data.waterfallMap,
        body: data.article,
        imageUrl: data.heroImageUrl,
        ctaBannerUrl: (data as any).ctaBannerUrl ?? undefined,
        ctaBannerHtml: (data as any).ctaBannerHtml ?? undefined,
      });
      setIsBlogGenerating(false);

      // Keyphrase density check — show informational toast if density is low
      // (the server-side density boost pass runs inside generateBlog before returning)
      const densityBoosted = (data as any).densityBoosted ?? false;
      if (densityBoosted) {
        toast.success("Blog post generated — keyphrase density boosted ✓", { duration: 5000 });
      } else {
        toast.success("Blog post generated — auto-saving to archive...");
      }

      // Auto-save blog post immediately
      autoSaveMutation.mutate(
        {
          title: data.title,
          rawIdea: idea,
          platform: "blog" as any,
          status: "drafting",
          textContent: data.article,
          gapQueryId: activeGapQueryId ?? undefined,
          personaId: selectedPersonaId ?? undefined,
          contentGoal: selectedContentGoal ?? undefined,
          ctaBlockLabel: data.ctaLabel ?? undefined,
          // SEO fields available on content.create schema
          focusKeyword: data.focusKeyword ?? undefined,
          seoKeywords: data.semanticKeywords?.length
            ? JSON.stringify(data.semanticKeywords)
            : undefined,
        },
        {
          onSuccess: (saved) => {
            if (saved?.id) {
              setSavedItemIds((prev) => ({ ...prev, blog: saved.id }));
              // Second pass: update with fields only available on content.update schema
              // (yoastSeoTitle, yoastMetaDescription, imageUrl, ctaBannerUrl)
              const updatePayload: Record<string, unknown> = { id: saved.id };
              if (data.title) updatePayload.yoastSeoTitle = `${data.title} | The Urban Monk`;
              if (data.metaDescription) updatePayload.yoastMetaDescription = data.metaDescription;
              if (data.heroImageUrl) updatePayload.imageUrl = data.heroImageUrl;
              if ((data as any).ctaBannerUrl) updatePayload.ctaBannerUrl = (data as any).ctaBannerUrl;
              autoUpdateMutation.mutate(updatePayload as any);
            }
          },
        }
      );
    },
    onError: (err) => {
      setIsBlogGenerating(false);
      toast.error("Blog generation failed: " + err.message);
    },
  });

  const handleGenerateBlog = () => {
    if (!idea.trim()) {
      toast.error("Please enter an idea first.");
      return;
    }
    setIsBlogGenerating(true);
    setBlogContent(null);
    generateBlogMutation.mutate({
      idea,
      generateImage: true,
      customInstructions: customInstructions || undefined,
      gapQueryId: activeGapQueryId ?? undefined,
      gapQueryText: activeGapQueryText ?? undefined,
      personaId: selectedPersonaId ?? undefined,
      utmContentOverride: utmContentOverride || undefined,
      ctaBlockId: selectedCtaBlockId ?? undefined,
      focusKeyword: focusKeyword || undefined,
      currentPosition: currentPosition || undefined,
    });
  };

  const handleCopyBlog = () => {
    if (!blogContent) return;
    const md = `# ${blogContent.title}\n\n${blogContent.body}`;
    navigator.clipboard.writeText(md);
    toast.success("Blog post copied as Markdown!");
  };

  const handleDownloadBlog = () => {
    if (!blogContent) return;
    const md = `---\ntitle: ${blogContent.title}\nslug: ${blogContent.slug}\ndescription: ${blogContent.metaDescription}\n---\n\n${blogContent.body}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blogContent.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Blog post downloaded as Markdown!");
  };

  // ── Carousel state & mutation ───────────────────────────────────────────────
  // CarouselSlide extends CarouselSlideData from the renderer
  type CarouselSlide = CarouselSlideData;
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[] | null>(null);
  const [carouselRenderedUrls, setCarouselRenderedUrls] = useState<string[]>([]);
  const [carouselIsRendering, setCarouselIsRendering] = useState(false);
  const [carouselPlatform, setCarouselPlatform] = useState<"meta" | "linkedin">("meta");
  const [carouselSlideCount, setCarouselSlideCount] = useState(7);
  const [isCarouselGenerating, setIsCarouselGenerating] = useState(false);

  const generateCarouselMutation = trpc.ai.generateCarousel.useMutation({
    onSuccess: async (data) => {
      // Assign slide types: first = cover, last = cta, rest = content
      const typedSlides: CarouselSlide[] = (data.slides as any[]).map((s, i, arr) => ({
        ...s,
        type: (i === 0 ? "cover" : i === arr.length - 1 ? "cta" : "content") as SlideType,
        bullets: undefined,
      }));
      setCarouselSlides(typedSlides);
      setIsCarouselGenerating(false);
      toast.success(`Carousel generated — ${data.slideCount} slides ready!`);
      // Render slides to canvas
      setCarouselIsRendering(true);
      try {
        const urls = await slidesToDataUrls(typedSlides);
        setCarouselRenderedUrls(urls);
      } catch (err) {
        console.warn("[Carousel] Render failed:", err);
      } finally {
        setCarouselIsRendering(false);
      }
      // Auto-save to Command Center
      autoSaveMutation.mutate({
        title: data.topic.slice(0, 80),
        rawIdea: idea,
        platform: "carousel" as any,
        status: "drafting",
        textContent: typedSlides.map((s) => `Slide ${s.slide}: ${s.headline}\n${s.body}`).join("\n\n"),
        personaId: selectedPersonaId ?? undefined,
        contentGoal: selectedContentGoal ?? undefined,
      });
    },
    onError: (err) => {
      setIsCarouselGenerating(false);
      toast.error("Carousel generation failed: " + err.message);
    },
  });

  const handleGenerateCarousel = () => {
    if (!idea.trim()) {
      toast.error("Please enter an idea first.");
      return;
    }
    setIsCarouselGenerating(true);
    setCarouselSlides(null);
    generateCarouselMutation.mutate({
      idea,
      platform: carouselPlatform,
      slideCount: carouselSlideCount,
      customInstructions: customInstructions || undefined,
      generateImages: generateImagesEnabled,
      personaId: selectedPersonaId ?? undefined,
    });
  };

  const handleDownloadCarousel = () => {
    if (!carouselSlides) return;
    const md = carouselSlides
      .map((s) => `## Slide ${s.slide}\n**${s.headline}**\n\n${s.body}`)
      .join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carousel-${idea.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Carousel downloaded as Markdown!");
  };

  const handleDownloadCarouselZip = async () => {
    if (!carouselSlides || carouselRenderedUrls.length === 0) return;
    try {
      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const slug = idea.slice(0, 40).replace(/[^a-z0-9]/gi, "-").toLowerCase();
      // Add each rendered PNG — reversed numbering so Facebook alphabetical sort = correct carousel order
      const totalSlides = carouselRenderedUrls.length;
      for (let i = 0; i < totalSlides; i++) {
        const dataUrl = carouselRenderedUrls[i];
        const base64 = dataUrl.split(",")[1];
        const slide = carouselSlides[i];
        // Reverse: slide 1 gets the highest number, last slide gets 01
        // Facebook reads files alphabetically, so 01 shows first in the carousel
        const fileNum = String(totalSlides - i).padStart(2, "0");
        const filename = `slide-${fileNum}-${slide.headline.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
        zip.file(filename, base64, { base64: true });
      }
      // Add copy doc
      const copyDoc = carouselSlides
        .map((s) => `## Slide ${s.slide}: ${s.headline}\n\n${s.body}`)
        .join("\n\n---\n\n");
      zip.file("copy.md", copyDoc);
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carousel-${slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${carouselRenderedUrls.length} slides + copy doc as ZIP!`);
    } catch (err) {
      console.error("ZIP download failed:", err);
      toast.error("ZIP download failed — try again.");
    }
  };

  // ── Carousel Export ─────────────────────────────────────────────────
  const [savedCarouselItemId, setSavedCarouselItemId] = useState<number | null>(null);
  const [carouselPushResult, setCarouselPushResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCarouselPushing, setIsCarouselPushing] = useState(false);



  const handleSaveBlog = () => {
    if (!blogContent) return;
    setSavingPlatform("blog");
    createContentMutation.mutate({
      title: blogContent.title,
      rawIdea: idea,
      platform: "blog" as any,
      status: "drafting",
      textContent: blogContent.body,
      gapQueryId: activeGapQueryId ?? undefined,
      focusKeyword: blogContent.focusKeyword ?? undefined,
      seoKeywords: blogContent.semanticKeywords?.length
        ? JSON.stringify(blogContent.semanticKeywords)
        : undefined,
    });
  };

  // WordPress publish state
  const [isPublishingToWP, setIsPublishingToWP] = useState(false);
  const [wpPublishResult, setWpPublishResult] = useState<{ postUrl: string; editUrl: string } | null>(null);

  const [wpPublishStatus, setWpPublishStatus] = useState<"draft" | "publish">("draft");

  const publishToWPMutation = trpc.blog.publish.useMutation({
    onSuccess: (data) => {
      setIsPublishingToWP(false);
      setWpPublishResult({ postUrl: data.postUrl ?? "", editUrl: data.editUrl ?? "" });
      toast.success(
        wpPublishStatus === "publish"
          ? "Published to WordPress!"
          : "Saved as draft in WordPress!"
      );
      if (data.keyphraseAlreadyUsed) {
        const conflictNote = data.keyphraseConflictUrl
          ? ` Previously used on: ${data.keyphraseConflictUrl}`
          : "";
        toast.warning(
          `Yoast: Focus keyphrase was already used on another post.${conflictNote} Consider changing it in the SEO editor.`,
          { duration: 10000 }
        );
      }
      // Show Substack result if it was published
      if (data.substackResult?.published && data.substackResult.postUrl && data.substackResult.postId) {
        setSubstackPublishResult({ postUrl: data.substackResult.postUrl, postId: data.substackResult.postId });
        toast.success("Also published to Substack!", { duration: 5000 });
      } else if (data.substackResult && !data.substackResult.published && data.substackResult.message !== "skipped" && data.substackResult.message !== "Already published to Substack") {
        toast.warning(`Substack: ${data.substackResult.message}`, { duration: 8000 });
      }
      utils.content.list.invalidate();
    },
    onError: (err) => {
      setIsPublishingToWP(false);
      toast.error("WordPress publish failed: " + err.message);
    },
  });

  // WordPress Post Index Sync
  const [isSyncingWpIndex, setIsSyncingWpIndex] = useState(false);
  const { data: wpIndexStats } = trpc.blog.getPostIndexStats.useQuery(undefined, { refetchOnWindowFocus: false });
  const syncPostIndexMutation = trpc.blog.syncPostIndex.useMutation({
    onSuccess: (data) => {
      setIsSyncingWpIndex(false);
      toast.success(data.message);
      utils.blog.getPostIndexStats.invalidate();
    },
    onError: (err) => {
      setIsSyncingWpIndex(false);
      toast.error("WP sync failed: " + err.message);
    },
  });

  const handlePublishToWP = (status: "draft" | "publish") => {
    if (!blogContent) return;
    const contentItemId = savedItemIds["blog"];
    if (!contentItemId) {
      toast.error("Please save the blog post to Kanban first.");
      return;
    }
    setIsPublishingToWP(true);
    setWpPublishResult(null);
    setSubstackPublishResult(null);
    setWpPublishStatus(status);
    // Persist the sendToSubstack flag to the DB so the backend can read it during publish
    if (sendToSubstack) {
      updateContentMutation.mutate({ id: contentItemId, sendToSubstack: true });
    }
    publishToWPMutation.mutate({
      contentItemId,
      title: blogContent.title,
      slug: blogContent.slug,
      body: blogContent.body,
      metaDescription: blogContent.metaDescription,
      focusKeyword: blogContent.focusKeyword,
      semanticKeywords: blogContent.semanticKeywords,
      faqSection: blogContent.faqSection,
      hookFamily: blogContent.hookFamily,
      emotionalDriver: blogContent.emotionalDriver,
      waterfallMap: blogContent.waterfallMap,
      heroImageUrl: blogContent.imageUrl,
      status,
      ctaBannerHtml: blogContent.ctaBannerHtml,
    });
  };

  const outputPlatforms =
    platform === "all"
      ? (["linkedin", "meta", "x", "youtube"] as const)
      : platform === "blog" || platform === "tiktok"
        ? ([] as const)
        : [platform];

  // Filter Buffer channels to only show those matching the selected platform
  const PLATFORM_TO_SERVICES: Record<string, string[]> = {
    linkedin: ["linkedin"],
    meta: ["facebook", "instagram"],
    x: ["twitter"],
    youtube: ["youtube"],
    tiktok: ["tiktok"],
    all: ["linkedin", "facebook", "instagram", "twitter", "youtube", "tiktok"],
    blog: [],
  };
  const filteredProfiles = (bufferProfiles ?? []).filter((pr: { id: string; service: string }) => {
    const allowed = PLATFORM_TO_SERVICES[platform] ?? [];
    return allowed.includes(pr.service);
  });

  const currentStyleInfo = PLATFORM_STYLE_LABELS[imageStylePlatform] ?? PLATFORM_STYLE_LABELS.all;
  const hasBufferToken = bufferProfiles !== undefined;
  const hasProfiles = (bufferProfiles?.length ?? 0) > 0;
  const hasFilteredProfiles = filteredProfiles.length > 0;
  const isGenerating = generateContentMutation.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Hub
          </Button>
          <h1 className="text-2xl font-serif font-bold text-foreground">Creation Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drop an idea. Generate voice-matched content and on-brand visuals for every platform — automatically.
          </p>
        </div>

        {/* Active Gap Query Banner */}
        {activeGapQueryText && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <Target className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-400">Addressing LLM Search Gap</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{activeGapQueryText}</p>
            </div>
            <button
              onClick={() => { setActiveGapQueryId(null); setActiveGapQueryText(null); }}
              className="text-zinc-600 hover:text-muted-foreground text-xs shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Gumshoe Research Context Panel */}
        {(topGaps as Array<{ id: number; query: string; personaName: string | null; gapScore: number | null; topicTags: string | null }>).length > 0 && showResearchPanel && (
          <Card className="bg-amber-950/20 border-amber-800/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Research Intelligence — Top LLM Search Gaps
                </CardTitle>
                <button
                  onClick={() => setShowResearchPanel(false)}
                  className="text-muted-foreground hover:text-foreground/80 text-xs"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Queries where Urban Monk is absent from LLM answers. Click to pre-fill your idea, or use the Studio button on the Research page to jump here directly.
              </p>
              {/* Competitor context strip */}
              {(competitorLeaderboard as Array<{ brand: string; mentionCount: number }>).length > 0 && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Swords className="w-3 h-3 text-red-400" />
                    Winning these gaps:
                  </span>
                  {(competitorLeaderboard as Array<{ brand: string; mentionCount: number }>).map((c) => (
                    <Badge key={c.brand} className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                      {c.brand} ({c.mentionCount})
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Active gap highlight — shown when navigated from Research page */}
              {activeGapQueryId && activeGapQueryText && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 mb-1">
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-teal-300 text-xs font-medium">Gap loaded from Research page</p>
                    <p className="text-teal-200/70 text-xs truncate">{activeGapQueryText}</p>
                  </div>
                  <button
                    onClick={() => { setActiveGapQueryId(null); setActiveGapQueryText(null); }}
                    className="text-teal-500/50 hover:text-teal-400 text-xs shrink-0"
                  >
                    ×
                  </button>
                </div>
              )}
              {(topGaps as Array<{ id: number; query: string; personaName: string | null; gapScore: number | null; topicTags: string | null }>).map((gap) => {
                const tags = (() => { try { return JSON.parse(gap.topicTags ?? "[]") as string[]; } catch { return []; } })();
                const isActive = gap.id === activeGapQueryId;
                return (
                  <button
                    key={gap.id}
                    onClick={() => {
                      const competitors = (competitorLeaderboard as Array<{ brand: string; mentionCount: number }>)
                        .slice(0, 5).map((c) => c.brand);
                      setIdea(`[Research Gap] Answer this LLM search query for the persona "${gap.personaName ?? "Wellness Seeker"}": ${gap.query}\n\nCompetitors winning this query: ${competitors.join(", ") || "none identified"}\nTopic tags: ${tags.join(", ") || "general wellness"}`);
                      setActiveGapQueryId(gap.id);
                      setActiveGapQueryText(gap.query);
                      toast.success("Gap query loaded — competitor context included!");
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors group ${
                      isActive
                        ? "bg-teal-500/10 border-teal-500/40"
                        : "bg-card/60 border-border hover:border-amber-700/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={`text-sm transition-colors ${
                          isActive ? "text-teal-300" : "text-foreground/80 group-hover:text-foreground"
                        }`}>{gap.query}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {gap.personaName && (
                            <Badge variant="outline" className="text-muted-foreground border-border text-xs">{gap.personaName}</Badge>
                          )}
                          {gap.gapScore != null && gap.gapScore >= 5 && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Gap {gap.gapScore}/10 🔥</Badge>
                          )}
                          {tags.slice(0, 2).map((t: string) => (
                            <Badge key={t} className="bg-muted text-muted-foreground text-xs border-border">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <Target className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
                        isActive ? "text-teal-400" : "text-amber-500/50 group-hover:text-amber-400"
                      }`} />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Input Panel */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-foreground">Your Idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Drop a raw idea, topic, or question here. The AI will transform it into platform-optimized content with matching visuals..."
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                className="bg-background border-border resize-none text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Platform</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPlatform(p.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        platform === p.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      <span className={platform === p.key ? "text-primary" : p.color}>{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Custom Instructions (optional)
                </Label>
                <Textarea
                  placeholder="e.g. Focus on the gut-brain connection, mention the Academy..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={2}
                  className="bg-background border-border resize-none text-sm text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Persona + Content Goal Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Target Persona (optional)</Label>
                <Select
                  value={selectedPersonaId ? String(selectedPersonaId) : "none"}
                  onValueChange={(v) => setSelectedPersonaId(v === "none" ? null : parseInt(v))}
                >
                  <SelectTrigger className="bg-background border-border text-foreground h-9 text-sm">
                    <SelectValue placeholder="Select audience persona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific persona</SelectItem>
                    {(personas as Array<{ id: number; name: string }>).map((p) => {
                      const enrichInfo = enrichmentMap[p.id];
                      return (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <span className="flex items-center gap-2">
                            {p.name}
                            {enrichInfo?.isEnriched && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                ✦ {enrichInfo.painCount} survey insights
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {/* Enrichment indicator below selector */}
                {selectedPersonaId && enrichmentMap[selectedPersonaId] && (() => {
                  const ei = enrichmentMap[selectedPersonaId] as any;
                  const daysAgo = ei.enrichedAt
                    ? Math.floor((Date.now() - new Date(ei.enrichedAt).getTime()) / 86400000)
                    : null;
                  return (
                    <div className={`text-[11px] mt-1.5 rounded-md px-2 py-1.5 border ${
                      ei.isEnriched
                        ? 'bg-primary/5 border-primary/20 text-primary'
                        : 'bg-muted/40 border-border text-muted-foreground'
                    }`}>
                      {ei.isEnriched ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>✦</span>
                            <span>{ei.painCount} survey pain points + {ei.aspirationCount} aspirations active</span>
                          </div>
                          {ei.surveySource && (
                            <div className="text-[10px] opacity-70">
                              Source: {ei.surveySource}
                              {ei.surveyResponseCount > 0 && ` · ${ei.surveyResponseCount} responses`}
                              {daysAgo !== null && ` · enriched ${daysAgo === 0 ? 'today' : `${daysAgo}d ago`}`}
                            </div>
                          )}
                          <div className="text-[10px] opacity-60">AI will use real audience language in every generation</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>○</span>
                          <span>No survey data — run <strong>Typeform Intelligence</strong> to enrich this persona with real audience pain points</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Content Goal (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "audience_growth", label: "Audience Growth", color: "bg-green-500/20 text-green-700 border-green-500/40" },
                    { key: "community_engagement", label: "Community", color: "bg-blue-500/20 text-blue-700 border-blue-500/40" },
                    { key: "llm_seo", label: "LLM SEO", color: "bg-purple-500/20 text-purple-700 border-purple-500/40" },
                  ].map((goal) => (
                    <button
                      key={goal.key}
                      type="button"
                      onClick={() => setSelectedContentGoal(
                        selectedContentGoal === goal.key as "audience_growth" | "llm_seo" | "community_engagement"
                          ? null
                          : goal.key as "audience_growth" | "llm_seo" | "community_engagement"
                      )}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        selectedContentGoal === goal.key
                          ? goal.color + " ring-1 ring-offset-1 ring-current"
                          : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                      }`}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Carousel controls */}
            {platform === "carousel" && (
              <div className="space-y-3 p-3 rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/20">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-fuchsia-400" />
                  <span className="text-xs font-medium text-fuchsia-400">Carousel Settings</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Platform</Label>
                    <Select value={carouselPlatform} onValueChange={(v) => setCarouselPlatform(v as "meta" | "linkedin")}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meta">Meta (Instagram/Facebook)</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Slide Count</Label>
                    <Select value={String(carouselSlideCount)} onValueChange={(v) => setCarouselSlideCount(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Common Belief input for Reframe Post */}
            {platform === "reframe" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Common Belief to Reframe (optional)</Label>
                <input
                  type="text"
                  value={commonBelief}
                  onChange={(e) => setCommonBelief(e.target.value)}
                  placeholder='e.g. "You need 8 hours of sleep every night"'
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Strike Zone SEO Mode indicator — shows when keyword + position are loaded from Keyword Strategy */}
            {platform === "blog" && focusKeyword && (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
                currentPosition && parseFloat(currentPosition) >= 11 && parseFloat(currentPosition) <= 30
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-primary/30 bg-primary/5"
              }`}>
                <Zap className={`h-4 w-4 mt-0.5 shrink-0 ${
                  currentPosition && parseFloat(currentPosition) >= 11 && parseFloat(currentPosition) <= 30
                    ? "text-amber-500"
                    : "text-primary"
                }`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold uppercase tracking-wider ${
                    currentPosition && parseFloat(currentPosition) >= 11 && parseFloat(currentPosition) <= 30
                      ? "text-amber-600"
                      : "text-primary"
                  }`}>
                    {currentPosition && parseFloat(currentPosition) >= 11 && parseFloat(currentPosition) <= 30
                      ? `⚡ Strike Zone Mode — pos ${parseFloat(currentPosition).toFixed(1)}`
                      : "SEO Targeting Active"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Focus keyword: <span className="font-medium text-foreground">"{focusKeyword}"</span>
                    {currentPosition && parseFloat(currentPosition) >= 11 && parseFloat(currentPosition) <= 30 && (
                      <span className="ml-1 text-amber-600">\u2014 tactical SEO brief injected to outrank top 10</span>
                    )}
                  </div>
                  <button
                    onClick={() => { setFocusKeyword(""); setCurrentPosition(""); }}
                    className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground mt-1 underline"
                  >
                    Clear targeting
                  </button>
                </div>
              </div>
            )}

            {/* CTA Destination Picker — blog only */}
            {platform === "blog" && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">CTA Destination</Label>
                <Select
                  value={selectedCtaBlockId ? String(selectedCtaBlockId) : "auto"}
                  onValueChange={(v) => setSelectedCtaBlockId(v === "auto" ? null : parseInt(v))}
                >
                  <SelectTrigger className="bg-background border-border text-foreground h-9 text-sm">
                    <SelectValue placeholder="Auto-select by topic..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-select by topic</SelectItem>
                    {(ctaBlocksList as Array<{ id: number; label: string; url: string | null; isDefault: boolean }>).map((block) => (
                      <SelectItem key={block.id} value={String(block.id)}>
                        <span className="flex items-center gap-2">
                          {block.isDefault && <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-primary/20 text-primary">DEFAULT</span>}
                          {block.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCtaBlockId && (() => {
                  const block = (ctaBlocksList as Array<{ id: number; label: string; url: string | null; isDefault: boolean }>).find((b) => b.id === selectedCtaBlockId);
                  if (!block?.url) return null;
                  const articleSlug = idea.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").substring(0, 64);
                  const previewUrl = `${block.url}${block.url.includes('?') ? '&' : '?'}utm_source=blog&utm_medium=organic-content&utm_campaign=${articleSlug}&utm_content=inline-cta`;
                  return (
                    <div className="text-[11px] mt-1 rounded-md px-2 py-1.5 border bg-emerald-500/5 border-emerald-500/20 text-emerald-700 font-mono break-all">
                      {previewUrl}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* UTM Content Placement Override */}
            {platform !== "reframe" && platform !== "carousel" && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-600/20 bg-emerald-950/10 px-3 py-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">UTM Placement</span>
                </div>
                <Select value={utmContentOverride || "__default__"} onValueChange={(v) => setUtmContentOverride(v === "__default__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs bg-background border-emerald-600/30 text-foreground flex-1 min-w-0">
                    <SelectValue placeholder="Platform default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Platform default ({{
                      blog: "inline-cta",
                      youtube: "video-description",
                      meta: "video-ad",
                      instagram: "reel",
                      facebook: "post",
                      linkedin: "post",
                      x: "tweet",
                      tiktok: "video",
                      podcast: "episode-description",
                      email: "sequence-email",
                      newsletter: "weekly-digest",
                      all: "post",
                      script: "video-script",
                    }[platform] ?? "content"})</SelectItem>
                    <SelectItem value="bio-link">bio-link</SelectItem>
                    <SelectItem value="story">story</SelectItem>
                    <SelectItem value="reel">reel</SelectItem>
                    <SelectItem value="post">post</SelectItem>
                    <SelectItem value="video-description">video-description</SelectItem>
                    <SelectItem value="inline-cta">inline-cta</SelectItem>
                    <SelectItem value="sidebar-cta">sidebar-cta</SelectItem>
                    <SelectItem value="email-footer">email-footer</SelectItem>
                    <SelectItem value="episode-description">episode-description</SelectItem>
                    <SelectItem value="tweet">tweet</SelectItem>
                    <SelectItem value="video-ad">video-ad</SelectItem>
                    <SelectItem value="carousel-slide">carousel-slide</SelectItem>
                  </SelectContent>
                </Select>
                {utmContentOverride && (
                  <button
                    type="button"
                    onClick={() => setUtmContentOverride("")}
                    className="text-[10px] text-emerald-400/60 hover:text-emerald-400 shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
            {/* Auto-image toggle — only show for platforms that support image generation */}
            {platform !== "blog" && platform !== "reframe" && (
              <div className="flex items-center gap-2 py-1">
                <Checkbox
                  id="generate-images-toggle"
                  checked={generateImagesEnabled}
                  onCheckedChange={(checked) => setGenerateImagesEnabled(checked === true)}
                />
                <Label htmlFor="generate-images-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Auto-generate images with content
                </Label>
              </div>
            )}
            <Button
              onClick={
                platform === "blog" ? handleGenerateBlog
                : platform === "reframe" ? () => generateReframeMutation.mutate({ topic: idea, commonBelief: commonBelief || undefined })
                : platform === "carousel" ? handleGenerateCarousel
                : handleGenerate
              }
              disabled={(
                platform === "blog" ? isBlogGenerating
                : platform === "reframe" ? generateReframeMutation.isPending
                : platform === "carousel" ? isCarouselGenerating
                : isGenerating
              ) || !idea.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
            >
              {(platform === "blog" ? isBlogGenerating : platform === "reframe" ? generateReframeMutation.isPending : platform === "carousel" ? isCarouselGenerating : isGenerating) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {platform === "blog" ? "Writing blog post + featured image (30–60 seconds)..."
                    : platform === "reframe" ? "Generating Reframe carousel (10–20 seconds)..."
                    : platform === "carousel" ? `Generating ${carouselSlideCount}-slide carousel + images (30–60 seconds)...`
                    : platform === "tiktok" ? "Writing TikTok script + vertical visual (20–40 seconds)..."
                    : "Generating content + images (20–40 seconds)..."}
                </>
              ) : (
                <>
                  {platform === "blog" ? <BookOpen className="h-4 w-4 mr-2" />
                    : platform === "reframe" ? <LayoutGrid className="h-4 w-4 mr-2" />
                    : platform === "carousel" ? <LayoutGrid className="h-4 w-4 mr-2" />
                    : platform === "tiktok" ? <Music2 className="h-4 w-4 mr-2" />
                    : <Sparkles className="h-4 w-4 mr-2" />}
                  {platform === "blog" ? "Generate Blog Post"
                    : platform === "reframe" ? "Generate Reframe Post"
                    : platform === "carousel" ? `Generate ${carouselSlideCount}-Slide Carousel`
                    : platform === "tiktok" ? "Generate TikTok Script + Visual"
                    : "Generate Content + Images"}
                </>
              )}
            </Button>

            {(platform === "blog" ? isBlogGenerating : isGenerating) && (
              <p className="text-xs text-muted-foreground text-center">
                {platform === "blog"
                  ? "Writing a full SEO-optimized article for theurbanmonk.com with featured image — this takes a moment."
                  : platform === "tiktok"
                  ? "Writing a 60-90 second TikTok video script with vertical visual — this takes a moment."
                  : "Writing platform copy and generating Nano Banana visuals in parallel — this takes a moment."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── YouTube Competitive Intelligence Panel ─────────────────────────── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-400" />
                <CardTitle className="text-sm font-medium text-foreground">YouTube Competitive Intelligence</CardTitle>
                <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">Beta</Badge>
              </div>
              <button
                onClick={() => setShowYTPanel((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showYTPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {!showYTPanel && (
              <p className="text-xs text-muted-foreground mt-1">
                Search competitor videos, pull transcripts, and get a differentiation brief — then inject it into your script.
              </p>
            )}
          </CardHeader>

          {showYTPanel && (
            <CardContent className="space-y-4">
              {/* Step 1: Search */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Step 1 — Search Competitor Videos</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ytSearchQuery}
                    onChange={(e) => setYtSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleYTSearch()}
                    placeholder={idea.trim() ? `Search: "${idea.slice(0, 50)}..."` : "Enter topic to search YouTube..."}
                    className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    onClick={handleYTSearch}
                    disabled={ytSearchMutation.isPending}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white shrink-0"
                  >
                    {ytSearchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-1.5 hidden sm:inline">{ytSearchMutation.isPending ? "Searching..." : "Search"}</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Searches YouTube for the top 5 most-viewed videos on this topic from the past year. 1 credit per search.</p>
              </div>

              {/* Step 2: Video Results */}
              {ytVideos.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Step 2 — Select Videos to Analyze (max 3)
                  </Label>
                  <div className="space-y-2">
                    {ytVideos.map((v) => {
                      const isSelected = ytSelectedIds.includes(v.id);
                      const canSelect = isSelected || ytSelectedIds.length < 3;
                      return (
                        <div
                          key={v.id}
                          onClick={() => {
                            if (isSelected) {
                              setYtSelectedIds((prev) => prev.filter((id) => id !== v.id));
                            } else if (canSelect) {
                              setYtSelectedIds((prev) => [...prev, v.id]);
                            }
                          }}
                          className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-red-500/50 bg-red-500/5"
                              : canSelect
                              ? "border-border hover:border-red-500/30 bg-card/40"
                              : "border-border bg-card/20 opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <img
                            src={v.thumbnail}
                            alt={v.title}
                            className="w-20 h-14 object-cover rounded shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{v.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">{v.channelName}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Eye className="h-3 w-3" />{v.viewCount.toLocaleString()} views
                              </span>
                              <span className="text-xs text-muted-foreground">· {formatDuration(v.duration)}</span>
                            </div>
                            {ytTranscripts.find((t) => t.videoId === v.id) && (
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                <Badge className={`text-xs ${
                                  ytTranscripts.find((t) => t.videoId === v.id)?.error
                                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                                    : "bg-green-500/20 text-green-400 border-green-500/30"
                                }`}>
                                  {ytTranscripts.find((t) => t.videoId === v.id)?.error ? "No transcript" : "Transcript ready"}
                                </Badge>
                                {!ytTranscripts.find((t) => t.videoId === v.id)?.error && !ytSummaries[v.id] && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-5 text-[10px] px-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                                    disabled={ytSummarizing === v.id}
                                    onClick={(e) => { e.stopPropagation(); handleYTSummarize(v.id); }}
                                  >
                                    {ytSummarizing === v.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                                    <span className="ml-1">{ytSummarizing === v.id ? "Summarizing..." : "Summarize"}</span>
                                  </Button>
                                )}
                                {ytSummaries[v.id] && (
                                  <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">Outlined</Badge>
                                )}
                              </div>
                            )}
                            {ytSummaries[v.id] && (
                              <div
                                className="mt-2 p-2 rounded bg-amber-500/5 border border-amber-500/20 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {ytSummaries[v.id]}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex items-start pt-1">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected ? "border-red-500 bg-red-500" : "border-border"
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{ytSelectedIds.length}/3 selected</p>
                </div>
              )}

              {/* Step 3: Fetch Transcripts */}
              {ytStep === "searched" && ytSelectedIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Step 3 — Pull Transcripts</Label>
                  <Button
                    onClick={handleYTFetchTranscripts}
                    disabled={ytTranscriptMutation.isPending}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    {ytTranscriptMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Fetching transcripts...</>
                    ) : (
                      <><BookOpen className="h-4 w-4 mr-2" />Fetch Transcripts for {ytSelectedIds.length} Video{ytSelectedIds.length > 1 ? "s" : ""}</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">Pulls existing captions only (no AI generation). 1 credit per video.</p>
                </div>
              )}

              {/* Step 4: Analyze */}
              {(ytStep === "transcripts" || (ytStep === "searched" && ytTranscripts.length > 0)) && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Step 4 — Analyze & Differentiate</Label>
                  <Button
                    onClick={handleYTAnalyze}
                    disabled={ytAnalyzeMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {ytAnalyzeMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing competitors (15–30 seconds)...</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" />Analyze Competitors + Generate Differentiation Brief</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">LLM analyzes hooks, structure, gaps, and generates Pedram's unique angle. No additional credits.</p>
                </div>
              )}

              {/* Step 5: Differentiation Brief + Script Generation + Routing */}
              {ytBrief && (
                <div className="space-y-4">
                  {/* Brief display */}
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Differentiation Brief</Label>
                    <Button size="sm" variant="outline"
                      onClick={() => { navigator.clipboard.writeText(ytBrief); toast.success("Brief copied!"); }}
                      className="text-xs h-7 border-border"
                    >
                      <Copy className="h-3 w-3 mr-1" />Copy Brief
                    </Button>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{ytBrief}</pre>
                  </div>

                  {/* Step 5b: Write Full Script */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Step 5 — Write Full Script</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Target length:</span>
                        <select
                          value={ytScriptDuration}
                          onChange={(e) => setYtScriptDuration(Number(e.target.value))}
                          className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
                        >
                          <option value={5}>5 min (~650 words)</option>
                          <option value={8}>8 min (~1,040 words)</option>
                          <option value={10}>10 min (~1,300 words)</option>
                          <option value={15}>15 min (~1,950 words)</option>
                        </select>
                      </div>
                      <Button
                        onClick={handleYTGenerateScript}
                        disabled={ytGenerateScriptMutation.isPending}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {ytGenerateScriptMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Writing script (20–40 sec)...</>
                        ) : (
                          <><Wand2 className="h-4 w-4 mr-2" />Write Script from Brief</>
                        )}
                      </Button>
                    </div>

                    {/* Generated Script */}
                    {ytGeneratedScript && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {ytScriptWordCount.toLocaleString()} words · ~{Math.round(ytScriptWordCount / 130)} min at teleprompter pace
                          </span>
                          <Button size="sm" variant="outline"
                            onClick={() => { navigator.clipboard.writeText(ytGeneratedScript); toast.success("Script copied!"); }}
                            className="text-xs h-7 border-border"
                          >
                            <Copy className="h-3 w-3 mr-1" />Copy Script
                          </Button>
                        </div>
                        <div className="rounded-lg border border-border bg-background p-4 max-h-80 overflow-y-auto">
                          <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{ytGeneratedScript}</pre>
                        </div>

                        {/* Step 6: Route to Production */}
                        {!ytRoutingResult ? (
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Step 6 — Route to Production</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Button
                                onClick={() => handleYTRouteScript("heygen")}
                                disabled={ytCreateVideoJobMutation.isPending}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 h-auto py-3 flex-col gap-1"
                              >
                                {ytCreateVideoJobMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                <span className="text-xs font-semibold">Send to HeyGen</span>
                                <span className="text-xs opacity-70">Avatar renders automatically</span>
                              </Button>
                              <Button
                                onClick={() => handleYTRouteScript("record_self")}
                                disabled={ytCreateVideoJobMutation.isPending}
                                variant="outline"
                                className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 h-auto py-3 flex-col gap-1"
                              >
                                <BookOpen className="h-4 w-4" />
                                <span className="text-xs font-semibold">I&apos;ll Record Myself</span>
                                <span className="text-xs opacity-70">Saves to Script Library</span>
                              </Button>
                              <Button
                                onClick={() => handleYTRouteScript("script_library")}
                                disabled={ytCreateVideoJobMutation.isPending}
                                variant="outline"
                                className="border-green-500/40 text-green-400 hover:bg-green-500/10 h-auto py-3 flex-col gap-1"
                              >
                                <Save className="h-4 w-4" />
                                <span className="text-xs font-semibold">Save for Later</span>
                                <span className="text-xs opacity-70">Script Library — decide later</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1">
                            <div className="flex items-center gap-2 text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {ytRoutingResult.destination === "heygen"
                                  ? `Video job #${ytRoutingResult.jobId} queued for HeyGen`
                                  : ytRoutingResult.destination === "record_self"
                                  ? "Script saved — ready for you to record"
                                  : "Script saved to Script Library"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {ytRoutingResult.destination === "heygen"
                                ? "Track progress in the VA Dashboard. HeyGen → Descript → b-roll → export."
                                : `Script Library ID: ${ytRoutingResult.scriptId}. Open Script Library to view or export as DOCX for teleprompter.`}
                            </p>
                            <Button size="sm" variant="outline"
                              onClick={() => { setYtGeneratedScript(""); setYtRoutingResult(null); }}
                              className="text-xs h-7 mt-1"
                            >
                              Write Another Script
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Generated Content Panels — each with inline image */}
        {Object.keys(generatedContent).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-semibold text-foreground">Generated Content</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {outputPlatforms.map((p) => {
                const platformInfo = PLATFORMS.find((pl) => pl.key === p);
                const output = generatedContent[p];
                const savedId = savedItemIds[p];
                const isAttached = savedId && attachedToIds.includes(savedId);
                const syndicationResult = syndicationResults[p];
                const isRegeneratingThisImage = regeneratingImageFor === p;

                return (
                  <Card key={p} className="bg-card border-border overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={platformInfo?.color}>{platformInfo?.icon}</span>
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {PLATFORM_LABELS[p] || p}
                          </CardTitle>
                          {savedId && (
                            <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">
                              Saved
                            </Badge>
                          )}
                          {isAttached && (
                            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                              <Paperclip className="h-2.5 w-2.5 mr-1" />
                              Image attached
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(editedText[p] || "")}
                            title="Copy to clipboard"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSave(p)}
                            disabled={savingPlatform === p || createContentMutation.isPending}
                            title="Save to Command Center"
                          >
                            {savingPlatform === p ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-3 w-3 mr-1" />
                                {savedId ? "Re-save" : "Save"}
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 px-2 text-xs ${
                              syndicationResult?.success
                                ? "text-green-400 hover:text-green-300"
                                : "text-blue-400 hover:text-blue-300"
                            }`}
                            onClick={() => handleSyndicateDirect(p)}
                            disabled={syndicatingPlatform === p || syndicationMutation.isPending}
                            title="Push to Buffer"
                          >
                            {syndicatingPlatform === p ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : syndicationResult?.success ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Sent
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3 mr-1" />
                                Push to Buffer
                              </>
                            )}
                          </Button>
                          {/* Teleprompter button — YouTube only */}
                          {p === "youtube" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              onClick={handleGenerateTeleprompter}
                              disabled={generatingTeleprompter || teleprompterMutation.isPending}
                              title="Generate a full teleprompter script from this YouTube content"
                            >
                              {generatingTeleprompter ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Wand2 className="h-3 w-3 mr-1" />
                              )}
                              {generatingTeleprompter ? "Generating..." : "Teleprompter Script"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">

                      {/* Auto-generated platform image */}
                      {(output?.imageUrl || isRegeneratingThisImage) && (
                        <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
                          {isRegeneratingThisImage ? (
                            <div className="flex items-center justify-center h-40 bg-muted/30">
                              <div className="text-center space-y-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                <p className="text-xs text-muted-foreground">Regenerating image...</p>
                              </div>
                            </div>
                          ) : output?.imageUrl ? (
                            <>
                              <img
                                src={output.imageUrl}
                                alt={`${PLATFORM_LABELS[p]} visual`}
                                className="w-full object-cover"
                              />
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-black/70 text-foreground border-0 text-[10px]">
                                  {PLATFORM_STYLE_LABELS[p]?.label ?? "Urban Monk Style"}
                                </Badge>
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1">
                                <button
                                  onClick={() => window.open(output.imageUrl, "_blank")}
                                  className="p-1 rounded bg-black/60 hover:bg-black/80 transition-colors"
                                  title="Open full size"
                                >
                                  <ExternalLink className="h-3 w-3 text-foreground" />
                                </button>
                                <button
                                  onClick={() => handleRegenerateImage(p)}
                                  className="p-1 rounded bg-black/60 hover:bg-black/80 transition-colors"
                                  title="Regenerate image"
                                >
                                  <RefreshCw className="h-3 w-3 text-foreground" />
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      )}

                      {/* Image loading skeleton while main generation is running */}
                      {isGenerating && !output?.imageUrl && (
                        <div className="rounded-lg border border-border bg-muted/20 h-40 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                            <p className="text-xs text-muted-foreground">Generating visual...</p>
                          </div>
                        </div>
                      )}

                      {/* If no image was generated, show a generate button */}
                      {!output?.imageUrl && !isGenerating && !isRegeneratingThisImage && output?.text && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 border-dashed"
                          onClick={() => handleRegenerateImage(p)}
                        >
                          <Image className="h-3 w-3 mr-1" />
                          Generate image for this platform
                        </Button>
                      )}

                      {/* Editable copy */}
                      <Textarea
                        value={editedText[p] || ""}
                        onChange={(e) =>
                          setEditedText((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                        rows={10}
                        className={`bg-background border-border resize-none text-sm text-foreground font-mono leading-relaxed ${
                          p === "x" && (editedText[p] || "").length > 280 ? "border-red-500" : ""
                        }`}
                      />
                      {/* X/Twitter character counter */}
                      {p === "x" && (() => {
                        const charCount = (editedText[p] || "").length;
                        const isOver = charCount > 280;
                        const isWarning = charCount > 240 && !isOver;
                        return (
                          <div className={`flex items-center justify-between text-xs px-1 ${
                            isOver ? "text-red-400" : isWarning ? "text-amber-400" : "text-muted-foreground"
                          }`}>
                            <span>{isOver ? `⚠ ${charCount - 280} over limit — edit to shorten before publishing` : isWarning ? `${280 - charCount} characters remaining` : `${280 - charCount} characters remaining`}</span>
                            <span className="font-mono font-bold">{charCount} / 280</span>
                          </div>
                        );
                      })()}

                      {/* Attach manual image to this card */}
                      {generatedImageUrl && savedId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={`w-full text-xs h-8 ${isAttached ? "border-primary/40 text-primary" : ""}`}
                          onClick={() => handleAttachImage(savedId)}
                          disabled={attachingImage || !!isAttached}
                        >
                          {attachingImage ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : isAttached ? (
                            <CheckCircle2 className="h-3 w-3 mr-1 text-primary" />
                          ) : (
                            <Paperclip className="h-3 w-3 mr-1" />
                          )}
                          {isAttached ? "Manual image attached" : "Attach manual image to card"}
                        </Button>
                      )}

                      {/* Syndication result badge */}
                      {syndicationResult && (
                        <div className={`flex items-center gap-2 text-xs p-2 rounded-md ${
                          syndicationResult.success
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                          {syndicationResult.success ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3 w-3 shrink-0" />
                          )}
                          {syndicationResult.success
                            ? "Pushed to Buffer successfully"
                            : syndicationResult.error}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Teleprompter Script Panel ── */}
        {(showTeleprompter || generatingTeleprompter) && (
          <Card className="bg-card border-amber-500/20 border overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-base font-semibold text-foreground">Teleprompter Script</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">YouTube Ready</Badge>
                </div>
                {teleprompterScript && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(teleprompterScript);
                        toast.success("Script copied to clipboard!");
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Script
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const blob = new Blob([teleprompterScript], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const titleSlug = (editedText["youtube"] || idea).split("\n")[0].slice(0, 40).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
                        a.download = `teleprompter-${titleSlug}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300"
                      onClick={handleGenerateTeleprompter}
                      disabled={generatingTeleprompter}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regenerate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                      onClick={handleSaveTeleprompterToLibrary}
                      disabled={saveTeleprompterMutation.isPending || teleprompterSaved}
                    >
                      {saveTeleprompterMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : teleprompterSaved ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <BookMarked className="h-3 w-3 mr-1" />
                      )}
                      {teleprompterSaved ? "Saved!" : "Save to Library"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setShowTeleprompter(false); setTeleprompterScript(null); }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {generatingTeleprompter ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                  <span className="text-sm text-muted-foreground">Writing your teleprompter script… this takes about 30 seconds.</span>
                </div>
              ) : teleprompterScript ? (
                <div className="space-y-4">
                  <div className="bg-black/20 rounded-lg p-4 border border-amber-500/10">
                    <p className="text-xs text-amber-400/70 mb-3 font-medium uppercase tracking-wider">Script — read directly from screen</p>
                    <div className="text-sm text-foreground leading-loose whitespace-pre-wrap font-mono">
                      {teleprompterScript}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: Use a teleprompter app (PromptSmart, Teleprompter Premium, or Descript) and paste this script directly. [PAUSE] markers indicate natural breath points. [B-ROLL] cues are for your editor.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* TikTok Script Panel */}
        {platform === "tiktok" && Object.keys(generatedContent).length > 0 && generatedContent["tiktok"] && (
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 text-pink-400" />
                  <CardTitle className="text-base font-semibold text-foreground">TikTok Script</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-400">60–90 sec</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleCopy(editedText["tiktok"] || generatedContent["tiktok"]?.text || "")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Script
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleSave("tiktok")}
                    disabled={savingPlatform === "tiktok" || createContentMutation.isPending}
                  >
                    {savingPlatform === "tiktok" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        {savedItemIds["tiktok"] ? "Re-save" : "Save to Kanban"}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-pink-400 hover:text-pink-300"
                    onClick={() => handleSyndicateDirect("tiktok")}
                    disabled={syndicatingPlatform === "tiktok" || syndicationMutation.isPending}
                  >
                    {syndicatingPlatform === "tiktok" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : syndicationResults["tiktok"]?.success ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" />Sent</>
                    ) : (
                      <><Send className="h-3 w-3 mr-1" />Push to Buffer</>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Vertical visual */}
              {generatedContent["tiktok"]?.imageUrl && (
                <div className="flex justify-center">
                  <div className="relative rounded-lg overflow-hidden border border-border" style={{ maxWidth: 280 }}>
                    <img
                      src={generatedContent["tiktok"].imageUrl}
                      alt="TikTok vertical visual"
                      className="w-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-black/70 text-foreground border-0 text-[10px]">9:16 Vertical</Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => handleRegenerateImage("tiktok")}
                        className="p-1 rounded bg-black/60 hover:bg-black/80 transition-colors"
                        title="Regenerate image"
                      >
                        <RefreshCw className="h-3 w-3 text-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Script body */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Video Script</p>
                <Textarea
                  value={editedText["tiktok"] || generatedContent["tiktok"]?.text || ""}
                  onChange={(e) => setEditedText((prev) => ({ ...prev, tiktok: e.target.value }))}
                  rows={14}
                  className="bg-background border-border resize-y text-sm text-foreground font-mono leading-relaxed"
                />
              </div>

              {/* TikTok tip */}
              <div className="flex items-center gap-2 p-3 rounded-md bg-pink-500/5 border border-pink-500/20">
                <Music2 className="h-4 w-4 text-pink-400 shrink-0" />
                <p className="text-xs text-pink-400/80">
                  Script is 60–90 seconds when spoken at a natural pace. Hashtags are included at the end. Push to Buffer to schedule directly to your TikTok channel.
                </p>
              </div>

              {/* TikTok 60-second Teleprompter Script */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-pink-400" />
                    <p className="text-sm font-medium text-foreground">60-Second Teleprompter Script</p>
                    <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-400">Punchy Hook + 3 Points + CTA</Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-pink-500/40 text-pink-400 hover:bg-pink-500/10"
                      onClick={handleGenerateTiktok60}
                      disabled={generatingTiktok60 || tiktok60Mutation.isPending}
                    >
                      {generatingTiktok60 ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Wand2 className="h-3 w-3 mr-1" />
                      )}
                      {generatingTiktok60 ? "Generating…" : "Generate 60-sec Script"}
                    </Button>
                    {tiktokScript60 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => { navigator.clipboard.writeText(tiktokScript60); toast.success("Script copied!"); }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            const blob = new Blob([tiktokScript60], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            const slug = idea.slice(0, 30).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
                            a.download = `tiktok-60s-${slug}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                          onClick={handleSaveTiktok60ToLibrary}
                          disabled={saveTiktok60Mutation.isPending || tiktok60Saved}
                        >
                          {saveTiktok60Mutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : tiktok60Saved ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <BookMarked className="h-3 w-3 mr-1" />
                          )}
                          {tiktok60Saved ? "Saved!" : "Save to Library"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {generatingTiktok60 && (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
                    Writing 60-second TikTok script… about 20 seconds.
                  </div>
                )}
                {tiktokScript60 && !generatingTiktok60 && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-pink-500/20 bg-black/20 p-4 max-h-64 overflow-y-auto">
                      <p className="text-[10px] text-pink-400/70 mb-2 font-medium uppercase tracking-wider">60-Second TikTok Script</p>
                      <div className="text-sm text-foreground leading-loose whitespace-pre-wrap font-mono">
                        {tiktokScript60}
                      </div>
                    </div>
                    {/* Word-count + spoken-time indicator */}
                    {(() => {
                      const words = tiktokScript60.trim().split(/\s+/).filter(Boolean).length;
                      const secs = Math.round((words / 130) * 60);
                      const isShort = secs < 50;
                      const isLong = secs > 70;
                      const color = isShort ? "text-amber-400" : isLong ? "text-red-400" : "text-emerald-400";
                      const bg = isShort ? "bg-amber-950/30 border-amber-500/30" : isLong ? "bg-red-950/30 border-red-500/30" : "bg-emerald-950/30 border-emerald-500/30";
                      const label = isShort ? "Too short" : isLong ? "Too long" : "On target";
                      return (
                        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${bg}`}>
                          <span className={`text-xs font-semibold font-mono ${color}`}>{words} words</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={`text-xs font-semibold font-mono ${color}`}>~{secs}s spoken</span>
                          <span className="text-xs text-muted-foreground">(@ 130 wpm)</span>
                          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${color} ${bg}`}>{label}</span>
                          {isShort && <span className="text-xs text-amber-400/70">Add {Math.round((50 - secs) / 60 * 130)} more words</span>}
                          {isLong && <span className="text-xs text-red-400/70">Cut ~{Math.round((secs - 60) / 60 * 130)} words</span>}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blog Post Panel */}
        {platform === "blog" && blogContent && (
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-base font-semibold text-foreground">Blog Post — theurbanmonk.com</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">SEO Optimized</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleCopyBlog}
                    title="Copy as Markdown"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Markdown
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleDownloadBlog}
                    title="Download .md file"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download .md
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleSaveBlog}
                    disabled={savingPlatform === "blog" || createContentMutation.isPending}
                    title="Save to Command Center"
                  >
                    {savingPlatform === "blog" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        Save to Kanban
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Hero Image — full bleed at top */}
              {blogContent.imageUrl && (
                <div className="relative w-full overflow-hidden rounded-t-none" style={{ maxHeight: 340 }}>
                  <img
                    src={blogContent.imageUrl}
                    alt={blogContent.title}
                    className="w-full object-cover"
                    style={{ maxHeight: 340 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      Hero Image — theurbanmonk.com
                    </span>
                  </div>
                </div>
              )}

              {/* CTA Banner Preview — shown after generation */}
              {blogContent.ctaBannerUrl && (
                <div className="mx-4 mt-3 rounded-lg overflow-hidden border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-500/20">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <span>🎯</span> CTA Banner — Composited with Montserrat
                    </span>
                    <button
                      className="text-[10px] text-amber-400/70 hover:text-amber-400 underline underline-offset-2"
                      onClick={() => window.open(blogContent.ctaBannerUrl, "_blank")}
                    >
                      View full size ↗
                    </button>
                  </div>
                  <a href={blogContent.ctaBannerUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={blogContent.ctaBannerUrl}
                      alt="CTA Banner"
                      className="w-full object-cover hover:opacity-90 transition-opacity"
                      style={{ maxHeight: 200 }}
                    />
                  </a>
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* SEO Meta row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-border">
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Article Title</p>
                    <p className="text-lg font-serif font-semibold text-foreground leading-snug">{blogContent.title}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">URL Slug</p>
                      <p className="text-xs font-mono text-primary">/{blogContent.slug}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Read Time</p>
                      <p className="text-xs text-muted-foreground">{Math.max(1, Math.round((blogContent.body.split(/\s+/).length) / 200))} min · {blogContent.body.split(/\s+/).length.toLocaleString()} words</p>
                    </div>
                  </div>
                </div>

                {/* SEO Intelligence Panel — GhostLink OS B1/B15 */}
                <div className="space-y-3 p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">SEO & AEO Intelligence</p>
                  </div>

                  {/* Row 1: Meta + Focus Keyword */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Meta Description</p>
                      <p className="text-xs text-muted-foreground leading-relaxed border border-border rounded px-2.5 py-1.5 bg-background">{blogContent.metaDescription}</p>
                      <p className="text-[10px] text-muted-foreground">{blogContent.metaDescription?.length ?? 0} chars {(blogContent.metaDescription?.length ?? 0) >= 150 && (blogContent.metaDescription?.length ?? 0) <= 160 ? "✓" : "(target: 150–160)"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Focus Keyword (Yoast)</p>
                      <p className="text-xs font-mono text-primary border border-border rounded px-2.5 py-1.5 bg-background">{blogContent.focusKeyword || "—"}</p>
                      {blogContent.semanticKeywords && blogContent.semanticKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {blogContent.semanticKeywords.map((kw, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Hook Family + Emotional Driver */}
                  {(blogContent.hookFamily || blogContent.emotionalDriver) && (
                    <div className="grid grid-cols-2 gap-3">
                      {blogContent.hookFamily && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hook Family</p>
                          <p className="text-xs text-foreground border border-border rounded px-2.5 py-1.5 bg-background">{blogContent.hookFamily}</p>
                        </div>
                      )}
                      {blogContent.emotionalDriver && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Emotional Driver</p>
                          <p className="text-xs text-foreground border border-border rounded px-2.5 py-1.5 bg-background">{blogContent.emotionalDriver}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row 3: FAQ Section preview */}
                  {blogContent.faqSection && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">FAQ Section (Featured Snippet + AI Citation)</p>
                      <div className="text-xs text-muted-foreground border border-border rounded px-2.5 py-1.5 bg-background max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">{blogContent.faqSection.slice(0, 400)}{blogContent.faqSection.length > 400 ? "…" : ""}</div>
                      <p className="text-[10px] text-emerald-600">✓ FAQ schema (JSON-LD) will be injected on publish</p>
                    </div>
                  )}

                  {/* Row 4: Waterfall Map */}
                  {blogContent.waterfallMap && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Derivative Content Map (Waterfall)</p>
                      <div className="text-xs text-muted-foreground border border-border rounded px-2.5 py-1.5 bg-background max-h-20 overflow-y-auto whitespace-pre-wrap">{blogContent.waterfallMap.slice(0, 300)}{blogContent.waterfallMap.length > 300 ? "…" : ""}</div>
                    </div>
                  )}

                  {/* Schema status */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">✓ Article schema (JSON-LD)</span>
                    {blogContent.faqSection && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">✓ FAQ schema (JSON-LD)</span>}
                    {blogContent.focusKeyword && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">✓ Yoast focus keyword</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">✓ Canonical URL</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">✓ SEO title tag</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">✓ Image alt text</span>
                  </div>
                </div>

                {/* Article Body — Preview / Edit toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Article Body</p>
                    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                      <button
                        onClick={() => setBlogViewMode("preview")}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          blogViewMode === "preview"
                            ? "bg-background text-foreground shadow-sm font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => setBlogViewMode("edit")}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          blogViewMode === "edit"
                            ? "bg-background text-foreground shadow-sm font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Edit Markdown
                      </button>
                    </div>
                  </div>

                  {blogViewMode === "preview" ? (
                    <div className="blog-prose bg-background border border-border rounded-lg p-6 min-h-[400px]">
                      <Streamdown>{blogContent.body}</Streamdown>
                    </div>
                  ) : (
                    <Textarea
                      value={blogContent.body}
                      onChange={(e) => setBlogContent(prev => prev ? { ...prev, body: e.target.value } : null)}
                      rows={32}
                      className="bg-background border-border resize-y text-sm text-foreground font-mono leading-relaxed"
                      placeholder="Article Markdown..."
                    />
                  )}
                </div>
              </div>

              {/* WordPress Publish */}
              {/* WP Post Index Sync — for internal link injection */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Internal Link Index</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {wpIndexStats ? `${wpIndexStats.count} posts indexed${wpIndexStats.lastSynced ? ` · last synced ${new Date(wpIndexStats.lastSynced).toLocaleDateString()}` : ""}` : "Not yet synced"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs shrink-0"
                  disabled={isSyncingWpIndex}
                  onClick={() => {
                    setIsSyncingWpIndex(true);
                    syncPostIndexMutation.mutate();
                  }}
                >
                  {isSyncingWpIndex ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Syncing...</> : "Sync WP Posts"}
                </Button>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Publish to theurbanmonk.com</p>
                  </div>
                  {/* Substack cross-post toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="substack-toggle"
                      checked={sendToSubstack}
                      onCheckedChange={setSendToSubstack}
                      disabled={!!wpPublishResult}
                    />
                    <Label htmlFor="substack-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Also post to Substack
                    </Label>
                  </div>
                </div>
                {wpPublishResult ? (
                  <div className="space-y-2">
                    <p className="text-xs text-green-600 font-medium">
                      {wpPublishStatus === "publish" ? "Published live!" : "Saved as draft in WordPress"}
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={wpPublishResult.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> View Post
                      </a>
                      <span className="text-muted-foreground">·</span>
                      <a
                        href={wpPublishResult.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Edit in WP Admin
                      </a>
                    </div>
                    {substackPublishResult && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-500 font-medium">Also published to Substack</span>
                        <a
                          href={substackPublishResult.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> View on Substack
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePublishToWP("draft")}
                      disabled={isPublishingToWP || !savedItemIds["blog"]}
                      className="flex-1 text-xs"
                    >
                      {isPublishingToWP ? (
                        <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Publishing...</>
                      ) : (
                        <>Save as Draft</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handlePublishToWP("publish")}
                      disabled={isPublishingToWP || !savedItemIds["blog"]}
                      className="flex-1 text-xs"
                    >
                      {isPublishingToWP ? (
                        <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Publishing...</>
                      ) : (
                        <>Publish Live</>
                      )}
                    </Button>
                  </div>
                )}
                {!savedItemIds["blog"] && (
                  <p className="text-xs text-muted-foreground">Save to Kanban first to enable WordPress publish.</p>
                )}
              </div>

              {/* ── Blog → YouTube Script ── */}
              {blogContent && (savedItemIds["blog"] || wpPublishResult) && (
                <div className="space-y-3 p-4 rounded-lg bg-red-950/20 border border-red-900/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-red-400" />
                      <p className="text-sm font-medium text-foreground">Generate YouTube Script</p>
                      <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">From this blog post</Badge>
                    </div>
                    {blogYtScript && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(blogYtScript);
                            toast.success("Script copied to clipboard!");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            const blob = new Blob([blogYtScript], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `yt-script-${(blogContent?.slug ?? "script").slice(0, 40)}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                          onClick={handleSaveBlogYtScriptToLibrary}
                          disabled={saveBlogYtScriptMutation.isPending || blogYtScriptSaved}
                        >
                          {saveBlogYtScriptMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : blogYtScriptSaved ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <BookMarked className="h-3 w-3 mr-1" />
                          )}
                          {blogYtScriptSaved ? "Saved!" : "Save to Library"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                          onClick={handleGenerateBlogYtScript}
                          disabled={generatingBlogYtScript}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Regenerate
                        </Button>
                        {videoPipelineLaunched ? (
                          <span className="flex items-center gap-1 text-xs text-green-400 px-2">
                            <CheckCircle2 className="h-3 w-3" />
                            Queued!
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-purple-400 hover:text-purple-300"
                            onClick={() => {
                              if (savedItemIds["blog"]) {
                                setShowVideoPipelineModal(true);
                              } else {
                                handlePushToVideoPipeline();
                              }
                            }}
                            disabled={startVideoJobMutation.isPending}
                          >
                            {startVideoJobMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Clapperboard className="h-3 w-3 mr-1" />
                            )}
                            Push to Video
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Video Pipeline Modal */}
                  {showVideoPipelineModal && (
                    <div className="mt-3 p-4 rounded-lg bg-purple-950/30 border border-purple-700/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-purple-300 flex items-center gap-2">
                          <Clapperboard className="h-4 w-4" />
                          Push to Video Pipeline
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowVideoPipelineModal(false)}
                        >
                          ×
                        </Button>
                      </div>
                      {/* Production Path */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Production Path</p>
                        <div className="flex flex-col gap-1.5">
                          {([
                            { value: "heygen_then_descript", label: "HeyGen → Descript", desc: "Avatar video + Descript edit" },
                            { value: "heygen_only", label: "HeyGen Only", desc: "Avatar video, skip Descript" },
                            { value: "descript_only", label: "Descript Only", desc: "Voice clone, skip HeyGen" },
                          ] as const).map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="videoPipelinePath"
                                value={opt.value}
                                checked={videoPipelinePath === opt.value}
                                onChange={() => setVideoPipelinePath(opt.value)}
                                className="accent-purple-500"
                              />
                              <span className="text-xs text-foreground">{opt.label}</span>
                              <span className="text-xs text-muted-foreground">— {opt.desc}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* Output Channels */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Output Channels</p>
                        <div className="flex flex-wrap gap-2">
                          {(["youtube", "tiktok", "meta", "instagram", "x"] as const).map((ch) => (
                            <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={videoPipelineChannels.includes(ch)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setVideoPipelineChannels((prev) => [...prev, ch]);
                                  } else {
                                    setVideoPipelineChannels((prev) => prev.filter((c) => c !== ch));
                                  }
                                }}
                                className="accent-purple-500"
                              />
                              <span className="text-xs text-foreground capitalize">{ch === "x" ? "X / Twitter" : ch}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* Launch */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
                          onClick={handlePushToVideoPipeline}
                          disabled={startVideoJobMutation.isPending || videoPipelineChannels.length === 0}
                        >
                          {startVideoJobMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Clapperboard className="h-3.5 w-3.5" />
                          )}
                          Launch →
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          onClick={() => setShowVideoPipelineModal(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {!blogYtScript && !generatingBlogYtScript && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Turn this blog post into a full teleprompter-ready YouTube script — adapted from the article content, with B-roll cues and a CTA.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleGenerateBlogYtScript}
                        disabled={generatingBlogYtScript}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5"
                      >
                        <Youtube className="h-3.5 w-3.5" />
                        Generate YouTube Script
                      </Button>
                    </div>
                  )}
                  {generatingBlogYtScript && (
                    <div className="flex items-center justify-center py-8 gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                      <span className="text-sm text-muted-foreground">Writing your YouTube script from the blog post… about 30 seconds.</span>
                    </div>
                  )}
                  {blogYtScript && !generatingBlogYtScript && (
                    <div className="bg-black/20 rounded-lg p-4 border border-red-900/30">
                      <p className="text-xs text-red-400/70 mb-3 font-medium uppercase tracking-wider">Teleprompter Script — YouTube Ready</p>
                      <div className="text-sm text-foreground leading-loose whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto">
                        {blogYtScript}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reframe Post Output */}
        {platform === "reframe" && reframeSlides && reframeSlides.length > 0 && (
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-violet-400" />
                  <CardTitle className="text-base font-semibold text-foreground">Reframe Post — {reframeSlides.length}-Slide Carousel</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400">LePera Format</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {reframeIsRendering && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Rendering images...
                    </span>
                  )}
                  {reframeRenderedUrls.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-violet-500/40 text-violet-400 hover:bg-violet-400/10"
                      onClick={async () => {
                        try {
                          const JSZip = (await import("jszip")).default;
                          const zip = new JSZip();
                          const folder = zip.folder("reframe-slides")!;
                          const total = reframeRenderedUrls.length;
                          for (let i = 0; i < total; i++) {
                            const dataUrl = reframeRenderedUrls[i];
                            const base64 = dataUrl.split(",")[1];
                            // Reverse numbering: slide 1 → highest number, last slide → 01
                            // Facebook reads files alphabetically, so 01 appears first in the carousel
                            const fileNum = String(total - i).padStart(2, "0");
                            folder.file(`slide-${fileNum}.png`, base64, { base64: true });
                          }
                          // Add caption as text file
                          if (reframeCaption) {
                            folder.file("caption.txt", reframeCaption);
                          }
                          const blob = await zip.generateAsync({ type: "blob" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `reframe-${idea.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success(`Downloaded ${reframeRenderedUrls.length} slide images as ZIP!`);
                        } catch (err) {
                          toast.error("ZIP download failed");
                        }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download ZIP
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const text = reframeSlides!.map((s) => `SLIDE ${s.number}:\n${s.text}`).join("\n\n") + (reframeCaption ? `\n\nCAPTION:\n${reframeCaption}` : "");
                      navigator.clipboard.writeText(text);
                      toast.success("Copied all slides to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Rendered Image Previews */}
              {reframeRenderedUrls.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-violet-400">Slide Images (1080×1080 PNG — ready for Facebook/Instagram)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {reframeRenderedUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Slide ${idx + 1}`}
                          className="w-full aspect-square object-contain rounded-lg border border-border"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `reframe-slide-${String(idx + 1).padStart(2, "0")}.png`;
                              a.click();
                            }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                        <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/50 rounded px-1">
                          {idx + 1}/{reframeRenderedUrls.length}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-violet-400/5 border border-violet-500/20 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-violet-400">How to upload to Facebook/Instagram:</p>
                    <p>1. Click <strong>Download ZIP</strong> above — you get all {reframeRenderedUrls.length} slides as 1080×1080 PNG files + caption.txt</p>
                    <p>2. In Facebook Creator Studio or Meta Business Suite: <strong>Create Post → Photo/Video → select all PNG files</strong> (they upload as a carousel)</p>
                    <p>3. Paste the caption from caption.txt into the post body</p>
                    <p>4. Schedule or publish</p>
                  </div>
                </div>
              )}

              {/* Text fallback / slide text */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-muted-foreground">Slide Text</span>
                {reframeSlides.map((slide, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-violet-400 bg-violet-400/10 rounded px-2 py-0.5">
                          Slide {slide.number} / {reframeSlides.length}
                        </span>
                        {reframeRenderedUrls[idx] && (
                          <span className="text-[10px] text-green-400">Image ready</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(slide.text);
                          toast.success(`Slide ${slide.number} copied`);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{slide.text}</p>
                  </div>
                ))}
                {reframeCaption && (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 rounded px-2 py-0.5">CAPTION</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => { navigator.clipboard.writeText(reframeCaption); toast.success("Caption copied"); }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{reframeCaption}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Carousel Output */}
        {platform === "carousel" && carouselSlides && carouselSlides.length > 0 && (
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-fuchsia-400" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Carousel — {carouselSlides.length} Slides
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] border-fuchsia-500/40 text-fuchsia-400">
                    {carouselPlatform === "meta" ? "Meta" : "LinkedIn"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleDownloadCarouselZip}
                    disabled={carouselRenderedUrls.length === 0}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download ZIP
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const text = carouselSlides
                        .map((s) => `SLIDE ${s.slide}: ${s.headline}\n${s.body}`)
                        .join("\n\n");
                      navigator.clipboard.writeText(text);
                      toast.success("All slides copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Canvas-rendered slide preview */}
              {carouselIsRendering && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Rendering slides...</span>
                </div>
              )}
              {!carouselIsRendering && (
                <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory">
                  {carouselSlides.map((slide, idx) => (
                    <div
                      key={slide.slide}
                      className="shrink-0 w-56 snap-start rounded-xl border border-border bg-muted/20 overflow-hidden"
                    >
                      {/* Canvas-rendered slide image */}
                      <div className="relative w-full aspect-square overflow-hidden bg-[#0f1117]">
                        {carouselRenderedUrls[idx] ? (
                          <img
                            src={carouselRenderedUrls[idx]}
                            alt={slide.headline}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-2xl font-bold text-amber-400/40">{slide.slide}</span>
                          </div>
                        )}
                      </div>
                      {/* Slide copy below */}
                      <div className="p-3 space-y-1.5">
                        <p className="text-xs font-bold text-foreground leading-tight">{slide.headline}</p>
                        {slide.body && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{slide.body}</p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-full px-2 text-[10px] text-muted-foreground justify-start"
                          onClick={() => {
                            navigator.clipboard.writeText(`${slide.headline}\n\n${slide.body}`);
                            toast.success(`Slide ${slide.slide} copied`);
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy text
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Branded slide templates · 1080×1080 · Auto-saved to Command Center
              </p>

              {/* Export for Meta instructions */}
              {carouselRenderedUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/8 border border-blue-500/20">
                    <Download className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-blue-300">Ready to post on Meta</p>
                      <p className="text-xs text-muted-foreground">
                        Download the ZIP above — it contains all {carouselRenderedUrls.length} slides as 1080×1080 PNG files.
                        In Meta Business Suite or Instagram, create a new post, select all images, and post as a carousel.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Nano Banana Manual Image Generator */}
        {Object.keys(generatedContent).length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Custom Visual Generator
                </CardTitle>
                <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                  Manual Override
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Generate a custom image with full control over the prompt and style. Use this to override the auto-generated visuals above.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Platform Style Selector */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Visual Style — Platform
                </Label>
                <div className="grid grid-cols-5 gap-2">
                  {(["all", "linkedin", "meta", "x", "youtube"] as Platform[]).map((p) => {
                    const info = PLATFORM_STYLE_LABELS[p];
                    const platformMeta = PLATFORMS.find((pl) => pl.key === p);
                    const isActive = imageStylePlatform === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setImageStylePlatform(p)}
                        className={`relative p-2.5 rounded-lg border text-left transition-all ${isActive
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-background hover:border-primary/30 hover:bg-muted/20"
                        }`}
                      >
                        <div className={`mb-1 ${platformMeta?.color ?? "text-primary"}`}>
                          {platformMeta?.icon}
                        </div>
                        <div className="text-[10px] font-semibold text-foreground leading-tight">
                          {info.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">{currentStyleInfo.label}:</span>{" "}
                      {currentStyleInfo.description}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs shrink-0 ml-2"
                      onClick={() => setShowStyleDetails(!showStyleDetails)}
                    >
                      {showStyleDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>
                  {showStyleDetails && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <Textarea
                        value={styleOverride}
                        onChange={(e) => setStyleOverride(e.target.value)}
                        placeholder={`Override style (leave blank to use the ${currentStyleInfo.label} preset)...`}
                        rows={2}
                        className="bg-background border-border resize-none text-xs text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Image Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Image Prompt
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleGenerateImagePrompt(outputPlatforms[0] ?? imageStylePlatform)}
                    disabled={generateImagePromptMutation.isPending}
                  >
                    {generateImagePromptMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Wand2 className="h-3 w-3 mr-1" />
                    )}
                    Auto-generate for {imageStylePlatform === "all" ? "Urban Monk" : imageStylePlatform.toUpperCase()}
                  </Button>
                </div>
                <Textarea
                  placeholder="Describe the image you want, or click Auto-generate above..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={3}
                  className="bg-background border-border resize-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <Button
                onClick={handleGenerateImage}
                disabled={generateImageMutation.isPending || !imagePrompt.trim()}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
              >
                {generateImageMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating image (10–20 seconds)...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4 mr-2" />
                    Generate Custom Image
                  </>
                )}
              </Button>

              {generatedImageUrl && (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img
                      src={generatedImageUrl}
                      alt="Generated visual"
                      className="w-full"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-black/70 text-foreground border-0 text-xs">
                        {currentStyleInfo.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(generatedImageUrl, "_blank")}
                    >
                      Open Full Size
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopy(generatedImageUrl)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy URL
                    </Button>
                  </div>
                  {Object.keys(savedItemIds).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Save content to a card above to attach this image to it.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Buffer Syndication Panel */}
        {Object.keys(generatedContent).length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Buffer Syndication
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Link
                    href="/default-channels"
                    className="text-[11px] text-amber-600 hover:text-amber-700 underline-offset-2 hover:underline"
                  >
                    Edit defaults
                  </Link>
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                    One-Click Publish
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasBufferToken ? (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                  <p className="font-medium mb-1">Buffer Access Token Required</p>
                  <p className="text-xs text-amber-400/80">
                    Add your <code className="bg-black/30 px-1 rounded">BUFFER_ACCESS_TOKEN</code> in the project Secrets settings to enable one-click syndication.
                  </p>
                </div>
              ) : !hasProfiles ? (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 space-y-3">
                  <p className="font-medium">No Buffer profiles found</p>
                  <p className="text-xs text-amber-400/80">
                    This usually means one of the following:
                  </p>
                  <ul className="text-xs text-amber-400/80 space-y-1 list-disc list-inside">
                    <li>The <code className="bg-black/30 px-1 rounded">BUFFER_ACCESS_TOKEN</code> is expired or invalid</li>
                    <li>The token belongs to a Buffer account with no connected social profiles</li>
                    <li>The token was generated for a different Buffer account</li>
                  </ul>
                  <p className="text-xs text-amber-400/80">
                    To get a valid token: go to <strong>buffer.com/developers/apps</strong>, open your app, and copy the <strong>Access Token</strong> shown there. Then update it in <strong>Settings → Secrets</strong>.
                  </p>
                  <BufferDiagnostic />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                        Buffer Channels — {platform === "all" ? "All" : PLATFORM_LABELS[platform] ?? platform}
                      </Label>
                      {platform !== "all" && (
                        <span className="text-[10px] text-muted-foreground">
                          Showing only {PLATFORM_LABELS[platform] ?? platform} channels
                        </span>
                      )}
                    </div>
                    {!hasFilteredProfiles && platform !== "blog" ? (
                      <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground">
                        No {PLATFORM_LABELS[platform] ?? platform} channels connected in Buffer.
                        {" "}<button onClick={() => {}} className="text-primary underline">Switch to All Platforms</button> to see all channels.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredProfiles.map((profile: { id: string; service: string; name: string; platform: string }) => {
                          const platformMeta = PLATFORMS.find((p) => p.key === profile.platform);
                          const isChecked = selectedProfileIds.includes(profile.id);
                          return (
                            <div
                              key={profile.id}
                              className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/20 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedProfileIds((prev) =>
                                  isChecked
                                    ? prev.filter((id) => id !== profile.id)
                                    : [...prev, profile.id]
                                );
                              }}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  setSelectedProfileIds((prev) =>
                                    checked
                                      ? [...prev, profile.id]
                                      : prev.filter((id) => id !== profile.id)
                                  );
                                }}
                              />
                              <span className={platformMeta?.color ?? "text-muted-foreground"}>{platformMeta?.icon}</span>
                              <span className="text-sm text-foreground">{profile.name}</span>
                              <Badge variant="outline" className="ml-auto text-[10px]">
                                {profile.service}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Meta Format Selector — required by Buffer API for facebook/instagram */}
                  {(platform === "meta" || platform === "all") && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                        Meta Format
                      </Label>
                      <Select value={metaPostType} onValueChange={(v) => setMetaPostType(v as "post" | "story")}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="post">📸 Image Post — feed post with image &amp; copy</SelectItem>
                          <SelectItem value="story">⏱ Story — 24-hour disappearing post</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Pushes your <strong>image and copy</strong> to Buffer for Facebook &amp; Instagram.
                        For a <strong>carousel</strong>, select Image Post — then add multiple images inside Buffer before publishing.
                      </p>
                      <p className="text-[10px] text-amber-500/80 leading-relaxed mt-1">
                        🎬 <strong>Reels &amp; video</strong> must be uploaded manually — export from Descript and upload directly in Meta.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                      Push to Buffer
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {outputPlatforms.map((p) => {
                        const savedId = savedItemIds[p];
                        const platformMeta = PLATFORMS.find((pl) => pl.key === p);
                        const result = syndicationResults[p];
                        return (
                          <Button
                            key={p}
                            variant="outline"
                            size="sm"
                            className={`h-9 text-xs justify-start gap-2 ${
                              result?.success ? "border-green-500/40 text-green-400" : ""
                            }`}
                            onClick={() => handleSyndicate(p)}
                            disabled={
                              !savedId ||
                              !selectedProfileIds.length ||
                              syndicatingPlatform === p ||
                              syndicationMutation.isPending
                            }
                          >
                            {syndicatingPlatform === p ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : result?.success ? (
                              <CheckCircle2 className="h-3 w-3 text-green-400" />
                            ) : (
                              <span className={platformMeta?.color}>{platformMeta?.icon}</span>
                            )}
                            {result?.success ? "Pushed" : `Push ${PLATFORM_LABELS[p] || p}`}
                            {!savedId && (
                              <span className="ml-auto text-muted-foreground text-[10px]">save first</span>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    {!selectedProfileIds.length && (
                      <p className="text-xs text-muted-foreground">Select at least one Buffer profile above to enable pushing.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
