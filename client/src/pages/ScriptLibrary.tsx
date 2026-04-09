import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Film,
  LayoutGrid,
  FileText,
  Mail,
  Clapperboard,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  ArrowRight,
  Clock,
  Target,
  BookOpen,
  Video,
  RefreshCw,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
  Zap,
  Link,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScriptType = "video" | "carousel" | "blog" | "email" | "reel";
type ProductionStatus = "idea" | "scripted" | "in_production" | "in_edit" | "ready_to_post" | "published";
type Platform = "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "all";
type ContentGoal = "audience_growth" | "llm_seo" | "community_engagement";

interface Script {
  id: number;
  title: string;
  scriptType: ScriptType;
  platform: Platform | null;
  personaId: number | null;
  contentGoal: ContentGoal | null;
  productionStatus: ProductionStatus;
  scriptBody: string | null;
  notes: string | null;
  thumbnailUrl: string | null;
  linkedContentItemId: number | null;
  priority: number | null;
  estimatedDurationMin: number | null;
  competitorAngle: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLUMNS: { id: ProductionStatus; label: string; dotColor: string; headerBg: string; headerText: string }[] = [
  { id: "idea",          label: "Idea",           dotColor: "bg-stone-400",    headerBg: "bg-stone-100 border-stone-200",   headerText: "text-stone-600" },
  { id: "scripted",      label: "Scripted",        dotColor: "bg-sky-500",      headerBg: "bg-sky-50 border-sky-200",        headerText: "text-sky-700" },
  { id: "in_production", label: "In Production",   dotColor: "bg-amber-500",    headerBg: "bg-amber-50 border-amber-200",    headerText: "text-amber-700" },
  { id: "in_edit",       label: "In Edit",         dotColor: "bg-violet-500",   headerBg: "bg-violet-50 border-violet-200",  headerText: "text-violet-700" },
  { id: "ready_to_post", label: "Ready to Post",   dotColor: "bg-emerald-500",  headerBg: "bg-emerald-50 border-emerald-200",headerText: "text-emerald-700" },
  { id: "published",     label: "Published",       dotColor: "bg-green-600",    headerBg: "bg-green-50 border-green-200",    headerText: "text-green-700" },
];

const PLATFORM_TABS: { id: Platform | "all"; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { id: "all",      label: "All",      icon: <Film className="w-3.5 h-3.5" />,      color: "text-foreground/60",  activeColor: "bg-primary text-primary-foreground" },
  { id: "youtube",  label: "YouTube",  icon: <Youtube className="w-3.5 h-3.5" />,   color: "text-red-600",        activeColor: "bg-red-600 text-white" },
  { id: "meta",     label: "Meta",     icon: <Instagram className="w-3.5 h-3.5" />, color: "text-pink-600",       activeColor: "bg-gradient-to-r from-pink-500 to-purple-600 text-white" },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-3.5 h-3.5" />,  color: "text-sky-700",        activeColor: "bg-sky-700 text-white" },
  { id: "x",        label: "X",        icon: <Twitter className="w-3.5 h-3.5" />,   color: "text-foreground",     activeColor: "bg-foreground text-background" },
];

const TYPE_ICONS: Record<ScriptType, React.ReactNode> = {
  video:    <Video className="w-3 h-3" />,
  carousel: <LayoutGrid className="w-3 h-3" />,
  blog:     <FileText className="w-3 h-3" />,
  email:    <Mail className="w-3 h-3" />,
  reel:     <Clapperboard className="w-3 h-3" />,
};

const TYPE_BADGE: Record<ScriptType, string> = {
  video:    "bg-red-100 text-red-700 border border-red-200",
  carousel: "bg-pink-100 text-pink-700 border border-pink-200",
  blog:     "bg-blue-100 text-blue-700 border border-blue-200",
  email:    "bg-indigo-100 text-indigo-700 border border-indigo-200",
  reel:     "bg-orange-100 text-orange-700 border border-orange-200",
};

const PLATFORM_BADGE: Record<Platform, string> = {
  meta:     "bg-pink-50 text-pink-700 border border-pink-200",
  linkedin: "bg-sky-50 text-sky-700 border border-sky-200",
  x:        "bg-stone-100 text-stone-700 border border-stone-200",
  youtube:  "bg-red-50 text-red-700 border border-red-200",
  tiktok:   "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200",
  blog:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  all:      "bg-muted text-muted-foreground border border-border",
};

const GOAL_BADGE: Record<ContentGoal, string> = {
  audience_growth:     "bg-amber-50 text-amber-700 border border-amber-200",
  llm_seo:             "bg-teal-50 text-teal-700 border border-teal-200",
  community_engagement:"bg-purple-50 text-purple-700 border border-purple-200",
};

const GOAL_LABELS: Record<ContentGoal, string> = {
  audience_growth:     "Audience Growth",
  llm_seo:             "LLM SEO",
  community_engagement:"Community",
};

const NEXT_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  idea:          "scripted",
  scripted:      "in_production",
  in_production: "in_edit",
  in_edit:       "ready_to_post",
  ready_to_post: "published",
  published:     null,
};

