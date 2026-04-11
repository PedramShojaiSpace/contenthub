import DashboardLayout from "@/components/DashboardLayout";
import { PersonasView } from "@/components/PersonasView";
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
  Send,
  Twitter,
  Users,
  Brain,
  Target,
  TrendingUp,
  Youtube,
  Film,
  Flame,
  Clock,
  Zap,
  Sparkles,
  Wand2,
  Copy,
  Download,
  BookMarked,
  Music2,
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
  textContent: string | null;
  rawIdea: string | null;
  imageUrl: string | null;
  scheduledAt: number | null;
  publishedAt: number | null;
  publishUrl: string | null;
  analyticsViews: number | null;
  analyticsLikes: number | null;
  analyticsComments: number | null;
  analyticsShares: number | null;
  linkedScriptId: number | null;
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
  onPushToBuffer,
  isPushingToBuffer,
  onViewScript,
}: {
  item: ContentItem;
  onStatusChange: (id: number, status: Status) => void;
  onDelete: (id: number) => void;
  onClick: () => void;
  onPublish: (item: ContentItem) => void;
  onAnalyticsUpdate: (id: number, analytics: { analyticsViews?: number; analyticsLikes?: number; analyticsComments?: number; analyticsShares?: number }) => void;
  onRegenerate: (item: ContentItem) => void;
  onPushToBuffer: (item: ContentItem) => void;
  isPushingToBuffer: boolean;
  onViewScript?: (scriptId: number) => void;
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

        {/* Action buttons — visible on hover */}
        {!isPublished && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity space-y-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-6 text-[10px] border-amber-600/40 text-amber-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-600 gap-1"
              disabled={isPushingToBuffer}
              onClick={(e) => {
                e.stopPropagation();
                onPushToBuffer(item);
              }}
            >
              {isPushingToBuffer ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Send className="h-2.5 w-2.5" />
              )}
              {isPushingToBuffer ? "Pushing…" : "Push to Buffer"}
            </Button>
            {item.linkedScriptId && onViewScript && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-6 text-[10px] border-violet-500/40 text-violet-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-500 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewScript(item.linkedScriptId!);
                }}
              >
                <Film className="h-2.5 w-2.5" />
                View Script
              </Button>
            )}
          </div>
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
  const [viewMode, setViewMode] = useState<"kanban" | "calendar" | "personas">("kanban");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduleDialogDate, setScheduleDialogDate] = useState<string | null>(null);
  const [scheduleItemId, setScheduleItemId] = useState<number | null>(null);
  const [publishDialogItem, setPublishDialogItem] = useState<ContentItem | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isBatchPublishing, setIsBatchPublishing] = useState(false);
  const [bufferPushingId, setBufferPushingId] = useState<number | null>(null);

  // Teleprompter script state (for card detail modal)
  const [teleprompterScript, setTeleprompterScript] = useState<string | null>(null);
  const [generatingTeleprompter, setGeneratingTeleprompter] = useState(false);

  const teleprompterMutation = trpc.research.generateTeleprompterScript.useMutation({
    onSuccess: (data) => {
      setTeleprompterScript(data.script);
      setGeneratingTeleprompter(false);
      toast.success("Teleprompter script ready!");
    },
    onError: (err) => {
      setGeneratingTeleprompter(false);
      toast.error("Script generation failed: " + err.message);
    },
  });

  const handleGenerateTeleprompter = (item: ContentItem) => {
    const title = item.title.replace(/^Question to answer:.*?Title:\s*/i, "").trim() || item.rawIdea || item.title;
    setTeleprompterScript(null);
    setGeneratingTeleprompter(true);
    teleprompterMutation.mutate({ title, platform: "youtube" });
  };

  // TikTok 60-second script state
  const [tiktokScript, setTiktokScript] = useState<string | null>(null);
  const [generatingTiktok, setGeneratingTiktok] = useState(false);

  const tiktokScriptMutation = trpc.research.generateTeleprompterScript.useMutation({
    onSuccess: (data) => {
      setTiktokScript(data.script);
      setGeneratingTiktok(false);
      toast.success("TikTok script ready!");
    },
    onError: (err) => {
      setGeneratingTiktok(false);
      toast.error("Script generation failed: " + err.message);
    },
  });

  const handleGenerateTiktokScript = (item: ContentItem) => {
    const title = item.title.replace(/^Question to answer:.*?Title:\s*/i, "").trim() || item.rawIdea || item.title;
    setTiktokScript(null);
    setGeneratingTiktok(true);
    tiktokScriptMutation.mutate({ title, platform: "tiktok" });
  };

  // Save to Script Library
  const utils = trpc.useUtils();
  const linkContentMutation = trpc.content.update.useMutation();
  const saveScriptMutation = trpc.scripts.create.useMutation({
    onSuccess: (created, variables) => {
      toast.success("Script saved to Script Library!");
      // Auto-link: set linkedScriptId on the originating content item
      if (created && variables.linkedContentItemId) {
        linkContentMutation.mutate({
          id: variables.linkedContentItemId,
          linkedScriptId: created.id,
        });
        utils.content.list.invalidate();
      }
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const handleSaveToLibrary = (title: string, scriptBody: string, platform: "youtube" | "tiktok", contentItemId?: number) => {
    saveScriptMutation.mutate({
      title,
      scriptType: platform === "tiktok" ? "reel" : "video",
      platform,
      productionStatus: "scripted",
      scriptBody,
      linkedContentItemId: contentItemId,
    });
  };

  // Buffer profiles (cached — fetched once)
  const { data: bufferProfiles = [] } = trpc.syndication.getProfiles.useQuery();

  // Growth cadence data
  const { data: cadenceData, refetch: refetchCadence } = trpc.growth.weeklyCadence.useQuery();
  const seedPillarsMutation = trpc.growth.seedPillars.useMutation({ onSuccess: () => refetchCadence() });

  const syndicationMutation = trpc.syndication.push.useMutation({
    onSuccess: (result, variables) => {
      setBufferPushingId(null);
      if (result.success) {
        refetch();
        toast.success("Pushed to Buffer queue!");
      } else {
        toast.error("Buffer push failed: " + (result.error ?? "Unknown error"));
      }
    },
    onError: (err) => {
      setBufferPushingId(null);
      toast.error("Buffer error: " + err.message);
    },
  });

  // Platform → Buffer service names map (same fix as Creation Studio)
  const PLATFORM_SERVICE_MAP: Record<string, string[]> = {
    linkedin: ["linkedin"],
    meta: ["facebook", "instagram"],
    x: ["twitter"],
    youtube: ["youtube"],
    tiktok: ["tiktok"],
  };

  const handlePushToBuffer = (item: ContentItem) => {
    const services = PLATFORM_SERVICE_MAP[item.platform] ?? [];
    const matchedProfiles = bufferProfiles.filter((p) =>
      services.includes(p.service.toLowerCase())
    );
    if (matchedProfiles.length === 0) {
      toast.error(`No Buffer channel found for platform "${item.platform}". Check your Buffer connections.`);
      return;
    }
    if (!item.textContent && !item.title) {
      toast.error("This item has no text content to push.");
      return;
    }
    setBufferPushingId(item.id);
    syndicationMutation.mutate({
      contentItemId: item.id,
      text: item.textContent ?? item.title,
      profileIds: matchedProfiles.map((p) => p.id),
      imageUrl: item.imageUrl ?? undefined,
    });
  };

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

  const handleViewScript = (scriptId: number) => {
    setLocation(`/script-library?scriptId=${scriptId}`);
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

  const batchPublishMutation = trpc.blog.publishBatch.useMutation({
    onSuccess: (data) => {
      refetch();
      setIsBatchPublishing(false);
      if (data.failed === 0) {
        toast.success(`${data.succeeded} post${data.succeeded !== 1 ? "s" : ""} sent to WordPress as drafts!`);
      } else {
        toast.warning(`${data.succeeded} published, ${data.failed} failed. Check WordPress for details.`);
      }
    },
    onError: (err) => {
      setIsBatchPublishing(false);
      toast.error("Batch publish failed: " + err.message);
    },
  });

  const wpScheduleMutation = trpc.blog.publish.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.wpStatus === "future") {
        toast.success("Post scheduled in WordPress!");
      }
    },
    onError: () => {
      // Non-fatal — calendar scheduling still works even if WP fails
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
        {
          onSuccess: () => {
            refetch();
            toast.success("Scheduled!");
            // Also schedule in WordPress if it's a blog post with content
            const draggedItem = items.find((i) => i.id === itemId);
            if (draggedItem?.platform === "blog" && draggedItem.textContent) {
              const slug = draggedItem.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 80);
              wpScheduleMutation.mutate({
                contentItemId: draggedItem.id,
                title: draggedItem.title,
                slug,
                body: draggedItem.textContent,
                heroImageUrl: draggedItem.imageUrl ?? undefined,
                status: "future",
                scheduledAt,
              });
            }
          }
        }
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
      const itemToSchedule = items.find((i) => i.id === scheduleItemId);
      updateMutation.mutate(
        { id: scheduleItemId, scheduledAt, status: "scheduled" },
        {
          onSuccess: () => {
            refetch();
            toast.success("Scheduled!");
            // Also schedule in WordPress if it's a blog post with content
            if (itemToSchedule?.platform === "blog" && itemToSchedule.textContent) {
              const slug = itemToSchedule.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 80);
              wpScheduleMutation.mutate({
                contentItemId: itemToSchedule.id,
                title: itemToSchedule.title,
                slug,
                body: itemToSchedule.textContent,
                heroImageUrl: itemToSchedule.imageUrl ?? undefined,
                status: "future",
                scheduledAt,
              });
            }
          }
        }
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
                <Button
                  variant={viewMode === "personas" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("personas")}
                  className="h-7 px-3 text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Personas
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

          {/* ── Webinar Intelligence Quick-Link ─────────────────────────────── */}
          <div
            className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 cursor-pointer hover:bg-violet-500/10 transition-colors group"
            onClick={() => setLocation("/webinar-intelligence")}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 shrink-0">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Webinar Intelligence</div>
              <div className="text-xs text-muted-foreground mt-0.5">Import attendee survey responses → AI extracts pain points, motivations &amp; language</div>
            </div>
            <div className="text-xs text-violet-400 font-medium shrink-0 group-hover:text-violet-300 transition-colors">
              Import responses →
            </div>
          </div>

           {/* ── Weekly Cadence Tracker ─────────────────────────────────────── */}
           {cadenceData && (
             <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Calendar className="h-4 w-4 text-primary" />
                   <span className="text-sm font-semibold text-foreground">Weekly Content Pillars</span>
                 </div>
                 {cadenceData.pillars.length === 0 && (
                   <button
                     onClick={() => { seedPillarsMutation.mutate(); }}
                     className="text-xs text-primary hover:underline"
                   >
                     Seed defaults
                   </button>
                 )}
               </div>
               {cadenceData.pillars.length > 0 ? (
                 <div className="grid grid-cols-4 gap-2">
                   {cadenceData.pillars.map((pillar) => {
                     const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                     const dayName = pillar.dayOfWeek != null ? days[pillar.dayOfWeek] : "—";
                     const isToday = pillar.dayOfWeek === new Date().getDay();
                     return (
                       <div key={pillar.id} className={`rounded-lg border p-2.5 text-center transition-colors ${isToday ? "border-primary/60 bg-primary/10" : "border-border/40 bg-muted/20"}`}>
                         <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{dayName}</div>
                         <div className="text-xs font-medium text-foreground leading-tight">{pillar.name}</div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <div className="text-xs text-muted-foreground text-center py-2">No pillars seeded yet. Click "Seed defaults" to add the 4 content pillars.</div>
               )}
               {/* Evergreen enrollment indicator */}
               <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs bg-green-500/10 border border-green-500/30 text-green-400">
                 <Flame className="h-3.5 w-3.5 shrink-0" />
                 <div className="flex-1">
                   <span className="font-semibold">Lights On Course</span>
                   <span className="ml-2 opacity-80">— Perpetual enrollment · Always open · $369/yr</span>
                 </div>
                 <a href="https://go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 shrink-0 hover:text-green-300 transition-colors">
                   <Zap className="h-3 w-3" /><span>View offer</span>
                 </a>
               </div>
             </div>
           )}

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

          {/* ── Platform Filter Pills ─────────────────────────────────────── */}
          {viewMode === "kanban" && (
            <div className="flex items-center gap-2 flex-wrap">
              {["all", "linkedin", "meta", "x", "youtube", "tiktok", "blog"].map((p) => {
                const count = p === "all" ? items.length : items.filter((i) => i.platform === p).length;
                const labels: Record<string, string> = {
                  all: "All", linkedin: "LinkedIn", meta: "Meta", x: "X",
                  youtube: "YouTube", tiktok: "TikTok", blog: "Blog",
                };
                return (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      platformFilter === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {labels[p]}
                    <span className={`text-[10px] ${ platformFilter === p ? "opacity-80" : "opacity-60" }`}>{count}</span>
                  </button>
                );
              })}
              {/* Batch Publish Approved button */}
              {items.filter((i) => i.status === "approved").length > 0 && (
                <button
                  onClick={() => {
                    const approvedIds = items.filter((i) => i.status === "approved").map((i) => i.id);
                    setIsBatchPublishing(true);
                    batchPublishMutation.mutate({ contentItemIds: approvedIds });
                  }}
                  disabled={isBatchPublishing}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-green-600/50 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  {isBatchPublishing ? (
                    <><span className="h-3 w-3 border border-green-600 border-t-transparent rounded-full animate-spin" />Publishing...</>
                  ) : (
                    <><span>⬆</span> Publish All Approved to WordPress ({items.filter((i) => i.status === "approved").length})</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── KANBAN VIEW ──────────────────────────────────────────────────── */}
          {viewMode === "kanban" && (
            <div className="grid grid-cols-6 gap-4 overflow-x-auto">
              {STATUSES.map((col) => {
                const colItems = (platformFilter === "all" ? items : items.filter((i) => i.platform === platformFilter)).filter((i) => i.status === col.key);
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
                              onClick={() => {
                                const ci = item as ContentItem;
                                setSelectedItem(ci);
                                setEditingContent(ci.textContent ?? "");
                              }}
                              onPublish={(itm) => setPublishDialogItem(itm)}
                              onAnalyticsUpdate={handleAnalyticsUpdate}
                              onRegenerate={handleRegenerate}
                               onPushToBuffer={handlePushToBuffer}
                               isPushingToBuffer={bufferPushingId === item.id}
                               onViewScript={handleViewScript}
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

        {/* ── PERSONAS VIEW ─────────────────────────────────────────────────── */}
        {viewMode === "personas" && (
          <PersonasView items={items} />
        )}

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

      {/* ── Card Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setTeleprompterScript(null); setGeneratingTeleprompter(false); setTiktokScript(null); setGeneratingTiktok(false); } }}>
        {selectedItem && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${PLATFORM_COLORS[selectedItem.platform as Platform] ?? ""}`}>
                  {PLATFORM_ICONS[selectedItem.platform as Platform]}
                  <span className="capitalize">{selectedItem.platform}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{selectedItem.status}</span>
              </div>
              <DialogTitle className="font-serif text-base leading-snug mt-1">
                {selectedItem.title}
              </DialogTitle>
            </DialogHeader>

            {/* Hero image */}
            {selectedItem.imageUrl && (
              <img
                src={selectedItem.imageUrl}
                alt=""
                className="w-full rounded-lg object-cover max-h-56"
              />
            )}

            {/* Post content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Post Content</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={isSavingContent}
                  onClick={() => {
                    setIsSavingContent(true);
                    updateMutation.mutate(
                      { id: selectedItem.id, textContent: editingContent },
                      {
                        onSuccess: () => {
                          refetch();
                          setIsSavingContent(false);
                          toast.success("Content saved!");
                        },
                        onError: () => setIsSavingContent(false),
                      }
                    );
                  }}
                >
                  {isSavingContent ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
              </div>
              <Textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                rows={12}
                className="bg-background border-border resize-none text-sm font-mono leading-relaxed"
                placeholder="No content yet — generate from Creation Studio"
              />
            </div>

            {/* Copy + Regenerate buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(editingContent);
                  toast.success("Copied to clipboard!");
                }}
              >
                Copy Content
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  handleRegenerate(selectedItem);
                  setSelectedItem(null);
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate Image
              </Button>
            </div>

            {/* Teleprompter Script — YouTube only */}
            {selectedItem.platform === "youtube" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                    onClick={() => handleGenerateTeleprompter(selectedItem)}
                    disabled={generatingTeleprompter || teleprompterMutation.isPending}
                  >
                    {generatingTeleprompter ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Wand2 className="h-3 w-3 mr-1" />
                    )}
                    {generatingTeleprompter ? "Generating script…" : "Generate Teleprompter Script"}
                  </Button>
                  {teleprompterScript && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(teleprompterScript);
                          toast.success("Script copied!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const blob = new Blob([teleprompterScript], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `teleprompter-${selectedItem.id}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-amber-400"
                        onClick={() => handleGenerateTeleprompter(selectedItem)}
                        disabled={generatingTeleprompter}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Redo
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                        onClick={() => {
                          const title = selectedItem.title.replace(/^Question to answer:.*?Title:\s*/i, "").trim() || selectedItem.title;
                          handleSaveToLibrary(title, teleprompterScript, "youtube", selectedItem.id);
                        }}
                        disabled={saveScriptMutation.isPending}
                      >
                        {saveScriptMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <BookMarked className="h-3 w-3 mr-1" />
                        )}
                        Save to Library
                      </Button>
                    </div>
                  )}
                </div>
                {generatingTeleprompter && (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                    Writing teleprompter script… about 30 seconds.
                  </div>
                )}
                {teleprompterScript && !generatingTeleprompter && (
                  <div className="rounded-lg border border-amber-500/20 bg-black/20 p-4 max-h-72 overflow-y-auto">
                    <p className="text-[10px] text-amber-400/70 mb-2 font-medium uppercase tracking-wider">Teleprompter Script</p>
                    <div className="text-sm text-foreground leading-loose whitespace-pre-wrap font-mono">
                      {teleprompterScript}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TikTok 60-second Script — TikTok cards only */}
            {selectedItem.platform === "tiktok" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-pink-500/40 text-pink-400 hover:bg-pink-500/10 hover:text-pink-300"
                    onClick={() => handleGenerateTiktokScript(selectedItem)}
                    disabled={generatingTiktok || tiktokScriptMutation.isPending}
                  >
                    {generatingTiktok ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Music2 className="h-3 w-3 mr-1" />
                    )}
                    {generatingTiktok ? "Generating…" : "Generate 60-sec TikTok Script"}
                  </Button>
                  {tiktokScript && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(tiktokScript);
                          toast.success("Script copied!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const blob = new Blob([tiktokScript], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `tiktok-60s-${selectedItem.id}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-pink-400"
                        onClick={() => handleGenerateTiktokScript(selectedItem)}
                        disabled={generatingTiktok}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Redo
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                        onClick={() => {
                          const title = selectedItem.title.replace(/^Question to answer:.*?Title:\s*/i, "").trim() || selectedItem.title;
                          handleSaveToLibrary(title, tiktokScript, "tiktok", selectedItem.id);
                        }}
                        disabled={saveScriptMutation.isPending}
                      >
                        {saveScriptMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <BookMarked className="h-3 w-3 mr-1" />
                        )}
                        Save to Library
                      </Button>
                    </div>
                  )}
                </div>
                {generatingTiktok && (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
                    Writing 60-second TikTok script… about 20 seconds.
                  </div>
                )}
                {tiktokScript && !generatingTiktok && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-pink-500/20 bg-black/20 p-4 max-h-72 overflow-y-auto">
                      <p className="text-[10px] text-pink-400/70 mb-2 font-medium uppercase tracking-wider">60-Second TikTok Script</p>
                      <div className="text-sm text-foreground leading-loose whitespace-pre-wrap font-mono">
                        {tiktokScript}
                      </div>
                    </div>
                    {/* Word-count + spoken-time indicator */}
                    {(() => {
                      const words = tiktokScript.trim().split(/\s+/).filter(Boolean).length;
                      const secs = Math.round((words / 130) * 60);
                      const isShort = secs < 50;
                      const isLong = secs > 70;
                      const color = isShort ? "text-amber-400" : isLong ? "text-red-400" : "text-emerald-400";
                      const bg = isShort ? "bg-amber-950/30 border-amber-500/30" : isLong ? "bg-red-950/30 border-red-500/30" : "bg-emerald-950/30 border-emerald-500/30";
                      const label = isShort ? "Too short" : isLong ? "Too long" : "On target";
                      return (
                        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${bg}`}>
                          <span className={`text-xs font-semibold font-mono ${color}`}>{words} words</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={`text-xs font-semibold font-mono ${color}`}>~{secs}s spoken</span>
                          <span className="text-xs text-muted-foreground">(@ 130 wpm)</span>
                          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${color} ${bg}`}>{label}</span>
                          {isShort && <span className="text-xs text-amber-400/70">Add {Math.round((50 - secs) / 60 * 130)} more words</span>}
                          {isLong && <span className="text-xs text-red-400/70">Cut ~{Math.round((secs - 60) / 60 * 130)} words</span>}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Source Script section */}
            {selectedItem.linkedScriptId && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Film className="h-4 w-4 text-violet-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-violet-700">Source Script</p>
                    <p className="text-xs text-violet-500 truncate">Script #{selectedItem.linkedScriptId}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-100 shrink-0"
                  onClick={() => {
                    handleViewScript(selectedItem.linkedScriptId!);
                    setSelectedItem(null);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Script
                </Button>
              </div>
            )}

            {/* Status change */}
            <div className="flex gap-2 flex-wrap">
              {STATUSES.filter((s) => s.key !== selectedItem.status).slice(0, 4).map((s) => (
                <Button
                  key={s.key}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    if (s.key === "published") {
                      setPublishDialogItem(selectedItem);
                    } else {
                      handleStatusChange(selectedItem.id, s.key);
                    }
                    setSelectedItem(null);
                  }}
                >
                  Move to {s.label}
                </Button>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </DashboardLayout>
  );
}
