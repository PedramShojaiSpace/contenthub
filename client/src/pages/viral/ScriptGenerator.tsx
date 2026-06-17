import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
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
import {
  FileText, Copy, Clock, ChevronDown, ChevronUp, Loader2,
  Zap, Kanban, CheckCircle2, Star, SendHorizonal, Play, X as XIcon,
  ListChecks, RotateCcw, Users, Monitor, AlignLeft, Clapperboard,
} from "lucide-react";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok (60s)" },
  { value: "instagram", label: "Instagram Reels (60s)" },
  { value: "youtube", label: "YouTube Shorts (60s)" },
  { value: "linkedin", label: "LinkedIn Video (90s)" },
];

const PROGRAMS = [
  { value: "none", label: "No specific program", url: "", color: "text-muted-foreground" },
  { value: "lightson", label: "Lights On", url: "lightson.theurbanmonk.com", color: "text-amber-700" },
  { value: "upstream", label: "Upstream", url: "upstream.theurbanmonk.com", color: "text-blue-700" },
  { value: "gateway", label: "Gateway to Health Test", url: "gth.theurbanmonk.com", color: "text-green-700" },
  { value: "sleep", label: "Sleep Masterclass", url: "theacademy.theurbanmonk.com/...", color: "text-indigo-700" },
];

const LENGTHS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "60 seconds" },
  { value: 90, label: "90 seconds" },
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
];

const LENGTH_PRESETS = [
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
  { value: 180, label: "3 min" },
];

const FRAMEWORK_COLORS: Record<string, string> = {
  contradiction: "bg-red-100 text-red-700 border-red-200",
  specificity: "bg-blue-100 text-blue-700 border-blue-200",
  timeframe: "bg-amber-100 text-amber-700 border-amber-200",
  pov: "bg-green-100 text-green-700 border-green-200",
  curiosity: "bg-purple-100 text-purple-700 border-purple-200",
  curiositygap: "bg-purple-100 text-purple-700 border-purple-200",
  socialproof: "bg-cyan-100 text-cyan-700 border-cyan-200",
  transformation: "bg-orange-100 text-orange-700 border-orange-200",
};

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

interface BatchItem {
  hook: string;
  framework: string;
  status: "pending" | "generating" | "done" | "error";
  result?: ScriptResult;
  error?: string;
}

