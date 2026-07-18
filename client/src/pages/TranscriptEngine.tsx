/**
 * Transcript Engine — Phase A
 *
 * Supadata-powered YouTube transcript fetcher.
 * Features:
 *   - Quota gauge (daily 25-call cap)
 *   - One-click channel backfill
 *   - Manual transcript paste
 *   - Filterable transcript library table
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Quota Gauge ──────────────────────────────────────────────────────────────

function QuotaGauge() {
  const { data: quota, refetch } = trpc.transcripts.getQuotaStatus.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  if (!quota) return null;

  const pct = Math.round((quota.unitsUsed / quota.dailyLimit) * 100);
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="bg-white border rounded-lg p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" />
            Daily Quota — {quota.date}
          </span>
          <span className="text-sm font-mono">
            {quota.unitsUsed} / {quota.dailyLimit} calls
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {quota.remaining} calls remaining today (~$
          {(quota.remaining * 0.02).toFixed(2)} budget)
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => refetch()}>
        <RefreshCw className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewVideoId, setViewVideoId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: transcripts = [], isLoading } = trpc.transcripts.listTranscripts.useQuery({
    status: filterStatus === "all" ? undefined : (filterStatus as "fetched" | "pending" | "no_transcript" | "error"),
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const { data: stats } = trpc.transcripts.getStats.useQuery();

  const { data: fullTranscript } = trpc.transcripts.getTranscript.useQuery(
    { videoId: viewVideoId! },
    { enabled: viewVideoId !== null }
  );

  const deleteTranscript = trpc.transcripts.deleteTranscript.useMutation({
    onSuccess: () => {
      toast.success("Transcript deleted");
      utils.transcripts.listTranscripts.invalidate();
      utils.transcripts.getStats.invalidate();
    },
  });

  const fetchSingle = trpc.transcripts.fetchTranscript.useMutation({
    onSuccess: (data) => {
      if (data.status === "fetched") {
        toast.success(`Fetched: ${data.wordCount?.toLocaleString()} words`);
      } else if (data.status === "already_fetched") {
        toast.info("Already fetched");
      } else {
        toast.warning(`No transcript available for this video`);
      }
      utils.transcripts.listTranscripts.invalidate();
      utils.transcripts.getStats.invalidate();
      utils.transcripts.getQuotaStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function statusBadge(status: string) {
    switch (status) {
      case "fetched":
        return <Badge className="bg-green-100 text-green-800 border-0 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Fetched</Badge>;
      case "no_transcript":
        return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs"><XCircle className="w-3 h-3 mr-1" />No transcript</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-700 border-0 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{stats.total} total</span>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">{stats.fetched} fetched</span>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium">{stats.totalWords.toLocaleString()} words</span>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">{stats.noTranscript} no transcript</span>
          </div>
          {stats.errors > 0 && (
            <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">{stats.errors} errors</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or video ID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="fetched">Fetched</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="no_transcript">No transcript</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : transcripts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No transcripts yet</p>
          <p className="text-sm mt-1">Use the Backfill tab to start pulling transcripts from your channel</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Video</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[120px]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[90px]">Words</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[80px]">Lang</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[100px]">Fetched</th>
                <th className="px-4 py-3 w-[100px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transcripts.map((t) => (
                <tr key={t.videoId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      className="text-left font-medium hover:text-primary transition-colors flex items-center gap-1 group"
                      onClick={() => t.status === "fetched" && setViewVideoId(t.videoId)}
                    >
                      <span className="line-clamp-1">{t.videoTitle ?? t.videoId}</span>
                      {t.status === "fetched" && (
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      )}
                    </button>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.videoId}</p>
                  </td>
                  <td className="px-4 py-3">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {t.wordCount ? t.wordCount.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">{t.lang ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.fetchedAt ? new Date(t.fetchedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    {(t.status === "error" || t.status === "pending") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        title="Retry fetch"
                        onClick={() =>
                          fetchSingle.mutate({
                            videoId: t.videoId,
                            videoTitle: t.videoTitle ?? undefined,
                            channelId: t.channelId,
                          })
                        }
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Delete this transcript?")) {
                          deleteTranscript.mutate({ videoId: t.videoId });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full transcript dialog */}
      <Dialog open={viewVideoId !== null} onOpenChange={(o) => !o && setViewVideoId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {fullTranscript?.videoTitle ?? viewVideoId}
            </DialogTitle>
          </DialogHeader>
          {fullTranscript && (
            <div className="space-y-3">
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{fullTranscript.videoId}</span>
                <span>·</span>
                <span>{fullTranscript.wordCount?.toLocaleString()} words</span>
                <span>·</span>
                <span>{fullTranscript.lang}</span>
                <span>·</span>
                <span>{fullTranscript.provider}</span>
              </div>
              <div className="bg-muted/20 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
                {fullTranscript.rawText}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([fullTranscript.rawText ?? ""], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${fullTranscript.videoId}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download .txt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`https://www.youtube.com/watch?v=${fullTranscript.videoId}`, "_blank");
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Watch on YouTube
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Backfill Tab ─────────────────────────────────────────────────────────────

function BackfillTab() {
  const utils = trpc.useUtils();
  const [lastResult, setLastResult] = useState<{
    fetched: number;
    noTranscript: number;
    errors: number;
    skipped: number;
    quotaUsed: number;
    quotaRemaining: number;
    nextPageToken: string | null;
    message: string;
  } | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);

  const backfill = trpc.transcripts.backfillChannel.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      // Advance the page token so the next manual run continues where this one left off
      setPageToken(data.nextPageToken ?? undefined);
      toast.success(data.message);
      utils.transcripts.listTranscripts.invalidate();
      utils.transcripts.getStats.invalidate();
      utils.transcripts.getQuotaStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 text-sm mb-1">How backfill works</h3>
        <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside">
          <li>Fetches your channel's upload playlist from the YouTube Data API</li>
          <li>For each video not yet in the library, calls Supadata to get the transcript</li>
          <li>Respects the 25-call/day quota — stops automatically when exhausted</li>
          <li>Videos with no available transcript are marked and skipped on retry</li>
          <li>Run daily to build up your full transcript corpus over time</li>
          {pageToken && <li className="text-blue-600 font-medium">▶ Continuing from where last run left off (page 2+)</li>}
        </ul>
      </div>

      <QuotaGauge />

      <Button
        onClick={() => backfill.mutate({ maxVideos: 25, pageToken })}
        disabled={backfill.isPending}
        className="w-full"
        size="lg"
      >
        {backfill.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Fetching transcripts...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Run Backfill (up to 25 videos)
          </>
        )}
      </Button>

      {lastResult && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm">Last Run Results</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm">{lastResult.fetched} transcripts fetched</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{lastResult.noTranscript} no transcript</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm">{lastResult.errors} errors</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm">{lastResult.skipped} already done</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Quota: {lastResult.quotaUsed} used, {lastResult.quotaRemaining} remaining today
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Manual Paste Tab ─────────────────────────────────────────────────────────

function ManualPasteTab() {
  const utils = trpc.useUtils();
  const [videoId, setVideoId] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [lang, setLang] = useState("en");

  const pasteTranscript = trpc.transcripts.pasteTranscript.useMutation({
    onSuccess: (data) => {
      toast.success(`Saved: ${data.wordCount.toLocaleString()} words`);
      setVideoId("");
      setVideoTitle("");
      setRawText("");
      utils.transcripts.listTranscripts.invalidate();
      utils.transcripts.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-amber-800 text-sm">
          Use this for videos where Supadata can't retrieve the transcript automatically
          (e.g., auto-generated captions not available, private videos, or older content).
          Paste the full transcript text here.
        </p>
      </div>

      <div className="space-y-2">
        <Label>YouTube Video ID <span className="text-destructive">*</span></Label>
        <Input
          placeholder="e.g. dQw4w9WgXcQ"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Found in the YouTube URL: youtube.com/watch?v=<strong>VIDEO_ID</strong>
        </p>
      </div>

      <div className="space-y-2">
        <Label>Video Title (optional)</Label>
        <Input
          placeholder="e.g. How to Fix Your Gut in 30 Days"
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
            <SelectItem value="pt">Portuguese</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Transcript Text <span className="text-destructive">*</span></Label>
        <Textarea
          placeholder="Paste the full transcript text here..."
          className="min-h-[280px] font-mono text-sm"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {rawText.length.toLocaleString()} characters · ~{Math.round(rawText.trim().split(/\s+/).filter(Boolean).length).toLocaleString()} words
        </p>
      </div>

      <Button
        onClick={() =>
          pasteTranscript.mutate({ videoId, videoTitle: videoTitle || undefined, rawText, lang })
        }
        disabled={pasteTranscript.isPending || !videoId.trim() || rawText.trim().length < 50}
        className="w-full"
        size="lg"
      >
        {pasteTranscript.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            Save Transcript
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Outlier Detector Tab ────────────────────────────────────────────────────

function OutlierDetectorTab() {
  const { data: stats } = trpc.outliers.getOutlierStats.useQuery();
  const { data: baseline } = trpc.outliers.getBaseline.useQuery({ windowDays: 90 });
  const { data: outliers, refetch: refetchOutliers, isLoading } = trpc.outliers.listOutliers.useQuery({
    onlyOutliers: false,
    limit: 100,
    offset: 0,
    sortBy: "outlier_score",
  });

  const utils = trpc.useUtils();

  const scoreAll = trpc.outliers.scoreAll.useMutation({
    onSuccess: (result) => {
      toast.success(`Scored ${result.scored} videos — ${result.outliers} outliers found`);
      refetchOutliers();
      utils.outliers.getOutlierStats.invalidate();
      utils.outliers.getBaseline.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const fmt = (n: number | null | undefined, decimals = 2) =>
    n == null ? "—" : (n * 100).toFixed(decimals) + "%";
  const fmtZ = (n: number | null | undefined) =>
    n == null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2) + "σ";

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Videos Scored</p>
          <p className="text-2xl font-bold">{stats?.total ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Outliers Found</p>
          <p className="text-2xl font-bold text-amber-500">{stats?.outliers ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Baseline CTR (90d)</p>
          <p className="text-2xl font-bold">{fmt(baseline?.ctrMean)}</p>
          <p className="text-xs text-muted-foreground">±{fmt(baseline?.ctrStddev)} σ</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Baseline Retention (90d)</p>
          <p className="text-2xl font-bold">{fmt(baseline?.retentionMean)}</p>
          <p className="text-xs text-muted-foreground">±{fmt(baseline?.retentionStddev)} σ</p>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => scoreAll.mutate({ windowDays: 90 })}
          disabled={scoreAll.isPending}
          className="flex items-center gap-2"
        >
          {scoreAll.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Scoring...</>
          ) : (
            <><TrendingUp className="w-4 h-4" />Score All Videos</>  
          )}
        </Button>
        <p className="text-sm text-muted-foreground">
          Compares each video's CTR and retention against the 90-day channel baseline. Outlier threshold: 1.5σ.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : !outliers || outliers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No videos scored yet. Click "Score All Videos" to begin.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Video</th>
                <th className="text-right py-2 px-2 font-medium">CTR</th>
                <th className="text-right py-2 px-2 font-medium">CTR z</th>
                <th className="text-right py-2 px-2 font-medium">Retention</th>
                <th className="text-right py-2 px-2 font-medium">Ret. z</th>
                <th className="text-right py-2 px-2 font-medium">Score</th>
                <th className="text-center py-2 pl-2 font-medium">Outlier</th>
              </tr>
            </thead>
            <tbody>
              {outliers.map((row) => (
                <tr key={row.videoId} className={`border-b hover:bg-muted/30 ${row.isOutlier ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                  <td className="py-2 pr-4 max-w-[280px]">
                    <a
                      href={`https://youtube.com/watch?v=${row.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline line-clamp-2 text-xs"
                    >
                      {row.videoTitle ?? row.videoId}
                    </a>
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">{fmt(row.ctrScore)}</td>
                  <td className={`text-right py-2 px-2 tabular-nums font-mono text-xs ${(row.ctrZScore ?? 0) > 1.5 ? "text-green-600" : (row.ctrZScore ?? 0) < -1.5 ? "text-red-500" : ""}`}>{fmtZ(row.ctrZScore)}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{fmt(row.retentionScore)}</td>
                  <td className={`text-right py-2 px-2 tabular-nums font-mono text-xs ${(row.retentionZScore ?? 0) > 1.5 ? "text-green-600" : (row.retentionZScore ?? 0) < -1.5 ? "text-red-500" : ""}`}>{fmtZ(row.retentionZScore)}</td>
                  <td className="text-right py-2 px-2 tabular-nums font-semibold">{row.outlierScore?.toFixed(2) ?? "—"}</td>
                  <td className="text-center py-2 pl-2">
                    {row.isOutlier ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">⚡ Outlier</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TranscriptEngine() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Transcript Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Pull YouTube transcripts via Supadata (25/day) to build the corpus for the Script Factory.
          </p>
        </div>

        {/* Quota gauge always visible */}
        <QuotaGauge />

        {/* Tabs */}
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="backfill" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Backfill Channel
            </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Manual Paste
          </TabsTrigger>
          <TabsTrigger value="outliers" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Outlier Detector
          </TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="mt-4">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="backfill" className="mt-4">
            <BackfillTab />
          </TabsContent>
          <TabsContent value="manual" className="mt-4">
            <ManualPasteTab />
          </TabsContent>
          <TabsContent value="outliers" className="mt-4">
            <OutlierDetectorTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
