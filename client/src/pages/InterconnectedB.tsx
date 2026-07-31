/**
 * InterconnectedB.tsx
 * Variant B: Same blue Kajabi color scheme as Variant A, but with a centered/minimal
 * layout for A/B testing. Includes expert headshots and social proof.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const LOGO = "/manus-storage/urban-monk-logo-white_bea7991f.png";
const POSTER = "/manus-storage/interconnected-poster_e31ef3aa.jpg";
const K = "/manus-storage/";

// ─── Countdown Hook ────────────────────────────────────────────────────────────
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

// ─── Featured Experts (subset for compact layout) ─────────────────────────────
const FEATURED = [
  { name: "Mark Hyman, MD", img: K + "Mark Hyman, MD_ac8a0034.jpg" },
  { name: "Dave Asprey", img: K + "Dave Aspey_db3703a7.jpg" },
  { name: "Zach Bush, MD", img: K + "Zach Bush, MD_a26821b8.jpg" },
  { name: "Alessio Fassano, MD", img: K + "Alessio Fassano, MD_9ee5b4d8.jpg" },
  { name: "Max Lugavere", img: K + "Max Lugavere_bf5b6537.jpg" },
  { name: "JJ Virgin", img: K + "JJ Virgin_3b348e2f.jpg" },
  { name: "Emeran Mayer, MD", img: K + "Emaren Mayer, MD_3c1401d9.jpg" },
  { name: "Izabella Wentz, PharmD", img: K + "Izabella Wentz, Pharm D_b77f8e06.jpg" },
];

// ─── Opt-In Form ──────────────────────────────────────────────────────────────
function OptInFormB() {
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
    submit.mutate({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, smsConsent });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full">
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
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 text-gray-900 bg-white border-0 rounded text-base focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />
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
        <span className="text-xs text-gray-300 leading-relaxed">
          By checking this box you agree to receive recurring, automated marketing text messages from The Urban Monk and select third-party partners, at the phone number you provide, even if it is on a Do Not Call list. Consent is not required to purchase. Msg frequency varies. Msg&amp;Data rates may apply. Reply HELP for support or STOP to cancel.{" "}
          <a href="https://theurbanmonk.com/sms-terms" target="_blank" rel="noopener noreferrer" className="underline text-cyan-300">SMS Terms</a>{" "}|{" "}
          <a href="https://theurbanmonk.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-cyan-300">Privacy Policy</a>
        </span>
      </label>
      {error && <p className="text-red-300 text-sm text-center">{error}</p>}
      <button
        type="submit"
        disabled={submit.isPending}
        className="w-full py-4 px-6 font-black text-base rounded uppercase tracking-wide transition-colors disabled:opacity-60"
        style={{ background: "#018db1", color: "#fff", letterSpacing: "0.06em" }}
      >
        {submit.isPending ? "Registering..." : "REGISTER NOW — FREE ACCESS"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        100% free. No credit card required.
      </p>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InterconnectedB() {
  const countdown = useCountdown(47);
  const formRef = useRef<HTMLDivElement>(null);
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a1520" }}>

      {/* Urgency Bar */}
      <div
        className="sticky top-0 z-50 text-center py-2 px-4 text-sm font-semibold"
        style={{ background: "#161E2A", borderBottom: "1px solid rgba(46,145,252,0.3)" }}
      >
        Free viewing period closes in:&nbsp;
        <span className="font-mono font-black" style={{ color: "#2E91FC" }}>
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </span>
        &nbsp;&mdash;&nbsp;
        <button onClick={scrollToForm} className="underline font-bold" style={{ color: "#7ecfdf" }}>
          Claim your free access now
        </button>
      </div>

      {/* Hero — centered layout */}
      <section
        className="relative py-16 px-4"
        style={{
          background: "linear-gradient(180deg, #020d18 0%, #051e2e 60%, #020d18 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${POSTER})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.15 }}
        />
        <div className="absolute inset-0" style={{ background: "rgba(2,13,24,0.85)" }} />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <img src={LOGO} alt="The Urban Monk" className="w-32 mx-auto mb-8" />

          <p
            className="text-xs font-black uppercase tracking-widest mb-4 px-4 py-1.5 rounded-full inline-block"
            style={{ background: "rgba(46,145,252,0.15)", border: "1px solid rgba(46,145,252,0.3)", color: "#2E91FC" }}
          >
            Free Documentary Series — Limited Access
          </p>

          <h1
            className="font-black uppercase leading-none mb-3"
            style={{ fontSize: "clamp(2.5rem, 7vw, 4rem)", letterSpacing: "-0.02em" }}
          >
            INTERCONNECTED
          </h1>
          <p className="text-xl italic mb-6" style={{ color: "#7ecfdf" }}>
            The Power to Heal From Within
          </p>

          <div
            className="rounded-lg p-4 mb-6 mx-auto max-w-lg"
            style={{ background: "rgba(46,145,252,0.1)", border: "1px solid rgba(46,145,252,0.3)" }}
          >
            <p className="font-black text-xl uppercase" style={{ color: "#f0f4f8" }}>
              The Source of 90% of All Chronic Disease:
              <span style={{ color: "#2E91FC" }}> Discovered</span>
            </p>
          </div>

          <p className="text-gray-300 text-lg leading-relaxed mb-6 max-w-xl mx-auto">
            70 of the world's leading doctors, researchers, and scientists reveal the hidden root
            of chronic disease — and the breakthrough science that can heal it.
          </p>

          <p className="text-sm mb-8" style={{ color: "#7ecfdf" }}>
            Watched by <strong className="text-white">2.4 million people</strong> worldwide &nbsp;·&nbsp; 9 episodes &nbsp;·&nbsp; Free for a limited time
          </p>

          {/* Form Card */}
          <div
            ref={formRef}
            className="rounded-xl p-6 text-left"
            style={{ background: "rgba(5,20,35,0.95)", border: "1px solid rgba(46,145,252,0.35)" }}
          >
            <p className="text-center font-black text-sm uppercase tracking-widest mb-4" style={{ color: "#2E91FC" }}>
              Register NOW for a limited-time FREE viewing of this groundbreaking 9-part documentary series.
            </p>
            <OptInFormB />
          </div>
        </div>
      </section>

      {/* Mark Hyman Quote */}
      <section className="py-12 px-4" style={{ background: "#161E2A" }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div
              className="rounded-full overflow-hidden shrink-0 shadow-lg"
              style={{ width: "100px", height: "100px", border: "3px solid rgba(46,145,252,0.5)" }}
            >
              <img
                src={K + "1334cb0-bea0-4a-d35d-f8f887343a7_3dd26ddb-expert-hyman-mark-200x200_100000000000000000001o.jpg"}
                alt="Mark Hyman, MD"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-3xl mb-1 leading-none" style={{ color: "#2E91FC" }}>&ldquo;</p>
              <blockquote className="text-lg text-gray-200 italic leading-relaxed mb-2">
                The microbiome is the next frontier in medicine. Understanding it and optimizing it is going to
                be critical to solving so many of our healthcare issues.
              </blockquote>
              <p className="font-black" style={{ color: "#2E91FC" }}>Mark Hyman, MD</p>
              <p className="text-gray-400 text-sm">Cleveland Clinic Center for Functional Medicine</p>
            </div>
          </div>
        </div>
      </section>

      {/* Expert Headshots Grid */}
      <section className="py-12 px-4" style={{ background: "#0a1520" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-black uppercase mb-2" style={{ color: "#f0f4f8" }}>
            70 World-Renowned Experts
          </h2>
          <p className="text-sm mb-8" style={{ color: "#7ecfdf" }}>
            Including the world's top doctors, researchers, and health pioneers
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 justify-items-center">
            {FEATURED.map((expert) => (
              <div key={expert.name} className="flex flex-col items-center">
                <div
                  className="rounded-full overflow-hidden mb-2"
                  style={{ width: "64px", height: "64px", border: "2px solid rgba(46,145,252,0.4)", background: "#161E2A" }}
                >
                  <img
                    src={expert.img}
                    alt={expert.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center leading-tight">{expert.name.split(",")[0]}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-6" style={{ color: "#7ecfdf" }}>
            + 62 more world-class doctors, researchers, and health experts
          </p>
        </div>
      </section>

      {/* What You'll Discover */}
      <section className="py-12 px-4" style={{ background: "#0d1e2e" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-black uppercase text-center mb-6" style={{ color: "#f0f4f8" }}>
            What You'll Discover
          </h2>
          <ul className="space-y-3">
            {[
              "Why obesity, diabetes, autoimmune disease, and cancer all start in the gut",
              "The gut-brain connection your doctor never told you about",
              "Why 80% of your immune system lives in your gut — and how to protect it",
              "The inflammation loop driving fatigue, brain fog, and chronic pain",
              "Ancient healing wisdom now validated by cutting-edge science",
              "Practical protocols you can start today — no prescriptions needed",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold text-xs"
                  style={{ background: "rgba(46,145,252,0.2)", border: "1px solid rgba(46,145,252,0.4)", color: "#2E91FC" }}
                >
                  ✓
                </span>
                <span className="text-gray-300 text-base">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 px-4" style={{ background: "#161E2A" }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-black uppercase mb-2" style={{ color: "#f0f4f8" }}>
            Don't Miss the Free Viewing Period
          </h2>
          <p className="mb-2" style={{ color: "#7ecfdf" }}>Access closes in:</p>
          <p className="font-mono font-black text-4xl mb-6 text-white">
            {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
          </p>
          <div
            className="rounded-xl p-6 text-left"
            style={{ background: "rgba(5,20,35,0.95)", border: "1px solid rgba(46,145,252,0.3)" }}
          >
            <OptInFormB />
          </div>
        </div>
      </section>

      {/* Host */}
      <section className="py-10 px-4" style={{ background: "#0a1520" }}>
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#2E91FC" }}>Hosted by</p>
          <p className="font-black text-xl mb-1">Dr. Pedram Shojai, OMD</p>
          <p className="text-sm" style={{ color: "#7ecfdf" }}>
            Doctor of Oriental Medicine &nbsp;·&nbsp; Former Taoist Monk &nbsp;·&nbsp; NYT Bestselling Author
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center" style={{ background: "#020d18", borderTop: "1px solid rgba(46,145,252,0.1)" }}>
        <img src={LOGO} alt="The Urban Monk" className="w-24 mx-auto mb-4 opacity-40" />
        <p className="text-gray-600 text-xs max-w-lg mx-auto mb-2 leading-relaxed">
          THE INFORMATION ON THIS SITE IS FOR EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS MEDICAL ADVICE.
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
