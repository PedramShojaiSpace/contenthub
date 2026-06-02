import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Youtube,
  Search,
  FileText,
  Zap,
  Eye,
  Clock,
  TrendingUp,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  ExternalLink,
  Play,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  viewCount: number;
  uploadDate: string;
  channelName: string;
  channelId: string;
  url: string;
}

interface TranscriptResult {
  videoId: string;
  text: string;
  lang: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VideoCard({
  video,
  selected,
  onToggle,
  transcript,
  transcriptLoading,
  outline,
  outlineLoading,
}: {
  video: VideoResult;
  selected: boolean;
  onToggle: () => void;
  transcript?: TranscriptResult;
  transcriptLoading?: boolean;
  outline?: string;
  outlineLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`transition-all border-2 ${
        selected
          ? "border-violet-400 bg-violet-50/40"
          : "border-border hover:border-violet-200"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0 w-28 h-16 rounded-md overflow-hidden bg-muted">
            {video.thumbnail ? (
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Youtube className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {video.duration > 0 && (
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                {formatDuration(video.duration)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:text-violet-600 line-clamp-2 leading-tight"
            >
              {video.title}
            </a>
            <p className="text-xs text-muted-foreground mt-0.5">{video.channelName}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                {formatViews(video.viewCount)}
              </span>
              {video.uploadDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {video.uploadDate}
                </span>
              )}
            </div>
          </div>

          {/* Select toggle */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <Button
              size="sm"
              variant={selected ? "default" : "outline"}
              className={`h-7 px-3 text-xs ${selected ? "bg-violet-600 hover:bg-violet-700" : ""}`}
              onClick={onToggle}
            >
              {selected ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Selected
                </>
              ) : (
                "Analyze"
              )}
            </Button>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-0.5"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Transcript / outline section */}
        {selected && (
          <div className="mt-3 pt-3 border-t border-border">
            {transcriptLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching transcript…
              </div>
            ) : transcript?.error ? (
              <p className="text-xs text-destructive">{transcript.error}</p>
            ) : transcript?.text ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Transcript ({transcript.text.length.toLocaleString()} chars)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={() => setExpanded((e) => !e)}
                  >
                    {expanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                {expanded && (
                  <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed">
                    {transcript.text.slice(0, 1500)}
                    {transcript.text.length > 1500 && "…"}
                  </div>
                )}
                {outlineLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Summarizing…
                  </div>
                ) : outline ? (
                  <div className="mt-2 text-xs text-foreground bg-violet-50/60 rounded p-2 whitespace-pre-wrap">
                    {outline}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function YouTubeIntelligence() {
  // Search state
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"views" | "relevance" | "date" | "rating">("views");
  const [uploadDate, setUploadDate] = useState<"all" | "week" | "month" | "year">("year");
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Transcript state
  const [transcripts, setTranscripts] = useState<Record<string, TranscriptResult>>({});
  const [transcriptLoading, setTranscriptLoading] = useState<Record<string, boolean>>({});
  const [outlines, setOutlines] = useState<Record<string, string>>({});
  const [outlineLoading, setOutlineLoading] = useState<Record<string, boolean>>({});

  // Analysis state
  const [brief, setBrief] = useState("");
  const [savedTitle, setSavedTitle] = useState("");

  // Mutations
  const searchMut = trpc.youtube.searchSimilar.useMutation();
  const transcriptMut = trpc.youtube.fetchTranscripts.useMutation();
  const summarizeMut = trpc.youtube.summarizeVideo.useMutation();
  const analyzeMut = trpc.youtube.analyzeCompetitors.useMutation();
  const saveMut = trpc.youtube.saveToScript.useMutation();

  // ── Step 1: Search ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Enter a topic to search");
      return;
    }
    setVideos([]);
    setSelectedIds(new Set());
    setTranscripts({});
    setOutlines({});
    setBrief("");
    try {
      const result = await searchMut.mutateAsync({
        query: query.trim(),
        limit: 8,
        sortBy,
        uploadDate,
      });
      setVideos(result.videos);
      if (result.videos.length === 0) {
        toast.info("No videos found. Try a different topic.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Search failed");
    }
  };

  // ── Step 2: Toggle selection + fetch transcript ─────────────────────────────

  const handleToggle = async (video: VideoResult) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(video.id)) {
      newSelected.delete(video.id);
      setSelectedIds(newSelected);
      return;
    }
    if (newSelected.size >= 3) {
      toast.warning("Select up to 3 videos for analysis");
      return;
    }
    newSelected.add(video.id);
    setSelectedIds(newSelected);

    // Fetch transcript
    if (!transcripts[video.id]) {
      setTranscriptLoading((prev) => ({ ...prev, [video.id]: true }));
      try {
        const result = await transcriptMut.mutateAsync({ videoIds: [video.id] });
        const t = result.transcripts[0];
        setTranscripts((prev) => ({ ...prev, [video.id]: t }));

        // Auto-summarize if transcript available
        if (t.text && !t.error) {
          setOutlineLoading((prev) => ({ ...prev, [video.id]: true }));
          try {
            const outlineResult = await summarizeMut.mutateAsync({
              videoId: video.id,
              title: video.title,
              channelName: video.channelName,
              transcript: t.text,
            });
            setOutlines((prev) => ({ ...prev, [video.id]: typeof outlineResult.outline === "string" ? outlineResult.outline : String(outlineResult.outline) }));
          } catch {
            // outline is optional — fail silently
          } finally {
            setOutlineLoading((prev) => ({ ...prev, [video.id]: false }));
          }
        }
      } catch (err: any) {
        setTranscripts((prev) => ({
          ...prev,
          [video.id]: { videoId: video.id, text: "", lang: "en", error: err?.message ?? "Failed" },
        }));
      } finally {
        setTranscriptLoading((prev) => ({ ...prev, [video.id]: false }));
      }
    }
  };

  // ── Step 3: Analyze ─────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least 1 video to analyze");
      return;
    }
    setBrief("");
    const videosForAnalysis = videos
      .filter((v) => selectedIds.has(v.id))
      .map((v: VideoResult) => ({
        videoId: v.id,
        title: v.title,
        channelName: v.channelName,
        viewCount: v.viewCount,
        transcript: transcripts[v.id]?.text ?? "",
      }));

    try {
      const result = await analyzeMut.mutateAsync({
        idea: query,
        videos: videosForAnalysis,
      });
      setBrief(typeof result.brief === "string" ? result.brief : String(result.brief ?? ""));
      setSavedTitle(`YouTube CI: ${query}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Analysis failed");
    }
  };

