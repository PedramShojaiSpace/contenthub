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
  Calendar,
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

export default function CommandCenter() {
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIdea, setNewIdea] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");

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
  const deleteMutation = trpc.content.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Deleted.");
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    createMutation.mutate({
      title: newTitle,
      rawIdea: newIdea,
      platform: newPlatform,
      status: "idea",
    });
  };

  const handleStatusChange = (id: number, status: Status) => {
    changeStatusMutation.mutate({ id, status });
  };

  return (
    <DashboardLayout>
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
                    <Select
                      value={newPlatform}
                      onValueChange={(v) => setNewPlatform(v as Platform)}
                    >
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
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleCreate}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create"
                      )}
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
              <div
                key={s.key}
                className={`rounded-lg border p-3 text-center ${s.color}`}
              >
                <div className="text-2xl font-bold text-foreground">{count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Kanban Board */}
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
                    <Badge
                      variant="outline"
                      className="text-xs h-5 px-1.5 border-border text-muted-foreground"
                    >
                      {colItems.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {colItems.map((item) => (
                      <Card
                        key={item.id}
                        className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
                        onClick={() => setLocation(`/studio?id=${item.id}`)}
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
                                      handleStatusChange(item.id, s.key);
                                    }}
                                  >
                                    Move to {s.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMutation.mutate({ id: item.id });
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
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="mt-2 w-full h-16 object-cover rounded"
                            />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {colItems.length === 0 && (
                      <div className="border border-dashed border-border/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground/50">Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Calendar View (placeholder) */}
        {viewMode === "calendar" && (
          <div className="border border-border rounded-xl p-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
              Calendar View
            </h3>
            <p className="text-sm text-muted-foreground">
              Schedule and visualize your content calendar. Coming soon — use Kanban view for now.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
