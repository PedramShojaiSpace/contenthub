/**
 * InterconnectedThankYou.tsx
 * OTO thank-you page — styled after the MAHA movie thank-you page.
 * Dark forest green (#1a2e1a / #0d1f0d) background, centered serif typography.
 * Key mechanic: Episode 1 starts TOMORROW → creates 24-hour itch → buy now to get instant access.
 */

import { useState, useEffect, useRef } from "react";

const LOGO =
  "https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2158994062/settings_images/66115c4-003e-6c04-6630-3f5a15f47141_250aa8b0-new-logo-tagline-white.png";

// The real Kajabi checkout URL created by the VA
const OTO_CHECKOUT_URL = "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout";

// Episode 1 skip-to URL (for those who decline)
const EP1_URL = "https://theacademy.theurbanmonk.com/episode-view-page-eg-ep-1-SP26";

// Meta Pixel helper
function firePixel(eventName: string, params?: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") fbq("track", eventName, params || {});
  } catch (_) {}
}

// Countdown hook — 1 hour 48 minutes (MAHA uses ~1h 48m)
function useCountdown(initialSeconds: number) {
  const endRef = useRef(Date.now() + initialSeconds * 1000);
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endRef.current - Date.now());
      if (diff === 0) {
        setExpired(true);
        return;
      }
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

  return { timeLeft, expired };
}

const pad = (n: number) => String(n).padStart(2, "0");

const BUNDLE_ITEMS = [
  "Instant, On-Demand Access to All 9 Episodes of Interconnected (no viewing window — yours forever)",
  "The Interconnected Companion Guide — episode-by-episode protocols and action steps from all 70 experts",
  "The Gut Restoration Starter Protocol — Dr. Shojai's 30-day reset plan used with his own patients",
  "Private Healing Community Access — thousands of members on the same journey, with weekly Q&A",
  'BONUS: "The 5 Root Causes" Masterclass — a 45-minute deep-dive not available in the free series',
];