  // ── Step 4: Save ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!brief) return;
    try {
      await saveMut.mutateAsync({
        title: savedTitle || `YouTube CI: ${query}`,
        brief,
        topic: query,
        competitorAngle: `Analyzed ${selectedIds.size} competitor video(s)`,
      });
      toast.success("Saved to Script Library");
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    }
  };

  const selectedCount = selectedIds.size;
  const hasTranscriptsLoading = Array.from(selectedIds).some((id) => transcriptLoading[id]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto">
      <div className="max-w-5xl mx-auto w-full p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0">
            <Youtube className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">YouTube Intelligence</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Find what's winning on YouTube for any topic, extract transcripts, and generate a differentiation brief so your next video is better than anything out there.
            </p>
          </div>
        </div>

        {/* Step 1: Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">1</span>
              Search Competitor Videos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. gut health probiotics, sleep optimization, cortisol stress relief…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={searchMut.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {searchMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2">Search</span>
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Sort:</span>
                {(["views", "relevance", "date", "rating"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      sortBy === s
                        ? "bg-violet-100 border-violet-300 text-violet-700 font-medium"
                        : "border-border text-muted-foreground hover:border-violet-200"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Period:</span>
                {(["all", "week", "month", "year"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setUploadDate(d)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      uploadDate === d
                        ? "bg-violet-100 border-violet-300 text-violet-700 font-medium"
                        : "border-border text-muted-foreground hover:border-violet-200"
                    }`}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Select videos */}
        {videos.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">2</span>
                  Select Videos to Analyze
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount}/3 selected
                  </Badge>
                </CardTitle>
                {selectedCount > 0 && (
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzeMut.isPending || hasTranscriptsLoading}
                    className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-sm"
                  >
                    {analyzeMut.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        Generate Differentiation Brief
                      </>
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Click "Analyze" on up to 3 videos. Transcripts will be fetched automatically.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    selected={selectedIds.has(video.id)}
                    onToggle={() => handleToggle(video)}
                    transcript={transcripts[video.id]}
                    transcriptLoading={transcriptLoading[video.id]}
                    outline={outlines[video.id]}
                    outlineLoading={outlineLoading[video.id]}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Differentiation Brief */}
        {(analyzeMut.isPending || brief) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">3</span>
                  Differentiation Brief
                </CardTitle>
                {brief && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={savedTitle}
                      onChange={(e) => setSavedTitle(e.target.value)}
                      className="h-8 text-sm w-64"
                      placeholder="Script title…"
                    />
                    <Button
                      onClick={handleSave}
                      disabled={saveMut.isPending}
                      variant="outline"
                      className="h-8 text-sm"
                    >
                      {saveMut.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1.5">Save to Script Library</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {analyzeMut.isPending ? (
                <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                  <span className="text-sm">Analyzing competitor content and generating your differentiation brief…</span>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-foreground">
                  <Streamdown>{brief}</Streamdown>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {videos.length === 0 && !searchMut.isPending && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center mb-4">
              <Youtube className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Find What's Winning on YouTube</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter any health topic above to see the top-performing competitor videos. Select up to 3, fetch their transcripts, and get a differentiation brief that tells you exactly how to make a better video.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {["gut health probiotics", "sleep optimization", "cortisol stress", "qigong for beginners", "heavy metal detox"].map((t) => (
                <button
                  key={t}
                  onClick={() => { setQuery(t); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-violet-50 hover:text-violet-700 border border-border hover:border-violet-200 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
