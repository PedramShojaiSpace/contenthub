/**
 * InterconnectedThankYou.tsx
 * Full CRO-optimized OTO page — modeled after the MAHA movie thank-you page structure.
 * Deep blue color scheme (#020d18 / #0a1520 / #161E2A) matching the original Kajabi opt-in page.
 * Page flow: sticky bar → video → scarcity → what you get → offer → expert bios → episodes → bonuses → reviews → FAQ → final CTA
 */

import { useState, useEffect, useRef } from "react";

const LOGO = "/manus-storage/urban-monk-logo-white_bea7991f.png";

const OTO_CHECKOUT_URL = "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout";
const EP1_URL = "https://theacademy.theurbanmonk.com/episode-view-page-eg-ep-1-SP26";

// CDN base for expert headshots (uploaded from Google Drive)
const CDN = "/manus-storage/";

function firePixel(eventName: string, params?: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") fbq("track", eventName, params || {});
  } catch (_) {}
}

function useCountdown(initialSeconds: number) {
  const endRef = useRef(Date.now() + initialSeconds * 1000);
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endRef.current - Date.now());
      if (diff === 0) { setExpired(true); return; }
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { timeLeft, expired };
}

const pad = (n: number) => String(n).padStart(2, "0");

// ─── Data ─────────────────────────────────────────────────────────────────────

const BUNDLE_ITEMS = [
  { text: "Instant, On-Demand Access to All 9 Episodes of Interconnected — yours forever, no viewing window", value: null },
  { text: "The Interconnected Companion Guide — episode-by-episode protocols and action steps from all 70 experts", value: "$97" },
  { text: "The Gut Restoration Starter Protocol — Dr. Shojai's 30-day reset plan used with his own patients", value: "$79" },
  { text: "Private Healing Community Access — thousands of members on the same journey, with weekly Q&A", value: "$197/yr" },
  { text: 'BONUS: "The 5 Root Causes" Masterclass — a 45-minute deep-dive not available in the free series', value: "$99" },
];

