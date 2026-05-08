import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  TrendingUp, Zap, BarChart2, Eye, Heart, MessageCircle, Repeat2,
  ExternalLink, Copy, Loader2, RefreshCw, Flame, AlertCircle, ChevronDown, ChevronUp,
  Facebook, Linkedin, Twitter, Youtube, Music2, BookMarked,
} from "lucide-react";
import { Streamdown } from "streamdown";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SignalItem {
  id: number;
  title: string;
  platform: string;
  publishedAt: number | null;
  publishUrl: string | null;
  imageUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  outlierScore: number;
  isOutlier: boolean;
}

// ─── Platform helpers ─────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  meta: <Facebook className="w-3 h-3" />,
  linkedin: <Linkedin className="w-3 h-3" />,
  x: <Twitter className="w-3 h-3" />,
  youtube: <Youtube className="w-3 h-3" />,
  tiktok: <Music2 className="w-3 h-3" />,
  blog: <BookMarked className="w-3 h-3" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  linkedin: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  x: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  youtube: "bg-red-500/20 text-red-300 border-red-500/30",
  tiktok: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  blog: "bg-stone-500/20 text-stone-300 border-stone-500/30",
};

function outlierLabel(score: number): { label: string; color: string } {
  if (score >= 4) return { label: "🔥 Exceptional", color: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 3) return { label: "⚡ Strong", color: "bg-orange-100 text-orange-700 border-orange-200" };
  if (score >= 2) return { label: "📈 Outlier", color: "bg-amber-100 text-amber-700 border-amber-200" };
  if (score >= 1.2) return { label: "↗ Above Avg", color: "bg-green-100 text-green-700 border-green-200" };
  return { label: "Avg", color: "bg-muted text-muted-foreground border-border" };
}

