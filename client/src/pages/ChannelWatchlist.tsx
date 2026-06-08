import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  Youtube,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

interface NewUpload {
  id: string;
  title: string;
  viewCount?: number;
  publishedAt?: string;
  thumbnail?: string;
}

export default function ChannelWatchlist() {
  const [, navigate] = useLocation();
  // ── Add channel form ────────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [channelNotes, setChannelNotes] = useState("");

  // ── New uploads panel ───────────────────────────────────────────────────────
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [channelUploads, setChannelUploads] = useState<Record<string, NewUpload[]>>({});
  const [fetchingUploads, setFetchingUploads] = useState<string | null>(null);

  // ── tRPC ────────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const { data: watchlistData, isLoading } = trpc.youtube.listTrackedChannels.useQuery();
  const channels = watchlistData?.channels ?? [];

  const trackMutation = trpc.youtube.trackChannel.useMutation({
    onSuccess: () => {
      utils.youtube.listTrackedChannels.invalidate();
      setChannelId("");
      setChannelName("");
      setChannelUrl("");
      setChannelNotes("");
      setShowAddForm(false);
      toast.success("Channel added to watchlist!");
    },
    onError: (err) => toast.error("Failed to track channel: " + err.message),
  });

  const untrackMutation = trpc.youtube.untrackChannel.useMutation({
    onSuccess: () => {
      utils.youtube.listTrackedChannels.invalidate();
      toast.success("Channel removed from watchlist.");
    },
    onError: (err) => toast.error("Failed to remove channel: " + err.message),
  });

  const uploadsMutation = trpc.youtube.getChannelNewUploads.useMutation({
    onSuccess: (data, vars) => {
      setChannelUploads((prev) => ({ ...prev, [vars.channelId]: data.videos as NewUpload[] }));
      setFetchingUploads(null);
      toast.success(`Found ${data.videos.length} recent upload${data.videos.length !== 1 ? "s" : ""}`);
    },
    onError: (err) => {
      setFetchingUploads(null);
      toast.error("Failed to fetch uploads: " + err.message);
    },
  });

  const digestMutation = trpc.youtube.runChannelDigest.useMutation({
    onSuccess: (data) => {
      if (data.sent) {
        toast.success(`Weekly digest sent for ${data.channelCount} channel${data.channelCount !== 1 ? "s" : ""}! Check your Manus notifications.`);
      } else {
        toast.info(data.message ?? "No channels to digest.");
      }
    },
    onError: (err) => toast.error("Digest failed: " + err.message),
  });

  const handleTrack = () => {
    if (!channelId.trim()) { toast.error("Channel ID is required"); return; }
    if (!channelName.trim()) { toast.error("Channel name is required"); return; }
    trackMutation.mutate({
      channelId: channelId.trim(),
      channelName: channelName.trim(),
      channelUrl: channelUrl.trim() || undefined,
      notes: channelNotes.trim() || undefined,
    });
  };

  const handleFetchUploads = (chId: string) => {
    setFetchingUploads(chId);
    setExpandedChannelId(chId);
    uploadsMutation.mutate({ channelId: chId, limit: 5 });
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Hub
            </Button>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <Rss className="h-6 w-6 text-red-500" />
              Competitor Channel Watchlist
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track competitor YouTube channels and get weekly digests of their newest uploads.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => digestMutation.mutate()}
              disabled={digestMutation.isPending || channels.length === 0}
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            >
              {digestMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Run Weekly Digest
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddForm((v) => !v)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Track Channel
            </Button>
          </div>
        </div>

        {/* Add Channel Form */}
        {showAddForm && (
          <Card className="border-red-500/30 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                Add Competitor Channel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Channel ID <span className="text-red-400">*</span></Label>
                  <Input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                    className="text-sm bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">Found in the channel URL: youtube.com/channel/<strong>UCxxx</strong></p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Channel Name <span className="text-red-400">*</span></Label>
                  <Input
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="e.g. Andrew Huberman"
                    className="text-sm bg-background/50"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Channel URL (optional)</Label>
                <Input
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="https://youtube.com/@hubermanlab"
                  className="text-sm bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Notes (why are we tracking this channel?)</Label>
                <Textarea
                  value={channelNotes}
                  onChange={(e) => setChannelNotes(e.target.value)}
                  placeholder="e.g. Overlapping audience on sleep & stress content. Strong hook style to study."
                  className="text-sm bg-background/50 min-h-[60px]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleTrack}
                  disabled={trackMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {trackMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add to Watchlist
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Channel List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading watchlist...
          </div>
        ) : channels.length === 0 ? (
          <Card className="border-dashed border-border bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Rss className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No channels tracked yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                Add competitor channels to monitor their uploads and get weekly digests delivered to your Manus notifications.
              </p>
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />Track First Channel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{channels.length} channel{channels.length !== 1 ? "s" : ""} tracked</p>
            {channels.map((ch) => {
              const uploads = channelUploads[ch.channelId] ?? [];
              const isExpanded = expandedChannelId === ch.channelId;
              const isFetching = fetchingUploads === ch.channelId;

              return (
                <Card key={ch.channelId} className="border-border bg-card overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Thumbnail or icon */}
                      {ch.thumbnail ? (
                        <img
                          src={ch.thumbnail}
                          alt={ch.channelName}
                          className="w-12 h-12 rounded-full object-cover shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                          <Youtube className="h-5 w-5 text-red-500" />
                        </div>
                      )}

                      {/* Channel info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{ch.channelName}</p>
                          {ch.subscriberCount && (
                            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                              {ch.subscriberCount.toLocaleString()} subs
                            </Badge>
                          )}
                          {ch.lastCheckedAt && (
                            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">
                              Checked {new Date(ch.lastCheckedAt).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        {ch.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ch.notes}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          ID: {ch.channelId} · Tracked {new Date(ch.trackedAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {ch.channelUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => window.open(ch.channelUrl!, "_blank")}
                            title="Open channel"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleFetchUploads(ch.channelId)}
                          disabled={isFetching}
                        >
                          {isFetching ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">New Uploads</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400"
                          onClick={() => {
                            if (confirm(`Remove ${ch.channelName} from watchlist?`)) {
                              untrackMutation.mutate({ channelId: ch.channelId });
                            }
                          }}
                          title="Remove from watchlist"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {uploads.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => setExpandedChannelId(isExpanded ? null : ch.channelId)}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* New uploads panel */}
                    {isExpanded && uploads.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Recent Uploads</p>
                        {uploads.map((v) => (
                          <div key={v.id} className="flex items-start gap-2 p-2 rounded-lg bg-background/40 border border-border/50">
                            {v.thumbnail && (
                              <img
                                src={v.thumbnail}
                                alt={v.title}
                                className="w-16 h-11 object-cover rounded shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{v.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {v.viewCount !== undefined && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Eye className="h-2.5 w-2.5" />{v.viewCount.toLocaleString()} views
                                  </span>
                                )}
                                {v.publishedAt && (
                                  <span className="text-[10px] text-muted-foreground">{formatDate(v.publishedAt)}</span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, "_blank")}
                              title="Watch on YouTube"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Digest info */}
        {channels.length > 0 && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Bell className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-300">Weekly Digest</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click <strong>Run Weekly Digest</strong> to check all {channels.length} tracked channel{channels.length !== 1 ? "s" : ""} for new uploads from the past 7 days and receive a summary in your Manus notifications. Run this manually each Monday morning, or ask to schedule it automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
