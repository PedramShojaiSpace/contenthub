import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Copy,
  Facebook,
  Image,
  Linkedin,
  Loader2,
  Save,
  Sparkles,
  Twitter,
  Youtube,
  Wand2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Platform = "meta" | "linkedin" | "x" | "youtube" | "all";

const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "all", label: "All Platforms", icon: <Sparkles className="h-4 w-4" />, color: "text-primary" },
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-4 w-4" />, color: "text-sky-400" },
  { key: "meta", label: "Meta", icon: <Facebook className="h-4 w-4" />, color: "text-blue-400" },
  { key: "x", label: "X (Twitter)", icon: <Twitter className="h-4 w-4" />, color: "text-slate-300" },
  { key: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4" />, color: "text-red-400" },
];

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  meta: "Meta (Instagram/Facebook)",
  x: "X (Twitter)",
  youtube: "YouTube",
};

// Platform-specific style descriptions shown in the UI
const PLATFORM_STYLE_LABELS: Record<string, { label: string; description: string; palette: string }> = {
  linkedin: {
    label: "Corporate Wellness",
    description: "Minimalist editorial — deep navy, gold accents, authority & expertise",
    palette: "from-navy-900 to-slate-800",
  },
  meta: {
    label: "Lifestyle & Aspiration",
    description: "Warm, earthy, authentic — deep greens, terracotta, natural light",
    palette: "from-emerald-900 to-amber-900",
  },
  x: {
    label: "Bold & Cinematic",
    description: "High-contrast, typographic — stark black, single dramatic light source",
    palette: "from-slate-900 to-zinc-800",
  },
  youtube: {
    label: "Epic Documentary",
    description: "Chiaroscuro thumbnail — rich shadows, prestige film still quality",
    palette: "from-red-950 to-slate-900",
  },
  all: {
    label: "Urban Monk Signature",
    description: "Dark, moody, cinematic — deep blacks, warm gold, timeless editorial",
    palette: "from-stone-900 to-yellow-950",
  },
};

export default function CreationStudio() {
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [imageStylePlatform, setImageStylePlatform] = useState<Platform>("all");
  const [showStyleDetails, setShowStyleDetails] = useState(false);
  const [styleOverride, setStyleOverride] = useState("");

  const generateContentMutation = trpc.ai.generateContent.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data);
      setEditedContent(data);
      // Auto-set image style platform to match content platform
      if (platform !== "all") setImageStylePlatform(platform);
      toast.success("Content generated for all platforms!");
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

  const createContentMutation = trpc.content.create.useMutation({
    onSuccess: () => {
      toast.success("Saved to Command Center!");
      setSavingPlatform(null);
    },
    onError: (err) => {
      toast.error("Save failed: " + err.message);
      setSavingPlatform(null);
    },
  });

  const handleGenerate = () => {
    if (!idea.trim()) {
      toast.error("Please enter an idea first.");
      return;
    }
    generateContentMutation.mutate({ idea, platform, customInstructions: customInstructions || undefined });
  };

  const handleGenerateImagePrompt = (p: string) => {
    const text = editedContent[p] || generatedContent[p];
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
    const text = editedContent[p] || generatedContent[p];
    if (!text) return;
    setSavingPlatform(p);
    createContentMutation.mutate({
      title: idea.slice(0, 80) + (idea.length > 80 ? "..." : ""),
      rawIdea: idea,
      platform: p as Platform,
      status: "drafting",
      textContent: text,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const outputPlatforms =
    platform === "all"
      ? (["linkedin", "meta", "x", "youtube"] as const)
      : [platform];

  const currentStyleInfo = PLATFORM_STYLE_LABELS[imageStylePlatform] ?? PLATFORM_STYLE_LABELS.all;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Creation Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drop an idea. Generate voice-matched content and on-brand visuals for every platform.
          </p>
        </div>

        {/* Input Panel */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-foreground">Your Idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Raw Idea / Topic
              </Label>
              <Textarea
                placeholder="Drop a raw thought, a link to an article, or paste a voice memo transcript... e.g. 'Let's talk about how mouthwash destroys the gut microbiome'"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                className="bg-background border-border resize-none text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Target Platform
                </Label>
                <Select value={platform} onValueChange={(v) => {
                  setPlatform(v as Platform);
                  if (v !== "all") setImageStylePlatform(v as Platform);
                }}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        <div className="flex items-center gap-2">
                          <span className={p.color}>{p.icon}</span>
                          <span>{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Custom Instructions (optional)
                </Label>
                <Textarea
                  placeholder="Any specific angle, tone, or format notes..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={1}
                  className="bg-background border-border resize-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateContentMutation.isPending || !idea.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
            >
              {generateContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating content...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Content Panels */}
        {Object.keys(editedContent).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-semibold text-foreground">Generated Content</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {outputPlatforms.map((p) => {
                const platformInfo = PLATFORMS.find((pl) => pl.key === p);
                return (
                  <Card key={p} className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={platformInfo?.color}>{platformInfo?.icon}</span>
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {PLATFORM_LABELS[p] || p}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(editedContent[p] || "")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSave(p)}
                            disabled={savingPlatform === p || createContentMutation.isPending}
                          >
                            {savingPlatform === p ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Textarea
                        value={editedContent[p] || ""}
                        onChange={(e) =>
                          setEditedContent((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                        rows={10}
                        className="bg-background border-border resize-none text-sm text-foreground font-mono leading-relaxed"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Nano Banana Image Generation */}
        {Object.keys(editedContent).length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Nano Banana Visual Generator
                </CardTitle>
                <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                  AI Image
                </Badge>
              </div>
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
                        className={`relative p-2.5 rounded-lg border text-left transition-all
                          ${isActive
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

                {/* Style description */}
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
                    onClick={() => handleGenerateImagePrompt(outputPlatforms[0])}
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
                  placeholder="Describe the image you want, or click Auto-generate above to let the AI craft a platform-optimized prompt..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={3}
                  className="bg-background border-border resize-none text-foreground placeholder:text-muted-foreground/50"
                />
                <p className="text-xs text-muted-foreground">
                  The <span className="text-primary font-medium">{currentStyleInfo.label}</span> brand style will be automatically applied to the generation.
                </p>
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
                    Generate with Nano Banana
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
                      <Badge className="bg-black/70 text-white border-0 text-xs">
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
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Syndication Placeholder */}
        {Object.keys(editedContent).length > 0 && (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="p-6 text-center">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
                Coming Soon
              </Badge>
              <h3 className="font-serif font-semibold text-foreground mb-1">
                One-Click Syndication
              </h3>
              <p className="text-sm text-muted-foreground">
                Buffer and Duvo API integration for direct publishing will be available soon.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
