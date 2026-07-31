/**
 * InterconnectedB.tsx
 * Variant B: MAHA-style minimal opt-in page for A/B testing against Interconnected.tsx (Variant A).
 * Light gray gradient background, centered serif typography, yellow CTA button.
 * Sends to the same /interconnected/thank-you OTO page as Variant A.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// ─── Countdown Hook ────────────────────────────────────────────────────────────
function useCountdown(initialMinutes: number) {
  const [seconds, setSeconds] = useState(initialMinutes * 60);
  useState(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  });
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
    <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-md mx-auto">
      <input
        type="text"
        placeholder="First Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm"
      />
      <input
        type="email"
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm"
      />
      <input
        type="tel"
        placeholder="Mobile Phone (optional — episode reminders)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm"
      />
      {/* TCPA-compliant SMS consent checkbox */}
      <label className="flex items-start gap-3 bg-gray-100 border border-gray-300 rounded-lg p-3 cursor-pointer">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
              smsConsent ? "bg-green-700 border-green-700" : "bg-white border-gray-400"
            }`}
          >
            {smsConsent && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-600 leading-relaxed">
          By checking this box you agree to receive recurring, automated marketing text messages from The Urban Monk and select third-party partners, at the phone number you provide, even if it is on a Do Not Call list. Consent is not required to purchase. Msg frequency varies. Msg&amp;Data rates may apply. Reply HELP for support or STOP to cancel.{" "}
          <a href="https://theurbanmonk.com/sms-terms" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">SMS Terms</a>{" "}|{" "}
          <a href="https://theurbanmonk.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Privacy Policy</a>
        </span>
      </label>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
      <button
        type="submit"
        disabled={submit.isPending}
        className="w-full py-4 px-6 font-black text-lg rounded-lg uppercase tracking-wide transition-all disabled:opacity-60 shadow-md hover:shadow-lg"
        style={{ background: "#f5c518", color: "#1a1a1a", letterSpacing: "0.05em" }}
      >
        {submit.isPending ? "Registering..." : "YES — SEND ME FREE ACCESS"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        100% free. No credit card required. Unsubscribe anytime.
      </p>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InterconnectedB() {
  const countdown = useCountdown(47);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #f9f9f7 0%, #eef0ec 100%)" }}
    >
      {/* Meta Pixel — Lead event fires on registration success (handled by thank-you page) */}

      {/* Urgency Bar */}
      <div className="w-full py-2 px-4 text-center text-sm font-semibold" style={{ background: "#1a2e1a", color: "#f5c518" }}>
        FREE ACCESS CLOSES IN: {countdown} — Register before it expires
      </div>

      {/* Header */}
      <header className="w-full py-5 px-6 flex justify-center border-b border-gray-200 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="font-serif font-bold text-xl text-gray-800 tracking-tight">The Urban Monk</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500 font-medium">Dr. Pedram Shojai, OMD</span>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-6 py-14 text-center">
        {/* Badge */}
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-gray-300 text-gray-500 bg-white">
          Free Documentary Series — Limited Access
        </div>

        {/* Title */}
        <h1 className="font-serif font-bold text-4xl md:text-5xl text-gray-900 leading-tight mb-4">
          INTERCONNECTED
        </h1>
        <p className="font-serif text-xl md:text-2xl text-gray-600 italic mb-6">
          The Power to Heal From Within
        </p>

        {/* Sub-headline */}
        <p className="text-lg text-gray-700 leading-relaxed mb-4 max-w-xl mx-auto">
          70 of the world's leading doctors and scientists reveal the hidden root of chronic disease — and the breakthrough science that can heal it.
        </p>

        {/* Social proof */}
        <p className="text-sm text-gray-500 mb-10">
          Watched by <strong className="text-gray-700">2.4 million people</strong> worldwide &nbsp;·&nbsp; 9 episodes &nbsp;·&nbsp; Free for a limited time
        </p>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-10">
          <p className="font-serif text-xl font-semibold text-gray-800 mb-1">
            Claim Your Free Access Now
          </p>
          <p className="text-sm text-gray-500 mb-6">Enter your details below to watch all 9 episodes free</p>
          <OptInFormB />
        </div>

        {/* What You'll Discover */}
        <div className="text-left mb-10">
          <h2 className="font-serif text-xl font-bold text-gray-800 mb-4 text-center">What You'll Discover</h2>
          <ul className="space-y-3">
            {[
              "The gut-brain connection your doctor never told you about",
              "Why 80% of your immune system lives in your gut — and how to protect it",
              "The inflammation loop driving fatigue, brain fog, and chronic pain",
              "Ancient healing wisdom validated by modern science",
              "Practical protocols you can start today — no prescriptions needed",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "#1a2e1a" }}>
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-gray-700 text-base">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Host intro */}
        <div className="border-t border-gray-200 pt-8 mb-10">
          <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-3">Hosted by</p>
          <p className="font-serif text-lg font-bold text-gray-800">Dr. Pedram Shojai, OMD</p>
          <p className="text-sm text-gray-500 mt-1">
            Doctor of Oriental Medicine &nbsp;·&nbsp; Former Taoist Monk &nbsp;·&nbsp; NYT Bestselling Author
          </p>
        </div>

        {/* Bottom CTA repeat */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <p className="font-serif text-xl font-semibold text-gray-800 mb-1">
            Don't Miss This
          </p>
          <p className="text-sm text-gray-500 mb-6">Free access closes when the timer hits zero</p>
          <OptInFormB />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 text-center border-t border-gray-200 bg-white/50">
        <p className="text-xs text-gray-400 leading-relaxed max-w-lg mx-auto">
          © The Urban Monk Productions. All Rights Reserved.<br />
          The information in this series is for educational purposes only and does not constitute medical advice.{" "}
          <a href="https://theurbanmonk.com/privacy" className="underline">Privacy Policy</a>
        </p>
      </footer>
    </div>
  );
}
