import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Send, CheckCircle2, Clock, Loader2, Video, Tv2,
  ChevronDown, ChevronUp, RefreshCw, Film, History, BarChart2,
  Zap, Users, Edit3
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentItem {
  id: number;
  title: string;
  textContent: string | null;
  platform: string;
  status: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoKey: string | null;
  linkedScriptId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BufferProfile {
  id: string;
  name: string;
  service: string;
  platform?: string;
  avatarUrl?: string;
}

interface PushLog {
  id: number;
  channelId: string;
  channelName: string;
  service: string;
  bufferPostId: string | null;
  caption: string | null;
  pushedAt: Date;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: "Idea", color: "bg-gray-100 text-gray-600" },
  drafting: { label: "Awaiting Edit", color: "bg-amber-100 text-amber-700" },
  review: { label: "In Review", color: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700" },
  scheduled: { label: "Scheduled", color: "bg-violet-100 text-violet-700" },
  published: { label: "Published", color: "bg-emerald-100 text-emerald-700" },
};

const SERVICE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const SERVICE_COLORS: Record<string, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  facebook: "bg-blue-600 text-white",
  youtube: "bg-red-600 text-white",
  linkedin: "bg-blue-700 text-white",
  twitter: "bg-sky-500 text-white",
  x: "bg-gray-900 text-white",
};

// ─── Multi-Channel Push Dialog ────────────────────────────────────────────────

