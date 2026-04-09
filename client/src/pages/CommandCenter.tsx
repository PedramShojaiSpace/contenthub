import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Facebook,
  Heart,
  ImageIcon,
  Linkedin,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Repeat2,
  Twitter,
  Youtube,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Platform = "meta" | "linkedin" | "x" | "youtube" | "all";
type Status = "idea" | "drafting" | "review" | "approved" | "scheduled" | "published";

type ContentItem = {
  id: number;
  title: string;
  platform: string;
  status: string;
  imageUrl: string | null;
  scheduledAt: number | null;
  publishedAt: number | null;
  publishUrl: string | null;
  analyticsViews: number | null;
  analyticsLikes: number | null;
  analyticsComments: number | null;
  analyticsShares: number | null;
};

const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: "idea", label: "Idea", color: "bg-muted/50 border-border" },
  { key: "drafting", label: "Drafting", color: "bg-blue-950/30 border-blue-800/30" },
  { key: "review", label: "Review", color: "bg-yellow-950/30 border-yellow-800/30" },
  { key: "approved", label: "Approved", color: "bg-green-950/30 border-green-800/30" },
  { key: "scheduled", label: "Scheduled", color: "bg-purple-950/30 border-purple-800/30" },
  { key: "published", label: "Published", color: "bg-primary/10 border-primary/20" },
];

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  meta: <Facebook className="h-3 w-3" />,
  linkedin: <Linkedin className="h-3 w-3" />,
  x: <Twitter className="h-3 w-3" />,
  youtube: <Youtube className="h-3 w-3" />,
  all: <span className="text-[10px] font-bold">ALL</span>,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  linkedin: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  x: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  youtube: "bg-red-500/20 text-red-300 border-red-500/30",
  all: "bg-primary/20 text-primary border-primary/30",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Published Confirmation Dialog ──────────────────────────────────────────
