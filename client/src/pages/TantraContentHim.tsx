/**
 * TantraContentHim.tsx
 * Content landing page: "Why He Stopped Wanting To"
 * Brain-science / melanocortin piece for T-C him-specific ad sets.
 * Video placeholder — swap WISTIA_ID when recording is ready.
 */

import { useTantraContentAttribution } from "@/components/TantraContentAttribution";

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = "kcvtkpe34a";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentHim() {
  const { quizUrl, onQuizCta } = useTantraContentAttribution({ sourcePage: "why-he-stopped", videoId: WISTIA_ID });
  return (
    <div className="min-h-screen text-white font-sans" style={{ background: BG }}>

      <header className="py-4 px-6 flex justify-center border-b border-white/5">
        <div className="flex items-center gap-3" aria-label="The Urban Monk">
          <img src={URBAN_MONK_MARK} alt="" className="h-7 w-7 object-contain" />
          <span className="text-xs font-semibold tracking-[0.28em] text-white/90">THE URBAN MONK</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-12">

        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
          Dr. Pedram Shojai, OMD · Doctor of Oriental Medicine
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: "Georgia, serif" }}>
          Why He Stopped Wanting To:<br />
          <span style={{ color: GOLD_LIGHT }}>The Brain Science Nobody Talks About</span>
        </h1>

        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          It's not age. It's not your partner. It's not who you are. It's a specific biological disruption — and it has a specific solution.
        </p>

        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`}
              title="For Men"
              allow="autoplay; fullscreen"
              allowTransparency
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-white/5">
              <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center" style={{ borderColor: GOLD }}>
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24" style={{ color: GOLD }}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Video coming soon</p>
            </div>
          )}
        </div>

        <div className="prose prose-invert prose-lg max-w-none mb-10 text-gray-300 leading-relaxed space-y-5">
          <p>
            At some point — maybe gradually, maybe suddenly — you noticed that the drive wasn't there anymore. The desire. The initiation. The wanting. And if you're like most men, you either blamed yourself, blamed your partner, or quietly decided this was what getting older meant.
          </p>
          <p>
            None of those explanations are right. Here's what's actually happening.
          </p>
          <p>
            Desire doesn't start in the body. It starts in the brain. Specifically, in the <strong className="text-white">melanocortin pathways</strong> — neural circuits that govern motivation, arousal, and the drive to connect. When those pathways are functioning well, desire is spontaneous and natural. When they're suppressed — by chronic stress, sleep deprivation, elevated cortisol, or the accumulated weight of years of pressure — desire goes quiet.
          </p>
          <p>
            This is not a testosterone problem, though testosterone matters. This is not a circulation problem, though circulation matters. This is a <strong className="text-white">central nervous system problem</strong>. And it requires a central nervous system solution.
          </p>
          <p>
            Most men who go to a doctor about this get one of two things: a testosterone prescription or a PDE5 inhibitor. Both address peripheral symptoms. Neither addresses the brain pathway that actually governs desire.
          </p>
          <p>
            In Taoist medicine, we have a concept of the "jing" — the vital essence — that when depleted, manifests exactly as what you're experiencing. Not just physical depletion. A quieting of the inner fire. The Taoists had protocols for restoring it. Modern research has identified the specific compounds that work on the same pathways through a different mechanism.
          </p>
          <p>
            I've put together a 30-day protocol that addresses all three dimensions: the central nervous system pathway that governs desire, the oxytocin pathway that governs bonding, and the circulatory support that enables physical response. Not a permanent prescription. A chance to feel what's possible when the biology is working in your favor again.
          </p>
        </div>

        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />

        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            The quiz below identifies exactly where the disruption is happening for you specifically — and gives you a personalized starting point.
          </p>
          <a
            href={quizUrl}
            onClick={onQuizCta}
            className="inline-block font-bold text-base px-10 py-4 rounded-full transition-all duration-200"
            style={{ background: GOLD, color: "#0d0d0d" }}
          >
            Take the 2-Minute Quiz →
          </a>
          <p className="text-gray-600 text-xs mt-4">No account required. Takes 2 minutes.</p>
        </div>

      </main>

      <footer className="py-8 px-6 border-t border-white/5 text-center">
        <img src={URBAN_MONK_MARK} alt="" className="h-5 w-5 object-contain mx-auto mb-3 opacity-40" />
        <p className="text-gray-600 text-xs max-w-lg mx-auto">
          Dr. Pedram Shojai, OMD, is a licensed doctor of Oriental medicine, Taoist abbot, and bestselling author. This content is for educational purposes only and does not constitute medical advice.
        </p>
      </footer>

    </div>
  );
}
