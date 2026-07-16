/**
 * VideoProductionSession.tsx
 *
 * Unified video production workflow:
 *   Step 1 — New Session: enter idea + platform → generate 5 hooks + body + CTA
 *   Step 2 — Review & Approve: read, edit inline, approve individual scripts or all at once
 *   Step 3 — Teleprompter: full-screen scrolling teleprompter for each approved script
 *   Step 4 — Upload Recordings: upload MP4 per script, auto-links to session
 *   Step 5 — Splice: hand off to Video Variant Factory for stitching
 *
 * Sessions persist in DB so you can leave and come back.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { YouTubeEmbedPanel } from "@/components/YouTubeEmbedPanel";
import { useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  Circle,
  Pencil,
  Check,
  X,
  Play,
  FileText,
  Upload,
  Scissors,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  RotateCcw,
  Download,
  Trash2,
  Plus,
  Video,
  Clock,
  ArrowRight,
  ArrowLeft,
  Copy,
  Link2,
  BarChart2,
  Smartphone,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "tiktok" | "instagram" | "youtube" | "linkedin" | "x" | "meta";

interface SessionScript {
  id: number;
  sessionId: number;
  scriptType: "hook" | "body" | "cta";
  scriptOrder: number;
  scriptText: string;
  approved: boolean;
  approvedAt: Date | null;
  recordingUrl: string | null;
  recordingKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  id: number;
  userId: string;
  sessionName: string;
  idea: string;
  platform: Platform;
  status: "scripting" | "ready_to_record" | "uploading" | "stitching" | "done";
  variantJobId: number | null;
  ctaKeyword: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X / Twitter",
  meta: "Meta / Facebook",
};

const HOOK_LABELS = [
  "Contradiction",
  "Specificity",
  "Curiosity Gap",
  "Pain Point",
  "Bold Promise",
];

const STATUS_STEPS = [
  { key: "scripting", label: "Scripting" },
  { key: "ready_to_record", label: "Ready to Record" },
  { key: "uploading", label: "Uploading" },
  { key: "stitching", label: "Stitching" },
  { key: "done", label: "Done" },
];

// ─── Teleprompter Component ───────────────────────────────────────────────────

function Teleprompter({
  text,
  title,
  onClose,
}: {
  text: string;
  title: string;
  onClose: () => void;
}) {
  const [speed, setSpeed] = useState(40); // px per second
  const [running, setRunning] = useState(false);
  const [fontSize, setFontSize] = useState(48);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const scroll = useCallback(
    (time: number) => {
      if (!running) return;
      if (lastTimeRef.current) {
        const delta = (time - lastTimeRef.current) / 1000;
        if (containerRef.current) {
          containerRef.current.scrollTop += speed * delta;
        }
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(scroll);
    },
    [running, speed]
  );

  useEffect(() => {
    if (running) {
      lastTimeRef.current = 0;
      animFrameRef.current = requestAnimationFrame(scroll);
    } else {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [running, scroll]);

  const reset = () => {
    setRunning(false);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Controls */}
      <div className="flex items-center gap-3 px-6 py-3 bg-black/90 border-b border-white/10">
        <span className="text-white/60 text-sm font-medium truncate flex-1">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">Font</span>
          <Button size="sm" variant="ghost" className="text-white h-7 px-2" onClick={() => setFontSize((f) => Math.max(24, f - 4))}>−</Button>
          <span className="text-white text-xs w-8 text-center">{fontSize}</span>
          <Button size="sm" variant="ghost" className="text-white h-7 px-2" onClick={() => setFontSize((f) => Math.min(96, f + 4))}>+</Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">Speed</span>
          <Button size="sm" variant="ghost" className="text-white h-7 px-2" onClick={() => setSpeed((s) => Math.max(10, s - 10))}>−</Button>
          <span className="text-white text-xs w-8 text-center">{speed}</span>
          <Button size="sm" variant="ghost" className="text-white h-7 px-2" onClick={() => setSpeed((s) => Math.min(200, s + 10))}>+</Button>
        </div>
        <Button size="sm" variant="ghost" className="text-white h-7 px-2" onClick={reset}><RotateCcw className="w-4 h-4" /></Button>
        <Button
          size="sm"
          className={running ? "bg-red-600 hover:bg-red-700 text-white h-7 px-3" : "bg-green-600 hover:bg-green-700 text-white h-7 px-3"}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? "Pause" : "Start"}
        </Button>
        <Button size="sm" variant="ghost" className="text-white h-7 px-2" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Red center line */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-red-500/40 z-10 pointer-events-none" />
        <div
          ref={containerRef}
          className="h-full overflow-y-scroll px-16 py-[50vh] scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          <p
            className="text-white leading-relaxed text-center max-w-4xl mx-auto"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Generate Avatar Video Button ──────────────────────────────────────────

// ─── Helper: strip everything except spoken words for BigVU ──────────────────
function buildBigvuScript(scripts: SessionScript[]): string {
  const approvedHooks = scripts.filter((s) => s.scriptType === "hook" && s.approved);
  const body = scripts.find((s) => s.scriptType === "body");
  const cta = scripts.find((s) => s.scriptType === "cta");
  const parts = [...approvedHooks, body, cta].filter(Boolean).map((s) => s!.scriptText);
  // Strip any lines that look like b-roll notes, stage directions, or labels:
  // - Lines starting with [ or ( (stage directions / b-roll notes)
  // - Lines that are ALL CAPS and short (section labels like "HOOK 1" "BODY" "CTA")
  // - Lines starting with common instruction keywords
  const stripped = parts.map((text) =>
    text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return false;
        if (t.startsWith("[") || t.startsWith("(")) return false; // b-roll / stage directions
        if (/^[A-Z][A-Z\s\d\-—:]{0,30}$/.test(t)) return false; // ALL CAPS labels
        if (/^(B-?roll|NOTE|INSTRUCTION|HOST|PEDRAM|CUT TO|FADE|SCENE|VISUAL|GRAPHIC|OVERLAY|LOWER THIRD)/i.test(t)) return false;
        return true;
      })
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim()
  ).filter(Boolean);
  return stripped.join("\n\n");
}

