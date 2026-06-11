/**
 * Presence Assessment Quiz
 *
 * A 9-question quiz that identifies which of Dr. Pedram Shojai's
 * "9 presence channels" are suppressed in the user's life.
 *
 * This is the primary lead magnet for the Lights On campaign.
 * It can be accessed without login (anonymous results are stored).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Moon,
  Wind,
  Leaf,
  Zap,
  Brain,
  Activity,
  Heart,
  Compass,
  Home,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ExternalLink,
} from "lucide-react";

// ─── Channel definitions ──────────────────────────────────────────────────────
type ChannelKey =
  | "sleep"
  | "stress"
  | "gut"
  | "energy"
  | "focus"
  | "movement"
  | "connection"
  | "purpose"
  | "environment";

interface Channel {
  key: ChannelKey;
  label: string;
  icon: React.ElementType;
  color: string;
  question: string;
  options: { value: number; label: string }[];
  suppressedMessage: string;
  resourcedMessage: string;
}

const CHANNELS: Channel[] = [
  {
    key: "sleep",
    label: "Sleep",
    icon: Moon,
    color: "text-indigo-500",
    question: "How would you describe your sleep quality over the past month?",
    options: [
      { value: 1, label: "Terrible — I wake up exhausted every day" },
      { value: 2, label: "Poor — I rarely feel rested" },
      { value: 3, label: "Fair — Some nights are good, some are bad" },
      { value: 4, label: "Good — I usually sleep well" },
      { value: 5, label: "Excellent — I wake up refreshed and energized" },
    ],
    suppressedMessage:
      "Your sleep channel is suppressed. Poor sleep is the root of most modern health problems — it impairs hormones, immunity, cognition, and metabolism. This is the first channel to address.",
    resourcedMessage:
      "Your sleep channel is well-resourced. Quality sleep is the foundation of everything else.",
  },
  {
    key: "stress",
    label: "Stress",
    icon: Wind,
    color: "text-red-500",
    question:
      "How well are you managing stress and maintaining inner calm in your daily life?",
    options: [
      { value: 1, label: "Overwhelmed — I feel like I'm drowning" },
      { value: 2, label: "Struggling — Stress is significantly affecting me" },
      { value: 3, label: "Managing — I cope but it takes effort" },
      { value: 4, label: "Resilient — I handle stress fairly well" },
      { value: 5, label: "Grounded — I maintain calm even under pressure" },
    ],
    suppressedMessage:
      "Your stress channel is suppressed. Chronic stress drives cortisol dysregulation, gut permeability, inflammation, and hormonal chaos. Learning to manage your nervous system is non-negotiable.",
    resourcedMessage:
      "Your stress channel is well-resourced. Nervous system regulation is a superpower.",
  },
  {
    key: "gut",
    label: "Gut Health",
    icon: Leaf,
    color: "text-green-500",
    question:
      "How would you describe your digestive health and gut function?",
    options: [
      { value: 1, label: "Very poor — chronic issues (bloating, pain, irregularity)" },
      { value: 2, label: "Poor — frequent discomfort or digestive problems" },
      { value: 3, label: "Fair — occasional issues but manageable" },
      { value: 4, label: "Good — mostly comfortable with minor issues" },
      { value: 5, label: "Excellent — strong digestion, no issues" },
    ],
    suppressedMessage:
      "Your gut channel is suppressed. The gut-brain axis is real — a compromised microbiome drives inflammation, mood disorders, cognitive fog, and immune dysfunction. This is where health begins.",
    resourcedMessage:
      "Your gut channel is well-resourced. A healthy gut is the foundation of systemic health.",
  },
  {
    key: "energy",
    label: "Energy",
    icon: Zap,
    color: "text-yellow-500",
    question:
      "How would you rate your overall energy levels throughout the day?",
    options: [
      { value: 1, label: "Depleted — I'm exhausted all the time" },
      { value: 2, label: "Low — I struggle to get through the day" },
      { value: 3, label: "Variable — energy crashes are common" },
      { value: 4, label: "Good — I have consistent energy most days" },
      { value: 5, label: "Vibrant — I have sustained, high energy all day" },
    ],
    suppressedMessage:
      "Your energy channel is suppressed. Chronic fatigue is a signal — not a personality trait. Mitochondrial dysfunction, adrenal fatigue, and poor metabolic health all drain your life force.",
    resourcedMessage:
      "Your energy channel is well-resourced. Sustained vitality is your natural state.",
  },
  {
    key: "focus",
    label: "Focus & Clarity",
    icon: Brain,
    color: "text-blue-500",
    question:
      "How would you describe your mental clarity, focus, and cognitive performance?",
    options: [
      { value: 1, label: "Foggy — I can barely concentrate or think clearly" },
      { value: 2, label: "Scattered — focus is difficult and inconsistent" },
      { value: 3, label: "Average — I can focus but get distracted easily" },
      { value: 4, label: "Sharp — I maintain good focus most of the time" },
      { value: 5, label: "Crystal clear — peak mental performance regularly" },
    ],
    suppressedMessage:
      "Your focus channel is suppressed. Brain fog is not normal — it's a symptom of inflammation, poor sleep, gut dysbiosis, or nutrient deficiency. Your brain can be reclaimed.",
    resourcedMessage:
      "Your focus channel is well-resourced. Mental clarity is your competitive advantage.",
  },
  {
    key: "movement",
    label: "Movement",
    icon: Activity,
    color: "text-orange-500",
    question:
      "How consistent and fulfilling is your physical movement and exercise practice?",
    options: [
      { value: 1, label: "Sedentary — I rarely move intentionally" },
      { value: 2, label: "Minimal — I exercise occasionally but inconsistently" },
      { value: 3, label: "Moderate — I move regularly but it's not fulfilling" },
      { value: 4, label: "Active — I exercise consistently and enjoy it" },
      { value: 5, label: "Thriving — movement is a joyful daily practice" },
    ],
    suppressedMessage:
      "Your movement channel is suppressed. The body was designed to move — sedentary living accelerates aging, impairs lymphatic flow, and suppresses mood. Movement is medicine.",
    resourcedMessage:
      "Your movement channel is well-resourced. Physical vitality supports every other channel.",
  },
  {
    key: "connection",
    label: "Connection",
    icon: Heart,
    color: "text-pink-500",
    question:
      "How meaningful and nourishing are your relationships and social connections?",
    options: [
      { value: 1, label: "Isolated — I feel deeply disconnected from others" },
      { value: 2, label: "Lonely — my relationships feel superficial or draining" },
      { value: 3, label: "Okay — some connections but not deeply fulfilling" },
      { value: 4, label: "Connected — I have meaningful relationships" },
      { value: 5, label: "Deeply nourished — my relationships are a source of strength" },
    ],
    suppressedMessage:
      "Your connection channel is suppressed. Loneliness is as dangerous as smoking 15 cigarettes a day. Humans are wired for tribe — isolation suppresses immunity and accelerates disease.",
    resourcedMessage:
      "Your connection channel is well-resourced. Deep relationships are the foundation of a meaningful life.",
  },
  {
    key: "purpose",
    label: "Purpose",
    icon: Compass,
    color: "text-purple-500",
    question:
      "How clearly defined and actively pursued is your sense of purpose and meaning?",
    options: [
      { value: 1, label: "Lost — I have no sense of direction or meaning" },
      { value: 2, label: "Unclear — I feel adrift and unfulfilled" },
      { value: 3, label: "Searching — I have some sense of purpose but it's vague" },
      { value: 4, label: "Aligned — I have a clear purpose and pursue it" },
      { value: 5, label: "On fire — I live with deep meaning and intentionality" },
    ],
    suppressedMessage:
      "Your purpose channel is suppressed. Without a clear 'why,' the body has no reason to thrive. Purpose activates the parasympathetic nervous system and drives longevity.",
    resourcedMessage:
      "Your purpose channel is well-resourced. A clear mission is the most powerful health intervention.",
  },
  {
    key: "environment",
    label: "Environment",
    icon: Home,
    color: "text-teal-500",
    question:
      "How clean, supportive, and health-promoting is your physical environment?",
    options: [
      { value: 1, label: "Toxic — I'm surrounded by chemicals, clutter, and chaos" },
      { value: 2, label: "Poor — my environment undermines my health" },
      { value: 3, label: "Average — some issues but mostly manageable" },
      { value: 4, label: "Good — my environment supports my wellbeing" },
      { value: 5, label: "Optimal — my home and workspace are health-promoting sanctuaries" },
    ],
    suppressedMessage:
      "Your environment channel is suppressed. You cannot out-supplement a toxic environment. EMFs, mold, chemicals, and chaos all drain your life force at the cellular level.",
    resourcedMessage:
      "Your environment channel is well-resourced. A clean environment amplifies every other practice.",
  },
];

// ─── Score color helpers ──────────────────────────────────────────────────────
function getScoreColor(score: number): string {
  if (score <= 2) return "text-red-500";
  if (score <= 3) return "text-yellow-500";
  return "text-green-500";
}

function getScoreBg(score: number): string {
  if (score <= 2) return "bg-red-50 border-red-200";
  if (score <= 3) return "bg-yellow-50 border-yellow-200";
  return "bg-green-50 border-green-200";
}

function getScoreLabel(score: number): string {
  if (score <= 2) return "Suppressed";
  if (score <= 3) return "Developing";
  return "Resourced";
}

// ─── Result tier descriptions ─────────────────────────────────────────────────
const RESULT_DESCRIPTIONS: Record<string, { headline: string; body: string; cta: string }> = {
  "Highly Suppressed": {
    headline: "Your Presence is Severely Suppressed",
    body:
      "Multiple channels of your life force are running on empty. This isn't a character flaw — it's a physiological reality. Your body is signaling that it needs support across several key systems. The good news? You can turn this around. The Lights On program was built for exactly this moment.",
    cta: "Start Lights On — Reclaim Your Energy",
  },
  "Partially Suppressed": {
    headline: "Some of Your Channels Are Running Dim",
    body:
      "You're functioning, but you're not thriving. Several key channels are suppressed, quietly draining your energy, clarity, and vitality. You may have adapted to feeling this way — but this is not your baseline. With targeted support, you can restore full presence in 90 days.",
    cta: "Turn the Lights On — See What's Possible",
  },
  "Well-Resourced": {
    headline: "You're Well-Resourced — Now Go Deeper",
    body:
      "You've built a strong foundation. Your channels are largely open and flowing. Now the question is: how much further can you go? The Lights On program will help you optimize the channels that still have room to grow and take your vitality to the next level.",
    cta: "Optimize Your Presence — Go Deeper",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PresenceAssessment() {
  const [step, setStep] = useState<"intro" | "quiz" | "email" | "results">("intro");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [scores, setScores] = useState<Partial<Record<ChannelKey, number>>>({});
  const [email, setEmail] = useState("");
  const [resultData, setResultData] = useState<{
    resultId: number;
    overallScore: number;
    primaryResult: string;
    suppressedChannels: string[];
    scores: Record<ChannelKey, number>;
  } | null>(null);

  const submitMutation = trpc.presenceAssessment.submitAssessment.useMutation({
    onSuccess: (data) => {
      setResultData(data as any);
      setStep("results");
    },
  });

  const channel = CHANNELS[currentQuestion];
  const progress = ((currentQuestion + 1) / CHANNELS.length) * 100;
  const allAnswered = CHANNELS.every((c) => scores[c.key] !== undefined);

  const handleAnswer = (value: number) => {
    const newScores = { ...scores, [channel.key]: value };
    setScores(newScores);

    if (currentQuestion < CHANNELS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handleSubmit = () => {
    if (!allAnswered) return;
    submitMutation.mutate({
      scores: scores as Record<ChannelKey, number>,
      email: email || undefined,
    });
  };

  const handleReset = () => {
    setStep("intro");
    setCurrentQuestion(0);
    setScores({});
    setEmail("");
    setResultData(null);
  };

  // ── Intro screen ──
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Logo / brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
              <span className="text-amber-400 font-serif font-bold text-2xl">UM</span>
            </div>
            <p className="text-amber-400/80 text-sm tracking-widest uppercase font-medium">
              Dr. Pedram Shojai
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 text-center">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4 leading-tight">
              The Presence Assessment
            </h1>
            <p className="text-white/60 text-lg mb-6 leading-relaxed">
              Discover which of your 9 life-force channels are suppressed — and
              what to do about it.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {CHANNELS.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                  <span className="text-white/70 text-xs font-medium">{c.label}</span>
                </div>
              ))}
            </div>
            <p className="text-white/40 text-sm mb-8">
              9 questions · Takes about 3 minutes · No login required
            </p>
            <Button
              size="lg"
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-10 py-6 text-lg rounded-xl"
              onClick={() => setStep("quiz")}
            >
              Start the Assessment
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz screen ──
  if (step === "quiz") {
    const selectedValue = scores[channel.key];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white/50 text-sm">
                Question {currentQuestion + 1} of {CHANNELS.length}
              </span>
              <span className="text-white/50 text-sm">
                {Math.round(progress)}% complete
              </span>
            </div>
            <Progress value={progress} className="h-1.5 bg-white/10" />
          </div>

          {/* Question card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            {/* Channel header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <channel.icon className={`h-5 w-5 ${channel.color}`} />
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-medium">
                  Channel {currentQuestion + 1}
                </p>
                <p className="text-white font-semibold">{channel.label}</p>
              </div>
            </div>

            {/* Question */}
            <h2 className="text-xl md:text-2xl font-serif font-medium text-white mb-8 leading-snug">
              {channel.question}
            </h2>

            {/* Options */}
            <div className="flex flex-col gap-3">
              {channel.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                    selectedValue === option.value
                      ? "bg-amber-500/20 border-amber-500/50 text-white"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-sm font-bold",
                      selectedValue === option.value
                        ? "border-amber-400 bg-amber-400 text-slate-900"
                        : "border-white/20 text-white/40"
                    )}
                  >
                    {option.value}
                  </div>
                  <span className="text-sm leading-snug">{option.label}</span>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/40 hover:text-white"
                onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {currentQuestion === CHANNELS.length - 1 && allAnswered && (
                <Button
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
                  onClick={() => setStep("email")}
                >
                  See My Results
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Channel dots */}
          <div className="flex justify-center gap-2 mt-6">
            {CHANNELS.map((c, i) => (
              <button
                key={c.key}
                onClick={() => setCurrentQuestion(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentQuestion
                    ? "bg-amber-400 w-4"
                    : scores[c.key] !== undefined
                    ? "bg-white/40"
                    : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Email capture screen ──
  if (step === "email") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-amber-400 font-serif font-bold text-xl">UM</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-3">
              Your Results Are Ready
            </h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              Enter your email to receive your personalized Presence Assessment
              report and Dr. Pedram's recommendations for your suppressed channels.
            </p>
            <div className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-center h-12"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button
                size="lg"
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-12"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Analyzing..." : "Show Me My Results"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <button
                className="text-white/30 text-sm hover:text-white/60 transition-colors mt-1"
                onClick={handleSubmit}
              >
                Skip — just show me my results
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Results screen ──
  if (step === "results" && resultData) {
    const desc = RESULT_DESCRIPTIONS[resultData.primaryResult] ?? RESULT_DESCRIPTIONS["Partially Suppressed"];
    const suppressedSet = new Set(resultData.suppressedChannels);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
              <span className="text-amber-400 font-serif font-bold text-xl">UM</span>
            </div>
            <p className="text-amber-400/80 text-xs tracking-widest uppercase font-medium mb-4">
              Your Presence Assessment Results
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4 leading-tight">
              {desc.headline}
            </h1>

            {/* Overall score ring */}
            <div className="inline-flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 border-amber-500/40 bg-amber-500/10 mb-4">
              <span className="text-4xl font-bold text-amber-400">{resultData.overallScore}</span>
              <span className="text-white/40 text-xs">/ 100</span>
            </div>

            <p className="text-white/60 max-w-xl mx-auto leading-relaxed">
              {desc.body}
            </p>
          </div>

          {/* Channel grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {CHANNELS.map((c) => {
              const score = resultData.scores[c.key] ?? 0;
              const isSuppressed = suppressedSet.has(c.key);
              return (
                <div
                  key={c.key}
                  className={cn(
                    "rounded-xl border p-4",
                    isSuppressed
                      ? "bg-red-950/30 border-red-500/30"
                      : "bg-white/5 border-white/10"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <c.icon className={`h-4 w-4 ${c.color}`} />
                      <span className="text-white font-medium text-sm">{c.label}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs border-0 font-medium",
                        isSuppressed
                          ? "bg-red-500/20 text-red-300"
                          : score <= 3
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-green-500/20 text-green-300"
                      )}
                    >
                      {getScoreLabel(score)}
                    </Badge>
                  </div>
                  {/* Score bar */}
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <div
                        key={v}
                        className={cn(
                          "flex-1 h-1.5 rounded-full",
                          v <= score
                            ? isSuppressed
                              ? "bg-red-400"
                              : score <= 3
                              ? "bg-yellow-400"
                              : "bg-green-400"
                            : "bg-white/10"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">
                    {isSuppressed ? c.suppressedMessage : c.resourcedMessage}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-serif font-bold text-white mb-3">
              Ready to Turn the Lights On?
            </h2>
            <p className="text-white/60 mb-6 max-w-lg mx-auto leading-relaxed">
              The Lights On program addresses all 9 channels systematically — sleep,
              stress, gut, energy, focus, movement, connection, purpose, and environment.
              In 90 days, you can restore full presence.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8"
                onClick={() => window.open("https://theurbanmonk.com/lights-on", "_blank")}
              >
                {desc.cta}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={handleReset}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake Assessment
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (should not reach here)
  return null;
}
