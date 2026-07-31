import { useEffect } from "react";

const LOGO = "/manus-storage/urban-monk-logo-white_bea7991f.png";

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

export default function InterconnectedPurchased() {
  // Fire Purchase pixel once on page load
  useEffect(() => {
    firePixel("Purchase", {
      value: 67,
      currency: "USD",
      content_name: "Interconnected Complete Healing Protocol",
      content_type: "product",
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">

      {/* HEADER */}
      <section className="bg-teal-900/30 border-b border-teal-800/30 py-10 px-4 text-center">
        <img src={LOGO} alt="The Urban Monk" className="w-32 mx-auto mb-5" />
        <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/40 rounded-full px-5 py-2 mb-5">
          <span className="text-teal-400 text-base font-bold">&#10003;</span>
          <span className="text-teal-300 font-bold text-sm uppercase tracking-widest">Purchase Confirmed</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-3 leading-tight">
          Welcome to the Complete Healing Protocol
        </h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          Your order is confirmed. Check your inbox — Kajabi will send your access link within the next few minutes.
        </p>
      </section>

      {/* WHAT HAPPENS NEXT */}
      <section className="py-12 px-4 flex-grow">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-black text-white mb-6 text-center uppercase tracking-wide">
            What Happens Next
          </h2>
          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Check Your Email",
                desc: "You will receive a Kajabi email within the next few minutes with your login link and access to all content.",
              },
              {
                step: "2",
                title: "Start with Episode 1",
                desc: "The 9-episode series is ready to watch. Your companion guide and protocol are inside your member area.",
              },
              {
                step: "3",
                title: "Join the Community",
                desc: "Your private community access is included. Introduce yourself and connect with others on the same journey.",
              },
              {
                step: "4",
                title: "Watch the Bonus Masterclass",
                desc: "\"The 5 Root Causes\" masterclass is pinned at the top of your member area — start there for the deepest dive.",
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4 bg-gray-900 border border-gray-700/40 rounded-xl p-5">
                <div className="shrink-0 w-9 h-9 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-black text-sm">
                  {item.step}
                </div>
                <div>
                  <p className="text-white font-bold mb-0.5">{item.title}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="https://theacademy.theurbanmonk.com/products/interconnected-series-the-power-to-heal-from-within-test-kit"
              className="inline-block py-4 px-10 bg-teal-600 hover:bg-teal-500 text-white font-black text-lg rounded-xl uppercase tracking-wide transition-colors"
            >
              Go to My Member Area
            </a>
          </div>
        </div>
      </section>

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
