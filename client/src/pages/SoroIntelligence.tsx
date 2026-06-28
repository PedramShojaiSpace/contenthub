import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  Tag,
  Folder,
  BarChart3,
  BookOpen,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type FilterType = "all" | "uncategorized" | "needs_enhancement" | "enhanced";

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return <Badge variant="outline" className="text-xs">Not analyzed</Badge>;
  const colors: Record<string, string> = {
    excellent: "bg-emerald-100 text-emerald-800 border-emerald-200",
    good: "bg-blue-100 text-blue-800 border-blue-200",
    needs_work: "bg-amber-100 text-amber-800 border-amber-200",
    poor: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[score] || "bg-gray-100 text-gray-700"}`}>
      {score.replace("_", " ")}
    </span>
  );
}

function PostCard({ post, onAnalyze, onFixCategories, onMarkEnhanced }: {
  post: any;
  onAnalyze: (id: number) => void;
  onFixCategories: (id: number) => void;
  onMarkEnhanced: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const bestPractices = post.ai_best_practices;
  const suggestedTags = post.ai_suggested_tags;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {post.is_uncategorized ? (
              <Badge variant="destructive" className="text-xs">Uncategorized</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50">Categorized</Badge>
            )}
            {post.category_fix_status === "fixed" && (
              <Badge className="text-xs bg-emerald-600 text-white">Category Fixed ✓</Badge>
            )}
            {post.enhancement_status === "enhanced" && (
              <Badge className="text-xs bg-blue-600 text-white">Enhanced ✓</Badge>
            )}
          </div>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-900 hover:text-primary line-clamp-2 flex items-start gap-1"
          >
            {post.title}
            <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
          </a>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}{post.word_count?.toLocaleString()} words
            {post.has_featured_image ? " · 🖼 Image" : " · ⚠ No image"}
            {post.has_meta_description ? " · ✓ Meta" : " · ⚠ No meta"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">SEO:</span>
            <ScoreBadge score={post.seo_score} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Read:</span>
            <ScoreBadge score={post.readability_score} />
          </div>
        </div>
      </div>

      {/* Content preview */}
      {post.content_preview && (
        <p className="text-xs text-gray-600 line-clamp-2 mb-3 italic">"{post.content_preview.slice(0, 200)}..."</p>
      )}

      {/* AI Analysis results */}
      {bestPractices && (
        <div className="mt-2 mb-3">
          {bestPractices.found?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> What Soro did well
              </p>
              <ul className="space-y-0.5">
                {bestPractices.found.slice(0, 3).map((item: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-emerald-500 mt-0.5">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bestPractices.missing?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Gaps to fix
              </p>
              <ul className="space-y-0.5">
                {bestPractices.missing.slice(0, 3).map((item: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-amber-500 mt-0.5">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bestPractices.primary_keyword && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Target keyword:</span> {bestPractices.primary_keyword}
            </p>
          )}
        </div>
      )}

      {/* Enhancement suggestion */}
      {post.ai_enhancement_suggestions && (
        <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-3">
          <p className="text-xs font-medium text-blue-700 mb-0.5 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Enhancement suggestion
          </p>
          <p className="text-xs text-blue-800">{post.ai_enhancement_suggestions}</p>
        </div>
      )}

      {/* Lesson learned */}
      {post.ai_lessons_learned && (
        <div className="bg-purple-50 border border-purple-100 rounded p-2 mb-3">
          <p className="text-xs font-medium text-purple-700 mb-0.5 flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> Lesson for Content Hub
          </p>
          <p className="text-xs text-purple-800">{post.ai_lessons_learned}</p>
        </div>
      )}

      {/* Suggested tags */}
      {suggestedTags?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Suggested tags
          </p>
          <div className="flex flex-wrap gap-1">
            {suggestedTags.slice(0, 6).map((tag: string, i: number) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {!post.seo_score && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onAnalyze(post.id)}
          >
            <Zap className="h-3 w-3 mr-1" /> AI Analyze
          </Button>
        )}
        {post.seo_score && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onAnalyze(post.id)}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Re-analyze
          </Button>
        )}
        {post.is_uncategorized && post.seo_score && post.category_fix_status !== "fixed" && (
          <Button
            size="sm"
            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => onFixCategories(post.id)}
          >
            <Folder className="h-3 w-3 mr-1" /> Fix Categories
          </Button>
        )}
        {post.enhancement_status !== "enhanced" && post.seo_score && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
            onClick={() => onMarkEnhanced(post.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Enhanced
          </Button>
        )}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <Eye className="h-3 w-3" /> View Post
        </a>
      </div>
    </div>
  );
}

export default function SoroIntelligence() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  const { data: stats, refetch: refetchStats } = trpc.soro.getStats.useQuery();
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = trpc.soro.getPosts.useQuery({ filter, limit: 50 });
  const { data: insightsData, refetch: refetchInsights, isLoading: insightsLoading } = trpc.soro.getBestPracticesInsights.useQuery(
    undefined,
    { enabled: showInsights }
  );

  const syncMutation = trpc.soro.syncPosts.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} posts (${data.newPosts} new)`);
      refetchPosts();
      refetchStats();
    },
    onError: (err) => toast.error(`Sync failed: ${err.message}`),
  });

  const analyzeMutation = trpc.soro.analyzePost.useMutation({
    onSuccess: () => {
      toast.success("Analysis complete");
      refetchPosts();
      refetchStats();
      setAnalyzingId(null);
    },
    onError: (err) => {
      toast.error(`Analysis failed: ${err.message}`);
      setAnalyzingId(null);
    },
  });

  const fixCategoriesMutation = trpc.soro.fixCategories.useMutation({
    onSuccess: (data) => {
      toast.success(`Categories fixed! Assigned IDs: ${data.categoryIds.join(", ")}`);
      refetchPosts();
      refetchStats();
      setFixingId(null);
    },
    onError: (err) => {
      toast.error(`Fix failed: ${err.message}`);
      setFixingId(null);
    },
  });

  const markEnhancedMutation = trpc.soro.markEnhanced.useMutation({
    onSuccess: () => {
      toast.success("Marked as enhanced");
      refetchPosts();
      refetchStats();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAnalyze = (id: number) => {
    setAnalyzingId(id);
    analyzeMutation.mutate({ postId: id });
  };

  const handleFixCategories = (id: number) => {
    setFixingId(id);
    fixCategoriesMutation.mutate({ postId: id });
  };

  const handleMarkEnhanced = (id: number) => {
    markEnhancedMutation.mutate({ postId: id });
  };

  const posts = postsData || [];
  const uncategorizedCount = stats?.uncategorized ? Number(stats.uncategorized) : 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Soro Intelligence</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor Soro-generated blog posts · Fix categories · Learn best practices · Enhance content
            </p>
          </div>
          <Button
            onClick={() => syncMutation.mutate({ pages: 3 })}
            disabled={syncMutation.isPending}
            className="bg-primary text-white"
          >
            {syncMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from WordPress
          </Button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: "Total Posts", value: stats.total || 0, color: "text-gray-900" },
              { label: "Uncategorized", value: uncategorizedCount, color: uncategorizedCount > 0 ? "text-red-600" : "text-emerald-600" },
              { label: "Categories Fixed", value: stats.categories_fixed || 0, color: "text-emerald-600" },
              { label: "Enhanced", value: stats.enhanced || 0, color: "text-blue-600" },
              { label: "Pending Review", value: stats.pending || 0, color: "text-amber-600" },
              { label: "Excellent SEO", value: stats.excellent_seo || 0, color: "text-emerald-600" },
              { label: "Avg Words", value: stats.avg_word_count ? Math.round(Number(stats.avg_word_count)).toLocaleString() : "—", color: "text-gray-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Best Practices Insights panel */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-6">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => {
              setShowInsights(!showInsights);
              if (!showInsights) refetchInsights();
            }}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <span className="font-semibold text-purple-900">AI Best Practices Insights</span>
              <span className="text-xs text-purple-600">— What we can learn from Soro's approach</span>
            </div>
            {showInsights ? (
              <ChevronUp className="h-4 w-4 text-purple-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-600" />
            )}
          </button>

          {showInsights && (
            <div className="mt-4">
              {insightsLoading ? (
                <div className="flex items-center gap-2 text-sm text-purple-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing patterns across all posts...
                </div>
              ) : (insightsData?.insights?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {insightsData?.insights?.map((insight: any, i: number) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-purple-100">
                      <div className="flex items-start gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                          insight.priority === "high" ? "bg-red-100 text-red-700" :
                          insight.priority === "medium" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {insight.priority}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{insight.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-purple-700">
                  {insightsData?.summary || "Sync and analyze posts first to generate insights."}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(["all", "uncategorized", "needs_enhancement", "enhanced"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "All Posts" :
               f === "uncategorized" ? `⚠ Uncategorized (${uncategorizedCount})` :
               f === "needs_enhancement" ? "Needs Enhancement" :
               "Enhanced"}
            </button>
          ))}
        </div>

        {/* Posts list */}
        {postsLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading posts...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No posts found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === "all"
                ? "Click \"Sync from WordPress\" to pull Soro's latest posts"
                : `No posts match the "${filter}" filter`}
            </p>
            {filter === "all" && (
              <Button
                className="mt-4"
                onClick={() => syncMutation.mutate({ pages: 3 })}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{posts.length} post{posts.length !== 1 ? "s" : ""} shown</p>
            {posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                onAnalyze={handleAnalyze}
                onFixCategories={handleFixCategories}
                onMarkEnhanced={handleMarkEnhanced}
              />
            ))}
          </div>
        )}

        {/* Last synced */}
        {stats?.last_synced && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Last synced: {new Date(stats.last_synced).toLocaleString()}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
