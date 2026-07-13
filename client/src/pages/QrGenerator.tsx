import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  QrCode, Download, ExternalLink, Copy, CheckCircle2, Loader2, Globe,
  Video, Sparkles, Send, ChevronDown, ChevronUp, Clock, FileText, Link2, Plus
} from "lucide-react";

// Static preset designs (always shown)
const STATIC_PRESETS = [
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

// Derive a slug from a label string
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

type DbDesign = {
  id: number;
  slug: string;
  label: string;
  landingPageUrl: string;
  videoUrl: string | null;
  videoJobId: number | null;
  scriptText: string | null;
  scriptTitle: string | null;
  theme: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function QrGenerator() {
  const [customUrl, setCustomUrl] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Which design slug is selected for the video script workflow
  const [selectedSlug, setSelectedSlug] = useState<string>(STATIC_PRESETS[0].slug);

  // Video script state
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
  const [sentJobId, setSentJobId] = useState<number | null>(null);

  // Assign video URL state
  const [assignVideoUrl, setAssignVideoUrl] = useState("");
  const [videoAssigned, setVideoAssigned] = useState(false);

  // Load all DB designs so custom ones appear in the list
  const { data: dbDesigns = [], refetch: refetchDesigns } = trpc.qrGenerator.listDesigns.useQuery();

  // Merge static presets with DB designs (DB wins on slug collision)
  const allDesigns = useMemo(() => {
    const dbSlugs = new Set((dbDesigns as DbDesign[]).map((d) => d.slug));
    const staticOnly = STATIC_PRESETS.filter((p) => !dbSlugs.has(p.slug));
    const dbMapped = (dbDesigns as DbDesign[]).map((d) => ({
      label: d.label,
      slug: d.slug,
      url: d.landingPageUrl,
      status: "live" as const,
      description: d.landingPageUrl,
      fromDb: true,
    }));
    const staticMapped = staticOnly.map((p) => ({ ...p, fromDb: false }));
    return [...staticMapped, ...dbMapped];
  }, [dbDesigns]);

  // The currently selected design object
  const selectedDesign = allDesigns.find((d) => d.slug === selectedSlug) ?? allDesigns[0];

  // ── Mutations ──────────────────────────────────────────────────────────────

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

  // FIX: New mutation to register a custom QR as a design record in the DB
  const createDesignMutation = trpc.qrGenerator.createDesign.useMutation({
    onSuccess: (data) => {
      refetchDesigns();
      setSelectedSlug(data.slug);
      toast.success(
        data.created
          ? `Design "${data.slug}" saved — you can now generate a video script for it below.`
          : `Design "${data.slug}" updated.`
      );
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to save design record");
    },
  });

  const generateScriptMutation = trpc.qrGenerator.generateVideoScript.useMutation({
    onSuccess: (data) => {
      setGeneratedScript(data);
      setEditedScript(data.scriptText);
      setScriptExpanded(true);
      setVideoJobSent(false);
      setSentJobId(null);
      toast.success("2-minute script generated");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Script generation failed");
    },
  });

  const sendToProductionMutation = trpc.qrGenerator.sendToProduction.useMutation({
    onSuccess: (data) => {
      setVideoJobSent(true);
      setSentJobId(data.jobId);
      toast.success(`Video job #${data.jobId} sent to production via ${data.productionPath.replace(/_/g, " ")}`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to send to production");
    },
  });

  const assignVideoMutation = trpc.qrGenerator.assignVideo.useMutation({
    onSuccess: () => {
      setVideoAssigned(true);
      toast.success("Video URL assigned — it will now appear on the landing page");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to assign video URL");
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerate = (url: string, label: string) => {
    setGenerating(url);
    generateQrMutation.mutate({ url, label });
  };

  const handleGenerateCustom = () => {
    if (!customUrl) { toast.error("Enter a URL first"); return; }
    const label = customLabel || "custom";
    const slug = slugify(label) || "custom-qr";

    // Step 1: Generate the QR PNG
    handleGenerate(customUrl, label);

    // Step 2 (FIX): Register the design in the DB so the full workflow is available
    createDesignMutation.mutate({
      slug,
      label,
      landingPageUrl: customUrl,
    });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast.success("URL copied to clipboard");
  };

  const handleGenerateScript = () => {
    if (!videoTheme.trim()) { toast.error("Enter a theme or message first"); return; }
    if (!selectedDesign) { toast.error("Select a design first"); return; }
    generateScriptMutation.mutate({
      theme: videoTheme,
      designLabel: selectedDesign.label,
      landingPageUrl: selectedDesign.url,
      durationSeconds: 120,
    });
  };

  const handleSendToProduction = () => {
    if (!generatedScript || !selectedDesign) return;
    sendToProductionMutation.mutate({
      slug: selectedDesign.slug,
      designLabel: generatedScript.designLabel,
      landingPageUrl: generatedScript.landingPageUrl,
      scriptText: editedScript || generatedScript.scriptText,
      scriptTitle: generatedScript.scriptTitle,
      theme: videoTheme,
      productionPath,
    });
  };

  const handleAssignVideo = () => {
    if (!assignVideoUrl.trim()) { toast.error("Enter a video URL first"); return; }
    if (!selectedDesign) { toast.error("Select a design first"); return; }
    assignVideoMutation.mutate({ slug: selectedDesign.slug, videoUrl: assignVideoUrl });
  };

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
            <li>Once the video is ready, paste its URL below — it will auto-appear on the landing page</li>
          </ol>
        </div>

        {/* Merchandise Designs — now includes DB designs */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Merchandise Designs
          </h2>
          <div className="space-y-3">
            {allDesigns.map((design) => (
              <div
                key={design.slug}
                className={`border rounded-lg p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  selectedSlug === design.slug
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/20"
                }`}
                onClick={() => setSelectedSlug(design.slug)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{design.label}</span>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{design.description}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate max-w-xs">
                      {design.url}
                    </code>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyUrl(design.url); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedUrl === design.url
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>
                    <a
                      href={design.url}
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
                  onClick={(e) => { e.stopPropagation(); handleGenerate(design.url, design.label); }}
                  disabled={generating === design.url}
                  className="shrink-0"
                >
                  {generating === design.url ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                  ) : (
                    <><Download className="w-3.5 h-3.5 mr-1.5" />Download QR</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Custom QR — now also registers the design in DB */}
        <div className="border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Add New Design</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Enter the landing page URL and a design name. This will download the QR code <strong>and</strong> add the design to the list above so you can generate a video script for it.
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
              <Label htmlFor="custom-label" className="text-xs mb-1.5 block">Design Name</Label>
              <Input
                id="custom-label"
                placeholder="e.g. Interconnected Series"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="text-sm"
              />
              {customLabel && (
                <p className="text-xs text-muted-foreground mt-1">
                  Slug: <code className="font-mono bg-muted px-1 rounded">{slugify(customLabel) || "custom-qr"}</code>
                </p>
              )}
            </div>
            <Button
              onClick={handleGenerateCustom}
              disabled={!customUrl || generating === customUrl || createDesignMutation.isPending}
              className="w-full"
            >
              {generating === customUrl || createDesignMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
              ) : (
                <><QrCode className="w-4 h-4 mr-2" />Generate QR &amp; Add Design</>
              )}
            </Button>
          </div>
        </div>

        {/* Video Script Generator — now uses selectedDesign (any design, not just presets) */}
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
            {selectedDesign && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                <QrCode className="w-3.5 h-3.5" />
                <span>Script will be for: <strong className="text-foreground">{selectedDesign.label}</strong></span>
                <span className="text-muted-foreground/60">→</span>
                <code className="font-mono">{selectedDesign.url}</code>
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
                      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-green-700 space-y-1">
                          <p className="font-medium">Video job #{sentJobId} sent to production</p>
                          <p>Check <a href="/video-pipeline" className="underline font-medium">Video Pipeline</a> for status updates.</p>
                          <p className="text-xs text-green-600">Once the video is ready, paste its URL in the section below — it will automatically appear at the top of the landing page.</p>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={handleSendToProduction}
                        disabled={sendToProductionMutation.isPending || !editedScript.trim()}
                        className="w-full"
                        variant="default"
                      >
                        {sendToProductionMutation.isPending ? (
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

        {/* Assign Video URL to Landing Page — now uses selectedDesign */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-5 py-4 flex items-center gap-3 border-b border-border">
            <Link2 className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Assign Video to Landing Page</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Once your video is produced, paste the URL here — it will auto-embed at the top of the landing page
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Show which design the video will be assigned to */}
            {selectedDesign && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                <QrCode className="w-3.5 h-3.5" />
                <span>Assigning to: <strong className="text-foreground">{selectedDesign.label}</strong></span>
                <span className="text-muted-foreground/60">·</span>
                <code className="font-mono">{selectedDesign.slug}</code>
              </div>
            )}

            <div>
              <Label htmlFor="assign-video-url" className="text-xs mb-1.5 block font-medium">Video URL</Label>
              <Input
                id="assign-video-url"
                placeholder="https://cdn.heygen.com/video/..."
                value={assignVideoUrl}
                onChange={(e) => { setAssignVideoUrl(e.target.value); setVideoAssigned(false); }}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">HeyGen, Descript, YouTube, or any direct video URL</p>
            </div>

            {videoAssigned ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Video assigned to <strong>{selectedDesign?.slug}</strong>. Visit{" "}
                  <a
                    href={selectedDesign?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    {selectedDesign?.url}
                  </a>{" "}
                  to confirm the embed.
                </span>
              </div>
            ) : (
              <Button
                onClick={handleAssignVideo}
                disabled={assignVideoMutation.isPending || !assignVideoUrl.trim()}
                variant="outline"
                className="w-full"
              >
                {assignVideoMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning…</>
                ) : (
                  <><Link2 className="w-4 h-4 mr-2" />Assign Video to Landing Page</>
                )}
              </Button>
            )}
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