// ─── ScriptDisplay ─────────────────────────────────────────────────────────────
// ─── Teleprompter Segment ─────────────────────────────────────────────────────
function TeleprompterSegment({
  label, badge, badgeColor, text, onCopy, segmentIndex, totalSegments,
}: {
  label: string;
  badge: string;
  badgeColor: string;
  text: string;
  onCopy: (t: string) => void;
  segmentIndex: number;
  totalSegments: number;
}) {
  return (
    <div className="rounded-xl border-2 border-border bg-background overflow-hidden">
      {/* Segment header */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${badgeColor}`}>
        <div className="flex items-center gap-2">
          <Clapperboard className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wide">{label}</span>
          <span className="text-xs opacity-75">({badge})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60">Video {segmentIndex} of {totalSegments}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 hover:bg-white/20" onClick={() => onCopy(text)}>
            <Copy className="w-3 h-3 mr-1" />Copy
          </Button>
        </div>
      </div>
      {/* Script text — large, readable for teleprompter */}
      <div className="p-5 bg-gray-950 text-white">
        <p className="text-xl leading-[1.9] font-medium tracking-wide whitespace-pre-wrap">
          {text}
        </p>
      </div>
    </div>
  );
}

// ─── ScriptDisplay ─────────────────────────────────────────────────────────────
function ScriptDisplay({ result, onCopy, autoSaved }: { result: ScriptResult; onCopy: (text: string) => void; autoSaved?: boolean }) {
  const [showStructure, setShowStructure] = useState(false);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [savedToKanban, setSavedToKanban] = useState(autoSaved ?? false);
  const [pipelineQueued, setPipelineQueued] = useState(false);
  const [createdContentItemId, setCreatedContentItemId] = useState<number | null>(null);

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

  const sendToVideoPipeline = trpc.videoPipeline.startVideoJob.useMutation({
    onSuccess: () => {
      setPipelineQueued(true);
      toast.success("Script queued! HeyGen → Descript B-roll → VA Dashboard for review.");
    },
    onError: (e) => toast.error(`Video pipeline error: ${e.message}`),
  });

  const handleSendToVideoPipeline = () => {
    if (!confirm(`Generate avatar video for "${result.topic}"?\n\nHeyGen will render the avatar, Descript adds B-roll, then it appears in the VA Dashboard for review.`)) return;
    sendToVideoPipeline.mutate({
      contentItemId: createdContentItemId ?? 0,
      scriptTitle: result.topic,
      scriptText: result.fullScript,
    });
  };

  const handleSaveToKanban = () => {
    if (savedToKanban) return;
    saveToKanbanMutation.mutate({
      items: [
        {
          title: ((result.topic || "").trim().slice(0, 80) || "Untitled Script"),
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

  // Build teleprompter segments:
  // Segment 1: Hook (separate video)
  // Segment 2: Body = Problem + Agitate + Value + Proof (single video)
  // Segment 3: CTA (separate video)
  const hookText = result.script?.hook ?? result.hook ?? "";
  const bodyText = [
    result.script?.problem,
    result.script?.agitate,
    result.script?.value,
    result.script?.proof,
  ].filter(Boolean).join("\n\n");
  const ctaText = result.script?.cta ?? "";
  const teleprompterSegments = [
    hookText ? { label: "HOOK", badge: "Record separately — first 3 seconds", badgeColor: "bg-red-600 text-white", text: hookText } : null,
    bodyText ? { label: "BODY", badge: "Record as single continuous video", badgeColor: "bg-green-700 text-white", text: bodyText } : null,
    ctaText ? { label: "CTA", badge: "Record separately — final overlay", badgeColor: "bg-violet-700 text-white", text: ctaText } : null,
  ].filter(Boolean) as Array<{ label: string; badge: string; badgeColor: string; text: string }>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{result.platform}</Badge>
        {result.estimatedSeconds && (
          <Badge variant="outline" className="text-xs">~{result.estimatedSeconds}s</Badge>
        )}
        {result.wordCount && (
          <Badge variant="outline" className="text-xs">{result.wordCount} words</Badge>
        )}
        {savedToKanban && (
          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />Saved to Command Center
          </Badge>
        )}
      </div>

      {/* View toggle: Script vs Teleprompter */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setShowTeleprompter(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            !showTeleprompter ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlignLeft className="w-3.5 h-3.5" />Script
        </button>
        <button
          onClick={() => setShowTeleprompter(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            showTeleprompter ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />Teleprompter
        </button>
      </div>

      {showTeleprompter ? (
        /* ── Teleprompter View ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex-1">
              <Clapperboard className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Recording guide:</strong> Each segment is a separate video. Record Hook, then Body once, then CTA. Combine in post.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-9 text-xs font-semibold border-amber-400 text-amber-700 hover:bg-amber-50 gap-1.5"
              onClick={() => {
                const fullDoc = teleprompterSegments
                  .map((seg, i) =>
                    `=== VIDEO ${i + 1} OF ${teleprompterSegments.length}: ${seg.label} ===\n${seg.badge.toUpperCase()}\n\n${seg.text}`
                  )
                  .join("\n\n" + "-".repeat(50) + "\n\n");
                onCopy(fullDoc);
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy All for Teleprompter
            </Button>
          </div>
          {teleprompterSegments.map((seg, i) => (
            <TeleprompterSegment
              key={seg.label}
              label={seg.label}
              badge={seg.badge}
              badgeColor={seg.badgeColor}
              text={seg.text}
              onCopy={onCopy}
              segmentIndex={i + 1}
              totalSegments={teleprompterSegments.length}
            />
          ))}
        </div>
      ) : (
        /* ── Script View ── */
        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Script</h4>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onCopy(result.fullScript)}>
                <Copy className="w-3 h-3 mr-1" />Copy Script
              </Button>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {result.fullScript}
            </div>
          </div>

          {sections.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowStructure(!showStructure)}
              >
                {showStructure ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showStructure ? "Hide" : "Show"} HPAVPC structure
              </button>
              {showStructure && (
                <div className="mt-2 space-y-2">
                  {sections.map((s) => {
                    const text = (result.script as any)[s.key];
                    if (!text) return null;
                    return (
                      <div key={s.key} className={`border-l-2 pl-3 py-1 ${s.color}`}>
                        <p className="text-xs font-semibold text-muted-foreground mb-0.5">{s.label}</p>
                        <p className="text-xs text-foreground leading-relaxed">{text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {result.captionHook && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-blue-700">Caption Hook</p>
                <Button variant="ghost" size="sm" className="h-5 text-xs px-1 text-blue-600" onClick={() => onCopy(result.captionHook!)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-foreground">{result.captionHook}</p>
            </div>
          )}

          {result.hashtags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag, i) => (
                  <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-foreground">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <Button
          onClick={handleSaveToKanban}
          disabled={savedToKanban || saveToKanbanMutation.isPending}
          className={`w-full ${savedToKanban ? "bg-green-600 hover:bg-green-600 text-white cursor-default" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
        >
          {saveToKanbanMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
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

// ─── BatchTeleprompterPanel ─────────────────────────────────────────────────
function BatchTeleprompterPanel({ queue, onCopy }: { queue: BatchItem[]; onCopy: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const doneItems = queue.filter((q) => q.status === "done" && q.result);
  if (doneItems.length === 0) return null;

  // All hooks (one per video)
  const hookSegments = doneItems.map((item, i) => ({
    label: `HOOK ${i + 1}`,
    badge: `${item.framework ?? ""} — record separately`,
    badgeColor: "bg-red-600 text-white",
    text: item.result!.script?.hook ?? item.result!.hook ?? "",
    segmentIndex: i + 1,
    totalSegments: doneItems.length + 2, // hooks + body + cta
  }));

  // Body from first script (problem + agitate + value + proof)
  const firstScript = doneItems[0].result!.script;
  const bodyText = [
    firstScript?.problem,
    firstScript?.agitate,
    firstScript?.value,
    firstScript?.proof,
  ].filter(Boolean).join("\n\n");

  // CTA from first script
  const ctaText = firstScript?.cta ?? "";

  const totalSegments = hookSegments.length + (bodyText ? 1 : 0) + (ctaText ? 1 : 0);
  let segmentCounter = hookSegments.length;

  return (
    <div className="border-t border-green-300 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-sm font-semibold text-green-800 hover:text-green-900"
      >
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4" />
          Recording Guide — Teleprompter View
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex-1">
              <Clapperboard className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Recording order:</strong> Record each HOOK separately ({hookSegments.length} takes), then BODY once, then CTA once.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-9 text-xs font-semibold border-amber-400 text-amber-700 hover:bg-amber-50 gap-1.5"
              onClick={() => {
                const allSegments: Array<{ label: string; badge: string; text: string }> = [
                  ...hookSegments.map((s) => ({ label: s.label, badge: s.badge, text: s.text })),
                  ...(bodyText ? [{ label: "BODY", badge: "Shared — record once", text: bodyText }] : []),
                  ...(ctaText ? [{ label: "CTA", badge: "Shared — record once", text: ctaText }] : []),
                ];
                const fullDoc = allSegments
                  .map((seg, i) =>
                    `=== VIDEO ${i + 1} OF ${allSegments.length}: ${seg.label} ===\n${seg.badge.toUpperCase()}\n\n${seg.text}`
                  )
                  .join("\n\n" + "-".repeat(50) + "\n\n");
                onCopy(fullDoc);
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy All for Teleprompter
            </Button>
          </div>
          {/* All hooks */}
          {hookSegments.map((seg) => (
            <TeleprompterSegment
              key={seg.label}
              label={seg.label}
              badge={seg.badge}
              badgeColor={seg.badgeColor}
              text={seg.text}
              onCopy={onCopy}
              segmentIndex={seg.segmentIndex}
              totalSegments={totalSegments}
            />
          ))}
          {/* Shared body */}
          {bodyText && (
            <TeleprompterSegment
              label="BODY"
              badge="Shared across all hook variants — record once"
              badgeColor="bg-green-700 text-white"
              text={bodyText}
              onCopy={onCopy}
              segmentIndex={++segmentCounter}
              totalSegments={totalSegments}
            />
          )}
          {/* Shared CTA */}
          {ctaText && (
            <TeleprompterSegment
              label="CTA"
              badge="Shared across all hook variants — record once"
              badgeColor="bg-violet-700 text-white"
              text={ctaText}
              onCopy={onCopy}
              segmentIndex={++segmentCounter}
              totalSegments={totalSegments}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── BatchQueuePanel ──────────────────────────────────────────────────────────
function BatchQueuePanel({
  items,
  topic,
  platform,
  lengthSeconds,
  cta,
  seoKeywords,
  persona,
  targetProgram,
  onClearBatch,
  onCopy,
  autoStart,
}: {
  items: BatchItem[];
  topic: string;
  platform: string;
  lengthSeconds: number;
  cta: string;
  seoKeywords: string;
  persona?: string;
  targetProgram?: string;
  onClearBatch: () => void;
  onCopy: (text: string) => void;
  autoStart?: boolean;
}) {
  const [queue, setQueue] = useState<BatchItem[]>(items);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [savedAll, setSavedAll] = useState(false);
  // Auto-start countdown
  const [countdown, setCountdown] = useState<number | null>(autoStart ? 3 : null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setLocation] = useLocation();

  const generateMutation = trpc.viralStudio.generateScript.useMutation();

  const PLATFORM_MAP_BATCH: Record<string, string> = {
    tiktok: "tiktok",
    instagram: "meta",
    youtube: "youtube",
    linkedin: "linkedin",
    x: "x",
  };

  const saveAllMutation = trpc.content.createBulk.useMutation({
    onSuccess: (data) => {
      setSavedAll(true);
      // Show toast with View in Kanban link
      toast.success(
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold">{data.created} scripts saved to Command Center ✓</span>
          <button
            className="text-xs text-blue-600 hover:text-blue-800 underline text-left font-medium"
            onClick={() => setLocation("/?column=drafting")}
          >
            View in Kanban (Drafting column) →
          </button>
        </div>,
        { duration: 8000 }
      );
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const handleSaveAll = () => {
    const doneItems = queue.filter((q) => q.status === "done" && q.result);
    if (doneItems.length === 0) { toast.error("No completed scripts to save yet"); return; }
    const kanbanPlatform = PLATFORM_MAP_BATCH[platform] ?? "tiktok";
    saveAllMutation.mutate({
      items: doneItems.map((q) => ({
        title: ((q.result!.hook || q.result!.topic || "Untitled Script").trim().slice(0, 80)) || "Untitled Script",
        rawIdea: q.result!.hook,
        platform: kanbanPlatform as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel",
        status: "drafting" as const,
        textContent: q.result!.fullScript,
      })),
    });
  };

  // Countdown auto-start logic
  const handleGenerateAllRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      handleGenerateAllRef.current();
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c !== null && c > 0 ? c - 1 : null));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown]);

  const cancelCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
  };

  // generateOne now returns the result so handleGenerateAll can collect them directly
  // (avoids stale-closure bug where queue state hasn't updated yet when we read it)
  const generateOne = useCallback(async (index: number): Promise<ScriptResult | null> => {
    const item = queue[index];
    if (!item || item.status === "done") return null;

    setQueue((prev) => prev.map((q, i) => i === index ? { ...q, status: "generating" } : q));
    try {
      // Map platform to values accepted by generateScript (tiktok|instagram|youtube|linkedin)
      const validPlatforms = ["tiktok", "instagram", "youtube", "linkedin"] as const;
      type ValidPlatform = typeof validPlatforms[number];
      const safePlatform: ValidPlatform = (validPlatforms as readonly string[]).includes(platform)
        ? (platform as ValidPlatform)
        : "tiktok";
      const validPrograms = ["lightson", "upstream", "gateway", "sleep"] as const;
      type ValidProgram = typeof validPrograms[number];
      const safeProgram: ValidProgram | undefined = targetProgram && (validPrograms as readonly string[]).includes(targetProgram)
        ? (targetProgram as ValidProgram)
        : undefined;
      const result = await generateMutation.mutateAsync({
        topic: topic.trim(),
        hook: item.hook,
        platform: safePlatform,
        targetLengthSeconds: lengthSeconds,
        cta: cta || undefined,
        socialSeoKeywords: seoKeywords ? seoKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
        targetPersona: persona || undefined,
        targetProgram: safeProgram,
      });
      const scriptResult = result as unknown as ScriptResult;
      setQueue((prev) => prev.map((q, i) => i === index ? { ...q, status: "done", result: scriptResult } : q));
      setExpandedIndex(index);
      return scriptResult;
    } catch (err: any) {
      setQueue((prev) => prev.map((q, i) => i === index ? { ...q, status: "error", error: err.message } : q));
      return null;
    }
  }, [queue, topic, platform, lengthSeconds, cta, seoKeywords, persona, generateMutation]);

  const handleGenerateAll = async () => {
    setIsRunningAll(true);
    // Collect results directly to avoid stale-closure bug (queue state lags behind setQueue calls)
    const freshResults: Array<{ hook: string; fullScript: string }> = [];
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "done" && queue[i].result) {
        // Already done from a previous run — include it
        freshResults.push({ hook: queue[i].result!.hook, fullScript: queue[i].result!.fullScript });
      } else {
        const result = await generateOne(i);
        if (result) freshResults.push({ hook: result.hook, fullScript: result.fullScript });
      }
    }
    setIsRunningAll(false);
    // Auto-save all completed scripts to Command Center using the freshly-collected results
    const kanbanPlatform = PLATFORM_MAP_BATCH[platform] ?? "tiktok";
    if (freshResults.length > 0) {
      saveAllMutation.mutate({
        items: freshResults.map((r) => ({
          title: ((r.hook || "Untitled Script").trim().slice(0, 80)) || "Untitled Script",
          rawIdea: r.hook,
          platform: kanbanPlatform as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel",
          status: "drafting" as const,
          textContent: r.fullScript,
        })),
      });
    } else {
      toast.success("All scripts generated!");
    }
  };

  // Keep ref in sync with latest handleGenerateAll
  useEffect(() => {
    handleGenerateAllRef.current = handleGenerateAll;
  });

  const doneCount = queue.filter((q) => q.status === "done").length;
  const pendingCount = queue.filter((q) => q.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Auto-start countdown banner */}
      {countdown !== null && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>
              <strong>Auto-starting in {countdown}...</strong> All scripts will generate automatically.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
            onClick={cancelCountdown}
          >
            <XIcon className="w-3 h-3 mr-1" />Cancel
          </Button>
        </div>
      )}
      {/* Batch header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Script Queue</h3>
          <Badge variant="outline" className="text-xs">
            {doneCount}/{queue.length} done
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
            onClick={handleGenerateAll}
            disabled={isRunningAll || pendingCount === 0}
          >
            {isRunningAll ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
            ) : (
              <><Play className="w-3.5 h-3.5 mr-1.5" />Generate All Scripts</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onClearBatch}
            title="Exit batch mode"
          >
            <XIcon className="w-3.5 h-3.5 mr-1.5" />Exit batch
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700">
        <strong>Batch mode:</strong> {queue.length} hooks from Hook Generator. Click <strong>Generate All Scripts</strong> to process them sequentially, or click <Play className="w-3 h-3 inline" /> on any individual hook to generate just that one. Edit the settings below before generating.
      </div>

      {/* Queue items */}
      <div className="space-y-2">
        {queue.map((item, i) => {
          const colorClass = FRAMEWORK_COLORS[item.framework.toLowerCase()] ?? "bg-gray-100 text-gray-700 border-gray-200";
          const isExpanded = expandedIndex === i;
          return (
            <div
              key={i}
              className={`border rounded-xl overflow-hidden transition-colors ${
                item.status === "done" ? "border-green-300 bg-green-50/30" :
                item.status === "generating" ? "border-blue-300 bg-blue-50/30" :
                item.status === "error" ? "border-red-300 bg-red-50/30" :
                "border-border"
              }`}
            >
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status indicator */}
                <div className="shrink-0">
                  {item.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {item.status === "generating" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {item.status === "pending" && (
                    <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                  )}
                  {item.status === "error" && (
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold">!</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className={`text-xs capitalize ${colorClass}`}>{item.framework}</Badge>
                    {item.status === "done" && <span className="text-xs text-green-600 font-medium">Script ready</span>}
                    {item.status === "error" && <span className="text-xs text-red-600">{item.error}</span>}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed line-clamp-2">{item.hook}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "pending" && !isRunningAll && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={() => generateOne(i)}
                    >
                      <Play className="w-3 h-3 mr-1" />Generate
                    </Button>
                  )}
                  {item.status === "error" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "pending", error: undefined } : q));
                        generateOne(i);
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />Retry
                    </Button>
                  )}
                  {item.status === "done" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded script */}
              {isExpanded && item.result && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="mt-3">
                    <ScriptDisplay result={item.result} onCopy={onCopy} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {doneCount === queue.length && queue.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-green-800 text-center">
            🎉 All {queue.length} scripts generated!
          </p>
          <Button
            className={`w-full ${savedAll ? "bg-green-600 hover:bg-green-600 text-white cursor-default" : "bg-green-700 hover:bg-green-800 text-white"}`}
            onClick={handleSaveAll}
            disabled={savedAll || saveAllMutation.isPending}
          >
            {saveAllMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving all scripts...</>
            ) : savedAll ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" />{doneCount} scripts saved to Command Center ✓</>
            ) : (
              <><Kanban className="w-4 h-4 mr-2" />Save All {doneCount} Scripts to Command Center</>
            )}
          </Button>
          {!savedAll && (
            <p className="text-xs text-green-700 text-center">
              Creates {doneCount} Drafting cards in your Kanban board — or expand individual scripts above to save selectively.
            </p>
          )}
          {/* Consolidated Teleprompter View */}
          <BatchTeleprompterPanel queue={queue} onCopy={onCopy} />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScriptGenerator() {
  // Read URL params — single hook mode
  const urlParams = new URLSearchParams(window.location.search);
  const prefillHook = urlParams.get("hook") ?? "";
  const prefillPlatform = urlParams.get("platform") ?? "";
  const prefillTopic = urlParams.get("topic") ?? "";
  const prefillFramework = urlParams.get("framework") ?? "";
  // Batch mode: hookBatch is a JSON array of {hook, framework, topic?}
  const prefillBatchRaw = urlParams.get("hookBatch") ?? "";
  const prefillBatchTopic = urlParams.get("batchTopic") ?? "";
  const prefillBatchPersona = urlParams.get("batchPersona") ?? "";

  const parsedBatch: Array<{ hook: string; framework: string }> = (() => {
    try { return prefillBatchRaw ? JSON.parse(prefillBatchRaw) : []; }
    catch { return []; }
  })();

  // Auto-fill topic: prefer explicit topic param, then batchTopic param
  const [topic, setTopic] = useState(prefillTopic || prefillBatchTopic);
  const [hook, setHook] = useState(prefillHook);
  const [platform, setPlatform] = useState(prefillPlatform || "tiktok");
  const [lengthSeconds, setLengthSeconds] = useState(60);
  const [cta, setCta] = useState("Comment 'MONK' below and I'll send you the full guide");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [persona, setPersona] = useState(prefillBatchPersona);
  const [targetProgram, setTargetProgram] = useState<"lightson" | "upstream" | "gateway" | "sleep" | "none">("none");
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [prefillBanner, setPrefillBanner] = useState(!!prefillHook && !prefillBatchRaw);
  const [topFrameworkBanner, setTopFrameworkBanner] = useState(!!prefillFramework);
  const [topFramework] = useState(prefillFramework);
  // Batch mode
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(
    parsedBatch.length > 0
      ? parsedBatch.map((b) => ({ hook: b.hook, framework: b.framework, status: "pending" as const }))
      : null
  );

  // Persona persistence
  const savedPersonaQuery = trpc.viralStudio.getPersona.useQuery();
  const savePersonaMutation = trpc.viralStudio.savePersona.useMutation();
  const savePersonaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved persona on mount (only if not already set from batch param)
  useEffect(() => {
    if (savedPersonaQuery.data?.persona && !persona) {
      setPersona(savedPersonaQuery.data.persona);
    }
  }, [savedPersonaQuery.data]);

  const handlePersonaChange = useCallback((value: string) => {
    setPersona(value);
    if (savePersonaTimer.current) clearTimeout(savePersonaTimer.current);
    savePersonaTimer.current = setTimeout(() => {
      if (value.trim()) savePersonaMutation.mutate({ persona: value.trim() });
    }, 1200);
  }, [savePersonaMutation]);

  // Persona suggestions
  const [personaSuggestions, setPersonaSuggestions] = useState<Array<{ persona: string; description: string }>>([]);
  const [showPersonaSuggestions, setShowPersonaSuggestions] = useState(false);
  const suggestPersonasMutation = trpc.viralStudio.suggestPersonas.useMutation({
    onSuccess: (data) => { setPersonaSuggestions(data.personas); setShowPersonaSuggestions(true); },
    onError: (err) => toast.error(`Failed to suggest personas: ${err.message}`),
  });

  // Clear URL params after reading
  useEffect(() => {
    if (prefillHook || prefillPlatform || prefillTopic || prefillFramework || prefillBatchRaw || prefillBatchTopic || prefillBatchPersona) {
      const url = new URL(window.location.href);
      url.searchParams.delete("hook");
      url.searchParams.delete("platform");
      url.searchParams.delete("topic");
      url.searchParams.delete("framework");
      url.searchParams.delete("hookBatch");
      url.searchParams.delete("batchTopic");
      url.searchParams.delete("batchPersona");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const autoSaveToKanbanMutation = trpc.content.createBulk.useMutation({
    onSuccess: (data) => {
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Script auto-saved to Command Center ✓</span>
          <span className="text-xs text-muted-foreground">Find it in the Drafting column of your Kanban board.</span>
        </div>
      );
    },
  });

  const PLATFORM_MAP_SINGLE: Record<string, string> = {
    tiktok: "tiktok",
    instagram: "meta",
    youtube: "youtube",
    linkedin: "linkedin",
    x: "x",
  };

  const generateMutation = trpc.viralStudio.generateScript.useMutation({
    onSuccess: (data) => {
      const scriptResult = data as unknown as ScriptResult;
      setResult(scriptResult);
      // Auto-save to Command Center immediately
      const kanbanPlatform = PLATFORM_MAP_SINGLE[platform] ?? "tiktok";
      autoSaveToKanbanMutation.mutate({
        items: [{
          title: (topic.trim() || "Untitled Script").slice(0, 80),
          rawIdea: hook.trim(),
          platform: kanbanPlatform as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel",
          status: "drafting" as const,
          textContent: scriptResult.fullScript,
        }],
      });
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
    const validPlatforms = ["tiktok", "instagram", "youtube", "linkedin"] as const;
    type ValidPlatform = typeof validPlatforms[number];
    const safePlatform: ValidPlatform = (validPlatforms as readonly string[]).includes(platform)
      ? (platform as ValidPlatform)
      : "tiktok";
    generateMutation.mutate({
      topic: topic.trim(),
      hook: hook.trim(),
      platform: safePlatform,
      targetLengthSeconds: lengthSeconds,
      cta: cta || undefined,
      socialSeoKeywords: seoKeywords ? seoKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      targetPersona: persona || undefined,
      targetProgram: targetProgram !== "none" ? targetProgram : undefined,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Batch mode banner */}
      {batchItems && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-blue-50 border border-blue-300 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <SendHorizonal className="w-4 h-4 shrink-0" />
            <span>
              <strong>Batch mode active:</strong> {batchItems.length} hooks from Hook Generator.
              {topic ? <> Topic auto-filled: <em>"{topic.slice(0, 60)}{topic.length > 60 ? "..." : ""}"</em>. </> : " "}
              Adjust settings below, then generate all scripts.
            </span>
          </div>
          <button className="text-xs text-blue-600 hover:text-blue-800 shrink-0 font-medium" onClick={() => setBatchItems(null)}>
            Exit batch
          </button>
        </div>
      )}

      {/* Single-hook pre-fill banner */}
      {prefillBanner && !batchItems && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-violet-700">
            <Zap className="w-4 h-4 shrink-0" />
            <span>Hook pre-filled from Hook Generator. Review the fields below and click Generate Script.</span>
          </div>
          <button className="text-xs text-violet-500 hover:text-violet-700 shrink-0" onClick={() => setPrefillBanner(false)}>✕</button>
        </div>
      )}

      {/* Top-performing framework banner */}
      {topFrameworkBanner && topFramework && !batchItems && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Star className="w-4 h-4 shrink-0 fill-amber-500 text-amber-500" />
            <span>
              <strong>Top-performing framework for {platform}:</strong>{" "}
              <span className="capitalize">{topFramework}</span> — the AI will write the hook section using this proven framework style.
            </span>
          </div>
          <button className="text-xs text-amber-600 hover:text-amber-800 shrink-0" onClick={() => setTopFrameworkBanner(false)}>✕</button>
        </div>
      )}

      {/* Explainer */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-1">HPAVPC Script Framework</h3>
        <p className="text-sm text-blue-700">
          Every script follows the <strong>Hook → Problem → Agitate → Value → Proof → CTA</strong> structure. Set your platform, length, and CTA below — then either generate a single script or run the full batch from Hook Generator.
        </p>
      </div>

      {/* Settings card — always visible so batch mode can use it */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            Script Settings
            {batchItems && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs ml-1">
                applies to all {batchItems.length} hooks
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Topic — always shown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Topic *</Label>
            {/* Content pillar quick-select chips — two labeled scrollable rows */}
            <div className="space-y-1.5 mb-1">
              {/* Health row */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Health</span>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {[
                    { label: "Gut Health", topic: "How your gut microbiome controls your mood and energy", color: "bg-green-100 text-green-700 border-green-300" },
                    { label: "Longevity", topic: "The 3 daily habits that separate people who age well from those who don't", color: "bg-orange-100 text-orange-700 border-orange-300" },
                    { label: "Sleep", topic: "Why most sleep advice is wrong and what actually restores your brain overnight", color: "bg-blue-100 text-blue-700 border-blue-300" },
                    { label: "Stress", topic: "How chronic stress is silently destroying your hormones and what to do about it", color: "bg-red-100 text-red-700 border-red-300" },
                    { label: "Brain", topic: "The daily habits that are silently shrinking your brain and how to reverse them", color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
                    { label: "Energy", topic: "Why your mitochondria are the real key to all-day energy and how to fix them", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
                    { label: "Detox", topic: "The toxins hiding in your everyday environment that are disrupting your hormones", color: "bg-lime-100 text-lime-700 border-lime-300" },
                    { label: "Fasting", topic: "What happens inside your body during a 24-hour fast that doctors rarely explain", color: "bg-amber-100 text-amber-700 border-amber-300" },
                    { label: "Hormones", topic: "Why your cortisol rhythm is the master switch for energy, weight, and sleep", color: "bg-rose-100 text-rose-700 border-rose-300" },
                    { label: "Supplements", topic: "The 3 supplements most people take that are actually making their gut worse", color: "bg-teal-100 text-teal-700 border-teal-300" },
                  ].map((p) => (
                    <button key={p.label} type="button" onClick={() => setTopic(p.topic)}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all hover:opacity-80 shrink-0 ${p.color}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mind / Consciousness row */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Mind</span>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {[
                    { label: "Consciousness", topic: "What neuroscience is finally confirming about the nature of consciousness and awareness", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
                    { label: "Enlightenment", topic: "The ancient practices that modern science is now proving actually change your brain", color: "bg-violet-100 text-violet-700 border-violet-300" },
                    { label: "Metaphysics", topic: "Why the materialist model of reality is breaking down and what it means for how you live", color: "bg-purple-100 text-purple-700 border-purple-300" },
                    { label: "Non-Duality", topic: "What the experience of non-dual awareness actually feels like and why it changes everything", color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300" },
                    { label: "Quantum Mind", topic: "Why quantum physics and consciousness research are converging on the same radical conclusion", color: "bg-sky-100 text-sky-700 border-sky-300" },
                    { label: "Daoism", topic: "The Daoist principle that modern high-achievers are violating and why it is burning them out", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
                    { label: "Ancient Wisdom", topic: "What 5000-year-old wisdom traditions knew about the mind that neuroscience is just catching up to", color: "bg-amber-100 text-amber-700 border-amber-300" },
                    { label: "Meditation", topic: "The specific type of meditation that rewires your default mode network in 8 weeks", color: "bg-blue-100 text-blue-700 border-blue-300" },
                    { label: "Near-Death", topic: "What near-death experiences are telling us about the nature of consciousness and reality", color: "bg-pink-100 text-pink-700 border-pink-300" },
                    { label: "Time & Reality", topic: "Why your perception of time is an illusion and what that means for how you live", color: "bg-orange-100 text-orange-700 border-orange-300" },
                  ].map((p) => (
                    <button key={p.label} type="button" onClick={() => setTopic(p.topic)}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all hover:opacity-80 shrink-0 ${p.color}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Textarea
              placeholder="e.g. 'How your gut microbiome controls your mood and energy'"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Hook — only in single mode */}
          {!batchItems && (
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Length</Label>
              {/* Quick-select preset pills */}
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {LENGTH_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setLengthSeconds(preset.value)}
                    className={`text-[11px] px-3 py-1 rounded-full border transition-all font-medium ${
                      lengthSeconds === preset.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <Select value={String(lengthSeconds)} onValueChange={(v) => setLengthSeconds(Number(v))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LENGTHS.map((l) => <SelectItem key={l.value} value={String(l.value)}>{l.label}</SelectItem>)}
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

          {/* Target Program dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target Program <span className="text-muted-foreground font-normal">(sets the CTA URL in the script)</span></Label>
            <Select value={targetProgram} onValueChange={(v) => setTargetProgram(v as typeof targetProgram)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROGRAMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className={p.color}>{p.label}</span>
                    {p.url && <span className="ml-2 text-[10px] text-muted-foreground">{p.url}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetProgram !== "none" && (
              <p className="text-[11px] text-muted-foreground">
                The CTA section will direct viewers to <strong>{PROGRAMS.find(p => p.value === targetProgram)?.url}</strong>
              </p>
            )}
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

          {!batchItems && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Target Persona (optional)</Label>
                  <button
                    type="button"
                    onClick={() => suggestPersonasMutation.mutate({ platform, topic: topic.trim() || undefined })}
                    disabled={suggestPersonasMutation.isPending}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {suggestPersonasMutation.isPending ? (
                      <><Loader2 className="w-3 h-3 animate-spin" />Suggesting...</>
                    ) : (
                      <><Users className="w-3 h-3" />Suggest persona</>
                    )}
                  </button>
                </div>
                {/* Persona suggestions panel */}
                {showPersonaSuggestions && personaSuggestions.length > 0 && (
                  <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-blue-700">AI Persona Suggestions — click to use</p>
                      <button type="button" onClick={() => setShowPersonaSuggestions(false)} className="text-muted-foreground hover:text-foreground">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {personaSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { handlePersonaChange(s.persona); setShowPersonaSuggestions(false); }}
                        className="w-full text-left text-xs p-2 rounded-md bg-white border border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                      >
                        <p className="font-medium text-foreground group-hover:text-blue-700">{s.persona}</p>
                        <p className="text-muted-foreground mt-0.5">{s.description}</p>
                      </button>
                    ))}
                  </div>
                )}
                {/* Quick-select persona chips */}
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {[
                    "Stressed professional, 40s, low energy",
                    "Health-conscious parent, 35-50",
                    "Biohacker, 30s, optimizing performance",
                    "Spiritual seeker, 50s, seeking purpose",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePersonaChange(persona === preset ? "" : preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        persona === preset
                          ? "bg-blue-600 text-white border-blue-600 font-medium"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-blue-400 hover:text-blue-600"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Or type a custom persona..."
                  value={persona}
                  onChange={(e) => handlePersonaChange(e.target.value)}
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Batch queue or single result */}
      {batchItems ? (
        <BatchQueuePanel
          items={batchItems}
          topic={topic}
          platform={platform}
          lengthSeconds={lengthSeconds}
          cta={cta}
          seoKeywords={seoKeywords}
          persona={persona}
          targetProgram={targetProgram}
          onClearBatch={() => setBatchItems(null)}
          onCopy={handleCopy}
          autoStart={!!(prefillBatchRaw && (prefillBatchTopic || prefillTopic))}
        />
      ) : result ? (
        <div>
          <h3 className="text-sm font-semibold mb-3">Generated Script</h3>
          <ScriptDisplay result={result} onCopy={handleCopy} autoSaved={true} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl text-center p-6">
          <FileText className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Fill in the settings and click Generate to get a full HPAVPC script</p>
          <p className="text-xs text-muted-foreground mt-1">Or use <strong>Push All to Script Generator</strong> in the Hook Generator to batch-generate scripts for all 5 hooks</p>
        </div>
      )}

      {/* History */}
      {!batchItems && historyQuery.data && historyQuery.data.length > 0 && (
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