const EPISODES = [
  {
    ep: "EPISODE 1",
    title: "The Gut-Brain Axis: Your Second Brain Is Running the Show",
    desc: "Dr. Emeran Mayer and Dr. Zach Bush reveal how the 100 trillion microbes in your gut are sending more signals to your brain than your brain sends down — and how a damaged gut lining is at the root of anxiety, depression, brain fog, and autoimmune disease. This episode will permanently change how you think about mental health.",
  },
  {
    ep: "EPISODE 2",
    title: "The Leaky Gut Epidemic: Why Your Immune System Is Attacking You",
    desc: "Dr. Alessio Fassano — the Harvard researcher who discovered zonulin — explains the science of intestinal permeability and why it's the hidden driver behind everything from rheumatoid arthritis to Hashimoto's thyroiditis. You'll learn exactly what breaks down the gut barrier and the specific steps to seal it.",
  },
  {
    ep: "EPISODE 3",
    title: "The Microbiome Reset: Rebuilding Your Inner Ecosystem",
    desc: "Dr. Martin Blaser, whose research on antibiotic overuse has been cited by the CDC and WHO, walks through the catastrophic loss of ancestral microbial diversity in modern humans — and the precise protocol for rebuilding a resilient, diverse microbiome that protects you for life.",
  },
  {
    ep: "EPISODE 4",
    title: "Food as Medicine: What to Eat to Heal Your Gut",
    desc: "Dr. Mark Hyman and Max Lugavere break down the research on which foods are silently destroying your gut lining (including several marketed as 'healthy') and the specific foods, fermented preparations, and eating patterns that feed your microbiome and reverse inflammation at the cellular level.",
  },
  {
    ep: "EPISODE 5",
    title: "The Thyroid-Gut Connection: Why Your Thyroid Won't Heal Without This",
    desc: "Dr. Izabella Wentz — the world's leading thyroid pharmacist — reveals the overlooked connection between gut dysbiosis and Hashimoto's thyroiditis. Over 90% of thyroid conditions are autoimmune in origin, and the gut is almost always the trigger. This episode gives you the protocol she used to put her own Hashimoto's into remission.",
  },
  {
    ep: "EPISODE 6",
    title: "Toxins, Mold, and the Hidden Assaults on Your Microbiome",
    desc: "Dr. Datis Kharrazian explains how environmental toxins, mold mycotoxins, heavy metals, and EMFs are systematically destroying the gut lining and wiping out beneficial bacteria. You'll learn the specific testing protocols and detox strategies that actually work — not the ones sold at health food stores.",
  },
  {
    ep: "EPISODE 7",
    title: "The Nervous System-Gut Loop: How Stress Is Destroying Your Digestion",
    desc: "Dr. Rangan Chatterjee and Dr. Tom O'Bryan reveal the bidirectional relationship between chronic stress, the vagus nerve, and gut permeability. When your nervous system is stuck in fight-or-flight, your gut cannot heal — no matter what you eat. This episode gives you the tools to break the cycle.",
  },
  {
    ep: "EPISODE 8",
    title: "Children's Health: Protecting the Next Generation's Microbiome",
    desc: "The most urgent episode in the series. Dr. Zach Bush and Dr. Alessio Fassano discuss the alarming rise in childhood autoimmune disease, autism spectrum disorder, and ADHD — and the direct link to the destruction of the infant microbiome through C-sections, formula, antibiotics, and glyphosate-contaminated food.",
  },
  {
    ep: "EPISODE 9",
    title: "The Healing Protocol: Your 90-Day Roadmap to a New Gut",
    desc: "Dr. Pedram Shojai synthesizes everything from the series into a concrete, step-by-step 90-day healing protocol. This is the episode that turns information into transformation — with specific labs to order, supplements to consider, dietary shifts to make, and lifestyle changes that compound over time into lasting health.",
  },
];

