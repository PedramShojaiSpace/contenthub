import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const DOCTOR_PHOTO = "/manus-storage/pedram-white-coat_7321e611.webp";
const LOGO = "https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2158994062/settings_images/66115c4-003e-6c04-6630-3f5a15f47141_250aa8b0-new-logo-tagline-white.png";
const POSTER = "https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2158994062/settings_images/48c813-cc7f-353c-4803-cd75834823bd_138f9c51-poster-jmsopt_100000000000000000001o.jpg";

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
      "Why obesity, diabetes, autoimmune disease, and even cancer all START in the gut",
      "What indigenous tribes have that industrialized populations have lost",
      "The new diagnostic tools making gut medicine the foundation of modern healthcare",
    ],
  },
  {
    num: 2,
    title: "The Human Microbiome: The Raging Battle From Within",
    bullets: [
      "The unholy trinity of autoimmune diseases - and how to protect yourself",
      "What ancient medicine from Hippocrates to Ayurveda knew about the gut that we forgot",
      "Leaky gut: how to know if you have it and how to repair it",
    ],
  },
  {
    num: 3,
    title: "The Truth About Probiotics",
    bullets: [
      "Why no single diet works for everyone - and what your unique microbiome demands",
      "What dysbiosis looks like and how it drives chronic disease",
      "Why adding probiotics to a toxic gut can make things worse, not better",
    ],
  },
  {
    num: 4,
    title: "The Trouble With Toxins: Staying Alive in a Toxic World",
    bullets: [
      "The environmental toxins in your home killing your microbiome day by day",
      "The real cause of IBS - and how feeding good bacteria can stop emergency bathroom trips",
      "Why your body may be blocked from naturally eliminating disease-spreading toxins",
    ],
  },
  {
    num: 5,
    title: "The Kids Aren't Alright: Leaky Gut - Leaky Brain - Leaky Kids",
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
      "Why your microbiome may be triggering your weight gain - and how to fix it",
    ],
  },
  {
    num: 7,
    title: "The Microbiome Solution: Cancer, Immunity, and Heart Disease",
    bullets: [
      "Can we PREDICT cancer by analyzing gut microbes? Scientists say yes.",
      "How balancing your microbiome resolves skin problems - acne, eczema, and more",
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

const EXPERTS = [
  "Dave Asprey", "Zach Bush, MD", "Mark Hyman, MD", "Alessio Fassano, MD",
  "Robynne Chutkan, MD", "Rangan Chatterjee, MD", "Datis Kharrazian, PhD",
  "Tom O'Bryan, DC", "Joe Pizzorno, ND", "JJ Virgin", "Max Lugavere",
  "Naveen Jain", "Robin Berzin, MD", "Kara Fitzgerald, ND", "Jolene Brighten, ND",
  "Peter Diamandis, MD", "Izabella Wentz, PharmD", "Daniel Pompa, PSc.D",
  "Marvin Singh, MD", "Ann Shippy, MD", "Michael Ruscio, DC", "Ocean Robbins",
  "Summer Bock", "Emily Fletcher", "Nick Polizzi", "Joel Evans, MD",
];

// ─── Opt-In Form ──────────────────────────────────────────────────────────────
function OptInForm() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    submit.mutate({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="First Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <input
          type="email"
          placeholder="Best Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <input
          type="tel"
          placeholder="Mobile Phone (optional - for episode reminders)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submit.isPending}
          className="w-full py-4 px-6 bg-teal-500 hover:bg-teal-400 text-white font-black text-lg rounded uppercase tracking-wide transition-colors disabled:opacity-60"
          style={{ letterSpacing: "0.05em" }}
        >
          {submit.isPending ? "Registering..." : "WATCH FREE - REGISTER NOW"}
        </button>
        <p className="text-xs text-gray-400 text-center">
          100% free. No credit card required. Unsubscribe anytime.
        </p>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Interconnected() {
  const countdown = useCountdown(47);
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* STICKY URGENCY BAR */}
      <div className="sticky top-0 z-50 bg-teal-800 text-white text-center py-2 px-4 text-sm font-semibold">
        Free viewing period closes in:&nbsp;
        <span className="font-mono font-black">
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </span>
        &nbsp;&mdash;&nbsp;
        <button onClick={scrollToForm} className="underline font-bold hover:text-teal-200">
          Claim your free access
        </button>
      </div>

      {/* HERO */}
      <section
        className="relative min-h-screen flex items-center"
        style={{ background: "linear-gradient(135deg, #050505 0%, #0a1f1f 60%, #050505 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-8"
          style={{
            backgroundImage: `url(${POSTER})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.08,
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 60%, #030303 100%)" }} />

        <div className="relative z-10 w-full px-4 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-6xl mx-auto">

            {/* LEFT - Doctor photo + credentials */}
            <div className="flex flex-col items-center md:items-start">
              <img src={LOGO} alt="The Urban Monk" className="w-44 mb-6 mx-auto md:mx-0" />

              <div className="relative w-full max-w-xs mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-2xl border border-teal-900/50">
                <img
                  src={DOCTOR_PHOTO}
                  alt="Dr. Pedram Shojai, OMD"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: "440px" }}
                />
                {/* Credential overlay at bottom of photo */}
                <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)" }}>
                  <p className="text-teal-400 font-black text-lg leading-tight">Dr. Pedram Shojai, OMD</p>
                  <p className="text-gray-300 text-sm mb-2">Doctor of Oriental Medicine</p>
                  <div className="flex flex-wrap gap-1">
                    {["Former Taoist Monk", "NYT Bestselling Author", "20+ Yrs Clinical Practice"].map((c) => (
                      <span key={c} className="text-xs bg-teal-900/70 text-teal-300 px-2 py-0.5 rounded-full border border-teal-700/50">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 justify-center md:justify-start">
                {["70+ World-Renowned Experts", "9-Part Documentary Series", "100% Free Access"].map((b) => (
                  <div key={b} className="flex items-center gap-1.5 text-sm text-gray-300">
                    <span className="text-teal-400 font-bold">&#10003;</span> {b}
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT - Headline + form */}
            <div ref={formRef}>
              <span className="text-teal-400 text-xs font-black uppercase tracking-widest">
                Free 9-Part Documentary Series
              </span>
              <h1 className="text-4xl md:text-5xl font-black leading-none mt-2 mb-1 uppercase tracking-tight">
                INTERCONNECTED
              </h1>
              <p className="text-teal-400 text-xl md:text-2xl font-bold italic mb-4">
                The Power to Heal From Within
              </p>
              <p className="text-2xl md:text-3xl font-black text-yellow-400 mb-4 leading-tight">
                The Source of 90% of All Chronic Disease - Discovered
              </p>
              <p className="text-gray-300 text-base md:text-lg mb-6 leading-relaxed">
                70 of the world's leading doctors, researchers, and scientists reveal the hidden root of obesity,
                autoimmunity, brain fog, fatigue, and chronic disease - and the breakthrough science that can heal it.
              </p>

              {/* Countdown box */}
              <div className="flex items-center gap-3 bg-teal-950/60 border border-teal-800/50 rounded-lg p-3 mb-6">
                <div className="text-yellow-400 text-2xl">&#9888;</div>
                <div>
                  <p className="text-teal-300 font-bold text-xs uppercase tracking-wide">Free viewing period closes in:</p>
                  <p className="text-white font-mono font-black text-2xl leading-none">
                    {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
                  </p>
                </div>
              </div>

              {/* Form box */}
              <div className="bg-gray-900/90 border border-gray-700/60 rounded-xl p-5 backdrop-blur-sm">
                <p className="text-center text-gray-300 font-bold mb-4 text-sm uppercase tracking-wide">
                  Register now for FREE unlimited access to all 9 episodes
                </p>
                <OptInForm />
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                As featured on CNN, Fox News, PBS, The Dr. Oz Show, and 200+ media outlets
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="bg-gray-900 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-4xl text-teal-600 mb-3 leading-none">&ldquo;</p>
          <blockquote className="text-xl md:text-2xl text-gray-200 italic leading-relaxed mb-4">
            The microbiome is the next frontier in medicine. Understanding it and optimizing it is going to be
            critical to solving so many of our healthcare issues.
          </blockquote>
          <p className="text-teal-400 font-bold">Mark Hyman, MD</p>
          <p className="text-gray-400 text-sm">Cleveland Clinic Center for Functional Medicine</p>
        </div>
      </section>

      {/* WHAT IS THE MICROBIOME */}
      <section className="py-14 px-4 bg-gray-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black uppercase mb-4">
            The Hottest Area of Medical Research Today
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            Naturally heal chronic disease, sharpen your thinking, and boost your immune system when you discover
            how to feed, nurture, and control your gut's microbiome - the vast community of bacteria, viruses,
            and microorganisms that science has now proven we cannot function without.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "&#129504;", title: "Brain Health", desc: "Gut-brain axis: how your microbiome controls mood, cognition, and mental clarity" },
              { icon: "&#128737;", title: "Immune Defense", desc: "70% of your immune system lives in your gut - learn to activate it" },
              { icon: "&#128200;", title: "Chronic Disease", desc: "The root cause of most modern disease - and how to reverse it" },
            ].map((item) => (
              <div key={item.title} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="text-3xl mb-3" dangerouslySetInnerHTML={{ __html: item.icon }} />
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EPISODES */}
      <section className="py-14 px-4 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center uppercase mb-2">
            Here's a Peek at What You'll Discover Inside
          </h2>
          <p className="text-center text-gray-400 mb-10">
            Interconnected: The Power to Heal From Within - 9 Episodes
          </p>
          <div className="space-y-6">
            {EPISODES.map((ep) => (
              <div key={ep.num} className="flex gap-5 items-start border-b border-gray-800 pb-6">
                <div className="shrink-0 w-10 h-10 rounded-full bg-teal-900/60 border border-teal-700/50 flex items-center justify-center text-teal-400 font-black text-sm">
                  {ep.num}
                </div>
                <div>
                  <h3 className="text-white font-bold mb-2 leading-tight">{ep.title}</h3>
                  <ul className="space-y-1">
                    {ep.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-400 text-sm">
                        <span className="text-teal-500 mt-0.5 shrink-0">&#10003;</span>
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

      {/* MID-PAGE CTA */}
      <section className="py-14 px-4" style={{ background: "linear-gradient(135deg, #0a1f1f 0%, #050505 100%)" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black uppercase mb-3">
            Discover the Secret to Reversing Chronic Disease
          </h2>
          <p className="text-gray-300 mb-6">
            Register now before the free viewing period ends.
          </p>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-700/50">
            <OptInForm />
          </div>
        </div>
      </section>

      {/* EXPERTS */}
      <section className="py-14 px-4 bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-black text-center uppercase mb-2">
            70 World-Renowned Doctors and Health Experts
          </h2>
          <p className="text-center text-gray-400 text-sm mb-8">
            Featured in Interconnected: The Power to Heal From Within
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXPERTS.map((name) => (
              <span key={name} className="bg-gray-800 text-gray-300 text-sm px-3 py-1.5 rounded-full border border-gray-700/50">
                {name}
              </span>
            ))}
            <span className="bg-teal-900/40 text-teal-400 text-sm px-3 py-1.5 rounded-full border border-teal-700/40 font-semibold">
              + 44 more experts
            </span>
          </div>
        </div>
      </section>

      {/* HOST BIO */}
      <section className="py-14 px-4 bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-teal-400 text-xs font-black uppercase tracking-widest mb-2">Meet Your Host</p>
              <h2 className="text-3xl font-black mb-4">Dr. Pedram Shojai, OMD</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Dr. Pedram Shojai is a Doctor of Oriental Medicine, former Taoist monk, and New York Times
                bestselling author. He is the producer of the documentary films <em>Vitality</em>, <em>Origins</em>,
                and <em>Prosperity</em>, and the host and executive producer of <em>Interconnected</em>.
              </p>
              <p className="text-gray-300 leading-relaxed">
                With over 20 years of clinical practice and a deep grounding in both Eastern and Western medicine,
                Dr. Shojai brings a uniquely integrated perspective to the science of the microbiome - one that
                bridges ancient wisdom with cutting-edge research.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-700/40 max-w-xs w-full">
                <img
                  src={DOCTOR_PHOTO}
                  alt="Dr. Pedram Shojai"
                  className="w-full object-cover object-top"
                  style={{ maxHeight: "360px" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-16 px-4 bg-gray-950">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black uppercase mb-3">
            Don't Miss the Free Viewing Period
          </h2>
          <p className="text-gray-300 mb-2">Access closes in:</p>
          <p className="text-white font-mono font-black text-5xl mb-6">
            {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
          </p>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-700/50">
            <OptInForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8 px-4 text-center">
        <img src={LOGO} alt="The Urban Monk" className="w-28 mx-auto mb-4 opacity-60" />
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
