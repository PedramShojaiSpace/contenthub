import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, HeartPulse, Leaf, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type QuizScreen = "welcome" | "questions" | "results";
type AnswerValue = string | string[];
type ProductKey = "tantra_him" | "tantra_her" | "pending";

type Product = {
  name: string;
  tagline: string;
  headline: string;
  subheadline: string;
  description: string;
  price: string;
  shopifyUrl: string;
  primaryColor: string;
};

type Question = {
  id: "q_pathway" | "q_focus" | "q_recovery" | "q_goal" | "q_safety";
  type: "single" | "multi";
  eyebrow: string;
  question: string;
  helper?: string;
  options: { id: string; text: string }[];
};

const QUESTIONS: Question[] = [
  {
    id: "q_pathway",
    type: "single",
    eyebrow: "START HERE",
    question: "Which product pathway are you exploring?",
    helper: "Choose the pathway that best fits the person considering care.",
    options: [
      { id: "men", text: "Men’s pathway" },
      { id: "women", text: "Women’s pathway" },
      { id: "not_sure", text: "I’m not sure which pathway fits" },
    ],
  },
  {
    id: "q_focus",
    type: "multi",
    eyebrow: "THE WHOLE SYSTEM",
    question: "What feels most out of rhythm right now?",
    helper: "Choose any that feel relevant. This is a check-in, not a diagnosis.",
    options: [
      { id: "desire", text: "Desire or sexual interest" },
      { id: "energy", text: "Energy and stamina" },
      { id: "responsiveness", text: "Feeling present and responsive in my body" },
      { id: "stress", text: "Stress load or difficulty unwinding" },
      { id: "connection", text: "Connection or ease with intimacy" },
    ],
  },
  {
    id: "q_recovery",
    type: "single",
    eyebrow: "RECOVERY",
    question: "How has your recovery capacity felt lately?",
    helper: "Desire does not live apart from sleep, stress, nourishment, movement, and overall resilience.",
    options: [
      { id: "steady", text: "Mostly steady" },
      { id: "inconsistent", text: "Inconsistent — I have good and flat days" },
      { id: "running_low", text: "I feel like I am running low most of the time" },
      { id: "not_sure", text: "I’m not sure" },
    ],
  },
  {
    id: "q_goal",
    type: "multi",
    eyebrow: "YOUR INTENTION",
    question: "What would you most like to support?",
    options: [
      { id: "desire", text: "A more connected sense of desire" },
      { id: "confidence", text: "Confidence and presence" },
      { id: "connection", text: "Connection with my partner" },
      { id: "vitality", text: "Overall vitality and resilience" },
    ],
  },
  {
    id: "q_safety",
    type: "multi",
    eyebrow: "A RESPONSIBLE PAUSE",
    question: "Is there any reason to speak with a qualified clinician before considering a product?",
    helper: "This does not determine eligibility or provide medical advice. It simply helps identify when a clinical conversation should come first.",
    options: [
      { id: "pregnant_or_nursing", text: "Pregnant or nursing" },
      { id: "nitrate_medication", text: "Taking nitrate medication" },
      { id: "cardiovascular_concern", text: "A cardiovascular condition or uncontrolled blood pressure that concerns me" },
      { id: "not_sure", text: "I’m not sure" },
      { id: "none", text: "None of these apply to me" },
    ],
  },
];

const FALLBACK_PRODUCTS: Record<Exclude<ProductKey, "pending">, Product> = {
  tantra_him: {
    name: "Tantra Him",
    tagline: "A clinical pathway for established male patients",
    headline: "Explore the Tantra Him pathway with the clinical team.",
    subheadline: "A licensed clinician reviews your history and determines whether any product is appropriate.",
    description: "Prescription compounded medication for established patients only. A valid prescription and clinical history review are required before dispensing.",
    price: "$185",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-him",
    primaryColor: "#164E63",
  },
  tantra_her: {
    name: "Tantra Her",
    tagline: "A clinical pathway for established female patients",
    headline: "Explore the Tantra Her pathway with the clinical team.",
    subheadline: "A licensed clinician reviews your history and determines whether any product is appropriate.",
    description: "Prescription compounded medication for established patients only. A valid prescription and clinical history review are required before dispensing.",
    price: "$185",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-her",
    primaryColor: "#7C2D12",
  },
};

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
  };
}

