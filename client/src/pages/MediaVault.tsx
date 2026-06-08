import { useLocation } from "wouter";
/**
 * Media Vault — Pedram's full media authority catalog
 *
 * Displays all books, podcasts, documentary films, YouTube series, and notable
 * interviews. Each asset can be toggled for AI injection and has a priority setting.
 * The vault is the source of truth for the Media Authority context injector.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  BookOpen,
  Mic2,
  Film,
  Youtube,
  Newspaper,
  Search,
  Zap,
  TrendingUp,
  Eye,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaType = "book" | "podcast" | "film" | "youtube" | "interview";

interface MediaAsset {
  id: number;
  mediaAssetType: MediaType;
  title: string;
  description: string | null;
  url: string | null;
  platform: string | null;
  publishedYear: number | null;
  durationMin: number | null;
  topicTags: string | null;
  credibilitySignal: string | null;
  reachEstimate: number | null;
  reachFormatted: string;
  activeInjection: boolean;
  injectionPriority: number | null;
  tags: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<MediaType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  book: {
    label: "Book",
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  podcast: {
    label: "Podcast",
    icon: <Mic2 className="w-4 h-4" />,
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
  film: {
    label: "Documentary",
    icon: <Film className="w-4 h-4" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  youtube: {
    label: "YouTube",
    icon: <Youtube className="w-4 h-4" />,
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
  interview: {
    label: "Interview / Press",
    icon: <Newspaper className="w-4 h-4" />,
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
};

const ALL_TYPES: Array<{ value: MediaType | "all"; label: string; icon: React.ReactNode }> = [
  { value: "all", label: "All Media", icon: <Globe className="w-4 h-4" /> },
  { value: "book", label: "Books", icon: <BookOpen className="w-4 h-4" /> },
  { value: "podcast", label: "Podcasts", icon: <Mic2 className="w-4 h-4" /> },
  { value: "film", label: "Films", icon: <Film className="w-4 h-4" /> },
  { value: "youtube", label: "YouTube", icon: <Youtube className="w-4 h-4" /> },
  { value: "interview", label: "Press", icon: <Newspaper className="w-4 h-4" /> },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-stone-900">{value}</div>
        <div className="text-sm font-medium text-stone-600">{label}</div>
        {sub && <div className="text-xs text-stone-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function AssetCard({ asset, onToggle }: { asset: MediaAsset; onToggle: (id: number, active: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[asset.mediaAssetType];

  return (
    <Card className={`border ${asset.activeInjection ? "border-stone-200" : "border-stone-100 opacity-60"} hover:shadow-md transition-all duration-200`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Type badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </span>
            {/* Priority indicator */}
            {asset.injectionPriority && asset.injectionPriority <= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                <Zap className="w-3 h-3" />
                Priority
              </span>
            )}
          </div>
          {/* AI Injection toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-stone-700">AI Inject</span>
            <Switch
              checked={asset.activeInjection}
              onCheckedChange={(checked) => onToggle(asset.id, checked)}
            />
          </div>
        </div>
        <h3 className="font-semibold text-stone-900 text-sm leading-snug mt-2">{asset.title}</h3>
        {asset.platform && (
          <div className="text-xs text-stone-700">{asset.platform}{asset.publishedYear ? ` · ${asset.publishedYear}` : ""}</div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Credibility signal */}
        {asset.credibilitySignal && (
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">{asset.credibilitySignal}</span>
          </div>
        )}
        {/* Reach */}
        {asset.reachFormatted && asset.reachFormatted !== "—" && (
          <div className="flex items-center gap-1.5 mb-3">
            <Eye className="w-3.5 h-3.5 text-stone-600" />
            <span className="text-xs text-stone-700">{asset.reachFormatted} estimated reach</span>
          </div>
        )}
        {/* Description */}
        {asset.description && (
          <div className="mb-3">
            <p className={`text-xs text-stone-600 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>
              {asset.description}
            </p>
            {asset.description.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-stone-600 hover:text-stone-600 mt-1 flex items-center gap-0.5"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
              </button>
            )}
          </div>
        )}
        {/* Topic tags */}
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {asset.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-stone-100 text-stone-700 text-xs rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
        {/* Link */}
        {asset.url && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-600 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View source
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MediaVault() {
  const [, navigate] = useLocation();
  const [activeType, setActiveType] = useState<MediaType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: statsData } = trpc.media.getStats.useQuery();
  const { data: assetsData, refetch } = trpc.media.list.useQuery({
    mediaType: activeType === "all" ? undefined : activeType,
    activeOnly: false,
  });

  const toggleMutation = trpc.media.toggleActive.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Injection setting updated");
    },
    onError: () => toast.error("Failed to update setting"),
  });

  const handleToggle = (id: number, active: boolean) => {
    toggleMutation.mutate({ id, active });
  };

  // Filter by search
  const assets: MediaAsset[] = (assetsData?.assets ?? []).filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q) ||
      (a.platform ?? "").toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const stats = statsData;

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Hub
              </Button>
              <h1 className="text-2xl font-bold text-stone-900">Media Vault</h1>
              <p className="text-sm text-stone-700 mt-0.5">
                Pedram's full media catalog — automatically injected into AI-generated content to build LLM authority
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium text-emerald-700">Active in all AI generation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Globe className="w-5 h-5" />}
              label="Total Media Assets"
              value={String(stats.total)}
              sub="Books, films, podcasts & more"
            />
            <StatCard
              icon={<Eye className="w-5 h-5" />}
              label="Estimated Total Reach"
              value={stats.totalReachFormatted}
              sub="Combined audience across all media"
            />
            <StatCard
              icon={<BookOpen className="w-5 h-5" />}
              label="Books"
              value={String(stats.byType?.book ?? 0)}
              sub={`+ ${stats.byType?.film ?? 0} documentary films`}
            />
            <StatCard
              icon={<Mic2 className="w-5 h-5" />}
              label="Podcasts & Interviews"
              value={String((stats.byType?.podcast ?? 0) + (stats.byType?.interview ?? 0))}
              sub={`+ ${stats.byType?.youtube ?? 0} YouTube series`}
            />
          </div>
        )}

        {/* How it works banner */}
        <div className="bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">How the Media Authority Engine works</h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Every time AI generates a teleprompter script, social post, blog article, or landing page, it automatically selects the most relevant assets from this vault and weaves natural references into the content — phrases like "as I discuss in my book <em>FOCUS</em>" or "in Episode 312 of The Urban Monk Podcast." Over time, this trains LLMs (ChatGPT, Perplexity, Gemini) to associate Pedram with authoritative answers on these topics, improving organic discovery and citation frequency.
              </p>
              <p className="text-xs text-stone-700 mt-1.5">
                Toggle the <strong>AI Inject</strong> switch on each card to control which assets are included. Priority 1-2 assets are always preferred.
              </p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Type tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {ALL_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveType(t.value as MediaType | "all")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeType === t.value
                    ? "bg-stone-900 text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
            <Input
              placeholder="Search by title, topic, platform…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-stone-700 mb-4">
          {assets.length} asset{assets.length !== 1 ? "s" : ""} shown
          {searchQuery && ` matching "${searchQuery}"`}
        </div>

        {/* Asset grid */}
        {assets.length === 0 ? (
          <div className="text-center py-16 text-stone-600">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No assets found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