export default function InterconnectedThankYou() {
  const { timeLeft, expired } = useCountdown(6480); // 1h 48m
  const [declined, setDeclined] = useState(false);

  // Fire Lead pixel on page load (opt-in confirmed)
  useEffect(() => {
    firePixel("Lead");
  }, []);

  const handleBuyClick = () => {
    firePixel("InitiateCheckout", {
      value: 67,
      currency: "USD",
      content_name: "Interconnected Complete Healing Protocol",
    });
    window.location.href = OTO_CHECKOUT_URL;
  };

  return (
    <div
      className="min-h-screen text-white font-sans"
      style={{ background: "linear-gradient(180deg, #0d1f0d 0%, #1a2e1a 40%, #0f1f0f 100%)" }}
    >
      {/* ── STICKY TOP BAR ─────────────────────────────────────────────────────── */}
      {!expired && (
        <div
          className="sticky top-0 z-50 w-full py-2 px-4 flex items-center justify-between gap-4"
          style={{ background: "#0a160a", borderBottom: "1px solid #2a4a2a" }}
        >
          <p className="text-sm font-semibold text-gray-300 hidden sm:block">
            Act Fast — Your Discount Expires In:
          </p>
          <div className="flex items-center gap-1 font-mono font-black text-lg">
            {[
              { val: timeLeft.h, label: "HOURS" },
              { val: timeLeft.m, label: "MINS" },
              { val: timeLeft.s, label: "SECS" },
            ].map((seg, i) => (
              <span key={i} className="flex flex-col items-center">
                <span
                  className="px-3 py-1 rounded text-white text-xl font-black"
                  style={{ background: "#1a4a2a", minWidth: "2.5rem", textAlign: "center" }}
                >
                  {pad(seg.val)}
                </span>
                <span className="text-gray-500 text-xs mt-0.5">{seg.label}</span>
                {i < 2 && <span className="absolute text-gray-400 text-xl font-black" style={{ marginLeft: "5.5rem", marginTop: "-0.1rem" }}>:</span>}
              </span>
            ))}
          </div>
          <a
            href="#offer"
            className="shrink-0 px-4 py-2 rounded font-black text-sm uppercase tracking-wide transition-colors"
            style={{ background: "#4ade80", color: "#0a160a" }}
          >
            Get Full Access
          </a>
        </div>
      )}

      {/* ── HEADER LOGO ────────────────────────────────────────────────────────── */}
      <header className="pt-8 pb-4 px-4 text-center">
        <img src={LOGO} alt="The Urban Monk" className="w-36 mx-auto" />
      </header>

      {/* ── WAIT — ONE MORE THING ──────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-4 pt-4 pb-8 text-center">
        {/* Confirmation line */}
        <p className="text-gray-300 text-base mb-6">
          First, you have successfully signed up to watch{" "}
          <strong className="text-green-400">Interconnected: The Power to Heal From Within</strong>{" "}
          — starting <strong className="text-white">tomorrow</strong>.
        </p>

        {/* VIDEO PLACEHOLDER */}
        <div
          className="relative w-full rounded-xl overflow-hidden mb-8 flex items-center justify-center"
          style={{
            background: "#0a1a0a",
            border: "2px solid #2a4a2a",
            aspectRatio: "16/9",
          }}
        >
          {/* Play button overlay */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(74, 222, 128, 0.15)", border: "2px solid #4ade80" }}
            >
              <svg className="w-7 h-7 text-green-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">
              [Record a short video message here — Dr. Shojai speaking directly to the viewer]
            </p>
            <p className="text-gray-600 text-xs max-w-xs">
              Suggested: 2–3 min. Thank them for registering, tease what's coming tomorrow, then pivot to the offer below.
            </p>
          </div>
        </div>

        {/* Main hook headline */}
        <h1
          className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Wait, one more thing!
        </h1>

        {/* Scarcity setup */}
        <h2
          className="text-2xl md:text-3xl font-bold text-gray-200 mb-4 leading-snug"
          style={{ fontFamily: "Georgia, serif" }}
        >
          But before you go, here's what you need to know…
        </h2>

        <p className="text-gray-300 text-lg leading-relaxed mb-6">
          <strong className="text-white">Interconnected</strong> has 9 episodes and each episode will be
          available for just <strong className="text-white">24 hours</strong>.{" "}
          <em className="text-red-300">If you miss a day, you will miss that episode… forever.</em>
        </p>

        {/* The good news pivot */}
        <h2
          className="text-2xl md:text-3xl font-bold text-gray-100 mb-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          But, here's the good news…
        </h2>

        <p className="text-gray-300 text-lg leading-relaxed mb-4">
          If you act before the timer below expires then you can secure{" "}
          <strong className="text-green-400">instant, permanent access to all 9 episodes</strong> right now.
        </p>

        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          You won't need to worry about losing access or missing a day — every episode will be available
          the moment you purchase. That way you'll have real solutions at your fingertips when you need
          them the most.
        </p>

        {/* Countdown clock — MAHA flip-clock style */}
        {!expired ? (
          <div className="flex items-end justify-center gap-2 mb-10">
            {[
              { val: timeLeft.h, label: "HOURS" },
              { val: timeLeft.m, label: "MINUTES" },
              { val: timeLeft.s, label: "SECONDS" },
            ].map((seg, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className="px-4 py-3 rounded-lg font-mono font-black text-4xl md:text-5xl text-white"
                    style={{ background: "#1a4a2a", minWidth: "4.5rem", textAlign: "center", border: "1px solid #2a6a3a" }}
                  >
                    {pad(seg.val)}
                  </div>
                  <span className="text-gray-500 text-xs mt-1 tracking-widest">{seg.label}</span>
                </div>
                {i < 2 && (
                  <div className="font-black text-4xl text-gray-500 mb-6">:</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center mb-10">
            <p className="text-red-400 font-bold">This special offer has expired.</p>
          </div>
        )}
      </section>

      {/* ── OFFER SECTION ─────────────────────────────────────────────────────── */}
      {!declined && (
        <section id="offer" className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">

            {/* "When you order today" header */}
            <div className="text-center mb-8">
              <h2
                className="text-3xl md:text-4xl font-bold text-white mb-2"
                style={{ fontFamily: "Georgia, serif" }}
              >
                When you order today
              </h2>
              <p
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: "#4ade80" }}
              >
                Here's what you're going to get:
              </p>
            </div>

            {/* Bundle checklist */}
            <div
              className="rounded-2xl p-6 md:p-8 mb-8"
              style={{ background: "#0f2a0f", border: "1px solid #2a4a2a" }}
            >
              <ul className="space-y-4 mb-8">
                {BUNDLE_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "#4ade80" }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="#0a160a"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-gray-200 text-base leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Dr. Shojai quote */}
              <div
                className="rounded-xl p-5 mb-8"
                style={{ background: "#0a1a0a", borderLeft: "4px solid #4ade80" }}
              >
                <p className="text-gray-200 text-base leading-relaxed italic mb-2">
                  "The series will change how you think about your health. But knowledge without a protocol
                  is just information. This bundle gives you the roadmap to actually use what you learn —
                  and a community to walk the path with you."
                </p>
                <p className="font-bold text-sm" style={{ color: "#4ade80" }}>
                  — Dr. Pedram Shojai, OMD
                </p>
              </div>

              {/* Pricing */}
              <div className="text-center">
                <p className="text-gray-400 text-base line-through mb-1">Normally $197</p>
                <p className="font-black text-white mb-1" style={{ fontSize: "4rem", lineHeight: 1 }}>
                  $67
                </p>
                <p className="text-sm font-bold mb-8" style={{ color: "#4ade80" }}>
                  One-time payment — you save $130 today only
                </p>

                {!expired ? (
                  <button
                    onClick={handleBuyClick}
                    className="w-full max-w-lg mx-auto block py-5 px-8 font-black text-xl rounded-xl uppercase tracking-wide transition-all shadow-xl cursor-pointer"
                    style={{
                      background: "#4ade80",
                      color: "#0a160a",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Yes — Give Me Instant Access to All 9 Episodes
                  </button>
                ) : (
                  <a
                    href={OTO_CHECKOUT_URL}
                    className="w-full max-w-lg mx-auto block py-4 px-8 font-bold text-base rounded-xl transition-colors"
                    style={{ background: "#2a4a2a", color: "#9ca3af" }}
                  >
                    Get the Complete Protocol (Regular Price)
                  </a>
                )}

                <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-sm">
                  <span>🔒</span>
                  <span>30-Day Money-Back Guarantee — No questions asked</span>
                </div>

                <button
                  onClick={() => setDeclined(true)}
                  className="mt-5 text-gray-500 text-sm hover:text-gray-300 underline block mx-auto transition-colors"
                >
                  No thanks — I'll just watch the free series and risk missing episodes
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── POST-DECLINE ───────────────────────────────────────────────────────── */}
      {declined && (
        <section className="py-16 px-4 text-center">
          <div className="max-w-xl mx-auto">
            <p className="text-gray-300 text-lg mb-2">
              No problem — your free access to all 9 episodes is confirmed.
            </p>
            <p className="text-gray-400 text-base mb-2">
              Check your inbox for your welcome email. Episode 1 becomes available tomorrow.
            </p>
            <p className="text-yellow-400 text-sm mb-8 font-semibold">
              ⚠ Remember: each episode is only available for 24 hours. Don't miss a day.
            </p>
            <a
              href={EP1_URL}
              className="inline-block py-4 px-10 font-black text-lg rounded-xl uppercase tracking-wide transition-colors"
              style={{ background: "#2a4a2a", color: "#4ade80" }}
            >
              I Understand — Take Me to the Series
            </a>
          </div>
        </section>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer
        className="py-8 px-4 text-center"
        style={{ borderTop: "1px solid #1a2e1a" }}
      >
        <p className="text-gray-600 text-xs max-w-2xl mx-auto mb-2 leading-relaxed uppercase tracking-wide">
          The information in this series is for educational purposes only and should not be construed as medical advice.
        </p>
        <p className="text-gray-700 text-xs">
          © {new Date().getFullYear()} The Urban Monk Productions. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
