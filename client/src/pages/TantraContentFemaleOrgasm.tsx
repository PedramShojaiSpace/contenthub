/**
 * Content landing page: "The Female Orgasm"
 * Educational warm-up page for adult relationship and sexual-health awareness.
 * Video placeholder — replace WISTIA_ID after recording is ready.
 */

import { useTantraContentAttribution } from "@/components/TantraContentAttribution";

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const WISTIA_ID = "1foy9s4idy";

const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraContentFemaleOrgasm() {
  const { quizUrl, onQuizCta } = useTantraContentAttribution({ sourcePage: "female-orgasm", videoId: WISTIA_ID });
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
          The Female Orgasm:<br />
          <span style={{ color: GOLD_LIGHT }}>The Missing Ingredient in Western Sexuality</span>
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          A relationship changes when intimacy becomes a shared practice of attention, communication, and mutual care rather than a performance.
        </p>

        <div className="rounded-xl overflow-hidden border border-white/10 mb-8 bg-black" style={{ aspectRatio: "16/9" }}>
          {WISTIA_ID ? (
            <iframe src={`https://fast.wistia.net/embed/iframe/${WISTIA_ID}?seo=true&videoFoam=true`} title="Ladies First" allow="autoplay; fullscreen" allowTransparency className="w-full h-full border-0" />
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
            Western culture has often taught a narrow, hurried model of sexuality. It can leave women without language for what feels safe, satisfying, and connected, while leaving men without a useful way to listen. Over time, the result is not simply frustration. It can be a gradual dimming of sensuality, curiosity, and closeness.
          </p>
          <p>
            One foundational tantric principle is simple: connection is created through presence. The old image of two serpents rising along the spine is a symbolic way of describing complementary energies meeting in awareness. It is not a performance target. It is an invitation to slow down, breathe, communicate, and treat intimacy as an experience that belongs to both people.
          </p>
          <p>
            In practical terms, that means moving away from assumptions. A couple can learn to ask better questions, make room for comfort and pleasure, and understand that the female experience is not a secondary concern. She comes first in the sense that her safety, pace, and enjoyment are central to the quality of the connection the couple is building together.
          </p>
          <p>
            When that shared attention disappears, sexuality can begin to feel like a task, a negotiation, or a source of disappointment. When it returns, the relationship often has a new place to stand. The first step is not perfection. It is honest education, a little more patience, and a willingness to learn together.
          </p>
        </div>

        <div className="w-12 h-px mx-auto mb-10" style={{ background: GOLD }} />
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">This two-minute educational quiz helps identify a practical starting point for rebuilding wellbeing, confidence, and connection.</p>
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
