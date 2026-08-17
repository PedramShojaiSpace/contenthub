/**
 * TantraContentLoveBank.tsx
 * Content landing page: "The Love Bank"
 * Relationship-resilience warm-up page for general couples and retargeting.
 * Video placeholder — swap WISTIA_ID when recording is ready.
 */

import { useTantraContentAttribution } from "@/components/TantraContentAttribution";

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = "w2aws6tqfv";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentLoveBank() {
  const { quizUrl, onQuizCta } = useTantraContentAttribution({ sourcePage: "love-bank", videoId: WISTIA_ID });
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
          The Love Bank:<br />
          <span style={{ color: GOLD_LIGHT }}>Why Regular Lovemaking Gives a Relationship a Longer Fuse</span>
        </h1>

        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          Life will always bring pressure. The question is whether your relationship has built enough warmth, tolerance, and connection to ride through it together.
        </p>

        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe
              src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`}
              title="Love Bank Account"
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
            Every long relationship eventually meets rough weather. Work gets demanding. A parent gets sick. Money gets tight. A child is struggling. Sleep disappears. None of this means the relationship is broken. It means life is happening.
          </p>
          <p>
            The question is whether the two of you have built enough of a reserve to meet that pressure without turning on each other.
          </p>
          <p>
            I call that reserve the <strong className="text-white">love bank</strong>. It is made of small things: warmth, eye contact, affection, shared laughter, the sense that you are on the same team. And one of the most powerful ways a couple deposits into that bank is regular, mutually wanted lovemaking.
          </p>
          <p>
            Lovemaking is not a reward you earn after the house is quiet and every problem has been solved. It is a practice that helps two people remember that they belong to each other while life is still messy. It builds tolerance. It softens the sharp edges of a hard week. It gives the relationship a longer fuse.
          </p>
          <p>
            When a couple has not been connected for a long time, the smallest irritation can become evidence that the whole thing is failing. But when there is a living current of affection and intimacy, those same rough spots are easier to hold in proportion. You still have hard conversations. You still disagree. You simply have more goodwill to draw on while you work through them.
          </p>
          <p>
            This is not about performing perfection, keeping score, or forcing anything. It is about tending the bond on purpose — before the crisis comes — so the relationship has somewhere to stand when it does.
          </p>
          <p>
            And if desire, connection, or physical confidence has gone quiet, that does not mean you have failed. It means the roots need attention. The right place to begin is understanding which part of the connection has been disrupted for you.
          </p>
        </div>

        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />

        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            This two-minute quiz helps identify where desire, connection, and confidence may have gone quiet — and gives you a practical place to begin rebuilding.
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
