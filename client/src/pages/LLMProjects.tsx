import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Plus, Trash2, ChevronRight, Sparkles, FileText, Youtube,
  BookOpen, Share2, Mail, CheckCircle2, Clock, Zap, Target,
  BarChart3, ArrowLeft, RefreshCw, ExternalLink, Globe
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type AssetType = "faq" | "youtube" | "blog" | "social" | "email";
type AssetStatus = "queued" | "in_progress" | "produced" | "published";
type Priority = "high" | "medium" | "low";

const ASSET_ICONS: Record<AssetType, React.ReactNode> = {
  faq: <FileText className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
  blog: <BookOpen className="w-4 h-4" />,
  social: <Share2 className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
};

const ASSET_LABELS: Record<AssetType, string> = {
  faq: "FAQ Article",
  youtube: "YouTube Video",
  blog: "Blog Post",
  social: "Social Thread",
  email: "Email",
};

const STATUS_BADGE: Record<AssetStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  produced: "bg-blue-100 text-blue-700 border-blue-200",
  published: "bg-green-100 text-green-700 border-green-200",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground border-border",
};

const STATUS_ROW_BG: Record<AssetStatus, string> = {
  queued: "border-border bg-card hover:border-primary/30",
  in_progress: "border-amber-200 bg-amber-50/50",
  produced: "border-blue-200 bg-blue-50/50",
  published: "border-green-200 bg-green-50/40",
};
// ─── Mark as Published Dialog ───────────────────────────────────────────────
function MarkPublishedDialog({
  assetId,
  assetTitle,
  onPublished,
}: {
  assetId: number;
  assetTitle: string;
  onPublished: (id: number, url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const handleConfirm = () => {
    // Basic URL validation
    if (!url.trim()) {
      setUrlError("Please enter the live URL");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      setUrlError("Please enter a valid URL (e.g. https://theurbanmonk.com/...)");
      return;
    }
    setUrlError("");
    onPublished(assetId, url.trim());
    setOpen(false);
    setUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setUrl(""); setUrlError(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"
          className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50">
          <Globe className="w-3 h-3 mr-1" /> Mark Published
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-600" />
            Mark as Published
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-muted/40 p-3 border border-border">
            <p className="text-sm font-medium text-foreground line-clamp-2">{assetTitle}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="published-url" className="text-sm font-medium">
              Live URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="published-url"
              placeholder="https://theurbanmonk.com/your-article"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className={urlError ? "border-destructive" : ""}
            />
            {urlError && (
              <p className="text-xs text-destructive">{urlError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Paste the URL where this content is live. This will be saved and shown in your asset queue.
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm Published
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Project Dialog ─────────────────────────────────────────────────────
function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topicCluster, setTopicCluster] = useState("");
  const [keywords, setKeywords] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("3");

  const createMutation = trpc.llmProjects.createProject.useMutation({
    onSuccess: () => {
      toast.success("Project created");
      setOpen(false);
      setName(""); setDescription(""); setTopicCluster(""); setKeywords("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create LLM Visibility Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Project Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sleep & Recovery Authority" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Topic Cluster</label>
            <Input value={topicCluster} onChange={(e) => setTopicCluster(e.target.value)}
              placeholder="e.g., sleep optimization, circadian rhythm, insomnia" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What LLM questions should Dr. Shojai own in this space?" rows={3}
              className="resize-none" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Target Keywords (comma-separated)</label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)}
              placeholder="how to sleep better, sleep hygiene, deep sleep tips" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Weekly Production Target</label>
            <Select value={weeklyTarget} onValueChange={setWeeklyTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,7,10].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} asset{n > 1 ? "s" : ""}/week</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => createMutation.mutate({
            name, description, topicCluster,
            targetKeywords: keywords ? keywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
            weeklyTarget: parseInt(weeklyTarget),
          })} disabled={!name || createMutation.isPending} className="w-full">
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generate Queue Dialog ─────────────────────────────────────────────────
function GenerateQueueDialog({ projectId, topicCluster, onGenerated }: {
  projectId: number; topicCluster: string; onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("25");
  const [types, setTypes] = useState<AssetType[]>(["faq", "youtube", "blog", "social"]);

  const generateMutation = trpc.llmProjects.generateQueue.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.generated} assets for your queue`);
      setOpen(false);
      onGenerated();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleType = (t: AssetType) =>
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" /> AI Generate Queue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Asset Queue with AI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            AI will generate a prioritized production queue for <strong className="text-foreground">"{topicCluster}"</strong> — covering every question Dr. Shojai should own in LLM engines.
          </p>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Asset Types to Include</label>
            <div className="flex flex-wrap gap-2">
              {(["faq", "youtube", "blog", "social", "email"] as AssetType[]).map(t => (
                <button key={t} onClick={() => toggleType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    types.includes(t)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}>
                  {ASSET_ICONS[t]} {ASSET_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Number of Assets to Generate</label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 15, 20, 25, 30, 40].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} assets</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => generateMutation.mutate({
            projectId, topicCluster, assetTypes: types, count: parseInt(count),
          })} disabled={types.length === 0 || generateMutation.isPending} className="w-full">
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Generating queue...</span>
            ) : `Generate ${count} Assets`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Asset Dialog ─────────────────────────────────────────────────────
function AddAssetDialog({ projectId, onAdded }: { projectId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [assetType, setAssetType] = useState<AssetType>("faq");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [notes, setNotes] = useState("");

  const addMutation = trpc.llmProjects.addAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset added to queue");
      setOpen(false);
      setTitle(""); setQuestion(""); setTargetKeyword(""); setNotes("");
      onAdded();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Add Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Asset to Queue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Asset Type</label>
            <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["faq", "youtube", "blog", "social", "email"] as AssetType[]).map(t => (
                  <SelectItem key={t} value={t}>{ASSET_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Why You Wake Up at 3am (And How to Stop)" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Question Being Answered</label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Why do I keep waking up in the middle of the night?" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Target Keyword</label>
            <Input value={targetKeyword} onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g., why can't I sleep at night" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Production Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Angle, emphasis, CTA, tone notes..." rows={2}
              className="resize-none" />
          </div>
          <Button onClick={() => addMutation.mutate({
            projectId, assetType, title, priority,
            question: question || undefined,
            targetKeyword: targetKeyword || undefined,
            notes: notes || undefined,
          })} disabled={!title || addMutation.isPending} className="w-full">
            {addMutation.isPending ? "Adding..." : "Add to Queue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Asset Row ─────────────────────────────────────────────────────────────
function AssetRow({ asset, onStatusChange, onPublish, onDelete, onLaunch }: {
  asset: {
    id: number; assetType: string; title: string; question?: string | null;
    targetKeyword?: string | null; priority: string; status: string; notes?: string | null;
    semanticKeywords?: string | null; publishedUrl?: string | null;
  };
  onStatusChange: (id: number, status: AssetStatus) => void;
  onPublish: (id: number, url: string) => void;
  onDelete: (id: number) => void;
  onLaunch: (asset: { assetType: string; title: string; question?: string | null; targetKeyword?: string | null; notes?: string | null; semanticKeywords?: string | null; id: number; priority: string; status: string }) => void;
}) {
  const type = asset.assetType as AssetType;
  const status = asset.status as AssetStatus;
  const priority = asset.priority as Priority;

  // For queued → in_progress → produced, use simple status change.
  // For produced → published, use the MarkPublishedDialog (URL required).
  const simpleNextStatus: Record<AssetStatus, AssetStatus | null> = {
    queued: "in_progress",
    in_progress: "produced",
    produced: null, // handled by MarkPublishedDialog
    published: null,
  };

  const simpleNextLabel: Record<AssetStatus, string> = {
    queued: "Start",
    in_progress: "Mark Produced",
    produced: "",
    published: "",
  };

  return (
    <div className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${STATUS_ROW_BG[status]}`}>
      {/* Type icon */}
      <div className="mt-0.5 text-muted-foreground flex-shrink-0">{ASSET_ICONS[type]}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium leading-snug ${
                status === "published" ? "text-green-700" : "text-foreground"
              }`}>{asset.title}</p>
              {status === "published" && asset.publishedUrl && (
                <a
                  href={asset.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 text-green-600 hover:text-green-700"
                  title="View live"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {asset.question && (
              <p className="text-xs text-muted-foreground mt-0.5 italic">"{asset.question}"</p>
            )}
            {asset.targetKeyword && (
              <p className="text-xs text-primary/70 mt-0.5">🎯 {asset.targetKeyword}</p>
            )}
            {status === "published" && asset.publishedUrl && (
              <a
                href={asset.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:text-green-700 hover:underline mt-0.5 block truncate"
              >
                {asset.publishedUrl}
              </a>
            )}
            {asset.notes && status !== "published" && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{asset.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[priority]}`}>
              {priority}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[status]}`}>
              {status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{ASSET_LABELS[type]}</span>
          <div className="flex-1" />
          {status !== "published" && (
            <Button size="sm" variant="ghost"
              onClick={() => onLaunch(asset)}
              className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10">
              <Zap className="w-3 h-3 mr-1" /> Create in Studio
            </Button>
          )}
          {/* Simple status advance (queued → in_progress → produced) */}
          {simpleNextStatus[status] && (
            <Button size="sm" variant="ghost"
              onClick={() => onStatusChange(asset.id, simpleNextStatus[status]!)}
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {simpleNextLabel[status]}
            </Button>
          )}
          {/* Mark Published dialog (produced → published, requires URL) */}
          {status === "produced" && (
            <MarkPublishedDialog
              assetId={asset.id}
              assetTitle={asset.title}
              onPublished={onPublish}
            />
          )}
          <Button size="sm" variant="ghost"
            onClick={() => onDelete(asset.id)}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Detail View ───────────────────────────────────────────────────
function ProjectDetail({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const [statusFilter, setStatusFilter] = useState<"all" | AssetStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");
  const utils = trpc.useUtils();

  const { data: project } = trpc.llmProjects.getProject.useQuery({ id: projectId });
  const { data: assets = [], isLoading } = trpc.llmProjects.listAssets.useQuery({
    projectId,
    status: statusFilter as "all" | AssetStatus,
    assetType: typeFilter as "all" | AssetType,
  });
  const { data: cadence } = trpc.llmProjects.getWeeklyCadence.useQuery({ projectId });

  const updateStatusMutation = trpc.llmProjects.updateAssetStatus.useMutation({
    onSuccess: () => {
      utils.llmProjects.listAssets.invalidate();
      utils.llmProjects.getWeeklyCadence.invalidate();
      utils.llmProjects.getAllProjectsCadence.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = trpc.llmProjects.updateAssetStatus.useMutation({
    onSuccess: () => {
      utils.llmProjects.listAssets.invalidate();
      utils.llmProjects.getWeeklyCadence.invalidate();
      utils.llmProjects.getAllProjectsCadence.invalidate();
      toast.success("✅ Asset marked as published!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePublish = (id: number, url: string) => {
    publishMutation.mutate({ id, status: "published", publishedUrl: url });
  };

  const deleteAssetMutation = trpc.llmProjects.deleteAsset.useMutation({
    onSuccess: () => utils.llmProjects.listAssets.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const handleLaunch = (asset: { assetType: string; title: string; question?: string | null; targetKeyword?: string | null }) => {
    const params = new URLSearchParams({
      source: "llm_project",
      type: asset.assetType,
      title: asset.title,
      keyword: asset.targetKeyword ?? "",
      question: asset.question ?? "",
    });
    window.location.href = `/studio?${params.toString()}`;
  };

  const queuedCount = assets.filter(a => a.status === "queued").length;
  const inProgressCount = assets.filter(a => a.status === "in_progress").length;
  const producedCount = assets.filter(a => a.status === "produced" || a.status === "published").length;
  const totalCount = assets.length;
  const progressPct = totalCount > 0 ? Math.round((producedCount / totalCount) * 100) : 0;

  if (!project) return null;

  const topicCluster = project.topicCluster ?? project.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-1 px-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">{project.name}</h2>
          {project.topicCluster && (
            <p className="text-xs text-primary/70 mt-0.5">{project.topicCluster}</p>
          )}
          {project.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <GenerateQueueDialog
            projectId={projectId}
            topicCluster={topicCluster}
            onGenerated={() => utils.llmProjects.listAssets.invalidate()}
          />
          <AddAssetDialog
            projectId={projectId}
            onAdded={() => utils.llmProjects.listAssets.invalidate()}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{queuedCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> In Queue
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">{inProgressCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Zap className="w-3 h-3" /> In Progress
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{producedCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Produced
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {cadence?.weeksToComplete ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Target className="w-3 h-3" /> Weeks to Complete
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly cadence */}
      {cadence && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">This Week's Progress</span>
              <span className="text-sm font-medium text-foreground">
                {cadence.producedThisWeek} / {cadence.weeklyTarget} assets
              </span>
            </div>
            <Progress
              value={Math.min(100, (cadence.producedThisWeek / cadence.weeklyTarget) * 100)}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              At {cadence.weeklyTarget} assets/week, you'll complete this queue in ~{cadence.weeksToComplete} weeks
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overall progress */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={progressPct} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground flex-shrink-0">{progressPct}% complete</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "queued", "in_progress", "produced", "published"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}>
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {(["all", "faq", "youtube", "blog", "social", "email"] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${
              typeFilter === t
                ? "bg-secondary text-secondary-foreground border-secondary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}>
            {t !== "all" && ASSET_ICONS[t as AssetType]}
            {t === "all" ? "All Types" : ASSET_LABELS[t as AssetType]}
          </button>
        ))}
      </div>

      {/* Asset list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading queue...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No assets in queue yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Use "AI Generate Queue" to auto-fill 20–40 prioritized assets, or add them manually.
          </p>
          <GenerateQueueDialog
            projectId={projectId}
            topicCluster={topicCluster}
            onGenerated={() => utils.llmProjects.listAssets.invalidate()}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
              onPublish={handlePublish}
              onDelete={(id) => deleteAssetMutation.mutate({ id })}
              onLaunch={handleLaunch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Project Card ──────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onDelete }: {
  project: {
    id: number; name: string; description?: string | null; topicCluster?: string | null;
    status: string | null; weeklyTarget: number | null; totalAssets: number; producedAssets: number;
  };
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const progressPct = project.totalAssets > 0
    ? Math.round((project.producedAssets / project.totalAssets) * 100) : 0;
  const remaining = project.totalAssets - project.producedAssets;
  const weeksLeft = remaining > 0 && project.weeklyTarget
    ? Math.ceil(remaining / project.weeklyTarget) : 0;

  return (
    <Card
      className={`hover:border-primary/40 transition-colors cursor-pointer group ${
        project.status === "archived" ? "opacity-50" : ""
      }`}
      onClick={() => onOpen(project.id)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {project.name}
            </h3>
            {project.topicCluster && (
              <p className="text-xs text-primary/70 mt-0.5 truncate">{project.topicCluster}</p>
            )}
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button size="sm" variant="ghost"
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{project.totalAssets}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{project.producedAssets}</div>
            <div className="text-xs text-muted-foreground">Done</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-600">{remaining}</div>
            <div className="text-xs text-muted-foreground">Queue</div>
          </div>
        </div>

        {/* Progress bar */}
        {project.totalAssets > 0 && (
          <div>
            <Progress value={progressPct} className="h-1.5" />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{progressPct}% complete</span>
              {weeksLeft > 0 && (
                <span className="text-xs text-muted-foreground">~{weeksLeft}w at {project.weeklyTarget}/wk</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
// ─── Cross-Project Cadence Strip ─────────────────────────────────────────────
function WeeklyCadenceStrip() {
  const { data: cadences = [] } = trpc.llmProjects.getAllProjectsCadence.useQuery();

  if (cadences.length === 0) return null;

  const totalThisWeek = cadences.reduce((s, c) => s + c.producedThisWeek, 0);
  const totalTarget = cadences.reduce((s, c) => s + c.weeklyTarget, 0);
  const onTrackCount = cadences.filter(c => c.onTrack).length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">This Week's Production</span>
          <span className="text-xs text-muted-foreground">across all projects</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{totalThisWeek} / {totalTarget}</span>
          <span className="text-xs text-muted-foreground">assets</span>
          {onTrackCount === cadences.length ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">All on track</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{onTrackCount}/{cadences.length} on track</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cadences.map((c) => {
          const pct = Math.min(100, Math.round((c.producedThisWeek / c.weeklyTarget) * 100));
          return (
            <div key={c.projectId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground truncate">{c.projectName}</span>
                  <span className={`text-xs flex-shrink-0 ml-1 font-medium ${
                    c.onTrack ? "text-green-600" : "text-amber-600"
                  }`}>{c.producedThisWeek}/{c.weeklyTarget}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
              {c.onTrack ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LLMProjects() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: projects = [], isLoading } = trpc.llmProjects.listProjects.useQuery();

  const deleteMutation = trpc.llmProjects.deleteProject.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      utils.llmProjects.listProjects.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (selectedProjectId !== null) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <ProjectDetail
            projectId={selectedProjectId}
            onBack={() => setSelectedProjectId(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              LLM Visibility Projects
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build Dr. Shojai's authority in AI engines — one topic cluster at a time.
              Each project is a production queue of FAQs, videos, blogs, and social content
              designed to make him the cited source for every question in that space.
            </p>
          </div>
          <CreateProjectDialog onCreated={() => utils.llmProjects.listProjects.invalidate()} />
        </div>

        {/* Cross-project weekly cadence */}
        <WeeklyCadenceStrip />

        {/* Summary stats */}
        {projects.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{projects.length}</div>
                  <div className="text-xs text-muted-foreground">Active Projects</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">
                    {projects.reduce((s, p) => s + (p.totalAssets - p.producedAssets), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Assets in Queue</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">
                    {projects.reduce((s, p) => s + p.producedAssets, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Assets Produced</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Project grid */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No LLM Projects Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Create your first project to start building Dr. Shojai's authority in AI engines.
              Each project covers a topic cluster — sleep, gut health, energy, stress — with a
              full production queue of FAQs, videos, and blogs to work through over time.
            </p>
            <CreateProjectDialog onCreated={() => utils.llmProjects.listProjects.invalidate()} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={setSelectedProjectId}
                onDelete={(id) => deleteMutation.mutate({ id })}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
