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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
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
  onSelectIdea: (topic: string, format: string, patterns: string[]) => void;
}

function VideoIdeaEngine({ onSelectIdea }: VideoIdeaEngineProps) {
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [superchargedIdeas, setSuperchargedIdeas] = useState<SuperchargedIdea[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [isSupercharged, setIsSupercharged] = useState(false);

  const suggestIdeas = trpc.scriptFactory.suggestIdeas.useMutation({
    onSuccess: (data) => {
      setIdeas(data.ideas);
      setSuperchargedIdeas([]);
      setIsSupercharged(false);
      setExpandedIdx(null);
      if (data.ideas.length === 0) {
        toast.info("No ideas generated. Add analog data in Analyze → Library first for best results.");
      } else {
        toast.success(`${data.ideas.length} ideas generated from ${data.analogDataCount} analog entries.`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const supercharge = trpc.scriptFactory.superchargeIdeas.useMutation({
    onSuccess: (data) => {
      setSuperchargedIdeas(data.ideas);
      setIsSupercharged(true);
      toast.success("Ideas supercharged with VidIQ keyword data!");
    },
    onError: (err) => toast.error(`VidIQ supercharge failed: ${err.message}`),
  });

  const displayIdeas: (VideoIdea | SuperchargedIdea)[] = isSupercharged ? superchargedIdeas : ideas;

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

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Video Idea Engine
            <span className="text-xs font-normal text-muted-foreground">
              — Analog data Northstar + gap analysis
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {ideas.length > 0 && !supercharge.isPending && (
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                onClick={() => supercharge.mutate({ ideas })}
                disabled={supercharge.isPending}
              >
                {supercharge.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Supercharging…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 mr-1.5 text-yellow-500" /> Supercharge with VidIQ</>
                )}
              </Button>
            )}
            {supercharge.isPending && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Fetching VidIQ data for {ideas.length} ideas…
              </div>
            )}
            <Button
              size="sm"
              onClick={() => suggestIdeas.mutate({ count: 6 })}
              disabled={suggestIdeas.isPending}
            >
              {suggestIdeas.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Ideas</>
              )}
            </Button>
          </div>
        </div>
        {isSupercharged && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-1">
            <Zap className="w-3 h-3 text-yellow-500" />
            Supercharged with VidIQ — search metrics shown below each idea
          </div>
        )}
      </CardHeader>

      <CardContent>
        {suggestIdeas.isPending && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">Analyzing analog data and published videos…</p>
          </div>
        )}

        {!suggestIdeas.isPending && displayIdeas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2 border-2 border-dashed rounded-lg">
            <Lightbulb className="w-8 h-8 opacity-30" />
            <p className="text-sm text-center">
              Click <strong>Generate Ideas</strong> to get topic suggestions grounded in your analog data.<br />
              <span className="text-xs">Add content in Analyze → Library first for best results.</span>
            </p>
          </div>
        )}

        {!suggestIdeas.isPending && displayIdeas.length > 0 && (
          <div className="space-y-2">
            {displayIdeas.map((idea, idx) => {
              const isExpanded = expandedIdx === idx;
              const sc = isSupercharged ? (idea as SuperchargedIdea).vidiq : null;

              return (
                <div
                  key={idx}
                  className="border rounded-lg bg-background overflow-hidden"
                >
                  {/* Collapsed header */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
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
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getAlignmentColor(idea.audienceAlignment)}`}>
                          <Target className="w-2.5 h-2.5 inline mr-0.5" />
                          {idea.audienceAlignment}% aligned
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {FORMAT_LABELS[idea.recommendedFormat] ?? idea.recommendedFormat}
                        </span>
                        {sc && sc.opportunityScore > 0 && (
                          <span className={`text-xs font-medium ${getOpportunityColor(sc.opportunityScore)}`}>
                            <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />
                            {sc.opportunityScore} opp
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 text-xs h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIdea(idea.topic, idea.recommendedFormat, idea.recommendedPatterns);
                        toast.success("Idea loaded into Script Brief below!");
                      }}
                    >
                      Use This Idea
                    </Button>
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

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Recommended Pattern Types</p>
                        <div className="flex flex-wrap gap-1">
                          {idea.recommendedPatterns.map((p) => (
                            <span key={p} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {p.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Analog source:</span> {idea.analogDataSource}
                      </div>

                      {/* VidIQ metrics (supercharged only) */}
                      {sc && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> VidIQ Keyword Data: "{sc.keyword}"
                          </p>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="text-center bg-background rounded border p-2">
                              <p className="text-lg font-bold text-primary">{formatVolume(sc.volume)}</p>
                              <p className="text-xs text-muted-foreground">Search Volume</p>
                            </div>
                            <div className="text-center bg-background rounded border p-2">
                              <p className={`text-lg font-bold ${getOpportunityColor(sc.opportunityScore)}`}>{sc.opportunityScore}</p>
                              <p className="text-xs text-muted-foreground">Opportunity</p>
                            </div>
                            <div className="text-center bg-background rounded border p-2">
                              <p className="text-lg font-bold text-foreground">{sc.competition}</p>
                              <p className="text-xs text-muted-foreground">Competition</p>
                            </div>
                          </div>
                          {sc.estimatedMonthlySearch > 0 && (
                            <p className="text-xs text-muted-foreground mb-2">
                              ~{formatVolume(sc.estimatedMonthlySearch)} estimated monthly searches
                            </p>
                          )}
                          {sc.topRelatedKeywords.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Top Related Keywords</p>
                              <div className="flex flex-wrap gap-1">
                                {sc.topRelatedKeywords.slice(0, 5).map((k) => (
                                  <span
                                    key={k.keyword}
                                    className="text-xs px-2 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 cursor-pointer hover:bg-yellow-100"
                                    title={`Opportunity: ${k.overall} | Volume: ${formatVolume(k.volume)}`}
                                    onClick={() => onSelectIdea(k.keyword, idea.recommendedFormat, idea.recommendedPatterns)}
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

                      {isSupercharged && !sc && (
                        <div className="border-t pt-2">
                          <p className="text-xs text-muted-foreground italic">VidIQ data unavailable for this keyword.</p>
                        </div>
                      )}

                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          onSelectIdea(idea.topic, idea.recommendedFormat, idea.recommendedPatterns);
                          toast.success("Idea loaded into Script Brief below!");
                        }}
                      >
                        <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Use This Idea → Generate Script
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
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
  const [result, setResult] = useState<{
    id: number; title: string; scriptBody: string;
    verifiedCount: number; totalElements: number; verificationPct: number;
    patternsUsed: number; corpusEntriesUsed: number; externalTranscriptsUsed?: number;
  } | null>(null);

  const generate = trpc.scriptFactory.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      const transcriptNote = (data.externalTranscriptsUsed ?? 0) > 0
        ? ` · ${data.externalTranscriptsUsed} YouTube transcripts fetched`
        : "";
      toast.success(`Script generated! ${data.verificationPct}% verified${transcriptNote}.`);
      utils.scriptFactory.list.invalidate();
      utils.scriptFactory.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.scriptBody);
    toast.success("Script copied to clipboard.");
  };

  // Called when user clicks "Use This Idea" in VideoIdeaEngine
  const handleSelectIdea = (ideaTopic: string, ideaFormat: string, ideaPatterns: string[]) => {
    setTopic(ideaTopic);
    setFormat(ideaFormat);
    setSelectedTypes(ideaPatterns.length > 0 ? ideaPatterns : selectedTypes);
    // Scroll to the Script Brief card
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

              <div className="flex gap-2">
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
