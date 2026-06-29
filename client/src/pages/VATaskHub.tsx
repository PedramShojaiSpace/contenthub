/**
 * VATaskHub.tsx — Comprehensive VA Task Management for Jim and the team
 * Covers: Medium, Quora, YouTube, SEO, Reddit, Backlinks, Reviews,
 * Testimonials, Google Business, Substack, Title Cards, Influencer Outreach,
 * LinkedIn, Podcast Outreach, Doctor Burnout, Dentist, Executive Outreach.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, CheckSquare, Clock, AlertCircle, XCircle, Loader2,
  Sparkles, ExternalLink, Pencil, Trash2, ChevronDown, ChevronRight,
  RefreshCw, Filter, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type TaskStatus = "todo" | "in_progress" | "needs_review" | "done" | "blocked";
type TaskPriority = "high" | "medium" | "low";
type TaskCategory =
  | "content_distribution" | "seo_authority" | "community_engagement"
  | "influencer_outreach" | "professional_outreach" | "podcast_outreach"
  | "reputation" | "video_strategy";
type TaskChannel =
  | "medium" | "quora" | "youtube_comments" | "youtube_channel"
  | "seo_blog" | "ai_video" | "backlink" | "reddit"
  | "google_reviews" | "amazon_reviews" | "video_testimonial" | "google_business"
  | "substack" | "title_card" | "influencer_shopify" | "influencer_youtube"
  | "influencer_meta" | "linkedin" | "podcast_guest" | "podcast_host"
  | "doctor_burnout" | "dentist" | "executive" | "other";

interface Task {
  id: number;
  category: TaskCategory;
  channel: TaskChannel;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: string;
  dueDate: number | null;
  aiDraft: string | null;
  notes: string | null;
  publishedUrl: string | null;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  content_distribution: "Content Distribution",
  seo_authority: "SEO & Authority",
  community_engagement: "Community Engagement",
  influencer_outreach: "Influencer Outreach",
  professional_outreach: "Professional Outreach",
  podcast_outreach: "Podcast Outreach",
  reputation: "Reputation & Reviews",
  video_strategy: "Video Strategy",
};

const CHANNEL_LABELS: Record<TaskChannel, string> = {
  medium: "Medium", quora: "Quora", youtube_comments: "YT Comments",
  youtube_channel: "YT Channel Org", seo_blog: "SEO Blog", ai_video: "AI Video",
  backlink: "Backlink Outreach", reddit: "Reddit", google_reviews: "Google Reviews",
  amazon_reviews: "Amazon Reviews", video_testimonial: "Video Testimonial",
  google_business: "Google Business", substack: "Substack", title_card: "Title Card Strategy",
  influencer_shopify: "Influencer (Shopify)", influencer_youtube: "Influencer (YouTube)",
  influencer_meta: "Influencer (Meta)", linkedin: "LinkedIn",
  podcast_guest: "Podcast Guest", podcast_host: "Podcast Host",
  doctor_burnout: "Doctor Burnout", dentist: "Dentist Outreach",
  executive: "Executive Outreach", other: "Other",
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  todo: { label: "To Do", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Loader2 },
  needs_review: { label: "Needs Review", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
  done: { label: "Done", color: "bg-green-100 text-green-700 border-green-200", icon: CheckSquare },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "High", color: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  content_distribution: "border-l-violet-500",
  seo_authority: "border-l-blue-500",
  community_engagement: "border-l-green-500",
  influencer_outreach: "border-l-pink-500",
  professional_outreach: "border-l-orange-500",
  podcast_outreach: "border-l-teal-500",
  reputation: "border-l-yellow-500",
  video_strategy: "border-l-red-500",
};

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: TaskStatus) => void;
}) {
  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const StatusIcon = statusCfg.icon;
  const borderColor = CATEGORY_COLORS[task.category];

  return (
    <div className={`bg-white border border-border rounded-lg p-4 border-l-4 ${borderColor} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground leading-snug">{task.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{CHANNEL_LABELS[task.channel]}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
          <SelectTrigger className={`h-6 text-xs px-2 py-0 border rounded-full w-auto ${statusCfg.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityCfg.color}`}>
          {priorityCfg.label}
        </span>

        {task.isRecurring && (
          <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" />{task.recurrenceInterval ?? "recurring"}
          </span>
        )}

        {task.dueDate && (
          <span className="text-xs text-muted-foreground ml-auto">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {task.publishedUrl && (
        <a href={task.publishedUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <ExternalLink className="w-3 h-3" />Published URL
        </a>
      )}
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────
function CategorySection({
  category, tasks, onEdit, onDelete, onStatusChange,
}: {
  category: TaskCategory;
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: TaskStatus) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <h3 className="font-semibold text-sm text-foreground">{CATEGORY_LABELS[category]}</h3>
        <span className="text-xs text-muted-foreground ml-1">
          {done}/{tasks.length} done
        </span>
        <div className="flex-1 h-px bg-border ml-2" />
      </button>
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
          ))}
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground col-span-3 py-2">No tasks in this category.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task Edit / Create Dialog ────────────────────────────────────────────────
function TaskDialog({
  task,
  open,
  onClose,
  onSaved,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "content_distribution");
  const [channel, setChannel] = useState<TaskChannel>(task?.channel ?? "medium");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [assignee, setAssignee] = useState(task?.assignee ?? "Jim");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [publishedUrl, setPublishedUrl] = useState(task?.publishedUrl ?? "");
  const [aiDraftContext, setAiDraftContext] = useState("");
  const [aiDraft, setAiDraft] = useState(task?.aiDraft ?? "");
  const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false);
  const [recurrenceInterval, setRecurrenceInterval] = useState(task?.recurrenceInterval ?? "weekly");

  const utils = trpc.useUtils();
  const createMutation = trpc.vaTasks.create.useMutation({
    onSuccess: () => { toast.success("Task created"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.vaTasks.update.useMutation({
    onSuccess: () => { toast.success("Task updated"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const generateDraftMutation = trpc.vaTasks.generateDraft.useMutation({
    onSuccess: (data) => { setAiDraft(data.draft); toast.success("AI draft generated"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (isEdit && task) {
      updateMutation.mutate({ id: task.id, title, description, priority, assignee, notes, publishedUrl: publishedUrl || undefined, aiDraft: aiDraft || undefined });
    } else {
      createMutation.mutate({ category, channel, title, description, priority, assignee, isRecurring, recurrenceInterval: isRecurring ? recurrenceInterval : undefined });
    }
  };

  const handleGenerateDraft = () => {
    if (!task) { toast.error("Save the task first, then generate a draft"); return; }
    if (!aiDraftContext.trim()) { toast.error("Enter context for the AI draft (e.g. topic or question)"); return; }
    generateDraftMutation.mutate({ taskId: task.id, context: aiDraftContext });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title..." />
          </div>

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Channel</label>
                <Select value={channel} onValueChange={(v) => setChannel(v as TaskChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description / Instructions</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Step-by-step instructions for the VA..." rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignee</label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Jim" />
            </div>
          </div>

          {!isEdit && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded" />
              <label htmlFor="recurring" className="text-sm">Recurring task</label>
              {isRecurring && (
                <Select value={recurrenceInterval} onValueChange={setRecurrenceInterval}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {isEdit && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VA notes, blockers, progress updates..." rows={3} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Published URL</label>
                <Input value={publishedUrl} onChange={(e) => setPublishedUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-medium">AI Draft Generator</span>
                </div>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={aiDraftContext}
                    onChange={(e) => setAiDraftContext(e.target.value)}
                    placeholder="Enter topic, question, or target audience..."
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateDraft}
                    disabled={generateDraftMutation.isPending}
                  >
                    {generateDraftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate
                  </Button>
                </div>
                {aiDraft && (
                  <Textarea
                    value={aiDraft}
                    onChange={(e) => setAiDraft(e.target.value)}
                    rows={8}
                    className="text-xs font-mono bg-white"
                    placeholder="AI-generated draft will appear here..."
                  />
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VATaskHub() {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");

  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading, refetch } = trpc.vaTasks.list.useQuery(undefined);
  const { data: stats = [] } = trpc.vaTasks.stats.useQuery();
  const seedMutation = trpc.vaTasks.seedTemplates.useMutation({
    onSuccess: (r) => {
      if (r.seeded) { toast.success(`Seeded ${r.count} template tasks`); refetch(); }
      else toast.info(r.message);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.vaTasks.delete.useMutation({
    onSuccess: () => { toast.success("Task deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.vaTasks.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const handleStatusChange = (id: number, status: TaskStatus) => {
    updateMutation.mutate({ id, status });
  };

  const filteredTasks = useMemo(() => {
    return (tasks as Task[]).filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(t.description ?? "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterStatus, filterCategory, filterPriority, searchQuery]);

  const tasksByCategory = useMemo(() => {
    const grouped: Partial<Record<TaskCategory, Task[]>> = {};
    for (const t of filteredTasks) {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category]!.push(t);
    }
    return grouped;
  }, [filteredTasks]);

  const statsMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stats as Array<{ status: string; count: number }>) m[s.status] = Number(s.count);
    return m;
  }, [stats]);

  const totalTasks = (tasks as Task[]).length;
  const doneTasks = statsMap["done"] ?? 0;
  const inProgressTasks = statsMap["in_progress"] ?? 0;
  const highPriorityTasks = (tasks as Task[]).filter((t) => t.priority === "high" && t.status !== "done").length;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VA Task Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive traffic-building and outreach task management for Jim and the team
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalTasks === 0 && (
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Load Template Tasks
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />New Task
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Tasks", value: totalTasks, color: "text-foreground" },
          { label: "Done", value: doneTasks, color: "text-green-600" },
          { label: "In Progress", value: inProgressTasks, color: "text-blue-600" },
          { label: "High Priority Open", value: highPriorityTasks, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border border-border rounded-lg p-3">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TaskStatus | "all")}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as TaskCategory | "all")}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as TaskPriority | "all")}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterCategory !== "all" || filterPriority !== "all" || searchQuery) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
            setFilterStatus("all"); setFilterCategory("all"); setFilterPriority("all"); setSearchQuery("");
          }}>
            Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filteredTasks.length} tasks</span>
      </div>

      {/* Task Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : totalTasks === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No tasks yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md">
            Load the template task library to get started with all the channels Jim needs to work through,
            or create a custom task.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Load Template Tasks
            </Button>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />Create Custom Task
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => {
            const catTasks = tasksByCategory[cat] ?? [];
            if (catTasks.length === 0 && filterCategory !== "all" && filterCategory !== cat) return null;
            return (
              <CategorySection
                key={cat}
                category={cat}
                tasks={catTasks}
                onEdit={setEditingTask}
                onDelete={(id) => deleteMutation.mutate({ id })}
                onStatusChange={handleStatusChange}
              />
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      {editingTask && (
        <TaskDialog
          task={editingTask}
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => { refetch(); setEditingTask(null); }}
        />
      )}

      {/* Create Dialog */}
      <TaskDialog
        task={null}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSaved={() => { refetch(); setShowCreateDialog(false); }}
      />
    </div>
  );
}
