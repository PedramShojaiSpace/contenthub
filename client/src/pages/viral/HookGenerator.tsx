import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Zap, Copy, Clock, Star, ChevronDown, ChevronUp, Loader2,
  FlaskConical, CheckCircle2, FileText, ImageIcon, X as XIcon,
  Pencil, Check, SendHorizonal, RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X / Twitter" },
];

const FRAMEWORK_COLORS: Record<string, string> = {
  contradiction: "bg-red-100 text-red-700 border-red-200",
  specificity: "bg-blue-100 text-blue-700 border-blue-200",
  timeframe: "bg-amber-100 text-amber-700 border-amber-200",
  pov: "bg-green-100 text-green-700 border-green-200",
  curiosity: "bg-purple-100 text-purple-700 border-purple-200",
};

interface Hook {
  framework: string;
  hook: string;
  why: string;
  score: number;
}

interface HookResult {
  id: number;
  topic: string;
  platform: string;
  hooks: Hook[];
  topPick: string | null;
  topPickReason: string | null;
  createdAt: Date | string;
}

// ─── Send to A/B Test Lab Dialog ─────────────────────────────────────────────
interface SendToABLabDialogProps {
  open: boolean;
  onClose: () => void;
  hookText: string;
  framework: string;
  topic: string;
  platform: string;
  allHooks: Hook[];
}