// ─── Video Destination Panel ──────────────────────────────────────────────────

const DESTINATIONS = [
  {
    id: "heygen_then_descript" as const,
    label: "HeyGen + Descript",
    icon: "🎬",
    desc: "Avatar render (HeyGen) → B-roll edit (Descript) → VA Dashboard",
    color: "bg-red-600 hover:bg-red-700",
  },
  {
    id: "heygen_only" as const,
    label: "HeyGen Only",
    icon: "🤖",
    desc: "Avatar render only — no Descript editing. Raw avatar video in VA Dashboard.",
    color: "bg-orange-600 hover:bg-orange-700",
  },
  {
    id: "descript_only" as const,
    label: "Descript Only",
    icon: "✂️",
    desc: "Skip HeyGen — send script directly to Descript for voice cloning + B-roll.",
    color: "bg-violet-600 hover:bg-violet-700",
  },
  {
    id: "bigvu" as const,
    label: "BigVU Teleprompter",
    icon: "📱",
    desc: "Clean spoken-word script only — no b-roll notes, no labels. Copy & paste into BigVU.",
    color: "bg-sky-600 hover:bg-sky-700",
  },
] as const;

type DestinationId = (typeof DESTINATIONS)[number]["id"];

function VideoDestinationPanel({ sessionName, scripts }: { sessionName: string; scripts: SessionScript[] }) {
  const [selected, setSelected] = useState<DestinationId>("heygen_then_descript");
  const [bigvuOpen, setBigvuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const startVideoJob = trpc.videoPipeline.startVideoJob.useMutation({
    onSuccess: (_, vars) => {
      const dest = DESTINATIONS.find((d) => d.id === vars.productionPath);
      toast.success(`Script queued for ${dest?.label ?? "video pipeline"}! Check VA Dashboard for status.`);
    },
    onError: (e) => toast.error(`Video pipeline error: ${e.message}`),
  });

  const handleSend = () => {
    if (selected === "bigvu") {
      setBigvuOpen(true);
      return;
    }
    const approvedHook = scripts.find((s) => s.scriptType === "hook" && s.approved);
    const body = scripts.find((s) => s.scriptType === "body");
    const cta = scripts.find((s) => s.scriptType === "cta");
    const parts = [approvedHook, body, cta].filter(Boolean).map((s) => s!.scriptText);
    if (parts.length === 0) { toast.error("No approved scripts to send"); return; }
    const fullScript = parts.join("\n\n");
    const dest = DESTINATIONS.find((d) => d.id === selected)!;
    if (!confirm(`Send to ${dest.label}?\n\n${dest.desc}`)) return;
    startVideoJob.mutate({ contentItemId: 0, scriptTitle: sessionName, scriptText: fullScript, productionPath: selected as any });
  };

  const bigvuScript = buildBigvuScript(scripts);

  const handleCopy = () => {
    navigator.clipboard.writeText(bigvuScript).then(() => {
      setCopied(true);
      toast.success("Script copied! Open BigVU → New Script → Paste.");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const selectedDest = DESTINATIONS.find((d) => d.id === selected)!;

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={(v) => setSelected(v as DestinationId)}>
          <SelectTrigger className="h-8 text-xs w-52 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DESTINATIONS.map((d) => (
              <SelectItem key={d.id} value={d.id} className="text-xs">
                {d.icon} {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className={`${selectedDest.color} text-white h-8`}
          disabled={startVideoJob.isPending}
          onClick={handleSend}
        >
          {startVideoJob.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : selected === "bigvu" ? (
            <Smartphone className="w-3 h-3 mr-1" />
          ) : (
            <Video className="w-3 h-3 mr-1" />
          )}
          {selected === "bigvu" ? "Open BigVU Script" : "Send to Pipeline"}
        </Button>
      </div>

      {/* BigVU Clean Script Dialog */}
      <Dialog open={bigvuOpen} onOpenChange={setBigvuOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-500" />
              BigVU Teleprompter Script
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Spoken words only — all b-roll notes, labels, and instructions have been stripped.
              Copy this, open BigVU → tap <strong>+</strong> → <strong>New Script</strong> → paste.
            </p>
            <div className="relative">
              <textarea
                readOnly
                value={bigvuScript}
                className="w-full h-72 p-4 text-sm font-mono bg-muted/40 border border-border rounded-lg resize-none focus:outline-none leading-relaxed"
              />
            </div>
            <div className="flex items-center gap-2 justify-between">
              <p className="text-xs text-muted-foreground">
                {bigvuScript.split(/\s+/).filter(Boolean).length} words
                {" · "}
                ~{Math.round(bigvuScript.split(/\s+/).filter(Boolean).length / 130)} min read
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => window.open("https://bigvu.tv", "_blank")}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open BigVU
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy Script"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Script Card ─────────────────────────────────────────────────────────────

function ScriptCard({
  script,
  label,
  onApprove,
  onEdit,
  onTeleprompter,
}: {
  script: SessionScript;
  label: string;
  onApprove: (id: number, approved: boolean) => void;
  onEdit: (id: number, text: string) => void;
  onTeleprompter: (text: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(script.scriptText);

  const handleSave = () => {
    if (draft.trim() && draft !== script.scriptText) {
      onEdit(script.id, draft.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(script.scriptText);
    setEditing(false);
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        script.approved
          ? "border-emerald-500/40 bg-emerald-50"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs font-semibold ${
              script.scriptType === "hook"
                ? "border-violet-500/50 text-violet-300"
                : script.scriptType === "body"
                ? "border-amber-500/50 text-amber-300"
                : "border-sky-500/50 text-sky-300"
            }`}
          >
            {label}
          </Badge>
          {script.approved && (
            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
            </Badge>
          )}
          {script.recordingUrl && (
            <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 text-xs">
              <Video className="w-3 h-3 mr-1" /> Recorded
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onTeleprompter(script.scriptText, label)}
            title="Open in teleprompter"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => { setDraft(script.scriptText); setEditing(true); }}
              title="Edit script"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 w-7 p-0 ${script.approved ? "text-emerald-600 hover:text-foreground" : "text-muted-foreground hover:text-emerald-600"}`}
            onClick={() => onApprove(script.id, !script.approved)}
            title={script.approved ? "Unapprove" : "Approve"}
          >
            {script.approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[120px] bg-background border-border text-foreground text-sm resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3" onClick={handleSave}>
              <Check className="w-3 h-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-3" onClick={handleCancel}>
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">{script.scriptText}</p>
      )}
    </div>
  );
}

// ─── New Session Form ─────────────────────────────────────────────────────────

function NewSessionForm({ onCreated, initialKeyword = "" }: { onCreated: (id: number) => void; initialKeyword?: string }) {
  const [name, setName] = useState(initialKeyword ? `${initialKeyword} — Video` : "");
  const [idea, setIdea] = useState(initialKeyword ? `Create a video targeting the keyword: "${initialKeyword}". Cover what this topic means, why it matters for health and wellbeing, and how Dr. Shojai's approach offers a unique perspective.` : "");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [ctaKeyword, setCtaKeyword] = useState<"UPSTREAM" | "LIGHTSON" | "TEST" | "SLEEP" | "WEBOFLIFE" | "ELEPHANT" | "">("UPSTREAM");
  // Content Brief fields
  const [contentPillar, setContentPillar] = useState("");
  const [funnelDestination, setFunnelDestination] = useState("");
  const [painCluster, setPainCluster] = useState("");
  const [villain, setVillain] = useState("");
  const [briefHookPhrase, setBriefHookPhrase] = useState("");
  const [showBrief, setShowBrief] = useState(false);

  // vidIQ keyword research
  const [vidiqKeyword, setVidiqKeyword] = useState(initialKeyword);
  const [showVidiqPanel, setShowVidiqPanel] = useState(!!initialKeyword);
  const vidiqResearch = trpc.vidiq.keywordResearch.useQuery(
    { keyword: vidiqKeyword, includeRelated: true },
    { enabled: vidiqKeyword.length > 2, staleTime: 5 * 60 * 1000 }
  );

  const CTA_KEYWORD_OPTIONS = [
    { value: "UPSTREAM",  label: "UPSTREAM — Upstream Program" },
    { value: "LIGHTSON",  label: "LIGHTSON — Lights On Program" },
    { value: "TEST",      label: "TEST — Gateway to Health Test" },
    { value: "SLEEP",     label: "SLEEP — Restorative Sleep Masterclass" },
    { value: "WEBOFLIFE", label: "WEBOFLIFE — The Web of Life" },
    { value: "ELEPHANT",  label: "ELEPHANT — Elephant in the Room" },
  ] as const;
  const PILLAR_OPTIONS = [
    { value: "gut_health_metabolism",   label: "🦠 Gut & Metabolism" },
    { value: "nervous_system_stress",   label: "🧠 Nervous System & Stress" },
    { value: "consciousness_longevity", label: "✨ Consciousness & Longevity" },
    { value: "web_of_life",             label: "🕸️ Web of Life (Systems)" },
    { value: "the_practice",            label: "🧘 The Practice (Qigong/Lifestyle)" },
  ] as const;
  const FUNNEL_OPTIONS = [
    { value: "lights_on",          label: "💡 Lights On" },
    { value: "upstream",           label: "🌊 Upstream" },
    { value: "web_of_life_lander",  label: "🕸️ Web of Life Lander" },
    { value: "elephant_lander",    label: "🐘 Elephant Lander" },
    { value: "gateway_test",       label: "🧪 Gateway Test" },
  ] as const;
  const PAIN_CLUSTER_OPTIONS = [
    "Waking Up Already Exhausted",
    "The Word-Finding Problem (Brain Fog)",
    "Eating Less, Gaining More",
    "The Gut That Never Settles",
    "The 'Your Labs Are Normal' Loop",
    "The Bin Full of Supplements",
    "The Revolving Door of Practitioners",
    "I Don't Recognize My Own Body Anymore",
    "My Health Is Affecting My Relationships",
    "Everything Is Connected — Nobody Is Looking at the Whole",
    "Ready to Actually Fix This — Not Just Manage It",
  ] as const;
  const VILLAIN_OPTIONS = [
    "The Medical System (built for disease, not function)",
    "The Standard Lab Panel (measures disease, not optimization)",
    "The Supplement Industry (guessing without testing)",
    "The Food System (ultra-processed, inflammatory by design)",
    "The Pharmaceutical Loop (symptom suppression, not root cause)",
    "The Attention Economy (outrage over insight)",
    "The Tax & Financial System (designed to keep you on the treadmill)",
    "The Education System (told you what kind of smart to be)",
  ] as const;

  const createMutation = trpc.videoSession.createSession.useMutation();
  const generateMutation = trpc.videoSession.generateScripts.useMutation();

  const handleSubmit = async () => {
    if (!name.trim() || !idea.trim()) {
      toast.error("Please fill in both the session name and your video idea");
      return;
    }
    try {
      const { sessionId } = await createMutation.mutateAsync({
        sessionName: name.trim(),
        idea: idea.trim(),
        platform,
        ctaKeyword: ctaKeyword || undefined,
        contentPillar: contentPillar as any || undefined,
        funnelDestination: funnelDestination as any || undefined,
        painCluster: painCluster || undefined,
        villain: villain || undefined,
        briefHookPhrase: briefHookPhrase || undefined,
      });
      toast.info("Generating 5 hooks + body + CTA — this takes about 15 seconds…");
      await generateMutation.mutateAsync({ sessionId });
      toast.success("Scripts generated! Review and approve below.");
      onCreated(sessionId);
    } catch (err) {
      toast.error("Failed to create session. Please try again.");
      console.error(err);
    }
  };

  const isLoading = createMutation.isPending || generateMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">New Video Production Session</h2>
        <p className="text-muted-foreground text-sm">Enter your idea and we'll generate 5 hooks, a main body, and a CTA — all in Dr. Shojai's voice.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-foreground/70 text-sm font-medium mb-1.5 block">Session Name</label>
          <Input
            placeholder="e.g., 'Why You're Always Tired' — May 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div>
          <label className="text-foreground/70 text-sm font-medium mb-1.5 block">Video Idea</label>
          <Textarea
            placeholder="Describe the core idea, topic, or message you want to convey in this video. Be as specific as possible — the more detail you give, the better the scripts."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="min-h-[120px] bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>

        {/* vidIQ Keyword Research */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-foreground/70 text-sm font-medium block">vidIQ Keyword Research</label>
            {vidiqResearch.isLoading && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Shaolin Temple meditation, qi gong morning routine"
              value={vidiqKeyword}
              onChange={(e) => setVidiqKeyword(e.target.value)}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setShowVidiqPanel(true)}
              disabled={vidiqKeyword.length < 3}
            >
              <BarChart2 className="w-3.5 h-3.5 mr-1" /> Research
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Enter a keyword to see YouTube search volume, competition, and related keyword opportunities from vidIQ before creating your session.</p>

          {showVidiqPanel && vidiqResearch.data && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">vidIQ — "{vidiqResearch.data.keyword}"</span>
                <button onClick={() => setShowVidiqPanel(false)} className="text-xs text-muted-foreground hover:text-foreground">× close</button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-background border border-border p-2">
                  <div className="text-lg font-bold text-foreground">{Math.round(vidiqResearch.data.volume)}</div>
                  <div className="text-xs text-muted-foreground">Volume</div>
                </div>
                <div className="rounded-md bg-background border border-border p-2">
                  <div className="text-lg font-bold text-foreground">{Math.round(vidiqResearch.data.competition)}</div>
                  <div className="text-xs text-muted-foreground">Competition</div>
                </div>
                <div className={`rounded-md border p-2 ${
                  vidiqResearch.data.overall >= 60 ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700" :
                  vidiqResearch.data.overall >= 40 ? "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700" :
                  "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700"
                }`}>
                  <div className={`text-lg font-bold ${
                    vidiqResearch.data.overall >= 60 ? "text-green-700 dark:text-green-400" :
                    vidiqResearch.data.overall >= 40 ? "text-amber-700 dark:text-amber-400" :
                    "text-red-700 dark:text-red-400"
                  }`}>{Math.round(vidiqResearch.data.overall)}</div>
                  <div className="text-xs text-muted-foreground">Opportunity</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">~{vidiqResearch.data.estimatedMonthlySearch.toLocaleString()} searches/month</div>
              {vidiqResearch.data.related.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Related keywords — click to use as session keyword:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {vidiqResearch.data.related.slice(0, 8).map((r) => (
                      <button
                        key={r.keyword}
                        onClick={() => {
                          setVidiqKeyword(r.keyword);
                          setName(`${r.keyword} — Video`);
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors hover:bg-primary hover:text-primary-foreground ${
                          vidiqKeyword === r.keyword
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-foreground"
                        }`}
                        title={`Volume: ${Math.round(r.volume)} | Competition: ${Math.round(r.competition)} | Score: ${Math.round(r.overall)}`}
                      >
                        {r.keyword} <span className="opacity-60">{Math.round(r.overall)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Content Brief Builder ────────────────────────────────────── */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBrief(!showBrief)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Content Brief</span>
              <span className="text-xs text-muted-foreground">(optional — improves hook specificity)</span>
              {(contentPillar || painCluster || villain) && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">filled</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showBrief ? "rotate-180" : ""}`} />
          </button>
          {showBrief && (
            <div className="p-4 space-y-4 border-t border-border">
              <p className="text-xs text-muted-foreground">These fields inject verified avatar intelligence into the generation prompt. The LLM uses your pain cluster and villain to write more specific, resonant hooks.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-foreground/70 text-xs font-medium mb-1.5 block">Content Pillar</label>
                  <Select value={contentPillar} onValueChange={setContentPillar}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue placeholder="Select pillar…" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {PILLAR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-foreground text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-foreground/70 text-xs font-medium mb-1.5 block">Funnel Destination</label>
                  <Select value={funnelDestination} onValueChange={setFunnelDestination}>
                    <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                      <SelectValue placeholder="Select funnel…" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {FUNNEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-foreground text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-foreground/70 text-xs font-medium mb-1.5 block">Avatar Pain Cluster</label>
                <Select value={painCluster} onValueChange={setPainCluster}>
                  <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                    <SelectValue placeholder="Which pain point does this video address?" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {PAIN_CLUSTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-foreground text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-foreground/70 text-xs font-medium mb-1.5 block">Named Villain (system, not person)</label>
                <Select value={villain} onValueChange={setVillain}>
                  <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                    <SelectValue placeholder="What system is the antagonist?" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {VILLAIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-foreground text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-foreground/70 text-xs font-medium mb-1.5 block">Verified Hook Phrase (Typeform language)</label>
                <Input
                  value={briefHookPhrase}
                  onChange={(e) => setBriefHookPhrase(e.target.value)}
                  placeholder="e.g. 'I just want to feel like myself again'"
                  className="bg-background border-border text-foreground text-xs h-9 placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Paste exact language from the Typeform survey — the LLM will use it verbatim in Hook 4 (Pain Point).</p>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="text-foreground/70 text-sm font-medium mb-1.5 block">Platform</label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-foreground">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-foreground/70 text-sm font-medium mb-1.5 block">ManyChat Keyword (CTA)</label>
          <p className="text-xs text-muted-foreground mb-2">The CTA will tell viewers to comment this keyword — ManyChat DMs them the link automatically. Never says the URL out loud.</p>
          <Select value={ctaKeyword} onValueChange={(v) => setCtaKeyword(v as typeof ctaKeyword)}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue placeholder="Select a keyword..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CTA_KEYWORD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-foreground">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating scripts…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Generate 5 Hooks + Body + CTA</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Session Detail View ──────────────────────────────────────────────────────

function SessionDetail({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
  const [teleprompterData, setTeleprompterData] = useState<{ text: string; title: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingCta, setRegeneratingCta] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.videoSession.getSession.useQuery({ sessionId }, { refetchInterval: 5000 });

  const approveMutation = trpc.videoSession.approveScript.useMutation({
    onSuccess: () => utils.videoSession.getSession.invalidate({ sessionId }),
    onError: () => toast.error("Failed to update approval"),
  });

  const editMutation = trpc.videoSession.updateScript.useMutation({
    onSuccess: () => {
      utils.videoSession.getSession.invalidate({ sessionId });
      toast.success("Script updated");
    },
    onError: () => toast.error("Failed to save edit"),
  });

  const approveAllMutation = trpc.videoSession.approveAll.useMutation({
    onSuccess: () => {
      utils.videoSession.getSession.invalidate({ sessionId });
      toast.success("All scripts approved! You're ready to record.");
    },
    onError: () => toast.error("Failed to approve all"),
  });

  const generateMutation = trpc.videoSession.generateScripts.useMutation({
    onSuccess: () => {
      utils.videoSession.getSession.invalidate({ sessionId });
      toast.success("New scripts generated!");
      setRegenerating(false);
    },
    onError: () => {
      toast.error("Failed to regenerate scripts");
      setRegenerating(false);
    },
  });

  const regenerateCtaMutation = trpc.videoSession.regenerateCta.useMutation({
    onSuccess: () => {
      utils.videoSession.getSession.invalidate({ sessionId });
      toast.success("CTA regenerated!");
      setRegeneratingCta(false);
    },
    onError: () => {
      toast.error("Failed to regenerate CTA");
      setRegeneratingCta(false);
    },
  });

  // Export teleprompter DOCX
  const exportQuery = trpc.videoSession.exportTeleprompter.useQuery(
    { sessionId },
    { enabled: false }
  );

  const handleExportDocx = async () => {
    try {
      const result = await utils.videoSession.exportTeleprompter.fetch({ sessionId });
      const filesBase64: Record<string, string> = JSON.parse(result.docxPayload);
      // Use JSZip to assemble the DOCX
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const [name, b64] of Object.entries(filesBase64)) {
        zip.file(name, b64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.session.sessionName ?? "scripts"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX downloaded!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-20 text-muted-foreground">
      <p>Failed to load session.</p>
      <Button variant="ghost" className="text-muted-foreground mt-2" onClick={onBack}>← Back</Button>
    </div>
  );

  const { session, scripts } = data;
  const hooks = scripts.filter((s: SessionScript) => s.scriptType === "hook").sort((a: SessionScript, b: SessionScript) => a.scriptOrder - b.scriptOrder);
  const body = scripts.find((s: SessionScript) => s.scriptType === "body");
  const cta = scripts.find((s: SessionScript) => s.scriptType === "cta");
  const approvedCount = scripts.filter((s: SessionScript) => s.approved).length;
  const allApproved = approvedCount === scripts.length && scripts.length > 0;

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === session.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground -ml-2 mb-1 h-7 text-xs" onClick={onBack}>
            <ChevronLeft className="w-3 h-3 mr-1" /> All Sessions
          </Button>
          <h2 className="text-xl font-bold text-foreground">{session.sessionName}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{session.idea.slice(0, 120)}{session.idea.length > 120 ? "…" : ""}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="border-border text-muted-foreground text-xs">
            {PLATFORM_LABELS[session.platform]}
          </Badge>
          {session.ctaKeyword && (
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-mono">
              #{session.ctaKeyword}
            </Badge>
          )}
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            {approvedCount}/{scripts.length} approved
          </Badge>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              i < currentStepIdx ? "bg-emerald-100 text-emerald-700" :
              i === currentStepIdx ? "bg-primary/10 text-primary ring-1 ring-primary/30" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < currentStepIdx ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {step.label}
            </div>
            {i < STATUS_STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {!allApproved && (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
            onClick={() => approveAllMutation.mutate({ sessionId })}
            disabled={approveAllMutation.isPending || scripts.length === 0}
          >
            {approveAllMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Approve All
          </Button>
        )}
        {allApproved && (
          <Button
            size="sm"
            className="bg-sky-600 hover:bg-sky-700 text-white h-8"
            onClick={handleExportDocx}
          >
            <Download className="w-3 h-3 mr-1" /> Export Teleprompter DOCX
          </Button>
        )}
        {allApproved && (
          <VideoDestinationPanel sessionName={session.sessionName} scripts={scripts} />
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-border text-muted-foreground hover:text-foreground h-8"
          onClick={() => {
            setRegenerating(true);
            generateMutation.mutate({ sessionId });
          }}
          disabled={regenerating || generateMutation.isPending}
        >
          {regenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
          Regenerate All Scripts
        </Button>
      </div>

      {/* Scripts */}
      {scripts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No scripts yet. Click "Regenerate All Scripts" to generate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hooks */}
          <div>
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              Hooks (5 Variants for Split Testing)
            </h3>
            <div className="space-y-3">
              {hooks.map((hook: SessionScript, i: number) => (
                <ScriptCard
                  key={hook.id}
                  script={hook}
                  label={`Hook ${i + 1} — ${HOOK_LABELS[i] ?? `Hook ${i + 1}`}`}
                  onApprove={(id, approved) => approveMutation.mutate({ scriptId: id, approved })}
                  onEdit={(id, text) => editMutation.mutate({ scriptId: id, scriptText: text })}
                  onTeleprompter={(text, title) => setTeleprompterData({ text, title })}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          {body && (
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Main Body (Record Once)
              </h3>
              <ScriptCard
                script={body}
                label="Main Body"
                onApprove={(id, approved) => approveMutation.mutate({ scriptId: id, approved })}
                onEdit={(id, text) => editMutation.mutate({ scriptId: id, scriptText: text })}
                onTeleprompter={(text, title) => setTeleprompterData({ text, title })}
              />
            </div>
          )}

          {/* CTA */}
          {cta && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                  Call to Action (Record Once)
                  {session.ctaKeyword && (
                    <span className="font-mono text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal">#{session.ctaKeyword}</span>
                  )}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-sky-400/30 text-sky-400 hover:text-sky-300 hover:border-sky-400/60 h-7 text-xs"
                  onClick={() => {
                    setRegeneratingCta(true);
                    regenerateCtaMutation.mutate({ sessionId });
                  }}
                  disabled={regeneratingCta || regenerateCtaMutation.isPending}
                >
                  {regeneratingCta ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  Regenerate CTA
                </Button>
              </div>
              <ScriptCard
                script={cta}
                label="Call to Action"
                onApprove={(id, approved) => approveMutation.mutate({ scriptId: id, approved })}
                onEdit={(id, text) => editMutation.mutate({ scriptId: id, scriptText: text })}
                onTeleprompter={(text, title) => setTeleprompterData({ text, title })}
              />

            </div>
          )}
        </div>
      )}

      {/* Publish Package Panel — YouTube metadata, social captions, blog generation */}
      {(session.status === "ready_to_record" || session.status === "uploading" || session.status === "stitching" || session.status === "done") && (
        <PublishPackagePanel sessionId={session.id} />
      )}

      {/* Keith Item 6: YouTube → Blog Embed Panel */}
      {(session.status === "ready_to_record" || session.status === "uploading" || session.status === "stitching" || session.status === "done") && (
        <BlogEmbedSection sessionIdea={session.idea} ctaKeyword={session.ctaKeyword} />
      )}

      {/* Next step callout */}
      {session.status === "ready_to_record" && (
        <div className="bg-amber-50 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-700 font-semibold text-sm">Ready to Record</p>
            <p className="text-amber-600/80 text-sm mt-1">
              Export the DOCX for your teleprompter app, record your clips, then come back to the{" "}
              <strong>Video Variants</strong> page to upload and stitch them into final variants.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 text-white h-8"
                onClick={handleExportDocx}
              >
                <Download className="w-3 h-3 mr-1" /> Export Teleprompter DOCX
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white h-8"
                onClick={() => window.location.href = `/video-variants?session=${encodeURIComponent(session.sessionName)}`}
              >
                <ArrowRight className="w-3 h-3 mr-1" /> Go to Video Variants →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Teleprompter overlay */}
      {teleprompterData && (
        <Teleprompter
          text={teleprompterData.text}
          title={teleprompterData.title}
          onClose={() => setTeleprompterData(null)}
        />
      )}
    </div>
  );
}

// ─── Blog Embed Section (Keith Item 6) ──────────────────────────────────────

/**
 * BlogEmbedSection — shown inside a Video Production session once scripts are
 * approved. Lets Pedram search for the matching published blog post and embed
 * the YouTube video directly into it from within the video workflow.
 */
function BlogEmbedSection({ sessionIdea, ctaKeyword }: { sessionIdea: string; ctaKeyword: string | null }) {
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedWpPostId, setSelectedWpPostId] = useState<number | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [selectedFocusKeyword, setSelectedFocusKeyword] = useState("");
  const [selectedEmbedStatus, setSelectedEmbedStatus] = useState<string | null>(null);
  const [selectedEmbedVideoId, setSelectedEmbedVideoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(ctaKeyword ?? sessionIdea.slice(0, 60));
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = trpc.blog.searchPublishedPosts.useMutation({
    onSuccess: () => setHasSearched(true),
  });

  const posts = (searchMutation.data?.posts ?? []) as Array<{
    id: number;
    title: string;
    wpPostId: number | null;
    focusKeyword: string | null;
    embeddedYoutubeEmbedStatus: string | null;
    embeddedYoutubeVideoId: string | null;
  }>;

  return (
    <div className="rounded-xl border border-red-600/20 bg-red-950/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <h3 className="text-sm font-semibold text-foreground">Embed in Blog Post</h3>
        <span className="text-xs text-muted-foreground">Link this video to a published article on WordPress</span>
      </div>

      {!selectedPostId ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 h-8 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search published blog posts by keyword…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate({ query: searchQuery })}
            />
            <Button
              size="sm"
              className="h-8 bg-red-600 hover:bg-red-700 text-white shrink-0"
              disabled={searchMutation.isPending || !searchQuery.trim()}
              onClick={() => searchMutation.mutate({ query: searchQuery })}
            >
              {searchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
            </Button>
          </div>

          {hasSearched && posts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No published blog posts found for that keyword.</p>
          )}

          {posts.length > 0 && (
            <div className="space-y-1.5">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-3 py-2 cursor-pointer hover:border-red-500/40 transition-colors"
                  onClick={() => {
                    if (!post.wpPostId) return;
                    setSelectedPostId(post.id);
                    setSelectedWpPostId(post.wpPostId);
                    setSelectedTitle(post.title);
                    setSelectedFocusKeyword(post.focusKeyword ?? "");
                    setSelectedEmbedStatus(post.embeddedYoutubeEmbedStatus);
                    setSelectedEmbedVideoId(post.embeddedYoutubeVideoId);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                    {post.focusKeyword && (
                      <p className="text-xs text-muted-foreground truncate">#{post.focusKeyword}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {post.embeddedYoutubeEmbedStatus === "embedded" && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">Embedded</span>
                    )}
                    {post.embeddedYoutubeEmbedStatus === "skipped" && (
                      <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">Skipped</span>
                    )}
                    {!post.wpPostId && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">Not on WP</span>
                    )}
                    {post.wpPostId && post.embeddedYoutubeEmbedStatus !== "embedded" && (
                      <span className="text-[10px] bg-red-100 text-red-700 rounded px-1.5 py-0.5">Select →</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground truncate flex-1">{selectedTitle}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setSelectedPostId(null)}
            >
              ← Change
            </Button>
          </div>
          <YouTubeEmbedPanel
            contentItemId={selectedPostId}
            title={selectedTitle}
            focusKeyword={selectedFocusKeyword || ctaKeyword || sessionIdea.slice(0, 60)}
            embeddedYoutubeVideoId={selectedEmbedVideoId}
            embeddedYoutubeEmbedStatus={selectedEmbedStatus}
            wpPostId={selectedWpPostId!}
            onEmbedSuccess={() => setSelectedPostId(null)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Publish Package Panel ──────────────────────────────────────────────────────

/**
 * PublishPackagePanel — shown in a Video Production session once scripts are approved.
 * Generates YouTube metadata (5 title options, description, 25 tags) +
 * social captions (Instagram, TikTok, LinkedIn, X) + blog post from the script.
 */
function PublishPackagePanel({ sessionId }: { sessionId: number }) {
  const [activeTab, setActiveTab] = useState<"youtube" | "social" | "blog">("youtube");
  const [ytMeta, setYtMeta] = useState<{
    titleOptions: string[];
    description: string;
    tags: string[];
    primaryKeyword: string;
  } | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [socialCaptions, setSocialCaptions] = useState<{
    instagram: { caption: string; hashtags: string[] };
    tiktok: { caption: string; hashtags: string[] };
    linkedin: { caption: string; hashtags: string[] };
    x: { caption: string; hashtags: string[] };
  } | null>(null);
  const [socialPlatform, setSocialPlatform] = useState<"instagram" | "tiktok" | "linkedin" | "x">("instagram");
  const [blogResult, setBlogResult] = useState<{ title: string; preview: string; contentItemId: number | null } | null>(null);

  const ytMetaMutation = trpc.videoSession.generateYouTubeMetadata.useMutation({
    onSuccess: (data) => {
      setYtMeta(data);
      if (data.titleOptions[0]) setSelectedTitle(data.titleOptions[0]);
      toast.success("YouTube metadata generated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const socialMutation = trpc.videoSession.generateSocialCaptions.useMutation({
    onSuccess: (data) => {
      setSocialCaptions(data);
      toast.success("Social captions generated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const blogMutation = trpc.videoSession.generateBlogFromScript.useMutation({
    onSuccess: (data) => {
      setBlogResult(data);
      toast.success("Blog post created in Command Center!");
    },
    onError: (e) => toast.error(e.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  const tabs = [
    { key: "youtube" as const, label: "🎬 YouTube", desc: "Title, description, tags" },
    { key: "social" as const, label: "📱 Social", desc: "Instagram, TikTok, LinkedIn, X" },
    { key: "blog" as const, label: "📝 Blog", desc: "Generate companion article" },
  ];

  return (
    <div className="rounded-xl border border-violet-600/30 bg-violet-950/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-500" />
        <h3 className="text-sm font-semibold text-foreground">Publish Package</h3>
        <span className="text-xs text-muted-foreground">Generate everything you need to publish this video</span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* YouTube Metadata Tab */}
      {activeTab === "youtube" && (
        <div className="space-y-3">
          {!ytMeta ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">Generate 5 SEO-optimized title options, a full YouTube description with timestamps and channel footer, and 25 tags — all from your approved script.</p>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                disabled={ytMetaMutation.isPending}
                onClick={() => ytMetaMutation.mutate({ sessionId })}
              >
                {ytMetaMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Generating...</> : <><Sparkles className="w-3 h-3 mr-1.5" />Generate YouTube Package</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Title options */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">Title Options <span className="text-muted-foreground font-normal">(click to select)</span></p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => ytMetaMutation.mutate({ sessionId })}>
                    <RotateCcw className="w-3 h-3 mr-1" />Regenerate
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {ytMeta.titleOptions.map((title, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedTitle(title)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                        selectedTitle === title
                          ? "border-violet-500 bg-violet-500/10 text-foreground"
                          : "border-border hover:border-violet-500/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selectedTitle === title ? 'border-violet-500' : 'border-muted-foreground'
                      }">
                        {selectedTitle === title && <span className="w-2 h-2 rounded-full bg-violet-500" />}
                      </span>
                      <span className="flex-1">{title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(title, "Title"); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">Tags <span className="text-muted-foreground font-normal">({ytMeta.tags.length} tags)</span></p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(ytMeta.tags.join(", "), "Tags")}>
                    <Copy className="w-3 h-3 mr-1" />Copy All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ytMeta.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] bg-muted text-muted-foreground rounded px-2 py-0.5">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">Description</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(ytMeta.description, "Description")}>
                    <Copy className="w-3 h-3 mr-1" />Copy
                  </Button>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {ytMeta.description}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Social Captions Tab */}
      {activeTab === "social" && (
        <div className="space-y-3">
          {!socialCaptions ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">Generate platform-specific captions for Instagram, TikTok, LinkedIn, and X — each with the right tone, length, hashtags, and ManyChat CTA.</p>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                disabled={socialMutation.isPending}
                onClick={() => socialMutation.mutate({ sessionId })}
              >
                {socialMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Generating...</> : <><Sparkles className="w-3 h-3 mr-1.5" />Generate Social Captions</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Platform tabs */}
              <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
                {(["instagram", "tiktok", "linkedin", "x"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSocialPlatform(p)}
                    className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition-colors ${
                      socialPlatform === p
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "instagram" ? "📸 IG" : p === "tiktok" ? "🎵 TT" : p === "linkedin" ? "💼 LI" : "✖ X"}
                  </button>
                ))}
              </div>

              {/* Caption + hashtags */}
              {(() => {
                const data = socialCaptions[socialPlatform];
                const fullText = data.caption + "\n\n" + data.hashtags.join(" ");
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground capitalize">{socialPlatform} Caption</p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(fullText, `${socialPlatform} caption`)}>
                          <Copy className="w-3 h-3 mr-1" />Copy All
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => socialMutation.mutate({ sessionId })}>
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {data.caption}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {data.hashtags.map((h, i) => (
                        <span key={i} className="text-[10px] bg-violet-500/10 text-violet-600 rounded px-1.5 py-0.5">{h}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Blog Generation Tab */}
      {activeTab === "blog" && (
        <div className="space-y-3">
          {!blogResult ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">Generate a full SEO-optimized blog post from your video script. It will appear in the Command Center as a draft ready to edit and publish.</p>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                disabled={blogMutation.isPending}
                onClick={() => blogMutation.mutate({ sessionId })}
              >
                {blogMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Generating blog post...</> : <><Sparkles className="w-3 h-3 mr-1.5" />Generate Blog Post</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Blog post created!</span>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{blogResult.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{blogResult.preview}...</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                  onClick={() => window.location.href = "/command-center"}
                >
                  <ArrowRight className="w-3 h-3 mr-1" />Open in Command Center
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => { setBlogResult(null); blogMutation.mutate({ sessionId }); }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Session History ──────────────────────────────────────────────────────────

function SessionHistory({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: sessions, isLoading } = trpc.videoSession.listSessions.useQuery({ limit: 20 });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.videoSession.deleteSession.useMutation({
    onSuccess: () => {
      utils.videoSession.listSessions.invalidate();
      toast.success("Session deleted");
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
    </div>
  );

  if (!sessions?.length) return null;

  return (
    <div>
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Recent Sessions</h3>
      <div className="space-y-2">
        {sessions.map((s: Session) => (
          <div
            key={s.id}
            className="flex items-center gap-3 bg-card hover:bg-secondary border border-border rounded-xl px-4 py-3 cursor-pointer group transition-colors"
            onClick={() => onSelect(s.id)}
          >
            <Video className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium text-sm truncate">{s.sessionName}</p>
              <p className="text-muted-foreground text-xs truncate">{s.idea.slice(0, 80)}{s.idea.length > 80 ? "…" : ""}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="border-border text-muted-foreground text-xs hidden sm:flex">
                {PLATFORM_LABELS[s.platform]}
              </Badge>
              <Badge className={`text-xs ${
                s.status === "done" ? "bg-emerald-100 text-emerald-700" :
                s.status === "ready_to_record" ? "bg-amber-100 text-amber-700" :
                "bg-primary/10 text-primary"
              }`}>
                {STATUS_STEPS.find((st) => st.key === s.status)?.label ?? s.status}
              </Badge>
              {s.ctaKeyword && (
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono hidden sm:flex">
                  #{s.ctaKeyword}
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ sessionId: s.id }); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoProductionSession() {
  const search = useSearch();
  const keywordParam = new URLSearchParams(search).get("keyword") ?? "";
  const [view, setView] = useState<"list" | "new" | "detail">(keywordParam ? "new" : "list");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  const handleCreated = (id: number) => {
    setActiveSessionId(id);
    setView("detail");
  };

  const handleSelect = (id: number) => {
    setActiveSessionId(id);
    setView("detail");
  };

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        {view === "list" && (
          <div className="mb-8">
            <a href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </a>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Video Production Studio</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Idea → Scripts → Teleprompter → Record → Splice. One session, start to finish.
                </p>
              </div>
              <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                onClick={() => setView("new")}
              >
                <Plus className="w-4 h-4 mr-2" /> New Session
              </Button>
            </div>

            {/* Workflow explainer */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-6">
              {[
                { icon: Sparkles, label: "1. Generate", desc: "5 hooks + body + CTA" },
                { icon: CheckCircle2, label: "2. Approve", desc: "Edit & approve scripts" },
                { icon: FileText, label: "3. Teleprompter", desc: "Read to camera" },
                { icon: Upload, label: "4. Upload", desc: "Upload your MP4s" },
                { icon: Scissors, label: "5. Splice", desc: "Auto-stitch variants" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
                  <Icon className="w-5 h-5 mx-auto mb-1.5 text-accent" />
                  <p className="text-foreground text-xs font-semibold">{label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "list" && <SessionHistory onSelect={handleSelect} />}
        {view === "new" && (
          <div>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground -ml-2 mb-4 h-7 text-xs" onClick={() => setView("list")}>
              <ChevronLeft className="w-3 h-3 mr-1" /> Back
            </Button>
            <NewSessionForm onCreated={handleCreated} initialKeyword={keywordParam} />
          </div>
        )}
        {view === "detail" && activeSessionId && (
          <SessionDetail sessionId={activeSessionId} onBack={() => setView("list")} />
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
