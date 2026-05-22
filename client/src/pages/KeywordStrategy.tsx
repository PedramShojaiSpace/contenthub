import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Target,
  Plus,
  Sparkles,
  TrendingUp,
  BarChart3,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  PenSquare,
  Film,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

type FunnelStage = "tofu" | "mofu" | "bofu";
type KeywordType = "pillar" | "cluster" | "conversion";
type MonetizationTag = "academy" | "supplements" | "testing" | "free_lead" | "affiliate";
type ContentStatus = "not_started" | "briefed" | "in_progress" | "published";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FUNNEL_LABELS: Record<FunnelStage, { label: string; color: string; desc: string }> = {
  tofu: { label: "TOFU", color: "bg-sky-100 text-sky-700 border-sky-200", desc: "Awareness" },
  mofu: { label: "MOFU", color: "bg-amber-100 text-amber-700 border-amber-200", desc: "Consideration" },
  bofu: { label: "BOFU", color: "bg-emerald-100 text-emerald-700 border-emerald-200", desc: "Decision" },
};

const TYPE_LABELS: Record<KeywordType, { label: string; color: string }> = {
  pillar: { label: "Pillar", color: "bg-violet-100 text-violet-700 border-violet-200" },
  cluster: { label: "Cluster", color: "bg-blue-100 text-blue-700 border-blue-200" },
  conversion: { label: "Conversion", color: "bg-rose-100 text-rose-700 border-rose-200" },
};

const MONETIZATION_LABELS: Record<MonetizationTag, { label: string; color: string }> = {
  academy: { label: "Academy", color: "bg-indigo-100 text-indigo-700" },
  supplements: { label: "Supplements", color: "bg-green-100 text-green-700" },
  testing: { label: "Testing", color: "bg-orange-100 text-orange-700" },
  free_lead: { label: "Free Lead", color: "bg-muted text-muted-foreground" },
  affiliate: { label: "Affiliate", color: "bg-pink-100 text-pink-700" },
};

const CONTENT_STATUS_ICONS: Record<ContentStatus, React.ReactNode> = {
  not_started: <Circle className="w-4 h-4 text-muted-foreground" />,
  briefed: <FileText className="w-4 h-4 text-amber-500" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  published: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
};

function formatVolume(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onSelect,
  isSelected,
}: {
  campaign: {
    id: number;
    name: string;
    pillarKeyword: string;
    monetizationGoal: string;
    status: string;
    totalKeywords: number;
    published: number;
    inProgress: number;
    briefed: number;
    notStarted: number;
  };
  onSelect: () => void;
  isSelected: boolean;
}) {
  const progress =
    campaign.totalKeywords > 0
      ? Math.round((campaign.published / campaign.totalKeywords) * 100)
      : 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:bg-primary/3"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-semibold text-foreground text-sm">{campaign.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">"{campaign.pillarKeyword}"</div>
        </div>
        <Badge
          className={`text-xs shrink-0 ${
            MONETIZATION_LABELS[campaign.monetizationGoal as MonetizationTag]?.color ??
            "bg-muted text-muted-foreground"
          }`}
          variant="outline"
        >
          {MONETIZATION_LABELS[campaign.monetizationGoal as MonetizationTag]?.label ??
            campaign.monetizationGoal}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{campaign.totalKeywords} keywords</span>
          <span>{progress}% published</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-emerald-600">{campaign.published} published</span>
          <span className="text-blue-600">{campaign.inProgress} in progress</span>
          <span className="text-amber-600">{campaign.briefed} briefed</span>
        </div>
      </div>
    </button>
  );
}

// ─── New Campaign Dialog ──────────────────────────────────────────────────────

function NewCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pillar, setPillar] = useState("");
  const [goal, setGoal] = useState<"academy" | "supplements" | "testing" | "free_lead">("academy");
  const [description, setDescription] = useState("");

  const create = trpc.kwStrategy.createCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign created!");
      setOpen(false);
      setName("");
      setPillar("");
      setDescription("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Keyword Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Campaign Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Gut Health Authority"'
              className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pillar Keyword</label>
            <Input
              value={pillar}
              onChange={(e) => setPillar(e.target.value)}
              placeholder='e.g. "gut health"'
              className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The broad topic you want to own. This becomes your pillar page.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Primary Monetization Goal</label>
            <Select value={goal} onValueChange={(v) => setGoal(v as typeof goal)}>
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="academy">Urban Monk Academy ($297/yr)</SelectItem>
                <SelectItem value="supplements">Supplement Store</SelectItem>
                <SelectItem value="testing">Functional Testing</SelectItem>
                <SelectItem value="free_lead">Free Lead Magnet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Strategic Notes (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this topic? What's the unique angle?"
              className="bg-background border-border text-foreground placeholder:text-muted-foreground/50 resize-none"
              rows={3}
            />
          </div>
          <Button
            onClick={() =>
              create.mutate({ name, pillarKeyword: pillar, monetizationGoal: goal, description })
            }
            disabled={!name || !pillar || create.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {create.isPending ? "Creating..." : "Create Campaign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Keyword Target Row ───────────────────────────────────────────────────────

function TargetRow({
  target,
  onUpdate,
  onRemove,
}: {
  target: {
    id: number;
    keyword: string;
    keywordType: string;
    funnelStage: string;
    monetizationTag: string;
    searchVolume: number | null;
    difficulty: number | null;
    cpc: string | null;
    currentPosition: string | null;
    contentStatus: string;
    publishedUrl: string | null;
    notes: string | null;
    priority: number;
  };
  onUpdate: (id: number, updates: Record<string, unknown>) => void;
  onRemove: (id: number) => void;
}) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);

  const funnel = FUNNEL_LABELS[target.funnelStage as FunnelStage];
  const type = TYPE_LABELS[target.keywordType as KeywordType];
  const mono = MONETIZATION_LABELS[target.monetizationTag as MonetizationTag];
  const statusIcon = CONTENT_STATUS_ICONS[target.contentStatus as ContentStatus];

  const diffColor =
    target.difficulty == null
      ? "text-muted-foreground/40"
      : target.difficulty < 30
      ? "text-emerald-600"
      : target.difficulty < 60
      ? "text-amber-600"
      : "text-rose-600";

  return (
    <div className="border border-border rounded-lg bg-card hover:bg-muted/30 transition-all">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <button
          onClick={() => {
            const cycle: ContentStatus[] = ["not_started", "briefed", "in_progress", "published"];
            const current = target.contentStatus as ContentStatus;
            const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
            onUpdate(target.id, { contentStatus: next });
          }}
          title="Click to advance status"
          className="shrink-0"
        >
          {statusIcon}
        </button>

        {/* Keyword */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-foreground font-medium truncate block">{target.keyword}</span>
        </div>

        {/* Type badge */}
        {type && (
          <Badge className={`text-xs shrink-0 hidden sm:flex ${type.color}`} variant="outline">
            {type.label}
          </Badge>
        )}

        {/* Funnel badge */}
        {funnel && (
          <Badge className={`text-xs shrink-0 hidden md:flex ${funnel.color}`} variant="outline">
            {funnel.label}
          </Badge>
        )}

        {/* Volume */}
        <div className="text-xs text-muted-foreground shrink-0 w-14 text-right hidden lg:block">
          {formatVolume(target.searchVolume)}/mo
        </div>

        {/* Difficulty */}
        <div className={`text-xs shrink-0 w-8 text-right hidden lg:block ${diffColor}`}>
          {target.difficulty != null ? `${target.difficulty}` : "—"}
        </div>

        {/* Create content buttons */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() =>
              setLocation(
                `/video-production?keyword=${encodeURIComponent(target.keyword)}`
              )
            }
            title="Create Video Script"
            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <Film className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams({
                keyword: target.keyword,
                platform: "blog",
              });
              if (target.currentPosition) {
                params.set("focusKeyword", target.keyword);
                params.set("currentPosition", target.currentPosition);
              }
              setLocation(`/studio?${params.toString()}`);
            }}
            title="Create Blog Post"
            className="p-1.5 rounded-md hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
          </button>
          {target.publishedUrl && (
            <a
              href={target.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View published page"
              className="p-1.5 rounded-md hover:bg-sky-50 text-muted-foreground hover:text-sky-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(target.id)}
          className="p-1 rounded hover:bg-rose-50 text-muted-foreground/50 hover:text-rose-600 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded notes + controls */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
          {target.notes && (
            <p className="text-xs text-muted-foreground leading-relaxed">{target.notes}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {/* Monetization */}
            {mono && (
              <Badge className={`text-xs ${mono.color}`} variant="outline">
                {mono.label}
              </Badge>
            )}
            {/* CPC */}
            {target.cpc && (
              <Badge className="text-xs bg-muted text-muted-foreground" variant="outline">
                CPC: ${target.cpc}
              </Badge>
            )}
            {/* Position */}
            {target.currentPosition && (
              <Badge className="text-xs bg-muted text-muted-foreground" variant="outline">
                GSC pos: {target.currentPosition}
              </Badge>
            )}
          </div>
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select
              value={target.contentStatus}
              onValueChange={(v) => onUpdate(target.id, { contentStatus: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-background border-border text-foreground w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground text-xs">
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="briefed">Briefed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KeywordStrategy() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [addKeyword, setAddKeyword] = useState("");
  const [addType, setAddType] = useState<KeywordType>("cluster");
  const [addStage, setAddStage] = useState<FunnelStage>("tofu");
  const [addMono, setAddMono] = useState<MonetizationTag>("academy");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const utils = trpc.useUtils();

  const { data: campaignsData, refetch: refetchCampaigns } = trpc.kwStrategy.listCampaigns.useQuery();
  const campaigns = campaignsData?.campaigns ?? [];

  const { data: targetsData, refetch: refetchTargets } = trpc.kwStrategy.listTargets.useQuery(
    { campaignId: selectedCampaignId! },
    { enabled: selectedCampaignId != null }
  );
  const targets = targetsData?.targets ?? [];

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const addTargetMut = trpc.kwStrategy.addTarget.useMutation({
    onSuccess: () => {
      setAddKeyword("");
      refetchTargets();
      refetchCampaigns();
      toast.success("Keyword added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTargetMut = trpc.kwStrategy.updateTarget.useMutation({
    onSuccess: () => {
      refetchTargets();
      refetchCampaigns();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTargetMut = trpc.kwStrategy.removeTarget.useMutation({
    onSuccess: () => {
      refetchTargets();
      refetchCampaigns();
      toast.success("Keyword removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateClusterMut = trpc.kwStrategy.generateCluster.useMutation({
    onSuccess: (data) => {
      setIsGenerating(false);
      refetchTargets();
      refetchCampaigns();
      toast.success(`AI generated ${data.inserted} keywords for this campaign!`);
    },
    onError: (e) => {
      setIsGenerating(false);
      toast.error(e.message);
    },
  });

  const enrichMut = trpc.kwStrategy.enrichTargets.useMutation({
    onSuccess: (data) => {
      setIsEnriching(false);
      refetchTargets();
      toast.success(`Enriched ${data.enriched} keywords with DataForSEO volume data`);
    },
    onError: (e) => {
      setIsEnriching(false);
      toast.error(e.message);
    },
  });

  const deleteCampaignMut = trpc.kwStrategy.deleteCampaign.useMutation({
    onSuccess: () => {
      setSelectedCampaignId(null);
      refetchCampaigns();
      toast.success("Campaign deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [isSyncingGsc, setIsSyncingGsc] = useState(false);
  const syncGscMut = trpc.gsc.syncPositionsToKeywordTargets.useMutation({
    onSuccess: (data) => {
      setIsSyncingGsc(false);
      refetchTargets();
      refetchCampaigns();
      toast.success(
        `GSC sync complete \u2014 ${data.matched}/${data.total} keywords matched (${data.gscQueriesFetched} GSC queries fetched)`
      );
    },
    onError: (e) => {
      setIsSyncingGsc(false);
      toast.error("GSC sync failed: " + e.message);
    },
  });

  // Filter targets
  const filteredTargets = targets.filter((t) => {
    if (filterStage !== "all" && t.funnelStage !== filterStage) return false;
    if (filterStatus !== "all" && t.contentStatus !== filterStatus) return false;
    return true;
  });

  // Group by type for the cluster view
  const pillarTargets = filteredTargets.filter((t) => t.keywordType === "pillar");
  const clusterTargets = filteredTargets.filter((t) => t.keywordType === "cluster");
  const conversionTargets = filteredTargets.filter((t) => t.keywordType === "conversion");

  const handleGenerate = () => {
    if (!selectedCampaign) return;
    setIsGenerating(true);
    generateClusterMut.mutate({
      campaignId: selectedCampaign.id,
      pillarKeyword: selectedCampaign.pillarKeyword,
      monetizationGoal: selectedCampaign.monetizationGoal as
        | "academy"
        | "supplements"
        | "testing"
        | "free_lead",
      existingKeywords: targets.map((t) => t.keyword),
    });
  };

  const handleEnrich = () => {
    if (!selectedCampaignId) return;
    setIsEnriching(true);
    enrichMut.mutate({ campaignId: selectedCampaignId });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Keyword Strategy
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Topic cluster campaigns — own the topics that drive Academy memberships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsSyncingGsc(true);
                syncGscMut.mutate();
              }}
              disabled={isSyncingGsc}
              title="Sync GSC position data into all keyword targets"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGsc ? "animate-spin" : ""}`} />
              {isSyncingGsc ? "Syncing GSC..." : "Sync GSC Positions"}
            </button>
            <NewCampaignDialog onCreated={refetchCampaigns} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Campaign list */}
          <div className="lg:col-span-1 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mb-2">
              Campaigns ({campaigns.length})
            </div>

            {campaigns.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-border rounded-xl">
                <Target className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No campaigns yet.</p>
                <p className="text-xs mt-1">Create one to start building topic authority.</p>
              </div>
            )}

            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                isSelected={selectedCampaignId === c.id}
                onSelect={() => setSelectedCampaignId(c.id)}
              />
            ))}

            {/* Strategy guide */}
            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Strategy Framework
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <span className="text-violet-700 font-medium w-16 shrink-0">Pillar</span>
                  <span>1 broad page that owns the topic (e.g. "gut health")</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-700 font-medium w-16 shrink-0">Cluster</span>
                  <span>8–12 educational posts that link back to the pillar</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-rose-700 font-medium w-16 shrink-0">Conversion</span>
                  <span>3–5 high-intent pages that sell Academy / supplements</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Campaign detail */}
          <div className="lg:col-span-2">
            {!selectedCampaign ? (
              <div className="flex items-center justify-center h-64 border border-border rounded-xl text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a campaign to view its keyword roadmap</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Campaign header */}
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedCampaign.name}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Pillar: <span className="text-primary font-medium">"{selectedCampaign.pillarKeyword}"</span>
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEnrich}
                      disabled={isEnriching || targets.length === 0}
                      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isEnriching ? "animate-spin" : ""}`} />
                      {isEnriching ? "Enriching..." : "Get Volumes"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                      {isGenerating ? "Generating..." : "AI Generate Cluster"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm("Delete this campaign and all its keywords?")) {
                          deleteCampaignMut.mutate({ id: selectedCampaign.id });
                        }
                      }}
                      className="border-rose-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1.5 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Total", value: targets.length, color: "text-foreground" },
                    {
                      label: "Published",
                      value: targets.filter((t) => t.contentStatus === "published").length,
                      color: "text-emerald-600",
                    },
                    {
                      label: "In Progress",
                      value: targets.filter((t) => t.contentStatus === "in_progress").length,
                      color: "text-blue-600",
                    },
                    {
                      label: "Not Started",
                      value: targets.filter((t) => t.contentStatus === "not_started").length,
                      color: "text-muted-foreground",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-3 rounded-lg bg-card border border-border text-center shadow-sm"
                    >
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-32">
                      <SelectValue placeholder="Funnel stage" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      <SelectItem value="all">All stages</SelectItem>
                      <SelectItem value="tofu">TOFU</SelectItem>
                      <SelectItem value="mofu">MOFU</SelectItem>
                      <SelectItem value="bofu">BOFU</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-36">
                      <SelectValue placeholder="Content status" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="briefed">Briefed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Add keyword inline */}
                <div className="flex gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                  <Input
                    value={addKeyword}
                    onChange={(e) => setAddKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && addKeyword.trim()) {
                        addTargetMut.mutate({
                          campaignId: selectedCampaign.id,
                          keyword: addKeyword.trim(),
                          keywordType: addType,
                          funnelStage: addStage,
                          monetizationTag: addMono,
                        });
                      }
                    }}
                    placeholder="Add a keyword..."
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground/50 text-sm h-8 flex-1"
                  />
                  <Select value={addType} onValueChange={(v) => setAddType(v as KeywordType)}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      <SelectItem value="pillar">Pillar</SelectItem>
                      <SelectItem value="cluster">Cluster</SelectItem>
                      <SelectItem value="conversion">Conversion</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={addStage} onValueChange={(v) => setAddStage(v as FunnelStage)}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      <SelectItem value="tofu">TOFU</SelectItem>
                      <SelectItem value="mofu">MOFU</SelectItem>
                      <SelectItem value="bofu">BOFU</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!addKeyword.trim()) return;
                      addTargetMut.mutate({
                        campaignId: selectedCampaign.id,
                        keyword: addKeyword.trim(),
                        keywordType: addType,
                        funnelStage: addStage,
                        monetizationTag: addMono,
                      });
                    }}
                    disabled={!addKeyword.trim() || addTargetMut.isPending}
                    className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground px-3"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Keyword groups */}
                {targets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-border rounded-xl">
                    <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No keywords yet.</p>
                    <p className="text-xs mt-1">
                      Click "AI Generate Cluster" to auto-build a full topic cluster, or add
                      keywords manually above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {[
                      { label: "Pillar Page", items: pillarTargets, icon: <TrendingUp className="w-4 h-4 text-violet-600" />, color: "text-violet-700" },
                      { label: "Cluster Pages", items: clusterTargets, icon: <BarChart3 className="w-4 h-4 text-blue-600" />, color: "text-blue-700" },
                      { label: "Conversion Pages", items: conversionTargets, icon: <ChevronRight className="w-4 h-4 text-rose-600" />, color: "text-rose-700" },
                    ].map(({ label, items, icon, color }) =>
                      items.length > 0 ? (
                        <div key={label}>
                          <div className={`flex items-center gap-1.5 text-xs font-semibold ${color} mb-2`}>
                            {icon}
                            {label} ({items.length})
                          </div>
                          <div className="space-y-1.5">
                            {items.map((t) => (
                              <TargetRow
                                key={t.id}
                                target={t}
                                onUpdate={(id, updates) => updateTargetMut.mutate({ id, ...updates } as Parameters<typeof updateTargetMut.mutate>[0])}
                                onRemove={(id) => removeTargetMut.mutate({ id })}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