function MultiChannelPushDialog({
  open,
  onOpenChange,
  item,
  bufferProfiles,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: ContentItem;
  bufferProfiles: BufferProfile[];
  onSuccess: () => void;
}) {
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  // Per-channel caption overrides: channelId → caption string
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResults, setPushResults] = useState<{ channelId: string; success: boolean; error?: string }[]>([]);
  const [phase, setPhase] = useState<"select" | "results">("select");

  const syndicationMutation = trpc.syndication.push.useMutation();
  const logPushMutation = trpc.content.logVideoPush.useMutation();

  // Group profiles by service
  const grouped = useMemo(() => {
    const map: Record<string, BufferProfile[]> = {};
    for (const p of bufferProfiles) {
      const svc = p.service?.toLowerCase() ?? "other";
      if (!map[svc]) map[svc] = [];
      map[svc].push(p);
    }
    return map;
  }, [bufferProfiles]);

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleService = (service: string, profiles: BufferProfile[]) => {
    const allSelected = profiles.every((p) => selectedChannels.has(p.id));
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        profiles.forEach((p) => next.delete(p.id));
      } else {
        profiles.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const selectAll = () => setSelectedChannels(new Set(bufferProfiles.map((p) => p.id)));
  const clearAll = () => setSelectedChannels(new Set());

  const getCaption = (channelId: string) =>
    captions[channelId] ?? item.textContent ?? item.title;

  const handlePush = async () => {
    if (selectedChannels.size === 0) {
      toast.error("Select at least one channel");
      return;
    }
    setPushing(true);
    const results: { channelId: string; success: boolean; error?: string; bufferPostId?: string }[] = [];

    // Push to each channel individually so we can track per-channel results
    for (const channelId of Array.from(selectedChannels)) {
      const profile = bufferProfiles.find((p) => p.id === channelId);
      const caption = getCaption(channelId);
      try {
        const result = await syndicationMutation.mutateAsync({
          contentItemId: item.id,
          text: caption,
          profileIds: [channelId],
          videoUrl: item.videoUrl ?? undefined,
          platform: profile?.service ?? item.platform,
          channelServiceMap: { [channelId]: profile?.service ?? "" },
        });
        results.push({
          channelId,
          success: result.success,
          error: result.success ? undefined : (result.error ?? "Unknown error"),
          bufferPostId: result.bufferId ?? undefined,
        });
      } catch (err: unknown) {
        results.push({
          channelId,
          success: false,
          error: err instanceof Error ? err.message : "Push failed",
        });
      }
    }

    // Log successful pushes
    const successfulPushes = results
      .filter((r) => r.success)
      .map((r) => {
        const profile = bufferProfiles.find((p) => p.id === r.channelId);
        return {
          channelId: r.channelId,
          channelName: profile?.name ?? r.channelId,
          service: profile?.service ?? "",
          bufferPostId: r.bufferPostId,
          caption: getCaption(r.channelId),
        };
      });

    if (successfulPushes.length > 0) {
      await logPushMutation.mutateAsync({
        contentItemId: item.id,
        pushes: successfulPushes,
      });
    }

    setPushResults(results);
    setPushing(false);
    setPhase("results");

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    if (successCount > 0) {
      toast.success(`Pushed to ${successCount} channel${successCount !== 1 ? "s" : ""}${failCount > 0 ? ` (${failCount} failed)` : ""}!`);
      onSuccess();
    } else {
      toast.error("All pushes failed — check Buffer connection");
    }
  };

  const handleClose = () => {
    setPhase("select");
    setPushResults([]);
    setSelectedChannels(new Set());
    setCaptions({});
    setEditingCaption(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-500" />
            {phase === "select" ? "Push Video to Multiple Channels" : "Push Results"}
          </DialogTitle>
        </DialogHeader>

        {phase === "select" ? (
          <>
            {/* Channel selection */}
            <div className="space-y-4 py-2">
              {/* Select all / clear */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedChannels.size} of {bufferProfiles.length} channels selected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-violet-600 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button
                    onClick={clearAll}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {bufferProfiles.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                  No Buffer channels connected. Add your Buffer token in Settings.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([service, profiles]) => {
                    const allSelected = profiles.every((p) => selectedChannels.has(p.id));
                    const someSelected = profiles.some((p) => selectedChannels.has(p.id));
                    const colorClass = SERVICE_COLORS[service] ?? "bg-gray-200 text-gray-700";
                    return (
                      <div key={service} className="space-y-1">
                        {/* Platform group header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colorClass}`}>
                              {SERVICE_LABELS[service] ?? service}
                            </span>
                            <span className="text-xs text-muted-foreground">{profiles.length} account{profiles.length !== 1 ? "s" : ""}</span>
                          </div>
                          <button
                            onClick={() => toggleService(service, profiles)}
                            className={`text-xs font-medium ${allSelected ? "text-violet-600" : someSelected ? "text-violet-400" : "text-muted-foreground"} hover:text-violet-600`}
                          >
                            {allSelected ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        {/* Channel rows */}
                        {profiles.map((profile) => {
                          const isSelected = selectedChannels.has(profile.id);
                          const isEditingThis = editingCaption === profile.id;
                          return (
                            <div
                              key={profile.id}
                              className={`rounded-lg border transition-colors ${isSelected ? "border-violet-300 bg-violet-50/50" : "border-border bg-card"}`}
                            >
                              <label className="flex items-center gap-3 p-2.5 cursor-pointer">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleChannel(profile.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                                  {captions[profile.id] && (
                                    <p className="text-xs text-violet-600 truncate mt-0.5">Custom caption set</p>
                                  )}
                                </div>
                                {isSelected && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setEditingCaption(isEditingThis ? null : profile.id);
                                    }}
                                    className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-1 flex-shrink-0"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    {isEditingThis ? "Done" : "Edit caption"}
                                  </button>
                                )}
                              </label>
                              {/* Per-channel caption editor */}
                              {isSelected && isEditingThis && (
                                <div className="px-3 pb-3">
                                  <Textarea
                                    value={getCaption(profile.id)}
                                    onChange={(e) =>
                                      setCaptions((prev) => ({ ...prev, [profile.id]: e.target.value }))
                                    }
                                    rows={4}
                                    className="text-xs resize-none"
                                    placeholder="Caption for this channel…"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {getCaption(profile.id).length} chars
                                    {service === "twitter" || service === "x" ? " (X limit: 280)" : ""}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={pushing}>
                Cancel
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={handlePush}
                disabled={pushing || selectedChannels.size === 0}
              >
                {pushing ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Pushing…</>
                ) : (
                  <><Send className="w-3.5 h-3.5 mr-1.5" />Push to {selectedChannels.size} channel{selectedChannels.size !== 1 ? "s" : ""}</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Results phase */
          <>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {pushResults.filter((r) => r.success).length}
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">Queued in Buffer</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {pushResults.filter((r) => !r.success).length}
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">Failed</p>
                </div>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {pushResults.map((r) => {
                  const profile = bufferProfiles.find((p) => p.id === r.channelId);
                  return (
                    <div
                      key={r.channelId}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm ${r.success ? "bg-emerald-50" : "bg-red-50"}`}
                    >
                      {r.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-red-400 flex-shrink-0 flex items-center justify-center text-white text-xs">✕</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile?.name ?? r.channelId}</p>
                        {!r.success && r.error && (
                          <p className="text-xs text-red-600 truncate">{r.error}</p>
                        )}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${SERVICE_COLORS[profile?.service ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                        {SERVICE_LABELS[profile?.service ?? ""] ?? profile?.service}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({
  item,
  bufferProfiles,
  onRefresh,
}: {
  item: ContentItem;
  bufferProfiles: BufferProfile[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadVideoMutation = trpc.content.uploadVideo.useMutation({
    onSuccess: () => {
      setUploading(false);
      setUploadProgress(0);
      toast.success("Video uploaded!");
      onRefresh();
    },
    onError: (err) => {
      setUploading(false);
      setUploadProgress(0);
      toast.error("Upload failed: " + err.message);
    },
  });

  const { data: pushLogs = [], refetch: refetchLogs } = trpc.content.getVideoPushLogs.useQuery(
    { contentItemId: item.id },
    { enabled: showHistory }
  );

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4, MOV, etc.)");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File too large — maximum 500 MB");
      return;
    }
    setUploading(true);
    setUploadProgress(10);
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 60) + 10);
    };
    reader.onload = async () => {
      setUploadProgress(75);
      const base64Data = (reader.result as string).split(",")[1];
      uploadVideoMutation.mutate({
        contentItemId: item.id,
        base64Data,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  }, [item.id, uploadVideoMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: "bg-gray-100 text-gray-600" };
  const hasVideo = !!item.videoUrl;
  const pushCount = (pushLogs as PushLog[]).length;

  return (
    <Card className="border border-border bg-card hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasVideo ? "bg-emerald-100" : "bg-amber-100"}`}>
              {hasVideo ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold text-foreground truncate">{item.title}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{item.platform}</Badge>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${hasVideo ? "bg-emerald-100 text-emerald-700" : statusInfo.color}`}>
                  {hasVideo ? "Video Ready" : statusInfo.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Video upload / preview area */}
        {hasVideo ? (
          <div className="space-y-2">
            <video
              src={item.videoUrl!}
              controls
              className="w-full rounded-lg max-h-48 bg-black"
              preload="metadata"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => setShowPushDialog(true)}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Push to Channels
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowHistory(!showHistory);
                  if (!showHistory) refetchLogs();
                }}
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                History
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Replace video"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-colors cursor-pointer"
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" />
                <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs font-medium text-foreground">Drop finished video here</p>
                <p className="text-xs text-muted-foreground mt-0.5">MP4, MOV, WebM — up to 500 MB</p>
              </>
            )}
          </div>
        )}

        {/* Push history panel */}
        {showHistory && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Push History ({pushCount})
            </p>
            {(pushLogs as PushLog[]).length === 0 ? (
              <p className="text-xs text-muted-foreground">No pushes yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {(pushLogs as PushLog[]).map((log) => (
                  <div key={log.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${SERVICE_COLORS[log.service] ?? "bg-gray-100 text-gray-600"}`}>
                      {SERVICE_LABELS[log.service] ?? log.service}
                    </span>
                    <span className="flex-1 font-medium truncate">{log.channelName}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(log.pushedAt).toLocaleDateString()}
                    </span>
                    {(log.views ?? 0) > 0 && (
                      <span className="text-muted-foreground flex-shrink-0">
                        {log.views?.toLocaleString()} views
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Script preview (collapsed by default) */}
        {expanded && item.textContent && (
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
            {item.textContent}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />
      </CardContent>

      <MultiChannelPushDialog
        open={showPushDialog}
        onOpenChange={setShowPushDialog}
        item={item}
        bufferProfiles={bufferProfiles}
        onSuccess={() => {
          onRefresh();
          if (showHistory) refetchLogs();
        }}
      />
    </Card>
  );
}

// ─── VideoDeliveryHub ─────────────────────────────────────────────────────────

export default function VideoDeliveryHub() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const { data: allItems = [], refetch, isLoading } = trpc.content.list.useQuery();
  const { data: bufferProfiles = [] } = trpc.syndication.getProfiles.useQuery();

  // Only show video-relevant items
  const VIDEO_PLATFORMS = ["tiktok", "meta", "x", "youtube"];
  const videoItems = (allItems as ContentItem[]).filter((item) =>
    VIDEO_PLATFORMS.includes(item.platform)
  );

  const filtered = videoItems.filter((item) => {
    if (statusFilter !== "all") {
      if (statusFilter === "awaiting_video" && item.videoUrl) return false;
      if (statusFilter === "video_ready" && !item.videoUrl) return false;
      if (statusFilter === "scheduled" && item.status !== "scheduled") return false;
      if (statusFilter === "published" && item.status !== "published") return false;
    }
    if (platformFilter !== "all" && item.platform !== platformFilter) return false;
    return true;
  });

  const awaitingCount = videoItems.filter((i) => !i.videoUrl && i.status !== "published" && i.status !== "scheduled").length;
  const readyCount = videoItems.filter((i) => !!i.videoUrl && i.status !== "published" && i.status !== "scheduled").length;
  const scheduledCount = videoItems.filter((i) => i.status === "scheduled").length;
  const publishedCount = videoItems.filter((i) => i.status === "published").length;

  // Channel summary for the header
  const channelsByPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of bufferProfiles as BufferProfile[]) {
      const svc = p.service?.toLowerCase() ?? "other";
      map[svc] = (map[svc] ?? 0) + 1;
    }
    return map;
  }, [bufferProfiles]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Film className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Video Delivery Hub</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Upload finished videos, then push to multiple Buffer sub-accounts simultaneously to test what performs best.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Connected channels summary */}
      {Object.keys(channelsByPlatform).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>Connected channels:</span>
          </div>
          {Object.entries(channelsByPlatform).map(([svc, count]) => (
            <span
              key={svc}
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${SERVICE_COLORS[svc] ?? "bg-gray-100 text-gray-600"}`}
            >
              {SERVICE_LABELS[svc] ?? svc} × {count}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Awaiting Video", count: awaitingCount, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
          { label: "Video Ready", count: readyCount, color: "text-violet-600", bg: "bg-violet-50", icon: Video },
          { label: "Scheduled", count: scheduledCount, color: "text-blue-600", bg: "bg-blue-50", icon: Tv2 },
          { label: "Published", count: publishedCount, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
        ].map(({ label, count, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-xl p-3 ${bg} border border-border`}>
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="awaiting_video">Awaiting Video</SelectItem>
            <SelectItem value="video_ready">Video Ready</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="meta">Instagram / FB</SelectItem>
            <SelectItem value="x">X (Twitter)</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading scripts…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Film className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No video scripts found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Generate scripts in the Script Generator tab — they'll appear here automatically once saved to the Command Center.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <VideoCard
              key={item.id}
              item={item}
              bufferProfiles={bufferProfiles as BufferProfile[]}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
