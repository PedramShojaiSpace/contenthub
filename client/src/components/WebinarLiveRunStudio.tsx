import { useMemo } from "react";
import { Copy, ExternalLink, FileDown, Layers3, MessageSquareQuote, MoonStar, Presentation, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildLiveRunBrief, makeIntelligenceDigest } from "@/lib/webinarLiveRunConfig";
import { toast } from "sonner";

type IntelligenceRecord = {
  responseCount?: number | null;
  extractedThemes?: string | null;
  extractedQuestions?: string | null;
  extractedLanguage?: string | null;
  extractedAt?: Date | string | null;
};

export function WebinarLiveRunStudio({
  webinarSessionId,
  topic,
  registrationUrl,
  onUseProfile,
}: {
  webinarSessionId: number | null;
  topic: string;
  registrationUrl: string;
  onUseProfile: (profile: "upstream" | "sleep") => void;
}) {
  const { data: records = [] } = trpc.webinarIntelligence.listBySession.useQuery(
    { webinarSessionId: webinarSessionId ?? -1 },
    { enabled: webinarSessionId !== null }
  );

  const extractedRecords = useMemo(
    () => (records as IntelligenceRecord[]).filter((record) => Boolean(record.extractedAt)),
    [records]
  );
  const digest = useMemo(() => makeIntelligenceDigest(extractedRecords), [extractedRecords]);
  const brief = useMemo(() => buildLiveRunBrief(topic, digest), [topic, digest]);
  const hasSelectedSession = webinarSessionId !== null;

  const copyBrief = () => {
    const text = [
      brief.headline,
      "",
      brief.principle,
      "",
      "TYPEFORM-INFORMED REFRESH PLAN",
      ...brief.refreshPlan.map((item) => `• ${item.title}: ${item.guidance}\n  ${item.source}`),
      "",
      "RUN OF SHOW",
      ...brief.operatorChecklist.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Live webinar run brief copied");
  };

  return (
    <section className="mb-6 overflow-hidden border border-[#d4af37]/35 bg-[#0d2818] text-white">
      <div className="relative border-b border-[#d4af37]/25 px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_5%,rgba(212,175,55,0.16),transparent_42%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#d4af37]">
              <Presentation className="h-3.5 w-3.5" />
              {brief.profile.eyebrow}
            </div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-white md:text-3xl">{brief.headline}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{brief.principle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUseProfile("upstream")}
                className={`border-[#d4af37]/40 bg-transparent text-[#f4d77f] hover:bg-[#d4af37]/10 hover:text-[#f4d77f] ${brief.profile.key === "upstream" ? "bg-[#d4af37]/12" : ""}`}
              >
                <Sprout className="mr-1.5 h-3.5 w-3.5" />
                Use Upstream base
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUseProfile("sleep")}
                className={`border-[#d4af37]/40 bg-transparent text-[#f4d77f] hover:bg-[#d4af37]/10 hover:text-[#f4d77f] ${brief.profile.key === "sleep" ? "bg-[#d4af37]/12" : ""}`}
              >
                <MoonStar className="mr-1.5 h-3.5 w-3.5" />
                Use Sleep base
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/webinar-intelligence" className="inline-flex">
              <Button variant="outline" size="sm" className="border-[#d4af37]/40 bg-transparent text-[#f4d77f] hover:bg-[#d4af37]/10 hover:text-[#f4d77f]">
                <MessageSquareQuote className="mr-1.5 h-3.5 w-3.5" />
                Typeform intelligence
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </Button>
            </a>
            <Button size="sm" onClick={copyBrief} className="bg-[#d4af37] text-[#0d2818] hover:bg-[#eed37a]">
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy live-run brief
            </Button>
          </div>
        </div>
      </div>

      <div className="grid border-b border-[#d4af37]/20 lg:grid-cols-[1.04fr_1.35fr]">
        <div className="border-b border-[#d4af37]/20 px-6 py-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4af37]">
            <Layers3 className="h-3.5 w-3.5" />
            Base deck — preserve
          </div>
          <p className="font-serif text-xl text-white">{brief.profile.baseDeck}</p>
          <p className="mt-2 text-sm leading-6 text-white/55">{brief.profile.purpose}</p>
          <p className={`mt-3 inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${brief.profile.assetStatus === "verified" ? "border-emerald-300/35 text-emerald-200" : "border-[#d4af37]/35 text-[#f4d77f]"}`}>
            {brief.profile.assetStatus === "verified" ? "Base deck verified" : "Reference asset needed"}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/50">{brief.profile.assetNote}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
            <span>{brief.profile.sourceDeck.slideCount} slides · {brief.profile.sourceDeck.format}</span>
            {brief.profile.sourceDeck.managedAssetPath && (
              <a href={brief.profile.sourceDeck.managedAssetPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#f4d77f] underline underline-offset-4">
                <FileDown className="h-3.5 w-3.5" />
                Open source deck
              </a>
            )}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {brief.profile.visualSystem.map((item) => (
              <div key={item} className="border-t border-[#d4af37]/20 pt-2 text-xs leading-5 text-white/65">{item}</div>
            ))}
          </div>
          <div className="mt-5 border-t border-[#d4af37]/20 pt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4af37]">Stable foundation</p>
            <ul className="space-y-1.5 text-sm text-white/70">
              {brief.profile.foundationSlides.map((slide) => <li key={slide}>— {slide}</li>)}
            </ul>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4af37]">
              <Sparkles className="h-3.5 w-3.5" />
              Session refresh — Typeform informed
            </div>
            <span className="border border-[#d4af37]/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f4d77f]">
              {hasSelectedSession
                ? `${digest.responseCount} responses · ${digest.importCount} analyzed import${digest.importCount === 1 ? "" : "s"}`
                : "Select a saved webinar to load intelligence"}
            </span>
          </div>
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {brief.refreshPlan.map((item, index) => (
              <div key={item.title} className="border-t border-white/12 pt-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-serif text-lg text-[#d4af37]">0{index + 1}</span>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                </div>
                <p className="text-xs leading-5 text-white/55">{item.guidance}</p>
                <p className="mt-2 text-xs leading-5 text-[#f4d77f]">{item.source}</p>
              </div>
            ))}
          </div>
          {hasSelectedSession && (
            <div className="mt-5 border-t border-[#d4af37]/20 pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4af37]">Typeform signals in this session</p>
              {digest.importCount === 0 ? (
                <p className="text-xs leading-5 text-white/55">No extracted Typeform record is attached to this webinar yet. Open Webinar Intelligence to import and extract the next response set.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Themes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {digest.themes.length > 0 ? digest.themes.map((theme) => <span key={theme} className="border border-white/15 px-2 py-1 text-xs text-white/75">{theme}</span>) : <span className="text-xs text-white/45">No extracted themes yet.</span>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Repeated questions</p>
                    <div className="space-y-1.5">
                      {digest.questions.length > 0 ? digest.questions.map((question) => <p key={question} className="text-xs leading-5 text-white/75">“{question}”</p>) : <span className="text-xs text-white/45">No extracted questions yet.</span>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Exact audience language</p>
                    <div className="space-y-1.5">
                      {digest.audienceLanguage.length > 0 ? digest.audienceLanguage.map((language) => <p key={language} className="text-xs leading-5 text-[#f4d77f]">“{language}”</p>) : <span className="text-xs text-white/45">No extracted language yet.</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-[#d4af37] px-6 py-3 text-[#0d2818] md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-5"><strong>Safe repeat rule:</strong> use the Typeform data to update the four marked moments only. The core narrative, science, visual foundation, offer architecture, and Zoom delivery deck remain intact.</p>
        </div>
        {registrationUrl && (
          <a href={registrationUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold underline underline-offset-4">Open Zoom registration</a>
        )}
      </div>
    </section>
  );
}
