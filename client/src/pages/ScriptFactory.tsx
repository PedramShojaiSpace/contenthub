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
  Network,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  /** Opens a generated script in the Library tab (v2.1 Bug A item 4). */
  onOpenScript: (scriptId: number) => void;
}

function VideoIdeaEngine({ onSelectIdea, onOpenScript }: VideoIdeaEngineProps) {
  const utils = trpc.useUtils();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  // v2.1 Bug B — finished work collapses so the actionable list stays on top.
  const [showGenerated, setShowGenerated] = useState(false);

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
  // v2.1 Bug C item 5 — only ideas without VidIQ data are worth spending on.
  const unenrichedThisWeek = thisWeek.filter((i) => !i.vidiqData);
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
    onSuccess: (data) => {
      // v2.1 Bug C — enrichment now lives in the DB, so refetch to render it.
      // The old version held results in component state and lost them on unmount.
      utils.scriptFactory.listSuggestedIdeas.invalidate();

      const parts: string[] = [];
      if (data.enrichedIds.length > 0) parts.push(`${data.enrichedIds.length} enriched`);
      if (data.alreadyEnriched.length > 0) parts.push(`${data.alreadyEnriched.length} already had data`);
      if (data.failedIds.length > 0) parts.push(`${data.failedIds.length} failed`);
      if (data.skippedForTime.length > 0) parts.push(`${data.skippedForTime.length} skipped (time budget)`);

      const summary = parts.join(" · ") || "nothing to do";
      const secs = (data.elapsedMs / 1000).toFixed(1);

      if (data.enrichedIds.length === 0 && data.failedIds.length > 0) {
        toast.error(`VidIQ supercharge: ${summary} (${secs}s)`);
      } else {
        toast.success(`VidIQ supercharge: ${summary} · ${data.creditsSpent} credits · ${secs}s`);
      }
    },
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

            {/* v2.1 Bug A item 4 — this used to be dead text, and only visible
                when the card was expanded, so a generated script had no route
                back to it at all. Now it opens the Library row. */}
            {isGenerated && idea.generatedScriptId && (
              <button
                className="w-full text-left text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1.5 hover:bg-purple-100 hover:border-purple-300 transition-colors flex items-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenScript(idea.generatedScriptId!);
                }}
                title={`Open script #${idea.generatedScriptId} in the Library`}
              >
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className="underline decoration-dotted">
                  Open script #{idea.generatedScriptId} in the Library
                </span>
              </button>
            )}

            {/* A `generated` idea with no script id is an orphan — usually the
                script was deleted. Offer the way out instead of a dead end. */}
            {isGenerated && !idea.generatedScriptId && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 space-y-1.5">
                <p className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Marked generated, but the script is missing (likely deleted).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateStatus.mutate({ id: idea.id, status: "shortlisted" });
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Return to shortlist
                </Button>
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
            {/* v2.1 Bug C — send ids and only for ideas that still lack data, so
                a second click cannot re-spend credits on identical numbers. */}
            {unenrichedThisWeek.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                onClick={() => supercharge.mutate({ ideaIds: unenrichedThisWeek.map((i) => i.id) })}
                disabled={supercharge.isPending}
                title={`Runs VidIQ keyword research on ${unenrichedThisWeek.length} idea(s) · ~${unenrichedThisWeek.length * 5} credits`}
              >
                {supercharge.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Supercharging…</>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />
                    Supercharge {unenrichedThisWeek.length} with VidIQ
                  </>
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
        {/* v2.1 Bug B — these used to render as five full-height cards, which is
            what buried the actionable "Suggested this week" list under finished
            work. They are now one-line rows linking straight to the Library, and
            the whole section stays collapsed until asked for. */}
        {!suggestIdeas.isPending && generated.length > 0 && (
          <div className="border-t pt-3">
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowGenerated((s) => !s)}
            >
              {showGenerated ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <CheckCircle2 className="w-3 h-3 text-purple-600" />
              Already generated ({generated.length})
            </button>
            {showGenerated && (
              <div className="mt-2 space-y-1">
                {generated.map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border bg-muted/20"
                  >
                    <CheckCircle2 className="w-3 h-3 text-purple-600 flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-muted-foreground" title={idea.topic}>
                      {idea.topic}
                    </span>
                    {idea.generatedScriptId ? (
                      <button
                        className="flex-shrink-0 text-purple-700 hover:text-purple-900 underline decoration-dotted"
                        onClick={() => onOpenScript(idea.generatedScriptId!)}
                        title={`Open script #${idea.generatedScriptId} in the Library`}
                      >
                        Script #{idea.generatedScriptId}
                      </button>
                    ) : (
                      <button
                        className="flex-shrink-0 text-amber-700 hover:text-amber-900 flex items-center gap-1"
                        onClick={() => updateStatus.mutate({ id: idea.id, status: "shortlisted" })}
                        title="Script missing — return this idea to the shortlist"
                      >
                        <AlertTriangle className="w-3 h-3" /> missing — restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
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

interface GenerateTabProps {
  /** Opens a saved script in the Library tab (v2.1 Bug A items 3 & 4). */
  onOpenScript: (scriptId: number) => void;
}

function GenerateTab({ onOpenScript }: GenerateTabProps) {
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
  /**
   * Part 3A — story mode. Defaults to "brief": the system hands the operator a
   * slot for a real case instead of inventing a patient. The safe option must be
   * the one you get without choosing.
   */
  const [storyMode, setStoryMode] = useState<"brief" | "composite" | "none">("brief");
  // Part 3B — the operator's own close. Non-empty REPLACES offer binding.
  const [ctaOverride, setCtaOverride] = useState("");
  // Part 3B multi-tier — which laddered tier this script closes on. Never
  // defaulted: a script must not sell a price point the operator did not pick.
  const [offerTier, setOfferTier] = useState<string>("");
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
      utils.scriptFactory.list.invalidate();
      utils.scriptFactory.getStats.invalidate();
      // An idea that produced a script changes bucket — refresh the engine.
      utils.scriptFactory.listSuggestedIdeas.invalidate();
      // v2.1 Bug A item 3 — the script is saved and addressable, so give the
      // operator a one-click route to it. The inline result panel below is
      // ephemeral `useState`: it disappears on any navigation, which is exactly
      // how a correctly-saved script came to look "lost". The toast action is a
      // durable handle on the real Library row.
      toast.success(`Script #${data.id} generated — ${data.verificationPct}% verified${wordNote}.`, {
        duration: 12000,
        action: {
          label: "Open in Library",
          onClick: () => onOpenScript(data.id),
        },
      });
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
      <VideoIdeaEngine onSelectIdea={handleSelectIdea} onOpenScript={onOpenScript} />

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
                          {/* Part 3B — show which entries can actually bind a CTA. */}
                          {e.hasOffer && (
                            <span
                              className="ml-1 text-emerald-700"
                              title={`CTA will close on: ${e.offerName}`}
                            >
                              · offer: {e.offerName}
                            </span>
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

              {/* ── Part 3A: Story Integrity ─────────────────────────────── */}
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Patient Stories
                </label>
                <p className="text-xs text-muted-foreground">
                  The system will never invent a named patient, quoted dialogue, or
                  individual lab results. Choose how stories are handled.
                </p>
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  {([
                    { v: "brief", label: "Story slot", hint: "Leaves you a slot with a suggested shape — you insert a real case." },
                    { v: "composite", label: "Composite", hint: "Writes a labelled, de-identified composite the listener hears announced." },
                    { v: "none", label: "No story", hint: "Skips stories entirely; that time goes to teaching." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      title={opt.hint}
                      onClick={() => setStoryMode(opt.v)}
                      className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                        storyMode === opt.v
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-background text-muted-foreground border-border hover:border-amber-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-snug">
                  {storyMode === "brief" && "A delimited [STORY SLOT] is emitted with a ~90-second shape built from this script's own pain points."}
                  {storyMode === "composite" && "The narrative must open with an audible composite label. An unlabelled composite is rejected."}
                  {storyMode === "none" && "Story sections are omitted and the word budget moves into the teaching sections."}
                </p>
              </div>

              {/* ── Part 3B: Offer binding ──────────────────────── */}
              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  What the script sells
                </label>
                {(() => {
                  const withOffer = (analogEntries ?? []).find(
                    (e: any) => northStarIds.includes(e.id) && e.hasOffer
                  );
                  const tiers: any[] = (withOffer as any)?.offerTiers ?? [];
                  if (ctaOverride.trim()) {
                    return (
                      <p className="text-xs text-emerald-900">
                        The CTA will drive your own close below. Offer binding is{" "}
                        <span className="font-medium">disabled</span> while an override is set —
                        two closes would make the script argue with itself.
                      </p>
                    );
                  }
                  if (tiers.length > 1) {
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs text-emerald-900">
                          <span className="font-medium">{withOffer.title}</span> ladders{" "}
                          {tiers.length} purchasable tiers. Pick which one this script closes
                          on — nothing is chosen for you, because the tier sets the price the
                          script asks for.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tiers.map((t: any) => (
                            <button
                              key={t.offerName}
                              onClick={() =>
                                setOfferTier((prev) => (prev === t.offerName ? "" : t.offerName))
                              }
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                offerTier === t.offerName
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-background text-muted-foreground border-border hover:border-emerald-400"
                              }`}
                            >
                              {t.offerName}
                              {t.pricePoint ? ` · ${t.pricePoint}` : ""}
                            </button>
                          ))}
                        </div>
                        {!offerTier && (
                          <p className="text-[11px] text-amber-700">
                            No tier selected — the CTA will stay generic rather than guess.
                          </p>
                        )}
                      </div>
                    );
                  }
                  if (tiers.length === 1) {
                    return (
                      <p className="text-xs text-emerald-900">
                        The CTA will close on{" "}
                        <span className="font-medium">{tiers[0].offerName}</span>, naming its
                        deliverables and stating only the guarantee that offer actually makes.
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground">
                      No selected North Star entry has an extracted offer, so the CTA stays
                      generic rather than inventing a program, price, or guarantee. Run
                      <span className="font-medium"> Extract offer</span> on a sales page in
                      Analyze → Library, or write your own close below.
                    </p>
                  );
                })()}
                <div className="pt-0.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Or write the close yourself (optional)
                  </label>
                  <Input
                    value={ctaOverride}
                    onChange={(e) => setCtaOverride(e.target.value)}
                    placeholder="e.g. Download the free 3-day gut reset checklist at theurbanmonk.com/checklist"
                    className="h-8 text-xs mt-1"
                  />
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
                  storyMode,
                  ctaOverride: ctaOverride.trim() ? ctaOverride.trim() : undefined,
                  offerTier: offerTier || undefined,
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* v2.1 Bug A item 3 — a durable route to the saved row. This
                        panel is ephemeral state; the Library row is the truth. */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenScript(result.id)}
                      title={`Open script #${result.id} in the Library`}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> Open in Library
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                      <ClipboardCopy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Saved as script <span className="font-mono font-medium">#{result.id}</span> — it stays in the
                  Library even after you leave this tab.
                </p>
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
interface LibraryTabProps {
  /** Script id the page wants opened (set after generation or an idea link). */
  scriptToOpen?: number | null;
  /** Cleared once we have honoured the request, so it does not re-fire. */
  onScriptOpened?: () => void;
}

function LibraryTab({ scriptToOpen, onScriptOpened }: LibraryTabProps = {}) {
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

  // v2.1 Bug A item 3 — honour an externally requested script.
  //
  // The detail dialog is driven by `selectedScript`, which only ever came from a
  // click inside this tab. When the page asks us to open a specific id we look
  // it up in the freshly-invalidated list and select it. Waiting for the list
  // means we open with real row data rather than a placeholder; if the id is not
  // in the list (deleted or beyond the 50-row window) we clear the request
  // instead of retrying forever.
  useEffect(() => {
    if (!scriptToOpen) return;
    if (!scripts) return; // list still loading — try again when it arrives
    const match = scripts.find((s) => s.id === scriptToOpen);
    if (match) {
      setSelectedScript({
        id: match.id,
        title: match.title,
        scriptBody: "",
        topic: match.topic,
        format: match.format,
        verifiedCount: match.verifiedCount,
        totalElements: match.totalElements,
        verificationPct: match.verificationPct ?? 0,
        status: match.status,
        notes: null,
        createdAt: match.createdAt,
      });
    } else {
      toast.error(`Script #${scriptToOpen} is no longer in the library.`);
    }
    onScriptOpened?.();
  }, [scriptToOpen, scripts, onScriptOpened]);

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
  // v2.1 Bug A items 3 & 4 — cross-tab navigation.
  //
  // The tabs used to be uncontrolled (`defaultValue="generate"`), which meant
  // nothing could ever move the operator to the Library or open a specific
  // script. Generated scripts were therefore invisible in practice even though
  // they were saved correctly and sat at the top of the Library list. Lifting
  // both the active tab and the script to open into page state is what makes
  // "generate → land on the script" and "click Script #N → open it" possible.
  const [activeTab, setActiveTab] = useState("generate");
  const [scriptToOpen, setScriptToOpen] = useState<number | null>(null);

  /** Single entry point used by both the generate flow and idea-card links. */
  const openScriptInLibrary = (scriptId: number) => {
    setScriptToOpen(scriptId);
    setActiveTab("library");
  };

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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="generate">
              <Wand2 className="w-4 h-4 mr-1.5" /> Generate
            </TabsTrigger>
            <TabsTrigger value="topics">
              <Network className="w-4 h-4 mr-1.5" /> Topics
            </TabsTrigger>
            <TabsTrigger value="library">
              <FileText className="w-4 h-4 mr-1.5" /> Library
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-4">
            <GenerateTab onOpenScript={openScriptInLibrary} />
          </TabsContent>
          <TabsContent value="topics" className="mt-4">
            <TopicsTab onOpenScript={openScriptInLibrary} />
          </TabsContent>
          <TabsContent value="library" className="mt-4">
            <LibraryTab
              scriptToOpen={scriptToOpen}
              onScriptOpened={() => setScriptToOpen(null)}
            />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <StatsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
// ─── Topics Tab (v2.1 §5.6) ───────────────────────────────────────────────────

/** One row of the tree, flattened for indented rendering. */
type TopicTreeNode = {
  id: number;
  parentId: number | null;
  path: string;
  depth: number;
  label: string;
  description: string | null;
  status: string;
  personaId: number | null;
  analogDataEntryId: number | null;
  seedKeyword: string | null;
  lastMinedAt: string | Date | null;
  vidiqData: {
    keyword?: string;
    volume?: number;
    competition?: number;
    opportunityScore?: number;
    estimatedMonthlySearch?: number;
  } | null;
  directIdeaCount: number;
  subtreeIdeaCount: number;
  childCount: number;
};

/**
 * The Topic Tree: a persistent map of the territory rather than a flat idea list.
 *
 * Rendering choice: the server returns a flat array ordered by depth, and we
 * rebuild parent→child order in the client with a single pass rather than a
 * recursive component. A flat list keeps collapse state trivially addressable by
 * id and avoids re-mounting whole subtrees when one node changes — with a depth
 * cap of 4 the ordering pass is cheap.
 */
function TopicsTab({ onOpenScript }: { onOpenScript: (scriptId: number) => void }) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeParent, setNewNodeParent] = useState<string>("root");
  const [manualIdeaTopic, setManualIdeaTopic] = useState("");
  const [buildPersonaId, setBuildPersonaId] = useState<string>("none");

  const utils = trpc.useUtils();
  const treeQuery = trpc.topicTree.listTopicTree.useQuery({ includeArchived: showArchived });
  const personasQuery = trpc.personas.list.useQuery();

  const nodeIdeasQuery = trpc.topicTree.listNodeIdeas.useQuery(
    { nodeId: selectedNodeId ?? 0, limit: 50 },
    { enabled: selectedNodeId !== null }
  );

  const invalidateTree = () => {
    void utils.topicTree.listTopicTree.invalidate();
    void utils.scriptFactory.listSuggestedIdeas.invalidate();
    if (selectedNodeId !== null) void utils.topicTree.listNodeIdeas.invalidate();
  };

  const buildMap = trpc.topicTree.buildTopicMap.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Topic map built — ${res.inserted} pillars from ${res.analogEntriesUsed} analog entries` +
          (res.skippedDuplicates > 0 ? ` (${res.skippedDuplicates} already existed)` : "")
      );
      invalidateTree();
    },
    onError: (err) => toast.error(err.message),
  });

  const expandNode = trpc.topicTree.expandTopicNode.useMutation({
    onSuccess: (res) => {
      toast.success(
        `${res.inserted} new subtopics` +
          (res.skippedDuplicates > 0 ? ` (${res.skippedDuplicates} duplicates skipped)` : "") +
          (res.researchUsed ? " · keyword research applied" : "")
      );
      // A newly expanded node must be open, or the operator sees nothing happen.
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(res.nodeId);
        return next;
      });
      invalidateTree();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateForNode = trpc.topicTree.generateIdeasForNode.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.inserted} ideas generated for this branch`);
      setSelectedNodeId(res.nodeId);
      invalidateTree();
    },
    onError: (err) => toast.error(err.message),
  });

  const createNode = trpc.topicTree.createManualNode.useMutation({
    onSuccess: () => {
      toast.success(`Added “${newNodeLabel.trim()}”`);
      setNewNodeLabel("");
      invalidateTree();
    },
    onError: (err) => toast.error(err.message),
  });

  const createIdea = trpc.topicTree.createManualIdea.useMutation({
    onSuccess: () => {
      toast.success("Idea added to this branch");
      setManualIdeaTopic("");
      invalidateTree();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateNode = trpc.topicTree.updateNode.useMutation({
    onSuccess: () => {
      toast.success("Topic updated");
      invalidateTree();
    },
    onError: (err) => toast.error(err.message),
  });

  const nodes = (treeQuery.data?.nodes ?? []) as unknown as TopicTreeNode[];

  // Rebuild depth-first order from the flat, depth-sorted array.
  const childrenOf = new Map<number | null, TopicTreeNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(n);
  }
  const ordered: TopicTreeNode[] = [];
  const walk = (parentId: number | null, hiddenByAncestor: boolean) => {
    for (const node of childrenOf.get(parentId) ?? []) {
      if (!hiddenByAncestor) ordered.push(node);
      walk(node.id, hiddenByAncestor || collapsed.has(node.id));
    }
  };
  walk(null, false);

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const isEmpty = !treeQuery.isLoading && nodes.length === 0;
  const busyNodeId =
    expandNode.isPending || generateForNode.isPending
      ? (expandNode.variables?.nodeId ?? generateForNode.variables?.nodeId ?? null)
      : null;

  return (
    <div className="space-y-6">
      {/* ── Header / build controls ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-indigo-500" />
            Topic Tree
            {nodes.length > 0 && (
              <Badge variant="secondary">
                {treeQuery.data?.rootCount ?? 0} pillars · {nodes.length} nodes
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A persistent map of your territory. Pillars come from your analog library, then you
            expand any branch and mine it for ideas. The weekly cron automatically works through
            whichever leaf has waited longest, so coverage widens without you tracking it.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Persona for the map (optional)
              </label>
              <Select value={buildPersonaId} onValueChange={setBuildPersonaId}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="No persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No persona</SelectItem>
                  {(personasQuery.data ?? []).map((p: { id: number; name: string }) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() =>
                buildMap.mutate({
                  personaId: buildPersonaId === "none" ? undefined : Number(buildPersonaId),
                })
              }
              disabled={buildMap.isPending}
            >
              {buildMap.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Building map…
                </>
              ) : (
                <>
                  <Network className="mr-2 h-4 w-4" />
                  {nodes.length > 0 ? "Rebuild / extend map" : "Build topic map"}
                </>
              )}
            </Button>

            <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>

            <Button
              variant="ghost"
              onClick={() => void treeQuery.refetch()}
              disabled={treeQuery.isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${treeQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Manual node entry — the operator always outranks the model. */}
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Add a topic</label>
              <Input
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                placeholder="e.g. Circadian light exposure"
                className="w-[280px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Under</label>
              <Select value={newNodeParent} onValueChange={setNewNodeParent}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Top level (new pillar)</SelectItem>
                  {nodes
                    .filter((n) => n.status === "active" && n.depth < 3)
                    .map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {"— ".repeat(n.depth)}
                        {n.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="secondary"
              disabled={newNodeLabel.trim().length < 2 || createNode.isPending}
              onClick={() =>
                createNode.mutate({
                  label: newNodeLabel.trim(),
                  parentId: newNodeParent === "root" ? undefined : Number(newNodeParent),
                })
              }
            >
              {createNode.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Add topic</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {isEmpty && (
        <Card>
          <CardContent className="py-10 text-center">
            <Network className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No topic map yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Build one from your analog library to get pillars and subtopics, or add a topic by
              hand above. Nothing is generated until you ask for it.
            </p>
          </CardContent>
        </Card>
      )}

      {treeQuery.isLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading topic tree…
        </div>
      )}

      {/* ── Tree + drill panel ──────────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Tree */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Map</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {ordered.map((node) => {
                const hasChildren = node.childCount > 0;
                const isCollapsed = collapsed.has(node.id);
                const isSelected = node.id === selectedNodeId;
                const isBusy = busyNodeId === node.id;
                const atDepthCap = node.depth >= 3;
                return (
                  <div
                    key={node.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isSelected ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-muted/50"
                    } ${node.status === "archived" ? "opacity-50" : ""}`}
                    style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={() => toggle(node.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    <button
                      onClick={() => setSelectedNodeId(node.id)}
                      className="min-w-0 flex-1 truncate text-left font-medium"
                      title={node.label}
                    >
                      {node.label}
                    </button>

                    {node.directIdeaCount > 0 && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {node.directIdeaCount}
                      </Badge>
                    )}
                    {node.subtreeIdeaCount > node.directIdeaCount && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Σ{node.subtreeIdeaCount}
                      </Badge>
                    )}
                    {node.vidiqData?.opportunityScore != null && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-emerald-300 text-xs text-emerald-700 dark:text-emerald-400"
                        title={`Search volume ${node.vidiqData.volume ?? "—"} · competition ${node.vidiqData.competition ?? "—"}`}
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        {node.vidiqData.opportunityScore}
                      </Badge>
                    )}
                    {!node.lastMinedAt && node.status === "active" && (
                      <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                        unmined
                      </Badge>
                    )}

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={atDepthCap || node.status === "archived"}
                            title={
                              atDepthCap
                                ? "Depth limit reached — mine this branch for ideas instead"
                                : "Break this into subtopics"
                            }
                            onClick={() => expandNode.mutate({ nodeId: node.id, count: 6 })}
                          >
                            <Network className="mr-1 h-3 w-3" />
                            Expand
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={node.status === "archived"}
                            title="Generate video ideas scoped to this branch"
                            onClick={() => generateForNode.mutate({ nodeId: node.id, count: 6 })}
                          >
                            <Lightbulb className="mr-1 h-3 w-3" />
                            Ideas
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Drill panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedNode ? selectedNode.label : "Select a topic"}
              </CardTitle>
              {nodeIdeasQuery.data?.breadcrumb && (
                <p className="text-xs text-muted-foreground">
                  {nodeIdeasQuery.data.breadcrumb}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedNode && (
                <p className="text-sm text-muted-foreground">
                  Click any topic to see its ideas, keyword data, and add your own.
                </p>
              )}

              {selectedNode && (
                <>
                  {selectedNode.description && (
                    <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
                  )}

                  {selectedNode.vidiqData?.keyword && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                      <p className="mb-1 font-medium">
                        Keyword: {selectedNode.vidiqData.keyword}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                        <span>Volume: {selectedNode.vidiqData.volume ?? "—"}</span>
                        <span>Comp: {selectedNode.vidiqData.competition ?? "—"}</span>
                        <span>Score: {selectedNode.vidiqData.opportunityScore ?? "—"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => generateForNode.mutate({ nodeId: selectedNode.id, count: 6 })}
                      disabled={generateForNode.isPending}
                    >
                      {generateForNode.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lightbulb className="mr-2 h-4 w-4" />
                      )}
                      Generate ideas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateNode.mutate({
                          nodeId: selectedNode.id,
                          status: selectedNode.status === "archived" ? "active" : "archived",
                        })
                      }
                      disabled={updateNode.isPending}
                    >
                      {selectedNode.status === "archived" ? "Restore" : "Archive"}
                    </Button>
                  </div>

                  {/* Manual idea entry scoped to this branch */}
                  <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Add your own idea to this branch
                    </label>
                    <Textarea
                      value={manualIdeaTopic}
                      onChange={(e) => setManualIdeaTopic(e.target.value)}
                      placeholder="Type the video idea in your own words…"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={manualIdeaTopic.trim().length < 3 || createIdea.isPending}
                      onClick={() =>
                        createIdea.mutate({
                          topic: manualIdeaTopic.trim(),
                          topicNodeId: selectedNode.id,
                        })
                      }
                    >
                      {createIdea.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Add idea"
                      )}
                    </Button>
                  </div>

                  {/* Ideas on this node */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ideas on this topic ({nodeIdeasQuery.data?.ideas.length ?? 0})
                    </p>
                    {nodeIdeasQuery.isLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    )}
                    {nodeIdeasQuery.data?.ideas.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No ideas yet. Generate some, or add your own above.
                      </p>
                    )}
                    {(nodeIdeasQuery.data?.ideas ?? []).map(
                      (idea: {
                        id: number;
                        topic: string;
                        status: string;
                        source: string;
                        audienceAlignment: number | null;
                        generatedScriptId: number | null;
                      }) => (
                        <div
                          key={idea.id}
                          className="rounded-md border p-2 text-sm transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1">{idea.topic}</span>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {idea.status}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {idea.audienceAlignment != null && (
                              <span>Fit {idea.audienceAlignment}/10</span>
                            )}
                            <span>·</span>
                            <span>{idea.source === "manual" ? "yours" : idea.source}</span>
                            {idea.generatedScriptId && (
                              <>
                                <span>·</span>
                                <button
                                  onClick={() => onOpenScript(idea.generatedScriptId!)}
                                  className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                  <FileText className="h-3 w-3" />
                                  Script #{idea.generatedScriptId}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
