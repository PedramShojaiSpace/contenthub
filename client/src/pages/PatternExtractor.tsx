/**
 * Pattern Extractor — Phase D
 *
 * UI for mining and browsing content patterns from the corpus.
 * Tabs: Overview (stats + type breakdown), Mine (extract from corpus), Browse (filter + search patterns)
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "../components/DashboardLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const PATTERN_TYPES = [
  "hook", "pain_point", "proof_element", "objection_handler",
  "cta", "story_structure", "key_phrase", "transformation_arc",
  "authority_signal", "social_proof", "open_loop", "other",
] as const;

const TYPE_LABELS: Record<string, string> = {
  hook: "Hook",
  pain_point: "Pain Point",
  proof_element: "Proof Element",
  objection_handler: "Objection Handler",
  cta: "CTA",
  story_structure: "Story Structure",
  key_phrase: "Key Phrase",
  transformation_arc: "Transformation Arc",
  authority_signal: "Authority Signal",
  social_proof: "Social Proof",
  open_loop: "Open Loop",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  hook: "bg-amber-100 text-amber-800 border-amber-200",
  pain_point: "bg-red-100 text-red-800 border-red-200",
  proof_element: "bg-green-100 text-green-800 border-green-200",
  objection_handler: "bg-blue-100 text-blue-800 border-blue-200",
  cta: "bg-purple-100 text-purple-800 border-purple-200",
  story_structure: "bg-indigo-100 text-indigo-800 border-indigo-200",
  key_phrase: "bg-yellow-100 text-yellow-800 border-yellow-200",
  transformation_arc: "bg-teal-100 text-teal-800 border-teal-200",
  authority_signal: "bg-orange-100 text-orange-800 border-orange-200",
  social_proof: "bg-pink-100 text-pink-800 border-pink-200",
  open_loop: "bg-cyan-100 text-cyan-800 border-cyan-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: stats, isLoading, refetch } = trpc.patterns.getStats.useQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const total = stats?.total ?? 0;
  const byType = stats?.byType ?? {};

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{total}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Patterns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{Object.keys(byType).length}</div>
            <div className="text-sm text-muted-foreground mt-1">Pattern Types</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">
              {Object.values(byType).reduce((s, v) => s + (v as any).totalUsage, 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Total Uses in Scripts</div>
          </CardContent>
        </Card>
      </div>

      {/* Type breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Pattern Type Breakdown</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No patterns extracted yet.</p>
              <p className="text-xs mt-1">Go to the Mine tab to extract patterns from your corpus.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {PATTERN_TYPES.map((type) => {
                const data = (byType as any)[type];
                if (!data) return null;
                const pct = total > 0 ? Math.round((data.count / total) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-32 shrink-0">
                      <Badge className={`text-xs ${TYPE_COLORS[type]}`}>{TYPE_LABELS[type]}</Badge>
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm text-muted-foreground">
                      {data.count} ({pct}%)
                    </div>
                    <div className="w-20 text-right text-xs text-muted-foreground">
                      avg {(data.avgEffectiveness * 100).toFixed(0)}% eff.
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Mine Tab ─────────────────────────────────────────────────────────────────

function MineTab() {
  const [limit, setLimit] = useState(10);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<{ processed: number; totalExtracted: number; errors: string[] } | null>(null);
  const utils = trpc.useUtils();

  const extractAll = trpc.patterns.extractAll.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Extracted ${data.totalExtracted} patterns from ${data.processed} corpus entries.`);
      // Invalidate both stats and pattern list so Overview and Browse tabs refresh
      utils.patterns.getStats.invalidate();
      utils.patterns.listPatterns.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Batch Pattern Extraction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>How it works:</strong> The LLM reads each corpus entry and extracts up to 20 persuasion
            patterns per piece. Effectiveness scores are inherited from the source video's outlier score
            (or 0.80 for analog data). Each LLM call costs ~$0.01–0.03.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Entries to process: <span className="text-primary font-bold">{limit}</span></label>
            <Slider
              min={1} max={50} step={1}
              value={[limit]}
              onValueChange={([v]) => setLimit(v)}
            />
            <p className="text-xs text-muted-foreground">Estimated cost: ~${(limit * 0.02).toFixed(2)}</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="overwrite-patterns"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="overwrite-patterns" className="text-sm text-muted-foreground">
              Overwrite existing patterns (re-extract all)
            </label>
          </div>

          <Button
            onClick={() => extractAll.mutate({ limit, overwrite })}
            disabled={extractAll.isPending}
            className="w-full"
          >
            {extractAll.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting patterns…</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Extract Patterns from Corpus</>
            )}
          </Button>

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 space-y-1">
              <p><strong>Done!</strong> Processed {result.processed} entries, extracted {result.totalExtracted} patterns.</p>
              {result.errors.length > 0 && (
                <p className="text-red-600">{result.errors.length} errors: {result.errors[0]}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Browse Tab ───────────────────────────────────────────────────────────────

function PatternCard({ pattern, onDelete }: {
  pattern: {
    id: number;
    patternType: string;
    patternText: string;
    patternContext: string | null;
    effectivenessScore: number | null;
    usageCount: number;
    sourceVideoId: string | null;
  };
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const eff = pattern.effectivenessScore ?? 0;

  return (
    <div className="border rounded-lg p-4 bg-card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-xs ${TYPE_COLORS[pattern.patternType] ?? TYPE_COLORS.other}`}>
            {TYPE_LABELS[pattern.patternType] ?? pattern.patternType}
          </Badge>
          {pattern.sourceVideoId && (
            <span className="text-xs text-muted-foreground">YT: {pattern.sourceVideoId.slice(0, 11)}</span>
          )}
          <span className="text-xs text-muted-foreground">Used {pattern.usageCount}×</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1">
                <div className="w-16 bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${eff * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{(eff * 100).toFixed(0)}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Effectiveness score</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(pattern.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium leading-snug">{pattern.patternText}</p>

      {pattern.patternContext && (
        <div>
          <button
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide context" : "Show context"}
          </button>
          {expanded && (
            <p className="text-xs text-muted-foreground mt-1 italic">{pattern.patternContext}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BrowseTab() {
  const [patternType, setPatternType] = useState("all");
  const [sortBy, setSortBy] = useState<"effectiveness" | "usage" | "created">("effectiveness");
  const [minEffectiveness, setMinEffectiveness] = useState(0);

  const { data: patterns = [], isLoading, refetch } = trpc.patterns.listPatterns.useQuery({
    patternType,
    sortBy,
    minEffectiveness,
    limit: 100,
    offset: 0,
  });

  const utils = trpc.useUtils();
  const deletePattern = trpc.patterns.deletePattern.useMutation({
    onSuccess: () => {
      refetch();
      // Also refresh Overview stats so counts stay accurate after deletion
      utils.patterns.getStats.invalidate();
      toast.success("Pattern deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={patternType} onValueChange={setPatternType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PATTERN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="effectiveness">By Effectiveness</SelectItem>
            <SelectItem value="usage">By Usage</SelectItem>
            <SelectItem value="created">By Date</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Min eff:</span>
          <div className="w-28">
            <Slider
              min={0} max={1} step={0.05}
              value={[minEffectiveness]}
              onValueChange={([v]) => setMinEffectiveness(v)}
            />
          </div>
          <span className="text-xs text-muted-foreground">{(minEffectiveness * 100).toFixed(0)}%</span>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">{patterns.length} patterns</span>
      </div>

      {/* Pattern list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No patterns found. Try adjusting filters or extract patterns first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {patterns.map((p) => (
            <PatternCard
              key={p.id}
              pattern={p}
              onDelete={(id) => deletePattern.mutate({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatternExtractor() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pattern Extractor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mine persuasion patterns from outlier transcripts and analog data using LLM analysis.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="mine">
              <Sparkles className="w-4 h-4 mr-1.5" /> Mine
            </TabsTrigger>
            <TabsTrigger value="browse">
              <Brain className="w-4 h-4 mr-1.5" /> Browse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MineTab />
          </TabsContent>
          <TabsContent value="browse" className="mt-4">
            <BrowseTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
