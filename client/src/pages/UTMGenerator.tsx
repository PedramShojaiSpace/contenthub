import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Trash2, Link2, Zap, Download, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// ─── UTM TAXONOMY ─────────────────────────────────────────────────────────────
// Source: Urban Monk tracking architecture (April 2026)
// GA4 Property: G-CXZK2Q275S | Meta Pixel: 1498608757116877

const SOURCES = [
  { value: "meta", label: "Meta (Facebook/Instagram Paid)" },
  { value: "instagram", label: "Instagram Organic" },
  { value: "facebook", label: "Facebook Organic" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter-x", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" },
  { value: "podcast", label: "Podcast" },
  { value: "blog", label: "Blog / Article" },
  { value: "email", label: "Email (Internal List)" },
  { value: "newsletter", label: "Newsletter" },
];

const MEDIUMS: Record<string, string> = {
  meta: "paid-social",
  instagram: "organic-social",
  facebook: "organic-social",
  youtube: "video",
  linkedin: "organic-social",
  "twitter-x": "organic-social",
  tiktok: "organic-social",
  podcast: "audio",
  blog: "organic-content",
  email: "email",
  newsletter: "email",
};

const CAMPAIGNS = [
  { value: "ic-free-screening", label: "IC Free Screening (Opt-in)" },
  { value: "ic-path-a", label: "IC Funnel — Path A (Original)" },
  { value: "ic-path-b", label: "IC Funnel — Path B (New Segmented)" },
  { value: "upstream-webinar", label: "Upstream Webinar" },
  { value: "upstream-course", label: "Upstream Health Course ($299)" },
  { value: "upstream-bundle", label: "Upstream + KBMO FIT22 Bundle ($399)" },
  { value: "lights-on", label: "Lights On Course" },
  { value: "gut-quiz", label: "Gut Health Quiz" },
  { value: "dysbiosis-dominant", label: "Segment: Dysbiosis Dominant" },
  { value: "inflammatory-cascade", label: "Segment: Inflammatory Cascade" },
  { value: "sensitivity-spectrum", label: "Segment: Sensitivity Spectrum" },
  { value: "barrier-breakdown", label: "Segment: Barrier Breakdown" },
  { value: "brand-awareness", label: "Brand Awareness" },
  { value: "retargeting", label: "Retargeting" },
];

const DESTINATIONS = [
  {
    value: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
    label: "IC Free Screening Landing Page (Kajabi)",
  },
  {
    value: "https://upstream.theurbanmonk.com",
    label: "Upstream Evergreen Webinar",
  },
  {
    value: "https://get.theurbanmonk.com",
    label: "Get — Bundle Offer Page ($399)",
  },
  {
    value: "https://lightson.theurbanmonk.com",
    label: "Lights On Course Page",
  },
  {
    value: "https://www.theurbanmonk.com",
    label: "Urban Monk Homepage (WordPress)",
  },
  { value: "custom", label: "Custom URL..." },
];

const CONTENT_PRESETS: Record<string, string[]> = {
  meta: ["video-ad", "carousel-ad", "static-image", "story-ad", "reel-ad"],
  instagram: ["reel", "story", "feed-post", "bio-link"],
  facebook: ["post", "story", "group-post", "live"],
  youtube: ["video-description", "end-screen", "pinned-comment", "community-post"],
  linkedin: ["post", "article", "newsletter"],
  "twitter-x": ["tweet", "thread", "bio-link"],
  tiktok: ["video", "bio-link"],
  podcast: ["episode-description", "show-notes", "ad-read"],
  blog: ["inline-cta", "end-of-post", "sidebar", "popup"],
  email: ["sequence-email", "broadcast", "welcome-email"],
  newsletter: ["weekly-digest", "promo-blast"],
};

// Keyword-reply UTM path presets for Video Production sessions
const VIDEO_KEYWORD_PRESETS = [
  {
    label: "TikTok Keyword → IC Opt-in",
    src: "tiktok",
    med: "organic-social",
    cmp: "ic-free-screening",
    cnt: "keyword-reply",
    dest: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
    termHint: "e.g. ENERGY, SLEEP, GUT",
  },
  {
    label: "IG Reel Keyword → IC Opt-in",
    src: "instagram",
    med: "organic-social",
    cmp: "ic-free-screening",
    cnt: "keyword-reply",
    dest: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
    termHint: "e.g. ENERGY, SLEEP, GUT",
  },
  {
    label: "YouTube Keyword → Upstream Webinar",
    src: "youtube",
    med: "video",
    cmp: "upstream-webinar",
    cnt: "keyword-reply",
    dest: "https://upstream.theurbanmonk.com",
    termHint: "e.g. HEALTH, STRESS, FOCUS",
  },
  {
    label: "LinkedIn Keyword → Upstream Course",
    src: "linkedin",
    med: "organic-social",
    cmp: "upstream-course",
    cnt: "keyword-reply",
    dest: "https://get.theurbanmonk.com",
    termHint: "e.g. UPSTREAM, COURSE, HEALTH",
  },
];

