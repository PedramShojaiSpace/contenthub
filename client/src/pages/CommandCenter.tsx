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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Linkedin,
  Loader2,
  MoreHorizontal,
  Plus,
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

// ─── Draggable Card ─────────────────────────────────────────────────────────
function DraggableCard({
  item,
  onStatusChange,
  onDelete,
  onClick,
}: {
  item: { id: number; title: string; platform: string; status: string; imageUrl: string | null };
  onStatusChange: (id: number, status: Status) => void;
  onDelete: (id: number) => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card-${item.id}`,
    data: { itemId: item.id, type: "card" },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`bg-card border-border hover:border-primary/30 transition-colors cursor-grab active:cursor-grabbing group ${isDragging ? "shadow-2xl" : ""}`}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <CardHeader className="p-3 pb-2">
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
            <DropdownMenuContent align="end" className="w-40">
              {STATUSES.filter((s) => s.key !== item.status).map((s) => (
                <DropdownMenuItem
                  key={s.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(item.id, s.key);
                  }}
                >
                  Move to {s.label}
                </DropdownMenuItem>
              ))}
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
        <div
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[item.platform as Platform]}`}
        >
          {PLATFORM_ICONS[item.platform as Platform]}
          <span className="capitalize">{item.platform}</span>
        </div>
        {item.imageUrl && (
          <img src={item.imageUrl} alt="" className="mt-2 w-full h-16 object-cover rounded" />
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
      toast.success("Scheduled!");
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
        changeStatusMutation.mutate({ id: itemId, status: newStatus });
        if (newStatus === "scheduled") {
          toast.info("Item moved to Scheduled. Open Calendar to assign a date.");
        }
      }
    }

    // Dropped on a Calendar day
    if (overId.startsWith("day-")) {
      const dateKey = overId.replace("day-", "");
      const scheduledAt = new Date(dateKey).getTime();
      updateMutation.mutate({ id: itemId, scheduledAt, status: "scheduled" });
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

  const isToday = (d: Date) =>
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
      updateMutation.mutate({ id: scheduleItemId, scheduledAt, status: "scheduled" });
      setScheduleItemId(null);
      setScheduleDialogDate(null);
    }
  };

  const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

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
                          <DraggableCard
                            key={item.id}
                            item={item}
                            onStatusChange={handleStatusChange}
                            onDelete={(id) => deleteMutation.mutate({ id })}
                            onClick={() => setLocation(`/studio?id=${item.id}`)}
                          />
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
                          isToday={isToday(date)}
                          dayNum={date.getDate()}
                          isCurrentMonth={isCurrentMonth}
                          onClick={() => handleDayClick(dateKey)}
                        >
                          {dayItems.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded truncate border cursor-pointer hover:opacity-80 ${PLATFORM_COLORS[item.platform as Platform]}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/studio?id=${item.id}`);
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                          ))}
                          {dayItems.length > 3 && (
                            <div className="text-[9px] text-muted-foreground px-1">
                              +{dayItems.length - 3} more
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
                          className={`text-xs p-2 rounded border cursor-pointer transition-all
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
                          <div className="font-medium line-clamp-2 mb-1">{item.title}</div>
                          <div className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] border ${PLATFORM_COLORS[item.platform as Platform]}`}>
                            {PLATFORM_ICONS[item.platform as Platform]}
                            <span className="capitalize">{item.platform}</span>
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
    </DashboardLayout>
  );
}
