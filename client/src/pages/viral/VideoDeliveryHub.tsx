import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, Play, Send, CheckCircle2, Clock, Loader2, Video, Tv2,
  ChevronDown, ChevronUp, ExternalLink, RefreshCw, Film
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
  avatarUrl?: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

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
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

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
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadVideoMutation = trpc.content.uploadVideo.useMutation({
    onSuccess: () => {
      setUploading(false);
      setUploadProgress(0);
      toast.success("Video uploaded successfully!");
      onRefresh();
    },
    onError: (err) => {
      setUploading(false);
      setUploadProgress(0);
      toast.error("Upload failed: " + err.message);
    },
  });

  const syndicationMutation = trpc.syndication.push.useMutation({
    onSuccess: (result) => {
      setPushing(false);
      setShowPushDialog(false);
      if (result.success) {
        toast.success("Video queued in Buffer!");
        onRefresh();
      } else {
        toast.error("Buffer push failed: " + (result.error ?? "Unknown error"));
      }
    },
    onError: (err) => {
      setPushing(false);
      toast.error("Buffer error: " + err.message);
    },
  });

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

    // Read file as base64
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 60) + 10);
      }
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

  const handlePushConfirm = () => {
    if (selectedChannels.size === 0) {
      toast.error("Select at least one channel");
      return;
    }
    const profileIds = Array.from(selectedChannels);
    const channelServiceMap: Record<string, string> = {};
    profileIds.forEach((id) => {
      const profile = bufferProfiles.find((p) => p.id === id);
      if (profile) channelServiceMap[id] = profile.service;
    });

    setPushing(true);
    syndicationMutation.mutate({
      contentItemId: item.id,
      text: item.textContent ?? item.title,
      profileIds,
      videoUrl: item.videoUrl ?? undefined,
      platform: item.platform,
      channelServiceMap,
    });
  };

  const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: "bg-gray-100 text-gray-600" };
  const hasVideo = !!item.videoUrl;

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
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
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
                onClick={() => {
                  setSelectedChannels(new Set());
                  setShowPushDialog(true);
                }}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Push to Buffer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Replace
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
                  <div
                    className="bg-violet-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
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

      {/* Buffer channel picker dialog */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-violet-500" />
              Push Video to Buffer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Select which channels to send this video to. Buffer will queue it for publishing.
            </p>
            {bufferProfiles.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                No Buffer channels connected. Add your Buffer token in Settings.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {bufferProfiles.map((profile) => (
                  <label
                    key={profile.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedChannels.has(profile.id)}
                      onCheckedChange={(checked) => {
                        setSelectedChannels((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(profile.id);
                          else next.delete(profile.id);
                          return next;
                        });
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {SERVICE_LABELS[profile.service] ?? profile.service}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPushDialog(false)} disabled={pushing}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handlePushConfirm}
              disabled={pushing || selectedChannels.size === 0}
            >
              {pushing ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Pushing…</>
              ) : (
                <><Send className="w-3.5 h-3.5 mr-1.5" />Push to {selectedChannels.size} channel{selectedChannels.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── VideoDeliveryHub ─────────────────────────────────────────────────────────

export default function VideoDeliveryHub() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const { data: allItems = [], refetch, isLoading } = trpc.content.list.useQuery();
  const { data: bufferProfiles = [] } = trpc.syndication.getProfiles.useQuery();

  // Only show video-relevant items: tiktok, instagram (meta), youtube, x
  const VIDEO_PLATFORMS = ["tiktok", "meta", "x", "youtube"];
  const videoItems = (allItems as ContentItem[]).filter((item) =>
    VIDEO_PLATFORMS.includes(item.platform)
  );

  // Apply filters
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

  // Stats
  const awaitingCount = videoItems.filter((i) => !i.videoUrl && i.status !== "published" && i.status !== "scheduled").length;
  const readyCount = videoItems.filter((i) => !!i.videoUrl && i.status !== "published" && i.status !== "scheduled").length;
  const scheduledCount = videoItems.filter((i) => i.status === "scheduled").length;
  const publishedCount = videoItems.filter((i) => i.status === "published").length;

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
            Upload finished videos from your edit team, then push directly to Buffer for all social channels.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

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
