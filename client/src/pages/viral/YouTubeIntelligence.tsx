import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  BarChart2,
  Flame,
  Users,
  Activity,
  Film,
  AlignLeft,
  ThumbsUp,
  MessageSquare,
  Star,
  Target,
  Layers,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function outlierColor(score: number): string {
  if (score >= 3) return "text-red-600 bg-red-50 border-red-200";
  if (score >= 2) return "text-orange-600 bg-orange-50 border-orange-200";
  if (score >= 1.5) return "text-amber-600 bg-amber-50 border-amber-200";
  if (score >= 1) return "text-green-600 bg-green-50 border-green-200";
  return "text-muted-foreground bg-muted border-border";
}

function outlierLabel(score: number): string {
  if (score >= 3) return "🔥 Viral";
  if (score >= 2) return "⚡ Strong";
  if (score >= 1.5) return "↑ Above Avg";
  if (score >= 1) return "✓ On Par";
  return "↓ Below Avg";
}

// ─── Shared Video Card ────────────────────────────────────────────────────────

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  channelName: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  uploadDate: string;
  duration: number;
  isShort: boolean;
  url: string;
  outlierScore: number;
  viewVelocity: number;
}

function VideoRow({
  video,
  rank,
  showVelocity,
}: {
  video: VideoItem;
  rank: number;
  showVelocity?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-violet-200 hover:bg-violet-50/20 transition-colors">
      {/* Rank */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-24 h-14 rounded overflow-hidden bg-muted relative">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        {video.duration > 0 && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded">
            {video.isShort ? "Short" : fmtDuration(video.duration)}
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
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="w-3 h-3" /> {fmtViews(video.viewCount)}
          </span>
          {video.likeCount !== undefined && video.likeCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ThumbsUp className="w-3 h-3" /> {fmtViews(video.likeCount)}
            </span>
          )}
          {video.commentCount !== undefined && video.commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="w-3 h-3" /> {fmtViews(video.commentCount)}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {fmtDate(video.uploadDate)}
          </span>
          {showVelocity && video.viewVelocity > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <Activity className="w-3 h-3" /> {fmtViews(video.viewVelocity)}/day
            </span>
          )}
        </div>
      </div>

      {/* Outlier Score */}
      <div className="flex-shrink-0 text-right">
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${outlierColor(video.outlierScore)}`}>
          <Star className="w-3 h-3" />
          {video.outlierScore.toFixed(2)}x
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{outlierLabel(video.outlierScore)}</p>
      </div>
    </div>
  );
}

// ─── Tab: Competitor Video Search (original) ──────────────────────────────────

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
    <Card className={`transition-all border-2 ${selected ? "border-violet-400 bg-violet-50/40" : "border-border hover:border-violet-200"}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0 w-28 h-16 rounded-md overflow-hidden bg-muted">
            {video.thumbnail ? (
              <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Youtube className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {video.duration > 0 && (
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                {fmtDuration(video.duration)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:text-violet-600 line-clamp-2 leading-tight">
              {video.title}
            </a>
            <p className="text-xs text-muted-foreground mt-0.5">{video.channelName}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="w-3 h-3" />{fmtViews(video.viewCount)}</span>
              {video.uploadDate && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{video.uploadDate}</span>}
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <Button size="sm" variant={selected ? "default" : "outline"} className={`h-7 px-3 text-xs ${selected ? "bg-violet-600 hover:bg-violet-700" : ""}`} onClick={onToggle}>
              {selected ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Selected</> : "Analyze"}
            </Button>
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-violet-600">
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        {selected && (
          <div className="mt-3 pt-3 border-t border-border">
            {transcriptLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Fetching transcript…</div>
            ) : transcript?.error ? (
              <p className="text-xs text-destructive">{transcript.error}</p>
            ) : transcript?.text ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Transcript ({transcript.text.length.toLocaleString()} chars)</span>
                  <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => setExpanded((e) => !e)}>
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </div>
                {expanded && (
                  <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed">
                    {transcript.text.slice(0, 1500)}{transcript.text.length > 1500 && "…"}
                  </div>
                )}
                {outlineLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2"><Loader2 className="w-3 h-3 animate-spin" />Summarizing…</div>
                ) : outline ? (
                  <div className="mt-2 text-xs text-foreground bg-violet-50/60 rounded p-2 whitespace-pre-wrap">{outline}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorSearchTab() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"views" | "relevance" | "date" | "rating">("views");
  const [uploadDate, setUploadDate] = useState<"all" | "week" | "month" | "year">("year");
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transcripts, setTranscripts] = useState<Record<string, TranscriptResult>>({});
  const [transcriptLoading, setTranscriptLoading] = useState<Record<string, boolean>>({});
  const [outlines, setOutlines] = useState<Record<string, string>>({});
  const [outlineLoading, setOutlineLoading] = useState<Record<string, boolean>>({});
  const [brief, setBrief] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [teleprompterScript, setTeleprompterScript] = useState("");
  const [teleprompterWordCount, setTeleprompterWordCount] = useState(0);
  const [teleprompterMinutes, setTeleprompterMinutes] = useState(0);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [scriptCopied, setScriptCopied] = useState(false);

  const searchMut = trpc.youtube.searchSimilar.useMutation();
  const transcriptMut = trpc.youtube.fetchTranscripts.useMutation();
  const summarizeMut = trpc.youtube.summarizeVideo.useMutation();
  const analyzeMut = trpc.youtube.analyzeCompetitors.useMutation();
  const saveMut = trpc.youtube.saveToScript.useMutation();
  const scriptMut = trpc.youtube.generateTeleprompterScript.useMutation();

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Enter a topic to search"); return; }
    setVideos([]); setSelectedIds(new Set()); setTranscripts({}); setOutlines({}); setBrief("");
    try {
      const result = await searchMut.mutateAsync({ query: query.trim(), limit: 8, sortBy, uploadDate });
      setVideos(result.videos);
      if (result.videos.length === 0) toast.info("No videos found. Try a different topic.");
    } catch (err: any) { toast.error(err?.message ?? "Search failed"); }
  };

  const handleToggle = async (video: VideoResult) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(video.id)) { newSelected.delete(video.id); setSelectedIds(newSelected); return; }
    if (newSelected.size >= 3) { toast.warning("Select up to 3 videos for analysis"); return; }
    newSelected.add(video.id); setSelectedIds(newSelected);
    if (!transcripts[video.id]) {
      setTranscriptLoading((prev) => ({ ...prev, [video.id]: true }));
      try {
        const result = await transcriptMut.mutateAsync({ videoIds: [video.id] });
        const t = result.transcripts[0];
        setTranscripts((prev) => ({ ...prev, [video.id]: t }));
        if (t.text && !t.error) {
          setOutlineLoading((prev) => ({ ...prev, [video.id]: true }));
          try {
            const outlineResult = await summarizeMut.mutateAsync({ videoId: video.id, title: video.title, channelName: video.channelName, transcript: t.text });
            setOutlines((prev) => ({ ...prev, [video.id]: typeof outlineResult.outline === "string" ? outlineResult.outline : String(outlineResult.outline) }));
          } catch { /* outline optional */ } finally { setOutlineLoading((prev) => ({ ...prev, [video.id]: false })); }
        }
      } catch (err: any) {
        setTranscripts((prev) => ({ ...prev, [video.id]: { videoId: video.id, text: "", lang: "en", error: err?.message ?? "Failed" } }));
      } finally { setTranscriptLoading((prev) => ({ ...prev, [video.id]: false })); }
    }
  };

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) { toast.error("Select at least 1 video to analyze"); return; }
    setBrief("");
    const videosForAnalysis = videos.filter((v) => selectedIds.has(v.id)).map((v) => ({
      videoId: v.id, title: v.title, channelName: v.channelName, viewCount: v.viewCount, transcript: transcripts[v.id]?.text ?? "",
    }));
    try {
      const result = await analyzeMut.mutateAsync({ idea: query, videos: videosForAnalysis });
      setBrief(typeof result.brief === "string" ? result.brief : String(result.brief ?? ""));
      setSavedTitle(`YouTube CI: ${query}`);
    } catch (err: any) { toast.error(err?.message ?? "Analysis failed"); }
  };

  const handleGenerateScript = async () => {
    if (!brief) return;
    setTeleprompterScript("");
    try {
      const result = await scriptMut.mutateAsync({ topic: query, brief, durationMinutes });
      setTeleprompterScript(result.script);
      setTeleprompterWordCount(result.wordCount);
      setTeleprompterMinutes(result.estimatedMinutes);
      setShowTeleprompter(true);
    } catch (err: any) { toast.error(err?.message ?? "Script generation failed"); }
  };

  const handleCopyScript = async () => {
    if (!teleprompterScript) return;
    try {
      await navigator.clipboard.writeText(teleprompterScript);
      setScriptCopied(true);
      toast.success("Script copied to clipboard — paste into your teleprompter app");
      setTimeout(() => setScriptCopied(false), 3000);
    } catch { toast.error("Copy failed — please select and copy manually"); }
  };

  const handleSave = async () => {
    if (!brief) return;
    try {
      await saveMut.mutateAsync({ title: savedTitle || `YouTube CI: ${query}`, brief, topic: query, competitorAngle: `Analyzed ${selectedIds.size} competitor video(s)` });
      toast.success("Saved to Script Library");
    } catch (err: any) { toast.error(err?.message ?? "Save failed"); }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">1</span>
            Search Competitor Videos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. gut health probiotics, sleep optimization, cortisol stress relief…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1" />
            <Button onClick={handleSearch} disabled={searchMut.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
              {searchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sort:</span>
              {(["views", "relevance", "date", "rating"] as const).map((s) => (
                <button key={s} onClick={() => setSortBy(s)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${sortBy === s ? "bg-violet-100 border-violet-300 text-violet-700 font-medium" : "border-border text-muted-foreground hover:border-violet-200"}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Period:</span>
              {(["all", "week", "month", "year"] as const).map((d) => (
                <button key={d} onClick={() => setUploadDate(d)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${uploadDate === d ? "bg-violet-100 border-violet-300 text-violet-700 font-medium" : "border-border text-muted-foreground hover:border-violet-200"}`}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {videos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">2</span>
                Select Videos to Analyze
                <Badge variant="secondary" className="text-xs">{selectedIds.size}/3 selected</Badge>
              </CardTitle>
              {selectedIds.size > 0 && (
                <Button onClick={handleAnalyze} disabled={analyzeMut.isPending} className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-sm">
                  {analyzeMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Analyzing…</> : <><Zap className="w-3.5 h-3.5 mr-1.5" />Generate Differentiation Brief</>}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} selected={selectedIds.has(video.id)} onToggle={() => handleToggle(video)} transcript={transcripts[video.id]} transcriptLoading={transcriptLoading[video.id]} outline={outlines[video.id]} outlineLoading={outlineLoading[video.id]} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(analyzeMut.isPending || brief) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">3</span>
                Differentiation Brief
              </CardTitle>
              {brief && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Duration:</span>
                    {([3, 5, 8, 10, 15] as const).map((m) => (
                      <button key={m} onClick={() => setDurationMinutes(m)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${durationMinutes === m ? "bg-violet-100 border-violet-300 text-violet-700 font-medium" : "border-border text-muted-foreground hover:border-violet-200"}`}>{m}m</button>
                    ))}
                  </div>
                  <Button onClick={handleGenerateScript} disabled={scriptMut.isPending} className="bg-red-600 hover:bg-red-700 text-white h-8 text-sm">
                    {scriptMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Writing Script…</> : <><Film className="w-3.5 h-3.5 mr-1.5" />Generate Teleprompter Script</>}
                  </Button>
                  <Input value={savedTitle} onChange={(e) => setSavedTitle(e.target.value)} className="h-8 text-sm w-52" placeholder="Script title…" />
                  <Button onClick={handleSave} disabled={saveMut.isPending} variant="outline" className="h-8 text-sm">
                    {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="ml-1.5">Save Brief</span>
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
              <div className="prose prose-sm max-w-none text-foreground"><Streamdown>{brief}</Streamdown></div>
            )}
          </CardContent>
        </Card>
      )}

      {videos.length === 0 && !searchMut.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center mb-4">
            <Youtube className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Find What's Winning on YouTube</h3>
          <p className="text-sm text-muted-foreground max-w-md">Search any health topic to see top competitor videos, fetch transcripts, and generate a differentiation brief.</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {["gut health probiotics", "sleep optimization", "cortisol stress", "qigong for beginners", "heavy metal detox"].map((t) => (
              <button key={t} onClick={() => setQuery(t)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-violet-50 hover:text-violet-700 border border-border hover:border-violet-200 transition-colors">{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Teleprompter Script Modal ── */}
      {showTeleprompter && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setShowTeleprompter(false); }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Teleprompter Script</h2>
                <p className="text-white/50 text-xs">{teleprompterWordCount.toLocaleString()} words · ~{teleprompterMinutes} min · {query}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCopyScript}
                className={`h-9 px-4 text-sm font-medium transition-all ${scriptCopied ? "bg-green-600 hover:bg-green-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
              >
                {scriptCopied ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Copied!</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" />Copy to Clipboard</>
                )}
              </Button>
              <button
                onClick={() => setShowTeleprompter(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors text-lg font-light"
              >
                ×
              </button>
            </div>
          </div>

          {/* Script body — teleprompter-optimized */}
          <div className="flex-1 overflow-y-auto px-8 py-8 md:px-24 lg:px-48">
            {scriptMut.isPending ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-red-500" />
                <p className="text-white/60 text-sm">Writing your teleprompter script with a viral hook…</p>
              </div>
            ) : (
              <div className="space-y-6">
                {teleprompterScript.split(/\n\n+/).filter(Boolean).map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-white leading-relaxed text-2xl md:text-3xl font-light tracking-wide"
                    style={{ lineHeight: "1.75" }}
                  >
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-6 py-3 border-t border-white/10 bg-black flex items-center justify-between">
            <p className="text-white/30 text-xs">Scroll to read · Large text optimized for teleprompter display</p>
            <p className="text-white/30 text-xs">Click outside or × to close</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Channel Analyzer ────────────────────────────────────────────────────

function ChannelAnalyzerTab() {
  const [handle, setHandle] = useState("");
  const [result, setResult] = useState<any>(null);
  const analyzeMut = trpc.youtube.analyzeChannel.useMutation();

  const handleAnalyze = async () => {
    if (!handle.trim()) { toast.error("Enter a channel handle or ID"); return; }
    setResult(null);
    try {
      const data = await analyzeMut.mutateAsync({ channelHandle: handle.trim(), videoLimit: 50 });
      setResult(data);
    } catch (err: any) { toast.error(err?.message ?? "Analysis failed"); }
  };

  const ch = result?.channel;
  const top10 = result?.top10ByViews ?? [];
  const lv = result?.longsVsShorts;

  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-600" />
            Channel Deep Analyzer
          </CardTitle>
          <p className="text-xs text-muted-foreground">Enter a YouTube channel handle (e.g. @drberg) or channel ID to get full stats, top 10 videos with outlier scores, upload frequency, and longs vs shorts breakdown.</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="@channelhandle or UCxxxxxxx" value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAnalyze()} className="flex-1" />
            <Button onClick={handleAnalyze} disabled={analyzeMut.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
              {analyzeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Analyze</span>
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {["@drberg", "@hubermanlab", "@andrewweil", "@markhydman", "@rhondapatrick"].map((h) => (
              <button key={h} onClick={() => setHandle(h)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-violet-50 hover:text-violet-700 border border-border hover:border-violet-200 transition-colors">{h}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {analyzeMut.isPending && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
          <span className="text-sm">Fetching channel data and computing outlier scores…</span>
        </div>
      )}

      {ch && (
        <>
          {/* Channel Overview */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {ch.thumbnail && <img src={ch.thumbnail} alt={ch.title} className="w-16 h-16 rounded-full border border-border flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-foreground">{ch.title}</h3>
                  {ch.country && <p className="text-xs text-muted-foreground">{ch.country}</p>}
                  {ch.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ch.description}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Subscribers</p>
                  <p className="text-xl font-bold text-foreground">{fmtViews(ch.subscriberCount)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Views</p>
                  <p className="text-xl font-bold text-foreground">{fmtViews(ch.viewCount)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Avg Views/Video</p>
                  <p className="text-xl font-bold text-foreground">{fmtViews(ch.avgViewsPerVideo)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Upload Frequency</p>
                  <p className="text-xl font-bold text-foreground">{ch.uploadFrequencyLabel}</p>
                  <p className="text-[10px] text-muted-foreground">{ch.uploadsPerWeek}x/week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Longs vs Shorts */}
          {lv && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Film className="w-4 h-4 text-violet-600" />Longs vs Shorts Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-blue-700 mb-2">Long-form Videos</p>
                    <p className="text-2xl font-bold text-blue-800">{lv.longsCount}</p>
                    <p className="text-xs text-blue-600 mt-1">{fmtViews(lv.longsViews)} total views</p>
                    <p className="text-xs text-blue-600">{fmtViews(lv.longsAvgViews)} avg/video</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-rose-700 mb-2">YouTube Shorts</p>
                    <p className="text-2xl font-bold text-rose-800">{lv.shortsCount}</p>
                    <p className="text-xs text-rose-600 mt-1">{fmtViews(lv.shortsViews)} total views</p>
                    <p className="text-xs text-rose-600">{fmtViews(lv.shortsAvgViews)} avg/video</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${lv.totalVideos > 0 ? (lv.longsCount / lv.totalVideos) * 100 : 50}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Longs {lv.totalVideos > 0 ? Math.round((lv.longsCount / lv.totalVideos) * 100) : 0}%</span>
                  <span>Shorts {lv.totalVideos > 0 ? Math.round((lv.shortsCount / lv.totalVideos) * 100) : 0}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 10 Videos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                Top 10 Videos by View Count
                <span className="text-xs text-muted-foreground font-normal ml-1">with outlier scores vs channel average</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top10.map((video: VideoItem, i: number) => (
                  <VideoRow key={video.id} video={video} rank={i + 1} />
                ))}
              </div>
              <div className="mt-4 p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Outlier Score</strong> = video views ÷ channel average views per video. Score of 2.0x means this video got twice the channel's average views — a strong signal of viral content.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!ch && !analyzeMut.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
            <BarChart2 className="w-7 h-7 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Deep Channel Analysis</h3>
          <p className="text-sm text-muted-foreground max-w-md">Enter any YouTube channel handle to see their top 10 videos, outlier scores, upload frequency, and longs vs shorts breakdown — everything ViewStats shows and more.</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Outlier Finder ──────────────────────────────────────────────────────

function OutlierFinderTab() {
  const [query, setQuery] = useState("");
  const [uploadDate, setUploadDate] = useState<"all" | "week" | "month" | "year">("year");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const findMut = trpc.youtube.getOutlierVideos.useMutation();

  const handleFind = async () => {
    if (!query.trim()) { toast.error("Enter a topic"); return; }
    setVideos([]);
    try {
      const result = await findMut.mutateAsync({ query: query.trim(), uploadDate, limit: 25 });
      setVideos(result.videos as VideoItem[]);
      if (result.videos.length === 0) toast.info("No videos found. Try a broader topic.");
    } catch (err: any) { toast.error(err?.message ?? "Search failed"); }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Outlier Video Finder
          </CardTitle>
          <p className="text-xs text-muted-foreground">Find the 10 videos on any topic that massively outperformed their channel's average. These are the viral outliers — the content ideas that broke through.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. sleep optimization, gut microbiome, stress hormones…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFind()} className="flex-1" />
            <Button onClick={handleFind} disabled={findMut.isPending} className="bg-orange-500 hover:bg-orange-600 text-white">
              {findMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
              <span className="ml-2">Find Outliers</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Period:</span>
            {(["all", "week", "month", "year"] as const).map((d) => (
              <button key={d} onClick={() => setUploadDate(d)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${uploadDate === d ? "bg-orange-100 border-orange-300 text-orange-700 font-medium" : "border-border text-muted-foreground hover:border-orange-200"}`}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {findMut.isPending && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          <span className="text-sm">Searching and computing outlier scores across channels…</span>
        </div>
      )}

      {videos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Top 10 Outlier Videos — "{query}"
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs ml-1">Ranked by Outlier Score</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">These videos got the highest multiple of their channel's average views — the strongest viral signals on this topic.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {videos.map((video, i) => <VideoRow key={video.id} video={video} rank={i + 1} />)}
            </div>
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs text-orange-800">
                <strong>How to use this:</strong> Videos with 2x+ outlier scores found a hook, angle, or format that resonated far beyond what that channel normally achieves. Study the title, thumbnail, and first 30 seconds of the top 3 — that's your content intelligence.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {videos.length === 0 && !findMut.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
            <Flame className="w-7 h-7 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Find Viral Outliers</h3>
          <p className="text-sm text-muted-foreground max-w-md">Discover which videos on your topic massively outperformed their channel average — the true signal of viral content.</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {["sleep optimization", "gut health", "longevity hacks", "qigong benefits", "detox protocol"].map((t) => (
              <button key={t} onClick={() => setQuery(t)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-orange-50 hover:text-orange-700 border border-border hover:border-orange-200 transition-colors">{t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Topic Trends (View Velocity) ───────────────────────────────────────

function TopicTrendsTab() {
  const [query, setQuery] = useState("");
  const [uploadDate, setUploadDate] = useState<"week" | "month" | "year">("month");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const trendMut = trpc.youtube.getTopicTrends.useMutation();

  const handleFind = async () => {
    if (!query.trim()) { toast.error("Enter a topic"); return; }
    setVideos([]);
    try {
      const result = await trendMut.mutateAsync({ query: query.trim(), uploadDate, limit: 25 });
      setVideos(result.videos as VideoItem[]);
      if (result.videos.length === 0) toast.info("No videos found. Try a broader topic.");
    } catch (err: any) { toast.error(err?.message ?? "Search failed"); }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />
            Topic Trends — View Velocity
          </CardTitle>
          <p className="text-xs text-muted-foreground">Ranked by views per day since upload. These are the fastest-rising videos on your topic right now — not just all-time high performers.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. intermittent fasting, cortisol, mitochondria…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFind()} className="flex-1" />
            <Button onClick={handleFind} disabled={trendMut.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
              {trendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              <span className="ml-2">Find Trends</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Uploaded in last:</span>
            {(["week", "month", "year"] as const).map((d) => (
              <button key={d} onClick={() => setUploadDate(d)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${uploadDate === d ? "bg-amber-100 border-amber-300 text-amber-700 font-medium" : "border-border text-muted-foreground hover:border-amber-200"}`}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {trendMut.isPending && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-sm">Calculating view velocity for recent uploads…</span>
        </div>
      )}

      {videos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Top 10 Fastest-Rising Videos — "{query}"
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs ml-1">Ranked by Views/Day</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {videos.map((video, i) => <VideoRow key={video.id} video={video} rank={i + 1} showVelocity />)}
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                <strong>View Velocity</strong> = total views ÷ days since upload. A video with 500K views uploaded 3 days ago (167K/day) is trending harder than one with 2M views uploaded 2 years ago (2.7K/day). This is the real-time signal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {videos.length === 0 && !trendMut.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <Activity className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Spot Trending Topics in Real-Time</h3>
          <p className="text-sm text-muted-foreground max-w-md">View velocity reveals what's gaining momentum right now — not just what was popular historically.</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {["mitochondria health", "vagus nerve", "circadian rhythm", "autophagy fasting", "adrenal fatigue"].map((t) => (
              <button key={t} onClick={() => setQuery(t)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-amber-50 hover:text-amber-700 border border-border hover:border-amber-200 transition-colors">{t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Title Pattern Analyzer ──────────────────────────────────────────────

function TitlePatternsTab() {
  const [query, setQuery] = useState("");
  const [uploadDate, setUploadDate] = useState<"all" | "week" | "month" | "year">("year");
  const [result, setResult] = useState<{ titles: any[]; analysis: string } | null>(null);
  const patternMut = trpc.youtube.getTitlePatterns.useMutation();

  const handleAnalyze = async () => {
    if (!query.trim()) { toast.error("Enter a topic"); return; }
    setResult(null);
    try {
      const data = await patternMut.mutateAsync({ query: query.trim(), uploadDate });
      setResult(data);
    } catch (err: any) { toast.error(err?.message ?? "Analysis failed"); }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-green-600" />
            Title Pattern Analyzer
          </CardTitle>
          <p className="text-xs text-muted-foreground">Analyze the top 10 video titles on any topic to extract winning formulas, power words, emotional triggers, and gaps Pedram can own.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. gut health, sleep hacks, stress relief, Qigong…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAnalyze()} className="flex-1" />
            <Button onClick={handleAnalyze} disabled={patternMut.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {patternMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlignLeft className="w-4 h-4" />}
              <span className="ml-2">Analyze Titles</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Period:</span>
            {(["all", "week", "month", "year"] as const).map((d) => (
              <button key={d} onClick={() => setUploadDate(d)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${uploadDate === d ? "bg-green-100 border-green-300 text-green-700 font-medium" : "border-border text-muted-foreground hover:border-green-200"}`}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {patternMut.isPending && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          <span className="text-sm">Fetching top titles and running pattern analysis…</span>
        </div>
      )}

      {result && (
        <>
          {/* 10 Raw Titles */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-600" />
                10 Top-Performing Titles — "{query}"
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.titles.map((v: any, i: number) => (
                  <div key={v.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:border-green-200 hover:bg-green-50/20 transition-colors">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="flex-shrink-0 w-20 h-12 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:text-green-700 line-clamp-2">{v.title}</a>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{v.channelName}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" />{fmtViews(v.viewCount)}</span>
                        {v.isShort && <Badge className="text-[10px] h-4 bg-rose-100 text-rose-700 border-rose-200">Short</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* LLM Pattern Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                Title Pattern Analysis + Pedram's Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                <Streamdown>{result.analysis}</Streamdown>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !patternMut.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
            <AlignLeft className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Decode Winning Title Formulas</h3>
          <p className="text-sm text-muted-foreground max-w-md">See the exact title patterns, power words, and emotional triggers behind the top 10 videos on any topic — plus 5 ready-to-use title templates for Pedram.</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {["gut health", "sleep hacks", "stress relief", "longevity", "detox"].map((t) => (
              <button key={t} onClick={() => setQuery(t)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-green-50 hover:text-green-700 border border-border hover:border-green-200 transition-colors">{t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Similar Channels ────────────────────────────────────────────────────

function SimilarChannelsTab() {
  const [query, setQuery] = useState("");
  const [channels, setChannels] = useState<any[]>([]);
  const searchMut = trpc.youtube.searchChannels.useMutation();

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Enter a topic or niche"); return; }
    setChannels([]);
    try {
      const result = await searchMut.mutateAsync({ query: query.trim(), limit: 10 });
      setChannels(result.channels);
      if (result.channels.length === 0) toast.info("No channels found. Try a different topic.");
    } catch (err: any) { toast.error(err?.message ?? "Search failed"); }
  };

  const trackMut = trpc.youtube.trackChannel.useMutation();
  const handleTrack = async (ch: any) => {
    try {
      await trackMut.mutateAsync({ channelId: ch.channelId, channelName: ch.title, channelUrl: ch.url, thumbnail: ch.thumbnail, subscriberCount: ch.subscriberCount });
      toast.success(`${ch.title} added to watchlist`);
    } catch (err: any) { toast.error(err?.message ?? "Failed to track"); }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Similar Channels Finder
          </CardTitle>
          <p className="text-xs text-muted-foreground">Find the 10 most relevant competitor channels for any topic or niche. Add them to your watchlist with one click.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. functional medicine, Qigong, holistic health, longevity…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1" />
            <Button onClick={handleSearch} disabled={searchMut.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {searchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              <span className="ml-2">Find Channels</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {["functional medicine", "holistic health", "Qigong meditation", "longevity science", "gut microbiome"].map((t) => (
              <button key={t} onClick={() => setQuery(t)} className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-blue-50 hover:text-blue-700 border border-border hover:border-blue-200 transition-colors">{t}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {searchMut.isPending && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm">Finding competitor channels…</span>
        </div>
      )}

      {channels.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              10 Competitor Channels — "{query}"
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs ml-1">Ranked by Subscribers</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channels.map((ch: any, i: number) => (
                <div key={ch.channelId} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-blue-200 hover:bg-blue-50/20 transition-colors">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  {ch.thumbnail && <img src={ch.thumbnail} alt={ch.title} className="flex-shrink-0 w-10 h-10 rounded-full border border-border" />}
                  <div className="flex-1 min-w-0">
                    <a href={ch.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:text-blue-600 line-clamp-1">{ch.title}</a>
                    {ch.handle && <p className="text-xs text-muted-foreground">{ch.handle}</p>}
                    {ch.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ch.description}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{fmtViews(ch.subscriberCount)}</p>
                        <p className="text-[10px] text-muted-foreground">subscribers</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{fmtViews(ch.viewCount)}</p>
                        <p className="text-[10px] text-muted-foreground">total views</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{ch.videoCount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">videos</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => handleTrack(ch)} disabled={trackMut.isPending}>
                      + Watchlist
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {channels.length === 0 && !searchMut.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-blue-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Map Your Competitive Landscape</h3>
          <p className="text-sm text-muted-foreground max-w-md">Find the 10 most relevant YouTube channels in your niche. Add them to your watchlist to monitor their uploads and strategy.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const YT_TABS = [
  { id: "search", label: "Competitor Search", icon: Search, color: "violet" },
  { id: "channel", label: "Channel Analyzer", icon: BarChart2, color: "violet" },
  { id: "outlier", label: "Outlier Finder", icon: Flame, color: "orange" },
  { id: "trends", label: "Topic Trends", icon: Activity, color: "amber" },
  { id: "titles", label: "Title Patterns", icon: AlignLeft, color: "green" },
  { id: "channels", label: "Similar Channels", icon: Users, color: "blue" },
];

export default function YouTubeIntelligence() {
  const [activeTab, setActiveTab] = useState("search");

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0">
            <Youtube className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">YouTube Intelligence</h2>
            <p className="text-xs text-muted-foreground">
              Everything ViewStats does — and more. Powered by YouTube Data API v3.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto p-1 bg-muted/50 flex flex-wrap gap-1">
            {YT_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-0">
            <TabsContent value="search" className="m-0"><CompetitorSearchTab /></TabsContent>
            <TabsContent value="channel" className="m-0"><ChannelAnalyzerTab /></TabsContent>
            <TabsContent value="outlier" className="m-0"><OutlierFinderTab /></TabsContent>
            <TabsContent value="trends" className="m-0"><TopicTrendsTab /></TabsContent>
            <TabsContent value="titles" className="m-0"><TitlePatternsTab /></TabsContent>
            <TabsContent value="channels" className="m-0"><SimilarChannelsTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
