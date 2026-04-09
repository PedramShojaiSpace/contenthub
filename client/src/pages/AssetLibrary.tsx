import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  Send,
  Video,
  Clapperboard,
  Calendar,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetType = "image" | "content" | "script";
type ContentStatus = "idea" | "drafting" | "review" | "approved" | "scheduled" | "published";
type ScriptStatus = "idea" | "scripted" | "in_production" | "in_edit" | "ready_to_post" | "published";

interface UnifiedAsset {
  id: string; // "img-123", "content-456", "script-789"
  type: AssetType;
  title: string;
  platform: string | null;
  status: string;
  imageUrl: string | null;
  textPreview: string | null;
  createdAt: Date;
  rawId: number;
  subType?: string; // scriptType for scripts
  contentGoal?: string | null;
  personaId?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  idea: { label: "Idea", color: "bg-slate-700 text-slate-300", icon: <Clock className="w-3 h-3" /> },
  drafting: { label: "Draft", color: "bg-blue-900/60 text-blue-300", icon: <FileText className="w-3 h-3" /> },
  scripted: { label: "Scripted", color: "bg-blue-900/60 text-blue-300", icon: <FileText className="w-3 h-3" /> },
  review: { label: "Review", color: "bg-yellow-900/60 text-yellow-300", icon: <Clock className="w-3 h-3" /> },
  in_production: { label: "In Production", color: "bg-amber-900/60 text-amber-300", icon: <Film className="w-3 h-3" /> },
  in_edit: { label: "In Edit", color: "bg-purple-900/60 text-purple-300", icon: <Film className="w-3 h-3" /> },
  approved: { label: "Approved", color: "bg-emerald-900/60 text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> },
  ready_to_post: { label: "Ready to Post", color: "bg-emerald-900/60 text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> },
  scheduled: { label: "Scheduled", color: "bg-violet-900/60 text-violet-300", icon: <Calendar className="w-3 h-3" /> },
  published: { label: "Published", color: "bg-green-900/60 text-green-300", icon: <Globe className="w-3 h-3" /> },
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: "bg-blue-900/50 text-blue-300",
  linkedin: "bg-sky-900/50 text-sky-300",
  x: "bg-slate-800/80 text-slate-300",
  youtube: "bg-red-900/50 text-red-300",
  tiktok: "bg-fuchsia-900/50 text-fuchsia-300",
  blog: "bg-emerald-900/50 text-emerald-300",
  all: "bg-slate-700/50 text-slate-400",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-3.5 h-3.5" />,
  content: <FileText className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  carousel: <LayoutGrid className="w-3.5 h-3.5" />,
  blog: <FileText className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  reel: <Clapperboard className="w-3.5 h-3.5" />,
};

const GOAL_LABELS: Record<string, string> = {
  audience_growth: "Audience Growth",
  llm_seo: "LLM SEO",
  community_engagement: "Community",
};

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  onClick,
}: {
  asset: UnifiedAsset;
  onClick: () => void;
}) {
  const statusCfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, color: "bg-slate-700 text-slate-300", icon: null };

  return (
    <Card
      className="bg-slate-800/60 border-slate-700/60 overflow-hidden group cursor-pointer hover:border-amber-600/40 transition-all"
      onClick={onClick}
    >
      {/* Image preview or icon */}
      {asset.imageUrl ? (
        <div className="relative aspect-video overflow-hidden">
          <img
            src={asset.imageUrl}
            alt={asset.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : (
        <div className="aspect-video bg-slate-900/60 flex items-center justify-center border-b border-slate-700/40">
          <div className="text-slate-600">
            {asset.subType ? TYPE_ICONS[asset.subType] ?? TYPE_ICONS[asset.type] : TYPE_ICONS[asset.type]}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2">{asset.title}</p>

        {asset.textPreview && (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{asset.textPreview}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {/* Status */}
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${statusCfg.color}`}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
          {/* Platform */}
          {asset.platform && asset.platform !== "all" && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${PLATFORM_COLORS[asset.platform] ?? "bg-slate-700 text-slate-400"}`}>
              {asset.platform}
            </span>
          )}
          {/* Type */}
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
            {asset.subType ? TYPE_ICONS[asset.subType] ?? TYPE_ICONS[asset.type] : TYPE_ICONS[asset.type]}
            {asset.subType ?? asset.type}
          </span>
          {/* Content goal */}
          {asset.contentGoal && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">
              {GOAL_LABELS[asset.contentGoal] ?? asset.contentGoal}
            </span>
          )}
        </div>

        {/* Date */}
        <p className="text-xs text-slate-600">
          {new Date(asset.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </Card>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function AssetDetailDialog({
  asset,
  onClose,
}: {
  asset: UnifiedAsset | null;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  if (!asset) return null;
  const statusCfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, color: "bg-slate-700 text-slate-300", icon: null };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={!!asset} onOpenChange={() => onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-base leading-snug pr-6">{asset.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image */}
          {asset.imageUrl && (
            <img src={asset.imageUrl} alt={asset.title} className="w-full rounded-lg border border-slate-700" />
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${statusCfg.color}`}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
            {asset.platform && (
              <span className={`text-xs px-2 py-1 rounded ${PLATFORM_COLORS[asset.platform] ?? "bg-slate-700 text-slate-400"}`}>
                {asset.platform}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
              {asset.subType ?? asset.type}
            </span>
          </div>

          {/* Text content */}
          {asset.textPreview && (
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{asset.textPreview}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {asset.imageUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => handleCopy(asset.imageUrl!)}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Image URL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => window.open(asset.imageUrl!, "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open Full Size
                </Button>
              </>
            )}
            {asset.textPreview && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={() => handleCopy(asset.textPreview!)}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy Text
              </Button>
            )}
            {asset.type === "content" && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white"
                onClick={() => { navigate(`/studio?id=${asset.rawId}`); onClose(); }}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Open in Studio
              </Button>
            )}
            {asset.type === "script" && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white"
                onClick={() => { navigate(`/scripts`); onClose(); }}
              >
                <Film className="w-3.5 h-3.5 mr-1.5" />
                Open in Script Library
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetLibrary() {
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<UnifiedAsset | null>(null);

  // Fetch all three data sources
  const { data: images = [] } = trpc.assets.listImages.useQuery({});
  const { data: contentItems = [] } = trpc.content.list.useQuery();
  const { data: scripts = [] } = trpc.scripts.list.useQuery({});

  // Unify into a single asset list
  const unifiedAssets: UnifiedAsset[] = [
    ...images.map((img) => ({
      id: `img-${img.id}`,
      type: "image" as AssetType,
      title: img.prompt ? img.prompt.substring(0, 80) : `Image #${img.id}`,
      platform: img.platform ?? null,
      status: "published", // images are always generated/published
      imageUrl: img.imageUrl,
      textPreview: img.prompt ?? null,
      createdAt: img.createdAt,
      rawId: img.id,
      contentGoal: null,
    })),
    ...contentItems.map((item) => ({
      id: `content-${item.id}`,
      type: "content" as AssetType,
      title: item.title,
      platform: item.platform ?? null,
      status: item.status,
      imageUrl: item.imageUrl ?? null,
      textPreview: item.textContent ? item.textContent.substring(0, 200) : null,
      createdAt: item.createdAt,
      rawId: item.id,
      contentGoal: item.contentGoal ?? null,
    })),
    ...scripts.map((script) => ({
      id: `script-${script.id}`,
      type: "script" as AssetType,
      title: script.title,
      platform: script.platform ?? null,
      status: script.productionStatus,
      imageUrl: script.thumbnailUrl ?? null,
      textPreview: script.scriptBody ? script.scriptBody.substring(0, 200) : script.notes ?? null,
      createdAt: script.createdAt,
      rawId: script.id,
      subType: script.scriptType,
      contentGoal: script.contentGoal ?? null,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Apply filters
  const filtered = unifiedAssets.filter((asset) => {
    if (typeFilter !== "all" && asset.type !== typeFilter) return false;
    if (statusFilter !== "all" && asset.status !== statusFilter) return false;
    if (platformFilter !== "all" && asset.platform !== platformFilter) return false;
    return true;
  });

  // Status options present in the data
  const statusOptions = Array.from(new Set(unifiedAssets.map((a) => a.status))).sort();
  const platformOptions = Array.from(new Set(unifiedAssets.map((a) => a.platform).filter(Boolean))).sort() as string[];

  const totalByType = (type: AssetType) => unifiedAssets.filter((a) => a.type === type).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-600/40 flex items-center justify-center">
              <Archive className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Asset Library</h1>
              <p className="text-sm text-muted-foreground">
                Master archive — all images, content, scripts, and carousels in one place
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {unifiedAssets.length} total assets
          </Badge>
        </div>

        {/* Type filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "image", "content", "script"] as const).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className={`h-8 text-xs capitalize ${
                typeFilter === t
                  ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-500"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? `All (${unifiedAssets.length})` : `${t === "image" ? "Images" : t === "content" ? "Content" : "Scripts"} (${totalByType(t)})`}
            </Button>
          ))}
        </div>

        {/* Status + Platform filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className={`h-7 text-xs ${statusFilter === "all" ? "bg-slate-700 text-white border-slate-600" : "border-border text-muted-foreground"}`}
            >
              All
            </Button>
            {statusOptions.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className={`h-7 text-xs ${statusFilter === s ? `${cfg?.color ?? "bg-slate-700 text-white"} border-transparent` : "border-border text-muted-foreground"}`}
                >
                  {cfg?.label ?? s}
                </Button>
              );
            })}
          </div>
          {platformOptions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">Platform:</span>
              <Button
                variant={platformFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setPlatformFilter("all")}
                className={`h-7 text-xs ${platformFilter === "all" ? "bg-slate-700 text-white border-slate-600" : "border-border text-muted-foreground"}`}
              >
                All
              </Button>
              {platformOptions.map((p) => (
                <Button
                  key={p}
                  variant={platformFilter === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPlatformFilter(p)}
                  className={`h-7 text-xs capitalize ${platformFilter === p ? "bg-slate-700 text-white border-slate-600" : "border-border text-muted-foreground"}`}
                >
                  {p}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Asset grid */}
        {filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-16 text-center">
            <Archive className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No assets yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Assets are automatically archived here as you generate images, create content in the
              Creation Studio, and build scripts in the Script Library.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
              />
            ))}
          </div>
        )}
      </div>

      <AssetDetailDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </DashboardLayout>
  );
}
