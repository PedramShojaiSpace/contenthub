/**
 * TantraContentDivorce.tsx
 * Content landing page: "Considering Divorce? Read This First"
 * Distraction-free warm-up page for T-D/T-E/T-F ad sets.
 * Video placeholder — swap WISTIA_ID when recording is ready.
 */

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = ""; // ← paste Wistia media ID here after recording
const QUIZ_URL = "/quiz/tantra";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentDivorce() {
  return (
    <div className="min-h-screen text-white font-sans" style={{ background: BG }}>

      {/* Minimal header — no nav */}
      <header className="py-4 px-6 flex justify-center border-b border-white/5">
        <div className="flex items-center gap-3" aria-label="The Urban Monk">
          <img src={URBAN_MONK_MARK} alt="" className="h-7 w-7 object-contain" />
          <span className="text-xs font-semibold tracking-[0.28em] text-white/90">THE URBAN MONK</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-12">

        {/* Eyebrow */}
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
          Dr. Pedram Shojai, OMD · Doctor of Oriental Medicine
        </p>

        {/* Headline */}
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: "Georgia, serif" }}>
          Considering Divorce?<br />
          <span style={{ color: GOLD_LIGHT }}>A Doctor's Honest Take on What's Really Happening</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          Before you make any permanent decisions, there's something most couples don't know — and it changes everything.
        </p>

        {/* Video embed */}
        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`}
              title="Considering Divorce? A Doctor's Honest Take"
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

        {/* Written content */}
        <div className="prose prose-invert prose-lg max-w-none mb-10 text-gray-300 leading-relaxed space-y-5">
          <p>
            If you're at the point where divorce feels like the only option, I want you to hear something before you go any further: most couples who end up in divorce court over intimacy and disconnection are not incompatible. They are <strong className="text-white">biologically disrupted</strong>.
          </p>
          <p>
            I know that sounds clinical. But stay with me — because it's actually good news.
          </p>
          <p>
            Here's what happens. Life gets hard. Stress piles up. Cortisol — your stress hormone — goes through the roof. And cortisol is the biological enemy of desire. It doesn't just suppress libido. It suppresses the neurological pathways that make you want to reach for your partner at all. It suppresses oxytocin — the bonding hormone that makes you feel safe with each other. It suppresses the very chemistry that made you fall in love.
          </p>
          <p>
            And then one day you look across the dinner table and you don't feel anything. And you think: the love is gone. But what if it's not? What if the chemistry is just buried under years of stress, disconnection, and a body that's running on empty?
          </p>
          <p>
            In Taoist medicine — which I've practiced for over twenty years — we understand that the intimate life of a couple is not separate from their health. It is the root of it. When the connection between partners is alive, everything in the household thrives. When it goes dark, chaos moves in.
          </p>
          <p>
            Modern research has given us tools to address the specific biological pathways of desire, bonding, and connection. I've put together a short, personalized protocol — a 30-day experiment — for couples who want to give their relationship one more honest chance before making any permanent decisions.
          </p>
          <p>
            I'm not telling you to stay in a bad relationship. I'm telling you to rule out the biology first.
          </p>
        </div>

        {/* Divider */}
        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />

        {/* Soft quiz CTA */}
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            The quiz below takes 2 minutes. It will show you which specific pathway is most disrupted in your situation — and what to do about it.
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

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center">
        <img src={URBAN_MONK_MARK} alt="" className="h-5 w-5 object-contain mx-auto mb-3 opacity-40" />
        <p className="text-gray-600 text-xs max-w-lg mx-auto">
          Dr. Pedram Shojai, OMD, is a licensed doctor of Oriental medicine, Taoist abbot, and bestselling author. This content is for educational purposes only and does not constitute medical advice.
        </p>
      </footer>

    </div>
  );
}
