/**
 * DiagnosticQuiz — public-facing 5-question avatar diagnostic quiz
 *
 * Flow:
 *   1. Welcome screen → Start Quiz
 *   2. Questions 1–5 (one at a time, progress bar)
 *   3. Email gate ("See your results")
 *   4. Results page with avatar profile + recommendation + CTA
 *
 * No auth required — uses publicProcedure endpoints.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowRight, Leaf, Zap, Heart, Target, CheckCircle2, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type QuizStep = "welcome" | "questions" | "email_gate" | "results";

interface AvatarResult {
  avatarType: string;
  profile: {
    label: string;
    headline: string;
    description: string;
    recommendation: string;
    recommendationUrl: string;
    primaryColor: string;
  };
}

// ─── Avatar color map ─────────────────────────────────────────────────────────
const AVATAR_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; icon: React.ReactNode }> = {
  burned_out_executive: {
    bg: "bg-amber-950/40",
    border: "border-amber-700/50",
    text: "text-amber-300",
    badge: "bg-amber-900/60 text-amber-200",
    icon: <Zap className="w-8 h-8 text-amber-400" />,
  },
  stressed_parent: {
    bg: "bg-rose-950/40",
    border: "border-rose-700/50",
    text: "text-rose-300",
    badge: "bg-rose-900/60 text-rose-200",
    icon: <Heart className="w-8 h-8 text-rose-400" />,
  },
  wellness_seeker: {
    bg: "bg-emerald-950/40",
    border: "border-emerald-700/50",
    text: "text-emerald-300",
    badge: "bg-emerald-900/60 text-emerald-200",
    icon: <Leaf className="w-8 h-8 text-emerald-400" />,
  },
  performance_optimizer: {
    bg: "bg-violet-950/40",
    border: "border-violet-700/50",
    text: "text-violet-300",
    badge: "bg-violet-900/60 text-violet-200",
    icon: <Target className="w-8 h-8 text-violet-400" />,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function DiagnosticQuiz() {
  const [step, setStep] = useState<QuizStep>("welcome");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [avatarResult, setAvatarResult] = useState<AvatarResult | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Parse UTM params from URL
  const [utmSource] = useState(() => new URLSearchParams(window.location.search).get("utm_source") ?? undefined);
  const [utmCampaign] = useState(() => new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined);

  const { data: questionsData, isLoading: questionsLoading } = trpc.quiz.getQuestions.useQuery();
  const questions = questionsData ?? [];

  const startSession = trpc.quiz.startSession.useMutation();
  const submitAnswers = trpc.quiz.submitAnswers.useMutation();
  const captureEmail = trpc.quiz.captureEmail.useMutation();

  // Start session on mount
  useEffect(() => {
    startSession.mutateAsync({ utmSource, utmCampaign }).then(({ sessionId }) => {
      setSessionId(sessionId);
    }).catch(() => {
      // Non-fatal — quiz still works without a session (no analytics)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartQuiz = () => {
    setStep("questions");
    setCurrentQuestion(0);
  };

  const handleSelectOption = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleNextQuestion = () => {
    if (!selectedOption) return;
    const question = questions[currentQuestion];
    const newAnswers = { ...answers, [question.id]: selectedOption };
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // All questions answered — submit and go to email gate
      handleSubmitAnswers(newAnswers);
    }
  };

  const handleSubmitAnswers = async (finalAnswers: Record<string, string>) => {
    if (!sessionId) {
      // Still show email gate even without session
      setStep("email_gate");
      return;
    }
    try {
      const result = await submitAnswers.mutateAsync({ sessionId, answers: finalAnswers });
      setAvatarResult(result);
      setStep("email_gate");
    } catch {
      setStep("email_gate");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    if (!sessionId) {
      // No session — just show results anyway
      setStep("results");
      return;
    }
    try {
      const result = await captureEmail.mutateAsync({ sessionId, email, name: name || undefined });
      if (result.profile) {
        setAvatarResult({ avatarType: result.avatarType ?? "", profile: result.profile as AvatarResult["profile"] });
      }
      setStep("results");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  // ─── Welcome Screen ─────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-900/30 border border-amber-700/40 flex items-center justify-center">
              <span className="text-amber-400 font-serif font-bold text-2xl">UM</span>
            </div>
          </div>
          <p className="text-amber-400/80 text-sm font-medium tracking-widest uppercase mb-4">The Urban Monk</p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 leading-tight">
            What is your body<br />trying to tell you?
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
            Take this 5-question diagnostic and discover the root of your energy, stress, and health challenges — and the exact path forward.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8 text-white/40 text-sm">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-amber-500/60" /> 5 questions</span>
            <span className="hidden sm:block">·</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-amber-500/60" /> 2 minutes</span>
            <span className="hidden sm:block">·</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-amber-500/60" /> Personalized results</span>
          </div>
          <Button
            onClick={handleStartQuiz}
            disabled={questionsLoading}
            className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-4 text-lg rounded-full"
          >
            {questionsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Start the Quiz <ArrowRight className="w-5 h-5 ml-2" /></>}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Questions ──────────────────────────────────────────────────────────────
  if (step === "questions") {
    const question = questions[currentQuestion];
    if (!question) return null;
    const progress = ((currentQuestion) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <span className="text-white/40 text-sm">Question {currentQuestion + 1} of {questions.length}</span>
            <span className="text-amber-400/60 text-sm font-medium">The Urban Monk</span>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="mb-10 h-1 bg-white/10" />

          {/* Question */}
          <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-8 leading-snug">
            {question.text}
          </h2>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {question.options.map(option => (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-150 ${
                  selectedOption === option.id
                    ? "border-amber-500 bg-amber-900/20 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <span className="text-base leading-relaxed">{option.text}</span>
              </button>
            ))}
          </div>

          {/* Next button */}
          <div className="flex justify-end">
            <Button
              onClick={handleNextQuestion}
              disabled={!selectedOption || submitAnswers.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-full"
            >
              {submitAnswers.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentQuestion < questions.length - 1 ? (
                <>Next <ArrowRight className="w-4 h-4 ml-1.5" /></>
              ) : (
                <>See My Results <ArrowRight className="w-4 h-4 ml-1.5" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Email Gate ─────────────────────────────────────────────────────────────
  if (step === "email_gate") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-14 h-14 rounded-full bg-amber-900/30 border border-amber-700/40 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <h2 className="text-3xl font-serif font-bold mb-3">Your results are ready.</h2>
          <p className="text-white/50 mb-8 text-base leading-relaxed">
            Enter your email to see your personalized health profile and the exact path Dr. Pedram Shojai recommends for someone like you.
          </p>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="First name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 h-12 text-base"
            />
            <Input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 h-12 text-base"
            />
            <Button
              type="submit"
              disabled={captureEmail.isPending}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white h-12 text-base rounded-full"
            >
              {captureEmail.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Show My Results <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
          <p className="text-white/25 text-xs mt-4">
            No spam. Unsubscribe any time. Dr. Pedram Shojai, The Urban Monk.
          </p>
        </div>
      </div>
    );
  }

  // ─── Results ─────────────────────────────────────────────────────────────────
  if (step === "results" && avatarResult) {
    const colors = AVATAR_COLORS[avatarResult.avatarType] ?? AVATAR_COLORS.burned_out_executive;

    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          {/* Avatar badge */}
          <div className="text-center mb-8">
            <p className="text-white/40 text-sm uppercase tracking-widest mb-4">Your Health Profile</p>
            <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-full border ${colors.bg} ${colors.border} mb-6`}>
              {colors.icon}
              <span className={`font-semibold text-lg ${colors.text}`}>{avatarResult.profile.label}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 leading-tight">
              {avatarResult.profile.headline}
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-xl mx-auto">
              {avatarResult.profile.description}
            </p>
          </div>

          {/* Recommendation card */}
          <div className={`rounded-2xl border p-6 mb-8 ${colors.bg} ${colors.border}`}>
            <p className="text-white/50 text-sm uppercase tracking-wider mb-2">Recommended for you</p>
            <p className={`text-xl font-semibold mb-4 ${colors.text}`}>
              {avatarResult.profile.recommendation}
            </p>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Based on your answers, this is the program Dr. Pedram Shojai recommends as your starting point. It is designed specifically for the challenges you described.
            </p>
            <a
              href={avatarResult.profile.recommendationUrl}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium text-white transition-all ${
                avatarResult.avatarType === "wellness_seeker"
                  ? "bg-emerald-700 hover:bg-emerald-600"
                  : avatarResult.avatarType === "stressed_parent"
                  ? "bg-rose-700 hover:bg-rose-600"
                  : avatarResult.avatarType === "performance_optimizer"
                  ? "bg-violet-700 hover:bg-violet-600"
                  : "bg-amber-700 hover:bg-amber-600"
              }`}
            >
              Learn More <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* What happens next */}
          <div className="text-center">
            <p className="text-white/30 text-sm">
              Check your inbox — Dr. Shojai has sent you a personalized note based on your profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (results without avatar data)
  if (step === "results") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-serif font-bold mb-3">Thank you!</h2>
          <p className="text-white/60 mb-6">Your results are on their way to your inbox.</p>
          <a href="/" className="text-amber-400 hover:text-amber-300 text-sm underline">Return to The Urban Monk</a>
        </div>
      </div>
    );
  }

  return null;
}
