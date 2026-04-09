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
  Zap,
  BookOpen,
  Video,
  RefreshCw,
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

const STATUS_COLUMNS: { id: ProductionStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { id: "idea", label: "Idea", color: "text-slate-400", bgColor: "bg-slate-900/60", borderColor: "border-slate-700" },
  { id: "scripted", label: "Scripted", color: "text-blue-400", bgColor: "bg-blue-950/40", borderColor: "border-blue-800" },
  { id: "in_production", label: "In Production", color: "text-amber-400", bgColor: "bg-amber-950/40", borderColor: "border-amber-800" },
  { id: "in_edit", label: "In Edit", color: "text-purple-400", bgColor: "bg-purple-950/40", borderColor: "border-purple-800" },
  { id: "ready_to_post", label: "Ready to Post", color: "text-emerald-400", bgColor: "bg-emerald-950/40", borderColor: "border-emerald-800" },
  { id: "published", label: "Published", color: "text-green-400", bgColor: "bg-green-950/40", borderColor: "border-green-800" },
];

const TYPE_ICONS: Record<ScriptType, React.ReactNode> = {
  video: <Video className="w-3.5 h-3.5" />,
  carousel: <LayoutGrid className="w-3.5 h-3.5" />,
  blog: <FileText className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  reel: <Clapperboard className="w-3.5 h-3.5" />,
};

const TYPE_COLORS: Record<ScriptType, string> = {
  video: "bg-red-900/50 text-red-300 border-red-800",
  carousel: "bg-pink-900/50 text-pink-300 border-pink-800",
  blog: "bg-blue-900/50 text-blue-300 border-blue-800",
  email: "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  reel: "bg-orange-900/50 text-orange-300 border-orange-800",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: "bg-blue-900/50 text-blue-300",
  linkedin: "bg-sky-900/50 text-sky-300",
  x: "bg-slate-800/80 text-slate-300",
  youtube: "bg-red-900/50 text-red-300",
  tiktok: "bg-fuchsia-900/50 text-fuchsia-300",
  blog: "bg-emerald-900/50 text-emerald-300",
  all: "bg-slate-800/50 text-slate-400",
};

const GOAL_LABELS: Record<ContentGoal, string> = {
  audience_growth: "Audience Growth",
  llm_seo: "LLM SEO",
  community_engagement: "Community",
};

const NEXT_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  idea: "scripted",
  scripted: "in_production",
  in_production: "in_edit",
  in_edit: "ready_to_post",
  ready_to_post: "published",
  published: null,
};

