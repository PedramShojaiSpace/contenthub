/**
 * TantraQuiz.tsx
 *
 * Full 12-screen sexual vitality quiz funnel for the Tantra line.
 * Modeled on the InnerBalance cold-traffic quiz architecture.
 *
 * Screen flow:
 *   0  → Welcome / Hero
 *   1  → Age qualifier
 *   2  → Who is this for? (gender routing)
 *   3  → Vitality check (how are you feeling?)
 *   4  → Sexual energy question
 *   5  → Education interstitial: "This is not your fault"
 *   6  → Symptom mapping (multi-select, flags gut/sleep/oral)
 *   7  → Connection / relationship question
 *   8  → Education interstitial: "The East-West approach"
 *   9  → Safety screen
 *   10 → Goals / aspiration
 *   11 → Social proof interstitial
 *   12 → Email capture (lead gate)
 *   13 → Results page (product recommendation + upsells)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, ChevronRight, Shield, Star, Leaf, Zap, Moon, Heart } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuizScreen =
  | "welcome"
  | "age"
  | "who"
  | "vitality"
  | "sexual_energy"
  | "edu_not_your_fault"
  | "symptoms"
  | "connection"
  | "edu_east_west"
  | "safety"
  | "goals"
  | "social_proof"
  | "email_capture"
  | "results";

interface QuizState {
  sessionId: string | null;
  screen: QuizScreen;
  answers: Record<string, string | string[]>;
  result: "tantra_him" | "tantra_her" | "tantra_bundle" | "pending" | null;
  product: ProductInfo | null;
  upsells: UpsellInfo[];
  tantraCourse: CourseInfo | null;
  lightsOn: CourseInfo | null;
  email: string;
  name: string;
  emailSubmitted: boolean;
  progress: number; // 0-100
}

// Couple result carries both individual SKUs
interface CoupleProducts {
  him: ProductInfo;
  her: ProductInfo;
}

interface ProductInfo {
  name: string;
  tagline: string;
  headline: string;
  subheadline: string;
  description: string;
  price: string;
  shopifyUrl: string;
  primaryColor: string;
}

interface UpsellInfo {
  name: string;
  description: string;
  price: string;
  shopifyUrl?: string;
  flag: string;
}

interface CourseInfo {
  name: string;
  tagline: string;
  description: string;
  price: string;
  shopifyUrl: string;
}

// ─── Progress mapping ─────────────────────────────────────────────────────────

const SCREEN_PROGRESS: Record<QuizScreen, number> = {
  welcome: 0,
  age: 10,
  who: 20,
  vitality: 30,
  sexual_energy: 38,
  edu_not_your_fault: 44,
  symptoms: 52,
  connection: 60,
  edu_east_west: 66,
  safety: 74,
  goals: 82,
  social_proof: 90,
  email_capture: 95,
  results: 100,
};

const SCREEN_ORDER: QuizScreen[] = [
  "welcome",
  "age",
  "who",
  "vitality",
  "sexual_energy",
  "edu_not_your_fault",
  "symptoms",
  "connection",
  "edu_east_west",
  "safety",
  "goals",
  "social_proof",
  "email_capture",
  "results",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TantraQuiz() {
  const [state, setState] = useState<QuizState>({
    sessionId: null,
    screen: "welcome",
    answers: {},
    result: null,
    product: null,
    upsells: [],
    tantraCourse: null,
    lightsOn: null,
    email: "",
    name: "",
    emailSubmitted: false,
    progress: 0,
  });

  // Couple products — set when q_who === "couple"
  const [coupleProducts, setCoupleProducts] = useState<CoupleProducts | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on screen change
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.screen]);

  // tRPC mutations
  const startSession = trpc.tantraQuiz.startSession.useMutation();
  const submitAnswers = trpc.tantraQuiz.submitAnswers.useMutation();
  const captureEmail = trpc.tantraQuiz.captureEmail.useMutation();

  // Parse UTM params from URL
  const getUtmParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
    };
  };

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const goToScreen = (screen: QuizScreen) => {
    setState(s => ({ ...s, screen, progress: SCREEN_PROGRESS[screen] }));
  };

  const nextScreen = () => {
    const idx = SCREEN_ORDER.indexOf(state.screen);
    if (idx < SCREEN_ORDER.length - 1) {
      goToScreen(SCREEN_ORDER[idx + 1]);
    }
  };

  const setAnswer = (questionId: string, value: string | string[]) => {
    setState(s => ({ ...s, answers: { ...s.answers, [questionId]: value } }));
  };

  const toggleMultiAnswer = (questionId: string, value: string) => {
    const current = (state.answers[questionId] as string[] | undefined) ?? [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setAnswer(questionId, next);
  };

  // ── Start quiz ──────────────────────────────────────────────────────────────

  const handleStart = async () => {
    try {
      const utms = getUtmParams();
      const { sessionId } = await startSession.mutateAsync(utms);
      setState(s => ({ ...s, sessionId }));
      goToScreen("age");
    } catch {
      // Still allow quiz to proceed without session
      setState(s => ({ ...s, sessionId: "local-" + Date.now() }));
      goToScreen("age");
    }
  };

  // ── Submit answers and get results ─────────────────────────────────────────

  const handleSubmitAnswers = async () => {
    if (!state.sessionId) return;
    try {
      const res = await submitAnswers.mutateAsync({
        sessionId: state.sessionId,
        answers: state.answers,
      });
        setState(s => ({
          ...s,
          result: res.result,
          product: res.product as ProductInfo,
          upsells: res.upsells as UpsellInfo[],
        }));
        // If couple, also store both individual SKUs
        const r = res as any;
        if (r.isCouple && r.himProduct && r.herProduct) {
          setCoupleProducts({ him: r.himProduct as ProductInfo, her: r.herProduct as ProductInfo });
        }
        goToScreen("email_capture");
    } catch (err: unknown) {
      // If submitAnswers fails, still allow progression with client-side routing
      // Use the answers we have to determine product client-side
      // NOTE: Bundle is not offered — couple/unknown defaults to Tantra Him
      const who = (state.answers["q_who"] as string) ?? "";
      const result = who === "me_female" ? "tantra_her" : "tantra_him";
      const PRODUCTS: Record<string, ProductInfo> = {
        tantra_him: {
          name: "Tantra Him",
          tagline: "Maximum Strength Formula for Men",
          headline: "Your life force is ready to come back online.",
          subheadline: "The East-West formula designed for men who are ready to feel fully alive again.",
          description: "Tantra Him combines Oxytocin (the bonding molecule), Bremelanotide (the arousal activator), and Tadalafil (the circulation enhancer) in a precision-compounded sublingual tablet — backed by 5,000 years of Taoist medicine and modern clinical science.",
          price: "$185",
          shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-him",
          primaryColor: "#B8860B",
        },
        tantra_her: {
          name: "Tantra Her",
          tagline: "Maximum Strength Formula for Women",
          headline: "Your life force is ready to come back online.",
          subheadline: "The East-West formula designed for women who are ready to feel fully alive again.",
          description: "Tantra Her combines Oxytocin (the bonding molecule), Bremelanotide (the arousal activator), and Tadalafil 5mg (the circulation enhancer) in a precision-compounded sublingual tablet — backed by 5,000 years of Taoist medicine and modern clinical science.",
          price: "$185",
          shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-her",
          primaryColor: "#9B59B6",
        },
      };
      setState(s => ({
        ...s,
        result,
        product: PRODUCTS[result],
        upsells: [],
      }));
      goToScreen("email_capture");
    }
  };

  // ── Capture email ───────────────────────────────────────────────────────────

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.email || !state.sessionId) return;
    try {
      const res = await captureEmail.mutateAsync({
        sessionId: state.sessionId,
        email: state.email,
        name: state.name || undefined,
      });
      setState(s => ({
        ...s,
        emailSubmitted: true,
        tantraCourse: (res as any).tantraCourse ?? null,
        lightsOn: (res as any).lightsOn ?? null,
      }));
      goToScreen("results");
    } catch {
      toast.error("Could not save your email. Please try again.");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={topRef}
      className="min-h-screen bg-[#0d0d0d] text-white font-sans"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      {/* Progress bar */}
      {state.screen !== "welcome" && state.screen !== "results" && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      )}

      {/* Header */}
      <header className="py-5 px-6 flex items-center justify-between border-b border-white/5 bg-[#0d0d0d]/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-900/40 border border-amber-700/40 flex items-center justify-center">
            <span className="text-amber-400 text-sm font-bold">UM</span>
          </div>
          <span className="text-white/80 text-sm tracking-wide">Dr. Pedram Shojai · The Urban Monk</span>
        </div>
        {state.screen !== "welcome" && state.screen !== "results" && (
          <span className="text-white/65 text-xs">{state.progress}% complete</span>
        )}
      </header>

      {/* ── SCREEN: WELCOME ── */}
      {state.screen === "welcome" && (
        <WelcomeScreen onStart={handleStart} isLoading={startSession.isPending} />
      )}

      {/* ── SCREEN: AGE ── */}
      {state.screen === "age" && (
        <SingleChoiceScreen
          question="How old are you?"
          options={[
            { id: "under30", text: "Under 30" },
            { id: "30_44", text: "30–44" },
            { id: "45_59", text: "45–59" },
            { id: "60plus", text: "60 or older" },
          ]}
          selected={state.answers["q_age"] as string}
          onSelect={v => { setAnswer("q_age", v); nextScreen(); }}
        />
      )}

      {/* ── SCREEN: WHO ── */}
      {state.screen === "who" && (
        <SingleChoiceScreen
          question="Are you taking this quiz for yourself, your partner, or both of you together?"
          subtext="This helps us personalize your results."
          options={[
            { id: "me_male", text: "For myself — I'm a man" },
            { id: "me_female", text: "For myself — I'm a woman" },
            { id: "couple", text: "We're doing this together as a couple" },
          ]}
          selected={state.answers["q_who"] as string}
          onSelect={v => { setAnswer("q_who", v); nextScreen(); }}
        />
      )}

      {/* ── SCREEN: VITALITY ── */}
      {state.screen === "vitality" && (
        <SingleChoiceScreen
          question="How would you describe your overall vitality and life force right now?"
          subtext="In Eastern medicine, vitality is your Jing — the root energy that powers everything."
          options={[
            { id: "depleted", text: "Depleted — I'm running on empty and I can feel it" },
            { id: "inconsistent", text: "Inconsistent — some days I feel alive, other days flat" },
            { id: "disconnected", text: "Physically okay but mentally and emotionally disconnected" },
            { id: "lost_spark", text: "I have energy but I've lost my spark and drive" },
          ]}
          selected={state.answers["q_vitality"] as string}
          onSelect={v => { setAnswer("q_vitality", v); nextScreen(); }}
        />
      )}

      {/* ── SCREEN: SEXUAL ENERGY ── */}
      {state.screen === "sexual_energy" && (
        <SingleChoiceScreen
          question="How has your sexual energy and desire felt over the past few months?"
          subtext="In Taoist medicine, sexual energy is your life force — not just about sex. It powers creativity, motivation, and aliveness."
          options={[
            { id: "much_lower", text: "Much lower than it used to be — I barely think about it" },
            { id: "desire_no_energy", text: "The desire is there but the energy to act on it isn't" },
            { id: "disconnected", text: "I feel disconnected from my body and my partner" },
            { id: "unpredictable", text: "My drive comes and goes unpredictably" },
          ]}
          selected={state.answers["q_sexual_energy"] as string}
          onSelect={v => { setAnswer("q_sexual_energy", v); nextScreen(); }}
        />
      )}

      {/* ── SCREEN: EDUCATION — NOT YOUR FAULT ── */}
      {state.screen === "edu_not_your_fault" && (
        <EducationScreen
          icon={<Shield className="w-10 h-10 text-amber-400" />}
          headline="This is not a willpower problem."
          body={[
            "Modern life systematically depletes the hormones and neurochemicals that drive desire, connection, and aliveness.",
            "Chronic stress floods your system with cortisol — which directly suppresses testosterone, estrogen, and oxytocin.",
            "Poor sleep, processed food, and constant overstimulation drain the root energy that Eastern medicine has called Jing for 5,000 years.",
            "You are not broken. Your biology is responding exactly as it was designed to — to a world it was never designed for.",
            "The question is: what do you do about it?",
          ]}
          ctaText="Continue"
          onCta={nextScreen}
        />
      )}

      {/* ── SCREEN: SYMPTOMS ── */}
      {state.screen === "symptoms" && (
        <MultiChoiceScreen
          question="Which of these do you experience? Select all that apply."
          subtext="This helps us identify the root cause — and the right path forward."
          options={[
            { id: "low_libido", text: "Low libido or reduced sexual desire" },
            { id: "fatigue", text: "Fatigue that doesn't go away with rest" },
            { id: "brain_fog", text: "Brain fog or difficulty concentrating" },
            { id: "poor_sleep", text: "Poor sleep or waking unrefreshed" },
            { id: "gut_issues", text: "Digestive issues, bloating, or gut discomfort" },
            { id: "oral_issues", text: "Gum sensitivity, mouth inflammation, or dental issues" },
            { id: "mood", text: "Mood swings, irritability, or anxiety" },
            { id: "disconnected", text: "Feeling disconnected from your partner or from intimacy" },
            { id: "creative_loss", text: "Loss of creative energy or motivation" },
            { id: "flat", text: "Feeling 'flat' — less alive than you used to feel" },
          ]}
          selected={(state.answers["q_symptoms"] as string[]) ?? []}
          onToggle={v => toggleMultiAnswer("q_symptoms", v)}
          onNext={nextScreen}
        />
      )}

      {/* ── SCREEN: CONNECTION ── */}
      {state.screen === "connection" && (
        <SingleChoiceScreen
          question="How would you describe your connection to intimacy and your partner right now?"
          options={[
            { id: "going_through_motions", text: "Disconnected — we're going through the motions" },
            { id: "want_close", text: "We want to feel close but something is blocking it" },
            { id: "cant_sustain", text: "We feel present sometimes but can't sustain it" },
            { id: "lost_play", text: "We've lost the sense of play and aliveness in our relationship" },
          ]}
          selected={state.answers["q_connection"] as string}
          onSelect={v => { setAnswer("q_connection", v); nextScreen(); }}
        />
      )}

      {/* ── SCREEN: EDUCATION — EAST-WEST ── */}
      {state.screen === "edu_east_west" && (
        <EducationScreen
          icon={<Leaf className="w-10 h-10 text-amber-400" />}
          headline="5,000 years of wisdom. Modern clinical science. One formula."
          body={[
            "I spent 10 years as a Taoist monk studying the traditions that treat sexual energy as the root of all vitality.",
            "Then I went to medical school. And I discovered that the ancient masters were right — they just didn't have the molecular biology to explain why.",
            "Oxytocin — the bonding molecule — is the neurochemical equivalent of what the Taoists called heart-opening.",
            "Bremelanotide activates the exact neural pathways that Tantric traditions have been stimulating through breathwork and meditation for millennia.",
            "The Tantra formula is the bridge I spent 20 years building.",
          ]}
          attribution="— Dr. Pedram Shojai, OMD · Physician · Former Taoist Monk · Author of The Urban Monk"
          ctaText="I'm ready to see my results"
          onCta={nextScreen}
        />
      )}

      {/* ── SCREEN: SAFETY ── */}
      {state.screen === "safety" && (
        <MultiChoiceScreen
          question="Do any of these apply to you?"
          subtext="This helps us make sure the Tantra formula is right for you. This is a prescription compound — your safety matters."
          options={[
            { id: "hormone_therapy", text: "Currently taking hormone therapy or prescription medications for sexual health" },
            { id: "hormone_condition", text: "Diagnosed with a hormone-sensitive condition" },
            { id: "pregnant", text: "Currently pregnant or nursing" },
            { id: "none", text: "None of these apply to me" },
          ]}
          selected={(state.answers["q_safety"] as string[]) ?? []}
          onToggle={v => {
            if (v === "none") {
              setAnswer("q_safety", ["none"]);
            } else {
              const current = (state.answers["q_safety"] as string[] | undefined) ?? [];
              const withoutNone = current.filter(x => x !== "none");
              const next = withoutNone.includes(v)
                ? withoutNone.filter(x => x !== v)
                : [...withoutNone, v];
              setAnswer("q_safety", next);
            }
          }}
          onNext={nextScreen}
          nextLabel="Continue"
        />
      )}

      {/* ── SCREEN: GOALS ── */}
      {state.screen === "goals" && (
        <MultiChoiceScreen
          question="What are you most hoping to restore? Select all that apply."
          options={[
            { id: "sexual_vitality", text: "Sexual desire and vitality" },
            { id: "physical_energy", text: "Physical energy and stamina" },
            { id: "emotional_connection", text: "Emotional connection with my partner" },
            { id: "mental_clarity", text: "Mental clarity and creative drive" },
            { id: "aliveness", text: "A sense of aliveness and presence" },
            { id: "relationship_spark", text: "Our relationship's spark and playfulness" },
            { id: "all", text: "All of the above" },
          ]}
          selected={(state.answers["q_goals"] as string[]) ?? []}
          onToggle={v => toggleMultiAnswer("q_goals", v)}
          onNext={() => {
            // After goals, submit answers and get routing
            handleSubmitAnswers();
          }}
          nextLabel="See my personalized results →"
          isLoading={submitAnswers.isPending}
        />
      )}

      {/* ── SCREEN: SOCIAL PROOF ── */}
      {state.screen === "social_proof" && (
        <SocialProofScreen onNext={nextScreen} />
      )}

      {/* ── SCREEN: EMAIL CAPTURE ── */}
      {state.screen === "email_capture" && (
        <EmailCaptureScreen
          product={state.product}
          email={state.email}
          name={state.name}
          onEmailChange={v => setState(s => ({ ...s, email: v }))}
          onNameChange={v => setState(s => ({ ...s, name: v }))}
          onSubmit={handleEmailSubmit}
          isLoading={captureEmail.isPending}
        />
      )}

      {/* ── SCREEN: RESULTS ── */}
      {state.screen === "results" && state.product && (
        <ResultsScreen
          product={state.product}
          upsells={state.upsells}
          result={state.result}
          tantraCourse={state.tantraCourse}
          lightsOn={state.lightsOn}
          coupleProducts={coupleProducts}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WelcomeScreen({ onStart, isLoading }: { onStart: () => void; isLoading: boolean }) {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col md:flex-row relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-900/15 rounded-full blur-[140px] pointer-events-none" />

      {/* LEFT: Doctor photo column */}
      <div className="relative md:w-[42%] flex-shrink-0 flex flex-col">
        {/* Photo fills the column */}
        <div className="relative h-[380px] md:h-full overflow-hidden">
          <img
            src="/manus-storage/pedram-shojai-doctor_657618c7.webp"
            alt="Dr. Pedram Shojai, OMD"
            className="w-full h-full object-cover object-top"
          />
          {/* INTRO VIDEO: Once recorded, replace photo above with Wistia embed.
              Set TANTRA_INTRO_VIDEO_ID to your Wistia media ID and swap the img for:
              <div className="wistia_embed wistia_async_TANTRA_INTRO_VIDEO_ID videoFoam=true h-full" />
          */}
          {/* Dark gradient overlay at bottom for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/30 to-transparent" />

          {/* Credential badge pinned to bottom of photo */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="bg-[#0d0d0d]/85 backdrop-blur-sm border border-amber-700/40 rounded-xl px-4 py-3">
              <p className="text-white font-bold text-base leading-tight">Dr. Pedram Shojai, OMD</p>
              <p className="text-amber-400 text-xs font-semibold tracking-wide mt-0.5">Doctor of Oriental Medicine</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                <span className="text-white/60 text-xs">Former Taoist Monk</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/60 text-xs">NYT Bestselling Author</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/60 text-xs">20+ Years Clinical Practice</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Copy + CTA column */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-8 md:px-12 py-12 md:py-16">
        {/* "From the desk of" label */}
        <p className="text-amber-500/80 text-xs font-semibold tracking-[0.15em] uppercase mb-5">
          A Message From Dr. Shojai
        </p>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5">
          Is Your Life Force<br />
          <span className="text-amber-400">Running on Empty?</span>
        </h1>

        <p className="text-white/85 text-base md:text-lg leading-relaxed mb-4 max-w-lg">
          I spent 10 years as a Taoist monk studying the traditions that treat sexual energy as the root of all vitality. What I found changed everything I knew about medicine.
        </p>

        <p className="text-white/75 text-sm md:text-base leading-relaxed mb-8 max-w-lg">
          This 2-minute quiz will identify exactly what's depleting your life force — and show you the East-West prescription formula I developed to restore it.
        </p>

        {/* ── INTRO VIDEO EMBED (activate when ready) ──
            1. Upload intro video to Wistia
            2. Replace TANTRA_INTRO_VIDEO_ID with your media ID (e.g. "abc123xyz")
            3. Uncomment the block below and delete this comment

        <div className="mb-8 rounded-xl overflow-hidden border border-amber-700/30" style={{aspectRatio:'16/9',maxWidth:'480px'}}>
          <div className="wistia_embed wistia_async_TANTRA_INTRO_VIDEO_ID videoFoam=true" style={{height:'100%',position:'relative'}}>&nbsp;</div>
        </div>
        ── */}

        {/* Credential pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="inline-flex items-center gap-1.5 bg-amber-900/25 border border-amber-700/35 rounded-full px-3 py-1 text-amber-300/90 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" /> Physician-Formulated
          </span>
          <span className="inline-flex items-center gap-1.5 bg-amber-900/25 border border-amber-700/35 rounded-full px-3 py-1 text-amber-300/90 text-xs font-medium">
            <Shield className="w-3 h-3" /> HIPAA Compliant
          </span>
          <span className="inline-flex items-center gap-1.5 bg-amber-900/25 border border-amber-700/35 rounded-full px-3 py-1 text-amber-300/90 text-xs font-medium">
            <Star className="w-3 h-3" /> Compounded by Strive Pharmacy
          </span>
        </div>

        <Button
          onClick={onStart}
          disabled={isLoading}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg px-10 py-6 rounded-full shadow-lg shadow-amber-900/40 transition-all duration-200 self-start"
        >
          {isLoading ? "Starting..." : "Take the Free Quiz →"}
        </Button>

        <p className="text-white/50 text-xs mt-4">
          Takes 2 minutes · No credit card required · Personalized results
        </p>
      </div>
    </div>
  );
}

function SingleChoiceScreen({
  question,
  subtext,
  options,
  selected,
  onSelect,
}: {
  question: string;
  subtext?: string;
  options: { id: string; text: string }[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3 leading-snug">
          {question}
        </h2>
        {subtext && (
          <p className="text-white/75 text-sm text-center mb-8 italic">{subtext}</p>
        )}
        {!subtext && <div className="mb-8" />}
        <div className="space-y-3">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-150 text-base ${
                selected === opt.id
                  ? "bg-amber-500/20 border-amber-500 text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  selected === opt.id ? "border-amber-500 bg-amber-500" : "border-white/30"
                }`}>
                  {selected === opt.id && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
                {opt.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MultiChoiceScreen({
  question,
  subtext,
  options,
  selected,
  onToggle,
  onNext,
  nextLabel = "Continue →",
  isLoading = false,
}: {
  question: string;
  subtext?: string;
  options: { id: string; text: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
  nextLabel?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-start px-6 py-12">
      <div className="w-full max-w-xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3 leading-snug">
          {question}
        </h2>
        {subtext && (
          <p className="text-white/75 text-sm text-center mb-8 italic">{subtext}</p>
        )}
        {!subtext && <div className="mb-8" />}
        <div className="space-y-3 mb-8">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-150 text-base ${
                selected.includes(opt.id)
                  ? "bg-amber-500/20 border-amber-500 text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  selected.includes(opt.id) ? "border-amber-500 bg-amber-500" : "border-white/30"
                }`}>
                  {selected.includes(opt.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
                {opt.text}
              </span>
            </button>
          ))}
        </div>
        <Button
          onClick={onNext}
          disabled={selected.length === 0 || isLoading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-base py-5 rounded-xl"
        >
          {isLoading ? "Analyzing your answers..." : nextLabel}
        </Button>
      </div>
    </div>
  );
}

function EducationScreen({
  icon,
  headline,
  body,
  attribution,
  ctaText,
  onCta,
}: {
  icon: React.ReactNode;
  headline: string;
  body: string[];
  attribution?: string;
  ctaText: string;
  onCta: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl mx-auto text-center">
        <div className="flex justify-center mb-6">{icon}</div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-snug">{headline}</h2>
        <div className="space-y-4 text-left mb-10">
          {body.map((paragraph, i) => (
            <p key={i} className="text-white/90 text-base leading-relaxed">{paragraph}</p>
          ))}
          {attribution && (
            <p className="text-amber-400/70 text-sm italic mt-6">{attribution}</p>
          )}
        </div>
        <Button
          onClick={onCta}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-base px-8 py-5 rounded-xl w-full"
        >
          {ctaText}
        </Button>
      </div>
    </div>
  );
}

function SocialProofScreen({ onNext }: { onNext: () => void }) {
  const testimonials = [
    {
      quote: "I didn't realize how much I'd lost until I started getting it back. By week three I felt like myself again — actually present with my wife for the first time in years.",
      name: "Michael R., 52",
      detail: "Executive, San Francisco",
    },
    {
      quote: "I was skeptical. I'm a physician myself. But the East-West framing made sense to me in a way that nothing else had. The results were undeniable.",
      name: "Dr. Sarah K., 47",
      detail: "Internal Medicine",
    },
    {
      quote: "We did this together. It changed our relationship in ways I didn't think were possible after 18 years of marriage.",
      name: "Jennifer & David T.",
      detail: "Married 18 years",
    },
  ];

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <h2 className="text-2xl font-bold text-white">You're almost there.</h2>
          <p className="text-white/75 text-sm mt-2">Here's what others discovered when they took this step.</p>
        </div>
        <div className="space-y-4 mb-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-white/80 text-sm italic leading-relaxed mb-3">"{t.quote}"</p>
              <div>
                <p className="text-amber-400 text-sm font-semibold">{t.name}</p>
                <p className="text-white/65 text-xs">{t.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={onNext}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-base py-5 rounded-xl"
        >
          See My Personalized Results →
        </Button>
      </div>
    </div>
  );
}

function EmailCaptureScreen({
  product,
  email,
  name,
  onEmailChange,
  onNameChange,
  onSubmit,
  isLoading,
}: {
  product: ProductInfo | null;
  email: string;
  name: string;
  onEmailChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}) {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md mx-auto text-center">
        {/* Teaser */}
        <div className="w-16 h-16 rounded-full bg-amber-900/30 border border-amber-700/40 flex items-center justify-center mx-auto mb-6">
          <Zap className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Your results are ready.
        </h2>
        <p className="text-white/85 text-base mb-2">
          {product
            ? `Based on your answers, we've identified the right formula for you.`
            : `Based on your answers, we've personalized your recommendations.`}
        </p>
        <p className="text-white/65 text-sm mb-8 italic">
          Enter your email to see your personalized results — and to receive Dr. Shojai's free guide on restoring your life force.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="First name (optional)"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            className="bg-white/5 border-white/20 text-white placeholder:text-white/85 py-5 text-base rounded-xl"
          />
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            required
            className="bg-white/5 border-white/20 text-white placeholder:text-white/85 py-5 text-base rounded-xl"
          />
          <Button
            type="submit"
            disabled={!email || isLoading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-base py-5 rounded-xl"
          >
            {isLoading ? "Loading your results..." : "Show Me My Results →"}
          </Button>
        </form>

        <p className="text-white/55 text-xs mt-4">
          We respect your privacy. Unsubscribe at any time. Your information is never sold.
        </p>
      </div>
    </div>
  );
}

function ResultsScreen({
  product,
  upsells,
  result,
  tantraCourse,
  lightsOn,
  coupleProducts,
}: {
  product: ProductInfo;
  upsells: UpsellInfo[];
  result: string | null;
  tantraCourse: CourseInfo | null;
  lightsOn: CourseInfo | null;
  coupleProducts: CoupleProducts | null;
}) {
  const isCouple = !!coupleProducts;
  const accentColor = result === "tantra_her" ? "#9B59B6" : "#B8860B";

  // ── Urgency timer (20 minutes) ──────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 min in seconds
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const timerMins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const timerSecs = String(timeLeft % 60).padStart(2, "0");
  const timerExpired = timeLeft === 0;

  // ── Exit intent popup ───────────────────────────────────────────────────────
  const [showExitPopup, setShowExitPopup] = useState(false);
  const exitFired = useRef(false);
  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (!exitFired.current && e.clientY <= 0) {
      exitFired.current = true;
      setShowExitPopup(true);
    }
  }, []);
  useEffect(() => {
    document.addEventListener("mouseleave", handleMouseLeave);
    // Mobile: show after 45s of no interaction
    const mobileTimer = setTimeout(() => {
      if (!exitFired.current) {
        exitFired.current = true;
        setShowExitPopup(true);
      }
    }, 45000);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      clearTimeout(mobileTimer);
    };
  }, [handleMouseLeave]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-32">

      {/* ── EXIT INTENT POPUP ── */}
      {showExitPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="bg-[#141414] border border-amber-700/40 rounded-2xl p-8 max-w-md w-full text-center relative shadow-2xl">
            <button onClick={() => setShowExitPopup(false)} className="absolute top-4 right-4 text-white/40 hover:text-white/70 text-xl leading-none">✕</button>
            <div className="w-14 h-14 rounded-full bg-amber-900/30 border border-amber-700/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌿</span>
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Before you go…</h3>
            <p className="text-white/80 text-sm mb-4 leading-relaxed">
              Dr. Shojai spent 10 years as a Taoist monk studying what depletes life force — and how to restore it. Your quiz results are personalized to your exact pattern.
            </p>
            <p className="text-amber-400 text-sm font-semibold mb-5">Your protocol is still reserved for the next {timerMins}:{timerSecs}.</p>
            <a href={product.shopifyUrl} target="_blank" rel="noopener noreferrer" onClick={() => setShowExitPopup(false)}
              className="block w-full text-center font-bold text-base py-4 rounded-xl text-black mb-3" style={{ background: accentColor }}>
              Start My Protocol — {product.price}/mo →
            </a>
            <button onClick={() => setShowExitPopup(false)} className="text-white/45 text-xs hover:text-white/65">
              No thanks, I'll pass on restoring my vitality
            </button>
          </div>
        </div>
      )}

      {/* ── STICKY URGENCY BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between gap-4"
        style={{ background: "#0d0d0d", borderTop: `1px solid ${accentColor}40` }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: `${accentColor}30`, border: `1px solid ${accentColor}60` }}>⏱</div>
          <p className="text-white/85 text-xs">
            {timerExpired
              ? "Your results are still available — start your protocol today."
              : <><span className="font-bold" style={{ color: accentColor }}>{timerMins}:{timerSecs}</span>{" — Your personalized protocol is reserved"}</>}
          </p>
        </div>
        <a href={product.shopifyUrl} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 font-bold text-xs px-4 py-2 rounded-full text-black whitespace-nowrap"
          style={{ background: accentColor }}>Start Now →</a>
      </div>

      {/* Hero result banner */}
      <div
        className="py-16 px-6 text-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, #0d0d0d 60%)` }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[100px] opacity-30 pointer-events-none"
          style={{ background: accentColor }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white/90 text-sm mb-6">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            Your personalized results are ready
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            {product.headline}
          </h1>
          <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
            {product.subheadline}
          </p>

          {/* ── PERSONALIZED RESULTS VIDEO ──
              Shows a different video for Tantra Him vs Tantra Her vs Couple.
              To activate:
                1. Record 2 videos (one for men, one for women) and upload to Wistia
                2. Replace the placeholder IDs below with your real Wistia media IDs:
                     TANTRA_HIM_VIDEO_ID  → e.g. "abc123him"
                     TANTRA_HER_VIDEO_ID  → e.g. "xyz789her"
                3. Delete the comment tags around the block below

          {(() => {
            const videoId = isCouple
              ? "TANTRA_HIM_VIDEO_ID"
              : result === "tantra_her"
              ? "TANTRA_HER_VIDEO_ID"
              : "TANTRA_HIM_VIDEO_ID";
            return (
              <div className="mb-8 rounded-2xl overflow-hidden border border-white/10 max-w-2xl mx-auto" style={{aspectRatio:'16/9'}}>
                <script src="https://fast.wistia.com/assets/external/E-v1.js" async></script>
                <div className={`wistia_embed wistia_async_${videoId} videoFoam=true`} style={{height:'100%',position:'relative'}}>&nbsp;</div>
              </div>
            );
          })()}
          ── */}

          {/* Product card */}
          {isCouple && coupleProducts ? (
            /* ── COUPLE: show Him + Her as two separate cards ── */
            <div className="max-w-2xl mx-auto mb-8">
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-5 py-3 mb-5 text-sm text-amber-200 text-center">
                ⚕️ <strong>Each person completes their own intake separately</strong> — required for HIPAA-compliant telemedicine prescribing.
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { p: coupleProducts.him, accent: "#B8860B", tadalafil: "Tadalafil 20mg" },
                  { p: coupleProducts.her, accent: "#9B59B6", tadalafil: "Tadalafil 5mg" },
                ].map(({ p, accent, tadalafil }) => (
                  <div key={p.name} className="bg-white/5 border rounded-2xl p-5 text-left" style={{ borderColor: `${accent}60` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold text-white">{p.name}</h2>
                        <p className="text-white/70 text-xs">{p.tagline}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold" style={{ color: accent }}>{p.price}</p>
                        <p className="text-white/55 text-xs">per month</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {[
                        { name: "Oxytocin 40IU", role: "Bonding molecule" },
                        { name: "Bremelanotide 2mg", role: "Arousal activator" },
                        { name: tadalafil, role: "Circulation enhancer" },
                      ].map((ing, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: accent }} />
                          <span className="text-white/85 text-xs"><strong>{ing.name}</strong> — {ing.role}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 mb-4">
                      <p className="text-white/65 text-xs">📦 Ships under <strong className="text-white/80">Olympus</strong> brand from Strive Pharmacy.</p>
                    </div>
                    <a
                      href={p.shopifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center font-bold text-sm py-3.5 rounded-xl text-black"
                      style={{ background: accent }}
                    >
                      Get {p.name} — {p.price}/mo →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── SINGLE: standard individual product card ── */
            <div className="bg-white/5 border rounded-2xl p-6 text-left max-w-lg mx-auto mb-8" style={{ borderColor: `${accentColor}60` }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{product.name}</h2>
                  <p className="text-white/75 text-sm">{product.tagline}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: accentColor }}>{product.price}</p>
                  <p className="text-white/65 text-xs">per month</p>
                </div>
              </div>
              <p className="text-white/90 text-sm leading-relaxed mb-5">{product.description}</p>
              <div className="space-y-2 mb-5">
                {[
                  { name: "Oxytocin 40IU", role: "The bonding molecule — restores emotional connection and trust" },
                  { name: "Bremelanotide 2mg", role: "The arousal activator — reawakens desire at the neurological level" },
                  { name: result === "tantra_her" ? "Tadalafil 5mg" : "Tadalafil 20mg", role: "The circulation enhancer — supports physical response and sensitivity" },
                ].map((ingredient, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: accentColor }} />
                    <div>
                      <span className="text-white text-sm font-semibold">{ingredient.name}</span>
                      <span className="text-white/75 text-sm"> — {ingredient.role}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-lg p-3 mb-5">
                <p className="text-white/75 text-xs">
                  📦 <strong className="text-white/90">Shipping note:</strong> Your order ships under the <strong className="text-white/90">Olympus</strong> brand name from Strive Pharmacy — same formula, same quality.
                </p>
              </div>
              <a
                href={product.shopifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center font-bold text-base py-4 rounded-xl transition-all duration-200 text-black"
                style={{ background: accentColor }}
              >
                Get {product.name} — {product.price}/mo →
              </a>
            </div>
          )}

          {/* Doctor credibility */}
          <div className="text-center text-white/65 text-sm">
            <p>Formulated by Dr. Pedram Shojai, OMD</p>
            <p className="text-xs mt-1">Physician · Former Taoist Monk · Author of The Urban Monk · Trained in Tantric Traditions</p>
          </div>
        </div>
      </div>

      {/* Tantra Course upsell */}
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-700/30 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center flex-shrink-0">
              <Heart className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-lg">The Tantra Course</h3>
              </div>
              <p className="text-white/85 text-sm mb-3">
                The ancient practices that amplify everything the formula does. Breathwork, meditation, and the Taoist principles of sexual vitality — taught by Dr. Shojai from 20 years of study.
              </p>
              <p className="text-white/65 text-xs mb-3">$199</p>
              <a
                href={(tantraCourse?.shopifyUrl) ?? "https://shop.theurbanmonk.com/products/1710780"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors"
              >
                Learn more about The Tantra Course <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Conditional upsells */}
        {upsells.length > 0 && (
          <div className="mb-8">
            <h3 className="text-white font-bold text-lg mb-2">Based on your symptoms, we also recommend:</h3>
            <p className="text-white/75 text-sm mb-5">Your quiz answers flagged some root-cause issues that the Tantra formula alone won't address. These tests identify exactly what's driving your symptoms.</p>
            <div className="space-y-4">
              {upsells.map((upsell, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-semibold mb-1">{upsell.name}</h4>
                      <p className="text-white/85 text-sm mb-3">{upsell.description}</p>
                      {upsell.shopifyUrl && (
                        <a
                          href={upsell.shopifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors"
                        >
                          Order {upsell.name} <ChevronRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-white font-bold">{upsell.price}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lights On upsell */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-1">{lightsOn?.name ?? "Lights On"}</h3>
              <p className="text-white/75 text-xs mb-1 uppercase tracking-wide">{lightsOn?.tagline ?? "The Complete Vitality System"}</p>
              <p className="text-white/85 text-sm mb-3">
                {lightsOn?.description ?? "Everything works better when your energy system is optimized. Lights On is Dr. Shojai's complete program for rebuilding your life force from the ground up — sleep, gut, hormones, mindset, and sexual vitality all in one place."}
              </p>
              <p className="text-white/65 text-xs mb-3">{lightsOn?.price ?? "$369/year"} · 30-day money-back guarantee</p>
              <a
                href={(lightsOn?.shopifyUrl) ?? "https://shop.theurbanmonk.com/products/lights-on"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors"
              >
                Learn more about Lights On <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* ── SOCIAL PROOF ── */}
        <div className="mb-8">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest text-center mb-5">What others are experiencing</h3>
          <div className="space-y-4">
            {[
              { name: "Michael R., 52", text: "I was skeptical — I've tried everything. Three weeks in and I feel like myself again. The difference is real.", stars: 5 },
              { name: "Sandra K., 47", text: "I didn't realize how disconnected I'd become until I started feeling connected again. This changed something fundamental.", stars: 5 },
              { name: "David T., 58", text: "My wife noticed before I did. That says everything.", stars: 5 },
            ].map((t, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-white/85 text-sm italic mb-2">"{t.text}"</p>
                <p className="text-white/50 text-xs">— {t.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <a
            href={product.shopifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-lg px-10 py-5 rounded-full text-black transition-all duration-200 shadow-lg"
            style={{ background: accentColor, boxShadow: `0 8px 32px ${accentColor}40` }}
          >
            Start My Protocol — {product.price}/mo <ArrowRight className="w-5 h-5" />
          </a>
          <p className="text-white/75 text-xs mt-3">Prescription required · Compounded by Strive Pharmacy · Ships discreetly</p>
          <p className="text-white/50 text-xs mt-1">Your protocol expires in {timerMins}:{timerSecs}</p>
        </div>
      </div>
    </div>
  );
}