const NEXT_STATUS_LABEL: Record<ProductionStatus, string> = {
  idea:          "Mark Scripted",
  scripted:      "Start Production",
  in_production: "Send to Edit",
  in_edit:       "Mark Ready",
  ready_to_post: "Mark Published",
  published:     "",
};

// ─── Script Card ─────────────────────────────────────────────────────────────

function ScriptCard({
  script,
  onAdvance,
  onEdit,
  onDelete,
}: {
  script: Script;
  onAdvance: (id: number, nextStatus: ProductionStatus) => void;
  onEdit: (script: Script) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const nextStatus = NEXT_STATUS[script.productionStatus];
  const nextLabel = NEXT_STATUS_LABEL[script.productionStatus];

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 hover:shadow-md hover:border-primary/30 transition-all group">
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2.5">
        {script.priority && (
          <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0 w-5 text-right">
            #{script.priority}
          </span>
        )}
        <button
          className="flex-1 text-left text-sm font-semibold text-foreground leading-snug hover:text-primary transition-colors font-serif"
          onClick={() => setExpanded(!expanded)}
        >
          {script.title}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${TYPE_BADGE[script.scriptType]}`}>
          {TYPE_ICONS[script.scriptType]}
          {script.scriptType}
        </span>
        {script.platform && script.platform !== "all" && (
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${PLATFORM_BADGE[script.platform]}`}>
            {script.platform}
          </span>
        )}
        {script.contentGoal && (
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${GOAL_BADGE[script.contentGoal]}`}>
            {GOAL_LABELS[script.contentGoal]}
          </span>
        )}
        {script.estimatedDurationMin && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
            <Clock className="w-3 h-3" />
            {script.estimatedDurationMin}m
          </span>
        )}
        {script.linkedContentItemId && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Link className="w-3 h-3" />
            Asset Created
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-2.5 border-t border-border pt-2.5">
          {script.competitorAngle && (
            <div className="flex items-start gap-1.5 bg-amber-50 rounded-lg p-2 border border-amber-100">
              <Target className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">{script.competitorAngle}</p>
            </div>
          )}
          {script.notes && (
            <div className="flex items-start gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{script.notes}</p>
            </div>
          )}
          {script.scriptBody && (
            <div className="bg-secondary/60 rounded-lg p-2.5 max-h-48 overflow-y-auto border border-border">
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono">
                {script.scriptBody.substring(0, 800)}{script.scriptBody.length > 800 ? "\n…" : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
        {nextStatus && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2"
            onClick={() => onAdvance(script.id, nextStatus)}
          >
            <ArrowRight className="w-3 h-3 mr-1" />
            {nextLabel}
          </Button>
        )}
        <div className="flex-1" />
        {script.linkedContentItemId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-sky-700 hover:text-sky-800 hover:bg-sky-50 px-2"
            onClick={() => window.location.href = `/?highlight=${script.linkedContentItemId}`}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View in Kanban
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => onEdit(script)}
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(script.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── New/Edit Script Dialog ───────────────────────────────────────────────────

function ScriptDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Script | null;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [scriptType, setScriptType] = useState<ScriptType>(initial?.scriptType ?? "video");
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? "youtube");
  const [contentGoal, setContentGoal] = useState<ContentGoal>(initial?.contentGoal ?? "audience_growth");
  const [productionStatus, setProductionStatus] = useState<ProductionStatus>(initial?.productionStatus ?? "idea");
  const [scriptBody, setScriptBody] = useState(initial?.scriptBody ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [estimatedDurationMin, setEstimatedDurationMin] = useState(initial?.estimatedDurationMin?.toString() ?? "");
  const [competitorAngle, setCompetitorAngle] = useState(initial?.competitorAngle ?? "");

  const createMutation = trpc.scripts.create.useMutation({
    onSuccess: () => { utils.scripts.list.invalidate(); toast.success("Script created"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.scripts.update.useMutation({
    onSuccess: () => { utils.scripts.list.invalidate(); toast.success("Script updated"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: title.trim(), scriptType, platform, contentGoal, productionStatus,
      scriptBody: scriptBody || undefined,
      notes: notes || undefined,
      estimatedDurationMin: estimatedDurationMin ? parseInt(estimatedDurationMin) : undefined,
      competitorAngle: competitorAngle || undefined,
    };
    if (initial) { updateMutation.mutate({ id: initial.id, ...payload }); }
    else { createMutation.mutate(payload); }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-foreground">{initial ? "Edit Script" : "New Script"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-medium">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The 2 AM Wake-Up: What Your Liver Is Trying to Tell You"
              className="bg-background border-border text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Type</label>
              <Select value={scriptType} onValueChange={(v) => setScriptType(v as ScriptType)}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["video", "carousel", "reel", "blog", "email"] as ScriptType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Platform</label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["youtube", "meta", "linkedin", "x", "tiktok", "blog", "all"] as Platform[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Content Goal</label>
              <Select value={contentGoal} onValueChange={(v) => setContentGoal(v as ContentGoal)}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="audience_growth">Audience Growth</SelectItem>
                  <SelectItem value="llm_seo">LLM SEO</SelectItem>
                  <SelectItem value="community_engagement">Community</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Status</label>
              <Select value={productionStatus} onValueChange={(v) => setProductionStatus(v as ProductionStatus)}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Duration (min)</label>
              <Input type="number" value={estimatedDurationMin} onChange={(e) => setEstimatedDurationMin(e.target.value)}
                placeholder="e.g. 15" className="bg-background border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Competitor Angle</label>
              <Input value={competitorAngle} onChange={(e) => setCompetitorAngle(e.target.value)}
                placeholder="What gap does this exploit?" className="bg-background border-border text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-medium">Script / Outline</label>
            <Textarea value={scriptBody} onChange={(e) => setScriptBody(e.target.value)}
              placeholder="Full script, slide-by-slide outline, or key talking points..."
              className="bg-background border-border text-foreground min-h-[160px] font-mono text-xs" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-medium">Production Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Director notes, voice model instructions, Canva template, etc."
              className="bg-background border-border text-foreground min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">Cancel</Button>
          <Button onClick={handleSave} disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isPending ? "Saving…" : initial ? "Save Changes" : "Create Script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScriptLibrary() {
  const utils = trpc.useUtils();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { data: allScripts = [], isLoading } = trpc.scripts.list.useQuery({});

  const advanceMutation = trpc.scripts.updateStatus.useMutation({
    onSuccess: () => utils.scripts.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.scripts.delete.useMutation({
    onSuccess: () => { utils.scripts.list.invalidate(); toast.success("Script deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const seedVideosMutation = trpc.scripts.seedVideos.useMutation({
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); },
    onError: (e) => toast.error(e.message),
  });

  const seedCarouselsMutation = trpc.scripts.seedCarousels.useMutation({
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); },
    onError: (e) => toast.error(e.message),
  });

  const seedHPMutation = trpc.scripts.seedHolisticPsychologist.useMutation({
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); },
    onError: (e) => toast.error(e.message),
  });

  const seedLinkedInMutation = trpc.scripts.seedLinkedIn.useMutation({
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); },
    onError: (e) => toast.error(e.message),
  });

  const seedXMutation = trpc.scripts.seedX.useMutation({
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); },
    onError: (e) => toast.error(e.message),
  });

  const handleAdvance = (id: number, nextStatus: ProductionStatus) => {
    advanceMutation.mutate({ id, productionStatus: nextStatus });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this script?")) return;
    deleteMutation.mutate({ id });
  };

  const handleSeedAll = async () => {
    setSeeding(true);
    try {
      await seedVideosMutation.mutateAsync();
      await seedCarouselsMutation.mutateAsync();
      await seedHPMutation.mutateAsync();
      await seedLinkedInMutation.mutateAsync();
      await seedXMutation.mutateAsync();
    } finally {
      setSeeding(false);
    }
  };

  // Filter by platform
  const filteredScripts = platformFilter === "all"
    ? allScripts
    : allScripts.filter((s) => s.platform === platformFilter);

  // Group by status
  const scriptsByStatus = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredScripts.filter((s) => s.productionStatus === col.id);
    return acc;
  }, {} as Record<ProductionStatus, Script[]>);

  const countForPlatform = (p: Platform | "all") =>
    p === "all" ? allScripts.length : allScripts.filter((s) => s.platform === p).length;

  const readyCount = scriptsByStatus["ready_to_post"]?.length ?? 0;
  const publishedCount = scriptsByStatus["published"]?.length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Film className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif text-foreground">Script Library</h1>
              <p className="text-xs text-muted-foreground">Production pipeline — write it, record it, publish it</p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2 ml-4">
            <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {readyCount} ready to post
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
              {publishedCount} published
            </span>
          </div>

          <div className="flex-1" />

          {allScripts.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedAll}
              disabled={seeding}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Seeding…" : "Seed 40 Scripts"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => { setEditingScript(null); setShowDialog(true); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Script
          </Button>
        </div>

        {/* ── Platform Tabs ─────────────────────────────────────────────── */}
        <div className="max-w-[1600px] mx-auto px-6 pb-3 flex items-center gap-2 overflow-x-auto">
          {PLATFORM_TABS.map((tab) => {
            const count = countForPlatform(tab.id);
            const isActive = platformFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPlatformFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? tab.activeColor + " shadow-sm"
                    : "bg-muted/60 hover:bg-muted " + tab.color
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`ml-0.5 font-mono ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pipeline Board ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading scripts…</span>
          </div>
        </div>
      ) : allScripts.length === 0 ? (
        /* Empty state */
        <div className="max-w-lg mx-auto mt-24 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold font-serif text-foreground mb-2">No scripts yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Seed the library with 40 pre-built scripts — 20 priority YouTube videos and 20 Instagram carousel outlines — or create your own.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={handleSeedAll}
              disabled={seeding}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Seeding all platforms…" : "Seed All 80 Scripts (All Platforms)"}
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={() => seedVideosMutation.mutate()} disabled={seedVideosMutation.isPending} className="text-red-700 border-red-200 hover:bg-red-50">
                <Youtube className="w-3.5 h-3.5 mr-1.5" /> YouTube (20 videos)
              </Button>
              <Button size="sm" variant="outline" onClick={() => seedCarouselsMutation.mutate()} disabled={seedCarouselsMutation.isPending} className="text-pink-700 border-pink-200 hover:bg-pink-50">
                <Instagram className="w-3.5 h-3.5 mr-1.5" /> Meta Carousels (20)
              </Button>
              <Button size="sm" variant="outline" onClick={() => seedHPMutation.mutate()} disabled={seedHPMutation.isPending} className="text-purple-700 border-purple-200 hover:bg-purple-50">
                <Instagram className="w-3.5 h-3.5 mr-1.5" /> Holistic Psych Style (20)
              </Button>
              <Button size="sm" variant="outline" onClick={() => seedLinkedInMutation.mutate()} disabled={seedLinkedInMutation.isPending} className="text-sky-700 border-sky-200 hover:bg-sky-50">
                <Linkedin className="w-3.5 h-3.5 mr-1.5" /> LinkedIn (10)
              </Button>
              <Button size="sm" variant="outline" onClick={() => seedXMutation.mutate()} disabled={seedXMutation.isPending} className="text-foreground border-border hover:bg-muted">
                <Twitter className="w-3.5 h-3.5 mr-1.5" /> X Threads (10)
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditingScript(null); setShowDialog(true); }}
              className="text-muted-foreground mt-1"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Manually
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto px-4 py-6 overflow-x-auto pb-8">
          {/* Platform context label */}
          {platformFilter !== "all" && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground capitalize">{platformFilter}</span>
              <span className="text-sm text-muted-foreground">— {filteredScripts.length} script{filteredScripts.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          <div className="flex gap-4 min-w-[1100px]">
            {STATUS_COLUMNS.map((col) => {
              const colScripts = scriptsByStatus[col.id] ?? [];
              return (
                <div key={col.id} className="flex-1 min-w-[175px]">
                  {/* Column header */}
                  <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-xl border ${col.headerBg}`}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                      <span className={`text-xs font-bold uppercase tracking-wide ${col.headerText}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className={`text-xs font-mono font-semibold ${col.headerText} opacity-70`}>
                      {colScripts.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5">
                    {colScripts.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground/60">Empty</p>
                      </div>
                    ) : (
                      colScripts.map((script) => (
                        <ScriptCard
                          key={script.id}
                          script={script as Script}
                          onAdvance={handleAdvance}
                          onEdit={(s) => { setEditingScript(s); setShowDialog(true); }}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog */}
      <ScriptDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditingScript(null); }}
        initial={editingScript}
      />
    </div>
  );
}