const NEXT_STATUS_LABEL: Record<ProductionStatus, string> = {
  idea: "Mark Scripted",
  scripted: "Start Production",
  in_production: "Send to Edit",
  in_edit: "Mark Ready",
  ready_to_post: "Mark Published",
  published: "",
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
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 hover:border-slate-600 transition-all group">
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        {script.priority && (
          <span className="text-xs font-mono text-slate-500 mt-0.5 shrink-0">#{script.priority}</span>
        )}
        <button
          className="flex-1 text-left text-sm font-medium text-white leading-snug hover:text-amber-300 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {script.title}
        </button>
        <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${TYPE_COLORS[script.scriptType]}`}>
          {TYPE_ICONS[script.scriptType]}
          {script.scriptType}
        </span>
        {script.platform && script.platform !== "all" && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${PLATFORM_COLORS[script.platform]}`}>
            {script.platform}
          </span>
        )}
        {script.contentGoal && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">
            {GOAL_LABELS[script.contentGoal]}
          </span>
        )}
        {script.estimatedDurationMin && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
            <Clock className="w-3 h-3" />
            {script.estimatedDurationMin}m
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-slate-700/60 pt-2">
          {script.competitorAngle && (
            <div className="flex items-start gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200/80">{script.competitorAngle}</p>
            </div>
          )}
          {script.notes && (
            <div className="flex items-start gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">{script.notes}</p>
            </div>
          )}
          {script.scriptBody && (
            <div className="bg-slate-900/60 rounded p-2 max-h-40 overflow-y-auto">
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{script.scriptBody.substring(0, 600)}{script.scriptBody.length > 600 ? "…" : ""}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-700/40 opacity-0 group-hover:opacity-100 transition-opacity">
        {nextStatus && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 px-2"
            onClick={() => onAdvance(script.id, nextStatus)}
          >
            <ArrowRight className="w-3 h-3 mr-1" />
            {nextLabel}
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
          onClick={() => onEdit(script)}
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
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
    onSuccess: () => {
      utils.scripts.list.invalidate();
      toast.success("Script created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.scripts.update.useMutation({
    onSuccess: () => {
      utils.scripts.list.invalidate();
      toast.success("Script updated");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: title.trim(),
      scriptType,
      platform,
      contentGoal,
      productionStatus,
      scriptBody: scriptBody || undefined,
      notes: notes || undefined,
      estimatedDurationMin: estimatedDurationMin ? parseInt(estimatedDurationMin) : undefined,
      competitorAngle: competitorAngle || undefined,
    };
    if (initial) {
      updateMutation.mutate({ id: initial.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{initial ? "Edit Script" : "New Script"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The 2 AM Wake-Up: What Your Liver Is Trying to Tell You"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <Select value={scriptType} onValueChange={(v) => setScriptType(v as ScriptType)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(["video", "carousel", "blog", "email", "reel"] as ScriptType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Platform</label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(["youtube", "meta", "linkedin", "x", "tiktok", "blog", "all"] as Platform[]).map((p) => (
                    <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Content Goal</label>
              <Select value={contentGoal} onValueChange={(v) => setContentGoal(v as ContentGoal)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="audience_growth" className="text-white">Audience Growth</SelectItem>
                  <SelectItem value="llm_seo" className="text-white">LLM SEO</SelectItem>
                  <SelectItem value="community_engagement" className="text-white">Community</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Status</label>
              <Select value={productionStatus} onValueChange={(v) => setProductionStatus(v as ProductionStatus)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {STATUS_COLUMNS.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-white">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Duration (min)</label>
              <Input
                type="number"
                value={estimatedDurationMin}
                onChange={(e) => setEstimatedDurationMin(e.target.value)}
                placeholder="e.g. 15"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Competitor Angle</label>
              <Input
                value={competitorAngle}
                onChange={(e) => setCompetitorAngle(e.target.value)}
                placeholder="What gap does this exploit?"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Script / Outline</label>
            <Textarea
              value={scriptBody}
              onChange={(e) => setScriptBody(e.target.value)}
              placeholder="Full script, slide-by-slide outline, or key talking points..."
              className="bg-slate-800 border-slate-600 text-white min-h-[140px] font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Production Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Director notes, voice model instructions, Canva template, etc."
              className="bg-slate-800 border-slate-600 text-white min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
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
  const [typeFilter, setTypeFilter] = useState<ScriptType | "all">("all");
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
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); setSeeding(false); },
    onError: (e) => { toast.error(e.message); setSeeding(false); },
  });

  const seedCarouselsMutation = trpc.scripts.seedCarousels.useMutation({
    onSuccess: (r) => { utils.scripts.list.invalidate(); toast.success(r.message); setSeeding(false); },
    onError: (e) => { toast.error(e.message); setSeeding(false); },
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
    await seedVideosMutation.mutateAsync();
    await seedCarouselsMutation.mutateAsync();
    setSeeding(false);
  };

  const filteredScripts = typeFilter === "all"
    ? allScripts
    : allScripts.filter((s) => s.scriptType === typeFilter);

  const scriptsByStatus = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredScripts.filter((s) => s.productionStatus === col.id);
    return acc;
  }, {} as Record<ProductionStatus, Script[]>);

  const totalByType = (type: ScriptType) => allScripts.filter((s) => s.scriptType === type).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-600/40 flex items-center justify-center">
              <Film className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Script Library</h1>
              <p className="text-xs text-slate-400">Production pipeline for all content assets</p>
            </div>
          </div>
          <div className="flex-1" />
          {allScripts.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedAll}
              disabled={seeding}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Seeding…" : "Seed 40 Scripts"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => { setEditingScript(null); setShowDialog(true); }}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Script
          </Button>
        </div>

        {/* Type filter tabs */}
        <div className="max-w-[1600px] mx-auto px-6 pb-3 flex items-center gap-2">
          {(["all", "video", "carousel", "blog", "email", "reel"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                typeFilter === t
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              {t !== "all" && TYPE_ICONS[t as ScriptType]}
              {t === "all" ? `All (${allScripts.length})` : `${t} (${totalByType(t as ScriptType)})`}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading scripts…</div>
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto px-4 py-6 overflow-x-auto">
          <div className="flex gap-4 min-w-[1200px]">
            {STATUS_COLUMNS.map((col) => {
              const colScripts = scriptsByStatus[col.id] ?? [];
              return (
                <div key={col.id} className="flex-1 min-w-[180px]">
                  {/* Column header */}
                  <div className={`flex items-center justify-between mb-3 px-2 py-1.5 rounded-lg ${col.bgColor} border ${col.borderColor}`}>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>
                      {col.label}
                    </span>
                    <span className={`text-xs font-mono ${col.color} opacity-70`}>
                      {colScripts.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {colScripts.length === 0 ? (
                      <div className="border border-dashed border-slate-700/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-600">No scripts here</p>
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

      {/* Stats bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 px-6 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center gap-6">
          <div className="flex items-center gap-4">
            {STATUS_COLUMNS.map((col) => (
              <div key={col.id} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${col.color.replace("text-", "bg-")}`} />
                <span className="text-xs text-slate-400">{col.label}: <span className="text-white font-mono">{scriptsByStatus[col.id]?.length ?? 0}</span></span>
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-slate-400">
              <span className="text-white font-mono">{scriptsByStatus["ready_to_post"]?.length ?? 0}</span> ready to post
            </span>
          </div>
        </div>
      </div>

      {/* Dialog */}
      {showDialog && (
        <ScriptDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditingScript(null); }}
          initial={editingScript}
        />
      )}
    </div>
  );
}
