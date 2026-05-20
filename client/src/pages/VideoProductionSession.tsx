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
  MessageSquare,
  Link2,
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

// ─── CTA Keyword Panel ───────────────────────────────────────────────────────

const KEYWORD_TEMPLATES: Record<Platform, string[]> = {
  tiktok: ["Comment {KEYWORD} below and I'll DM it to you!", "Reply {KEYWORD} in the comments and I'll send it right over.", "Drop {KEYWORD} in the comments — I'll DM you the link."],
  instagram: ["Comment {KEYWORD} below and I'll DM you the link!", "Reply {KEYWORD} in the comments and I'll send it to your DMs.", "Drop {KEYWORD} below — I'll DM you instantly."],
  youtube: ["Comment {KEYWORD} below and I'll reply with the link!", "Type {KEYWORD} in the comments and I'll send you the resource.", "Leave {KEYWORD} in the comments and I'll drop the link for you."],
  linkedin: ["Comment {KEYWORD} below and I'll send you the resource directly.", "Reply {KEYWORD} in the comments and I'll DM you the link.", "Drop {KEYWORD} in the comments — I'll send it over."],
  x: ["Reply {KEYWORD} to this post and I'll DM you the link.", "Tweet {KEYWORD} at me and I'll send it right over.", "Reply {KEYWORD} and I'll DM you instantly."],
  meta: ["Comment {KEYWORD} below and I'll send it to your Messenger!", "Reply {KEYWORD} in the comments — I'll DM you the link.", "Drop {KEYWORD} below and I'll message you the link."],
};

function CtaKeywordPanel({
  platform,
  idea,
}: {
  platform: Platform;
  idea: string;
}) {
  // Auto-suggest a keyword from the idea (first meaningful word, uppercased)
  const autoKeyword = idea
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(the|and|for|with|that|this|from|your|have|will|what|when|how)$/i.test(w))
    .slice(0, 1)
    .map((w) => w.replace(/[^a-zA-Z]/g, "").toUpperCase())
    .join("") || "FREE";

  const [keyword, setKeyword] = useState(autoKeyword);
  const [templateIdx, setTemplateIdx] = useState(0);
  const templates = KEYWORD_TEMPLATES[platform] ?? KEYWORD_TEMPLATES.instagram;
  const ctaCopy = templates[templateIdx].replace("{KEYWORD}", keyword || "KEYWORD");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard!"));
  };

  return (
    <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-sky-400" />
        <span className="text-sky-700 text-sm font-semibold">Keyword-Reply CTA</span>
        <span className="text-muted-foreground text-xs ml-1">— viewers comment a word to receive your link via DM</span>
      </div>

      {/* Keyword input */}
      <div className="flex items-center gap-2">
        <label className="text-muted-foreground text-xs w-20 shrink-0">Keyword</label>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="e.g. ENERGY"
          className="bg-background border-border text-foreground font-mono text-sm h-8 uppercase max-w-[160px]"
          maxLength={20}
        />
        <span className="text-muted-foreground text-xs">All caps, no spaces</span>
      </div>

      {/* Template selector */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs">CTA Template</label>
        <div className="space-y-1.5">
          {templates.map((tpl, i) => (
            <button
              key={i}
              onClick={() => setTemplateIdx(i)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                templateIdx === i
                  ? "border-sky-500/60 bg-sky-100 text-sky-800"
                  : "border-border bg-background text-muted-foreground hover:border-sky-300 hover:text-foreground"
              }`}
            >
              {tpl.replace("{KEYWORD}", keyword || "KEYWORD")}
            </button>
          ))}
        </div>
      </div>

      {/* Final CTA copy */}
      <div className="bg-background border border-border rounded-lg p-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs mb-1">Your CTA copy:</p>
          <p className="text-foreground font-medium text-sm">{ctaCopy}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-7 w-7 p-0 shrink-0"
          onClick={() => copyToClipboard(ctaCopy)}
          title="Copy CTA text"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* UTM hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="w-3 h-3" />
        <span>Use the <strong className="text-foreground/70">UTM Code Generator</strong> in Strategy to create a trackable link for this keyword.</span>
      </div>
    </div>
  );
}

// ─── New Session Form ─────────────────────────────────────────────────────────

function NewSessionForm({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");

  const createMutation = trpc.videoSession.createSession.useMutation();
  const generateMutation = trpc.videoSession.generateScripts.useMutation();

  const handleSubmit = async () => {
    if (!name.trim() || !idea.trim()) {
      toast.error("Please fill in both the session name and your video idea");
      return;
    }
    try {
      const { sessionId } = await createMutation.mutateAsync({ sessionName: name.trim(), idea: idea.trim(), platform });
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
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                Call to Action (Record Once)
              </h3>
              <ScriptCard
                script={cta}
                label="Call to Action"
                onApprove={(id, approved) => approveMutation.mutate({ scriptId: id, approved })}
                onEdit={(id, text) => editMutation.mutate({ scriptId: id, scriptText: text })}
                onTeleprompter={(text, title) => setTeleprompterData({ text, title })}
              />
              <CtaKeywordPanel platform={session.platform} idea={session.idea} />
            </div>
          )}
        </div>
      )}

      {/* Next step callout */}
      {allApproved && session.status === "ready_to_record" && (
        <div className="bg-amber-50 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-700 font-semibold text-sm">Ready to Record</p>
            <p className="text-amber-600/80 text-sm mt-1">
              Export the DOCX above for your teleprompter app, record your clips, then come back to the{" "}
              <strong>Video Variants</strong> page to upload and stitch them into final variants.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-amber-600 hover:bg-amber-700 text-white h-8"
              onClick={() => window.location.href = `/video-variants?session=${encodeURIComponent(session.sessionName)}`}
            >
              <ArrowRight className="w-3 h-3 mr-1" /> Go to Video Variants →
            </Button>
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
  const [view, setView] = useState<"list" | "new" | "detail">("list");
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
            <NewSessionForm onCreated={handleCreated} />
          </div>
        )}
        {view === "detail" && activeSessionId && (
          <SessionDetail sessionId={activeSessionId} onBack={() => setView("list")} />
        )}
      </div>
    </div>
  );
}