function PublishConfirmDialog({
  item,
  onConfirm,
  onClose,
}: {
  item: ContentItem;
  onConfirm: (id: number, publishUrl: string, publishedAt: number) => void;
  onClose: () => void;
}) {
  const [publishUrl, setPublishUrl] = useState(item.publishUrl ?? "");
  const today = new Date().toISOString().split("T")[0];
  const [publishDate, setPublishDate] = useState(today);

  const handleConfirm = () => {
    const ts = new Date(publishDate).getTime();
    onConfirm(item.id, publishUrl, ts);
    onClose();
  };

  return (
    <DialogContent className="bg-card border-border max-w-md">
      <DialogHeader>
        <DialogTitle className="font-serif">Mark as Published</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm font-medium text-foreground line-clamp-2">{item.title}</p>
          <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[item.platform as Platform]}`}>
            {PLATFORM_ICONS[item.platform as Platform]}
            <span className="capitalize">{item.platform}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Publish Date
          </Label>
          <Input
            type="date"
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            className="bg-background border-border text-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Published URL (optional)
          </Label>
          <Input
            type="url"
            placeholder="https://www.linkedin.com/posts/..."
            value={publishUrl}
            onChange={(e) => setPublishUrl(e.target.value)}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleConfirm}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Confirm Published
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Analytics Panel ─────────────────────────────────────────────────────────
function AnalyticsPanel({
  item,
  onUpdate,
}: {
  item: ContentItem;
  onUpdate: (id: number, analytics: { analyticsViews?: number; analyticsLikes?: number; analyticsComments?: number; analyticsShares?: number }) => void;
}) {
  const [views, setViews] = useState(String(item.analyticsViews ?? 0));
  const [likes, setLikes] = useState(String(item.analyticsLikes ?? 0));
  const [comments, setComments] = useState(String(item.analyticsComments ?? 0));
  const [shares, setShares] = useState(String(item.analyticsShares ?? 0));
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdate(item.id, {
      analyticsViews: parseInt(views) || 0,
      analyticsLikes: parseInt(likes) || 0,
      analyticsComments: parseInt(comments) || 0,
      analyticsShares: parseInt(shares) || 0,
    });
    setEditing(false);
  };

  const totalEngagement = (parseInt(likes) || 0) + (parseInt(comments) || 0) + (parseInt(shares) || 0);
  const engagementRate = (parseInt(views) || 0) > 0
    ? ((totalEngagement / (parseInt(views) || 1)) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <BarChart2 className="h-3 w-3" />
          Analytics
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => editing ? handleSave() : setEditing(true)}
        >
          {editing ? "Save" : "Edit"}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Views", value: views, setter: setViews, icon: <BarChart2 className="h-3 w-3" /> },
          { label: "Likes", value: likes, setter: setLikes, icon: <Heart className="h-3 w-3" /> },
          { label: "Comments", value: comments, setter: setComments, icon: <MessageCircle className="h-3 w-3" /> },
          { label: "Shares", value: shares, setter: setShares, icon: <Repeat2 className="h-3 w-3" /> },
        ].map(({ label, value, setter, icon }) => (
          <div key={label} className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-muted-foreground mb-1">
              {icon}
            </div>
            {editing ? (
              <Input
                type="number"
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="h-7 text-center text-xs bg-background border-border p-1"
                min="0"
              />
            ) : (
              <div className="text-base font-bold text-foreground">
                {parseInt(value).toLocaleString()}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
        <span>Engagement rate</span>
        <span className="text-primary font-medium">{engagementRate}%</span>
      </div>

      {item.publishUrl && (
        <a
          href={item.publishUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          View published post
        </a>
      )}
    </div>
  );
}

// ─── Draggable Card ─────────────────────────────────────────────────────────
function DraggableCard({
  item,
  onStatusChange,
  onDelete,
  onClick,
  onPublish,
  onAnalyticsUpdate,
  onRegenerate,
}: {
  item: ContentItem;
  onStatusChange: (id: number, status: Status) => void;
  onDelete: (id: number) => void;
  onClick: () => void;
  onPublish: (item: ContentItem) => void;
  onAnalyticsUpdate: (id: number, analytics: { analyticsViews?: number; analyticsLikes?: number; analyticsComments?: number; analyticsShares?: number }) => void;
  onRegenerate: (item: ContentItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card-${item.id}`,
    data: { itemId: item.id, type: "card" },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const isPublished = item.status === "published";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`bg-card border-border hover:border-primary/30 transition-colors cursor-grab active:cursor-grabbing group ${isDragging ? "shadow-2xl" : ""}`}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      {/* Image thumbnail */}
      {item.imageUrl && (
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-20 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        </div>
      )}

      <CardHeader className={`p-3 pb-2 ${item.imageUrl ? "pt-2" : ""}`}>
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
            {item.title}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {STATUSES.filter((s) => s.key !== item.status).map((s) => (
                <DropdownMenuItem
                  key={s.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (s.key === "published") {
                      onPublish(item);
                    } else {
                      onStatusChange(item.id, s.key);
                    }
                  }}
                >
                  {s.key === "published" ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      Mark as Published
                    </span>
                  ) : (
                    `Move to ${s.label}`
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(item);
                }}
              >
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" />
                  Regenerate Image
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[item.platform as Platform]}`}
          >
            {PLATFORM_ICONS[item.platform as Platform]}
            <span className="capitalize">{item.platform}</span>
          </div>

          {isPublished && item.publishedAt && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Analytics panel for published items */}
        {isPublished && (
          <AnalyticsPanel item={item} onUpdate={onAnalyticsUpdate} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Droppable Kanban Column ─────────────────────────────────────────────────
function DroppableColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg transition-colors ${isOver ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}
    >
      {children}
    </div>
  );
}

// ─── Droppable Calendar Day ──────────────────────────────────────────────────
function DroppableCalendarDay({
  dateKey,
  isToday,
  dayNum,
  isCurrentMonth,
  children,
  onClick,
}: {
  dateKey: string;
  isToday: boolean;
  dayNum: number;
  isCurrentMonth: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`min-h-[100px] p-1.5 border-b border-r border-border/30 cursor-pointer transition-colors
        ${isOver ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/10"}
        ${!isCurrentMonth ? "opacity-40" : ""}
      `}
    >
      <div
        className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
          ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
        `}
      >
        {dayNum}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CommandCenter() {
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIdea, setNewIdea] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduleDialogDate, setScheduleDialogDate] = useState<string | null>(null);
  const [scheduleItemId, setScheduleItemId] = useState<number | null>(null);
  const [publishDialogItem, setPublishDialogItem] = useState<ContentItem | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const regenerateImageMutation = trpc.ai.generateImage.useMutation({
    onSuccess: (data, variables) => {
      if (data.url && variables.contentItemId) {
        updateMutation.mutate(
          { id: variables.contentItemId, imageUrl: data.url },
          {
            onSuccess: () => {
              refetch();
              setRegeneratingId(null);
              toast.success("Image regenerated!");
            },
          }
        );
      } else {
        setRegeneratingId(null);
        toast.error("Image regeneration failed.");
      }
    },
    onError: (err) => {
      setRegeneratingId(null);
      toast.error("Image regeneration failed: " + err.message);
    },
  });

  const handleRegenerate = (item: ContentItem) => {
    setRegeneratingId(item.id);
    regenerateImageMutation.mutate({
      prompt: item.title,
      contentItemId: item.id,
      platform: (item.platform as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "all") ?? "all",
    });
  };

  const { data: items = [], refetch } = trpc.content.list.useQuery();
  const createMutation = trpc.content.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateOpen(false);
      setNewTitle("");
      setNewIdea("");
      setNewPlatform("all");
      toast.success("Content item created!");
    },
  });
  const changeStatusMutation = trpc.content.changeStatus.useMutation({
    onSuccess: () => refetch(),
  });
  const updateMutation = trpc.content.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const deleteMutation = trpc.content.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Deleted.");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    createMutation.mutate({ title: newTitle, rawIdea: newIdea, platform: newPlatform, status: "idea" });
  };

  const handleStatusChange = (id: number, status: Status) => {
    changeStatusMutation.mutate({ id, status });
  };

  const handlePublishConfirm = (id: number, publishUrl: string, publishedAt: number) => {
    updateMutation.mutate(
      { id, status: "published", publishedAt, publishUrl: publishUrl || undefined },
      {
        onSuccess: () => {
          refetch();
          toast.success("Marked as published!");
        },
      }
    );
  };

  const handleAnalyticsUpdate = (
    id: number,
    analytics: { analyticsViews?: number; analyticsLikes?: number; analyticsComments?: number; analyticsShares?: number }
  ) => {
    updateMutation.mutate(
      { id, ...analytics },
      {
        onSuccess: () => {
          refetch();
          toast.success("Analytics updated.");
        },
      }
    );
  };

  // ─── Drag Handlers ───────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = (active.data.current as { itemId: number })?.itemId;
    if (!itemId) return;

    const overId = over.id as string;

    // Dropped on a Kanban column
    if (overId.startsWith("col-")) {
      const newStatus = overId.replace("col-", "") as Status;
      const item = items.find((i) => i.id === itemId);
      if (item && item.status !== newStatus) {
        if (newStatus === "published") {
          // Open publish confirmation dialog
          setPublishDialogItem(item as ContentItem);
        } else {
          changeStatusMutation.mutate({ id: itemId, status: newStatus });
          if (newStatus === "scheduled") {
            toast.info("Item moved to Scheduled. Open Calendar to assign a date.");
          }
        }
      }
    }

    // Dropped on a Calendar day
    if (overId.startsWith("day-")) {
      const dateKey = overId.replace("day-", "");
      const scheduledAt = new Date(dateKey).getTime();
      updateMutation.mutate(
        { id: itemId, scheduledAt, status: "scheduled" },
        { onSuccess: () => { refetch(); toast.success("Scheduled!"); } }
      );
    }
  };

  // ─── Calendar helpers ────────────────────────────────────────────────────
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = new Date();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startPadding = firstDayOfMonth.getDay();
  const totalCells = Math.ceil((startPadding + lastDayOfMonth.getDate()) / 7) * 7;

  const calendarDays: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startPadding + i);
    calendarDays.push({ date: d, isCurrentMonth: d.getMonth() === month });
  }

  const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const isTodayFn = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const itemsOnDay = (d: Date) =>
    items.filter((item) => {
      if (!item.scheduledAt) return false;
      const itemDate = new Date(item.scheduledAt);
      return (
        itemDate.getDate() === d.getDate() &&
        itemDate.getMonth() === d.getMonth() &&
        itemDate.getFullYear() === d.getFullYear()
      );
    });

  const unscheduledApproved = items.filter(
    (i) => i.status === "approved" && !i.scheduledAt
  );

  const activeItem = activeId
    ? items.find((i) => `card-${i.id}` === activeId)
    : null;

  const handleDayClick = (dateKey: string) => {
    if (scheduleItemId) {
      const scheduledAt = new Date(dateKey).getTime();
      updateMutation.mutate(
        { id: scheduleItemId, scheduledAt, status: "scheduled" },
        { onSuccess: () => { refetch(); toast.success("Scheduled!"); } }
      );
      setScheduleItemId(null);
      setScheduleDialogDate(null);
    }
  };

  const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  // Analytics summary for stats bar
  const publishedItems = items.filter((i) => i.status === "published");
  const totalViews = publishedItems.reduce((sum, i) => sum + ((i as ContentItem).analyticsViews ?? 0), 0);
  const totalLikes = publishedItems.reduce((sum, i) => sum + ((i as ContentItem).analyticsLikes ?? 0), 0);

  return (
    <DashboardLayout>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">Command Center</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track and manage all content across platforms
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="h-7 px-3 text-xs"
                >
                  Kanban
                </Button>
                <Button
                  variant={viewMode === "calendar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("calendar")}
                  className="h-7 px-3 text-xs"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Calendar
                </Button>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-1" />
                    New Content
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="font-serif">Create Content Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        placeholder="e.g. Mouthwash destroys gut microbiome..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Raw Idea / Notes</Label>
                      <Textarea
                        placeholder="Drop your raw idea, a link, or a voice memo transcript..."
                        value={newIdea}
                        onChange={(e) => setNewIdea(e.target.value)}
                        rows={3}
                        className="bg-background border-border resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select value={newPlatform} onValueChange={(v) => setNewPlatform(v as Platform)}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Platforms</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="meta">Meta (Instagram/Facebook)</SelectItem>
                          <SelectItem value="x">X (Twitter)</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={handleCreate}
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-6 gap-3">
            {STATUSES.map((s) => {
              const count = items.filter((i) => i.status === s.key).length;
              return (
                <div key={s.key} className={`rounded-lg border p-3 text-center ${s.color}`}>
                  <div className="text-2xl font-bold text-foreground">{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* Analytics Summary Row — shown when there are published items with data */}
          {publishedItems.length > 0 && (totalViews > 0 || totalLikes > 0) && (
            <div className="flex items-center gap-6 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">Published Analytics</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  <span className="text-foreground font-semibold">{totalViews.toLocaleString()}</span> views
                </span>
                <span className="text-muted-foreground">
                  <span className="text-foreground font-semibold">{totalLikes.toLocaleString()}</span> likes
                </span>
                <span className="text-muted-foreground">
                  <span className="text-foreground font-semibold">{publishedItems.length}</span> posts
                </span>
              </div>
            </div>
          )}

          {/* ── KANBAN VIEW ──────────────────────────────────────────────────── */}
          {viewMode === "kanban" && (
            <div className="grid grid-cols-6 gap-4 overflow-x-auto">
              {STATUSES.map((col) => {
                const colItems = items.filter((i) => i.status === col.key);
                return (
                  <div key={col.key} className="min-w-[180px]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {col.label}
                      </h3>
                      <Badge variant="outline" className="text-xs h-5 px-1.5 border-border text-muted-foreground">
                        {colItems.length}
                      </Badge>
                    </div>
                    <DroppableColumn status={col.key}>
                      <div className="space-y-2">
                        {colItems.map((item) => (
                          <div key={item.id} className="relative">
                            {regeneratingId === item.id && (
                              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 rounded-lg">
                                <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                              </div>
                            )}
                            <DraggableCard
                              item={item as ContentItem}
                              onStatusChange={handleStatusChange}
                              onDelete={(id) => deleteMutation.mutate({ id })}
                              onClick={() => setLocation(`/studio?id=${item.id}`)}
                              onPublish={(itm) => setPublishDialogItem(itm)}
                              onAnalyticsUpdate={handleAnalyticsUpdate}
                              onRegenerate={handleRegenerate}
                            />
                          </div>
                        ))}
                        {colItems.length === 0 && (
                          <div className="border border-dashed border-border/50 rounded-lg p-4 text-center">
                            <p className="text-xs text-muted-foreground/50">Empty</p>
                          </div>
                        )}
                      </div>
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CALENDAR VIEW ────────────────────────────────────────────────── */}
          {viewMode === "calendar" && (
            <div className="space-y-4">
              {/* Month Nav */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-4">
                {/* Calendar Grid */}
                <div className="flex-1 border border-border/30 rounded-xl overflow-hidden">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 bg-muted/20">
                    {DAYS_OF_WEEK.map((d) => (
                      <div key={d} className="text-xs font-semibold text-muted-foreground text-center py-2 border-b border-r border-border/30">
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map(({ date, isCurrentMonth }) => {
                      const dateKey = toDateKey(date);
                      const dayItems = itemsOnDay(date);
                      return (
                        <DroppableCalendarDay
                          key={dateKey}
                          dateKey={dateKey}
                          isToday={isTodayFn(date)}
                          dayNum={date.getDate()}
                          isCurrentMonth={isCurrentMonth}
                          onClick={() => handleDayClick(dateKey)}
                        >
                          {dayItems.slice(0, 2).map((item) => (
                            <div
                              key={item.id}
                              className={`group relative rounded overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity ${PLATFORM_COLORS[item.platform as Platform]}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/studio?id=${item.id}`);
                              }}
                              title={item.title}
                            >
                              {/* Thumbnail if available */}
                              {(item as ContentItem).imageUrl ? (
                                <div className="relative">
                                  <img
                                    src={(item as ContentItem).imageUrl!}
                                    alt=""
                                    className="w-full h-10 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40" />
                                  <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5">
                                    <p className="text-[9px] text-foreground font-medium truncate leading-tight">
                                      {item.title}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="px-1.5 py-0.5">
                                  <p className="text-[10px] truncate">{item.title}</p>
                                </div>
                              )}
                            </div>
                          ))}
                          {dayItems.length > 2 && (
                            <div className="text-[9px] text-muted-foreground px-1">
                              +{dayItems.length - 2} more
                            </div>
                          )}
                        </DroppableCalendarDay>
                      );
                    })}
                  </div>
                </div>

                {/* Unscheduled Sidebar */}
                <div className="w-56 shrink-0">
                  <div className="border border-border/30 rounded-xl overflow-hidden">
                    <div className="bg-muted/20 px-3 py-2 border-b border-border/30">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Unscheduled
                      </h3>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Drag to calendar or click to select
                      </p>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-[500px] overflow-y-auto">
                      {unscheduledApproved.length === 0 && (
                        <p className="text-xs text-muted-foreground/50 text-center py-4">
                          No approved items awaiting scheduling
                        </p>
                      )}
                      {unscheduledApproved.map((item) => (
                        <div
                          key={item.id}
                          className={`text-xs rounded border cursor-pointer transition-all overflow-hidden
                            ${scheduleItemId === item.id
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card hover:border-primary/40 text-foreground"
                            }`}
                          onClick={() => {
                            setScheduleItemId(scheduleItemId === item.id ? null : item.id);
                            if (scheduleItemId !== item.id) {
                              toast.info("Now click a day on the calendar to schedule this item.");
                            }
                          }}
                        >
                          {(item as ContentItem).imageUrl && (
                            <img
                              src={(item as ContentItem).imageUrl!}
                              alt=""
                              className="w-full h-12 object-cover"
                            />
                          )}
                          <div className="p-2">
                            <div className="font-medium line-clamp-2 mb-1">{item.title}</div>
                            <div className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] border ${PLATFORM_COLORS[item.platform as Platform]}`}>
                              {PLATFORM_ICONS[item.platform as Platform]}
                              <span className="capitalize">{item.platform}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* All scheduled items this month */}
                  <div className="mt-3 border border-border/30 rounded-xl overflow-hidden">
                    <div className="bg-muted/20 px-3 py-2 border-b border-border/30">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        This Month
                      </h3>
                    </div>
                    <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
                      {items
                        .filter((i) => {
                          if (!i.scheduledAt) return false;
                          const d = new Date(i.scheduledAt);
                          return d.getMonth() === month && d.getFullYear() === year;
                        })
                        .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0))
                        .map((item) => (
                          <div
                            key={item.id}
                            className="text-[10px] text-muted-foreground flex items-center gap-1.5 cursor-pointer hover:text-foreground"
                            onClick={() => setLocation(`/studio?id=${item.id}`)}
                          >
                            <span className="text-primary font-medium w-6 shrink-0">
                              {new Date(item.scheduledAt!).getDate()}
                            </span>
                            <span className="truncate">{item.title}</span>
                          </div>
                        ))}
                      {items.filter((i) => {
                        if (!i.scheduledAt) return false;
                        const d = new Date(i.scheduledAt);
                        return d.getMonth() === month && d.getFullYear() === year;
                      }).length === 0 && (
                        <p className="text-[10px] text-muted-foreground/50 text-center py-2">
                          Nothing scheduled
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {scheduleItemId && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Scheduling mode active.</span> Click any day on the calendar to assign the selected item.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={() => setScheduleItemId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem && (
            <Card className="bg-card border-primary/50 shadow-2xl w-48 opacity-90">
              <CardHeader className="p-3 pb-2">
                <p className="text-xs font-medium text-foreground line-clamp-2">{activeItem.title}</p>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[activeItem.platform as Platform]}`}>
                  {PLATFORM_ICONS[activeItem.platform as Platform]}
                  <span className="capitalize">{activeItem.platform}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </DragOverlay>
      </DndContext>

      {/* Published Confirmation Dialog */}
      <Dialog open={!!publishDialogItem} onOpenChange={(open) => { if (!open) setPublishDialogItem(null); }}>
        {publishDialogItem && (
          <PublishConfirmDialog
            item={publishDialogItem}
            onConfirm={handlePublishConfirm}
            onClose={() => setPublishDialogItem(null)}
          />
        )}
      </Dialog>
    </DashboardLayout>
  );
}
