import { useState, useEffect, useRef } from "react";

const LOGO = "https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2158994062/settings_images/66115c4-003e-6c04-6630-3f5a15f47141_250aa8b0-new-logo-tagline-white.png";
const DOCTOR_PHOTO = "/manus-storage/pedram-white-coat_7321e611.webp";

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

// OTO product details
const OTO = {
  name: "Gut Health Starter Kit",
  tagline: "The First Step to Healing Your Microbiome",
  originalPrice: "$299",
  salePrice: "$199",
  savings: "$100",
  url: "https://shop.theurbanmonk.com/products/kbmo-fit-22-gut-permeability-test-kit-with-consultation",
  bullets: [
    "KBMO FIT 22 Gut Permeability Test — tests for 22 common foods, zonulin, occludin, LPS, and candida",
    "30-minute consultation with a certified health coach to review your results",
    "Personalized protocol based on YOUR unique gut data — not a generic plan",
    "Access to the Upstream course modules for implementing your results",
    "Ships directly to your door — complete the test at home in minutes",
  ],
  guarantee: "30-Day Money-Back Guarantee",
};

export default function InterconnectedThankYou() {
  const { timeLeft, expired } = useOtoCountdown();
  const [declined, setDeclined] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* CONFIRMATION HEADER */}
      <section className="bg-teal-900/40 border-b border-teal-800/40 py-8 px-4 text-center">
        <img src={LOGO} alt="The Urban Monk" className="w-32 mx-auto mb-4" />
        <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/40 rounded-full px-4 py-1.5 mb-4">
          <span className="text-teal-400 text-lg">&#10003;</span>
          <span className="text-teal-300 font-bold text-sm uppercase tracking-wide">You're Registered</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-2">
          Check Your Inbox — Episode 1 is Ready
        </h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          Your access to <strong className="text-teal-400">Interconnected: The Power to Heal From Within</strong> has been confirmed.
          A welcome email is on its way.
        </p>
      </section>

      {/* OTO SECTION */}
      {!declined && (
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">

            {/* One-time offer banner */}
            <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 text-center mb-8">
              <p className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-1">
                One-Time Offer — This Page Only
              </p>
              <p className="text-white text-lg font-bold">
                Before you watch Episode 1, there's one thing that will make everything you learn 10x more powerful.
              </p>
            </div>

            {/* Countdown */}
            {!expired ? (
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-gray-400 text-sm font-semibold">This offer expires in:</span>
                <span className="bg-red-900/60 border border-red-700/50 text-red-300 font-mono font-black text-2xl px-4 py-1.5 rounded-lg">
                  {pad(timeLeft.m)}:{pad(timeLeft.s)}
                </span>
              </div>
            ) : (
              <div className="text-center mb-8">
                <span className="text-red-400 font-bold">This special offer has expired.</span>
              </div>
            )}

            {/* Product card */}
            <div className="bg-gray-900 border border-gray-700/60 rounded-2xl overflow-hidden shadow-2xl">

              {/* Card header */}
              <div className="bg-gradient-to-r from-teal-900 to-gray-900 p-6 border-b border-gray-700/40">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl">
                    &#129514;
                  </div>
                  <div>
                    <p className="text-teal-400 text-xs font-black uppercase tracking-widest mb-1">
                      Recommended Next Step
                    </p>
                    <h2 className="text-2xl font-black text-white leading-tight">{OTO.name}</h2>
                    <p className="text-gray-300 text-sm mt-1">{OTO.tagline}</p>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-8 items-start">
                  <div>
                    <p className="text-gray-300 leading-relaxed mb-4">
                      You're about to learn that the microbiome is the root of most chronic disease.
                      But here's what the documentary can't do for you: it can't tell you what's happening
                      inside <em>your</em> gut specifically.
                    </p>
                    <p className="text-gray-300 leading-relaxed mb-4">
                      The KBMO FIT 22 test gives you a precise map of your gut permeability, food sensitivities,
                      and inflammatory markers — so you can apply everything you're about to learn directly to your
                      own biology. This is the test I recommend to every patient before we start any gut protocol.
                    </p>
                    <p className="text-teal-400 font-bold text-sm mb-4">
                      — Dr. Pedram Shojai, OMD
                    </p>

                    <ul className="space-y-2 mb-6">
                      {OTO.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <span className="text-teal-400 mt-0.5 shrink-0 font-bold">&#10003;</span>
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="bg-teal-900/20 border border-teal-800/40 rounded-lg p-3 text-sm text-teal-300 flex items-center gap-2">
                      <span className="text-lg">&#128737;</span>
                      {OTO.guarantee}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <img
                      src={DOCTOR_PHOTO}
                      alt="Dr. Pedram Shojai"
                      className="w-48 rounded-xl object-cover object-top mb-4 border border-gray-700/40"
                      style={{ maxHeight: "220px" }}
                    />

                    {/* Pricing */}
                    <div className="text-center mb-4 w-full">
                      <p className="text-gray-500 text-sm line-through">{OTO.originalPrice}</p>
                      <p className="text-5xl font-black text-white">{OTO.salePrice}</p>
                      <p className="text-teal-400 text-sm font-bold">You save {OTO.savings} today only</p>
                    </div>

                    {/* CTA */}
                    {!expired ? (
                      <a
                        href={OTO.url}
                        className="w-full block text-center py-4 px-6 bg-teal-500 hover:bg-teal-400 text-white font-black text-lg rounded-lg uppercase tracking-wide transition-colors shadow-lg shadow-teal-900/40"
                        style={{ letterSpacing: "0.04em" }}
                      >
                        Yes — Add the Gut Test Kit
                      </a>
                    ) : (
                      <a
                        href={OTO.url}
                        className="w-full block text-center py-4 px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold text-base rounded-lg transition-colors"
                      >
                        Get the Gut Test Kit (Regular Price)
                      </a>
                    )}

                    <button
                      onClick={() => setDeclined(true)}
                      className="mt-3 text-gray-600 text-xs hover:text-gray-400 underline"
                    >
                      No thanks, I'll skip the test and just watch the series
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* POST-DECLINE / WATCH SECTION */}
      {declined && (
        <section className="py-12 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-400 mb-6">No problem — your access to all 9 episodes is confirmed.</p>
            <a
              href="https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-meta-leads-1"
              className="inline-block py-4 px-10 bg-teal-600 hover:bg-teal-500 text-white font-black text-lg rounded-lg uppercase tracking-wide transition-colors"
            >
              Watch Episode 1 Now
            </a>
          </div>
        </section>
      )}

      {/* WATCH CTA (always shown below OTO) */}
      {!declined && (
        <section className="py-10 px-4 text-center border-t border-gray-800">
          <div className="max-w-xl mx-auto">
            <p className="text-gray-400 mb-2 text-sm">Or skip the offer and go straight to the series:</p>
            <a
              href="https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-meta-leads-1"
              className="text-teal-400 hover:text-teal-300 underline text-sm"
            >
              Take me to Episode 1 without the test kit
            </a>
          </div>
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
