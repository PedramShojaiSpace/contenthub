/**
 * Interconnected Thank-You — Static HTML OTO Page
 * Served at /interconnected/thank-you — bypasses the React SPA bundle entirely.
 * Mobile PageSpeed target: 80+
 * No React, no 324KB CSS bundle, no framework overhead.
 */

export function renderInterconnectedThankYouPage(): string {
  const CDN = "/manus-storage/";
  const LOGO = CDN + "urban-monk-logo-white_bea7991f.png";
  const OTO_URL = "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout";
  const year = new Date().getFullYear();

  const BUNDLE_ITEMS = [
    { text: "Instant, On-Demand Access to All 9 Episodes of Interconnected — yours forever, no viewing window", value: null },
    { text: "The Interconnected Companion Guide — episode-by-episode protocols and action steps from all 70 experts", value: "$97" },
    { text: "The Gut Restoration Starter Protocol — Dr. Shojai's 30-day reset plan used with his own patients", value: "$79" },
    { text: "Private Healing Community Access — thousands of members on the same journey, with weekly Q&A", value: "$197/yr" },
    { text: 'BONUS: "The 5 Root Causes" Masterclass — a 45-minute deep-dive not available in the free series', value: "$99" },
  ];

  const EXPERTS = [
    { name: "Mark Hyman, MD", title: "Director of the Cleveland Clinic Center for Functional Medicine · 14× NYT Bestselling Author", bio: "One of the most influential physicians in America, Dr. Hyman has treated over 10,000 patients using functional medicine principles. His work on the gut-brain connection and food as medicine has been featured in the New York Times, CNN, and Time Magazine.", img: CDN + "mark-hyman-md_59f25bf6.jpg", quote: "The gut is the gateway to health. When the gut is broken, everything breaks down — the brain, the immune system, the hormones. Fix the gut and you fix the patient." },
    { name: "Zach Bush, MD", title: "Triple Board-Certified Physician · Founder of Seraphic Group", bio: "One of the few triple board-certified physicians in the US (internal medicine, endocrinology, and hospice care), Dr. Bush's research on the microbiome, glyphosate, and the gut-brain axis has been cited in over 300 peer-reviewed publications.", img: CDN + "zach-bush-md_50a4b43c.jpg", quote: "We are not separate from the ecosystem. The microbiome is the bridge between the soil and the human body. Destroy one and you destroy the other." },
    { name: "Alessio Fassano, MD", title: "Harvard Medical School · Discoverer of Zonulin · World Authority on Gut Permeability", bio: "The researcher who discovered zonulin — the molecule that controls intestinal permeability — Dr. Fassano's work has fundamentally changed how medicine understands autoimmune disease. His lab at Harvard has published over 300 peer-reviewed papers on the gut barrier.", img: CDN + "alessio-fassano-md_6d7caa9a.jpg", quote: "Leaky gut is not a fringe concept. It is the mechanism behind virtually every autoimmune condition we see in clinical practice." },
    { name: "Datis Kharrazian, PhD", title: "Harvard Medical School Research Faculty · Author of Why Isn't My Brain Working?", bio: "Dr. Kharrazian's clinical research on brain health, autoimmunity, and the gut-brain axis has helped thousands of patients recover from conditions conventional medicine deemed untreatable. He trains physicians worldwide in functional neurology.", img: CDN + "datis-kharrazian-phd-dhsc_eec6ace2.jpg", quote: "Most brain disorders begin in the gut. The gut-brain axis is not a metaphor — it is a literal two-way highway of inflammation, neurotransmitters, and immune signals." },
    { name: "Emeran Mayer, MD", title: "UCLA David Geffen School of Medicine · Author of The Mind-Gut Connection", bio: "A pioneer in the neuroscience of the gut-brain axis, Dr. Mayer has spent 40 years studying how the gut communicates with the brain. His bestselling book The Mind-Gut Connection has changed how millions of people understand their own bodies.", img: CDN + "emaren-mayer-md_edf069aa.jpg", quote: "The gut sends 90% of its signals upward to the brain. Your gut feelings are not metaphors — they are real neurological communications that shape your thoughts, emotions, and decisions." },
    { name: "Izabella Wentz, PharmD", title: "NYT Bestselling Author · The Thyroid Pharmacist", bio: "After being diagnosed with Hashimoto's thyroiditis at 27, Dr. Wentz spent years researching the gut-thyroid connection and put her own condition into remission. She has since helped over 100,000 patients do the same through her clinical protocols.", img: CDN + "izabella-wentz-pharm-d_88697c7e.jpg", quote: "I reversed my own Hashimoto's by healing my gut. The thyroid cannot heal in a body with a broken gut barrier — it's that simple." },
    { name: "Martin Blaser, MD", title: "NYU Langone Medical Center · Author of Missing Microbes · Former CDC Advisory Board", bio: "Dr. Blaser's groundbreaking research on H. pylori and the consequences of antibiotic overuse has been published in Science, Nature, and the New England Journal of Medicine. His book Missing Microbes is required reading in medical schools worldwide.", img: CDN + "martin-blaser-md_76654a0c.jpg", quote: "Every course of antibiotics is a mass extinction event in the gut. We are losing ancestral microbial species that took millions of years to evolve — and we may never get them back." },
    { name: "Max Lugavere", title: "Filmmaker · NYT Bestselling Author of Genius Foods · Health Science Journalist", bio: "After watching his mother develop Lewy body dementia, Max Lugavere spent years investigating the dietary and lifestyle factors behind neurodegeneration. His film Bread Head and his books have reached millions of people worldwide.", img: CDN + "max-lugavere_78f23e75.jpg", quote: "The foods that damage the gut are the same foods that damage the brain. There is no separation. What you eat today is literally building or destroying your brain tomorrow." },
  ];

  const EPISODES = [
    { ep: "EPISODE 1", title: "The Gut-Brain Axis: Your Second Brain Is Running the Show", desc: "Dr. Emeran Mayer and Dr. Zach Bush reveal how the 100 trillion microbes in your gut are sending more signals to your brain than your brain sends down — and how a damaged gut lining is at the root of anxiety, depression, brain fog, and autoimmune disease." },
    { ep: "EPISODE 2", title: "The Leaky Gut Epidemic: Why Your Immune System Is Attacking You", desc: "Dr. Alessio Fassano — the Harvard researcher who discovered zonulin — explains the science of intestinal permeability and why it's the hidden driver behind everything from rheumatoid arthritis to Hashimoto's thyroiditis." },
    { ep: "EPISODE 3", title: "The Microbiome Reset: Rebuilding Your Inner Ecosystem", desc: "Dr. Martin Blaser walks through the catastrophic loss of ancestral microbial diversity in modern humans — and the precise protocol for rebuilding a resilient, diverse microbiome that protects you for life." },
    { ep: "EPISODE 4", title: "Food as Medicine: What to Eat to Heal Your Gut", desc: "Dr. Mark Hyman and Max Lugavere break down the research on which foods are silently destroying your gut lining and the specific foods and eating patterns that feed your microbiome and reverse inflammation at the cellular level." },
    { ep: "EPISODE 5", title: "The Thyroid-Gut Connection: Why Your Thyroid Won't Heal Without This", desc: "Dr. Izabella Wentz reveals the overlooked connection between gut dysbiosis and Hashimoto's thyroiditis. This episode gives you the protocol she used to put her own Hashimoto's into remission." },
    { ep: "EPISODE 6", title: "Toxins, Mold, and the Hidden Assaults on Your Microbiome", desc: "Dr. Datis Kharrazian explains how environmental toxins, mold mycotoxins, heavy metals, and EMFs are systematically destroying the gut lining and wiping out beneficial bacteria." },
    { ep: "EPISODE 7", title: "The Nervous System-Gut Loop: How Stress Is Destroying Your Digestion", desc: "Dr. Rangan Chatterjee and Dr. Tom O'Bryan reveal the bidirectional relationship between chronic stress, the vagus nerve, and gut permeability — and give you the tools to break the cycle." },
    { ep: "EPISODE 8", title: "Children's Health: Protecting the Next Generation's Microbiome", desc: "The most urgent episode in the series. Dr. Zach Bush and Dr. Alessio Fassano discuss the alarming rise in childhood autoimmune disease and the direct link to the destruction of the infant microbiome." },
    { ep: "EPISODE 9", title: "The Healing Protocol: Your 90-Day Roadmap to a New Gut", desc: "Dr. Pedram Shojai synthesizes everything from the series into a concrete, step-by-step 90-day healing protocol with specific labs to order, supplements to consider, and lifestyle changes that compound into lasting health." },
  ];

  const REVIEWS = [
    { name: "Sarah M., Austin TX", text: "I've watched dozens of health documentaries. This is the first one that gave me a complete picture AND a clear protocol to follow. My gut issues of 12 years are finally improving." },
    { name: "David K., Portland OR", text: "Dr. Fassano's episode alone was worth 10× the price. I finally understand why my autoimmune condition keeps flaring — and what to actually do about it." },
    { name: "Jennifer L., Nashville TN", text: "My functional medicine doctor recommended this series. After watching all 9 episodes I feel like I have a PhD in gut health. The companion guide is incredible." },
    { name: "Michael R., Denver CO", text: "I was skeptical. I've been told 'your labs are normal' for years while feeling terrible. This series validated everything I suspected and gave me the language to advocate for myself." },
    { name: "Amanda T., Seattle WA", text: "The episode on children's health made me cry. I wish I had seen this before my kids were born. Sharing it with every parent I know." },
    { name: "Robert H., Chicago IL", text: "Dr. Kharrazian's episode on the brain-gut connection was mind-blowing. I've been treating my brain fog for years without addressing the gut. Starting the protocol tomorrow." },
  ];

  const FAQS = [
    { q: "What exactly is Interconnected?", a: "Interconnected is a 9-episode documentary series featuring 70 of the world's leading experts in gut health, functional medicine, and the microbiome. It exposes the root causes of chronic disease and gives you a concrete protocol to heal your gut and reclaim your health." },
    { q: "Why do the free episodes expire after 24 hours?", a: "The free series is designed as a daily event — one episode per day for 9 days. Each episode is available for 24 hours only. The all-access bundle removes this limitation entirely — every episode available forever." },
    { q: "What do I get when I purchase the all-access bundle?", a: "Permanent, on-demand access to all 9 episodes — watch in any order, re-watch as many times as you want, forever. Plus the Companion Guide, the Gut Restoration Starter Protocol, Private Community Access, and the 5 Root Causes Masterclass bonus." },
    { q: "How is the content delivered?", a: "Everything is delivered through the Urban Monk Academy platform (powered by Kajabi). You'll receive login credentials immediately after purchase. The platform is fully mobile-friendly — watch on your phone, tablet, laptop, or smart TV." },
    { q: "Is this medical advice?", a: "No. This documentary series is for educational and informational purposes only. Nothing in Interconnected is intended to diagnose, treat, cure, or prevent any disease. Always consult your licensed healthcare provider before making changes to your health protocols." },
    { q: "What is the refund policy?", a: "We stand behind this series 100%. You have a full 30-day, no-questions-asked money-back guarantee. If it doesn't deliver the clarity and actionable knowledge you expected, contact our support team and we'll refund every penny." },
    { q: "Who is this for?", a: "Anyone who has been told 'your labs are normal' while still feeling terrible — or anyone dealing with chronic fatigue, brain fog, autoimmune conditions, digestive issues, anxiety, or unexplained weight gain. If you're tired of being treated for symptoms instead of root causes, this series was made for you." },
  ];

  const bundleItemsHtml = BUNDLE_ITEMS.map(item => `
    <li class="bundle-item">
      <span class="check-circle"><svg width="14" height="14" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="bundle-text">${item.text}</span>
      ${item.value ? `<span class="value-badge">VALUE: ${item.value}</span>` : ""}
    </li>`).join("");

  const expertCardsHtml = EXPERTS.map(e => `
    <div class="expert-bio-card">
      <div class="expert-bio-img-wrap">
        <img src="${e.img}" alt="${e.name}" loading="lazy" decoding="async" width="96" height="96" />
      </div>
      <div class="expert-bio-content">
        <h3 class="expert-bio-name">${e.name}</h3>
        <p class="expert-bio-title">${e.title}</p>
        <p class="expert-bio-text">${e.bio}</p>
        <div class="expert-bio-quote">"${e.quote}"</div>
      </div>
    </div>`).join("");

  const episodesHtml = EPISODES.map(ep => `
    <div class="episode-card">
      <p class="ep-label">${ep.ep}</p>
      <h3 class="ep-title">${ep.title}</h3>
      <p class="ep-desc">${ep.desc}</p>
    </div>`).join("");

  const reviewsHtml = REVIEWS.map(r => `
    <div class="review-card">
      <div class="stars">★★★★★</div>
      <p class="review-text">"${r.text}"</p>
      <p class="review-name">${r.name}</p>
    </div>`).join("");

  const faqsHtml = FAQS.map((faq, i) => `
    <div class="faq-item" id="faq-${i}">
      <button class="faq-q" onclick="toggleFaq(${i})" aria-expanded="false">
        <span>${faq.q}</span>
        <span class="faq-icon" id="faq-icon-${i}">+</span>
      </button>
      <div class="faq-a" id="faq-a-${i}" style="display:none">
        <p>${faq.a}</p>
      </div>
    </div>`).join("");

  const buyBtn = (label = "YES — Give Me Instant Access to All 9 Episodes") => `
    <div class="buy-wrap">
      <a href="${OTO_URL}" class="buy-btn" onclick="firePixel()">${label}</a>
      <p class="buy-note">🔒 Secure checkout · 30-day money-back guarantee · Instant access · Cancel anytime</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Thank You — Interconnected | The Urban Monk</title>
  <link rel="icon" type="image/x-icon" href="/manus-storage/urban-monk-favicon_27ae5d07.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=optional" rel="stylesheet" />
  <!-- Meta Pixel — fires immediately on TY page (Lead conversion must not be delayed) -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','1498608757116877');
    fbq('track','PageView');
    fbq('track','Lead');
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1498608757116877&ev=Lead&noscript=1"/></noscript>
  <!-- GA4 — deferred -->
  <script defer src="https://www.googletagmanager.com/gtag/js?id=G-CXZK2Q275S"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-CXZK2Q275S');</script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg0:#020d18;
      --bg1:#0a1520;
      --bg2:#0d1e2e;
      --bg3:#051e2e;
      --blue:#2E91FC;
      --blue-dark:#018db1;
      --blue-glow:rgba(46,145,252,0.15);
      --gold:#f5c842;
      --text:#f0f4f8;
      --muted:#9ca3af;
    }
    html{scroll-behavior:smooth}
    body{background:var(--bg0);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}

    /* sticky bar */
    #sticky-bar{position:sticky;top:0;z-index:50;background:var(--bg1);border-bottom:1px solid var(--blue-dark);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    #sticky-bar .label{font-size:.875rem;font-weight:600;color:#d1d5db;display:none}
    @media(min-width:640px){#sticky-bar .label{display:block}}
    .timer-segs{display:flex;align-items:center;gap:4px}
    .timer-seg{display:flex;flex-direction:column;align-items:center}
    .timer-seg .num{background:var(--bg2);border:1px solid var(--blue);border-radius:4px;padding:4px 10px;font-family:monospace;font-size:1.25rem;font-weight:900;color:#fff;min-width:2.5rem;text-align:center}
    .timer-seg .unit{font-size:.65rem;color:#6b7280;margin-top:2px;text-transform:uppercase;letter-spacing:.05em}
    .timer-colon{font-size:1.5rem;font-weight:900;color:var(--blue);margin-bottom:14px}
    .sticky-cta{background:var(--gold);color:#0a0a0a;padding:8px 16px;border-radius:4px;font-weight:900;font-size:.875rem;text-transform:uppercase;text-decoration:none;white-space:nowrap}

    /* header */
    header{padding:24px 16px;text-align:center;background:var(--bg0)}
    header img{width:144px}

    /* sections */
    section{padding:56px 16px}
    .container{max-width:900px;margin:0 auto}
    .container-sm{max-width:576px;margin:0 auto}
    .section-eyebrow{font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);text-align:center;margin-bottom:8px}
    .section-title{font-size:clamp(1.75rem,3vw,2.5rem);font-weight:900;color:#fff;text-align:center;margin-bottom:32px;font-family:Georgia,serif;line-height:1.2}
    .divider{width:64px;height:4px;background:var(--blue);border-radius:2px;margin:0 auto 32px}

    /* video */
    .video-wrap{position:relative;width:100%;border-radius:12px;overflow:hidden;border:2px solid var(--blue);box-shadow:0 0 40px var(--blue-glow);margin-bottom:32px}
    .video-ratio{padding:56.25% 0 0;position:relative}
    .video-ratio iframe{position:absolute;top:0;left:0;width:100%;height:100%}

    /* countdown block */
    .countdown-block{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin:32px 0}
    .cd-seg{display:flex;flex-direction:column;align-items:center}
    .cd-num{background:var(--bg2);border:2px solid var(--blue);border-radius:8px;padding:12px 16px;font-family:monospace;font-size:2.5rem;font-weight:900;color:#fff;min-width:72px;text-align:center;box-shadow:0 0 20px var(--blue-glow)}
    .cd-unit{font-size:.65rem;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.1em}
    .cd-colon{font-size:2.5rem;font-weight:900;color:var(--blue);margin-bottom:20px}

    /* buy button */
    .buy-wrap{text-align:center;margin:24px 0}
    .buy-btn{display:inline-block;width:100%;max-width:576px;padding:20px 32px;background:linear-gradient(135deg,var(--gold) 0%,#e8b800 100%);color:#0a0a0a;font-weight:900;font-size:1.1rem;text-transform:uppercase;letter-spacing:.04em;border-radius:8px;text-decoration:none;box-shadow:0 8px 32px rgba(245,200,66,0.4)}
    .buy-note{font-size:.75rem;color:#6b7280;margin-top:8px}

    /* bundle */
    .bundle-card{background:var(--bg2);border:1px solid rgba(46,145,252,.2);border-radius:16px;padding:32px}
    .bundle-list{list-style:none;display:flex;flex-direction:column;gap:16px;margin-bottom:32px}
    .bundle-item{display:flex;align-items:flex-start;gap:12px}
    .check-circle{width:24px;height:24px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
    .bundle-text{color:#e5e7eb;font-size:.9375rem;line-height:1.6;flex:1}
    .value-badge{flex-shrink:0;font-size:.75rem;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--blue-glow);color:var(--blue);border:1px solid var(--blue)}
    .shojai-quote{background:var(--bg3);border-left:4px solid var(--blue);border-radius:0 8px 8px 0;padding:16px 20px;margin-top:24px}
    .shojai-quote p{font-style:italic;color:#e5e7eb;font-size:.9375rem;line-height:1.7;margin-bottom:8px}
    .shojai-quote .attr{font-weight:700;font-size:.875rem;color:var(--blue)}

    /* offer card */
    .offer-card{border:2px solid var(--blue);border-radius:16px;overflow:hidden;box-shadow:0 0 60px var(--blue-glow)}
    .offer-header{background:var(--blue);padding:12px 24px;text-align:center;font-weight:900;font-size:.875rem;text-transform:uppercase;letter-spacing:.1em;color:#fff}
    .offer-body{background:var(--bg2);padding:32px 40px}
    .price-old{color:#6b7280;text-decoration:line-through;font-size:1.25rem;text-align:center;margin-bottom:4px}
    .price-new{font-size:4rem;font-weight:900;color:#fff;text-align:center;line-height:1;margin-bottom:4px}
    .price-save{color:var(--gold);font-weight:700;font-size:.875rem;text-align:center;margin-bottom:24px}

    /* expert bios */
    .expert-bio-card{display:flex;flex-direction:column;gap:16px;background:var(--bg2);border:1px solid rgba(46,145,252,.15);border-radius:16px;padding:24px;margin-bottom:16px}
    @media(min-width:640px){.expert-bio-card{flex-direction:row}}
    .expert-bio-img-wrap{width:96px;height:96px;border-radius:50%;overflow:hidden;border:3px solid var(--blue);box-shadow:0 0 20px var(--blue-glow);flex-shrink:0}
    .expert-bio-img-wrap img{width:100%;height:100%;object-fit:cover}
    .expert-bio-name{font-size:1.25rem;font-weight:900;color:#fff;margin-bottom:2px;font-family:Georgia,serif}
    .expert-bio-title{font-size:.8125rem;font-weight:600;color:var(--blue);margin-bottom:12px}
    .expert-bio-text{font-size:.875rem;color:#d1d5db;line-height:1.7;margin-bottom:12px}
    .expert-bio-quote{background:var(--bg3);border-left:3px solid var(--blue);padding:12px 16px;font-style:italic;font-size:.875rem;color:#e5e7eb;line-height:1.7;border-radius:0 6px 6px 0}

    /* episodes */
    .episode-card{background:var(--bg2);border:1px solid rgba(46,145,252,.15);border-radius:12px;padding:24px 32px;margin-bottom:12px}
    .ep-label{font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);margin-bottom:4px}
    .ep-title{font-size:1.125rem;font-weight:700;color:#fff;margin-bottom:8px;font-family:Georgia,serif;line-height:1.3}
    .ep-desc{font-size:.875rem;color:#9ca3af;line-height:1.7}

    /* reviews */
    .reviews-grid{display:grid;gap:16px}
    @media(min-width:640px){.reviews-grid{grid-template-columns:1fr 1fr}}
    .review-card{background:var(--bg2);border:1px solid rgba(46,145,252,.15);border-radius:12px;padding:20px}
    .stars{color:var(--gold);font-size:1rem;margin-bottom:8px}
    .review-text{font-style:italic;color:#e5e7eb;font-size:.875rem;line-height:1.7;margin-bottom:12px}
    .review-name{font-weight:700;font-size:.875rem;color:var(--blue)}

    /* faq */
    .faq-item{background:var(--bg2);border:1px solid rgba(46,145,252,.15);border-radius:12px;overflow:hidden;margin-bottom:8px}
    .faq-q{width:100%;text-align:left;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:none;border:none;color:#fff;font-weight:600;font-size:1rem;cursor:pointer}
    .faq-icon{color:var(--blue);font-size:1.5rem;font-weight:300;flex-shrink:0}
    .faq-a{padding:0 24px 20px;color:#d1d5db;font-size:.875rem;line-height:1.7}

    /* footer */
    footer{background:var(--bg1);border-top:1px solid rgba(46,145,252,.1);padding:32px 16px;text-align:center}
    footer img{width:96px;opacity:.5;margin:0 auto 16px;display:block}
    .footer-legal{color:#4b5563;font-size:.75rem;max-width:672px;margin:0 auto 8px;line-height:1.6}
  </style>
</head>
<body>

<!-- STICKY BAR -->
<div id="sticky-bar">
  <span class="label">Act Fast — Your Discount Expires In:</span>
  <div class="timer-segs">
    <div class="timer-seg"><span class="num" id="s-h">--</span><span class="unit">HRS</span></div>
    <span class="timer-colon">:</span>
    <div class="timer-seg"><span class="num" id="s-m">--</span><span class="unit">MIN</span></div>
    <span class="timer-colon">:</span>
    <div class="timer-seg"><span class="num" id="s-s">--</span><span class="unit">SEC</span></div>
  </div>
  <a href="${OTO_URL}" class="sticky-cta" onclick="firePixel()">Get Full Access</a>
</div>

<!-- HEADER -->
<header>
  <img src="${LOGO}" alt="The Urban Monk" width="144" height="40" fetchpriority="high" />
</header>

<!-- HERO / VIDEO -->
<section style="background:var(--bg0);padding-top:16px">
  <div class="container-sm">
    <p style="text-align:center;font-size:.875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);margin-bottom:8px">⚠️ IMPORTANT — Read This Before You Leave</p>
    <h1 class="section-title" style="margin-bottom:8px">You're In. But You're About to Miss the Most Important Part.</h1>
    <p style="text-align:center;color:#fca5a5;font-weight:600;font-size:1rem;margin-bottom:24px">This offer only appears once — and it disappears when you close this tab.</p>
    <!-- Wistia click-to-play facade: zero network cost until user taps play -->
    <div class="video-wrap" id="wistia-facade" onclick="loadWistia()" style="cursor:pointer;position:relative">
     <div class="video-ratio" style="background:#020d18">
        <!-- Wistia serves its own poster/thumbnail — no custom image needed -->
        <div id="wistia-thumb" style="position:absolute;top:0;left:0;width:100%;height:100%;background:#020d18"></div>
        <!-- Play button overlay -->
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;background:rgba(46,145,252,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 32px rgba(46,145,252,0.5);pointer-events:none">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <!-- Actual iframe — injected on click only -->
        <div id="wistia-player" style="position:absolute;top:0;left:0;width:100%;height:100%;display:none"></div>
      </div>
    </div>
    <p style="color:#d1d5db;font-size:1.1rem;line-height:1.7;margin-bottom:20px;text-align:center">
      ✅ You're confirmed for <strong style="color:var(--blue)">Interconnected: The Power to Heal From Within</strong>. Your first episode drops tomorrow.
    </p>
    <p style="color:#d1d5db;font-size:1.1rem;line-height:1.7;margin-bottom:20px;text-align:center">
      <strong>Here's the problem:</strong> Each of the 9 episodes is only available for <strong>24 hours</strong>. Miss a day — miss that episode. <em style="color:#fca5a5">There is no replay. There is no catch-up. It's gone.</em>
    </p>
    <p style="color:#d1d5db;font-size:1.1rem;line-height:1.7;margin-bottom:16px;text-align:center">
      <strong style="color:#fff">Dr. Pedram recorded a short message for you</strong> — watch it now to understand why this matters and what to do next:
    </p>
    <p style="text-align:center;color:#d1d5db;font-size:1rem;line-height:1.7;margin-bottom:16px;margin-top:8px">👆 <strong>Watch that video.</strong> Then scroll down and grab the all-access bundle before the timer hits zero — this price disappears with it.</p>
    <p style="text-align:center;font-weight:700;font-size:.875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);margin-bottom:4px">⏱ This Special Offer Expires In…</p>
    <div class="countdown-block">
      <div class="cd-seg"><div class="cd-num" id="cd-h">--</div><div class="cd-unit">HOURS</div></div>
      <span class="cd-colon">:</span>
      <div class="cd-seg"><div class="cd-num" id="cd-m">--</div><div class="cd-unit">MINUTES</div></div>
      <span class="cd-colon">:</span>
      <div class="cd-seg"><div class="cd-num" id="cd-s">--</div><div class="cd-unit">SECONDS</div></div>
    </div>
  </div>
</section>

<!-- WHAT YOU GET -->
<section style="background:var(--bg1);border-top:1px solid rgba(46,145,252,.12);border-bottom:1px solid rgba(46,145,252,.12)">
  <div class="container-sm">
    <p class="section-eyebrow">Only available on this page — never offered again at this price</p>
    <h2 class="section-title">Lock In Permanent Access to All 9 Episodes — Right Now</h2>
    <p style="text-align:center;color:#d1d5db;font-size:1rem;line-height:1.7;margin-bottom:32px">You've already done the hard part — you signed up. Don't let a missed day cost you the episode you needed most. Here's everything you get when you secure your all-access bundle today:</p>
    <div class="bundle-card">
      <ul class="bundle-list">${bundleItemsHtml}</ul>
      <div class="shojai-quote">
        <p>"The series will change how you think about your health. But knowledge without a protocol is just information. This bundle gives you the roadmap to actually use what you learn — and a community to walk the path with you."</p>
        <p class="attr">— Dr. Pedram Shojai, OMD</p>
      </div>
    </div>
    ${buyBtn()}
  </div>
</section>

<!-- OFFER CARD 1 -->
<section id="offer" style="background:var(--bg0);content-visibility:auto;contain-intrinsic-size:0 800px">
  <div class="container-sm">
    <p class="section-eyebrow">Choose Your Access Below</p>
    <h2 class="section-title">Interconnected: The Complete Healing Series</h2>
    <div class="offer-card">
      <div class="offer-header">All-Access Bundle — Today Only</div>
      <div class="offer-body">
        <div style="text-align:center;margin-bottom:8px">
          <span style="text-decoration:line-through;color:#6b7280;font-size:1rem">Regular price: $197</span>
        </div>
        <p class="price-new">$67</p>
        <p class="price-save">💰 You save $130 — but only while the timer above is running</p>
        <p style="text-align:center;color:#fca5a5;font-size:.875rem;font-weight:600;margin-bottom:20px">⚠️ This price is only available on this page. Once you leave, it's gone.</p>
        <p style="text-align:center;font-weight:700;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);margin-bottom:20px">Here's What You'll Receive:</p>
        <ul class="bundle-list">${bundleItemsHtml}</ul>
        ${buyBtn("YES — Give Me Instant Access Now")}
      </div>
    </div>
  </div>
</section>

<!-- EXPERT BIOS -->
<section style="background:var(--bg1);border-top:1px solid rgba(46,145,252,.12);border-bottom:1px solid rgba(46,145,252,.12);content-visibility:auto;contain-intrinsic-size:0 1200px">
  <div class="container">
    <p class="section-eyebrow">These are the experts you wish you had "on call"…</p>
    <h2 class="section-title">70 World-Class Experts. One Series.</h2>
    ${expertCardsHtml}
  </div>
</section>

<!-- EPISODES -->
<section style="background:var(--bg0);content-visibility:auto;contain-intrinsic-size:0 1000px">
  <div class="container">
    <p class="section-eyebrow">The Groundbreaking Series Brought to You by The Urban Monk</p>
    <h2 class="section-title">9 Episodes That Will Change Everything You Know About Your Health</h2>
    ${episodesHtml}
    ${buyBtn("Yes, I'm Ready to Unlock the Whole Series Now")}
  </div>
</section>

<!-- REVIEWS -->
<section style="background:var(--bg1);border-top:1px solid rgba(46,145,252,.12);border-bottom:1px solid rgba(46,145,252,.12);content-visibility:auto;contain-intrinsic-size:0 800px">
  <div class="container">
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px">
      <span style="color:var(--gold);font-size:1.5rem">★★★★★</span>
      <p style="font-weight:900;font-size:1.5rem;color:#fff">4.9 out of 5 Stars</p>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:.875rem;margin-bottom:40px">Based on viewer ratings from the free series</p>
    <div class="reviews-grid">${reviewsHtml}</div>
    ${buyBtn()}
  </div>
</section>

<!-- SECOND OFFER CARD -->
<section style="background:var(--bg0);content-visibility:auto;contain-intrinsic-size:0 700px">
  <div class="container-sm">
    <p style="text-align:center;font-weight:700;font-size:.875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);margin-bottom:8px">Act Fast — This Special Offer Expires In…</p>
    <div class="countdown-block">
      <div class="cd-seg"><div class="cd-num" id="cd2-h">--</div><div class="cd-unit">HOURS</div></div>
      <span class="cd-colon">:</span>
      <div class="cd-seg"><div class="cd-num" id="cd2-m">--</div><div class="cd-unit">MINUTES</div></div>
      <span class="cd-colon">:</span>
      <div class="cd-seg"><div class="cd-num" id="cd2-s">--</div><div class="cd-unit">SECONDS</div></div>
    </div>
    <div class="offer-card">
      <div class="offer-header">All-Access Bundle — $67 One-Time · This Page Only</div>
      <div class="offer-body">
        <ul class="bundle-list">${bundleItemsHtml}</ul>
        ${buyBtn("YES — I Want Instant Access to All 9 Episodes")}
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section style="background:var(--bg1);border-top:1px solid rgba(46,145,252,.12);border-bottom:1px solid rgba(46,145,252,.12);content-visibility:auto;contain-intrinsic-size:0 600px">
  <div class="container-sm">
    <h2 class="section-title">Frequently Asked Questions</h2>
    ${faqsHtml}
    ${buyBtn("Yes, I'm Ready to Unlock The Whole Series Now")}
  </div>
</section>

<!-- FINAL CTA -->
<section style="background:var(--bg0);content-visibility:auto;contain-intrinsic-size:0 300px">
  <div class="container-sm" style="text-align:center">
    <p style="color:#fca5a5;font-size:.875rem;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:16px">⚠️ Final Warning — Timer Is Running</p>
    <h2 class="section-title">This Is the Last Time You'll See This Price</h2>
    <p style="color:#d1d5db;font-size:1rem;line-height:1.7;margin-bottom:24px">When the timer hits zero, the $67 price expires and this page will no longer offer the bundle. You'll have watched the series — but without the protocols, the companion guide, and the community to actually implement what you learned.</p>
    ${buyBtn("YES — Give Me Instant Access to All 9 Episodes")}
    <p style="color:#374151;font-size:.75rem;margin-top:16px;max-width:448px;margin-left:auto;margin-right:auto">30-day money-back guarantee. No questions asked. Instant access delivered to your inbox.</p>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <img src="${LOGO}" alt="The Urban Monk" loading="lazy" width="96" height="28" />
  <p class="footer-legal">This documentary series is for educational and informational purposes only. Nothing in Interconnected is intended to diagnose, treat, cure, or prevent any disease. Always consult your licensed healthcare provider before making changes to your diet, supplements, medications, or health protocols.</p>
  <p class="footer-legal" style="color:#374151">© ${year} The Urban Monk · All Rights Reserved</p>
</footer>

<script>
// ── Countdown ────────────────────────────────────────────────────────────────
(function() {
  var KEY = 'ic_ty_end_6480';
  var stored = sessionStorage.getItem(KEY);
  var end;
  if (stored) { end = parseInt(stored, 10); }
  else { end = Date.now() + 6480 * 1000; sessionStorage.setItem(KEY, end); }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var diff = Math.max(0, end - Date.now());
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var ids = [['s-h','s-m','s-s'],['cd-h','cd-m','cd-s'],['cd2-h','cd2-m','cd2-s']];
    ids.forEach(function(group) {
      var el0 = document.getElementById(group[0]);
      var el1 = document.getElementById(group[1]);
      var el2 = document.getElementById(group[2]);
      if (el0) el0.textContent = pad(h);
      if (el1) el1.textContent = pad(m);
      if (el2) el2.textContent = pad(s);
    });
  }
  tick();
  setInterval(tick, 1000);
})();

// ── FAQ Toggle ───────────────────────────────────────────────────────────────
function toggleFaq(i) {
  var a = document.getElementById('faq-a-' + i);
  var icon = document.getElementById('faq-icon-' + i);
  var btn = a && a.previousElementSibling;
  if (!a) return;
  var open = a.style.display === 'block';
  a.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '+' : '−';
  if (btn) btn.setAttribute('aria-expanded', String(!open));
}

// ── A/B Test Tracking ────────────────────────────────────────────────────────
// The static TY page bypasses the React SPA, so we call assignVariant directly.
// Video A (control) = hobj7srg3q | Video B (treatment) = 10cdtpm3il
var TY_AB_TEST_ID = 1;
var VIDEO_A = 'hobj7srg3q';
var VIDEO_B = '10cdtpm3il';
var currentVideoId = VIDEO_A; // default; updated after variant assignment

function getOrCreateVisitorId() {
  var key = 'ty_visitor_id';
  var id = localStorage.getItem(key);
  if (!id) {
    id = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, id);
  }
  return id;
}

function getCachedTyVariant() {
  var v = localStorage.getItem('ty_ab_variant');
  return (v === 'A' || v === 'B') ? v : null;
}

(function initAbTracking() {
  var visitorId = getOrCreateVisitorId();
  var cached = getCachedTyVariant();

  function applyVariant(variant, variantId) {
    localStorage.setItem('ty_ab_variant', variant);
    sessionStorage.setItem('__ab_variant_id', String(variantId));
    currentVideoId = variant === 'B' ? VIDEO_B : VIDEO_A;
   // Update the thumb src if Wistia hasn't loaded yet
    // Thumbnail removed — Wistia serves its own poster on load
  }

  if (cached) {
    // Sticky: re-apply cached variant without a new API call
    applyVariant(cached, cached === 'B' ? 2 : 1);
    return;
  }

  // New visitor — call assignVariant to get a fresh 50/50 assignment
  var params = new URLSearchParams(window.location.search);
  var lpVariant = localStorage.getItem('ic_lp_variant') || 'unknown';
  var baseCampaign = params.get('utm_campaign') || 'organic';
  var campaignWithLp = lpVariant !== 'unknown' ? baseCampaign + '__lp_' + lpVariant : baseCampaign;

  var payload = JSON.stringify({
    json: {
      testId: TY_AB_TEST_ID,
      visitorId: visitorId,
      utmSource: params.get('utm_source') || undefined,
      utmCampaign: campaignWithLp
    }
  });

  fetch('/api/trpc/abTest.assignVariant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: payload
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var result = data && data.result && data.result.data && data.result.data.json;
    if (result) {
      var variant = result.isControl ? 'A' : 'B';
      applyVariant(variant, result.variantId);
    }
  })
  .catch(function() {
    // Fallback: random 50/50
    var fallback = Math.random() < 0.5 ? 'A' : 'B';
    applyVariant(fallback, fallback === 'B' ? 2 : 1);
  });
})();

// ── Wistia click-to-play facade ─────────────────────────────────────────────
var wistiaLoaded = false;
function loadWistia() {
  if (wistiaLoaded) return;
  wistiaLoaded = true;
  var thumb = document.getElementById('wistia-thumb');
  var player = document.getElementById('wistia-player');
  var facade = document.getElementById('wistia-facade');
  if (thumb) thumb.style.display = 'none';
  if (player) player.style.display = 'block';
  if (facade) facade.onclick = null;
  var iframe = document.createElement('iframe');
  // Use the variant-assigned video ID (set by initAbTracking above)
  iframe.src = 'https://fast.wistia.net/embed/iframe/' + currentVideoId + '?seo=true&videoFoam=true&autoPlay=true';
  iframe.title = 'Interconnected Thank You Video';
  iframe.allow = 'autoplay; fullscreen';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('scrolling', 'no');
  iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%';
  if (player) player.appendChild(iframe);
}

// ── Pixel fire on buy click ──────────────────────────────────────────────────
function firePixel() {
  try {
    var fbq = window.fbq;
    if (typeof fbq === 'function') fbq('track', 'InitiateCheckout', { value: 67, currency: 'USD', content_name: 'Interconnected All-Access Bundle' });
  } catch(_) {}

  // Record A/B conversion
  try {
    var storedVariantId = sessionStorage.getItem('__ab_variant_id');
    var vid = getOrCreateVisitorId();
    if (storedVariantId && vid) {
      fetch('/api/trpc/abTest.recordConversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          json: {
            testId: TY_AB_TEST_ID,
            visitorId: vid,
            conversionType: 'checkout_start',
            revenueCents: 6700
          }
        })
      }).catch(function() {});
    }
  } catch(_) {}
}
</script>
</body>
</html>`;
}
