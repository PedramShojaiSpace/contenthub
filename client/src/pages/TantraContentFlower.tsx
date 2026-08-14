/**
 * TantraContentFlower.tsx
 * Content landing page: "Sex Is the Flower"
 * Working-both-sides-to-the-middle piece for retargeting and warm traffic.
 * Video placeholder — swap WISTIA_ID when recording is ready.
 */

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = "093er5q16m";
const QUIZ_URL = "/quiz/tantra";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentFlower() {
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
          Dr. Pedram Shojai, OMD · Taoist Medicine
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: "Georgia, serif" }}>
          Sex Is the Flower:<br />
          <span style={{ color: GOLD_LIGHT }}>The Taoist Approach to Healing a Relationship From the Inside Out</span>
        </h1>

        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          The intimate life of a couple is not separate from their health. It is the flower of it. And when the flower wilts, you don't spray paint it — you look at the roots.
        </p>

        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`}
              title="The Root and the Flower"
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
            In Taoist medicine, we have a saying: the flower tells you everything about the root. If the flower is wilting, you don't spray paint it. You look at the soil, the water, the light. You work on the conditions that allow it to bloom.
          </p>
          <p>
            The intimate life of a couple is the flower of everything else that's working — or not working — in their lives. When two people are sleeping well, eating well, managing stress, feeling purposeful, and emotionally connected, the intimate life tends to take care of itself. It flows naturally.
          </p>
          <p>
            But when any of those roots are disrupted — when the sleep is broken, the stress is chronic, the emotional distance has grown — the flower wilts. And most couples make the mistake of trying to fix the flower directly, without addressing the roots.
          </p>
          <p>
            In my practice, I've worked with couples who came to me specifically about intimacy. And what I always told them was: <strong className="text-white">we're going to work both sides to the middle.</strong>
          </p>
          <p>
            On one side, we address the biology — the hormones, the neurotransmitters, the nervous system, the physical health. Because you cannot will your way to desire when your cortisol is through the roof and your oxytocin is depleted. The body has to be supported.
          </p>
          <p>
            On the other side, we address the relationship itself — the communication, the emotional safety, the daily practices of connection that keep the field alive. Because even perfect biology can't save a relationship where two people have stopped seeing each other.
          </p>
          <p>
            When you work both sides simultaneously, something remarkable happens. The biology improves, which makes the emotional work easier. The emotional work improves, which makes the biology respond better. You meet in the middle. And the flower comes back.
          </p>
        </div>

        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />

        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            The quiz below identifies which side of the equation needs the most attention in your specific situation — and gives you a personalized starting point.
          </p>
          <a
            href={QUIZ_URL}
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
