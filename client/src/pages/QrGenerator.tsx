import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { QrCode, Download, ExternalLink, Copy, CheckCircle2, Loader2, Globe } from "lucide-react";

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

export default function QrGenerator() {
  const [customUrl, setCustomUrl] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const generateQrMutation = trpc.qrGenerator.generate.useMutation({
    onSuccess: (data: { downloadUrl: string; filename: string; url: string; label: string; size: number; generatedAt: string }) => {
      setGenerating(null);
      if (data.downloadUrl) {
        // Trigger download
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">QR Generator</h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Generate branded Urban Monk QR codes for merchandise. Each QR embeds the Urban Monk icon at center and is print-ready at 300 DPI (2400×2400px). The QR destination is a landing page in the Content Hub.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-muted/40 border border-border rounded-lg p-4 mb-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How it works</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click <strong>Generate &amp; Download</strong> on any design below</li>
            <li>A 2400×2400px PNG downloads — ready for Printful or any print-on-demand service</li>
            <li>The QR points to the landing page in this Content Hub — edit the page copy anytime without regenerating the QR</li>
          </ol>
        </div>

        {/* Existing Designs */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Merchandise Designs</h2>
          <div className="space-y-3">
            {PRESETS.map((preset) => (
              <div
                key={preset.slug}
                className="border border-border rounded-lg p-4 flex items-start justify-between gap-4"
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
                      onClick={() => copyUrl(preset.url)}
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
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleGenerate(preset.url, preset.label)}
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
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          <span>Landing pages are managed in </span>
          <a href="/ch-pages" className="text-primary hover:underline font-medium">CH Landing Pages →</a>
        </div>
      </div>
    </DashboardLayout>
  );
}
