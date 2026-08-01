/**
 * Script Factory — Phase E
 *
 * Corpus-grounded script generation with [VERIFIED] tags.
 * Tabs: Generate, Library, Stats
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  Trash2,
  TrendingUp,
  Wand2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "../components/DashboardLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMATS = [
  { value: "youtube_script", label: "YouTube Script" },
  { value: "short_form", label: "Short-Form (60–90s)" },
  { value: "email", label: "Email" },
  { value: "ad_copy", label: "Ad Copy" },
  { value: "sales_page_section", label: "Sales Page Section" },
  { value: "podcast_outline", label: "Podcast Outline" },
] as const;

const PATTERN_TYPES = [
  "hook", "pain_point", "proof_element", "objection_handler", "cta",
  "story_structure", "key_phrase", "transformation_arc", "authority_signal",
  "social_proof", "open_loop",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

const FORMAT_LABELS: Record<string, string> = {
  youtube_script: "YouTube Script",
  short_form: "Short-Form",
  email: "Email",
  ad_copy: "Ad Copy",
  sales_page_section: "Sales Page",
  podcast_outline: "Podcast Outline",
};

// ─── Verified tag renderer ────────────────────────────────────────────────────

function renderScriptWithTags(scriptBody: string): React.ReactNode {
  const parts = scriptBody.split(/(\[VERIFIED\]|\[[A-Z_]+\])/g);
  return parts.map((part, i) => {
    if (part === "[VERIFIED]") {
      return (
        <span key={i} className="inline-flex items-center gap-0.5 text-green-700 font-semibold text-xs bg-green-50 border border-green-200 rounded px-1 py-0.5 mx-0.5">
          <ShieldCheck className="w-3 h-3" /> VERIFIED
        </span>
      );
    }
    if (/^\[[A-Z_]+\]$/.test(part)) {
      return (
        <span key={i} className="inline-block text-primary font-bold text-xs bg-primary/10 rounded px-1.5 py-0.5 mx-0.5 my-1">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoIdea {
  topic: string;
  rationale: string;
  audienceAlignment: number;
  contentGap: string;
  recommendedFormat: string;
  recommendedPatterns: string[];
  analogDataSource: string;
  seedKeyword?: string;
}

/** VidIQ payload persisted on a suggested idea (Phase 1). */
interface PersistedVidiq {
  keyword: string;
  volume: number;
  competition: number;
  opportunityScore: number;
  estimatedMonthlySearch: number;
  topRelatedKeywords: { keyword: string; overall: number; volume: number }[];
}

/**
 * A row from `suggested_ideas` — the persistent, DB-backed idea.
 * Mirrors the server shape; JSON columns arrive already parsed by tRPC.
 */
interface PersistedIdea {
  id: number;
  topic: string;
  rationale: string | null;
  audienceAlignment: number | null;
  contentGap: string | null;
  recommendedFormat: string | null;
  recommendedPatterns: string[] | null;
  analogDataSource: string | null;
  analogDataEntryId: number | null;
  personaId: number | null;
  vidiqData: PersistedVidiq | null;
  seedKeyword: string | null;
  status: string;
  generatedScriptId: number | null;
  weekLabel: string | null;
  source: string | null;
  createdAt: Date | string;
}

/** Everything the generation panel needs when arriving from an idea card. */
export interface IdeaHandoff {
  ideaId: number;
  topic: string;
  format: string;
  patterns: string[];
  personaId: number | null;
  analogDataEntryId: number | null;
  seedKeyword: string | null;
}

interface SuperchargedIdea extends VideoIdea {
  vidiq: {
    keyword: string;
    volume: number;
    competition: number;
    opportunityScore: number;
    estimatedMonthlySearch: number;
    topRelatedKeywords: { keyword: string; overall: number; volume: number }[];
  } | null;
}

// ─── Video Idea Engine ────────────────────────────────────────────────────────

interface VideoIdeaEngineProps {
  /** Hands the full idea context to the generation panel (Phase 1.5 / 2.4). */
  onSelectIdea: (handoff: IdeaHandoff) => void;
}