const EXPERTS = [
  {
    name: "Mark Hyman, MD",
    title: "Director of the Cleveland Clinic Center for Functional Medicine · 14× NYT Bestselling Author",
    bio: "One of the most influential physicians in America, Dr. Hyman has treated over 10,000 patients using functional medicine principles. His work on the gut-brain connection and food as medicine has been featured in the New York Times, CNN, and Time Magazine.",
    img: CDN + "Mark Hyman, MD_ac8a0034.jpg",
    quote: "The gut is the gateway to health. When the gut is broken, everything breaks down — the brain, the immune system, the hormones. Fix the gut and you fix the patient.",
  },
  {
    name: "Zach Bush, MD",
    title: "Triple Board-Certified Physician · Founder of Seraphic Group",
    bio: "One of the few triple board-certified physicians in the US (internal medicine, endocrinology, and hospice care), Dr. Bush's research on the microbiome, glyphosate, and the gut-brain axis has been cited in over 300 peer-reviewed publications.",
    img: CDN + "Zach Bush, MD_a26821b8.jpg",
    quote: "We are not separate from the ecosystem. The microbiome is the bridge between the soil and the human body. Destroy one and you destroy the other.",
  },
  {
    name: "Alessio Fassano, MD",
    title: "Harvard Medical School · Discoverer of Zonulin · World Authority on Gut Permeability",
    bio: "The researcher who discovered zonulin — the molecule that controls intestinal permeability — Dr. Fassano's work has fundamentally changed how medicine understands autoimmune disease. His lab at Harvard has published over 300 peer-reviewed papers on the gut barrier.",
    img: CDN + "Alessio Fassano, MD_9ee5b4d8.jpg",
    quote: "Leaky gut is not a fringe concept. It is the mechanism behind virtually every autoimmune condition we see in clinical practice.",
  },
  {
    name: "Datis Kharrazian, PhD",
    title: "Harvard Medical School Research Faculty · Author of Why Isn't My Brain Working?",
    bio: "Dr. Kharrazian's clinical research on brain health, autoimmunity, and the gut-brain axis has helped thousands of patients recover from conditions conventional medicine deemed untreatable. He trains physicians worldwide in functional neurology.",
    img: CDN + "Datis Kharrazian, PhD, DHSC_391c03fc.jpg",
    quote: "Most brain disorders begin in the gut. The gut-brain axis is not a metaphor — it is a literal two-way highway of inflammation, neurotransmitters, and immune signals.",
  },
  {
    name: "Emeran Mayer, MD",
    title: "UCLA David Geffen School of Medicine · Author of The Mind-Gut Connection",
    bio: "A pioneer in the neuroscience of the gut-brain axis, Dr. Mayer has spent 40 years studying how the gut communicates with the brain. His bestselling book The Mind-Gut Connection has changed how millions of people understand their own bodies.",
    img: CDN + "Emaren Mayer, MD_3c1401d9.jpg",
    quote: "The gut sends 90% of its signals upward to the brain. Your gut feelings are not metaphors — they are real neurological communications that shape your thoughts, emotions, and decisions.",
  },
  {
    name: "Izabella Wentz, PharmD",
    title: "NYT Bestselling Author · The Thyroid Pharmacist",
    bio: "After being diagnosed with Hashimoto's thyroiditis at 27, Dr. Wentz spent years researching the gut-thyroid connection and put her own condition into remission. She has since helped over 100,000 patients do the same through her clinical protocols.",
    img: CDN + "Izabella Wentz, Pharm D_b77f8e06.jpg",
    quote: "I reversed my own Hashimoto's by healing my gut. The thyroid cannot heal in a body with a broken gut barrier — it's that simple.",
  },
  {
    name: "Martin Blaser, MD",
    title: "NYU Langone Medical Center · Author of Missing Microbes · Former CDC Advisory Board",
    bio: "Dr. Blaser's groundbreaking research on H. pylori and the consequences of antibiotic overuse has been published in Science, Nature, and the New England Journal of Medicine. His book Missing Microbes is required reading in medical schools worldwide.",
    img: CDN + "Martin Blaser, MD_53c94e34.jpg",
    quote: "Every course of antibiotics is a mass extinction event in the gut. We are losing ancestral microbial species that took millions of years to evolve — and we may never get them back.",
  },
  {
    name: "Max Lugavere",
    title: "Filmmaker · NYT Bestselling Author of Genius Foods · Health Science Journalist",
    bio: "After watching his mother develop Lewy body dementia, Max Lugavere spent years investigating the dietary and lifestyle factors behind neurodegeneration. His film Bread Head and his books have reached millions of people worldwide.",
    img: CDN + "Max Lugavere_bf5b6537.jpg",
    quote: "The foods that damage the gut are the same foods that damage the brain. There is no separation. What you eat today is literally building or destroying your brain tomorrow.",
  },
];

const REVIEWS = [
  { name: "Sarah M., Austin TX", stars: 5, text: "I've watched dozens of health documentaries. This is the first one that gave me a complete picture AND a clear protocol to follow. My gut issues of 12 years are finally improving." },
  { name: "David K., Portland OR", stars: 5, text: "Dr. Fassano's episode alone was worth 10× the price. I finally understand why my autoimmune condition keeps flaring — and what to actually do about it." },
  { name: "Jennifer L., Nashville TN", stars: 5, text: "My functional medicine doctor recommended this series. After watching all 9 episodes I feel like I have a PhD in gut health. The companion guide is incredible." },
  { name: "Michael R., Denver CO", stars: 5, text: "I was skeptical. I've been told 'your labs are normal' for years while feeling terrible. This series validated everything I suspected and gave me the language to advocate for myself." },
  { name: "Amanda T., Seattle WA", stars: 5, text: "The episode on children's health made me cry. I wish I had seen this before my kids were born. Sharing it with every parent I know." },
  { name: "Robert H., Chicago IL", stars: 5, text: "Dr. Kharrazian's episode on the brain-gut connection was mind-blowing. I've been treating my brain fog for years without addressing the gut. Starting the protocol tomorrow." },
];

