import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  QrCode, Download, ExternalLink, Copy, CheckCircle2, Loader2, Globe,
  Video, Sparkles, Send, ChevronDown, ChevronUp, Clock, FileText
} from "lucide-react";

// Known merchandise QR destinations
const PRESETS = [
  {
    label: "Web of Life T-Shirt",
    slug: "weboflife",
    url: "https://ch.theurbanmonk.com/weboflife",
    status: "live" as const,
    description: "Microbiome / Web of Life design — live at ch.theurbanmonk.com/weboflife",
  },
];

const PRODUCTION_PATHS = [
  {
    value: "heygen_only" as const,
    label: "HeyGen Only",
    description: "Avatar video render — ready in ~10–20 min. No B-roll editing.",
  },
  {
    value: "descript_only" as const,
    label: "Descript Only",
    description: "AI voice (Pedram's voice model) + auto B-roll via Underlord.",
  },
  {
    value: "heygen_then_descript" as const,
    label: "HeyGen → Descript",
    description: "Avatar render first, then Descript adds B-roll automatically. Best quality.",
  },
];

export default function QrGenerator() {
  const [customUrl, setCustomUrl] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Video script state
  const [selectedPresetSlug, setSelectedPresetSlug] = useState<string | null>(null);
  const [videoTheme, setVideoTheme] = useState("");
  const [generatedScript, setGeneratedScript] = useState<{
    scriptText: string;
    scriptTitle: string;
    wordCount: number;
    estimatedDurationSeconds: number;
    landingPageUrl: string;
    designLabel: string;
  } | null>(null);
  const [editedScript, setEditedScript] = useState("");
  const [productionPath, setProductionPath] = useState<"heygen_only" | "descript_only" | "heygen_then_descript">("heygen_then_descript");
  const [scriptExpanded, setScriptExpanded] = useState(true);
  const [videoJobSent, setVideoJobSent] = useState(false);

  const generateQrMutation = trpc.qrGenerator.generate.useMutation({
    onSuccess: (data: { downloadUrl: string; filename: string; url: string; label: string; size: number; generatedAt: string }) => {
      setGenerating(null);
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success(`QR code downloaded: ${data.filename}`);
      }
    },
    onError: (err: { message?: string }) => {
      setGenerating(null);
      toast.error(err.message || "Failed to generate QR code");
    },
  });

  const generateScriptMutation = trpc.qrGenerator.generateVideoScript.useMutation({
    onSuccess: (data) => {
      setGeneratedScript(data);
      setEditedScript(data.scriptText);
      setScriptExpanded(true);
      setVideoJobSent(false);
      toast.success("2-minute script generated");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Script generation failed");
    },
  });

  const startVideoJobMutation = trpc.videoPipeline.startVideoJob.useMutation({
    onSuccess: (data: { message?: string }) => {
      setVideoJobSent(true);
      toast.success(data.message || "Video job started — check Video Pipeline for status");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to start video job");
    },
  });

  const handleGenerate = (url: string, label: string) => {
    setGenerating(url);
    generateQrMutation.mutate({ url, label });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast.success("URL copied to clipboard");
  };

  const handleGenerateScript = () => {
    if (!videoTheme.trim()) { toast.error("Enter a theme or message first"); return; }
    const preset = selectedPresetSlug
      ? PRESETS.find(p => p.slug === selectedPresetSlug)
      : PRESETS[0];
    if (!preset) { toast.error("Select a design first"); return; }
    generateScriptMutation.mutate({
      theme: videoTheme,
      designLabel: preset.label,
      landingPageUrl: preset.url,
      durationSeconds: 120,
    });
  };

  const handleSendToProduction = () => {
    if (!generatedScript) return;
    startVideoJobMutation.mutate({
      contentItemId: 0, // standalone QR video — not tied to a content item
      scriptTitle: generatedScript.scriptTitle,
      scriptText: editedScript || generatedScript.scriptText,
      topic: generatedScript.designLabel,
      ctaUrl: generatedScript.landingPageUrl,
      ctaLabel: "Explore →",
      ctaText: "Visit the landing page",
      productionPath,
      outputChannels: ["youtube"],
    });
  };

  const selectedPreset = selectedPresetSlug
    ? PRESETS.find(p => p.slug === selectedPresetSlug)
    : PRESETS[0];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">QR Generator</h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Generate branded Urban Monk QR codes for merchandise, create a 2-minute video script for the landing page, and send it straight to HeyGen or Descript for production.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-muted/40 border border-border rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">Full pipeline</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Download the QR code PNG — print-ready at 300 DPI (2400×2400px)</li>
            <li>Write a theme below → AI generates a 2-minute video script in Dr. Pedram's voice</li>
            <li>Review and edit the script, then send to HeyGen or Descript</li>
            <li>Once the video is ready, paste its URL into the landing page to embed it at the top</li>
          </ol>
        </div>

        {/* Merchandise Designs */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Merchandise Designs</h2>
          <div className="space-y-3">
            {PRESETS.map((preset) => (
              <div
                key={preset.slug}
                className={`border rounded-lg p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  selectedPresetSlug === preset.slug || (!selectedPresetSlug && preset.slug === PRESETS[0].slug)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/20"
                }`}
                onClick={() => setSelectedPresetSlug(preset.slug)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{preset.label}</span>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{preset.description}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate max-w-xs">
                      {preset.url}
                    </code>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyUrl(preset.url); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedUrl === preset.url
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>
                    <a
                      href={preset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleGenerate(preset.url, preset.label); }}
                  disabled={generating === preset.url}
                  className="shrink-0"
                >
                  {generating === preset.url ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                  ) : (
                    <><Download className="w-3.5 h-3.5 mr-1.5" />Download QR</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Video Script Generator */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-5 py-4 flex items-center gap-3 border-b border-border">
            <Video className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Video Script Generator</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dictate the theme → AI writes a 2-minute script → send to production
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Selected design indicator */}
            {selectedPreset && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                <QrCode className="w-3.5 h-3.5" />
                <span>Script will be for: <strong className="text-foreground">{selectedPreset.label}</strong></span>
                <span className="text-muted-foreground/60">→</span>
                <code className="font-mono">{selectedPreset.url}</code>
              </div>
            )}

            {/* Theme input */}
            <div>
              <Label htmlFor="video-theme" className="text-xs mb-1.5 block font-medium">
                Theme / Message
              </Label>
              <Textarea
                id="video-theme"
                placeholder="Describe what this video should convey. e.g. 'The microbiome is the missing link in modern health. Ancient healers knew the gut was the second brain. This shirt is a reminder that you are a community, not an individual — and the quality of your inner ecosystem determines everything.'"
                value={videoTheme}
                onChange={(e) => setVideoTheme(e.target.value)}
                className="text-sm min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Be as specific or as loose as you want. The AI will write in Dr. Pedram's voice.
              </p>
            </div>

            <Button
              onClick={handleGenerateScript}
              disabled={!videoTheme.trim() || generateScriptMutation.isPending}
              className="w-full"
            >
              {generateScriptMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating script…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate 2-Minute Script</>
              )}
            </Button>

            {/* Generated script */}
            {generatedScript && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setScriptExpanded(!scriptExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{generatedScript.scriptTitle}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ~{Math.round(generatedScript.estimatedDurationSeconds / 60)}:{String(generatedScript.estimatedDurationSeconds % 60).padStart(2, "0")} min
                        </span>
                        <span className="text-xs text-muted-foreground">{generatedScript.wordCount} words</span>
                      </div>
                    </div>
                  </div>
                  {scriptExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>

                {scriptExpanded && (
                  <div className="p-4 space-y-4">
                    <Textarea
                      value={editedScript}
                      onChange={(e) => setEditedScript(e.target.value)}
                      className="text-sm font-mono min-h-[280px] resize-y leading-relaxed"
                      placeholder="Script will appear here…"
                    />
                    <p className="text-xs text-muted-foreground">
                      Edit freely — this is the exact text that will be spoken. The CTA URL at the bottom will be used as the video's call-to-action link.
                    </p>

                    {/* Production pathway */}
                    <div>
                      <Label className="text-xs mb-2 block font-medium">Production Pathway</Label>
                      <div className="space-y-2">
                        {PRODUCTION_PATHS.map((p) => (
                          <label
                            key={p.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              productionPath === p.value
                                ? "border-primary/40 bg-primary/5"
                                : "border-border hover:border-primary/20"
                            }`}
                          >
                            <input
                              type="radio"
                              name="productionPath"
                              value={p.value}
                              checked={productionPath === p.value}
                              onChange={() => setProductionPath(p.value)}
                              className="mt-0.5 accent-primary"
                            />
                            <div>
                              <p className="text-sm font-medium">{p.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {videoJobSent ? (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Video job sent to production. Check <a href="/video-pipeline" className="underline font-medium">Video Pipeline</a> for status. Once the video is ready, paste its URL into the landing page to embed it at the top.</span>
                      </div>
                    ) : (
                      <Button
                        onClick={handleSendToProduction}
                        disabled={startVideoJobMutation.isPending || !editedScript.trim()}
                        className="w-full"
                        variant="default"
                      >
                        {startVideoJobMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending to production…</>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" />Send to Production</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Custom QR */}
        <div className="border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Generate Custom QR</h2>
          <p className="text-xs text-muted-foreground mb-4">
            For a new design, first create the landing page in <strong>CH Landing Pages</strong>, then generate its QR here.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="custom-url" className="text-xs mb-1.5 block">Landing Page URL</Label>
              <Input
                id="custom-url"
                placeholder="https://ch.theurbanmonk.com/your-design-slug"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="custom-label" className="text-xs mb-1.5 block">Design Name (for filename)</Label>
              <Input
                id="custom-label"
                placeholder="e.g. Interconnected Series"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              onClick={() => {
                if (!customUrl) { toast.error("Enter a URL first"); return; }
                handleGenerate(customUrl, customLabel || "custom");
              }}
              disabled={!customUrl || generating === customUrl}
              className="w-full"
            >
              {generating === customUrl ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
              ) : (
                <><QrCode className="w-4 h-4 mr-2" />Generate &amp; Download QR</>
              )}
            </Button>
          </div>
        </div>

        {/* Landing page link */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          <span>Landing pages are managed in </span>
          <a href="/ch-pages" className="text-primary hover:underline font-medium">CH Landing Pages →</a>
        </div>
      </div>
    </DashboardLayout>
  );
}
