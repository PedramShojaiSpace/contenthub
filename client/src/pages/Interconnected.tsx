import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const LOGO = "/manus-storage/urban-monk-logo-white_bea7991f.png";
const DOCTOR_PHOTO = "/manus-storage/pedram-white-coat_7321e611.webp";
const POSTER = "/manus-storage/interconnected-poster_e31ef3aa.jpg";
const INTERCONNECTED_LOGO = "/manus-storage/interconnected-logo_2c92e029.png";

// CDN base for expert headshots
const K = "/manus-storage/";

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function useCountdown(hours: number) {
  const endTimeRef = useRef(Date.now() + hours * 3600 * 1000);
  const [timeLeft, setTimeLeft] = useState({ h: hours, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endTimeRef.current - Date.now());
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

const pad = (n: number) => String(n).padStart(2, "0");

// ─── Episode data ─────────────────────────────────────────────────────────────
const EPISODES = [
  {
    num: 1,
    title: "The Invisible Organ: The Missing Piece in Health and Longevity",
    bullets: [
      "Why obesity, diabetes, autoimmune disease, and even cancer all start in the gut",
      "What indigenous tribes have that industrialized populations have lost",
      "The new diagnostic tools making gut medicine the foundation of modern healthcare",
    ],
  },
  {
    num: 2,
    title: "The Human Microbiome: The Raging Battle From Within",
    bullets: [
      "The unholy trinity of autoimmune diseases — and how to protect yourself",
      "What ancient medicine knew about the gut that modern science is only now confirming",
      "Leaky gut: how to know if you have it and how to repair it",
    ],
  },
  {
    num: 3,
    title: "The Truth About Probiotics",
    bullets: [
      "Why no single diet works for everyone — and what your unique microbiome demands",
      "What dysbiosis looks like and how it drives chronic disease",
      "Why adding probiotics to a toxic gut can make things worse, not better",
    ],
  },
  {
    num: 4,
    title: "The Trouble With Toxins: Staying Alive in a Toxic World",
    bullets: [
      "The environmental toxins in your home killing your microbiome day by day",
      "The real cause of IBS — and how feeding good bacteria can stop it",
      "Why your body may be blocked from naturally eliminating disease-spreading toxins",
    ],
  },
  {
    num: 5,
    title: "The Kids Aren't Alright: Leaky Gut — Leaky Brain — Leaky Kids",
    bullets: [
      "How gut microbiota are hardwired into your neurobiology, immunity, and longevity",
      "How nourishing the gut sends stress-relieving signals to the brain",
      "Does Parkinson's actually begin in the gut? New research says yes.",
    ],
  },
  {
    num: 6,
    title: "The Microbiome Solution: Thyroid, Obesity, and Diabetes",
    bullets: [
      "3 tell-tale signs of an underactive thyroid you're probably ignoring",
      "How microbiome care can help reverse Hashimoto's disease",
      "Why your microbiome may be triggering your weight gain — and how to fix it",
    ],
  },
  {
    num: 7,
    title: "The Microbiome Solution: Cancer, Immunity, and Heart Disease",
    bullets: [
      "Can we predict cancer by analyzing gut microbes? Scientists say yes.",
      "How balancing your microbiome resolves skin problems — acne, eczema, and more",
      "The gut-heart connection: what your microbiome has to do with cardiovascular disease",
    ],
  },
  {
    num: 8,
    title: "Ancient Wisdom and Modern Technology: Personalized Medicine",
    bullets: [
      "AI and microbiome testing: the breakthrough creating truly individualized medicine",
      "How ancient systems of medicine predicted the microbiome revolution",
      "The new GPS for treating disease that puts YOU in control of your health",
    ],
  },
  {
    num: 9,
    title: "Healing Yourself: A Bright Future",
    bullets: [
      "How to wean yourself off the chronic disease-causing Standard American Diet",
      "Why the future is about building your own force field against disease",
      "The actionable roadmap to healing your gut starting today",
    ],
  },
];

// ─── Featured Experts (with headshots) ────────────────────────────────────────
const FEATURED_EXPERTS = [
  {
    name: "Mark Hyman, MD",
    cred: "Cleveland Clinic Center for Functional Medicine",
    img: K + "mark-hyman-md_59f25bf6.jpg",
    quote: "The microbiome is the next frontier in medicine.",
  },
  {
    name: "Dave Asprey",
    cred: "Founder of Bulletproof · Biohacker",
    img: K + "dave-aspey_cb9def9f.jpg",
  },
  {
    name: "Zach Bush, MD",
    cred: "Triple Board-Certified Physician",
    img: K + "zach-bush-md_50a4b43c.jpg",
  },
  {
    name: "Alessio Fassano, MD",
    cred: "Harvard Medical School · Leaky Gut Pioneer",
    img: K + "alessio-fassano-md_6d7caa9a.jpg",
  },
  {
    name: "Datis Kharrazian, PhD",
    cred: "Harvard Medical School Researcher",
    img: K + "datis-kharrazian-phd-dhsc_eec6ace2.jpg",
  },
  {
    name: "Max Lugavere",
    cred: "NYT Bestselling Author · Health Journalist",
    img: K + "max-lugavere_78f23e75.jpg",
  },
  {
    name: "JJ Virgin",
    cred: "Celebrity Nutrition Expert · NYT Bestselling Author",
    img: K + "jj-virgin_4bc75cbd.jpg",
  },
  {
    name: "Emeran Mayer, MD",
    cred: "UCLA · Author of The Mind-Gut Connection",
    img: K + "emaren-mayer-md_edf069aa.jpg",
  },
  {
    name: "Izabella Wentz, PharmD",
    cred: "NYT Bestselling Author · Thyroid Pharmacist",
    img: K + "izabella-wentz-pharm-d_88697c7e.jpg",
  },
  {
    name: "Tom O'Bryan, DC",
    cred: "World-Renowned Gluten & Autoimmunity Expert",
    img: K + "tom-o-bryan-dc-dacbn_4db66297.jpg",
  },
  {
    name: "Rangan Chatterjee, MD",
    cred: "BBC Doctor · Author of Feel Better in 5",
    img: K + "rangan-chatterjee-md_ef5a443c.jpg",
  },
  {
    name: "Martin Blaser, MD",
    cred: "NYU · Author of Missing Microbes",
    img: K + "martin-blaser-md_76654a0c.jpg",
  },
];

// ─── All 70 Expert Names ───────────────────────────────────────────────────────
const ALL_EXPERTS = [
  "Dave Asprey", "Gurunduth Banavar", "Maggie Berghoff", "Razi Berry",
  "Robin Berzin, MD", "Christina Bjorndahl", "Martin Blaser, MD", "Summer Bock",
  "Eugenia Bone", "Elhanan Borenstein, PhD", "Jolene Brighten, ND", "Kenneth Brown, MD",
  "Zach Bush, MD", "Rangan Chatterjee, MD", "Robynne Chutkan, MD", "Edison De Mello, MD",
  "Afrouz Demehri, NMD", "Peter Diamandis, MD", "Carolyn Edelstein", "Joel Evans, MD",
  "Tom Fabian, PhD", "Alessio Fassano, MD", "Kara Fitzgerald, ND", "Emily Fletcher",
  "Rob Franklin, DVM", "Claire Fraser, PhD", "Bob Harding, DO", "Jennifer Harmon-Meyer",
  "Tara Hunkin", "Mark Hyman, MD", "Pejman Katiraei, DO",
  "Raphael Kellman, MD", "Datis Kharrazian, PhD", "Max Lugavere", "Finian Makepeace",
  "Tom Malterre, MS", "Laura Markle Downton", "James Maskell", "Emeran Mayer, MD",
  "Sarkis Mazmanian, PhD", "Mark Menolascino, MD", "Helen Messier, MD", "Gerard Mullin, MD",
  "Karen Nelson, PhD", "Tom O'Bryan, DC", "Barbara Olendzki, RD", "Ally Perlina",
  "Warren Phillips, MS", "Joe Pizzorno, ND", "Daniel Pompa, PSc.D", "David Relman, MD",
  "Robert Rountree, MD", "Michael Ruscio, DC", "Shivan Sarna",
  "Trudy Scott, CN", "Ann Shippy, MD", "Marvin Singh, MD", "Mariza Snyder, DC",
  "Joel Sprechman", "Sarah Anne Stewart", "Marisol Teijeiro, ND", "JJ Virgin",
  "Momo Vuyisich", "Izabella Wentz, PharmD", "Genevieve White", "Todd White",
  "Magdalena Wszelaki", "Eric Zielinski, DC",
];

// ─── UTM capture helper ──────────────────────────────────────────────────────
function getUtmAttribution() {
  // Try sessionStorage first (persists across same-session page navigations)
  const stored = sessionStorage.getItem('__utm_attrib');
  if (stored) {
    try { return JSON.parse(stored) as Record<string, string | undefined>; } catch {}
  }
  // Read from current URL
  const params = new URLSearchParams(window.location.search);
  const attrib: Record<string, string | undefined> = {
    utmSource: params.get('utm_source') ?? undefined,
    utmMedium: params.get('utm_medium') ?? undefined,
    utmCampaign: params.get('utm_campaign') ?? undefined,
    utmContent: params.get('utm_content') ?? params.get('utm_term') ?? undefined,
    referrer: document.referrer || undefined,
  };
  // If fbclid present but no utm_source, infer source=meta
  const fbclid = params.get('fbclid');
  if (fbclid && !attrib.utmSource) {
    attrib.utmSource = 'meta';
    attrib.utmMedium = attrib.utmMedium ?? 'paid';
    attrib.utmContent = (attrib.utmContent ?? '') + (attrib.utmContent ? '|' : '') + 'fbclid:' + fbclid.substring(0, 40);
  }
  // If referrer is facebook/instagram and no utm_source, infer source
  if (!attrib.utmSource && attrib.referrer) {
    if (/facebook\.com|fb\.com/i.test(attrib.referrer)) attrib.utmSource = 'meta';
    else if (/instagram\.com/i.test(attrib.referrer)) attrib.utmSource = 'instagram';
  }
  // Persist for this session
  sessionStorage.setItem('__utm_attrib', JSON.stringify(attrib));
  return attrib;
}

// ─── Opt-In Form ──────────────────────────────────────────────────────────────
function OptInForm({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");

  const submit = trpc.interconnected.register.useMutation({
    onSuccess: () => navigate("/interconnected/thank-you"),
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    const attrib = getUtmAttribution();
    submit.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      smsConsent,
      utmSource: attrib.utmSource,
      utmMedium: attrib.utmMedium,
      utmCampaign: attrib.utmCampaign,
      utmContent: attrib.utmContent,
      referrer: attrib.referrer,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!compact && (
        <p className="text-center text-sm font-bold text-white uppercase tracking-wide mb-1">
          Register NOW for FREE unlimited access
        </p>
      )}
      <input
        type="text"
        placeholder="First Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />
      {!compact && (
        <>
          <input
            type="tel"
            placeholder="Mobile Phone (optional — episode reminders)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          {/* TCPA-compliant SMS consent checkbox */}
          <label className="flex items-start gap-3 bg-white/10 border border-white/20 rounded p-3 cursor-pointer">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  smsConsent ? "bg-cyan-600 border-cyan-600" : "bg-white border-gray-400"
                }`}
              >
                {smsConsent && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-200 leading-relaxed">
              By checking this box you agree to receive recurring, automated marketing text messages from The Urban Monk and select third-party partners, at the phone number you provide, even if it is on a Do Not Call list. Consent is not required to purchase. Msg frequency varies. Msg&amp;Data rates may apply. Reply HELP for support or STOP to cancel.{" "}
              <a href="https://theurbanmonk.com/sms-terms" target="_blank" rel="noopener noreferrer" className="underline text-cyan-300">SMS Terms</a>{" "}|{" "}
              <a href="https://theurbanmonk.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-cyan-300">Privacy Policy</a>
            </span>
          </label>
        </>
      )}
      {error && <p className="text-red-300 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submit.isPending}
        className="w-full py-4 px-6 font-black text-base rounded uppercase tracking-wide transition-colors disabled:opacity-60"
        style={{ background: "#018db1", color: "#fff", letterSpacing: "0.06em" }}
      >
        {submit.isPending ? "Registering..." : "REGISTER NOW!"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        100% free. No credit card required.
      </p>
    </form>
  );
}

// ─── Isolated Countdown Components (prevent full-page rerenders) ─────────────────
function StickyBar({ scrollToForm }: { scrollToForm: () => void }) {
  const countdown = useCountdown(47);
  return (
    <div
      className="sticky top-0 z-50 text-white text-center py-2 px-4 text-sm font-semibold"
      style={{ background: "#161E2A", borderBottom: "1px solid rgba(1,141,177,0.4)" }}
    >
      Free viewing period closes in:&nbsp;
      <span className="font-mono font-black" style={{ color: "#2E91FC" }}>
        {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
      </span>
      &nbsp;&mdash;&nbsp;
      <button onClick={scrollToForm} className="underline font-bold hover:opacity-80" style={{ color: "#7ecfdf" }}>
        Claim your free access now
      </button>
    </div>
  );
}

function HeroCountdownBox() {
  const countdown = useCountdown(47);
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{ background: "rgba(10,20,30,0.7)", border: "1px solid rgba(46,145,252,0.3)" }}
    >
      <span className="text-yellow-400 text-xl">⚠</span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#7ecfdf" }}>
          Free viewing period closes in:
        </p>
        <p className="font-mono font-black text-2xl text-white leading-none">
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </p>
      </div>
    </div>
  );
}

function BottomCountdown() {
  const countdown = useCountdown(47);
  return (
    <p className="font-mono font-black text-5xl mb-6 text-white">
      {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
    </p>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Interconnected() {
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "#0a1520" }}>

      {/* STICKY URGENCY BAR — isolated, only this re-renders on tick */}
      <StickyBar scrollToForm={scrollToForm} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center"
        style={{
          background: "linear-gradient(135deg, #020d18 0%, #051e2e 50%, #020d18 100%)",
        }}
      >
        {/* Microbiome background texture — img tag for LCP preloadability */}
        <img
          src={POSTER}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="sync"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.2, pointerEvents: "none" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(2,13,24,0.9) 0%, rgba(2,13,24,0.5) 50%, rgba(2,13,24,0.8) 100%)" }}
        />

        <div className="relative z-10 w-full px-4 py-16 md:py-20" style={{ overflowX: "hidden" }}>
          <div className="max-w-6xl mx-auto" style={{ overflowX: "hidden" }}>
            <img src={LOGO} alt="The Urban Monk" className="w-36 mb-8 mx-auto md:mx-0" />

            <div className="grid lg:grid-cols-2 gap-10 items-start" style={{ overflow: "hidden" }}>

              {/* LEFT — Documentary title and big claim */}
              <div className="min-w-0 overflow-hidden">
                <h1
                  className="font-black leading-none mb-3 uppercase"
                  style={{ fontSize: "clamp(2.2rem, 4vw, 3.5rem)", letterSpacing: "-0.02em" }}
                >
                  INTERCONNECTED
                </h1>
                <p className="text-xl md:text-2xl font-light italic mb-6" style={{ color: "#7ecfdf" }}>
                  The Power to Heal From Within
                </p>

                <div
                  className="rounded-lg p-5 mb-6"
                  style={{ background: "rgba(46,145,252,0.1)", border: "1px solid rgba(46,145,252,0.3)" }}
                >
                  <p
                    className="font-black text-2xl md:text-3xl leading-tight uppercase"
                    style={{ color: "#f0f4f8" }}
                  >
                    THE SOURCE OF 90% OF ALL CHRONIC DISEASE:
                    <span style={{ color: "#2E91FC" }}> DISCOVERED</span>
                  </p>
                </div>

                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  70 of the world's leading doctors, researchers, and scientists reveal the hidden root
                  of obesity, autoimmunity, brain fog, fatigue, and chronic disease — and the
                  breakthrough science that can heal it.
                </p>

                <div className="flex flex-wrap gap-4 mb-6">
                  {[
                    { icon: "🎬", text: "9-Part Documentary Series" },
                    { icon: "👨‍⚕️", text: "70+ World-Class Experts" },
                    { icon: "🎁", text: "100% Free Access" },
                  ].map((b) => (
                    <div key={b.text} className="flex items-center gap-2 text-sm" style={{ color: "#a0d8e8" }}>
                      <span>{b.icon}</span>
                      <span className="font-semibold">{b.text}</span>
                    </div>
                  ))}
                </div>

                {/* Countdown box — isolated component */}
                <HeroCountdownBox />
              </div>

              {/* RIGHT — Opt-in form */}
              <div ref={formRef} className="w-full min-w-0">
                <div
                  className="rounded-xl p-6"
                  style={{ background: "rgba(5,20,35,0.95)", border: "1px solid rgba(46,145,252,0.35)", overflowX: "hidden" }}
                >
                  <p
                    className="text-center font-black text-sm uppercase tracking-widest mb-4"
                    style={{ color: "#2E91FC" }}
                  >
                    Register NOW for a limited-time FREE viewing of this groundbreaking 9-part documentary series.
                  </p>
                  <OptInForm />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TAKE ADVANTAGE ──────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#0d1e2e" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <img src={POSTER} alt="Interconnected Documentary" className="rounded-xl w-full object-cover shadow-2xl" style={{ maxHeight: "340px" }} loading="lazy" decoding="async" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase mb-4" style={{ color: "#f0f4f8" }}>
                Take Advantage of the Next Frontier of Medicine:
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Naturally heal chronic disease, sharpen your thinking, and boost your immune system when you
                discover how to feed, nurture, and control your gut's microbiome — the vast community of
                bacteria, viruses, and microorganisms that science has now proven we cannot function without.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed">
                This is the hottest area of medical research today — and it changes everything you thought
                you knew about health, disease, and the human body.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARK HYMAN FEATURED QUOTE ────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#161E2A" }}>
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="flex justify-center">
              <div
                className="rounded-full overflow-hidden shadow-2xl"
                style={{ width: "180px", height: "180px", border: "4px solid rgba(46,145,252,0.5)" }}
              >
                <img
                  src={K + "mark-hyman-md_59f25bf6.jpg"}
                  alt="Mark Hyman, MD"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-4xl mb-2 leading-none" style={{ color: "#2E91FC" }}>&ldquo;</p>
              <blockquote className="text-xl md:text-2xl text-gray-100 italic leading-relaxed mb-4">
                The microbiome is the next frontier in medicine. Understanding it and optimizing it is going to
                be critical to solving so many of our healthcare issues.
              </blockquote>
              <p className="font-black text-lg" style={{ color: "#2E91FC" }}>Mark Hyman, MD</p>
              <p className="text-gray-400 text-sm">Cleveland Clinic Center for Functional Medicine</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED EXPERTS GRID ────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#0a1520" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-center uppercase mb-2" style={{ color: "#f0f4f8" }}>
            Meet the All-Star Lineup
          </h2>
          <p className="text-center mb-2" style={{ color: "#7ecfdf" }}>
            Here are the preeminent doctors, researchers, and experts you'll meet inside Interconnected:
          </p>
          <div className="w-16 h-1 mx-auto mb-10 rounded" style={{ background: "#2E91FC" }} />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {FEATURED_EXPERTS.map((expert) => (
              <div key={expert.name} className="flex flex-col items-center text-center">
                <div
                  className="rounded-full overflow-hidden mb-3 shadow-lg"
                  style={{
                    width: "90px",
                    height: "90px",
                    border: "3px solid rgba(46,145,252,0.4)",
                    background: "#161E2A",
                  }}
                >
                  <img
                    src={expert.img}
                    alt={expert.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.style.background = "#1a3a5a";
                    }}
                  />
                </div>
                <p className="font-bold text-xs text-white leading-tight mb-0.5">{expert.name}</p>
                <p className="text-xs leading-tight" style={{ color: "#7ecfdf" }}>{expert.cred}</p>
              </div>
            ))}
          </div>

          {/* All 70 names pill list */}
          <div className="mt-12">
            <p className="text-center text-sm font-bold uppercase tracking-widest mb-5" style={{ color: "#7ecfdf" }}>
              Plus 58 More World-Renowned Experts Including:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {ALL_EXPERTS.filter(n => !FEATURED_EXPERTS.map(e => e.name.split(",")[0]).some(fn => n.includes(fn.split(",")[0]))).map((name) => (
                <span
                  key={name}
                  className="text-gray-300 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(46,145,252,0.08)", border: "1px solid rgba(46,145,252,0.2)" }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── EPISODES ─────────────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#0d1e2e" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center uppercase mb-2" style={{ color: "#f0f4f8" }}>
            Here's a Peek at What You'll Discover Inside
          </h2>
          <p className="text-center mb-10" style={{ color: "#7ecfdf" }}>
            Interconnected: The Power to Heal From Within — 9 Episodes
          </p>
          <div className="space-y-5">
            {EPISODES.map((ep) => (
              <div
                key={ep.num}
                className="flex gap-5 items-start pb-5"
                style={{ borderBottom: "1px solid rgba(46,145,252,0.12)" }}
              >
                <div
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                  style={{ background: "rgba(46,145,252,0.15)", border: "1px solid rgba(46,145,252,0.4)", color: "#2E91FC" }}
                >
                  {ep.num}
                </div>
                <div>
                  <h3 className="text-white font-bold mb-2 leading-tight">{ep.title}</h3>
                  <ul className="space-y-1">
                    {ep.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-400 text-sm">
                        <span className="mt-0.5 shrink-0 font-bold" style={{ color: "#2E91FC" }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MID-PAGE CTA ─────────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#161E2A" }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-black uppercase mb-3" style={{ color: "#f0f4f8" }}>
            Discover the Secret to Reversing Chronic Disease
          </h2>
          <p className="mb-6" style={{ color: "#7ecfdf" }}>
            Register now before the free viewing period ends.
          </p>
          <div
            className="rounded-xl p-6"
            style={{ background: "rgba(5,20,35,0.95)", border: "1px solid rgba(46,145,252,0.3)" }}
          >
            <OptInForm />
          </div>
        </div>
      </section>

      {/* ── HOST BIO ─────────────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#0a1520" }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-black uppercase tracking-widest mb-6" style={{ color: "#2E91FC" }}>
            Meet Your Host
          </p>
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="flex justify-center">
              <div
                className="rounded-xl overflow-hidden shadow-xl max-w-xs w-full"
                style={{ border: "1px solid rgba(46,145,252,0.25)" }}
              >
                <img
                  src={DOCTOR_PHOTO}
                  alt="Dr. Pedram Shojai, OMD"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: "280px" }}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <h3 className="text-2xl font-black mb-1">Dr. Pedram Shojai, OMD</h3>
              <p className="text-sm mb-4" style={{ color: "#2E91FC" }}>
                Doctor of Oriental Medicine &nbsp;|&nbsp; Former Taoist Monk &nbsp;|&nbsp; NYT Bestselling Author
              </p>
              <p className="text-gray-300 leading-relaxed mb-3">
                Dr. Pedram Shojai is a Doctor of Oriental Medicine, former Taoist monk, and New York Times
                bestselling author of <em>The Urban Monk</em> and <em>The Art of Stopping Time</em>. He is the
                producer of the documentary films <em>Vitality</em>, <em>Origins</em>, and <em>Prosperity</em>,
                and the host and executive producer of <em>Interconnected</em>.
              </p>
              <p className="text-gray-300 leading-relaxed">
                With over 20 years of clinical practice and a deep grounding in both Eastern and Western medicine,
                Dr. Shojai brings a uniquely integrated perspective to the science of the microbiome — one that
                bridges ancient wisdom with cutting-edge research.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", background: "#0d1e2e" }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black uppercase mb-3" style={{ color: "#f0f4f8" }}>
            Don't Miss the Free Viewing Period
          </h2>
          <p className="mb-2" style={{ color: "#7ecfdf" }}>Access closes in:</p>
          <BottomCountdown />
          <div
            className="rounded-xl p-6"
            style={{ background: "rgba(5,20,35,0.95)", border: "1px solid rgba(46,145,252,0.3)" }}
          >
            <OptInForm />
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        className="py-8 px-4 text-center"
        style={{ background: "#020d18", borderTop: "1px solid rgba(46,145,252,0.1)" }}
      >
        <img src={LOGO} alt="The Urban Monk" className="w-28 mx-auto mb-4 opacity-50" loading="lazy" decoding="async" />
        <p className="text-gray-600 text-xs max-w-2xl mx-auto mb-2 leading-relaxed">
          THE INFORMATION ON THIS SITE IS FOR EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS MEDICAL ADVICE.
          READERS ARE ADVISED TO CONSULT A QUALIFIED PROFESSIONAL ABOUT ANY ISSUE REGARDING THEIR HEALTH AND WELL-BEING.
        </p>
        <p className="text-gray-600 text-xs mb-3">
          Facebook and Instagram are trademarks of Meta Inc and are not associated with this page.
        </p>
        <p className="text-gray-700 text-xs">
          Brought to you by The Urban Monk Productions &copy; {new Date().getFullYear()} All Rights Reserved.
        </p>
        <div className="flex justify-center gap-4 mt-3">
          <a href="/privacy" className="text-gray-600 text-xs hover:text-gray-400">Privacy Policy</a>
          <a href="/terms" className="text-gray-600 text-xs hover:text-gray-400">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
