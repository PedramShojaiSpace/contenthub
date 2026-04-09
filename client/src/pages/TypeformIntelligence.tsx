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
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Layers,
  Loader2,
  PieChart,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

interface AudienceAnalysis {
  painPoints: string[];
  aspirations: string[];
  demographics: {
    ageRange: string;
    gender: string;
    occupation: string;
    healthStatus: string;
  };
  topThemes: string[];
  personaInsights: string;
  summary: string;
  responseCount: number;
}

export default function TypeformIntelligence() {
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [selectedFormTitle, setSelectedFormTitle] = useState<string>("");
  const [analysis, setAnalysis] = useState<AudienceAnalysis | null>(null);
  const [showResponses, setShowResponses] = useState(false);
  const [enrichTargetPersonaId, setEnrichTargetPersonaId] = useState<string>("");
  const [enriched, setEnriched] = useState(false);
  const [segmentation, setSegmentation] = useState<any | null>(null);
  const [, navigate] = useLocation();

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: formsData, isLoading: formsLoading } = trpc.typeform.listForms.useQuery();
  const forms = formsData?.forms ?? [];

  const { data: responsesData, isLoading: responsesLoading } = trpc.typeform.getResponses.useQuery(
    { formId: selectedFormId, pageSize: 10 },
    { enabled: !!selectedFormId && showResponses }
  );

  const { data: personasData } = trpc.personas.list.useQuery();
  const personas = personasData ?? [];

  // ── Mutations ───────────────────────────────────────────────────────────────
  const analyzeMutation = trpc.typeform.analyzeAudience.useMutation({
    onSuccess: (data) => {
      setAnalysis(data as AudienceAnalysis);
      setEnriched(false);
      toast.success(`Analyzed ${data.responseCount} responses — audience intelligence ready!`);
    },
    onError: (err) => toast.error("Analysis failed: " + err.message),
  });

  const enrichMutation = trpc.typeform.enrichPersona.useMutation({
    onSuccess: (data) => {
      setEnriched(true);
      toast.success(
        `Persona enriched — ${data.mergedPainCount} pain points + ${data.mergedAspirationCount} aspirations merged.`
      );
    },
    onError: (err) => toast.error("Enrich failed: " + err.message),
  });

  const handleAnalyze = () => {
    if (!selectedFormId) { toast.error("Select a form first."); return; }
    setAnalysis(null);
    analyzeMutation.mutate({
      formId: selectedFormId,
      formTitle: selectedFormTitle,
      sampleSize: 100,
    });
  };

  const handleEnrich = () => {
    if (!enrichTargetPersonaId) { toast.error("Select a persona to enrich."); return; }
    if (!analysis) { toast.error("Run analysis first."); return; }
    enrichMutation.mutate({
      personaId: parseInt(enrichTargetPersonaId),
      painPoints: analysis.painPoints,
      aspirations: analysis.aspirations,
      personaInsights: analysis.personaInsights,
      formTitle: selectedFormTitle,
    });
  };

  const segmentMutation = trpc.typeform.segmentByPersona.useMutation({
    onSuccess: (data) => {
      setSegmentation(data);
      toast.success(
        `Segmented ${data.analyzedCount} responses across 8 personas — ${data.enrichedPersonas.length} persona profiles auto-enriched!`
      );
    },
    onError: (err) => toast.error("Segmentation failed: " + err.message),
  });

  const handleSegment = () => {
    if (!selectedFormId) { toast.error("Select a form first."); return; }
    setSegmentation(null);
    segmentMutation.mutate({
      formId: selectedFormId,
      formTitle: selectedFormTitle,
      sampleSize: 200,
    });
  };

  const handleGenerateLandingPage = (personaName: string, painPoints: string[], aspirations: string[], contentHooks: string[]) => {
    const params = new URLSearchParams({
      persona: personaName,
      offer: "academy",
      angle: contentHooks[0] ?? painPoints[0] ?? "",
      painPoints: painPoints.slice(0, 3).join(" | "),
      aspirations: aspirations.slice(0, 3).join(" | "),
      source: "typeform",
    });
    navigate(`/landing-pages?${params.toString()}`);
  };

  const handleFormSelect = (formId: string) => {
    const form = forms.find((f: { id: string; title: string }) => f.id === formId);
    setSelectedFormId(formId);
    setSelectedFormTitle(form?.title ?? formId);
    setAnalysis(null);
    setEnriched(false);
    setShowResponses(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Typeform Audience Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pull real survey data from your Typeform account, extract pain points and aspirations, and enrich persona profiles with ground-truth audience intelligence.
            </p>
          </div>
          <Badge variant="outline" className="border-green-500/40 text-green-400 shrink-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {forms.length} forms connected
          </Badge>
        </div>

        {/* Form Selector */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Step 1 — Select a Form
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {formsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />Loading forms from Typeform...
              </div>
            ) : (
              <>
                <Select value={selectedFormId} onValueChange={handleFormSelect}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Choose a Typeform survey to analyze..." />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((f: { id: string; title: string }) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Highlighted high-value forms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: "m6EyBDzz", title: "Gut Microbiome Assessment Survey", count: "2,416" },
                    { id: "ZUsSQWvF", title: "Gut Health - Initial Assessment", count: "1,177" },
                    { id: "ODvuQe7E", title: "Deep Sleep Solution - Initial Assessment", count: "13" },
                    { id: "lLd5Iy8i", title: "Urban Monk 5-Day Reset - Avatar Segmentation", count: "4" },
                  ].map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => handleFormSelect(rec.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                        selectedFormId === rec.id
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : "border-border bg-background/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      <p className="font-medium line-clamp-1">{rec.title}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{rec.count} responses</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Analyze Button */}
        {selectedFormId && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Step 2 — Analyze Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Analyzes up to 100 responses from <strong>{selectedFormTitle}</strong> using the LLM to extract pain points, aspirations, demographics, and recurring themes — all in Pedram's audience context.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {analyzeMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing responses (20–40 seconds)...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" />Analyze Audience Intelligence</>
                  )}
                </Button>
                <Button
                  onClick={handleSegment}
                  disabled={segmentMutation.isPending}
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  {segmentMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Segmenting (30–60s)...</>
                  ) : (
                    <><PieChart className="h-4 w-4 mr-2" />Segment by Persona</>  
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResponses((v) => !v)}
                  className="border-border text-muted-foreground"
                >
                  {showResponses ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  {showResponses ? "Hide" : "Preview"} Raw Responses
                </Button>
              </div>

              {/* Raw responses preview */}
              {showResponses && (
                <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                  {responsesLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />Loading responses...
                    </div>
                  ) : (responsesData?.responses ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No responses yet.</p>
                  ) : (
                    <>
                      {(responsesData?.responses ?? []).map((r: any, i: number) => (
                        <div key={r.responseId} className="p-2 rounded border border-border bg-background/30 text-xs">
                          <p className="text-[10px] text-muted-foreground mb-1">
                            Response {i + 1} · {new Date(r.submittedAt).toLocaleDateString()}
                          </p>
                          {Object.entries(r.answers).slice(0, 5).map(([q, a]) => (
                            <div key={q} className="mb-0.5">
                              <span className="text-muted-foreground">{q}: </span>
                              <span className="text-foreground">{String(a)}</span>
                            </div>
                          ))}
                          {Object.keys(r.answers).length > 5 && (
                            <p className="text-[10px] text-muted-foreground mt-1">+{Object.keys(r.answers).length - 5} more answers</p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis Results */}
        {analysis && (
          <>
            {/* Summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Audience Intelligence — {selectedFormTitle}
                  </CardTitle>
                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                    {analysis.responseCount} responses analyzed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed">{analysis.summary}</p>
              </CardContent>
            </Card>

            {/* Pain Points + Aspirations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-red-500/20 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Pain Points ({analysis.painPoints.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {analysis.painPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                        <span className="text-red-400 shrink-0 mt-0.5">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-green-500/20 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aspirations ({analysis.aspirations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {analysis.aspirations.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                        <span className="text-green-400 shrink-0 mt-0.5">•</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Demographics + Top Themes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Demographics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {Object.entries(analysis.demographics).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground capitalize shrink-0 w-24">
                          {k.replace(/([A-Z])/g, " $1").trim()}:
                        </span>
                        <span className="text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5" />
                    Top Themes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.topThemes.map((t, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] border-primary/30 text-primary/80">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Persona Insights */}
            <Card className="border-amber-500/20 bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" />
                  Persona Narrative
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {analysis.personaInsights}
                </p>
              </CardContent>
            </Card>

            {/* Enrich Persona */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Step 3 — Enrich a Persona Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Merge these pain points, aspirations, and narrative insights into an existing persona profile. Existing data is preserved — new insights are appended.
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  <Select value={enrichTargetPersonaId} onValueChange={setEnrichTargetPersonaId}>
                    <SelectTrigger className="w-64 bg-background/50">
                      <SelectValue placeholder="Select persona to enrich..." />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleEnrich}
                    disabled={enrichMutation.isPending || enriched || !enrichTargetPersonaId}
                    className={enriched ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                  >
                    {enrichMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enriching...</>
                    ) : enriched ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" />Persona Enriched!</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" />Enrich Persona</>
                    )}
                  </Button>
                </div>
                {enriched && (
                  <p className="text-xs text-green-400">
                    Persona updated — open the Strategy Brain to see the enriched profile and use it in content generation.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Persona Segmentation Results */}
        {segmentation && (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-primary" />
                    Persona Segmentation — {selectedFormTitle}
                  </CardTitle>
                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                    {segmentation.analyzedCount} responses · {segmentation.enrichedPersonas.length} personas auto-enriched
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{segmentation.overallInsight}</p>
              </CardHeader>
            </Card>

            {/* Persona segment cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(segmentation.segments ?? []).map((seg: any) => (
                <Card key={seg.personaId} className={`border-border bg-card ${seg.percentMatch >= 20 ? 'border-primary/30' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        {seg.personaName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            seg.percentMatch >= 20
                              ? 'border-primary/50 text-primary'
                              : seg.percentMatch >= 10
                              ? 'border-amber-500/50 text-amber-400'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {seg.percentMatch}% match
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Voice of Customer */}
                    <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                      "{seg.voiceOfCustomer}"
                    </blockquote>

                    {/* Top pain points */}
                    <div>
                      <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">Pain Points</p>
                      <ul className="space-y-0.5">
                        {seg.painPoints.slice(0, 3).map((p: string, i: number) => (
                          <li key={i} className="text-[11px] text-foreground/80 flex items-start gap-1">
                            <span className="text-red-400 shrink-0">•</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Content hooks */}
                    <div>
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Content Hooks</p>
                      <div className="flex flex-wrap gap-1">
                        {seg.contentHooks.map((h: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px] border-amber-500/30 text-amber-400/80">{h}</Badge>
                        ))}
                      </div>
                    </div>

                    {/* Generate Landing Page button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[11px] border-primary/30 text-primary hover:bg-primary/10 mt-1"
                      onClick={() => handleGenerateLandingPage(seg.personaName, seg.painPoints, seg.aspirations, seg.contentHooks)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Generate Landing Page for this Persona
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
