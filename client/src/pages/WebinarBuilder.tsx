/**
 * Webinar Funnel Builder
 *
 * 4-step wizard:
 *   Step 1 — Setup: topic, CTA, Zoom link, personas, target length
 *   Step 2 — Outline: AI-generated webinar outline + hook script
 *   Step 3 — Landing Page: AI copy + Gamma publish
 *   Step 4 — Thank You + Kajabi: Wistia video, Typeform, Kajabi automation export
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Video,
  Globe,
  Users,
  FileText,
  Zap,
  Play,
  ClipboardList,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

type WebinarSession = {
  id: number;
  topic: string;
  cta: string | null;
  personaIds: string | null;
  targetLengthMinutes: number | null;
  registrationUrl: string | null;
  outline: string | null;
  hookScript: string | null;
  landingPageCopy: string | null;
  gammaUrl: string | null;
  gammaGenerationId: string | null;
  thankYouWistiaId: string | null;
  thankYouTypeformUrl: string | null;
  thankYouPageCopy: string | null;
  kajabiExport: string | null;
  status: "draft" | "ready" | "live" | "completed";
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Setup", icon: Video },
  { id: 2, label: "Outline", icon: FileText },
  { id: 3, label: "Landing Page", icon: Globe },
  { id: 4, label: "Thank You + Kajabi", icon: Zap },
];

function StepIndicator({ current, completed }: { current: Step; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const isActive = step.id === current;
        const isDone = completed.has(step.id);
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {isDone && !isActive ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.id}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-6 mx-1 ${isDone ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Webinar list sidebar ─────────────────────────────────────────────────────

function WebinarList({
  sessions,
  activeId,
  onSelect,
  onNew,
}: {
  sessions: WebinarSession[];
  activeId: number | null;
  onSelect: (s: WebinarSession) => void;
  onNew: () => void;
}) {
  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    ready: "bg-amber-500/10 text-amber-600",
    live: "bg-green-500/10 text-green-600",
    completed: "bg-primary/10 text-primary",
  };
  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" className="w-full" onClick={onNew}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        New Webinar
      </Button>
      {sessions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No webinars yet</p>
      )}
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`text-left rounded-lg p-3 border transition-all hover:bg-accent/50 ${
            activeId === s.id ? "border-primary/40 bg-primary/5" : "border-border/50"
          }`}
        >
          <p className="text-sm font-medium line-clamp-2 text-foreground">{s.topic}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColors[s.status]}`}>
              {s.status}
            </span>
            {s.outline && <span className="text-[10px] text-muted-foreground">Outline ✓</span>}
            {s.landingPageCopy && <span className="text-[10px] text-muted-foreground">LP ✓</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WebinarBuilder() {
  const [step, setStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [activeWebinarId, setActiveWebinarId] = useState<number | null>(null);

  // Step 1 state
  const [topic, setTopic] = useState("Upstream Health: How to Find and Fix Your Root Cause");
  const [cta, setCta] = useState("Get the Upstream Bundle — $399 (test kit + course)");
  const [registrationUrl, setRegistrationUrl] = useState(
    "https://us02web.zoom.us/webinar/register/WN_qpfJBJ2uSCWpA8C-b1Kxzg"
  );
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<number[]>([]);
  const [targetLength, setTargetLength] = useState(60);

  // Step 2 state
  const [outline, setOutline] = useState("");
  const [hookScript, setHookScript] = useState("");
  const [showHook, setShowHook] = useState(false);

  // Step 3 state
  const [landingPageCopy, setLandingPageCopy] = useState("");
  const [editingLandingCopy, setEditingLandingCopy] = useState(false);
  const [gammaGenerationId, setGammaGenerationId] = useState("");
  const [gammaUrl, setGammaUrl] = useState("");
  const [gammaPolling, setGammaPolling] = useState(false);

  // Gamma polling refs
  const utils = trpc.useUtils();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  // Step 4 state
  const [wistiaId, setWistiaId] = useState("");
  const [typeformUrl, setTypeformUrl] = useState("");
  const [thankYouCopy, setThankYouCopy] = useState("");
  const [kajabiPlan, setKajabiPlan] = useState<any>(null);
  const [showKajabiRaw, setShowKajabiRaw] = useState(false);

  // Typeform survey state
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [pushedTypeformUrl, setPushedTypeformUrl] = useState("");

  // Thank You Gamma state
  const [thankYouGammaUrl, setThankYouGammaUrl] = useState("");
  const [thankYouGammaGenerationId, setThankYouGammaGenerationId] = useState("");
  const [thankYouGammaPolling, setThankYouGammaPolling] = useState(false);
  const thankYouPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thankYouPollAttemptsRef = useRef(0);

  // Queries
  const { data: sessions = [], refetch: refetchSessions } = trpc.webinar.list.useQuery();
  const { data: personas = [] } = trpc.personas.list.useQuery();

  // Mutations
  const createMutation = trpc.webinar.create.useMutation({
    onSuccess: (data) => {
      setActiveWebinarId(data.id);
      markStepComplete(1);
      setStep(2);
      refetchSessions();
      toast.success("Webinar created! Click \"Generate Outline\" to build your AI outline.");
    },
    onError: (err) => toast.error("Failed to create: " + err.message),
  });

  const generateOutlineMutation = trpc.webinar.generateOutline.useMutation({
    onSuccess: (data) => {
      setOutline(data.outline);
      setHookScript(data.hookScript);
      markStepComplete(2);
      toast.success("Outline generated!");
    },
    onError: (err) => toast.error("Outline generation failed: " + err.message),
  });

  const generateLandingCopyMutation = trpc.webinar.generateLandingCopy.useMutation({
    onSuccess: (data) => {
      setLandingPageCopy(data.landingPageCopy);
      markStepComplete(3);
      toast.success("Landing page copy generated!");
    },
    onError: (err) => toast.error("Landing copy failed: " + err.message),
  });

  const publishToGammaMutation = trpc.webinar.publishToGamma.useMutation({
    onSuccess: (data) => {
      setGammaGenerationId(data.generationId);
      setGammaPolling(true);
      pollAttemptsRef.current = 0;
      toast.success("Sent to Gamma — generating your landing page...");
    },
    onError: (err) => toast.error("Gamma publish failed: " + err.message),
  });

  // ─── Gamma polling via useEffect + setInterval (correct pattern) ────────────
  useEffect(() => {
    if (!gammaPolling || !gammaGenerationId || activeWebinarId === null) return;
    const MAX_ATTEMPTS = 40; // 40 × 5s = 200s max
    pollIntervalRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(pollIntervalRef.current!);
        setGammaPolling(false);
        toast.error("Gamma generation timed out. Check your Gamma dashboard.");
        return;
      }
      try {
        const result = await utils.webinar.pollGamma.fetch({
          id: activeWebinarId,
          generationId: gammaGenerationId,
        });
        if (result.status === "completed" && result.gammaUrl) {
          clearInterval(pollIntervalRef.current!);
          setGammaUrl(result.gammaUrl);
          setGammaPolling(false);
          toast.success("🎉 Landing page published to Gamma!");
        } else if (result.status === "failed") {
          clearInterval(pollIntervalRef.current!);
          setGammaPolling(false);
          toast.error("Gamma generation failed. Try again.");
        }
        // else still pending — keep polling
      } catch {
        // Network hiccup — keep polling
      }
    }, 5000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [gammaPolling, gammaGenerationId, activeWebinarId]);

  const publishThankYouToGammaMutation = trpc.webinar.publishThankYouToGamma.useMutation({
    onSuccess: (data) => {
      setThankYouGammaGenerationId(data.generationId);
      setThankYouGammaPolling(true);
      thankYouPollAttemptsRef.current = 0;
      toast.success("Sent to Gamma — building your thank you page...");
    },
    onError: (err) => toast.error("Gamma publish failed: " + err.message),
  });

  // ─── Thank You Gamma polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!thankYouGammaPolling || !thankYouGammaGenerationId || activeWebinarId === null) return;
    const MAX_ATTEMPTS = 40;
    thankYouPollIntervalRef.current = setInterval(async () => {
      thankYouPollAttemptsRef.current += 1;
      if (thankYouPollAttemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(thankYouPollIntervalRef.current!);
        setThankYouGammaPolling(false);
        toast.error("Gamma generation timed out. Check your Gamma dashboard.");
        return;
      }
      try {
        const result = await utils.webinar.pollThankYouGamma.fetch({
          id: activeWebinarId,
          generationId: thankYouGammaGenerationId,
        });
        if (result.status === "completed" && result.gammaUrl) {
          clearInterval(thankYouPollIntervalRef.current!);
          setThankYouGammaUrl(result.gammaUrl);
          setThankYouGammaPolling(false);
          toast.success("🎉 Thank you page published to Gamma!");
        } else if (result.status === "failed") {
          clearInterval(thankYouPollIntervalRef.current!);
          setThankYouGammaPolling(false);
          toast.error("Gamma generation failed. Try again.");
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 5000);
    return () => {
      if (thankYouPollIntervalRef.current) clearInterval(thankYouPollIntervalRef.current);
    };
  }, [thankYouGammaPolling, thankYouGammaGenerationId, activeWebinarId]);

  const generateThankYouMutation = trpc.webinar.generateThankYouCopy.useMutation({
    onSuccess: (data) => {
      setThankYouCopy(data.thankYouPageCopy);
      toast.success("Thank you page copy generated!");
    },
    onError: (err) => toast.error("Thank you page failed: " + err.message),
  });

  const exportKajabiMutation = trpc.webinar.exportKajabiPlan.useMutation({
    onSuccess: (data) => {
      setKajabiPlan((data as any).kajabiPlan ?? data);
      markStepComplete(4);
      toast.success("Kajabi automation plan generated!");
    },
    onError: (err) => toast.error("Kajabi export failed: " + err.message),
  });

  const generateSurveyMutation = trpc.webinar.generateSurveyQuestions.useMutation({
    onSuccess: (data) => {
      setSurveyQuestions(data.questions);
      toast.success(`Generated ${data.questions.length} survey questions — review and edit below.`);
    },
    onError: (err) => toast.error("Survey generation failed: " + err.message),
  });

  const pushToTypeformMutation = trpc.webinar.pushToTypeform.useMutation({
    onSuccess: (data) => {
      setPushedTypeformUrl(data.typeformUrl);
      setTypeformUrl(data.typeformUrl);
      toast.success("Survey pushed to Typeform!");
    },
    onError: (err) => toast.error("Typeform push failed: " + err.message),
  });

  const updateMutation = trpc.webinar.update.useMutation({
    onSuccess: () => refetchSessions(),
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function markStepComplete(s: number) {
    setCompletedSteps((prev) => { const next = new Set(prev); next.add(s); return next; });
  }

  function resetForNew() {
    setActiveWebinarId(null);
    setStep(1);
    setCompletedSteps(new Set());
    setTopic("Upstream Health: How to Find and Fix Your Root Cause");
    setCta("Get the Upstream Bundle — $399 (test kit + course)");
    setRegistrationUrl("https://us02web.zoom.us/webinar/register/WN_qpfJBJ2uSCWpA8C-b1Kxzg");
    setSelectedPersonaIds([]);
    setTargetLength(60);
    setOutline("");
    setHookScript("");
    setLandingPageCopy("");
    setGammaGenerationId("");
    setGammaUrl("");
    setThankYouCopy("");
    setKajabiPlan(null);
  }

  function loadSession(s: WebinarSession) {
    setActiveWebinarId(s.id);
    setTopic(s.topic);
    setCta(s.cta ?? "");
    setRegistrationUrl(s.registrationUrl ?? "");
    const ids = s.personaIds ? JSON.parse(s.personaIds) : [];
    setSelectedPersonaIds(ids);
    setTargetLength(s.targetLengthMinutes ?? 60);
    setOutline(s.outline ?? "");
    setHookScript(s.hookScript ?? "");
    setLandingPageCopy(s.landingPageCopy ?? "");
    setGammaUrl(s.gammaUrl ?? "");
    setGammaGenerationId(s.gammaGenerationId ?? "");
    setThankYouCopy(s.thankYouPageCopy ?? "");
    setWistiaId(s.thankYouWistiaId ?? "");
    setTypeformUrl(s.thankYouTypeformUrl ?? "");
    if (s.kajabiExport) {
      try { setKajabiPlan(JSON.parse(s.kajabiExport)); } catch { /* ignore */ }
    }
    // Determine furthest step
    const completed = new Set<number>();
    if (s.topic) completed.add(1);
    if (s.outline) completed.add(2);
    if (s.landingPageCopy) completed.add(3);
    if (s.kajabiExport) completed.add(4);
    setCompletedSteps(completed);
    const furthest = s.kajabiExport ? 4 : s.landingPageCopy ? 3 : s.outline ? 2 : 1;
    setStep(furthest as Step);
    toast.success(`Loaded: ${s.topic.slice(0, 50)}`);
  }


  function togglePersona(id: number) {
    setSelectedPersonaIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function copyToClipboard(text: string, label = "Copied!") {
    navigator.clipboard.writeText(text);
    toast.success(label);
  }

  // ─── Step 1: Setup ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Webinar Setup</h2>
          <p className="text-sm text-muted-foreground">
            Fill in the core details. The AI will use your persona intelligence and content data to build a high-converting webinar.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Webinar Topic *</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Upstream Health: How to Find and Fix Your Root Cause Before It Becomes a Crisis"
              className="resize-none h-20"
            />
            <p className="text-xs text-muted-foreground">Be specific — this drives the entire outline and landing page.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Call to Action / Offer *</Label>
            <Input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="e.g. Get the Upstream Bundle — $399 (test kit + course)"
            />
            <p className="text-xs text-muted-foreground">What are you selling or promoting at the end of this webinar?</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Zoom Registration Link</Label>
            <Input
              value={registrationUrl}
              onChange={(e) => setRegistrationUrl(e.target.value)}
              placeholder="https://us02web.zoom.us/webinar/register/..."
              type="url"
            />
            <p className="text-xs text-muted-foreground">Your Zoom webinar registration URL — embedded in the landing page and thank you page.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Length</Label>
            <Select value={String(targetLength)} onValueChange={(v) => setTargetLength(Number(v))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes — Quick training</SelectItem>
                <SelectItem value="45">45 minutes — Standard webinar</SelectItem>
                <SelectItem value="60">60 minutes — Full webinar (recommended)</SelectItem>
                <SelectItem value="75">75 minutes — Extended with Q&A</SelectItem>
                <SelectItem value="90">90 minutes — Deep dive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Target Audience — Select Personas
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (select all that apply — multi-persona targeting)
              </span>
            </Label>
            {(personas as any[]).length === 0 ? (
              <p className="text-xs text-muted-foreground">No personas found. Add personas in Avatar Intelligence first.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(personas as any[]).map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/30 ${
                      selectedPersonaIds.includes(p.id)
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedPersonaIds.includes(p.id)}
                      onCheckedChange={() => togglePersona(p.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {p.icon && <span className="text-sm">{p.icon}</span>}
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => {
              if (!topic.trim()) { toast.error("Please enter a webinar topic"); return; }
              if (!cta.trim()) { toast.error("Please enter a CTA / offer"); return; }
              if (activeWebinarId) {
                // Update existing and advance
                updateMutation.mutate({
                  id: activeWebinarId,
                  topic,
                  cta,
                  registrationUrl,
                  personaIds: selectedPersonaIds,
                  targetLengthMinutes: targetLength,
                });
                markStepComplete(1);
                setStep(2);
              } else {
                createMutation.mutate({
                  topic,
                  cta,
                  registrationUrl: registrationUrl || undefined,
                  personaIds: selectedPersonaIds,
                  targetLengthMinutes: targetLength,
                });
              }
            }}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            {activeWebinarId ? "Save & Continue to Outline" : "Create & Generate Outline"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step 2: Outline ───────────────────────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Webinar Outline</h2>
            <p className="text-sm text-muted-foreground">
              AI-generated outline using your persona intelligence, avatar data, and content strategy.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeWebinarId === null) {
                toast.error("Please complete Step 1 first to create the webinar session.");
                return;
              }
              generateOutlineMutation.mutate({
                id: activeWebinarId,
                topic,
                cta,
                personaIds: selectedPersonaIds,
                targetLengthMinutes: targetLength,
                registrationUrl,
              });
            }}
            disabled={generateOutlineMutation.isPending || activeWebinarId === null}
          >
            {generateOutlineMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {outline ? "Regenerate" : "Generate Outline"}
          </Button>
        </div>

        {generateOutlineMutation.isPending && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Generating your webinar outline...</p>
              <p className="text-xs text-muted-foreground">Loading persona intelligence, avatar data, and CTA strategy. This takes 15–30 seconds.</p>
            </div>
          </div>
        )}

        {!outline && !generateOutlineMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Click "Generate Outline" to create your AI-powered webinar outline.</p>
            <p className="text-xs text-muted-foreground mt-1">Uses your persona data, avatar intelligence, and content strategy.</p>
          </div>
        )}

        {outline && (
          <div className="space-y-4">
            {/* Hook Script collapsible */}
            {hookScript && (
              <Card className="border-primary/20 bg-primary/3">
                <CardHeader className="pb-2 pt-3 px-4">
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setShowHook(!showHook)}
                  >
                    <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Opening Hook Script
                    </CardTitle>
                    {showHook ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </CardHeader>
                {showHook && (
                  <CardContent className="px-4 pb-4">
                    <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
                      {hookScript}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-7 text-xs"
                      onClick={() => copyToClipboard(hookScript, "Hook script copied!")}
                    >
                      <Copy className="h-3 w-3 mr-1.5" />
                      Copy Hook Script
                    </Button>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Full outline */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Full Webinar Outline</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => copyToClipboard(outline, "Outline copied!")}
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="prose prose-sm max-w-none text-foreground/90">
                  <Streamdown>{outline}</Streamdown>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={() => setStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <Button
            onClick={() => {
              if (!outline) { toast.error("Generate an outline first"); return; }
              markStepComplete(2);
              setStep(3);
            }}
            disabled={!outline}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Landing Page
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Landing Page ──────────────────────────────────────────────────

  function renderStep3() {
    const personaNames = (personas as any[])
      .filter((p) => selectedPersonaIds.includes(p.id))
      .map((p) => p.name)
      .join(", ") || "high-performing professionals";

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Landing Page</h2>
            <p className="text-sm text-muted-foreground">
              AI-generated registration landing page copy, then publish to Gamma for a designed page.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeWebinarId === null) return;
              generateLandingCopyMutation.mutate({
                id: activeWebinarId,
                topic,
                cta,
                personaIds: selectedPersonaIds,
                registrationUrl,
                outline,
              });
            }}
            disabled={generateLandingCopyMutation.isPending}
          >
            {generateLandingCopyMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {landingPageCopy ? "Regenerate Copy" : "Generate Copy"}
          </Button>
        </div>

        {generateLandingCopyMutation.isPending && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Generating landing page copy...</p>
              <p className="text-xs text-muted-foreground">Writing in Pedram's voice with persona intelligence. 15–30 seconds.</p>
            </div>
          </div>
        )}

        {!landingPageCopy && !generateLandingCopyMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Click "Generate Copy" to create your landing page.</p>
          </div>
        )}

        {landingPageCopy && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Landing Page Copy</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingLandingCopy(!editingLandingCopy)}
                  >
                    {editingLandingCopy ? "Preview" : "Edit"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(landingPageCopy, "Landing page copy copied!")}
                  >
                    <Copy className="h-3 w-3 mr-1.5" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {editingLandingCopy ? (
                  <Textarea
                    value={landingPageCopy}
                    onChange={(e) => setLandingPageCopy(e.target.value)}
                    className="font-mono text-xs min-h-[400px] resize-y"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none text-foreground/90">
                    <Streamdown>{landingPageCopy}</Streamdown>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gamma publish */}
            <Card className="border-amber-500/20 bg-amber-500/3">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Publish to Gamma
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Publish this copy to Gamma to get a beautifully designed landing page with the Urban Monk brand theme.
                </p>
                {gammaUrl ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">Landing page published!</p>
                      <a
                        href={gammaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline truncate block"
                      >
                        {gammaUrl}
                      </a>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" asChild>
                      <a href={gammaUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </a>
                    </Button>
                  </div>
                ) : gammaPolling ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Gamma is designing your page... (30–90 seconds)</p>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      if (activeWebinarId === null) return;
                      publishToGammaMutation.mutate({
                        id: activeWebinarId,
                        landingPageCopy,
                        topic,
                        personaNames,
                      });
                    }}
                    disabled={publishToGammaMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    size="sm"
                  >
                    {publishToGammaMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Publish to Gamma
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={() => setStep(2)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <Button
            onClick={() => {
              if (!landingPageCopy) { toast.error("Generate landing page copy first"); return; }
              markStepComplete(3);
              setStep(4);
            }}
            disabled={!landingPageCopy}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Thank You + Kajabi
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step 4: Thank You + Kajabi ────────────────────────────────────────────

  function renderStep4() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Thank You Page + Kajabi Automation</h2>
          <p className="text-sm text-muted-foreground">
            Build your post-registration thank you page and generate a complete Kajabi email automation plan.
          </p>
        </div>

        {/* Thank You Page inputs */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Thank You Page
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Wistia Video ID</Label>
              <Input
                value={wistiaId}
                onChange={(e) => setWistiaId(e.target.value)}
                placeholder="e.g. abc123xyz (from your Wistia URL)"
              />
              <p className="text-xs text-muted-foreground">
                The Wistia video ID from your thank you video URL (e.g. fast.wistia.com/medias/<strong>abc123xyz</strong>).
                Leave blank if you don't have a video yet.
              </p>
            </div>

            {/* ─── Typeform Survey Builder ─────────────────────────────── */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Post-Webinar Survey</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI generates 8–10 pain-point questions in Pedram's voice. Review, edit, then push to Typeform.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (activeWebinarId === null) return;
                    generateSurveyMutation.mutate({
                      id: activeWebinarId,
                      topic,
                      cta,
                      personaIds: selectedPersonaIds,
                    });
                  }}
                  disabled={generateSurveyMutation.isPending}
                >
                  {generateSurveyMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {surveyQuestions.length > 0 ? "Regenerate Questions" : "Generate Survey Questions"}
                </Button>
              </div>

              {/* Question review / edit list */}
              {surveyQuestions.length > 0 && (
                <div className="space-y-2">
                  {surveyQuestions.map((q, i) => (
                    <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 shrink-0">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          {editingQuestion === i ? (
                            <div className="space-y-1.5">
                              <Textarea
                                value={q.title}
                                onChange={(e) => {
                                  const updated = [...surveyQuestions];
                                  updated[i] = { ...updated[i], title: e.target.value };
                                  setSurveyQuestions(updated);
                                }}
                                className="text-sm min-h-[60px]"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => setEditingQuestion(null)}
                              >
                                Done
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground/90 leading-snug">{q.title}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">{q.type}</span>
                            {q.required && <span className="text-[10px] text-orange-500">required</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingQuestion(editingQuestion === i ? null : i)}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => setSurveyQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Push to Typeform */}
                  {!pushedTypeformUrl ? (
                    <Button
                      className="w-full mt-2"
                      onClick={() => {
                        if (activeWebinarId === null) return;
                        pushToTypeformMutation.mutate({
                          id: activeWebinarId,
                          title: `${topic} — Post-Webinar Survey`,
                          questions: surveyQuestions,
                        });
                      }}
                      disabled={pushToTypeformMutation.isPending || surveyQuestions.length === 0}
                    >
                      {pushToTypeformMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Push to Typeform
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-2">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        ✅ Survey live on Typeform
                      </p>
                      <a
                        href={pushedTypeformUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline break-all"
                      >
                        {pushedTypeformUrl}
                      </a>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(pushedTypeformUrl, "Typeform URL copied!")}
                        >
                          <Copy className="h-3 w-3 mr-1.5" />Copy URL
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => window.open(pushedTypeformUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />Preview
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual override */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Or paste an existing Typeform URL</Label>
                <Input
                  value={typeformUrl}
                  onChange={(e) => setTypeformUrl(e.target.value)}
                  placeholder="https://theurbanmonk.typeform.com/to/..."
                  type="url"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (activeWebinarId === null) return;
                  generateThankYouMutation.mutate({
                    id: activeWebinarId,
                    topic,
                    cta,
                    personaIds: selectedPersonaIds,
                    wistiaId: wistiaId || undefined,
                    typeformUrl: typeformUrl || undefined,
                  });
                }}
                disabled={generateThankYouMutation.isPending}
              >
                {generateThankYouMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                Generate Thank You Copy
              </Button>
            </div>

            {thankYouCopy && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Thank You Page Copy</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyToClipboard(thankYouCopy, "Thank you copy copied!")}
                    >
                      <Copy className="h-3 w-3 mr-1.5" />
                      Copy
                    </Button>
                  </div>
                  <div className="prose prose-sm max-w-none text-foreground/90 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <Streamdown>{thankYouCopy}</Streamdown>
                  </div>
                </div>

                {/* ─── Publish Thank You Page to Gamma ─────────────────── */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Publish Thank You Page to Gamma</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gamma will build a live, branded thank you page from your copy — including the Wistia video embed, Typeform survey link, and calendar add buttons.
                  </p>

                  {!thankYouGammaUrl ? (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        if (activeWebinarId === null) return;
                        const personaNames = personas
                          .filter((p: any) => selectedPersonaIds.includes(p.id))
                          .map((p: any) => p.name)
                          .join(", ") || "high-performing professionals";
                        publishThankYouToGammaMutation.mutate({
                          id: activeWebinarId,
                          thankYouPageCopy: thankYouCopy,
                          topic,
                          personaNames,
                        });
                      }}
                      disabled={publishThankYouToGammaMutation.isPending || thankYouGammaPolling}
                    >
                      {publishThankYouToGammaMutation.isPending || thankYouGammaPolling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {thankYouGammaPolling ? "Building page…" : "Publish to Gamma"}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">✅ Thank you page live on Gamma</p>
                      <a
                        href={thankYouGammaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline break-all"
                      >
                        {thankYouGammaUrl}
                      </a>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(thankYouGammaUrl, "Thank you page URL copied!")}
                        >
                          <Copy className="h-3 w-3 mr-1.5" />Copy URL
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => window.open(thankYouGammaUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />Open Page
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => {
                            setThankYouGammaUrl("");
                            setThankYouGammaGenerationId("");
                          }}
                        >
                          Republish
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kajabi Automation */}
        <Card className="border-violet-500/20 bg-violet-500/3">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-700 dark:text-violet-400">
              <Zap className="h-4 w-4" />
              Kajabi Automation Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Generate a complete Kajabi automation plan: pre-webinar reminder emails, post-webinar follow-up sequence, tags, and setup instructions.
            </p>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                if (activeWebinarId === null) return;
                exportKajabiMutation.mutate({
                  id: activeWebinarId,
                  topic,
                  cta,
                  registrationUrl,
                  personaIds: selectedPersonaIds,
                });
              }}
              disabled={exportKajabiMutation.isPending}
            >
              {exportKajabiMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-1.5" />
              )}
              {kajabiPlan ? "Regenerate Kajabi Plan" : "Generate Kajabi Automation Plan"}
            </Button>

            {kajabiPlan && (
              <div className="space-y-4">
                {/* Pipeline summary */}
                <div className="p-3 rounded-lg bg-background border border-border/50">
                  <p className="text-xs font-semibold text-foreground mb-1">Pipeline: {kajabiPlan.pipeline_name}</p>
                  <p className="text-xs text-muted-foreground">Trigger: {kajabiPlan.trigger}</p>
                  {kajabiPlan.tags_to_apply?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {kajabiPlan.tags_to_apply.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pre-webinar emails */}
                {kajabiPlan.email_sequence?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Pre-Webinar Email Sequence ({kajabiPlan.email_sequence.length} emails)</p>
                    {kajabiPlan.email_sequence.map((email: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background border border-border/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground line-clamp-1">{email.subject}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{email.delay}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{email.body_summary}</p>
                        {email.cta_text && (
                          <p className="text-[11px] text-primary font-medium">CTA: {email.cta_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Post-webinar emails */}
                {kajabiPlan.post_webinar_sequence?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Post-Webinar Follow-Up ({kajabiPlan.post_webinar_sequence.length} emails)</p>
                    {kajabiPlan.post_webinar_sequence.map((email: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background border border-border/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground line-clamp-1">{email.subject}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{email.delay}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{email.body_summary}</p>
                        {email.cta_text && (
                          <p className="text-[11px] text-primary font-medium">CTA: {email.cta_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Setup instructions */}
                {kajabiPlan.setup_instructions?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Kajabi Setup Instructions</p>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      {kajabiPlan.setup_instructions.map((step: string, idx: number) => (
                        <li key={idx} className="text-xs text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Raw JSON toggle */}
                <div>
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setShowKajabiRaw(!showKajabiRaw)}
                  >
                    {showKajabiRaw ? "Hide" : "Show"} raw JSON
                  </button>
                  {showKajabiRaw && (
                    <div className="mt-2 relative">
                      <pre className="text-[10px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-60 text-muted-foreground">
                        {JSON.stringify(kajabiPlan, null, 2)}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-6 text-[10px]"
                        onClick={() => copyToClipboard(JSON.stringify(kajabiPlan, null, 2), "JSON copied!")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy JSON
                      </Button>
                    </div>
                  )}
                </div>

                {/* Download button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(kajabiPlan, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `kajabi-plan-${topic.slice(0, 30).replace(/\s+/g, "-").toLowerCase()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Kajabi Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={() => setStep(3)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          {completedSteps.has(4) && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Webinar funnel complete!
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Webinar Funnel Builder</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Build a complete webinar funnel — outline, landing page, thank you page, and Kajabi automation — in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar — webinar list */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Your Webinars
              </h3>
              <WebinarList
                sessions={sessions as WebinarSession[]}
                activeId={activeWebinarId}
                onSelect={loadSession}
                onNew={resetForNew}
              />
            </div>

            {/* Quick stats for active webinar */}
            {activeWebinarId && (
              <div className="p-4 rounded-xl border border-border/50 bg-card space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Funnel Progress
                </h3>
                {[
                  { label: "Setup", done: completedSteps.has(1) },
                  { label: "Outline", done: completedSteps.has(2) },
                  { label: "Landing Page", done: completedSteps.has(3) },
                  { label: "Thank You + Kajabi", done: completedSteps.has(4) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? "bg-green-500" : "bg-muted"}`}>
                      {item.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-xs ${item.done ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                  </div>
                ))}
                {registrationUrl && (
                  <div className="pt-2 border-t border-border/50">
                    <a
                      href={registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Zoom Registration
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main wizard */}
          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <StepIndicator current={step} completed={completedSteps} />
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