function SendToABLabDialog({ open, onClose, hookText, framework, topic, platform, allHooks }: SendToABLabDialogProps) {
  const [, setLocation] = useLocation();
  const [testName, setTestName] = useState(`${(topic ?? "").slice(0, 40)} — Hook Test`);
  const otherHook = allHooks.find((h) => h.hook !== hookText) ?? allHooks[0];
  const [variantB, setVariantB] = useState(otherHook?.hook ?? "");

  const createVariantMutation = trpc.viralStudio.createTestVariant.useMutation({
    onSuccess: () => {
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Sent to A/B Test Lab ✓</span>
          <button
            className="text-xs text-left underline text-violet-600"
            onClick={() => setLocation("/viral-studio?tab=ab")}
          >
            Open A/B Test Lab →
          </button>
        </div>
      );
      onClose();
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const handleSend = () => {
    createVariantMutation.mutate({
      testName: testName.trim() || `${topic.slice(0, 40)} — Hook Test`,
      topic: topic.trim(),
      platform: platform as "tiktok",
      variantType: "hook",
      variantA: hookText,
      variantB: variantB.trim() || (allHooks[0]?.hook ?? ""),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-violet-500" />
            Send to A/B Test Lab
          </DialogTitle>
          <DialogDescription>
            This hook becomes Variant A. Pick a second hook as Variant B to test against.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Test Name</Label>
            <Input
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. Gut-brain hook test — TikTok"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Variant A (this hook)</Label>
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-foreground leading-relaxed">
              {hookText}
            </div>
            <p className="text-xs text-muted-foreground">Framework: <span className="capitalize font-medium">{framework}</span></p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Variant B (comparison hook)</Label>
            <Textarea
              value={variantB}
              onChange={(e) => setVariantB(e.target.value)}
              placeholder="Paste or type a different hook to test against..."
              rows={3}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">Pre-filled with another hook from this generation. Edit freely.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createVariantMutation.isPending}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={createVariantMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {createVariantMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating test...</>
            ) : (
              <><FlaskConical className="w-4 h-4 mr-2" />Create A/B Test</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Platform → image-generator platform mapping
const HOOK_PLATFORM_TO_IMAGE_PLATFORM: Record<string, "meta" | "linkedin" | "x" | "youtube" | "tiktok"> = {
  tiktok: "tiktok",
  instagram: "meta",
  youtube: "youtube",
  linkedin: "linkedin",
  x: "x",
};

// ─── HookCard ─────────────────────────────────────────────────────────────────
function HookCard({
  hook,
  editedHook,
  topic,
  platform,
  allHooks,
  onCopy,
  onEditChange,
  topFramework,
}: {
  hook: Hook;
  editedHook: string;
  topic: string;
  platform: string;
  allHooks: Hook[];
  onCopy: (text: string) => void;
  onEditChange: (text: string) => void;
  topFramework?: string | null;
}) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(editedHook);
  const [abDialogOpen, setAbDialogOpen] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [justRegenerated, setJustRegenerated] = useState(false);
  const colorClass = FRAMEWORK_COLORS[hook.framework.toLowerCase()] ?? "bg-gray-100 text-gray-700 border-gray-200";

  const regenMutation = trpc.viralStudio.regenerateSingleHook.useMutation({
    onSuccess: (data) => {
      onEditChange(data.hook);
      setDraftText(data.hook);
      setJustRegenerated(true);
      toast.success(`${hook.framework} hook regenerated!`);
      setTimeout(() => setJustRegenerated(false), 3000);
    },
    onError: (err) => toast.error(`Regen failed: ${err.message}`),
  });

  const handleRegenerate = () => {
    const validPlatforms = ["tiktok", "instagram", "linkedin", "youtube", "x"] as const;
    type ValidPlatform = typeof validPlatforms[number];
    const safePlatform: ValidPlatform = (validPlatforms as readonly string[]).includes(platform)
      ? (platform as ValidPlatform)
      : "tiktok";
    regenMutation.mutate({ topic, platform: safePlatform, framework: hook.framework });
  };

  const imagePlatform = HOOK_PLATFORM_TO_IMAGE_PLATFORM[platform] ?? "meta";

  const generateImageMutation = trpc.ai.generateImage.useMutation({
    onSuccess: (data) => {
      if (data.url) setGeneratedImageUrl(data.url);
      toast.success("Image generated!");
    },
    onError: (err) => toast.error(`Image generation failed: ${err.message}`),
  });

  const handleGenerateImage = () => {
    const prompt = `Social media visual for the hook: "${editedHook}". Topic: ${topic}. Platform: ${platform}. The image should be striking, editorial, and complement the hook's message.`;
    generateImageMutation.mutate({ prompt, platform: imagePlatform });
  };

  const handleBuildScript = () => {
    const params = new URLSearchParams({ tab: "script", hook: editedHook, platform, topic });
    if (topFramework) params.set("framework", topFramework);
    setLocation(`/viral-studio?${params.toString()}`);
  };

  const handleSaveEdit = () => {
    onEditChange(draftText);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setDraftText(editedHook);
    setEditing(false);
  };

  const isTopFramework = topFramework && hook.framework.toLowerCase() === topFramework.toLowerCase();
  const isEdited = editedHook !== hook.hook;

  return (
    <>
      <div className={`border rounded-lg p-4 transition-colors ${isEdited ? "border-violet-400 bg-violet-50/30" : "border-border hover:border-violet-300"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className={`text-xs capitalize ${colorClass}`}>
                {hook.framework}
              </Badge>
              {isTopFramework && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                  <Star className="w-3 h-3 mr-1 fill-amber-500" />Top performing
                </Badge>
              )}
              {isEdited && (
                <Badge className="bg-violet-100 text-violet-700 border-violet-300 text-xs">
                  Edited
                </Badge>
              )}
              {justRegenerated && (
                <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />Regenerated
                </Badge>
              )}
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i < hook.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
            </div>

            {/* Hook text — editable or display */}
            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={3}
                  className="text-sm resize-none border-violet-300 focus:ring-violet-400"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSaveEdit}>
                    <Check className="w-3 h-3 mr-1" />Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground leading-relaxed">{editedHook}</p>
            )}

            {expanded && !editing && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                <span className="font-medium">Why it works: </span>{hook.why}
              </p>
            )}
          </div>

          {!editing && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                onClick={handleRegenerate}
                disabled={regenMutation.isPending}
                title="Regenerate this hook (keeps other 4)"
              >
                {regenMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-violet-600 hover:bg-violet-50"
                onClick={() => { setDraftText(editedHook); setEditing(true); }}
                title="Edit hook text"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onCopy(editedHook)}
                title="Copy hook"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-violet-500 hover:text-violet-700 hover:bg-violet-50"
                onClick={() => setAbDialogOpen(true)}
                title="Send to A/B Test Lab"
              >
                <FlaskConical className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </div>
          )}
        </div>

        {/* Action row */}
        {!editing && (
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button
              className="text-[11px] text-violet-500 hover:text-violet-700 flex items-center gap-1 transition-colors"
              onClick={() => setAbDialogOpen(true)}
            >
              <FlaskConical className="w-3 h-3" />
              A/B Test Lab
            </button>
            <span className="text-muted-foreground/30 text-[11px]">|</span>
            <button
              className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors font-medium"
              onClick={handleBuildScript}
            >
              <FileText className="w-3 h-3" />
              Build script for this hook →
            </button>
            <span className="text-muted-foreground/30 text-[11px]">|</span>
            <button
              className="text-[11px] text-emerald-500 hover:text-emerald-700 flex items-center gap-1 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGenerateImage}
              disabled={generateImageMutation.isPending}
            >
              {generateImageMutation.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
              ) : (
                <><ImageIcon className="w-3 h-3" />Generate image</>
              )}
            </button>
          </div>
        )}

        {/* Inline image preview */}
        {generatedImageUrl && (
          <div className="mt-3 relative rounded-lg overflow-hidden border border-border">
            <img src={generatedImageUrl} alt="Generated hook visual" className="w-full h-40 object-cover" />
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                className="bg-black/60 hover:bg-black/80 text-white rounded p-1 transition-colors"
                onClick={() => { navigator.clipboard.writeText(generatedImageUrl); toast.success("Image URL copied"); }}
                title="Copy image URL"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                className="bg-black/60 hover:bg-black/80 text-white rounded p-1 transition-colors"
                onClick={() => setGeneratedImageUrl(null)}
                title="Dismiss"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <p className="text-[10px] text-white/80 capitalize">{platform} style</p>
            </div>
          </div>
        )}
      </div>

      <SendToABLabDialog
        open={abDialogOpen}
        onClose={() => setAbDialogOpen(false)}
        hookText={editedHook}
        framework={hook.framework}
        topic={topic}
        platform={platform}
        allHooks={allHooks}
      />
    </>
  );
}

// ─── ResultCard (history) ─────────────────────────────────────────────────────
function ResultCard({ result, onCopy }: { result: HookResult; onCopy: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editedHooks, setEditedHooks] = useState<Record<number, string>>({});
  const [, setLocation] = useLocation();

  const getEditedHook = (i: number) =>
    editedHooks[i] !== undefined ? editedHooks[i] : (result.hooks[i]?.hook ?? "");

  const handlePushAllHistory = () => {
    const batch = result.hooks.map((h, i) => ({
      hook: getEditedHook(i),
      framework: h.framework,
    }));
    const params = new URLSearchParams({
      tab: "script",
      topic: result.topic,
      platform: result.platform,
      hookBatch: JSON.stringify(batch),
      batchTopic: result.topic,
    });
    setLocation(`/viral-studio?${params.toString()}`);
  };

  // Build score summary for collapsed header: top 3 scores
  const sortedScores = [...result.hooks]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((h) => h.score);
  const avgScore = result.hooks.length > 0
    ? Math.round(result.hooks.reduce((s, h) => s + h.score, 0) / result.hooks.length * 10) / 10
    : 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className="text-xs shrink-0">{result.platform}</Badge>
          <span className="text-sm font-medium truncate">{result.topic}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Score badges — top 3 hook scores */}
          {!open && sortedScores.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {sortedScores.map((score, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                    score >= 4 ? "bg-green-100 text-green-700 border-green-300" :
                    score === 3 ? "bg-amber-100 text-amber-700 border-amber-300" :
                    "bg-gray-100 text-gray-600 border-gray-300"
                  }`}
                >
                  <Star className="w-2.5 h-2.5" />{score}
                </span>
              ))}
              <span className="text-[10px] text-muted-foreground ml-0.5">avg {avgScore}</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">{new Date(result.createdAt).toLocaleDateString()}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {result.topPick && (
            <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
              <p className="text-xs font-semibold text-violet-700 mb-1">⭐ Top Pick</p>
              <p className="text-sm font-medium text-foreground">{result.topPick}</p>
              {result.topPickReason && (
                <p className="text-xs text-muted-foreground mt-1">{result.topPickReason}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            {result.hooks.map((hook, i) => (
              <HookCard
                key={i}
                hook={hook}
                editedHook={getEditedHook(i)}
                topic={result.topic}
                platform={result.platform}
                allHooks={result.hooks}
                onCopy={onCopy}
                onEditChange={(newText) =>
                  setEditedHooks((prev) => ({ ...prev, [i]: newText }))
                }
              />
            ))}
          </div>
          {/* Push All from history */}
          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-700 text-white mt-2"
            onClick={handlePushAllHistory}
          >
            <SendHorizonal className="w-3.5 h-3.5 mr-2" />
            Push All {result.hooks.length} Hooks to Script Generator →
          </Button>
          <p className="text-xs text-muted-foreground text-center -mt-1">
            Edit any hook above, then push the batch to generate full scripts.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HookGenerator() {
  const [, setLocation] = useLocation();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [persona, setPersona] = useState("");
  const [result, setResult] = useState<HookResult | null>(null);
  const [sentToLabCount, setSentToLabCount] = useState(0);
  // Editable hook texts — keyed by index
  const [editedHooks, setEditedHooks] = useState<Record<number, string>>({});

  const generateMutation = trpc.viralStudio.generateHooks.useMutation({
    onSuccess: (data) => {
      setResult(data as unknown as HookResult);
      setSentToLabCount(0);
      setEditedHooks({});
      toast.success("5 hooks generated!");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const historyQuery = trpc.viralStudio.getRecentHooks.useQuery({ limit: 20 });

  const topFrameworksQuery = trpc.viralStudio.getTopFrameworks.useQuery({ platform });
  const topFramework = topFrameworksQuery.data?.[0]?.framework ?? null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Enter a topic first"); return; }
    generateMutation.mutate({
      topic: topic.trim(),
      platform: platform as "tiktok" | "instagram" | "youtube" | "linkedin" | "x",
      targetPersona: persona || undefined,
    });
  };

  const getEditedHook = (i: number) =>
    editedHooks[i] !== undefined ? editedHooks[i] : (result?.hooks[i]?.hook ?? "");

  const handlePushAll = () => {
    if (!result) return;
    const batch = result.hooks.map((h, i) => ({
      hook: getEditedHook(i),
      framework: h.framework,
    }));
    const params = new URLSearchParams({
      tab: "script",
      topic: result.topic,
      platform: result.platform,
      hookBatch: JSON.stringify(batch),
      batchTopic: result.topic, // auto-fill topic field in Script Generator
    });
    if (topFramework) params.set("framework", topFramework);
    setLocation(`/viral-studio?${params.toString()}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Explainer */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <h3 className="font-semibold text-violet-900 mb-1">5 Psychology-Backed Hook Frameworks</h3>
        <p className="text-sm text-violet-700">
          Every hook is generated using one of five proven viral frameworks: <strong>Contradiction</strong>, <strong>Specificity</strong>, <strong>Timeframe Tension</strong>, <strong>POV</strong>, and <strong>Curiosity Gap</strong>. Each is scored 1–5 for viral potential. Use the <Pencil className="w-3 h-3 inline text-violet-500" /> icon to edit any hook inline, then click <strong>Push All to Script Generator</strong> to batch-generate full scripts for all of them at once.
        </p>
      </div>

      {/* Sent-to-lab confirmation banner */}
      {sentToLabCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{sentToLabCount} hook{sentToLabCount > 1 ? "s" : ""} sent to A/B Test Lab.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              Generate Hooks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Topic or Idea *</Label>
              <Textarea
                placeholder="e.g. 'The gut-brain connection and why your mood is controlled by your microbiome'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

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
              {topFramework && (
                <p className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  Top-performing for {platform}: <span className="font-semibold capitalize">{topFramework}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Persona (optional)</Label>
              <Input
                placeholder="e.g. 'Burned-out executive, 45, struggles with energy and sleep'"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="text-sm"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !topic.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating 5 hooks...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Generate 5 Hooks</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="space-y-3">
          {result ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Generated Hooks</h3>
                <Badge variant="outline" className="text-xs">{result.platform}</Badge>
              </div>

              {result.topPick && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <p className="text-xs font-semibold text-violet-700 mb-1">⭐ AI Top Pick</p>
                  <p className="text-sm font-medium text-foreground">{result.topPick}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-xs text-violet-600 px-2"
                    onClick={() => handleCopy(result.topPick ?? "")}
                  >
                    <Copy className="w-3 h-3 mr-1" />Copy
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {result.hooks.map((hook, i) => (
                  <HookCard
                    key={i}
                    hook={hook}
                    editedHook={getEditedHook(i)}
                    topic={result.topic}
                    platform={result.platform}
                    allHooks={result.hooks}
                    onCopy={handleCopy}
                    onEditChange={(text) => setEditedHooks((prev) => ({ ...prev, [i]: text }))}
                    topFramework={topFramework}
                  />
                ))}
              </div>

              {/* Push All to Script Generator */}
              <div className="pt-2 border-t border-border">
                <Button
                  onClick={handlePushAll}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  size="lg"
                >
                  <SendHorizonal className="w-4 h-4 mr-2" />
                  Push All {result.hooks.length} Hooks to Script Generator →
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                  Edits you made above are included. The Script Generator will queue all hooks and let you generate full scripts one by one.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
              <Zap className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Enter a topic and click Generate to see 5 viral hooks</p>
              <p className="text-xs text-muted-foreground mt-1">
                Edit any hook inline, then push the whole batch to the Script Generator
              </p>
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
              <h3 className="text-sm font-semibold">Recent Hook Generations</h3>
            </div>
            <div className="space-y-2">
              {historyQuery.data.map((r) => (
                <ResultCard key={r.id} result={r as unknown as HookResult} onCopy={handleCopy} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