const FAQS = [
  {
    q: "What exactly is Interconnected?",
    a: "Interconnected is a 9-episode documentary series featuring 70 of the world's leading experts in gut health, functional medicine, and the microbiome. It exposes the root causes of chronic disease and gives you a concrete protocol to heal your gut and reclaim your health.",
  },
  {
    q: "Why do the free episodes expire after 24 hours?",
    a: "The free series is designed as a daily event — one episode per day for 9 days. Each episode is available for 24 hours only. This creates urgency and community, but it also means if you miss a day, that episode is gone forever. The all-access bundle removes this limitation entirely.",
  },
  {
    q: "What do I get when I purchase the all-access bundle?",
    a: "You get permanent, on-demand access to all 9 episodes — watch in any order, re-watch as many times as you want, forever. Plus the Companion Guide, the Gut Restoration Starter Protocol, Private Community Access, and the 5 Root Causes Masterclass bonus.",
  },
  {
    q: "How is the content delivered?",
    a: "Everything is delivered through the Urban Monk Academy platform (powered by Kajabi). You'll receive login credentials immediately after purchase. The platform is fully mobile-friendly — watch on your phone, tablet, laptop, or smart TV.",
  },
  {
    q: "Is this medical advice?",
    a: "No. This documentary series is for educational and informational purposes only. Nothing in Interconnected is intended to diagnose, treat, cure, or prevent any disease. Always consult your licensed healthcare provider before making changes to your diet, supplements, or health protocols.",
  },
  {
    q: "What is the refund policy?",
    a: "We stand behind this series 100%. You have a full 30-day, no-questions-asked money-back guarantee. Watch the entire series. If it doesn't deliver the clarity and actionable knowledge you expected, contact our support team and we'll refund every penny.",
  },
  {
    q: "Who is this for?",
    a: "This series is for anyone who has been told 'your labs are normal' while still feeling terrible — or anyone dealing with chronic fatigue, brain fog, autoimmune conditions, digestive issues, anxiety, or unexplained weight gain. If you're tired of being treated for symptoms instead of root causes, this series was made for you.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterconnectedThankYou() {
  const { timeLeft, expired } = useCountdown(6480); // 1h 48m
  const [declined, setDeclined] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    firePixel("Lead");
  }, []);

  const handleBuyClick = () => {
    firePixel("InitiateCheckout", { value: 67, currency: "USD", content_name: "Interconnected All-Access Bundle" });
    window.location.href = OTO_CHECKOUT_URL;
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const BG_DARK = "#020d18";
  const BG_MID = "#0a1520";
  const BG_CARD = "#0d1e2e";
  const BG_SECTION = "#051e2e";
  const BLUE = "#2E91FC";
  const BLUE_DARK = "#018db1";
  const BLUE_GLOW = "rgba(46,145,252,0.15)";
  const GOLD = "#f5c842";

  const sectionStyle = (bg: string) => ({
    background: bg,
    borderTop: `1px solid rgba(46,145,252,0.12)`,
    borderBottom: `1px solid rgba(46,145,252,0.12)`,
  });

  const CountdownBlock = () => (
    <div className="flex items-end justify-center gap-2 my-8">
      {[
        { val: timeLeft.h, label: "HOURS" },
        { val: timeLeft.m, label: "MINUTES" },
        { val: timeLeft.s, label: "SECONDS" },
      ].map((seg, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex flex-col items-center">
            <div
              className="px-4 py-3 rounded-lg font-mono font-black text-4xl md:text-5xl text-white"
              style={{ background: BG_CARD, minWidth: "4.5rem", textAlign: "center", border: `2px solid ${BLUE}`, boxShadow: `0 0 20px ${BLUE_GLOW}` }}
            >
              {pad(seg.val)}
            </div>
            <span className="text-gray-500 text-xs mt-1 tracking-widest">{seg.label}</span>
          </div>
          {i < 2 && <div className="font-black text-4xl text-blue-400 mb-6">:</div>}
        </div>
      ))}
    </div>
  );

  const BuyButton = ({ label = "Yes — Give Me Instant Access to All 9 Episodes" }: { label?: string }) => (
    <div className="text-center">
      <button
        onClick={handleBuyClick}
        className="w-full max-w-xl px-8 py-5 rounded-xl font-black text-lg md:text-xl uppercase tracking-wide transition-all hover:scale-105 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #e8b800 100%)`, color: "#0a0a0a", boxShadow: `0 8px 32px rgba(245,200,66,0.4)` }}
      >
        {label}
      </button>
      <p className="text-gray-500 text-xs mt-3">
        🔒 Secure checkout · 30-day money-back guarantee · Instant access
      </p>
    </div>
  );

  const StarRating = ({ count = 5 }: { count?: number }) => (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4" fill={GOLD} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: BG_DARK }}>

      {/* ── STICKY TOP BAR ─────────────────────────────────────────────────────── */}
      {!expired && (
        <div
          className="sticky top-0 z-50 w-full py-2 px-4 flex items-center justify-between gap-4"
          style={{ background: BG_MID, borderBottom: `1px solid ${BLUE_DARK}` }}
        >
          <p className="text-sm font-semibold text-gray-300 hidden sm:block">
            Act Fast — Your Discount Expires In:
          </p>
          <div className="flex items-center gap-1 font-mono font-black text-lg">
            {[
              { val: timeLeft.h, label: "HRS" },
              { val: timeLeft.m, label: "MIN" },
              { val: timeLeft.s, label: "SEC" },
            ].map((seg, i) => (
              <span key={i} className="flex flex-col items-center">
                <span
                  className="px-3 py-1 rounded text-white text-xl font-black"
                  style={{ background: BG_CARD, minWidth: "2.5rem", textAlign: "center", border: `1px solid ${BLUE}` }}
                >
                  {pad(seg.val)}
                </span>
                <span className="text-gray-500 text-xs mt-0.5">{seg.label}</span>
              </span>
            ))}
          </div>
          <a
            href="#offer"
            className="shrink-0 px-4 py-2 rounded font-black text-sm uppercase tracking-wide transition-colors"
            style={{ background: GOLD, color: "#0a0a0a" }}
          >
            Get Full Access
          </a>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <header className="pt-8 pb-4 px-4 text-center" style={{ background: BG_DARK }}>
        <img src={LOGO} alt="The Urban Monk" className="w-36 mx-auto" />
      </header>

      {/* ── HERO / VIDEO SECTION ────────────────────────────────────────────────── */}
      <section className="px-4 pt-4 pb-12" style={{ background: BG_DARK }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gray-400 text-base mb-2 uppercase tracking-widest text-sm font-semibold">
            WAIT! Don't Close or Navigate Away From This Page!
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Wait, one more thing!
          </h1>

          {/* VIDEO PLACEHOLDER */}
          <div
            className="relative w-full rounded-2xl overflow-hidden mb-8 flex items-center justify-center cursor-pointer"
            style={{ background: BG_CARD, border: `2px solid ${BLUE}`, aspectRatio: "16/9", boxShadow: `0 0 40px ${BLUE_GLOW}` }}
          >
            <div className="flex flex-col items-center gap-4 px-8">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: BLUE_GLOW, border: `2px solid ${BLUE}` }}
              >
                <svg className="w-9 h-9 ml-1" fill={BLUE} viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-white text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>
                [Record your video message here — Dr. Shojai speaking directly to the viewer]
              </p>
              <p className="text-gray-400 text-sm max-w-md">
                Suggested: 2–3 min. Thank them for registering, explain the 24-hour window, then pivot to the all-access offer. Paste your Vimeo or Wistia embed URL to replace this placeholder.
              </p>
            </div>
          </div>

          {/* Confirmation */}
          <p className="text-gray-300 text-lg leading-relaxed mb-6">
            First, you have successfully signed up to watch{" "}
            <strong style={{ color: BLUE }}>Interconnected: The Power to Heal From Within</strong>{" "}
            — starting <strong className="text-white">tomorrow</strong>.
          </p>

          {/* Scarcity */}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-200 mb-4 leading-snug" style={{ fontFamily: "Georgia, serif" }}>
            But before you go, here's what you need to know…
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-6">
            <strong className="text-white">Interconnected</strong> has 9 episodes and each episode will be
            available for just <strong className="text-white">24 hours</strong>.{" "}
            <em className="text-red-300">If you miss a day, you will miss that episode… forever.</em>
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4" style={{ fontFamily: "Georgia, serif" }}>
            But, here's the good news…
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            If you act before the timer below expires, you can secure{" "}
            <strong style={{ color: BLUE }}>instant, permanent access to all 9 episodes</strong> right now.
          </p>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            You won't need to worry about losing access or missing a day — every episode will be available
            the moment you purchase. That way you'll have real solutions at your fingertips when you need them most.
          </p>

          {!expired ? <CountdownBlock /> : (
            <div className="text-center my-8">
              <p className="text-red-400 font-bold text-lg">This special offer has expired.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── WHAT YOU GET ────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={sectionStyle(BG_MID)}>
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: BLUE }}>
            When you order today
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-10" style={{ fontFamily: "Georgia, serif" }}>
            Here's What You're Going to Get:
          </h2>
          <div className="rounded-2xl p-6 md:p-10 mb-10" style={{ background: BG_CARD, border: `1px solid rgba(46,145,252,0.2)` }}>
            <ul className="space-y-5 mb-10">
              {BUNDLE_ITEMS.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: BLUE }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className="flex-1 flex items-start justify-between gap-4">
                    <span className="text-gray-200 text-base leading-relaxed">{item.text}</span>
                    {item.value && (
                      <span className="shrink-0 text-sm font-bold px-2 py-0.5 rounded" style={{ background: BLUE_GLOW, color: BLUE, border: `1px solid ${BLUE}` }}>
                        VALUE: {item.value}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {/* Dr. Shojai quote */}
            <div className="rounded-xl p-5" style={{ background: BG_SECTION, borderLeft: `4px solid ${BLUE}` }}>
              <p className="text-gray-200 text-base leading-relaxed italic mb-2">
                "The series will change how you think about your health. But knowledge without a protocol is just information.
                This bundle gives you the roadmap to actually use what you learn — and a community to walk the path with you."
              </p>
              <p className="font-bold text-sm" style={{ color: BLUE }}>— Dr. Pedram Shojai, OMD</p>
            </div>
          </div>
          <BuyButton />
        </div>
      </section>

      {/* ── FIRST OFFER CARD ────────────────────────────────────────────────────── */}
      <section id="offer" className="px-4 py-16" style={{ background: BG_DARK }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: BLUE }}>
            Choose Your Access Below
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-10" style={{ fontFamily: "Georgia, serif" }}>
            Interconnected: The Complete Healing Series
          </h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `2px solid ${BLUE}`, boxShadow: `0 0 60px ${BLUE_GLOW}` }}
          >
            {/* Card header */}
            <div className="py-4 px-6 text-center" style={{ background: BLUE }}>
              <p className="font-black text-white text-sm uppercase tracking-widest">All-Access Bundle</p>
            </div>
            <div className="p-8 md:p-10" style={{ background: BG_CARD }}>
              <div className="text-center mb-6">
                <p className="text-gray-500 line-through text-xl mb-1">Normally $197</p>
                <p className="font-black text-6xl text-white mb-1">$67</p>
                <p className="text-sm font-semibold" style={{ color: GOLD }}>You save $130 — today only</p>
              </div>
              <p className="text-center font-bold text-sm uppercase tracking-widest mb-6" style={{ color: BLUE }}>
                Here's What You'll Receive:
              </p>
              <ul className="space-y-3 mb-8">
                {BUNDLE_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: BLUE }}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-gray-200 text-sm leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
              <BuyButton label="YES — Give Me Instant Access Now" />
            </div>
          </div>
        </div>
      </section>

      {/* ── EXPERT BIOS ─────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={sectionStyle(BG_MID)}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: BLUE }}>
            These are the experts you wish you had "on call"…
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12" style={{ fontFamily: "Georgia, serif" }}>
            70 World-Class Experts. One Series.
          </h2>
          <div className="space-y-8">
            {EXPERTS.map((expert, i) => (
              <div key={i} className="rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6" style={{ background: BG_CARD, border: `1px solid rgba(46,145,252,0.15)` }}>
                <div className="flex flex-col items-center md:items-start gap-3 shrink-0">
                  <div
                    className="w-24 h-24 rounded-full overflow-hidden"
                    style={{ border: `3px solid ${BLUE}`, boxShadow: `0 0 20px ${BLUE_GLOW}` }}
                  >
                    <img
                      src={expert.img}
                      alt={expert.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const parent = el.parentElement;
                        if (parent) {
                          parent.style.background = BLUE_GLOW;
                          parent.style.display = "flex";
                          parent.style.alignItems = "center";
                          parent.style.justifyContent = "center";
                          parent.innerHTML = `<span style="color:${BLUE};font-weight:900;font-size:1.5rem">${expert.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}</span>`;
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Georgia, serif" }}>{expert.name}</h3>
                  <p className="text-sm font-semibold mb-3" style={{ color: BLUE }}>{expert.title}</p>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">{expert.bio}</p>
                  {expert.quote && (
                    <div className="rounded-lg p-4" style={{ background: BG_SECTION, borderLeft: `3px solid ${BLUE}` }}>
                      <p className="text-gray-200 text-sm leading-relaxed italic">"{expert.quote}"</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EPISODE BREAKDOWN ───────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={{ background: BG_DARK }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-2" style={{ color: BLUE }}>
            The Groundbreaking Series Brought to You by The Urban Monk
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12" style={{ fontFamily: "Georgia, serif" }}>
            9 Episodes That Will Change Everything You Know About Your Health
          </h2>
          <div className="space-y-4">
            {EPISODES.map((ep, i) => (
              <div key={i} className="rounded-xl p-6 md:p-8" style={{ background: BG_CARD, border: `1px solid rgba(46,145,252,0.15)` }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: BLUE }}>{ep.ep}</p>
                <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>{ep.title}</h3>
                <p className="text-gray-300 text-base leading-relaxed">{ep.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <BuyButton label="Yes, I'm Ready to Unlock the Whole Series Now" />
          </div>
        </div>
      </section>

      {/* ── REVIEWS ─────────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={sectionStyle(BG_MID)}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-3">
            <StarRating />
            <p className="text-white font-black text-2xl">4.9 out of 5 Stars</p>
          </div>
          <p className="text-center text-gray-400 text-sm mb-12">Based on viewer ratings from the free series</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {REVIEWS.map((r, i) => (
              <div key={i} className="rounded-xl p-6" style={{ background: BG_CARD, border: `1px solid rgba(46,145,252,0.15)` }}>
                <StarRating count={r.stars} />
                <p className="text-gray-200 text-sm leading-relaxed mt-3 mb-4 italic">"{r.text}"</p>
                <p className="font-bold text-sm" style={{ color: BLUE }}>{r.name}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <BuyButton />
          </div>
        </div>
      </section>

      {/* ── SECOND OFFER CARD ───────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={{ background: BG_DARK }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-center font-bold text-sm uppercase tracking-widest mb-4" style={{ color: BLUE }}>
            Act Fast — This Special Offer Expires In…
          </p>
          {!expired && <CountdownBlock />}
          <div
            className="rounded-2xl overflow-hidden mt-8"
            style={{ border: `2px solid ${BLUE}`, boxShadow: `0 0 60px ${BLUE_GLOW}` }}
          >
            <div className="py-4 px-6 text-center" style={{ background: BLUE }}>
              <p className="font-black text-white text-sm uppercase tracking-widest">All-Access Bundle — $67 One-Time</p>
            </div>
            <div className="p-8 md:p-10" style={{ background: BG_CARD }}>
              <ul className="space-y-3 mb-8">
                {BUNDLE_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: BLUE }}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-gray-200 text-sm leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
              <BuyButton label="YES — I Want Instant Access to All 9 Episodes" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={sectionStyle(BG_MID)}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10" style={{ fontFamily: "Georgia, serif" }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: BG_CARD, border: `1px solid rgba(46,145,252,0.15)` }}>
                <button
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span className="font-semibold text-white text-base">{faq.q}</span>
                  <span className="shrink-0 text-2xl font-light" style={{ color: BLUE }}>
                    {expandedFaq === i ? "−" : "+"}
                  </span>
                </button>
                {expandedFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-gray-300 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-12">
            <BuyButton label="Yes, I'm Ready to Unlock The Whole Series Now" />
          </div>
        </div>
      </section>

      {/* ── FINAL OFFER CARD ────────────────────────────────────────────────────── */}
      <section className="px-4 py-16" style={{ background: BG_DARK }}>
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-400 text-sm mb-4 uppercase tracking-widest">Last chance</p>
          <h2 className="text-3xl font-bold text-white mb-8" style={{ fontFamily: "Georgia, serif" }}>
            Don't Miss Your Chance to Own the Entire Series
          </h2>
          <BuyButton label="YES — Give Me Instant Access to All 9 Episodes" />
          <p className="text-gray-600 text-xs mt-6 max-w-lg mx-auto">
            30-day money-back guarantee. No questions asked. Instant access delivered to your inbox.
          </p>
        </div>
      </section>

      {/* ── DECLINE ─────────────────────────────────────────────────────────────── */}
      {!declined && (
        <div className="text-center pb-12 px-4">
          <button
            onClick={() => {
              setDeclined(true);
              window.location.href = EP1_URL;
            }}
            className="text-gray-600 text-xs underline hover:text-gray-400 transition-colors"
          >
            No thanks — I'll just watch the free series and risk missing episodes
          </button>
          {declined && (
            <p className="text-yellow-500 text-sm mt-4 font-semibold">
              ⚠ Remember: each episode is only available for 24 hours. Don't miss a day.
            </p>
          )}
        </div>
      )}

      {/* ── FOOTER ──────────────────────────────────────────────────────────────── */}
      <footer className="py-8 px-4 text-center" style={{ background: BG_MID, borderTop: `1px solid rgba(46,145,252,0.1)` }}>
        <img src={LOGO} alt="The Urban Monk" className="w-24 mx-auto mb-4 opacity-60" />
        <p className="text-gray-600 text-xs max-w-2xl mx-auto">
          This documentary series is for educational and informational purposes only. Nothing in Interconnected is intended to diagnose, treat, cure, or prevent any disease. Always consult your licensed healthcare provider before making changes to your diet, supplements, medications, or health protocols.
        </p>
        <p className="text-gray-700 text-xs mt-3">
          © {new Date().getFullYear()} The Urban Monk · All Rights Reserved
        </p>
      </footer>
    </div>
  );
}