function VideoIdeaEngine({ onSelectIdea }: VideoIdeaEngineProps) {
  const utils = trpc.useUtils();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  // ── Ideas render from the DATABASE, not from mutation state ────────────────
  // This is what makes them survive navigation: leaving the page and coming
  // back re-runs this query and shows the same rows.
  const { data: ideaData, isLoading } = trpc.scriptFactory.listSuggestedIdeas.useQuery({
    status: "all",
    limit: 200,
    offset: 0,
  });

  const thisWeek = (ideaData?.thisWeek ?? []) as unknown as PersistedIdea[];
  const shortlist = (ideaData?.shortlist ?? []) as unknown as PersistedIdea[];
  const dismissed = (ideaData?.dismissed ?? []) as unknown as PersistedIdea[];
  const generated = (ideaData?.generated ?? []) as unknown as PersistedIdea[];
  const weekLabel = ideaData?.weekLabel ?? "";

  const refreshIdeas = () => {
    utils.scriptFactory.listSuggestedIdeas.invalidate();
  };

  const suggestIdeas = trpc.scriptFactory.suggestIdeas.useMutation({
    onSuccess: (data) => {
      refreshIdeas();
      setExpandedId(null);
      if (data.savedIdeas.length === 0) {
        toast.info("No ideas generated. Add analog data in Analyze → Library first for best results.");
        return;
      }
      const researchNote = data.researchSkipped
        ? " (analog only — research unavailable)"
        : ` · ${data.researchSeedCount} research seeds`;
      toast.success(
        `${data.savedIdeas.length} new ideas from ${data.analogDataCount} analog entries${researchNote}.`
      );
      if (data.researchSkipped && data.reason) {
        toast.info(data.reason);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = trpc.scriptFactory.updateIdeaStatus.useMutation({
    onSuccess: (data) => {
      refreshIdeas();
      if (data.status === "shortlisted") {
        toast.success("Shortlisted — future ideas will lean into this direction.");
      } else if (data.status === "dismissed") {
        toast.success("Dismissed — we'll never resurface this angle.");
      } else {
        toast.success("Idea restored.");
      }
    },
    onError: (err) => toast.error(`Could not update idea: ${err.message}`),
  });

  const supercharge = trpc.scriptFactory.superchargeIdeas.useMutation({
    onSuccess: () => toast.success("Ideas supercharged with VidIQ keyword data!"),
    onError: (err) => toast.error(`VidIQ supercharge failed: ${err.message}`),
  });

  const getAlignmentColor = (score: number) => {
    if (score >= 80) return "text-green-700 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-700 bg-yellow-50 border-yellow-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 70) return "text-green-700";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const formatVolume = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  };

  /** One idea card. Shared by the weekly, shortlist, and dismissed sections. */
  const renderIdeaCard = (idea: PersistedIdea, opts?: { dimmed?: boolean }) => {
    const isExpanded = expandedId === idea.id;
    const vidiq = idea.vidiqData;
    const patterns = idea.recommendedPatterns ?? [];
    const alignment = idea.audienceAlignment ?? 0;
    const isGenerated = idea.status === "generated";

    return (
      <div
        key={idea.id}
        className={`border rounded-lg bg-background overflow-hidden ${opts?.dimmed ? "opacity-60" : ""}`}
      >
        {/* Collapsed header */}
        <div
          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : idea.id)}
        >
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{idea.topic}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getAlignmentColor(alignment)}`}>
                <Target className="w-2.5 h-2.5 inline mr-0.5" />
                {alignment}% aligned
              </span>
              <span className="text-xs text-muted-foreground">
                {FORMAT_LABELS[idea.recommendedFormat ?? ""] ?? idea.recommendedFormat}
              </span>
              {/* VidIQ chip — volume + opportunity, straight from the persisted row */}
              {vidiq && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded border border-yellow-200 bg-yellow-50 text-yellow-800 font-medium"
                  title={`Keyword "${vidiq.keyword}" — volume ${vidiq.volume}, competition ${vidiq.competition}`}
                >
                  <Zap className="w-2.5 h-2.5 inline mr-0.5 text-yellow-500" />
                  {formatVolume(vidiq.volume)} vol · {vidiq.opportunityScore} opp
                </span>
              )}
              {/* Seed keyword tag */}
              {idea.seedKeyword && (
                <span className="text-xs px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
                  <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />
                  {idea.seedKeyword}
                </span>
              )}
              {isGenerated && (
                <Badge className="bg-purple-100 text-purple-800 text-xs">generated</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Shortlist */}
            {idea.status !== "shortlisted" && !isGenerated && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                title="Shortlist — trains the system to suggest more ideas like this"
                disabled={updateStatus.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: idea.id, status: "shortlisted" });
                }}
              >
                <Bookmark className="w-3 h-3" />
              </Button>
            )}
            {idea.status === "shortlisted" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs bg-blue-50 border-blue-300 text-blue-700"
                title="Already shortlisted"
                disabled
              >
                <Bookmark className="w-3 h-3 fill-blue-700" />
              </Button>
            )}
            {/* Dismiss / Restore */}
            {idea.status !== "dismissed" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                title="Dismiss — the system will never resurface this angle"
                disabled={updateStatus.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: idea.id, status: "dismissed" });
                }}
              >
                <ThumbsDown className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                title="Restore this idea"
                disabled={updateStatus.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: idea.id, status: "suggested" });
                }}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            )}
            {/* Generate Script */}
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 text-xs h-7"
              onClick={(e) => {
                e.stopPropagation();
                onSelectIdea({
                  ideaId: idea.id,
                  topic: idea.topic,
                  format: idea.recommendedFormat ?? "youtube_script",
                  patterns,
                  personaId: idea.personaId,
                  analogDataEntryId: idea.analogDataEntryId,
                  seedKeyword: idea.seedKeyword,
                });
                toast.success("Idea loaded into Script Brief below!");
              }}
            >
              Generate Script
            </Button>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="border-t bg-muted/20 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Why This Will Convert</p>
                <p className="text-xs">{idea.rationale}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Content Gap Filled</p>
                <p className="text-xs">{idea.contentGap}</p>
              </div>
            </div>

            {patterns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Recommended Pattern Types</p>
                <div className="flex flex-wrap gap-1">
                  {patterns.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {p.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Analog source:</span> {idea.analogDataSource ?? "—"}
              {idea.analogDataEntryId && (
                <span className="ml-1 text-primary">(entry #{idea.analogDataEntryId} — will preselect as North Star)</span>
              )}
            </div>

            {/* VidIQ detail */}
            {vidiq && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> VidIQ Keyword Data: "{vidiq.keyword}"
                </p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center bg-background rounded border p-2">
                    <p className="text-lg font-bold text-primary">{formatVolume(vidiq.volume)}</p>
                    <p className="text-xs text-muted-foreground">Search Volume</p>
                  </div>
                  <div className="text-center bg-background rounded border p-2">
                    <p className={`text-lg font-bold ${getOpportunityColor(vidiq.opportunityScore)}`}>{vidiq.opportunityScore}</p>
                    <p className="text-xs text-muted-foreground">Opportunity</p>
                  </div>
                  <div className="text-center bg-background rounded border p-2">
                    <p className="text-lg font-bold text-foreground">{vidiq.competition}</p>
                    <p className="text-xs text-muted-foreground">Competition</p>
                  </div>
                </div>
                {vidiq.estimatedMonthlySearch > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    ~{formatVolume(vidiq.estimatedMonthlySearch)} estimated monthly searches
                  </p>
                )}
                {(vidiq.topRelatedKeywords ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Top Related Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {vidiq.topRelatedKeywords.slice(0, 5).map((k) => (
                        <span
                          key={k.keyword}
                          className="text-xs px-2 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-800"
                          title={`Opportunity: ${k.overall} | Volume: ${formatVolume(k.volume)}`}
                        >
                          {k.keyword}
                          <span className="ml-1 opacity-60">{k.overall}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isGenerated && idea.generatedScriptId && (
              <div className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1">
                Script #{idea.generatedScriptId} was generated from this idea.
              </div>
            )}

            {!isGenerated && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  onSelectIdea({
                    ideaId: idea.id,
                    topic: idea.topic,
                    format: idea.recommendedFormat ?? "youtube_script",
                    patterns,
                    personaId: idea.personaId,
                    analogDataEntryId: idea.analogDataEntryId,
                    seedKeyword: idea.seedKeyword,
                  });
                  toast.success("Idea loaded into Script Brief below!");
                }}
              >
                <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Generate Script from This Idea
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Video Idea Engine
            <span className="text-xs font-normal text-muted-foreground">
              — Analog Northstar + live keyword research, persisted
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {thisWeek.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                onClick={() =>
                  supercharge.mutate({
                    ideas: thisWeek.map((i) => ({
                      topic: i.topic,
                      rationale: i.rationale ?? "",
                      audienceAlignment: i.audienceAlignment ?? 0,
                      contentGap: i.contentGap ?? "",
                      recommendedFormat: i.recommendedFormat ?? "youtube_script",
                      recommendedPatterns: i.recommendedPatterns ?? [],
                      analogDataSource: i.analogDataSource ?? "",
                    })),
                  })
                }
                disabled={supercharge.isPending}
              >
                {supercharge.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Supercharging…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 mr-1.5 text-yellow-500" /> Supercharge with VidIQ</>
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => suggestIdeas.mutate({ count: 6, source: "manual_generate" })}
              disabled={suggestIdeas.isPending}
            >
              {suggestIdeas.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> {thisWeek.length > 0 ? "Generate More" : "Generate Ideas"}</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Loading saved ideas…</span>
          </div>
        )}

        {suggestIdeas.isPending && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">Blending analog data with live keyword research…</p>
            <p className="text-xs">Checking VidIQ for search demand and overperforming titles</p>
          </div>
        )}

        {/* ── Suggested this week ─────────────────────────────────────────── */}
        {!isLoading && !suggestIdeas.isPending && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Suggested this week
                {weekLabel && (
                  <span className="text-xs font-normal text-muted-foreground">({weekLabel})</span>
                )}
              </p>
              <span className="text-xs text-muted-foreground">{thisWeek.length} ideas</span>
            </div>

            {thisWeek.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2 border-2 border-dashed rounded-lg">
                <Lightbulb className="w-8 h-8 opacity-30" />
                <p className="text-sm text-center">
                  No ideas for this week yet. Click <strong>Generate Ideas</strong>, or wait for the Monday auto-run.<br />
                  <span className="text-xs">Add content in Analyze → Library first for best results.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">{thisWeek.map((idea) => renderIdeaCard(idea))}</div>
            )}
          </div>
        )}

        {/* ── Shortlist ───────────────────────────────────────────────────── */}
        {!suggestIdeas.isPending && shortlist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                Shortlist
              </p>
              <span className="text-xs text-muted-foreground">{shortlist.length} saved</span>
            </div>
            <div className="space-y-2">{shortlist.map((idea) => renderIdeaCard(idea))}</div>
          </div>
        )}

        {/* ── Generated ───────────────────────────────────────────────────── */}
        {!suggestIdeas.isPending && generated.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              Already generated
              <span className="text-xs font-normal text-muted-foreground">({generated.length})</span>
            </p>
            <div className="space-y-2">{generated.slice(0, 5).map((idea) => renderIdeaCard(idea, { dimmed: true }))}</div>
          </div>
        )}

        {/* ── Dismissed (collapsible) ─────────────────────────────────────── */}
        {!suggestIdeas.isPending && dismissed.length > 0 && (
          <div className="border-t pt-3">
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowDismissed((s) => !s)}
            >
              {showDismissed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Dismissed ({dismissed.length})
            </button>
            {showDismissed && (
              <div className="space-y-2 mt-2">{dismissed.map((idea) => renderIdeaCard(idea, { dimmed: true }))}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const utils = trpc.useUtils();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<string>("youtube_script");
  const [minEff, setMinEff] = useState(0.5);
  const [topPerType, setTopPerType] = useState(3);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "hook", "pain_point", "proof_element", "cta", "transformation_arc",
  ]);

  // ── Phase 2: persona, North Star, target length, idea linkage ─────────────
  const [personaId, setPersonaId] = useState<string>("none");
  const [northStarIds, setNorthStarIds] = useState<number[]>([]);
  const [northStarFilter, setNorthStarFilter] = useState<string>("all");
  const [targetLength, setTargetLength] = useState<string>("none");
  const [sourceIdeaId, setSourceIdeaId] = useState<number | null>(null);

  // ── Phase 3: deep research ────────────────────────────────────────────────
  const [useDeepResearch, setUseDeepResearch] = useState(false);
  const [seedKeyword, setSeedKeyword] = useState<string>("");
  const [researchJobId, setResearchJobId] = useState<number | null>(null);

  const [result, setResult] = useState<{
    id: number; title: string; scriptBody: string;
    verifiedCount: number; totalElements: number; verificationPct: number;
    patternsUsed: number; corpusEntriesUsed: number; externalTranscriptsUsed?: number;
    wordCount?: number; targetWordCount?: number | null; continuationPassUsed?: boolean;
    personaName?: string | null; northStarTitles?: string[]; researchJobId?: number | null;
  } | null>(null);

  // Persona list — reused pattern from AnalyzeData.tsx
  const { data: personas } = trpc.personas.list.useQuery();
  // Analog entries for the North Star picker
  const { data: analogEntries } = trpc.analogData.listEntries.useQuery({ limit: 200, offset: 0 });

  const generate = trpc.scriptFactory.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      const wordNote = data.wordCount ? ` · ${data.wordCount} words` : "";
      toast.success(`Script generated! ${data.verificationPct}% verified${wordNote}.`);
      utils.scriptFactory.list.invalidate();
      utils.scriptFactory.getStats.invalidate();
      // An idea that produced a script changes bucket — refresh the engine.
      utils.scriptFactory.listSuggestedIdeas.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Deep research job: run + poll ─────────────────────────────────────────
  const runResearch = trpc.scriptFactory.runDeepResearch.useMutation({
    onSuccess: (data) => {
      setResearchJobId(data.jobId);
      if (data.status === "failed") {
        toast.error(`Research failed: ${data.error ?? "unknown error"}`);
      } else {
        toast.success(
          `Research complete — ${data.outlierCount} outliers, ` +
          `${data.transcriptsFetched + data.transcriptsCached} transcripts, ${data.patternCount} patterns.`
        );
      }
    },
    onError: (err) => toast.error(`Research failed: ${err.message}`),
  });

  const { data: researchJob } = trpc.scriptFactory.getResearchJob.useQuery(
    { id: researchJobId ?? 0 },
    {
      enabled: researchJobId !== null,
      // Poll while the job is still moving through its stages.
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s && s !== "complete" && s !== "failed" ? 2000 : false;
      },
    }
  );

  const researchReady = researchJob?.status === "complete";

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleNorthStar = (id: number) => {
    setNorthStarIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        toast.info("Up to 5 North Star entries.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.scriptBody);
    toast.success("Script copied to clipboard.");
  };

  /**
   * Arrival from an idea card. Pre-fills the whole brief: topic, format,
   * patterns, persona, North Star selection, and pre-arms deep research when
   * the idea carries a seed keyword (Phase 3.4).
   */
  const handleSelectIdea = (handoff: IdeaHandoff) => {
    setTopic(handoff.topic);
    setFormat(handoff.format);
    setSelectedTypes(handoff.patterns.length > 0 ? handoff.patterns : selectedTypes);
    setSourceIdeaId(handoff.ideaId);
    setPersonaId(handoff.personaId ? String(handoff.personaId) : "none");
    setNorthStarIds(handoff.analogDataEntryId ? [handoff.analogDataEntryId] : []);
    // A previous job belongs to a previous topic.
    setResearchJobId(null);
    if (handoff.seedKeyword) {
      setSeedKeyword(handoff.seedKeyword);
      setUseDeepResearch(true);
    } else {
      setSeedKeyword("");
    }
    setTimeout(() => {
      document.getElementById("script-brief-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-5">
      {/* Video Idea Engine — top box */}
      <VideoIdeaEngine onSelectIdea={handleSelectIdea} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Config */}
        <div className="space-y-5">
          <Card id="script-brief-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" /> Script Brief
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Topic / Brief</label>
                <Textarea
                  placeholder="e.g. 'Why most people can't sleep despite being exhausted — and the ancient practice that fixes it in 7 days'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Be specific. Or use <strong>Generate Ideas</strong> above to auto-fill from analog data.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Format</label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Phase 2: Persona + target length ─────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Persona / Voice</label>
                  <Select value={personaId} onValueChange={setPersonaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No persona</SelectItem>
                      {(personas ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Target Length</label>
                  <Select value={targetLength} onValueChange={setTargetLength}>
                    <SelectTrigger>
                      <SelectValue placeholder="Model default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Model default</SelectItem>
                      <SelectItem value="10">10 min (~1450 words)</SelectItem>
                      <SelectItem value="15">15 min (~2175 words)</SelectItem>
                      <SelectItem value="20">20 min (~2900 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Phase 2: North Star picker ───────────────────────────── */}
              <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    North Star — proven analog assets
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {northStarIds.length} selected
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pick the converting assets this script should sound like. Selected entries are
                  injected at full depth and outrank all competitor research.
                </p>
                <Select value={northStarFilter} onValueChange={setNorthStarFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All source types</SelectItem>
                    <SelectItem value="book">Books</SelectItem>
                    <SelectItem value="course">Courses</SelectItem>
                    <SelectItem value="webinar">Webinars</SelectItem>
                    <SelectItem value="sales_page">Sales pages</SelectItem>
                    <SelectItem value="email">Emails</SelectItem>
                  </SelectContent>
                </Select>
                <div className="max-h-40 overflow-y-auto space-y-1 mt-1">
                  {(analogEntries ?? [])
                    .filter((e: any) => northStarFilter === "all" || e.sourceType === northStarFilter)
                    .slice(0, 60)
                    .map((e: any) => {
                      const checked = northStarIds.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          onClick={() => setNorthStarIds((prev) =>
                            checked ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                          )}
                          className={`w-full text-left text-xs px-2 py-1.5 rounded border transition-colors ${
                            checked
                              ? "bg-amber-100 border-amber-400 text-amber-900"
                              : "bg-background border-border hover:border-amber-300"
                          }`}
                        >
                          <span className="font-medium">{checked ? "✓ " : ""}{e.title}</span>
                          {e.sourceType && (
                            <span className="text-muted-foreground ml-1">· {e.sourceType}</span>
                          )}
                        </button>
                      );
                    })}
                  {(analogEntries ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1 py-2">
                      No analog entries yet. Add them in Analyze → Library.
                    </p>
                  )}
                </div>
              </div>

              {/* ── Phase 3: Deep Research ───────────────────────────────── */}
              <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                      Deep Research Mode
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Find the videos already winning this topic, pull their transcripts, and mine
                      what makes them work — so this script beats them.
                    </p>
                  </div>
                  <button
                    onClick={() => setUseDeepResearch((v) => !v)}
                    className={`shrink-0 text-xs px-2.5 py-1 rounded border transition-colors ${
                      useDeepResearch
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-background text-muted-foreground border-border hover:border-purple-400"
                    }`}
                  >
                    {useDeepResearch ? "On" : "Off"}
                  </button>
                </div>

                {useDeepResearch && (
                  <div className="space-y-2 pt-1">
                    <Input
                      placeholder="Seed keyword (optional — derived from the topic if blank)"
                      value={seedKeyword}
                      onChange={(e) => setSeedKeyword(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-purple-400 text-purple-700"
                      disabled={runResearch.isPending || topic.trim().length < 3}
                      onClick={() => runResearch.mutate({
                        topic,
                        seedKeyword: seedKeyword.trim() || undefined,
                        maxTranscripts: 3,
                      })}
                    >
                      {runResearch.isPending
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Researching…</>
                        : <><Search className="w-3.5 h-3.5 mr-1.5" /> Run Research</>}
                    </Button>

                    {researchJob && (
                      <div className="text-xs space-y-1 bg-background rounded p-2 border">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">Status:</span>
                          <span className={researchReady ? "text-green-700" : "text-muted-foreground"}>
                            {String(researchJob.status).replace(/_/g, " ")}
                          </span>
                          {!researchReady && researchJob.status !== "failed" && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {researchJob.outlierCount} outliers ·{" "}
                          {researchJob.transcriptsFetched + researchJob.transcriptsCached} transcripts ·{" "}
                          {researchJob.patternCount} patterns
                        </p>
                        {researchJob.quotaBlocked && (
                          <p className="text-amber-700">
                            Daily transcript quota reached — research used what it could get.
                          </p>
                        )}
                        {researchJob.errorMessage && (
                          <p className="text-red-600">{researchJob.errorMessage}</p>
                        )}
                        {(researchJob.outlierVideos ?? []).slice(0, 3).map((v: any) => (
                          <p key={v.videoId} className="truncate text-muted-foreground">
                            • {v.title}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Pattern Types to Include
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PATTERN_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        selectedTypes.includes(type)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {type.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Min Pattern Effectiveness: <span className="text-primary font-bold">{(minEff * 100).toFixed(0)}%</span>
                </label>
                <Slider min={0} max={1} step={0.05} value={[minEff]} onValueChange={([v]) => setMinEff(v)} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Top Patterns Per Type: <span className="text-primary font-bold">{topPerType}</span>
                </label>
                <Slider min={1} max={5} step={1} value={[topPerType]} onValueChange={([v]) => setTopPerType(v)} />
              </div>

              <Button
                className="w-full"
                disabled={generate.isPending || topic.trim().length < 10 || selectedTypes.length === 0}
                onClick={() => generate.mutate({
                  topic,
                  format: format as any,
                  patternTypes: selectedTypes,
                  minPatternEffectiveness: minEff,
                  topPatternsPerType: topPerType,
                  useCorpusSearch: true,
                  // Phase 2/3 wiring
                  personaId: personaId !== "none" ? Number(personaId) : undefined,
                  analogDataEntryIds: northStarIds.length > 0 ? northStarIds : undefined,
                  targetLengthMinutes: targetLength !== "none"
                    ? (Number(targetLength) as 10 | 15 | 20)
                    : undefined,
                  sourceIdeaId: sourceIdeaId ?? undefined,
                  useDeepResearch,
                  researchJobId: researchJobId ?? undefined,
                })}
              >
                {generate.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating + fetching transcripts…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Script</>
                )}
              </Button>

              {generate.isPending && (
                <p className="text-xs text-center text-muted-foreground">
                  Fetching top YouTube transcripts via Supadata + building corpus context…
                </p>
              )}
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>How [VERIFIED] works:</strong> The LLM draws from your proven patterns and corpus excerpts.
            Every element it borrows is tagged <code className="bg-amber-100 px-1 rounded">[VERIFIED]</code>.
            Aim for &gt;40% verification coverage on key structural elements.
            <br />
            <span className="text-xs mt-1 block">
              <strong>Supadata:</strong> Top relevant YouTube transcripts are automatically fetched and injected as tertiary research context (below your analog data Northstar).
            </span>
          </div>
        </div>

        {/* Right: Result */}
        <div className="space-y-4">
          {generate.isPending && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Pulling patterns from corpus and generating script…</p>
              <p className="text-xs text-muted-foreground">Also fetching top YouTube transcripts via Supadata</p>
            </div>
          )}

          {result && !generate.isPending && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{result.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        {result.verificationPct}% verified
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {result.verifiedCount} verified / {result.totalElements} elements
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {result.patternsUsed} patterns · {result.corpusEntriesUsed} corpus entries
                      </span>
                      {(result.externalTranscriptsUsed ?? 0) > 0 && (
                        <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                          {result.externalTranscriptsUsed} YouTube transcripts
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <ClipboardCopy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto">
                  {renderScriptWithTags(result.scriptBody)}
                </div>
              </CardContent>
            </Card>
          )}

          {!result && !generate.isPending && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3 border-2 border-dashed rounded-lg">
              <FileText className="w-10 h-10 opacity-30" />
              <p className="text-sm">Fill in the brief and click Generate Script.</p>
              <p className="text-xs text-center">Or use Generate Ideas above to pick a topic first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const utils = trpc.useUtils();
  const [selectedScript, setSelectedScript] = useState<{
    id: number; title: string; scriptBody: string; topic: string; format: string;
    verifiedCount: number; totalElements: number; verificationPct: number;
    status: string; notes: string | null; createdAt: Date;
  } | null>(null);

  const { data: scripts, isLoading } = trpc.scriptFactory.list.useQuery({
    format: "all",
    status: "all",
    limit: 50,
    offset: 0,
  });

  const { data: scriptDetail } = trpc.scriptFactory.get.useQuery(
    { id: selectedScript?.id ?? 0 },
    { enabled: !!selectedScript }
  );

  const updateScript = trpc.scriptFactory.update.useMutation({
    onSuccess: () => {
      utils.scriptFactory.list.invalidate();
      utils.scriptFactory.get.invalidate({ id: selectedScript?.id ?? 0 });
      toast.success("Script updated.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteScript = trpc.scriptFactory.delete.useMutation({
    onSuccess: () => {
      utils.scriptFactory.list.invalidate();
      utils.scriptFactory.getStats.invalidate();
      setSelectedScript(null);
      toast.success("Script deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Production bridge (Phase 4) ─────────────────────────────────────────────
  const sendToProduction = trpc.scriptFactory.sendToProduction.useMutation({
    onSuccess: (data) => {
      utils.scriptFactory.list.invalidate();
      utils.scriptFactory.get.invalidate({ id: selectedScript?.id ?? 0 });
      toast.success(
        data.alreadyInProduction
          ? "Already in production — opening the existing card."
          : "Sent to production.",
        {
          action: {
            label: "Open in Script Library",
            onClick: () => {
              window.location.href = `/script-library?scriptId=${data.productionScriptId}`;
            },
          },
        }
      );
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading scripts…</span>
      </div>
    );
  }

  if (!scripts || scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3 border-2 border-dashed rounded-lg">
        <FileText className="w-10 h-10 opacity-30" />
        <p className="text-sm">No scripts yet. Generate one in the Generate tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scripts.map((script) => (
        <Card
          key={script.id}
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setSelectedScript(script as any)}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{script.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={`text-xs ${STATUS_COLORS[script.status ?? "draft"]}`}>
                    {script.status ?? "draft"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {FORMAT_LABELS[script.format] ?? script.format}
                  </span>
                  <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs">
                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                    {script.verificationPct ?? 0}%
                  </Badge>
                  {script.wordCount != null && script.wordCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {script.wordCount} words
                      {script.targetLengthMinutes ? ` · ${script.targetLengthMinutes} min` : ""}
                    </span>
                  )}
                  {script.researchJobId != null && (
                    <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs">
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                      Researched
                    </Badge>
                  )}
                  {script.productionScriptId != null && (
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                      In Production →
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(script.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Script detail dialog */}
      <Dialog open={!!selectedScript} onOpenChange={(open) => !open && setSelectedScript(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedScript?.title}</DialogTitle>
          </DialogHeader>
          {scriptDetail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs ${STATUS_COLORS[scriptDetail.status ?? "draft"]}`}>
                  {scriptDetail.status}
                </Badge>
                <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs">
                  <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                  {scriptDetail.verificationPct ?? 0}% verified
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {FORMAT_LABELS[scriptDetail.format] ?? scriptDetail.format}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {/* Production bridge: only approved scripts may cross over. */}
                {scriptDetail.status === "approved" && (
                  scriptDetail.productionScriptId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-400 text-blue-700"
                      onClick={() => {
                        window.location.href = `/script-library?scriptId=${scriptDetail.productionScriptId}`;
                      }}
                    >
                      In Production →
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={sendToProduction.isPending}
                      onClick={() => sendToProduction.mutate({ id: scriptDetail.id })}
                    >
                      {sendToProduction.isPending
                        ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        : <Zap className="w-3.5 h-3.5 mr-1" />}
                      Send to Production
                    </Button>
                  )
                )}
                {scriptDetail.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-400 text-green-700"
                    onClick={() => updateScript.mutate({ id: scriptDetail.id, status: "approved" })}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                )}
                {scriptDetail.status !== "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateScript.mutate({ id: scriptDetail.id, status: "archived" })}
                  >
                    Archive
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600"
                  onClick={() => {
                    if (confirm("Delete this script?")) {
                      deleteScript.mutate({ id: scriptDetail.id });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>

              <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                {renderScriptWithTags(scriptDetail.scriptBody ?? "")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: stats, isLoading, refetch } = trpc.scriptFactory.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading stats…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{stats?.total ?? 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Scripts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">{stats?.approved ?? 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">
              {stats?.avgVerificationPct != null ? `${stats.avgVerificationPct.toFixed(0)}%` : "—"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Avg Verification %</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScriptFactory() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Script Factory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate corpus-grounded scripts. Every element drawn from proven content is tagged{" "}
            <span className="inline-flex items-center gap-0.5 text-green-700 font-semibold text-xs bg-green-50 border border-green-200 rounded px-1 py-0.5">
              <ShieldCheck className="w-3 h-3" /> VERIFIED
            </span>.
          </p>
        </div>

        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate">
              <Wand2 className="w-4 h-4 mr-1.5" /> Generate
            </TabsTrigger>
            <TabsTrigger value="library">
              <FileText className="w-4 h-4 mr-1.5" /> Library
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-4">
            <GenerateTab />
          </TabsContent>
          <TabsContent value="library" className="mt-4">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <StatsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
