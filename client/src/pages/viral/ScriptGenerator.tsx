import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileText, Copy, Clock, ChevronDown, ChevronUp, Loader2, Hash, Search, Zap, Kanban, CheckCircle2 } from "lucide-react";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok (60s)" },
  { value: "instagram", label: "Instagram Reels (60s)" },
  { value: "youtube", label: "YouTube Shorts (60s)" },
  { value: "linkedin", label: "LinkedIn Video (90s)" },
];

const LENGTHS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "60 seconds" },
  { value: 90, label: "90 seconds" },
  { value: 120, label: "2 minutes" },
];

interface ScriptResult {
  id: number;
  topic: string;
  hook: string;
  platform: string;
  targetLengthSeconds: number | null;
  fullScript: string;
  script: {
    hook: string;
    problem: string;
    agitate: string;
    value: string;
    proof: string;
    cta: string;
  };
  captionHook: string | null;
  seoKeywords: string[];
  hashtags: string[];
  wordCount: number | null;
  estimatedSeconds: number | null;
  createdAt: Date | string;
}

function ScriptDisplay({ result, onCopy }: { result: ScriptResult; onCopy: (text: string) => void }) {
  const [showStructure, setShowStructure] = useState(false);
  const [savedToKanban, setSavedToKanban] = useState(false);

  // Map viral studio platforms to content_items platform enum
  const PLATFORM_MAP: Record<string, string> = {
    tiktok: "tiktok",
    instagram: "meta",
    youtube: "youtube",
    linkedin: "linkedin",
    x: "x",
  };
  const kanbanPlatform = PLATFORM_MAP[result.platform] ?? "meta";

  const saveToKanbanMutation = trpc.content.createBulk.useMutation({
    onSuccess: () => {
      setSavedToKanban(true);
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Script saved to Command Center ✓</span>
          <span className="text-xs text-muted-foreground">Find it in the Drafting column of your Kanban board.</span>
        </div>
      );
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const handleSaveToKanban = () => {
    if (savedToKanban) return;
    saveToKanbanMutation.mutate({
      items: [
        {
          title: (result.topic ?? "").length > 80 ? (result.topic ?? "").slice(0, 80) + "…" : (result.topic ?? "Untitled Script"),
          platform: kanbanPlatform as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel",
          status: "drafting" as const,
          textContent: result.fullScript,
          rawIdea: result.hook,
        },
      ],
    });
  };

  const sections = result.script ? [
    { label: "Hook (0–3s)", key: "hook", color: "border-l-red-400" },
    { label: "Problem", key: "problem", color: "border-l-orange-400" },
    { label: "Agitate", key: "agitate", color: "border-l-amber-400" },
    { label: "Value", key: "value", color: "border-l-green-400" },
    { label: "Proof", key: "proof", color: "border-l-blue-400" },
    { label: "CTA", key: "cta", color: "border-l-violet-400" },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{result.platform}</Badge>
        {result.estimatedSeconds && (
          <Badge variant="outline" className="text-xs">~{result.estimatedSeconds}s</Badge>
        )}
        {result.wordCount && (
          <Badge variant="outline" className="text-xs">{result.wordCount} words</Badge>
        )}
      </div>

      {/* Full Script */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Script</h4>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onCopy(result.fullScript)}>
            <Copy className="w-3 h-3 mr-1" />Copy Script
          </Button>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground">
          {result.fullScript}
        </div>
      </div>

      {/* Structure Toggle */}
      {sections.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowStructure(!showStructure)}
          >
            {showStructure ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showStructure ? "Hide" : "Show"} HPAVPC Structure
          </button>
          {showStructure && (
            <div className="mt-3 space-y-2">
              {sections.map((s) => (
                <div key={s.key} className={`border-l-2 ${s.color} pl-3 py-1`}>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">{s.label}</p>
                  <p className="text-sm text-foreground">{result.script[s.key as keyof typeof result.script]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      {result.captionHook && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-blue-700">Caption Hook</p>
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-blue-600" onClick={() => onCopy(result.captionHook!)}>
              <Copy className="w-3 h-3 mr-1" />Copy
            </Button>
          </div>
          <p className="text-sm text-foreground">{result.captionHook}</p>
        </div>
      )}

      {/* SEO Keywords */}
      {result.seoKeywords?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Social SEO Keywords</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.seoKeywords.map((kw, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Hashtags */}
      {result.hashtags?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hashtags</p>
            </div>
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => onCopy(result.hashtags.join(" "))}>
              <Copy className="w-3 h-3 mr-1" />Copy All
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.hashtags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs text-blue-600 border-blue-200 cursor-pointer" onClick={() => onCopy(tag)}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Save to Command Center */}
      <div className="pt-2 border-t border-border">
        <Button
          onClick={handleSaveToKanban}
          disabled={savedToKanban || saveToKanbanMutation.isPending}
          className={`w-full ${
            savedToKanban
              ? "bg-green-600 hover:bg-green-600 text-white cursor-default"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {saveToKanbanMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving to Command Center...</>
          ) : savedToKanban ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" />Saved to Command Center ✓</>
          ) : (
            <><Kanban className="w-4 h-4 mr-2" />Save script to Command Center</>
          )}
        </Button>
        {!savedToKanban && (
          <p className="text-[11px] text-muted-foreground text-center mt-1.5">
            Creates a Drafting card in your Kanban board with the full script as content.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ScriptGenerator() {
  // Pre-fill from URL params when navigated from Hook Generator
  const urlParams = new URLSearchParams(window.location.search);
  const prefillHook = urlParams.get("hook") ?? "";
  const prefillPlatform = urlParams.get("platform") ?? "";
  const prefillTopic = urlParams.get("topic") ?? "";

  const [topic, setTopic] = useState(prefillTopic);
  const [hook, setHook] = useState(prefillHook);
  const [platform, setPlatform] = useState(prefillPlatform || "tiktok");
  const [lengthSeconds, setLengthSeconds] = useState(60);
  const [cta, setCta] = useState("Comment 'MONK' below and I'll send you the full guide");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [persona, setPersona] = useState("");
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [prefillBanner, setPrefillBanner] = useState(!!prefillHook);

  // Clear URL params after reading them so refreshing doesn't re-fill
  useEffect(() => {
    if (prefillHook || prefillPlatform || prefillTopic) {
      const url = new URL(window.location.href);
      url.searchParams.delete("hook");
      url.searchParams.delete("platform");
      url.searchParams.delete("topic");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const generateMutation = trpc.viralStudio.generateScript.useMutation({
    onSuccess: (data) => {
      setResult(data as unknown as ScriptResult);
      toast.success("Script generated!");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const historyQuery = trpc.viralStudio.getRecentScripts.useQuery({ limit: 10 });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Enter a topic first"); return; }
    if (!hook.trim()) { toast.error("Enter a hook first (use Hook Generator above)"); return; }
    generateMutation.mutate({
      topic: topic.trim(),
      hook: hook.trim(),
      platform: platform as "tiktok",
      targetLengthSeconds: lengthSeconds,
      cta: cta || undefined,
      socialSeoKeywords: seoKeywords ? seoKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      targetPersona: persona || undefined,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Pre-fill banner from Hook Generator */}
      {prefillBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-violet-700">
            <Zap className="w-4 h-4 shrink-0" />
            <span>Hook pre-filled from Hook Generator. Review the fields below and click Generate Script.</span>
          </div>
          <button className="text-xs text-violet-500 hover:text-violet-700 shrink-0" onClick={() => setPrefillBanner(false)}>✕</button>
        </div>
      )}

      {/* Explainer */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-1">HPAVPC Script Framework</h3>
        <p className="text-sm text-blue-700">
          Every script follows the <strong>Hook → Problem → Agitate → Value → Proof → CTA</strong> structure — the same framework used by top creators to maximize watch time and drive DM conversions. Social SEO keywords are woven into the spoken audio naturally so the algorithm surfaces your content to the right audience.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Script Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Topic *</Label>
              <Textarea
                placeholder="e.g. 'How your gut microbiome controls your mood and energy'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Opening Hook * <span className="text-muted-foreground font-normal">(use Hook Generator)</span></Label>
              <Textarea
                placeholder="Paste your best hook here..."
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Length</Label>
                <Select value={String(lengthSeconds)} onValueChange={(v) => setLengthSeconds(Number(v))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTHS.map((l) => (
                      <SelectItem key={l.value} value={String(l.value)}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">DM Trigger CTA</Label>
              <Input
                placeholder="Comment 'MONK' below and I'll send you the guide"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Social SEO Keywords <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
              <Input
                placeholder="gut health, microbiome, brain fog, energy, mood"
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Persona (optional)</Label>
              <Input
                placeholder="e.g. 'Stressed professional, 40s, low energy'"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="text-sm"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !topic.trim() || !hook.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Writing script...</>
              ) : (
                <><FileText className="w-4 h-4 mr-2" />Generate Full Script</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <div>
          {result ? (
            <ScriptDisplay result={result} onCopy={handleCopy} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
              <FileText className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Fill in the settings and click Generate to get a full HPAVPC script</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {historyQuery.data && historyQuery.data.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Recent Scripts</h3>
            </div>
            <div className="space-y-2">
              {historyQuery.data.map((r) => {
                const [open, setOpen] = useState(false);
                return (
                  <div key={r.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setOpen(!open)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="text-xs shrink-0">{r.platform}</Badge>
                        <span className="text-sm font-medium truncate">{r.topic}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 border-t border-border">
                        <div className="mt-3">
                          <ScriptDisplay result={r as unknown as ScriptResult} onCopy={handleCopy} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
