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
  Facebook,
  Image,
  Linkedin,
  Loader2,
  Music2,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Twitter,
  Wand2,
  Youtube,
} from "lucide-react";
import { useState, useEffect } from "react";
import { FlaskConical, Globe, Target } from "lucide-react";
import { toast } from "sonner";

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

type Platform = "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "all";

// Per-platform generated output: text + auto-generated image
type PlatformOutput = {
  text: string;
  imageUrl?: string;
};

const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "all", label: "All Platforms", icon: <Sparkles className="h-4 w-4" />, color: "text-primary" },
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-4 w-4" />, color: "text-sky-400" },
  { key: "meta", label: "Meta", icon: <Facebook className="h-4 w-4" />, color: "text-blue-400" },
  { key: "x", label: "X (Twitter)", icon: <Twitter className="h-4 w-4" />, color: "text-slate-300" },
  { key: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4" />, color: "text-red-400" },
  { key: "tiktok", label: "TikTok", icon: <Music2 className="h-4 w-4" />, color: "text-pink-400" },
  { key: "blog", label: "Blog Post", icon: <BookOpen className="h-4 w-4" />, color: "text-emerald-400" },
];

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  meta: "Meta (Instagram/Facebook)",
  x: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  blog: "Blog Post (theurbanmonk.com)",
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
  const [syndicationResults, setSyndicationResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  const utils = trpc.useUtils();

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
        const titleText = idea.slice(0, 80) + (idea.length > 80 ? "..." : "");
        autoSaveMutation.mutate(
          {
            title: titleText,
            rawIdea: idea,
            platform: p as Platform,
            status: "drafting",
            textContent: v.text,
            gapQueryId: activeGapQueryId ?? undefined,
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
      platform,
      customInstructions: customInstructions || undefined,
      generateImages: true,
    });
  };

  const handleRegenerateImage = (p: string) => {
    const text = editedText[p] || generatedContent[p]?.text;
    if (!text) return;
    setRegeneratingImageFor(p);
    // Use the idea + platform style directly for regeneration
    regenerateImageMutation.mutate({
      prompt: text.slice(0, 300),
      platform: p as Platform,
    });
  };

  const handleGenerateImagePrompt = (p: string) => {
    const text = editedText[p] || generatedContent[p]?.text;
    if (!text) {
      toast.error("Generate content first.");
      return;
    }
    generateImagePromptMutation.mutate({ textContent: text, platform: imageStylePlatform });
  };

  const handleGenerateImage = () => {
    if (!imagePrompt.trim()) {
      toast.error("Generate or enter an image prompt first.");
      return;
    }
    generateImageMutation.mutate({
      prompt: imagePrompt,
      platform: imageStylePlatform,
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
      platform: p as Platform,
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

    setSyndicatingPlatform(p);
    syndicationMutation.mutate({
      contentItemId: itemId,
      text,
      profileIds: selectedProfileIds,
      imageUrl: generatedContent[p]?.imageUrl || generatedImageUrl || undefined,
    });
  };

  // Direct push to Buffer — saves card first if not already saved, then syndicates
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
              platform: p as Platform,
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

    // Use all available Buffer profiles for this platform
    const profileIds = (bufferProfiles ?? []).map((pr: { id: string }) => pr.id);
    if (!profileIds.length) {
      setSyndicatingPlatform(null);
      toast.error("No Buffer profiles available.");
      return;
    }

    syndicationMutation.mutate({
      contentItemId: itemId ?? 0,
      text,
      profileIds,
      imageUrl: generatedContent[p]?.imageUrl || generatedImageUrl || undefined,
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
    body: string;
    imageUrl?: string;
  } | null>(null);
  const [isBlogGenerating, setIsBlogGenerating] = useState(false);

  const generateBlogMutation = trpc.ai.generateBlog.useMutation({
    onSuccess: (data) => {
      setBlogContent({
        title: data.title,
        slug: data.slug,
        metaDescription: data.metaDescription,
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
          platform: "blog" as Platform,
          status: "drafting",
          textContent: data.article,
          gapQueryId: activeGapQueryId ?? undefined,
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
      platform: "blog" as Platform,
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
                These are queries where Urban Monk is not appearing in LLM answers. Click any to use as your content starting point.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(topGaps as Array<{ id: number; query: string; personaName: string | null; gapScore: number | null; topicTags: string | null }>).map((gap) => {
                const tags = (() => { try { return JSON.parse(gap.topicTags ?? "[]") as string[]; } catch { return []; } })();
                return (
                  <button
                    key={gap.id}
                    onClick={() => {
                      setIdea(`Answer this LLM search query for the persona "${gap.personaName ?? "Wellness Seeker"}": ${gap.query}`);
                      setActiveGapQueryId(gap.id);
                      setActiveGapQueryText(gap.query);
                      toast.success("Gap query loaded as idea!");
                    }}
                    className="w-full text-left p-3 rounded-lg bg-card/60 border border-border hover:border-amber-700/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-foreground/80 text-sm group-hover:text-foreground transition-colors">{gap.query}</p>
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
                      <Target className="w-4 h-4 text-amber-500/50 group-hover:text-amber-400 shrink-0 mt-0.5 transition-colors" />
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

            <Button
              onClick={platform === "blog" ? handleGenerateBlog : handleGenerate}
              disabled={(platform === "blog" ? isBlogGenerating : isGenerating) || !idea.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
            >
              {(platform === "blog" ? isBlogGenerating : isGenerating) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {platform === "blog" ? "Writing blog post + featured image (30–60 seconds)..." : platform === "tiktok" ? "Writing TikTok script + vertical visual (20–40 seconds)..." : "Generating content + images (20–40 seconds)..."}
                </>
              ) : (
                <>
                  {platform === "blog" ? <BookOpen className="h-4 w-4 mr-2" /> : platform === "tiktok" ? <Music2 className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {platform === "blog" ? "Generate Blog Post" : platform === "tiktok" ? "Generate TikTok Script + Visual" : "Generate Content + Images"}
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
                        className="bg-background border-border resize-none text-sm text-foreground font-mono leading-relaxed"
                      />

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
            <CardContent className="p-5 space-y-5">
              {/* Featured Image */}
              {blogContent.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={blogContent.imageUrl}
                    alt={blogContent.title}
                    className="w-full object-cover max-h-72"
                  />
                </div>
              )}

              {/* SEO Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Title</p>
                  <p className="text-base font-semibold text-foreground leading-snug">{blogContent.title}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">URL Slug</p>
                  <p className="text-sm font-mono text-amber-400">/{blogContent.slug}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Meta Description</p>
                <p className="text-sm text-muted-foreground leading-relaxed border border-border rounded-md px-3 py-2 bg-background">{blogContent.metaDescription}</p>
              </div>

              {/* Full Article Body */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Article Body</p>
                <Textarea
                  value={blogContent.body}
                  onChange={(e) => setBlogContent(prev => prev ? { ...prev, body: e.target.value } : null)}
                  rows={28}
                  className="bg-background border-border resize-y text-sm text-foreground font-mono leading-relaxed"
                />
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