// ─── Boost Brief Dialog ───────────────────────────────────────────────────────
function BoostBriefPanel({ item, onClose }: { item: SignalItem; onClose: () => void }) {
  const boostMutation = trpc.viralStudio.generateBoostBrief.useMutation();
  const [brief, setBrief] = useState<string | null>(null);

  const handleGenerate = () => {
    boostMutation.mutate(
      {
        contentItemId: item.id,
        title: item.title,
        platform: item.platform,
        views: item.views,
        engagement: item.engagement,
        outlierScore: item.outlierScore,
        publishUrl: item.publishUrl ?? undefined,
      },
      {
        onSuccess: (data) => setBrief(data.brief),
        onError: (err) => toast.error("Brief generation failed: " + err.message),
      }
    );
  };

  return (
    <div className="mt-3 p-4 bg-gradient-to-br from-blue-950/40 to-violet-950/40 border border-blue-700/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide flex items-center gap-1.5">
          <Facebook className="w-3 h-3" />
          Meta Ads Campaign Brief
        </p>
        <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-muted-foreground" onClick={onClose}>
          ✕ Close
        </Button>
      </div>

      {!brief && !boostMutation.isPending && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Generate a full Meta Ads campaign brief based on what made this organic post an outlier.
          </p>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            onClick={handleGenerate}
          >
            <Zap className="w-3.5 h-3.5" />
            Generate Campaign Brief
          </Button>
        </div>
      )}

      {boostMutation.isPending && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating brief…
        </div>
      )}

      {brief && (
        <div className="space-y-2">
          <div className="bg-background/60 rounded-lg p-3 text-sm leading-relaxed">
            <Streamdown>{brief}</Streamdown>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(brief);
                toast.success("Brief copied to clipboard");
              }}
            >
              <Copy className="w-3 h-3" />
              Copy Brief
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={handleGenerate}
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Signal Card ──────────────────────────────────────────────────────────────
function SignalCard({ item, avgViews }: { item: SignalItem; avgViews: number }) {
  const [showBoost, setShowBoost] = useState(false);
  const { label, color } = outlierLabel(item.outlierScore);
  const engagementRate = item.views > 0
    ? ((item.engagement / item.views) * 100).toFixed(1)
    : "0.0";

  return (
    <Card className={`border transition-colors ${item.isOutlier ? "border-amber-700/40 bg-amber-950/10" : "border-border bg-card"}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {item.imageUrl && (
            <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${PLATFORM_COLORS[item.platform] ?? "bg-muted text-muted-foreground"}`}
              >
                {PLATFORM_ICONS[item.platform]}
                <span className="ml-1 capitalize">{item.platform}</span>
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>
                {label}
              </Badge>
              {item.isOutlier && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
                  <Flame className="w-2.5 h-2.5 mr-0.5" />
                  {item.outlierScore}x avg
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground line-clamp-2">{item.title}</p>
            {item.publishedAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(item.publishedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {item.publishUrl && (
            <a
              href={item.publishUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: <Eye className="w-3 h-3" />, label: "Views", value: item.views.toLocaleString() },
            { icon: <Heart className="w-3 h-3" />, label: "Likes", value: item.likes.toLocaleString() },
            { icon: <MessageCircle className="w-3 h-3" />, label: "Comments", value: item.comments.toLocaleString() },
            { icon: <Repeat2 className="w-3 h-3" />, label: "Shares", value: item.shares.toLocaleString() },
            { icon: <TrendingUp className="w-3 h-3" />, label: "Eng. Rate", value: `${engagementRate}%` },
          ].map(({ icon, label, value }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-0.5 text-muted-foreground mb-0.5">
                {icon}
              </div>
              <p className="text-xs font-semibold text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Outlier bar */}
        {avgViews > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>vs. avg ({avgViews.toLocaleString()} views)</span>
              <span className={item.isOutlier ? "text-amber-600 font-semibold" : ""}>{item.outlierScore}x</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${item.isOutlier ? "bg-amber-500" : "bg-primary/50"}`}
                style={{ width: `${Math.min((item.outlierScore / 5) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Boost with Paid button */}
        {item.isOutlier && (
          <div>
            <Button
              size="sm"
              variant="outline"
              className={`w-full h-7 text-xs gap-1.5 transition-colors ${
                showBoost
                  ? "border-blue-500/40 text-blue-600 bg-blue-50"
                  : "border-amber-500/40 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
              }`}
              onClick={() => setShowBoost(!showBoost)}
            >
              <Facebook className="w-3 h-3" />
              {showBoost ? "Hide Brief" : "⚡ Boost with Paid — Generate Meta Ads Brief"}
              {showBoost ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </Button>
            {showBoost && (
              <BoostBriefPanel item={item} onClose={() => setShowBoost(false)} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PerformanceSignal() {
  const [filter, setFilter] = useState<"all" | "outliers">("outliers");
  const { data, isLoading, refetch, isRefetching } = trpc.viralStudio.getPerformanceSignals.useQuery();

  const items = data?.items ?? [];
  const avgViews = data?.avgViews ?? 0;
  const avgEngagement = data?.avgEngagement ?? 0;
  const outliers = items.filter(i => i.isOutlier);
  const displayItems = filter === "outliers" ? outliers : items;

  const totalViews = items.reduce((s, i) => s + i.views, 0);
  const totalEngagement = items.reduce((s, i) => s + i.engagement, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Performance Signal Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organic outliers detected from your published content analytics. Items scoring 2× average views are flagged for paid amplification.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Published Posts", value: items.length, icon: <BarChart2 className="w-4 h-4 text-primary" /> },
          { label: "Outliers Detected", value: outliers.length, icon: <Flame className="w-4 h-4 text-amber-500" /> },
          { label: "Avg Views / Post", value: avgViews.toLocaleString(), icon: <Eye className="w-4 h-4 text-blue-500" /> },
          { label: "Total Engagement", value: totalEngagement.toLocaleString(), icon: <TrendingUp className="w-4 h-4 text-green-500" /> },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === "outliers" ? "default" : "outline"}
          className="h-7 text-xs gap-1.5"
          onClick={() => setFilter("outliers")}
        >
          <Flame className="w-3 h-3" />
          Outliers Only ({outliers.length})
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          className="h-7 text-xs gap-1.5"
          onClick={() => setFilter("all")}
        >
          <BarChart2 className="w-3 h-3" />
          All Published ({items.length})
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading performance data…</span>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl text-center p-6">
          {filter === "outliers" ? (
            <>
              <AlertCircle className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No outliers detected yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Update analytics on your published posts in the Kanban. Items with 2× average views will appear here.
              </p>
            </>
          ) : (
            <>
              <BarChart2 className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No published content with analytics yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Mark content as Published in the Kanban and add view/engagement numbers to see signals here.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filter === "outliers" && outliers.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <Flame className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>{outliers.length} outlier{outliers.length !== 1 ? "s" : ""} detected.</strong>{" "}
                These posts are performing 2× or more above your average. Each has a "Boost with Paid" button that generates a full Meta Ads campaign brief — click it to turn your best organic content into a paid amplification strategy.
              </p>
            </div>
          )}
          {displayItems.map(item => (
            <SignalCard key={item.id} item={item} avgViews={avgViews} />
          ))}
        </div>
      )}
    </div>
  );
}
