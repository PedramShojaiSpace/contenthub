/**
 * Reviewable public prototype for the clinician-guided hormone-health pathway.
 * This page is intentionally educational and non-diagnostic until a dedicated
 * scheduling/referral workflow is configured with the clinical operations team.
 */

const URBAN_MONK_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/The_Urban_Monk-Icon-Yin_90acff39.png";
const QUIZ_URL = "/quiz/tantra";
const FIT22_URL = "https://shop.theurbanmonk.com/products/kbmo-fit-22-gut-permeability-test-kit-with-consultation";
const BG = "#0d0d0d";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e8c97e";

export default function TantraHormoneHealthPathway() {
  return (
    <div className="min-h-screen text-white font-sans" style={{ background: BG }}>
      <header className="py-4 px-6 flex justify-center border-b border-white/5">
        <div className="flex items-center gap-3" aria-label="The Urban Monk">
          <img src={URBAN_MONK_MARK} alt="" className="h-7 w-7 object-contain" />
          <span className="text-xs font-semibold tracking-[0.28em] text-white/90">THE URBAN MONK</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12 md:py-16">
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
          Hormone health · clinician-guided starting point
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-5" style={{ fontFamily: "Georgia, serif" }}>
          When something has changed,<br />
          <span style={{ color: GOLD_LIGHT }}>start with a better conversation.</span>
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mb-8">
          Changes in sleep, mood, energy, cycles, body composition, or intimacy can have many explanations. This pathway is designed to help you organize the right next conversation with a licensed clinician—not to label, diagnose, or self-treat a condition.
        </p>

        <div className="border rounded-2xl p-5 md:p-6 mb-10" style={{ borderColor: `${GOLD}66`, background: "rgba(201,168,76,0.08)" }}>
          <p className="text-white text-sm font-semibold mb-2">Important context</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            A quiz or online page cannot diagnose a hormone condition, determine menopausal status, or tell you which tests or treatments are right for you. A licensed clinician should review your history and decide what, if anything, is clinically appropriate.
          </p>
        </div>

        <section className="grid gap-5 mb-12" aria-label="Hormone pathway steps">
          <PathStep number="1" title="Recognize the pattern without jumping to a conclusion">
            Use the Tantra quiz to capture the changes you have noticed. The information is held as a care-pathway signal so the appropriate follow-up team can understand the context, not as a diagnosis.
          </PathStep>
          <PathStep number="2" title="Start with a clinician-guided review">
            A clinician can look at symptoms, history, medications, sleep, stress, nutrition, and life stage together. From there, the clinician can determine whether additional assessment, including a hormone panel, is appropriate.
          </PathStep>
          <PathStep number="3" title="Use optional information thoughtfully">
            Some people want a broader health baseline to discuss with their clinician. Fit22 is an optional food-sensitivity and gut-permeability resource; it is not a hormone assay and it does not diagnose a hormone condition.
          </PathStep>
          <PathStep number="4" title="Build a plan around the full picture">
            The right next step may include lifestyle support, relationship support, an appropriate medical evaluation, or a combination. The goal is more clarity—not a one-size-fits-all product path.
          </PathStep>
        </section>

        <section className="border-t border-white/10 pt-10 mb-12">
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>How this will connect to the care team</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="font-semibold text-white mb-2">Quiz pathway</p>
              <p className="text-gray-400 leading-relaxed">Hormone-context responses create a hormone-health pathway tag alongside the person’s intimacy path.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="font-semibold text-white mb-2">Clinical review</p>
              <p className="text-gray-400 leading-relaxed">The future scheduling and referral step will give the clinical or health-coach team the context needed for appropriate follow-up.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="font-semibold text-white mb-2">Appropriate next step</p>
              <p className="text-gray-400 leading-relaxed">A clinician—not the quiz—will determine whether further testing, a hormone panel, or another care path makes sense.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 p-6 md:p-8 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>Choose your starting point</h2>
          <p className="text-gray-300 text-sm leading-relaxed max-w-xl mx-auto mb-6">
            Begin with the quiz if you have not completed it. If you are already looking for an optional baseline resource to bring into a broader clinician conversation, review Fit22. Clinical scheduling will be added only after the specific operating workflow is approved.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <a href={QUIZ_URL} className="inline-flex justify-center items-center font-bold px-7 py-3.5 rounded-full" style={{ background: GOLD, color: BG }}>
              Take the 2-Minute Quiz →
            </a>
            <a href={FIT22_URL} target="_blank" rel="noopener noreferrer" className="inline-flex justify-center items-center font-semibold border border-white/25 text-white px-7 py-3.5 rounded-full hover:bg-white/5">
              Explore the Optional Fit22 Resource
            </a>
          </div>
          <p className="text-gray-500 text-xs mt-5">No clinical appointment is booked from this page. A dedicated clinician-referral and scheduling flow is the next operational build.</p>
        </section>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 text-center">
        <img src={URBAN_MONK_MARK} alt="" className="h-5 w-5 object-contain mx-auto mb-3 opacity-40" />
        <p className="text-gray-600 text-xs max-w-xl mx-auto">Educational content only. It is not medical advice, diagnosis, or treatment. Speak with a qualified clinician about symptoms, testing, and treatment decisions.</p>
      </footer>
    </div>
  );
}

function PathStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <article className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6">
      <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold" style={{ background: "rgba(201,168,76,0.15)", border: `1px solid ${GOLD}66`, color: GOLD_LIGHT }}>{number}</div>
      <div>
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-300 text-sm leading-relaxed">{children}</p>
      </div>
    </article>
  );
}
