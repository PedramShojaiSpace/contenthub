/**
 * Content landing page: "Why She Stopped Wanting To"
 * Educational warm-up page for adult relationship and sexual-health awareness.
 * Video placeholder — replace WISTIA_ID after recording is ready.
 */

import { useTantraContentAttribution } from "@/components/TantraContentAttribution";

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = "zpqgfbnjp1";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentWhySheStopped() {
  const { quizUrl, onQuizCta } = useTantraContentAttribution({ sourcePage: "why-she-stopped", videoId: WISTIA_ID });
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
          Why She Stopped<br />
          <span style={{ color: GOLD_LIGHT }}>Wanting To</span>
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          Desire rarely disappears for one simple reason. A calmer, more useful question is what has been asking too much of the body, the mind, and the relationship.
        </p>

        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`} title="Why She Stopped Showing Up" allow="autoplay; fullscreen" allowTransparency className="w-full h-full border-0" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-white/5">
              <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center" style={{ borderColor: GOLD }}>
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24" style={{ color: GOLD }}><path d="M8 5v14l11-7z" /></svg>
              </div>
              <p className="text-sm text-gray-400">Video coming soon</p>
            </div>
          )}
        </div>

        <div className="prose prose-invert prose-lg max-w-none mb-10 text-gray-300 leading-relaxed space-y-5">
          <p>
            Many couples interpret a quieting of desire as a verdict on the relationship. More often, it is a signal that too many systems have been running without enough support. Menopause and hormonal change can affect comfort, sleep, and mood. Digestive stress and inflammation can drain energy. The invisible workload of parenting and managing a household can leave very little room for a person to feel present in her own body.
          </p>
          <p>
            Then there is the relationship itself. Years of rushed connection, misunderstood needs, unfinished conversations, and intimacy that feels like another item on a list can create distance. That distance is not proof that the bond is gone. It is an invitation to become more attentive.
          </p>
          <p>
            In the tantric traditions, sensuality is not an afterthought. It is a way of listening. It asks couples to slow down, communicate, pay attention to comfort and pleasure, and understand that the female experience of intimacy deserves care rather than assumption. Many women have spent years without language for what they need. Many men were never taught how to ask, listen, and respond without defensiveness.
          </p>
          <p>
            The hopeful part is that the path back is usually closer than it appears. It begins with the person sleeping beside you: two people willing to learn a better vocabulary, tend the body, and make room for connection again. No one has to solve everything overnight. The work is to return to each other, one honest conversation and one deliberate practice at a time.
          </p>
        </div>

        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">This two-minute educational quiz offers a practical place to start exploring the connection between wellbeing, confidence, and relationship closeness.</p>
          <a href={quizUrl} onClick={onQuizCta} className="inline-block font-bold text-base px-10 py-4 rounded-full transition-all duration-200" style={{ background: GOLD, color: "#0d0d0d" }}>Take the 2-Minute Quiz →</a>
          <p className="text-gray-600 text-xs mt-4">No account required. Takes 2 minutes.</p>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 text-center">
        <img src={URBAN_MONK_MARK} alt="" className="h-5 w-5 object-contain mx-auto mb-3 opacity-40" />
        <p className="text-gray-600 text-xs max-w-lg mx-auto">Dr. Pedram Shojai, OMD, is a licensed doctor of Oriental medicine, Taoist abbot, and bestselling author. This content is for educational purposes only and does not constitute medical advice.</p>
      </footer>
    </div>
  );
}
