import { useState, useEffect, useRef } from "react";

const LOGO = "https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2158994062/settings_images/66115c4-003e-6c04-6630-3f5a15f47141_250aa8b0-new-logo-tagline-white.png";

// Meta Pixel helper — fires events safely
function firePixel(eventName: string, params?: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      fbq("track", eventName, params || {});
    }
  } catch (_) {
    // Pixel not loaded — fail silently
  }
}

// 15-minute OTO countdown
function useOtoCountdown() {
  const endRef = useRef(Date.now() + 15 * 60 * 1000);
  const [timeLeft, setTimeLeft] = useState({ m: 15, s: 0 });
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endRef.current - Date.now());
      if (diff === 0) { setExpired(true); return; }
      setTimeLeft({ m: Math.floor(diff / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { timeLeft, expired };
}

const pad = (n: number) => String(n).padStart(2, "0");

// $67 bundle OTO — Kajabi checkout URL will be filled in once VA creates the offer
// Placeholder URL until VA sends back the real checkout link
const OTO_CHECKOUT_URL = "https://theurbanmonk.mykajabi.com/offers/interconnected-complete-healing-protocol/checkout";

const BUNDLE_ITEMS = [
  {
    icon: "▶",
    title: "All 9 Episodes — Permanent Access",
    desc: "Ad-free, no viewing window. Own it forever and watch at your own pace.",
  },
  {
    icon: "📋",
    title: "The Interconnected Companion Guide",
    desc: "Episode-by-episode action steps, key takeaways, and protocols from all 70 experts.",
  },
  {
    icon: "🌿",
    title: "The Gut Restoration Starter Protocol",
    desc: "Dr. Shojai's 30-day reset plan — the exact protocol he uses with patients.",
  },
  {
    icon: "👥",
    title: "Private Community Access",
    desc: "Join thousands of members on the same healing journey. Accountability, Q&A, and peer support.",
  },
  {
    icon: "🎓",
    title: 'BONUS: "The 5 Root Causes" Masterclass',
    desc: "A 45-minute deep-dive not included in the free series — Dr. Shojai goes further than he can on camera.",
  },
];

export default function InterconnectedThankYou() {
  const { timeLeft, expired } = useOtoCountdown();
  const [declined, setDeclined] = useState(false);

  // Fire Lead pixel on page load (opt-in confirmed)
  useEffect(() => {
    firePixel("Lead");
  }, []);

  const handleBuyClick = () => {
    // Fire InitiateCheckout before redirecting to Kajabi
    firePixel("InitiateCheckout", { value: 67, currency: "USD", content_name: "Interconnected Complete Healing Protocol" });
    window.location.href = OTO_CHECKOUT_URL;
  };

  const handleDecline = () => {
    setDeclined(true);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* CONFIRMATION HEADER */}
      <section className="bg-teal-900/30 border-b border-teal-800/30 py-8 px-4 text-center">
        <img src={LOGO} alt="The Urban Monk" className="w-32 mx-auto mb-4" />
        <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/40 rounded-full px-5 py-2 mb-4">
          <span className="text-teal-400 text-base font-bold">&#10003;</span>
          <span className="text-teal-300 font-bold text-sm uppercase tracking-widest">You're Registered</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-3 leading-tight">
          Check Your Inbox — Your Access is Confirmed
        </h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          A welcome email is on its way with your link to{" "}
          <strong className="text-teal-400">Interconnected: The Power to Heal From Within</strong>.
        </p>
      </section>

      {/* OTO SECTION */}
      {!declined && (
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">

            {/* One-time offer banner */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center mb-6">
              <p className="text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
                One-Time Offer — This Page Only
              </p>
              <p className="text-white text-xl font-bold leading-snug">
                Before you watch Episode 1, go deeper with the complete protocol.
              </p>
            </div>

            {/* Countdown */}
            {!expired ? (
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-gray-400 text-sm font-semibold">This offer expires in:</span>
                <span className="bg-red-950/70 border border-red-700/50 text-red-300 font-mono font-black text-2xl px-4 py-1.5 rounded-lg tracking-widest">
                  {pad(timeLeft.m)}:{pad(timeLeft.s)}
                </span>
              </div>
            ) : (
              <div className="text-center mb-8">
                <span className="text-red-400 font-bold text-sm">This special offer has expired.</span>
              </div>
            )}

            {/* Product card */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">

              {/* Card header */}
              <div className="bg-gradient-to-r from-teal-950 to-gray-900 px-6 py-5 border-b border-gray-700/40">
                <p className="text-teal-400 text-xs font-black uppercase tracking-widest mb-1">
                  Upgrade Your Experience
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                  Interconnected: The Complete Healing Protocol
                </h2>
                <p className="text-gray-300 text-sm mt-1">
                  Everything you need to go from watching to actually healing.
                </p>
              </div>

              {/* Card body */}
              <div className="p-6 md:p-8">

                {/* What's included */}
                <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-4">
                  Everything Included:
                </p>
                <div className="grid md:grid-cols-2 gap-3 mb-8">
                  {BUNDLE_ITEMS.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                      <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <p className="text-white font-bold text-sm leading-snug mb-0.5">{item.title}</p>
                        <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dr. Shojai quote */}
                <div className="bg-teal-900/20 border-l-4 border-teal-500 rounded-r-xl p-4 mb-8">
                  <p className="text-gray-300 text-sm leading-relaxed italic mb-2">
                    "The series will change how you think about your health. But knowledge without a protocol is just
                    information. This bundle gives you the roadmap to actually use what you learn — and a community
                    to walk the path with you."
                  </p>
                  <p className="text-teal-400 font-bold text-sm">— Dr. Pedram Shojai, OMD</p>
                </div>

                {/* Pricing + CTA */}
                <div className="text-center">
                  <p className="text-gray-500 text-base line-through mb-1">Regular price: $197</p>
                  <p className="text-6xl font-black text-white mb-1">$67</p>
                  <p className="text-teal-400 text-sm font-bold mb-6">
                    One-time payment — you save $130 today only
                  </p>

                  {!expired ? (
                    <button
                      onClick={handleBuyClick}
                      className="w-full max-w-md mx-auto block py-5 px-8 bg-teal-500 hover:bg-teal-400 text-white font-black text-xl rounded-xl uppercase tracking-wide transition-colors shadow-lg shadow-teal-900/40 cursor-pointer"
                    >
                      Yes — Give Me the Complete Protocol
                    </button>
                  ) : (
                    <a
                      href={OTO_CHECKOUT_URL}
                      className="w-full max-w-md mx-auto block py-4 px-8 bg-gray-700 hover:bg-gray-600 text-white font-bold text-base rounded-xl transition-colors"
                    >
                      Get the Complete Protocol (Regular Price)
                    </a>
                  )}

                  <div className="flex items-center justify-center gap-2 mt-4 text-gray-500 text-xs">
                    <span>&#128737;</span>
                    <span>30-Day Money-Back Guarantee — No questions asked</span>
                  </div>

                  <button
                    onClick={handleDecline}
                    className="mt-5 text-gray-600 text-xs hover:text-gray-400 underline block mx-auto"
                  >
                    No thanks — I'll just watch the free series
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* POST-DECLINE SECTION */}
      {declined && (
        <section className="py-16 px-4 text-center">
          <div className="max-w-xl mx-auto">
            <p className="text-gray-400 mb-2">No problem — your free access to all 9 episodes is confirmed.</p>
            <p className="text-gray-500 text-sm mb-8">Check your inbox for your welcome email with the link.</p>
            <a
              href="https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-meta-leads-1"
              className="inline-block py-4 px-10 bg-teal-700 hover:bg-teal-600 text-white font-black text-lg rounded-xl uppercase tracking-wide transition-colors"
            >
              Watch Episode 1 Now
            </a>
          </div>
        </section>
      )}

      {/* SKIP LINK (always visible below OTO) */}
      {!declined && (
        <section className="pb-10 px-4 text-center border-t border-gray-800 pt-8">
          <p className="text-gray-500 text-sm mb-2">Your free access is already confirmed. Ready to start watching?</p>
          <a
            href="https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-meta-leads-1"
            className="text-teal-500 hover:text-teal-400 underline text-sm"
          >
            Take me to Episode 1 without the upgrade
          </a>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8 px-4 text-center">
        <p className="text-gray-700 text-xs max-w-2xl mx-auto mb-2 leading-relaxed">
          THE INFORMATION ON THIS SITE IS FOR EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS MEDICAL ADVICE.
        </p>
        <p className="text-gray-700 text-xs">
          Brought to you by The Urban Monk Productions &copy; {new Date().getFullYear()} All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