function localRoute(answers: Record<string, AnswerValue>) {
  const pathway = answers.q_pathway;
  const safety = Array.isArray(answers.q_safety) ? answers.q_safety : [];
  const reviewReasons = ["pregnant_or_nursing", "nitrate_medication", "cardiovascular_concern", "not_sure"];
  const requiresClinicalReview = pathway === "not_sure" || safety.some((answer) => reviewReasons.includes(answer));
  const result: ProductKey = requiresClinicalReview
    ? "pending"
    : pathway === "women"
      ? "tantra_her"
      : "tantra_him";

  return { result, requiresClinicalReview };
}

export default function TantraQuiz() {
  const [screen, setScreen] = useState<QuizScreen>("welcome");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [result, setResult] = useState<ProductKey>("pending");
  const [product, setProduct] = useState<Product | null>(null);
  const [requiresClinicalReview, setRequiresClinicalReview] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const startSession = trpc.tantraQuiz.startSession.useMutation();
  const submitAnswers = trpc.tantraQuiz.submitAnswers.useMutation();
  const captureEmail = trpc.tantraQuiz.captureEmail.useMutation();

  const currentQuestion = QUESTIONS[questionIndex];
  const selected = answers[currentQuestion?.id];
  const canContinue = Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
  const progress = Math.round(((questionIndex + 1) / QUESTIONS.length) * 100);

  const focusSummary = useMemo(() => {
    const selectedFocuses = Array.isArray(answers.q_focus) ? answers.q_focus : [];
    const selectedGoals = Array.isArray(answers.q_goal) ? answers.q_goal : [];
    const labels = QUESTIONS.flatMap((question) => question.options)
      .filter((option) => selectedFocuses.includes(option.id) || selectedGoals.includes(option.id))
      .map((option) => option.text.toLowerCase());
    return [...new Set(labels)].slice(0, 3);
  }, [answers.q_focus, answers.q_goal]);

  const start = async () => {
    try {
      const response = await startSession.mutateAsync(getUtmParams());
      setSessionId(response.sessionId);
    } catch {
      setSessionId(`local-${Date.now()}`);
      toast.message("You can still take the check-in. Results will appear immediately.");
    }
    setScreen("questions");
  };

  const selectSingle = (value: string) => {
    setAnswers((current) => ({ ...current, [currentQuestion.id]: value }));
  };

  const toggleMulti = (value: string) => {
    const current = Array.isArray(selected) ? selected : [];
    let next: string[];
    if (value === "none") {
      next = ["none"];
    } else {
      const withoutNone = current.filter((item) => item !== "none");
      next = withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
    }
    setAnswers((currentAnswers) => ({ ...currentAnswers, [currentQuestion.id]: next }));
  };

  const finish = async () => {
    const fallback = localRoute(answers);
    let nextResult = fallback.result;
    let nextProduct = fallback.result === "pending" ? null : FALLBACK_PRODUCTS[fallback.result];
    let nextClinicalReview = fallback.requiresClinicalReview;

    if (sessionId && !sessionId.startsWith("local-")) {
      try {
        const response = await submitAnswers.mutateAsync({ sessionId, answers });
        nextResult = response.result as ProductKey;
        nextProduct = response.product as Product | null;
        nextClinicalReview = response.requiresClinicalReview;
      } catch {
        toast.message("Your results are ready. The secure save was unavailable, so nothing was sent anywhere.");
      }
    }

    setResult(nextResult);
    setProduct(nextProduct);
    setRequiresClinicalReview(nextClinicalReview);
    setScreen("results");
  };

  const advance = () => {
    if (!canContinue) return;
    if (questionIndex === QUESTIONS.length - 1) {
      void finish();
      return;
    }
    setQuestionIndex((current) => current + 1);
  };

  const back = () => {
    if (questionIndex === 0) {
      setScreen("welcome");
      return;
    }
    setQuestionIndex((current) => current - 1);
  };

  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId || sessionId.startsWith("local-")) {
      toast.error("Your private check-in could not be saved right now. Your results are still available here.");
      return;
    }

    try {
      await captureEmail.mutateAsync({
        sessionId,
        email,
        name: name.trim() || undefined,
        newsletterConsent,
      });
      setEmailSaved(true);
    } catch {
      toast.error("We could not save your details. No email was sent and no subscription was created.");
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f0e7] text-[#183334] selection:bg-[#b6d7c9] selection:text-[#183334]">
      <header className="border-b border-[#183334]/10 bg-[#f4f0e7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#183334] text-xs font-black tracking-tight text-[#f4f0e7]">UM</div>
            <div>
              <p className="font-serif text-base font-semibold leading-none text-[#183334]">The Urban Monk</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#52706b]">Desire & Vitality Check-In</p>
            </div>
          </div>
          <p className="hidden text-right text-xs leading-5 text-[#52706b] sm:block">Educational check-in<br />Not medical advice</p>
        </div>
      </header>

      {screen === "welcome" && (
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#bdd8c7]/55 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-[#e4c8aa]/55 blur-3xl" />
          <div className="relative mx-auto grid min-h-[calc(100vh-82px)] max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#183334]/15 bg-white/55 px-4 py-2 text-xs font-semibold text-[#31534f]">
                <HeartPulse className="h-4 w-4" /> A two-minute whole-system check-in
              </div>
              <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[.98] tracking-[-0.035em] text-[#183334] sm:text-6xl lg:text-7xl">
                Your desire is part of the whole system.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#365552] sm:text-xl">
                Desire is not a character trait and it is not separate from your body. Energy, recovery, stress, connection, and a thoughtful clinical conversation can all matter.
              </p>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#52706b]">
                Dr. Pedram Shojai’s functional-medicine perspective starts with the person, not a promise. This check-in helps you choose the right pathway to explore next.
              </p>
              <button
                type="button"
                onClick={() => void start()}
                disabled={startSession.isPending}
                className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#183334] px-7 py-4 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#244744] disabled:cursor-wait disabled:opacity-70"
              >
                {startSession.isPending ? "Opening your check-in…" : "Start the free check-in"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-4 text-xs leading-5 text-[#52706b]">Results appear immediately. No purchase. No automatic email enrollment.</p>
            </div>

            <aside className="border border-[#183334]/10 bg-[#183334] p-7 text-[#f4f0e7] shadow-[20px_20px_0_#d9e7dc] sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b6d7c9]">The Urban Monk approach</p>
              <div className="mt-8 space-y-7">
                {[
                  ["01", "Look at the foundations", "Sleep, stress regulation, nourishment, movement, and recovery shape the context in which desire lives."],
                  ["02", "Name the real intention", "The goal may be greater presence, confidence, connection, or a more resilient sense of vitality."],
                  ["03", "Choose a responsible next step", "A quiz never determines treatment. A qualified clinician determines suitability for any prescription product."],
                ].map(([number, title, description]) => (
                  <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-white/15 pt-5 first:border-t-0 first:pt-0">
                    <span className="font-serif text-2xl text-[#b6d7c9]">{number}</span>
                    <div>
                      <h2 className="text-base font-semibold">{title}</h2>
                      <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}

      {screen === "questions" && currentQuestion && (
        <section className="mx-auto flex min-h-[calc(100vh-82px)] max-w-3xl flex-col justify-center px-5 py-12 sm:px-8">
          <div className="mb-10">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#52706b]">
              <span>Question {questionIndex + 1} of {QUESTIONS.length}</span>
              <span>{progress}% complete</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#183334]/10">
              <div className="h-full rounded-full bg-[#4e7b6e] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="border border-[#183334]/10 bg-white/75 p-6 shadow-[10px_10px_0_#d9e7dc] sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52706b]">{currentQuestion.eyebrow}</p>
            <h1 className="mt-4 max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#183334] sm:text-4xl">{currentQuestion.question}</h1>
            {currentQuestion.helper && <p className="mt-4 max-w-2xl text-base leading-7 text-[#52706b]">{currentQuestion.helper}</p>}

            <div className="mt-8 space-y-3">
              {currentQuestion.options.map((option) => {
                const isSelected = Array.isArray(selected) ? selected.includes(option.id) : selected === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => currentQuestion.type === "single" ? selectSingle(option.id) : toggleMulti(option.id)}
                    className={`flex w-full items-center gap-4 border px-5 py-4 text-left text-base transition ${
                      isSelected
                        ? "border-[#183334] bg-[#d9e7dc] text-[#183334]"
                        : "border-[#183334]/15 bg-[#fdfbf6] text-[#365552] hover:border-[#4e7b6e] hover:bg-[#eff5ee]"
                    }`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center border ${isSelected ? "border-[#183334] bg-[#183334]" : "border-[#7c9690] bg-white"}`}>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </span>
                    <span>{option.text}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
              <button type="button" onClick={back} className="inline-flex items-center gap-2 text-sm font-bold text-[#365552] hover:text-[#183334]">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={advance}
                disabled={!canContinue || submitAnswers.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-[#183334] px-6 py-3 font-bold text-white transition hover:bg-[#244744] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {questionIndex === QUESTIONS.length - 1 ? (submitAnswers.isPending ? "Preparing results…" : "See my check-in") : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "results" && (
        <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#d9e7dc] text-[#183334]"><Sparkles className="h-6 w-6" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#52706b]">Your starting point</p>
            <h1 className="mt-3 font-serif text-4xl font-semibold tracking-[-0.03em] text-[#183334] sm:text-5xl">
              {requiresClinicalReview ? "Begin with a clinical conversation." : "Start with your whole-system context."}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#365552]">
              {requiresClinicalReview
                ? "Based on the information you chose, it is more responsible to speak with a qualified clinician before considering a product. This check-in cannot determine eligibility or diagnose a condition."
                : "The answers you selected point back to the same starting place: desire is shaped by the wider system. Recovery, stress regulation, connection, and a suitable clinical conversation can all be part of the picture."}
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <article className="border border-[#183334]/10 bg-white p-7 shadow-[12px_12px_0_#d9e7dc] sm:p-9">
              <div className="flex items-start gap-4">
                <Leaf className="mt-1 h-6 w-6 shrink-0 text-[#4e7b6e]" />
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-[#183334]">What to carry forward</h2>
                  <p className="mt-3 leading-7 text-[#365552]">
                    You do not have to reduce this to one symptom or one answer. Start with the foundations that make the body more resilient, then make room for an honest clinical conversation when it is appropriate.
                  </p>
                  {focusSummary.length > 0 && <p className="mt-5 border-l-2 border-[#8eaa9f] pl-4 text-sm leading-6 text-[#52706b]">You named: {focusSummary.join(", ")}.</p>}
                </div>
              </div>
            </article>

            <aside className="border border-[#183334]/10 bg-[#183334] p-7 text-[#f4f0e7] sm:p-9">
              <ShieldCheck className="h-7 w-7 text-[#b6d7c9]" />
              <h2 className="mt-5 font-serif text-2xl font-semibold">A clear boundary</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">This is an educational check-in. It does not diagnose, prescribe, or determine whether any product is appropriate for you.</p>
              <p className="mt-4 text-sm leading-6 text-white/75">Prescription products require a qualified clinician’s independent review of your history.</p>
            </aside>
          </div>

          {!requiresClinicalReview && product && (
            <section className="mt-8 border border-[#183334]/10 bg-[#eaf2eb] p-7 sm:p-9" style={{ borderTopWidth: 5, borderTopColor: product.primaryColor }}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52706b]">Your selected pathway</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-[#183334]">{product.name}</h2>
              <p className="mt-2 font-semibold text-[#365552]">{product.tagline}</p>
              <p className="mt-5 max-w-3xl leading-7 text-[#365552]">{product.subheadline}</p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#52706b]">{product.description}</p>
              <a
                href={product.shopifyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#183334] px-6 py-3.5 font-bold text-white transition hover:bg-[#244744]"
              >
                Explore {product.name} with the clinical team <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-4 text-xs leading-5 text-[#52706b]">Prescription required. Product suitability is determined by a qualified clinician—not this quiz.</p>
            </section>
          )}

          {requiresClinicalReview && (
            <section className="mt-8 border border-[#183334]/10 bg-[#eaf2eb] p-7 sm:p-9">
              <h2 className="font-serif text-3xl font-semibold text-[#183334]">The responsible next step is clarity.</h2>
              <p className="mt-4 max-w-3xl leading-7 text-[#365552]">Please do not use this quiz to decide whether a prescription product is appropriate. Review your history, medications, and questions with a qualified clinician before you explore either pathway.</p>
              <a href="mailto:support@theurbanmonk.com?subject=Desire%20%26%20Vitality%20Check-In%20Question" className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#183334] px-6 py-3.5 font-bold text-[#183334] transition hover:bg-[#183334] hover:text-white">
                Ask the clinical team a question <ArrowRight className="h-4 w-4" />
              </a>
            </section>
          )}

          <section className="mt-10 border-t border-[#183334]/10 pt-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52706b]">Optional</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-[#183334]">Save this check-in for yourself</h2>
              <p className="mt-3 leading-7 text-[#365552]">Your results are already on screen. If you would like us to retain a simple record of this check-in, you may enter your email below. We will not automatically enroll you in a campaign or use your answers in advertising.</p>
            </div>

            {emailSaved ? (
              <div className="mt-6 flex items-start gap-3 border border-[#8eaa9f] bg-[#eff5ee] p-5 text-[#183334]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">Saved. Your check-in details were recorded without triggering an email, purchase, CRM enrollment, or advertising audience update.</p>
              </div>
            ) : (
              <form onSubmit={saveEmail} className="mt-6 grid max-w-2xl gap-4 rounded-none border border-[#183334]/10 bg-white p-6 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#365552]">
                  First name <span className="font-normal text-[#52706b]">(optional)</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="border border-[#183334]/20 bg-[#fdfbf6] px-3 py-3 font-normal outline-none focus:border-[#4e7b6e]" autoComplete="given-name" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#365552]">
                  Email address
                  <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="border border-[#183334]/20 bg-[#fdfbf6] px-3 py-3 font-normal outline-none focus:border-[#4e7b6e]" autoComplete="email" />
                </label>
                <label className="sm:col-span-2 flex items-start gap-3 text-sm leading-6 text-[#52706b]">
                  <input type="checkbox" checked={newsletterConsent} onChange={(event) => setNewsletterConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#183334]" />
                  <span>I would also like the Urban Monk newsletter. This checkbox records my preference only; it does not automatically enroll me in an email flow.</span>
                </label>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                  <button type="submit" disabled={captureEmail.isPending} className="inline-flex items-center gap-2 rounded-full bg-[#183334] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#244744] disabled:opacity-60">
                    {captureEmail.isPending ? "Saving…" : "Save my check-in"} <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-xs leading-5 text-[#52706b]">No health-response details are sent to advertising platforms.</p>
                </div>
              </form>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
