import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ExternalLink,
  Play,
  Eye,
  ThumbsUp,
  MessageSquare,
  Clock,
  DollarSign,
  TrendingUp,
  Target,
  Zap,
  Filter,
} from "lucide-react";

type Platform = "all" | "youtube" | "meta_video";

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(secs: number): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 7 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    score >= 4 ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-stone-100 text-stone-600 border-stone-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function VideoCard({ video, rank }: { video: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const mofColor =
    video.scores.total >= 7 ? "border-emerald-300 bg-emerald-50/30" :
    video.scores.total >= 4 ? "border-amber-300 bg-amber-50/30" :
    "border-stone-200 bg-card";

  return (
    <div className={`rounded-xl border-2 ${mofColor} overflow-hidden`}>
      <div className="flex gap-3 p-3">
        {/* Rank + Thumbnail */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {rank}
          </span>
          {video.thumbnail && (
            <div className="relative w-20 h-14 rounded-md overflow-hidden bg-black flex-shrink-0">
              <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-5 h-5 text-white drop-shadow" />
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:text-primary leading-tight flex items-center gap-1 group"
            >
              {video.title.slice(0, 80)}{video.title.length > 80 ? "…" : ""}
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </a>
            <Badge variant="outline" className={`text-xs flex-shrink-0 ${
              video.platform === "youtube" ? "border-red-200 text-red-600" : "border-blue-200 text-blue-600"
            }`}>
              {video.platform === "youtube" ? "YouTube" : "Facebook"}
            </Badge>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatViews(video.views)}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatViews(video.likes)}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{video.comments}</span>
            {video.durationSecs > 0 && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(video.durationSecs)}</span>
            )}
          </div>

          {/* Score breakdown */}
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <span className="text-xs text-muted-foreground font-medium">MOF Score:</span>
            <ScoreBadge score={video.scores.total} />
            <span className="text-xs text-muted-foreground">Topic <ScoreBadge score={video.scores.topic} /></span>
            <span className="text-xs text-muted-foreground">Eng <ScoreBadge score={video.scores.engagement} /></span>
            <span className="text-xs text-muted-foreground">Vol <ScoreBadge score={video.scores.volume} /></span>
          </div>
        </div>
      </div>

      {/* Ad Setup Panel */}
      <div className="border-t border-border/50 px-3 py-2 bg-background/50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 w-full text-left"
        >
          <DollarSign className="w-3.5 h-3.5" />
          $1/day Ad Setup
          <span className="ml-auto text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
              <p className="text-xs font-medium text-foreground mb-1">Ad Setup Tip</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{video.adSetupTip}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2.5">
              <p className="text-xs font-medium text-foreground mb-1">Audience Note</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{video.audienceNote}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
              <p className="text-xs font-semibold text-amber-800 mb-1">Quick Ad Setup ($1/day)</p>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside leading-relaxed">
                <li>In Meta Ads Manager → Create → Traffic or Video Views campaign</li>
                <li>Audience: Custom Audience → "Interconnected Leads" (your lead list)</li>
                <li>Budget: $1/day | Placement: Facebook + Instagram Feed + Reels</li>
                <li>Ad: Use this video URL as the creative</li>
                <li>Caption: Add a gut health hook + soft CTA to the Interconnected page</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MofContentEngine() {
  const [platform, setPlatform] = useState<Platform>("all");
  const [minScore, setMinScore] = useState(0);

  const { data, isLoading, refetch, isFetching } = trpc.mofContent.getTopMofVideos.useQuery(
    { limit: 30, minTopicScore: 0 },
    { staleTime: 15 * 60 * 1000, refetchInterval: 30 * 60 * 1000 }
  );

  const allVideos = [
    ...(data?.youtube ?? []),
    ...(data?.meta ?? []),
  ]
    .filter(v => platform === "all" || v.platform === platform)
    .filter(v => v.scores.total >= minScore)
    .sort((a, b) => b.scores.total - a.scores.total);

  const topMof = allVideos.filter(v => v.scores.topic >= 5);
  const goodMof = allVideos.filter(v => v.scores.topic >= 3 && v.scores.topic < 5);
  const broadMof = allVideos.filter(v => v.scores.topic < 3);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            MOF Content Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top organic videos scored for $1/day middle-of-funnel retargeting to Interconnected leads
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Channel stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-lg font-bold text-foreground">{data.channelStats.subscriberCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Subscribers</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-lg font-bold text-foreground">{data.channelStats.totalVideosAnalyzed}</div>
            <div className="text-xs text-muted-foreground">Videos Analyzed</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-lg font-bold text-emerald-600">{topMof.length}</div>
            <div className="text-xs text-muted-foreground">Strong MOF Match</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-lg font-bold text-amber-600">{goodMof.length}</div>
            <div className="text-xs text-muted-foreground">Good MOF Match</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Platform:</span>
        {(["all", "youtube", "meta_video"] as Platform[]).map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              platform === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p === "all" ? "All" : p === "youtube" ? "YouTube" : "Facebook"}
          </button>
        ))}
        <span className="text-xs text-muted-foreground font-medium ml-2">Min MOF Score:</span>
        {[0, 3, 5, 7].map(s => (
          <button
            key={s}
            onClick={() => setMinScore(s)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              minScore === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === 0 ? "Any" : `${s}+`}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Analyzing your content library…
        </div>
      )}

      {data && allVideos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No videos match the current filters. Try lowering the minimum score.
        </div>
      )}

      {data && allVideos.length > 0 && (
        <>
          {/* Top MOF section */}
          {topMof.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-emerald-700">Strong MOF Match — Use First</h2>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs" variant="outline">
                  {topMof.length} videos
                </Badge>
              </div>
              <div className="space-y-3">
                {topMof.map((v, i) => (
                  <VideoCard key={v.id} video={v} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Good MOF section */}
          {goodMof.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-700">Good MOF Match — Use as Secondary Touch Points</h2>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs" variant="outline">
                  {goodMof.length} videos
                </Badge>
              </div>
              <div className="space-y-3">
                {goodMof.map((v, i) => (
                  <VideoCard key={v.id} video={v} rank={topMof.length + i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Broad MOF section */}
          {broadMof.length > 0 && minScore === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-stone-500" />
                <h2 className="text-sm font-semibold text-stone-600">Broad Health Content — Cold Retargeting Only</h2>
                <Badge className="bg-stone-100 text-stone-600 border-stone-200 text-xs" variant="outline">
                  {broadMof.length} videos
                </Badge>
              </div>
              <div className="space-y-3">
                {broadMof.slice(0, 5).map((v, i) => (
                  <VideoCard key={v.id} video={v} rank={topMof.length + goodMof.length + i + 1} />
                ))}
                {broadMof.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {broadMof.length - 5} more broad content videos (set Min Score to 0 and filter to see all)
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {data && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated {new Date(data.fetchedAt).toLocaleString()} · Refreshes every 30 min
        </p>
      )}
    </div>
  );
}