const QUICK_PRESETS = [
  {
    label: "IG Reel → IC Opt-in",
    src: "instagram",
    med: "organic-social",
    cmp: "ic-free-screening",
    cnt: "reel",
    dest: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
  },
  {
    label: "Meta Ad → IC Path B",
    src: "meta",
    med: "paid-social",
    cmp: "ic-path-b",
    cnt: "video-ad",
    dest: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
  },
  {
    label: "YouTube → Upstream Webinar",
    src: "youtube",
    med: "video",
    cmp: "upstream-webinar",
    cnt: "video-description",
    dest: "https://upstream.theurbanmonk.com",
  },
  {
    label: "Email → Upstream Course",
    src: "email",
    med: "email",
    cmp: "upstream-course",
    cnt: "sequence-email",
    dest: "https://get.theurbanmonk.com",
  },
  {
    label: "Blog → IC Opt-in",
    src: "blog",
    med: "organic-content",
    cmp: "ic-free-screening",
    cnt: "inline-cta",
    dest: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
  },
  {
    label: "Podcast → Upstream Bundle",
    src: "podcast",
    med: "audio",
    cmp: "upstream-bundle",
    cnt: "episode-description",
    dest: "https://get.theurbanmonk.com",
  },
];

function buildUTM(params: {
  destination: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
}): string {
  const base = params.destination.replace(/\/$/, "");
  const p = new URLSearchParams();
  if (params.source) p.set("utm_source", params.source);
  if (params.medium) p.set("utm_medium", params.medium);
  if (params.campaign) p.set("utm_campaign", params.campaign);
  if (params.content) p.set("utm_content", params.content);
  if (params.term) p.set("utm_term", params.term);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function UTMGenerator() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("organic-social");
  const [campaign, setCampaign] = useState("ic-free-screening");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [destination, setDestination] = useState(DESTINATIONS[0].value);
  const [customUrl, setCustomUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: history = [] } = trpc.utm.list.useQuery();
  const saveMutation = trpc.utm.save.useMutation({
    onSuccess: () => utils.utm.list.invalidate(),
  });
  const deleteMutation = trpc.utm.delete.useMutation({
    onSuccess: () => utils.utm.list.invalidate(),
  });

  const finalDestination = destination === "custom" ? customUrl : destination;

  const generatedUrl = buildUTM({
    destination: finalDestination,
    source,
    medium,
    campaign,
    content,
    term,
  });

  const handleSourceChange = (val: string) => {
    setSource(val);
    setMedium(MEDIUMS[val] || "");
    setContent("");
  };

  const handleCopy = useCallback(() => {
    if (!finalDestination) {
      toast.error("Please enter a destination URL");
      return;
    }
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      const campaignLabel = CAMPAIGNS.find((c) => c.value === campaign)?.label || campaign;
      const label = `${source} → ${campaignLabel}`;
      // Save to DB
      saveMutation.mutate({
        url: generatedUrl,
        label,
        source,
        medium,
        campaign,
        content: content || undefined,
        term: term || undefined,
        destination: finalDestination,
      });
      toast.success("Copied and saved to history");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [generatedUrl, source, medium, campaign, content, term, finalDestination]);

  const applyPreset = (p: typeof QUICK_PRESETS[0]) => {
    handleSourceChange(p.src);
    setCampaign(p.cmp);
    setContent(p.cnt);
    setDestination(p.dest);
  };

  const applyVideoPreset = (p: typeof VIDEO_KEYWORD_PRESETS[0]) => {
    handleSourceChange(p.src);
    setCampaign(p.cmp);
    setContent(p.cnt);
    setDestination(p.dest);
    // Don't auto-fill term — user must enter their keyword
    setTerm("");
  };

  const contentOptions = CONTENT_PRESETS[source] || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-5 w-5 text-primary" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Hub
            </Button>
            <h1 className="text-2xl font-serif font-bold text-foreground">UTM Builder</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            All links are pre-configured for GA4 property{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">G-CXZK2Q275S</code>{" "}
            and Meta Pixel{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">1498608757116877</code>.
            Links are saved to your persistent history.
          </p>
        </div>

        {/* Video Keyword Reply Presets */}
        <Card className="bg-sky-950/30 border-sky-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sky-300 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
              Video Keyword-Reply Paths
              <span className="text-xs font-normal text-sky-400/70 ml-1">— select a path, then enter your CTA keyword in the Term field</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VIDEO_KEYWORD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyVideoPreset(p)}
                  className="text-left text-xs border border-sky-500/30 rounded-md px-3 py-2.5 hover:bg-sky-900/40 hover:border-sky-400/50 transition-colors leading-tight bg-sky-950/20"
                >
                  <span className="text-sky-200 font-medium block">{p.label}</span>
                  <span className="text-sky-400/60 mt-0.5 block">{p.termHint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-sky-400/50 mt-3">
              After selecting a path, enter your CTA keyword (e.g. <code className="bg-sky-900/40 px-1 rounded font-mono">ENERGY</code>) in the <strong className="text-sky-300/70">Term</strong> field below. The keyword becomes <code className="bg-sky-900/40 px-1 rounded font-mono">utm_term</code> so you can track which keyword drove each conversion in GA4.
            </p>
          </CardContent>
        </Card>

        {/* Quick Presets */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Quick Presets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="text-left text-xs border border-border rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors leading-tight bg-background"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Builder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT — Inputs */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Configure Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Destination */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Destination Page</Label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  {DESTINATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {destination === "custom" && (
                  <Input
                    type="url"
                    placeholder="https://..."
                    className="bg-background border-border text-sm"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                  />
                )}
              </div>

              {/* Source */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Traffic Source</Label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  value={source}
                  onChange={(e) => handleSourceChange(e.target.value)}
                >
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medium — auto-filled but editable */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Medium{" "}
                  <span className="text-xs font-normal text-muted-foreground/60">(auto-filled)</span>
                </Label>
                <Input
                  className="bg-background border-border text-sm"
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                />
              </div>

              {/* Campaign */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Campaign</Label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                >
                  {CAMPAIGNS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Content{" "}
                  <span className="text-xs font-normal text-muted-foreground/60">(ad format / post type)</span>
                </Label>
                {contentOptions.length > 0 && (
                  <select
                    className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  >
                    <option value="">— select or type below —</option>
                    {contentOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                <Input
                  placeholder="e.g. reel-gut-quiz, ad-set-name"
                  className="bg-background border-border text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              {/* Term */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Term{" "}
                  <span className="text-xs font-normal text-muted-foreground/60">(optional — keyword or audience)</span>
                </Label>
                <Input
                  placeholder="e.g. gut-health, cold-audience-45-65"
                  className="bg-background border-border text-sm"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* RIGHT — Output */}
          <div className="space-y-4">
            {/* Generated URL */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">Generated UTM Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  readOnly
                  rows={5}
                  className="bg-muted text-sm font-mono resize-none border-border"
                  value={generatedUrl}
                />
                <Button
                  onClick={handleCopy}
                  disabled={!finalDestination}
                  className={`w-full font-semibold transition-colors ${
                    copied
                      ? "bg-green-600 hover:bg-green-600 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied & Saved
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* UTM Breakdown */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  UTM Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: "utm_source", val: source },
                  { key: "utm_medium", val: medium },
                  { key: "utm_campaign", val: campaign },
                  { key: "utm_content", val: content },
                  { key: "utm_term", val: term },
                ].map(({ key, val }) => (
                  <div key={key} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-muted-foreground w-32 shrink-0">{key}</span>
                    <span className={`font-medium ${val ? "text-foreground" : "text-muted-foreground italic"}`}>
                      {val || "not set"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Persistent History */}
        {history.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">
                  Saved History
                  <Badge variant="outline" className="ml-2 text-xs">
                    {history.length}
                  </Badge>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    const headers = ["Label", "URL", "Source", "Medium", "Campaign", "Content", "Term", "Destination", "Created At"];
                    const rows = history.map((h) => [
                      `"${(h.label ?? "").replace(/"/g, '""')}"`,
                      `"${(h.url ?? "").replace(/"/g, '""')}"`,
                      `"${(h.source ?? "").replace(/"/g, '""')}"`,
                      `"${(h.medium ?? "").replace(/"/g, '""')}"`,
                      `"${(h.campaign ?? "").replace(/"/g, '""')}"`,
                      `"${(h.content ?? "").replace(/"/g, '""')}"`,
                      `"${(h.term ?? "").replace(/"/g, '""')}"`,
                      `"${(h.destination ?? "").replace(/"/g, '""')}"`,
                      `"${new Date(h.createdAt).toLocaleString()}"`,
                    ]);
                    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `utm-links-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("CSV downloaded");
                  }}
                >
                  <Download className="h-3 w-3" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-4 text-xs p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{h.label}</p>
                      <p className="text-muted-foreground font-mono truncate mt-0.5">{h.url}</p>
                      <p className="text-muted-foreground/60 mt-0.5">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(h.url);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => deleteMutation.mutate({ id: h.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
