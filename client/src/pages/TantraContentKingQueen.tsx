/**
 * TantraContentKingQueen.tsx
 * Content landing page: "The King and the Queen"
 * Orgone / household energy piece for T-A/T-B general couples ad sets.
 * Video placeholder — swap WISTIA_ID when recording is ready.
 */

import { useTantraContentAttribution } from "@/components/TantraContentAttribution";

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = "onvqm5rc7p";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentKingQueen() {
  const { quizUrl, onQuizCta } = useTantraContentAttribution({ sourcePage: "king-and-queen", videoId: WISTIA_ID });
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
          The King and the Queen:<br />
          <span style={{ color: GOLD_LIGHT }}>How the Energy of Your Home Is Built on Love</span>
        </h1>

        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          In Taoist medicine, the household is a living energy field — and the couple at its center is the source of everything that flows through it.
        </p>

        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`}
              title="The King and the Queen"
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
            There's a concept in Taoist medicine that doesn't have a perfect translation in English. The closest I can get is this: the home is a living energy field. And at the center of that field — the source of its vitality — is the relationship between the man and the woman.
          </p>
          <p>
            The Taoists called this the "inner chamber." And they understood something that took me years of clinical practice to fully appreciate: when the inner chamber is alive, everything in the household thrives. When it goes dark, everything suffers.
          </p>
          <p>
            Think about a home where the couple is genuinely connected — warmth, laughter, physical affection, a sense of being on the same team. Children in that home feel safe. Work feels meaningful. Challenges feel manageable. The field is alive.
          </p>
          <p>
            Now think about a home where the couple has gone cold. Where they coexist but don't connect. The children feel it. The work suffers. The health suffers. The field has collapsed.
          </p>
          <p>
            In my clinic, I've seen this pattern hundreds of times. And the collapse almost never happens because the love died. It happens because life — stress, children, work, illness, financial pressure — systematically disrupts the <strong className="text-white">biology of connection</strong>.
          </p>
          <p>
            Cortisol suppresses desire. Sleep deprivation kills oxytocin. Chronic stress rewires the nervous system away from bonding and toward survival. Slowly, without either person choosing it, the inner chamber goes dark.
          </p>
          <p>
            This is not a character failure. It is a biological event. And biological events can be addressed.
          </p>
          <p>
            The Taoist physicians had protocols for exactly this — approaches designed to rekindle the specific energies that make connection possible. Modern medicine has given us tools that work on the same pathways through different mechanisms. When you address the neuroscience of desire, the biochemistry of bonding, and the physiology of physical response together, you give the inner chamber a chance to come back to life.
          </p>
        </div>

        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />

        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            The quiz below helps identify which specific pathways are most disrupted in your relationship — and where to start rebuilding.
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
