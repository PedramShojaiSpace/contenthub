import DashboardLayout from "@/components/DashboardLayout";
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
} from "lucide-react";
import { useState, useEffect } from "react";
import { FlaskConical, Globe, Target, Swords, ArrowRight } from "lucide-react";
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

type Platform = "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "reframe" | "all";

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
];

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  meta: "Meta (Instagram/Facebook)",
  x: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  blog: "Blog Post (theurbanmonk.com)",
  reframe: "Reframe Post (Carousel)",
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
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null);
  const [selectedContentGoal, setSelectedContentGoal] = useState<"audience_growth" | "llm_seo" | "community_engagement" | null>(null);

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

  const utils = trpc.useUtils();

  // Personas for selector
  const { data: personas = [] } = trpc.personas.list.useQuery();
  const { data: enrichmentSummary = [] } = trpc.personas.getEnrichmentSummary.useQuery();
  const enrichmentMap = Object.fromEntries(
    (enrichmentSummary as Array<{ id: number; painCount: number; isEnriched: boolean }>).map((e) => [e.id, e])
  );

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

  // Pick up a brief pre-loaded from the Research Intelligence page
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
  }, []);

  // Buffer profiles
  const { data: bufferProfiles } = trpc.syndication.getProfiles.useQuery(undefined, {
    retry: false,
  });

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
      generateImages: true,
      personaId: selectedPersonaId ?? undefined,
      gapQueryText: activeGapQueryText ?? undefined,
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
    const profileIds = (bufferProfiles ?? [])
      .filter((pr: { id: string; service: string }) => allowedServices.includes(pr.service))
      .map((pr: { id: string }) => pr.id);
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
    body: string;
    imageUrl?: string;
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
  const generateReframeMutation = trpc.ai.generateReframePost.useMutation({
    onSuccess: (data: { slides: Array<{ number: number; text: string }>; caption: string; ctaLabel: string }) => {
      setReframeSlides(data.slides);
      setReframeCaption(data.caption ?? "");
      toast.success("Reframe Post generated!");
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
      });
      setIsBlogGenerating(false);
      toast.success("Blog post generated — auto-saving to archive...");

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
        },
        {
          onSuccess: (saved) => {
            if (saved?.id) {
              setSavedItemIds((prev) => ({ ...prev, blog: saved.id }));
              if (data.heroImageUrl) {
                autoUpdateMutation.mutate({ id: saved.id, imageUrl: data.heroImageUrl });
              }
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
    });
  };

  // WordPress publish state
  const [isPublishingToWP, setIsPublishingToWP] = useState(false);
  const [wpPublishResult, setWpPublishResult] = useState<{ postUrl: string; editUrl: string } | null>(null);

  const [wpPublishStatus, setWpPublishStatus] = useState<"draft" | "publish">("draft");

  const publishToWPMutation = trpc.blog.publish.useMutation({
    onSuccess: (data) => {
      setIsPublishingToWP(false);
      setWpPublishResult({ postUrl: data.postUrl, editUrl: data.editUrl });
      toast.success(
        wpPublishStatus === "publish"
          ? "Published to WordPress!"
          : "Saved as draft in WordPress!"
      );
      utils.content.list.invalidate();
    },
    onError: (err) => {
      setIsPublishingToWP(false);
      toast.error("WordPress publish failed: " + err.message);
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
    setWpPublishStatus(status);
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

            <Button
              onClick={platform === "blog" ? handleGenerateBlog : platform === "reframe" ? () => generateReframeMutation.mutate({ topic: idea, commonBelief: commonBelief || undefined }) : handleGenerate}
              disabled={(platform === "blog" ? isBlogGenerating : platform === "reframe" ? generateReframeMutation.isPending : isGenerating) || !idea.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
            >
              {(platform === "blog" ? isBlogGenerating : platform === "reframe" ? generateReframeMutation.isPending : isGenerating) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {platform === "blog" ? "Writing blog post + featured image (30–60 seconds)..." : platform === "reframe" ? "Generating Reframe carousel (10–20 seconds)..." : platform === "tiktok" ? "Writing TikTok script + vertical visual (20–40 seconds)..." : "Generating content + images (20–40 seconds)..."}
                </>
              ) : (
                <>
                  {platform === "blog" ? <BookOpen className="h-4 w-4 mr-2" /> : platform === "reframe" ? <LayoutGrid className="h-4 w-4 mr-2" /> : platform === "tiktok" ? <Music2 className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {platform === "blog" ? "Generate Blog Post" : platform === "reframe" ? "Generate Reframe Post" : platform === "tiktok" ? "Generate TikTok Script + Visual" : "Generate Content + Images"}
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

              {/* Step 5: Differentiation Brief */}
              {ytBrief && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Differentiation Brief</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(ytBrief);
                          toast.success("Brief copied!");
                        }}
                        className="text-xs h-7 border-border"
                      >
                        <Copy className="h-3 w-3 mr-1" />Copy
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleYTInformScript}
                        className="text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Wand2 className="h-3 w-3 mr-1" />Inform Script
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleYTSaveToScript}
                        disabled={ytSaveToScriptMutation.isPending || ytSavedToScript}
                        className="text-xs h-7 border-green-500/40 text-green-400 hover:bg-green-500/10"
                      >
                        {ytSaveToScriptMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : ytSavedToScript ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        {ytSavedToScript ? "Saved!" : "Save to Script Library"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{ytBrief}</pre>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click <strong>Inform Script</strong> to inject the differentiation brief into Custom Instructions — then hit Generate Content.
                  </p>
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
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Publish to theurbanmonk.com</p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    const text = reframeSlides.map((s) => `SLIDE ${s.number}:\n${s.text}`).join("\n\n") + (reframeCaption ? `\n\nCAPTION:\n${reframeCaption}` : "");
                    navigator.clipboard.writeText(text);
                    toast.success("Copied all slides to clipboard");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {reframeSlides.map((slide, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-400 bg-violet-400/10 rounded px-2 py-0.5">
                        Slide {slide.number} / {reframeSlides.length}
                      </span>
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
                <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                  One-Click Publish
                </Badge>
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
