import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  MessageSquareQuote,
  Target,
  Lightbulb,
  HelpCircle,
  Languages,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type SurveyType = "pre_registration" | "post_webinar";

interface IntelligenceRecord {
  id: number;
  webinarSessionId: number;
  surveyType: SurveyType;
  rawResponses: string | null;
  responseCount: number | null;
  extractedThemes: string | null;
  extractedPainPoints: string | null;
  extractedMotivations: string | null;
  extractedQuestions: string | null;
  extractedLanguage: string | null;
  aiSummary: string | null;
  importedAt: Date;
  extractedAt: Date | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJsonArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function SurveyTypeBadge({ type }: { type: SurveyType }) {
  return type === "pre_registration" ? (
    <Badge variant="outline" className="text-blue-400 border-blue-400/40 bg-blue-400/10 text-xs">
      Pre-Registration
    </Badge>
  ) : (
    <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 bg-emerald-400/10 text-xs">
      Post-Webinar
    </Badge>
  );
}

// ─── Intelligence Card ────────────────────────────────────────────────────────
function IntelligenceCard({
  record,
  onExtract,
  onDelete,
  extracting,
}: {
  record: IntelligenceRecord;
  onExtract: (id: number) => void;
  onDelete: (id: number) => void;
  extracting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const themes = parseJsonArray(record.extractedThemes);
  const painPoints = parseJsonArray(record.extractedPainPoints);
  const motivations = parseJsonArray(record.extractedMotivations);
  const questions = parseJsonArray(record.extractedQuestions);
  const language = parseJsonArray(record.extractedLanguage);
  const hasExtracted = !!record.extractedAt;

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SurveyTypeBadge type={record.surveyType} />
            <span className="text-sm text-muted-foreground">
              {record.responseCount ?? 0} responses
            </span>
            <span className="text-xs text-muted-foreground">
              Imported {new Date(record.importedAt).toLocaleDateString()}
            </span>
            {hasExtracted && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> AI Extracted
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!hasExtracted && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                onClick={() => onExtract(record.id)}
                disabled={extracting}
              >
                <Sparkles className="w-3 h-3" />
                {extracting ? "Extracting…" : "Extract Intelligence"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(record.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        {record.notes && (
          <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
        )}
      </CardHeader>

      {hasExtracted && (
        <CardContent className="pt-0 space-y-4">
          {/* AI Summary */}
          {record.aiSummary && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
              <p className="text-sm text-foreground/80 leading-relaxed">{record.aiSummary}</p>
            </div>
          )}

          {/* Themes */}
          {themes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Themes</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {themes.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-violet-500/10 text-violet-300 border-violet-500/20">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Expand toggle */}
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Show less" : "Show pain points, motivations, questions & language"}
          </button>

          {expanded && (
            <div className="space-y-4 pt-1">
              {/* Pain Points */}
              {painPoints.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pain Points</span>
                  </div>
                  <ul className="space-y-1">
                    {painPoints.map((p, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex gap-2">
                        <span className="text-red-400 shrink-0">•</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Motivations */}
              {motivations.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why They Showed Up</span>
                  </div>
                  <ul className="space-y-1">
                    {motivations.map((m, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex gap-2">
                        <span className="text-amber-400 shrink-0">•</span>{m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions */}
              {questions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience Questions</span>
                  </div>
                  <ul className="space-y-1">
                    {questions.map((q, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex gap-2">
                        <span className="text-blue-400 shrink-0">•</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Exact Language */}
              {language.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exact Audience Language</span>
                    <span className="text-xs text-muted-foreground">(mirror in copy)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {language.map((l, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono"
                      >
                        "{l}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Import Form ──────────────────────────────────────────────────────────────
function ImportForm({
  webinarSessionId,
  onSuccess,
}: {
  webinarSessionId: number;
  onSuccess: () => void;
}) {
  const [surveyType, setSurveyType] = useState<SurveyType>("pre_registration");
  const [rawResponses, setRawResponses] = useState("");
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();

  const importMutation = trpc.webinarIntelligence.importResponses.useMutation({
    onSuccess: () => {
      utils.webinarIntelligence.listBySession.invalidate({ webinarSessionId });
      setRawResponses("");
      setNotes("");
      toast.success("Survey responses imported — click 'Extract Intelligence' to run AI analysis");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="bg-card/40 border-dashed border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Import Survey Responses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Survey Type</label>
            <Select value={surveyType} onValueChange={(v) => setSurveyType(v as SurveyType)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_registration">Pre-Registration Form</SelectItem>
                <SelectItem value="post_webinar">Post-Webinar Survey</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
            <input
              className="w-full h-8 text-sm px-3 rounded-md border border-input bg-background"
              placeholder="e.g. April 17 webinar"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Paste Typeform Export (JSON or plain text responses)
          </label>
          <Textarea
            className="text-sm font-mono min-h-[140px] resize-y"
            placeholder={`Paste your Typeform export here. Accepts:\n• JSON export from Typeform\n• CSV text\n• Plain text responses (one per line)\n\nExample:\n"I've been exhausted for years and nothing helps"\n"My gut issues are affecting my work performance"\n"I want to understand the root cause, not just manage symptoms"`}
            value={rawResponses}
            onChange={(e) => setRawResponses(e.target.value)}
          />
        </div>

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() =>
            importMutation.mutate({ webinarSessionId, surveyType, rawResponses, notes: notes || undefined })
          }
          disabled={importMutation.isPending || !rawResponses.trim()}
        >
          <Upload className="w-4 h-4" />
          {importMutation.isPending ? "Importing…" : "Import Responses"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WebinarIntelligencePage() {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showImportForm, setShowImportForm] = useState(false);
  const utils = trpc.useUtils();

  // Load all webinar sessions for the selector
  const { data: sessions = [], isLoading: sessionsLoading } = trpc.webinar.list.useQuery();

  // Load intelligence records for selected session
  const { data: records = [], isLoading: recordsLoading } = trpc.webinarIntelligence.listBySession.useQuery(
    { webinarSessionId: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const extractMutation = trpc.webinarIntelligence.extractIntelligence.useMutation({
    onSuccess: (data) => {
      utils.webinarIntelligence.listBySession.invalidate({ webinarSessionId: selectedSessionId! });
      toast.success("Intelligence extracted successfully");
    },
    onError: (err) => toast.error(`Extraction failed: ${err.message}`),
  });

  const deleteMutation = trpc.webinarIntelligence.delete.useMutation({
    onSuccess: () => {
      utils.webinarIntelligence.listBySession.invalidate({ webinarSessionId: selectedSessionId! });
      toast.success("Record deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedSession = sessions.find((s: { id: number }) => s.id === selectedSessionId);

  // Aggregate stats
  const totalResponses = records.reduce((sum, r) => sum + (r.responseCount ?? 0), 0);
  const extractedCount = records.filter((r) => r.extractedAt).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              Webinar Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Import attendee survey data to understand what drives your audience — automatically enriches all content generation.
            </p>
          </div>
        </div>

        {/* Session Selector */}
        <Card className="bg-card/60 border-border/50">
          <CardContent className="pt-4">
            <label className="text-sm font-medium mb-2 block">Select Webinar Session</label>
            {sessionsLoading ? (
              <div className="h-9 bg-muted/30 rounded animate-pulse" />
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No webinar sessions found. Create one in the Webinar Builder first.
              </p>
            ) : (
              <Select
                value={selectedSessionId?.toString() ?? ""}
                onValueChange={(v) => {
                  setSelectedSessionId(Number(v));
                  setShowImportForm(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a webinar session…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s: { id: number; topic: string; webinarDate?: string | null }) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.topic}
                      {s.webinarDate ? ` — ${s.webinarDate}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Session Intelligence Panel */}
        {selectedSessionId !== null && (
          <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {records.length} import{records.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {totalResponses} total responses
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {extractedCount} extracted
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setShowImportForm(!showImportForm)}
              >
                <Upload className="w-4 h-4" />
                {showImportForm ? "Cancel" : "Import Responses"}
              </Button>
            </div>

            {/* Import Form */}
            {showImportForm && (
              <ImportForm
                webinarSessionId={selectedSessionId}
                onSuccess={() => setShowImportForm(false)}
              />
            )}

            {/* Intelligence Records */}
            {recordsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 bg-muted/20 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <Card className="bg-card/30 border-dashed border-border/40">
                <CardContent className="py-12 text-center">
                  <Brain className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No survey data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Import pre-registration or post-webinar responses to start building audience intelligence.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => setShowImportForm(true)}
                  >
                    <Upload className="w-4 h-4" />
                    Import First Batch
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <IntelligenceCard
                    key={record.id}
                    record={record as IntelligenceRecord}
                    onExtract={(id) => extractMutation.mutate({ id })}
                    onDelete={(id) => deleteMutation.mutate({ id })}
                    extracting={extractMutation.isPending && extractMutation.variables?.id === record.id}
                  />
                ))}
              </div>
            )}

            {/* Content Generation Note */}
            {extractedCount > 0 && (
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-emerald-300">
                      <span className="font-semibold">Active in content generation.</span>{" "}
                      The extracted pain points, motivations, and audience language from this session are automatically injected into all AI-generated social posts, blog articles, scripts, and webinar copy — making every piece of content more resonant with your actual audience.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
