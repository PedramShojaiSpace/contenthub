import { useEffect, useState } from "react";
import { buildInterconnectedKlaviyo199CheckoutUrl } from "@/lib/interconnectedKlaviyoCheckout";

const LOGO = "/manus-storage/urban-monk-logo-white_bea7991f.png";
const BG = "#020d18";
const MID = "#0a1520";
const CARD = "#0d1e2e";
const BLUE = "#2e91fc";
const GOLD = "#f5c842";

function firePixel(eventName: string, params?: Record<string, unknown>, eventId?: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      fbq("track", eventName, params || {}, eventId ? { eventID: eventId } : undefined);
    }
  } catch (_) {}
}

const Check = () => (
  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: BLUE }}>✓</span>
);

const SectionTitle = ({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) => (
  <div className="mx-auto mb-8 max-w-3xl text-center">
    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: BLUE }}>{eyebrow}</p>
    <h2 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: "Georgia, serif" }}>{title}</h2>
    {body && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">{body}</p>}
  </div>
);

export default function Interconnected199PostPurchaseKlaviyo() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    firePixel("ViewContent", {
      content_name: "Gut Permeability Test + Health Coach Call — $199 Member Offer",
      content_type: "product",
      value: 199,
      currency: "USD",
    });
  }, []);

  const handleCheckout = () => {
    const eventId = `ic199_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("__capi_checkout_event_id", eventId);
    firePixel("InitiateCheckout", {
      content_name: "Gut Permeability Test + Health Coach Call — $199 Member Offer",
      content_type: "product",
      value: 199,
      currency: "USD",
    }, eventId);
    window.location.href = buildInterconnectedKlaviyo199CheckoutUrl(window.location.search);
  };

  const Cta = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? "text-center" : "mx-auto max-w-2xl text-center"}>
      <button
        type="button"
        onClick={handleCheckout}
        className="w-full rounded-xl px-6 py-5 text-base font-black uppercase tracking-wide text-slate-950 transition-transform hover:scale-[1.02] active:scale-[0.99] md:text-lg"
        style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #e8b800 100%)`, boxShadow: "0 10px 32px rgba(245,200,66,0.28)" }}
      >
        Yes — Claim My $199 Member Offer
      </button>
      <p className="mt-3 text-xs text-slate-400">Secure Shopify checkout · Separate purchase · Opened test kits are final sale</p>
    </div>
  );

  const faqs = [
    {
      q: "What is included in this member offer?",
      a: "This offer includes the Gut Permeability Test kit and a private one-hour health-coach call. After checkout, the Urban Monk team will send the appropriate fulfillment and next-step information.",
    },
    {
      q: "Is this a medical diagnosis or treatment plan?",
      a: "No. The test and health-coach conversation are intended to support an informed next-step discussion. They are not a medical diagnosis, treatment, or guarantee of a particular health outcome. Consult a licensed healthcare professional for medical questions.",
    },
    {
      q: "Why is the offer $199 here?",
      a: "This is a private member offer made available after your Interconnected purchase. The offer is separate from your all-access series purchase and uses its own Shopify checkout.",
    },
    {
      q: "What is the refund policy?",
      a: "Because test kits cannot be resold after they are opened, opened kits are final sale. If you have a question before opening a kit, contact support@theurbanmonk.com first.",
    },
  ];

  return (
    <main className="min-h-screen text-white" style={{ background: BG }}>
      <header className="border-b px-4 py-5 text-center" style={{ background: MID, borderColor: "rgba(46,145,252,0.2)" }}>
        <img src={LOGO} alt="The Urban Monk" className="mx-auto w-36" decoding="async" />
      </header>

      <section className="px-4 py-12 md:py-16" style={{ background: `radial-gradient(circle at top, rgba(46,145,252,0.16), transparent 42%), ${BG}` }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.18em]" style={{ color: GOLD }}>A private next-step offer for Interconnected members</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl" style={{ fontFamily: "Georgia, serif" }}>
              You have the information. Now get a clearer starting point for your next step.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Your all-access series gives you the framework. This member offer adds a Gut Permeability Test kit and a private one-hour health-coach call, so you can move from broad education to a more personal conversation about your next steps.
            </p>
            <div className="mt-8 rounded-2xl border p-6" style={{ background: "rgba(13,30,46,0.9)", borderColor: "rgba(46,145,252,0.65)" }}>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: GOLD }}>Post-purchase member offer</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-xl text-slate-500 line-through">$399</span>
                <span className="text-5xl font-black text-white">$199</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">A separate purchase, offered privately after your $67 Interconnected order.</p>
              <div className="mt-5"><Cta compact /></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-2" style={{ borderColor: BLUE, boxShadow: "0 0 45px rgba(46,145,252,0.18)" }}>
            <div className="wistia_responsive_padding" style={{ padding: "56.25% 0 0 0", position: "relative" }}>
              <div className="wistia_responsive_wrapper" style={{ position: "absolute", inset: 0 }}>
                <iframe
                  src="https://fast.wistia.net/embed/iframe/vvvuj0gexg?seo=true&videoFoam=true"
                  title="Gut Permeability Test and Health Coach Member Offer"
                  allow="autoplay; fullscreen"
                  frameBorder={0}
                  scrolling="no"
                  loading="eager"
                  className="wistia_embed"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y px-4 py-14 md:py-20" style={{ background: MID, borderColor: "rgba(46,145,252,0.14)" }}>
        <SectionTitle eyebrow="What this offer includes" title="Two pieces. One more personal next-step conversation." body="The goal is not to replace medical care or make promises. It is to give you a practical starting point and an informed conversation after you have taken in the series." />
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <article className="rounded-2xl border p-7" style={{ background: CARD, borderColor: "rgba(46,145,252,0.26)" }}>
            <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: BLUE }}>01 · At-home kit</p>
            <h3 className="mt-3 text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>Gut Permeability Test</h3>
            <p className="mt-3 leading-relaxed text-slate-300">Receive the test kit as part of your member offer and follow the included instructions before your next-step conversation.</p>
          </article>
          <article className="rounded-2xl border p-7" style={{ background: CARD, borderColor: "rgba(46,145,252,0.26)" }}>
            <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: BLUE }}>02 · Personal guidance</p>
            <h3 className="mt-3 text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>One-Hour Health Coach Call</h3>
            <p className="mt-3 leading-relaxed text-slate-300">A private conversation with a health coach to help you understand the process, organize your questions, and identify appropriate next steps with your healthcare team.</p>
          </article>
        </div>
      </section>

      <section className="px-4 py-14 md:py-20" style={{ background: BG }}>
        <SectionTitle eyebrow="How it works" title="Simple, private, and built around your next question." />
        <ol className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            ["1", "Claim the member offer", "Complete the separate $199 Shopify checkout while this private offer is available."],
            ["2", "Receive your next steps", "The Urban Monk team will provide fulfillment and scheduling information after purchase."],
            ["3", "Use the conversation well", "Bring your questions and your goals to the health-coach call, then discuss medical decisions with your licensed clinician."],
          ].map(([number, title, text]) => (
            <li key={number} className="rounded-2xl border p-7" style={{ background: CARD, borderColor: "rgba(46,145,252,0.2)" }}>
              <span className="text-4xl font-black" style={{ color: GOLD }}>{number}</span>
              <h3 className="mt-4 text-xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y px-4 py-14 md:py-20" style={{ background: MID, borderColor: "rgba(46,145,252,0.14)" }}>
        <div className="mx-auto max-w-3xl rounded-2xl border p-7 md:p-10" style={{ background: CARD, borderColor: "rgba(46,145,252,0.45)" }}>
          <p className="text-center text-xs font-black uppercase tracking-[0.16em]" style={{ color: GOLD }}>Your private Interconnected member offer</p>
          <h2 className="mt-3 text-center text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: "Georgia, serif" }}>Gut Permeability Test + Health Coach Call</h2>
          <ul className="mt-8 space-y-4">
            <li className="flex gap-3 text-slate-200"><Check /><span>Gut Permeability Test kit</span></li>
            <li className="flex gap-3 text-slate-200"><Check /><span>Private one-hour health-coach call</span></li>
            <li className="flex gap-3 text-slate-200"><Check /><span>Clear fulfillment and scheduling next steps after purchase</span></li>
          </ul>
          <div className="my-8 h-px" style={{ background: "rgba(46,145,252,0.25)" }} />
          <div className="mb-7 text-center"><span className="mr-3 text-xl text-slate-500 line-through">$399</span><span className="text-5xl font-black text-white">$199</span></div>
          <Cta />
        </div>
      </section>

      <section className="px-4 py-14 md:py-20" style={{ background: BG }}>
        <SectionTitle eyebrow="Questions, answered" title="Before you decide" />
        <div className="mx-auto max-w-3xl space-y-3">
          {faqs.map((faq, index) => {
            const open = expandedFaq === index;
            return (
              <div key={faq.q} className="rounded-xl border" style={{ background: CARD, borderColor: "rgba(46,145,252,0.2)" }}>
                <button type="button" className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold text-white" onClick={() => setExpandedFaq(open ? null : index)} aria-expanded={open}>
                  <span>{faq.q}</span><span style={{ color: GOLD }}>{open ? "−" : "+"}</span>
                </button>
                {open && <p className="px-5 pb-5 leading-relaxed text-slate-300">{faq.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t px-4 py-10 text-center" style={{ background: MID, borderColor: "rgba(46,145,252,0.14)" }}>
        <Cta />
        <p className="mx-auto mt-8 max-w-3xl text-xs leading-relaxed text-slate-500">This offer is educational and informational in nature. It is not intended to diagnose, treat, cure, or prevent any disease. Always consult a licensed healthcare professional about medical concerns, treatment, and test interpretation.</p>
        <p className="mt-5 text-xs text-slate-600">© 2026 The Urban Monk · All Rights Reserved</p>
      </footer>
    </main>
  );
}
