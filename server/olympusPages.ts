/**
 * Olympus Line Sales Pages
 * CRO-optimized dark navy landing pages for each Olympus SKU.
 * Routes: /olympus, /olympus-plus, /olympus-her, /olympus-her-plus, /olympus-her-max
 * Theme: Dark navy matching get.theurbanmonk.com/program
 * Vendor: Strive Pharmacy (Prescription Compounded Medication)
 */

const FAVICON_ICO = "/manus-storage/urban-monk-favicon_27ae5d07.ico";
const FAVICON_32 = "/manus-storage/urban-monk-favicon-32_ac18d482.png";
const FAVICON_180 = "/manus-storage/urban-monk-favicon-180_7cd1c802.png";
const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/weboflife/logo-yang.png";

interface OlympusProduct {
  title: string;
  subtitle: string;
  tagline: string;
  price: string;
  priceNote: string;
  shopifyHandle: string;
  shopifyUrl: string;
  accentColor: string;
  accentColorLight: string;
  forGender: "men" | "women";
  tier: "base" | "plus" | "max";
  ingredients: Array<{ name: string; dose: string; bullets: string[] }>;
  heroHeadline: string;
  heroBody: string;
  benefits: Array<{ icon: string; title: string; body: string }>;
  howItWorks: string[];
  faqs: Array<{ q: string; a: string }>;
  rxWarning?: string;
  isMaxDose?: boolean;
}

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg-darkest:  #090d1a;
    --bg-dark:     #0f1729;
    --bg-card:     #172038;
    --bg-mid:      #1e2d4a;
    --accent-blue: #2563eb;
    --accent-light:#60a5fa;
    --text-primary:#f0f4ff;
    --text-muted:  #94a3b8;
    --border:      rgba(96,165,250,0.12);
  }
  html { scroll-behavior: smooth; }
  body {
    background: var(--bg-darkest);
    color: var(--text-primary);
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }
  .header {
    padding: 24px;
    display: flex;
    justify-content: center;
    border-bottom: 1px solid var(--border);
    background: var(--bg-darkest);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .header img { height: 32px; width: auto; }
  .eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .section { padding: 72px 24px; max-width: 760px; margin: 0 auto; }
  .section-alt { background: var(--bg-dark); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .section-alt .section-inner { max-width: 760px; margin: 0 auto; padding: 72px 24px; }
  h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 400;
    line-height: 1.2;
    margin-bottom: 16px;
  }
  h3 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(20px, 3.5vw, 28px);
    font-weight: 400;
    margin-bottom: 10px;
  }
  p { font-size: 16px; color: var(--text-muted); line-height: 1.75; margin-bottom: 16px; }
  p:last-child { margin-bottom: 0; }
  .cta-btn {
    display: inline-block;
    padding: 18px 48px;
    background: var(--accent-blue);
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-decoration: none;
    border-radius: 6px;
    -webkit-tap-highlight-color: transparent;
  }
  .cta-btn:hover { background: #1d4ed8; }
  .cta-btn-outline {
    display: inline-block;
    padding: 16px 40px;
    background: transparent;
    color: var(--accent-light);
    border: 1.5px solid var(--accent-blue);
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-decoration: none;
    border-radius: 6px;
    margin-top: 12px;
  }
  .cta-btn-outline:hover { background: rgba(37,99,235,0.12); }
  .rx-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(96,165,250,0.08);
    border: 1px solid rgba(96,165,250,0.2);
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--accent-light);
    margin-bottom: 20px;
  }
  .price-block {
    display: inline-block;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 32px;
    text-align: center;
    margin: 24px 0;
  }
  .price-label { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
  .price-value { font-family: 'Cormorant Garamond', serif; font-size: 48px; font-weight: 600; color: var(--text-primary); line-height: 1; }
  .price-sub { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
  .ingredient-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin: 32px 0; }
  .ingredient-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px 20px;
  }
  .ingredient-name { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 400; margin-bottom: 4px; }
  .ingredient-dose { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 14px; }
  .ingredient-bullets { list-style: none; padding: 0; }
  .ingredient-bullets li { font-size: 13px; color: var(--text-muted); padding: 5px 0 5px 18px; position: relative; border-bottom: 1px solid var(--border); }
  .ingredient-bullets li:last-child { border-bottom: none; }
  .ingredient-bullets li::before { content: '→'; position: absolute; left: 0; color: var(--accent-light); font-weight: 700; }
  .benefits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin: 32px 0; }
  .benefit-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 28px 22px; }
  .benefit-icon { font-size: 28px; margin-bottom: 14px; }
  .benefit-title { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 400; color: var(--text-primary); margin-bottom: 8px; }
  .benefit-body { font-size: 14px; color: var(--text-muted); line-height: 1.65; }
  .steps { list-style: none; padding: 0; margin: 24px 0; counter-reset: steps; }
  .steps li { counter-increment: steps; display: flex; gap: 20px; padding: 20px 0; border-bottom: 1px solid var(--border); }
  .steps li:last-child { border-bottom: none; }
  .step-num { width: 36px; height: 36px; border-radius: 50%; background: var(--accent-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
  .step-body { font-size: 15px; color: var(--text-muted); line-height: 1.7; padding-top: 6px; }
  .faq { margin: 24px 0; }
  .faq-item { border-bottom: 1px solid var(--border); padding: 20px 0; }
  .faq-q { font-family: 'Cormorant Garamond', serif; font-size: 19px; font-weight: 400; color: var(--text-primary); margin-bottom: 10px; }
  .faq-a { font-size: 14px; color: var(--text-muted); line-height: 1.7; }
  .rx-notice {
    background: var(--bg-card);
    border: 1px solid rgba(96,165,250,0.2);
    border-left: 3px solid var(--accent-blue);
    border-radius: 8px;
    padding: 20px 24px;
    margin: 32px 0;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.7;
  }
  .rx-notice strong { color: var(--accent-light); }
  .warning-box {
    background: rgba(251,191,36,0.06);
    border: 1px solid rgba(251,191,36,0.25);
    border-radius: 8px;
    padding: 20px 24px;
    margin: 24px 0;
    font-size: 13px;
    color: #fbbf24;
    line-height: 1.7;
  }
  .warning-box strong { color: #fde68a; }
  .disclaimer {
    background: var(--bg-dark);
    border-top: 1px solid var(--border);
    padding: 40px 24px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.7;
    opacity: 0.7;
  }
  .footer {
    background: var(--bg-darkest);
    padding: 32px 24px;
    text-align: center;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.6;
  }
  .footer a { color: var(--text-muted); text-decoration: none; }
  .footer a:hover { color: var(--accent-light); }
  .sticky-cta {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    z-index: 100;
    backdrop-filter: blur(8px);
  }
  .sticky-cta-text { font-size: 14px; color: var(--text-muted); }
  .sticky-cta-text strong { color: var(--text-primary); }
  .sticky-cta .cta-btn { padding: 12px 28px; font-size: 14px; white-space: nowrap; }
  @media (max-width: 480px) {
    .sticky-cta-text { display: none; }
    .sticky-cta { justify-content: center; }
    .ingredient-grid { grid-template-columns: 1fr; }
    .benefits-grid { grid-template-columns: 1fr; }
  }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.8s ease both; }
  .fade-up-2 { animation-delay: 0.12s; }
  .fade-up-3 { animation-delay: 0.24s; }
`;

function renderOlympusPage(product: OlympusProduct): string {
  const accentStyle = `color: ${product.accentColor}`;
  const accentBorderStyle = `border-color: ${product.accentColor}`;
  const genderLabel = product.forGender === "men" ? "For Men" : "For Women";
  const tierLabel = product.tier === "max" ? "Max Strength" : product.tier === "plus" ? "Enhanced Formula" : "Core Formula";

  const ingredientsHtml = product.ingredients.map(ing => `
    <div class="ingredient-card">
      <div class="ingredient-name" style="${accentStyle}">${ing.name}</div>
      <div class="ingredient-dose">${ing.dose}</div>
      <ul class="ingredient-bullets">
        ${ing.bullets.map(b => `<li>${b}</li>`).join("")}
      </ul>
    </div>
  `).join("");

  const benefitsHtml = product.benefits.map(b => `
    <div class="benefit-card">
      <div class="benefit-icon">${b.icon}</div>
      <div class="benefit-title">${b.title}</div>
      <div class="benefit-body">${b.body}</div>
    </div>
  `).join("");

  const stepsHtml = product.howItWorks.map((step, i) => `
    <li>
      <div class="step-num">${i + 1}</div>
      <div class="step-body">${step}</div>
    </li>
  `).join("");

  const faqsHtml = product.faqs.map(faq => `
    <div class="faq-item">
      <div class="faq-q">${faq.q}</div>
      <div class="faq-a">${faq.a}</div>
    </div>
  `).join("");

  const warningHtml = product.isMaxDose ? `
    <div class="warning-box">
      <strong>⚠️ Established Patients Only.</strong> This is the highest-dose formula in the line. It is intended for patients who have already established tolerance to the standard dose. Begin with the core formula and titrate up with your prescribing provider's guidance.
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${product.title} — The Urban Monk</title>
  <meta name="description" content="${product.tagline}" />
  <link rel="icon" type="image/x-icon" href="${FAVICON_ICO}" />
  <link rel="icon" type="image/png" sizes="32x32" href="${FAVICON_32}" />
  <link rel="apple-touch-icon" sizes="180x180" href="${FAVICON_180}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    ${SHARED_CSS}
    .hero-accent { color: ${product.accentColor}; }
    .ingredient-name { color: ${product.accentColor} !important; }
    .step-num { background: ${product.accentColor} !important; }
    .eyebrow-accent { color: ${product.accentColor}; }
    .rx-badge { color: ${product.accentColor}; border-color: ${product.accentColor}33; background: ${product.accentColor}11; }
  </style>
</head>
<body>

  <!-- Sticky Header -->
  <header class="header">
    <a href="https://theurbanmonk.com" target="_blank" rel="noopener">
      <img src="${LOGO_URL}" alt="The Urban Monk" />
    </a>
  </header>

  <!-- Hero -->
  <section class="section fade-up" style="text-align:center; padding-top:80px; padding-bottom:80px;">
    <div class="rx-badge">⚕️ Strive Pharmacy &nbsp;·&nbsp; ${genderLabel} &nbsp;·&nbsp; ${tierLabel}</div>
    <h1 style="font-family:'Cormorant Garamond',serif; font-size:clamp(42px,9vw,72px); font-weight:300; line-height:1.08; letter-spacing:-0.01em; margin-bottom:20px;">
      <span class="hero-accent">${product.title}</span>
    </h1>
    <p class="eyebrow eyebrow-accent" style="font-size:13px; margin-bottom:0;">${product.subtitle}</p>
    <p style="font-size:18px; color:var(--text-muted); max-width:560px; margin:20px auto 0; line-height:1.7;">${product.tagline}</p>
    <div class="price-block fade-up fade-up-2">
      <div class="price-label">Retail Price — 12 Tablets / 1 Month Supply</div>
      <div class="price-value">${product.price}</div>
      <div class="price-sub">${product.priceNote}</div>
    </div>
    <div style="margin-top:8px;">
      <a href="${product.shopifyUrl}" class="cta-btn fade-up fade-up-3" target="_blank" rel="noopener">
        Get ${product.title} &rarr;
      </a>
    </div>
    <p style="font-size:12px; color:var(--text-muted); margin-top:14px; opacity:0.7;">Prescription required · Ships direct from Strive Pharmacy · 3 refills available</p>
  </section>

  <!-- Rx Notice -->
  <div style="max-width:760px; margin:0 auto; padding:0 24px;">
    <div class="rx-notice">
      <strong>Prescription Compounded Medication.</strong> ${product.title} is dispensed by Strive Pharmacy, a licensed compounding pharmacy. A valid prescription is required. Our clinical team will review your intake form and issue a prescription if appropriate. You do not need to see a doctor separately — the consultation is included in the process.
    </div>
    ${warningHtml}
  </div>

  <!-- What It Does -->
  <section class="section">
    <p class="eyebrow eyebrow-accent">What It Does</p>
    <h2>${product.heroHeadline}</h2>
    <p style="font-size:17px; color:var(--text-muted); line-height:1.8;">${product.heroBody}</p>
  </section>

  <!-- Benefits -->
  <div class="section-alt">
    <div class="section-inner">
      <p class="eyebrow eyebrow-accent">Why It Works</p>
      <h2>The Benefits</h2>
      <div class="benefits-grid">
        ${benefitsHtml}
      </div>
    </div>
  </div>

  <!-- Ingredients -->
  <section class="section">
    <p class="eyebrow eyebrow-accent">The Formula</p>
    <h2>Active Ingredients</h2>
    <div class="ingredient-grid">
      ${ingredientsHtml}
    </div>
  </section>

  <!-- How It Works -->
  <div class="section-alt">
    <div class="section-inner">
      <p class="eyebrow eyebrow-accent">The Process</p>
      <h2>How It Works</h2>
      <ol class="steps">
        ${stepsHtml}
      </ol>
    </div>
  </div>

  <!-- CTA Block -->
  <section class="section" style="text-align:center; background:var(--bg-card); border-top:1px solid var(--border); border-bottom:1px solid var(--border); max-width:100%; padding:80px 24px;">
    <div style="max-width:560px; margin:0 auto;">
      <p class="eyebrow eyebrow-accent">Ready to Begin</p>
      <h2>Start Your ${product.title} Protocol</h2>
      <p style="font-size:16px; color:var(--text-muted); margin-bottom:32px;">Complete your intake form, receive your prescription, and have your formula shipped directly to your door. The entire process takes less than 10 minutes.</p>
      <a href="${product.shopifyUrl}" class="cta-btn" target="_blank" rel="noopener" style="font-size:17px; padding:20px 56px;">
        Get ${product.title} — ${product.price} &rarr;
      </a>
      <br/>
      <a href="https://shop.theurbanmonk.com/collections/olympus" class="cta-btn-outline" target="_blank" rel="noopener">
        Compare All Olympus Formulas
      </a>
      <p style="font-size:12px; color:var(--text-muted); margin-top:20px; opacity:0.7;">Prescription required · 3 refills available · Ships from licensed compounding pharmacy</p>
    </div>
  </section>

  <!-- FAQ -->
  <section class="section">
    <p class="eyebrow eyebrow-accent">Common Questions</p>
    <h2>FAQ</h2>
    <div class="faq">
      ${faqsHtml}
    </div>
  </section>

  <!-- Disclaimer -->
  <div class="disclaimer">
    <div style="max-width:680px; margin:0 auto;">
      <strong style="display:block; margin-bottom:10px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; opacity:1;">Medical Disclaimer</strong>
      ${product.title} is a prescription compounded medication dispensed by Strive Pharmacy, a licensed compounding pharmacy. This product is not FDA-approved as a finished drug product. Compounded medications are prepared by a licensed pharmacist to meet the specific needs of individual patients and require a valid prescription from a licensed healthcare provider. This page is for informational purposes only and does not constitute medical advice. Results may vary. Consult your healthcare provider before starting any new medication. Not for use by individuals under 18. Keep out of reach of children.
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} The Urban Monk &nbsp;·&nbsp; <a href="https://theurbanmonk.com/privacy">Privacy</a> &nbsp;·&nbsp; <a href="https://theurbanmonk.com/terms">Terms</a> &nbsp;·&nbsp; <a href="https://shop.theurbanmonk.com">Shop</a></p>
  </footer>

  <!-- Sticky CTA -->
  <div class="sticky-cta">
    <div class="sticky-cta-text">
      <strong>${product.title}</strong> &nbsp;·&nbsp; ${product.price} / 12 tablets &nbsp;·&nbsp; Prescription included
    </div>
    <a href="${product.shopifyUrl}" class="cta-btn" target="_blank" rel="noopener">
      Get ${product.title} &rarr;
    </a>
  </div>

</body>
</html>`;
}

// ── Product Definitions ──────────────────────────────────────────────────────

const OLYMPUS: OlympusProduct = {
  title: "Olympus",
  subtitle: "Bremelanotide 1mg + Oxytocin 20IU — Sublingual Flex-Dose Tablet",
  tagline: "Desire starts in the brain. Olympus works at the neurological level — activating the pathways that drive genuine arousal, not just blood flow.",
  price: "$120",
  priceNote: "12 tablets · 1 month supply · 3 refills available",
  shopifyHandle: "olympus",
  shopifyUrl: "https://shop.theurbanmonk.com/products/olympus",
  accentColor: "#60a5fa",
  accentColorLight: "#93c5fd",
  forGender: "men",
  tier: "base",
  heroHeadline: "The Neurological Foundation of Male Desire",
  heroBody: "Most sexual health products work on blood flow. Olympus works upstream — at the hypothalamus, where desire is actually generated. Bremelanotide (PT-141) activates melanocortin receptors in the brain to produce genuine, spontaneous arousal. Oxytocin amplifies the emotional and bonding dimension. Together, they restore the neurological signal that drives real desire — not a mechanical response.",
  ingredients: [
    {
      name: "Bremelanotide",
      dose: "1 mg (PT-141)",
      bullets: [
        "FDA-approved mechanism for male hypoactive sexual desire",
        "Activates MC3R and MC4R receptors in the hypothalamus",
        "Produces genuine, spontaneous arousal — not just vascular response",
        "Works regardless of testosterone levels",
        "Onset: 30–45 minutes · Duration: 6–12 hours"
      ]
    },
    {
      name: "Oxytocin",
      dose: "20 IU",
      bullets: [
        "The 'bonding hormone' — amplifies emotional connection",
        "Enhances orgasm intensity and satisfaction",
        "Reduces performance anxiety and social inhibition",
        "Sublingual delivery for rapid absorption",
        "Synergistic with Bremelanotide's desire cascade"
      ]
    }
  ],
  benefits: [
    { icon: "🧠", title: "Neurological Desire", body: "Works at the hypothalamus — where desire is generated — not just at the vascular level." },
    { icon: "🔗", title: "Deeper Connection", body: "Oxytocin amplifies emotional bonding and presence, making intimacy more meaningful." },
    { icon: "⚡", title: "Rapid Onset", body: "Sublingual delivery means effects begin in 30–45 minutes. Plan accordingly." },
    { icon: "🎯", title: "Flex-Dose Format", body: "Start at 1/4 tablet to assess tolerance. Titrate to your optimal dose." }
  ],
  howItWorks: [
    "Complete your intake form at checkout — takes under 5 minutes.",
    "Our clinical team reviews your form and issues a prescription if appropriate.",
    "Strive Pharmacy compounds your formula and ships it directly to your door.",
    "Place 1/4 to 1 tablet under your tongue 30–45 minutes before intimacy.",
    "Refill up to 3 times through your Shopify account — no new prescription needed."
  ],
  faqs: [
    { q: "Do I need to see a doctor before ordering?", a: "No. The intake form at checkout includes a clinical review. Our team will issue a prescription if appropriate. You do not need a separate doctor's visit." },
    { q: "How is this different from Viagra or Cialis?", a: "Viagra and Cialis work on blood flow (PDE5 inhibitors). Olympus works at the neurological level — activating the brain pathways that generate desire. They address different problems. Olympus+ combines both mechanisms if you want both." },
    { q: "How quickly does it work?", a: "Sublingual delivery means onset in 30–45 minutes. Effects typically last 6–12 hours." },
    { q: "What are the most common side effects?", a: "Mild nausea and flushing are most common, especially at higher doses. Starting at 1/4 tablet significantly reduces these. Nausea typically resolves within 1–2 hours." },
    { q: "Can I take it with alcohol?", a: "Moderate alcohol consumption is generally acceptable. Avoid excessive alcohol as it may reduce efficacy and increase side effects." },
    { q: "How many tablets per month?", a: "12 tablets per fill. Maximum recommended frequency is 2 tablets per week (8 doses per month). 3 refills are available." }
  ]
};

const OLYMPUS_PLUS: OlympusProduct = {
  title: "Olympus+",
  subtitle: "Bremelanotide 1mg + Oxytocin 20IU + Tadalafil 5mg — Sublingual Flex-Dose Tablet",
  tagline: "The complete male sexual health formula. Neurological desire activation plus vascular performance enhancement — in a single sublingual tablet.",
  price: "$130",
  priceNote: "12 tablets · 1 month supply · 3 refills available",
  shopifyHandle: "olympus-plus",
  shopifyUrl: "https://shop.theurbanmonk.com/products/olympus",
  accentColor: "#818cf8",
  accentColorLight: "#a5b4fc",
  forGender: "men",
  tier: "plus",
  heroHeadline: "Desire + Performance. Both Mechanisms. One Tablet.",
  heroBody: "Olympus addresses the neurological side of desire. Olympus+ adds Tadalafil — the active ingredient in Cialis — to also address the vascular side. The result is a complete formula: Bremelanotide activates the brain's desire pathways, Oxytocin deepens emotional connection, and Tadalafil ensures optimal blood flow and erectile function. For men who want both the drive and the performance.",
  ingredients: [
    {
      name: "Bremelanotide",
      dose: "1 mg (PT-141)",
      bullets: [
        "Activates MC3R/MC4R receptors — genuine neurological desire",
        "Works regardless of testosterone levels or vascular health",
        "Onset: 30–45 minutes · Duration: 6–12 hours",
        "FDA-approved mechanism for hypoactive sexual desire"
      ]
    },
    {
      name: "Oxytocin",
      dose: "20 IU",
      bullets: [
        "Amplifies emotional bonding and connection",
        "Enhances orgasm intensity",
        "Reduces performance anxiety",
        "Synergistic with Bremelanotide"
      ]
    },
    {
      name: "Tadalafil",
      dose: "5 mg",
      bullets: [
        "PDE5 inhibitor — same mechanism as Cialis",
        "Enhances blood flow and erectile function",
        "Longer duration than sildenafil (up to 36 hours)",
        "Addresses the vascular component of performance"
      ]
    }
  ],
  benefits: [
    { icon: "🧠", title: "Neurological Desire", body: "Bremelanotide activates the brain's desire pathways — genuine arousal, not just a physical response." },
    { icon: "💪", title: "Vascular Performance", body: "Tadalafil ensures optimal blood flow and erectile function — the physical performance layer." },
    { icon: "🔗", title: "Emotional Connection", body: "Oxytocin deepens bonding and presence. Performance without connection is incomplete." },
    { icon: "🎯", title: "One Tablet, Complete Protocol", body: "All three mechanisms in a single sublingual tablet. No stacking, no timing complexity." }
  ],
  howItWorks: [
    "Complete your intake form at checkout — takes under 5 minutes.",
    "Our clinical team reviews your form and issues a prescription if appropriate.",
    "Strive Pharmacy compounds your formula and ships it directly to your door.",
    "Place 1/4 to 1 tablet under your tongue 30–45 minutes before intimacy.",
    "Refill up to 3 times through your Shopify account — no new prescription needed."
  ],
  faqs: [
    { q: "How is Olympus+ different from Olympus?", a: "Olympus contains Bremelanotide + Oxytocin (neurological desire and bonding). Olympus+ adds Tadalafil (the Cialis mechanism) for vascular performance. If you want both desire and performance, Olympus+ is the complete formula." },
    { q: "Is Tadalafil safe to combine with Bremelanotide?", a: "Yes. These two mechanisms work on different pathways and are commonly combined in clinical practice. The intake form will screen for contraindications (e.g., nitrate medications, severe cardiovascular disease)." },
    { q: "Do I need to take it every day?", a: "No. Olympus+ is taken on-demand, 30–45 minutes before intimacy. It is not a daily medication." },
    { q: "What are the most common side effects?", a: "Mild nausea and flushing from Bremelanotide (start at 1/4 tablet). Headache and back pain are possible from Tadalafil. These are typically mild and transient." },
    { q: "Can I take it if I have high blood pressure?", a: "The intake form will screen for this. Tadalafil is generally safe with most antihypertensives, but is contraindicated with nitrate medications. Disclose all medications in your intake form." }
  ]
};

const OLYMPUS_HER: OlympusProduct = {
  title: "Olympus Her",
  subtitle: "Bremelanotide 1mg + Oxytocin 20IU — Sublingual Flex-Dose Tablet",
  tagline: "The only FDA-approved mechanism for female hypoactive sexual desire disorder — combined with Oxytocin for emotional depth and connection.",
  price: "$120",
  priceNote: "12 tablets · 1 month supply · 3 refills available",
  shopifyHandle: "olympus-her",
  shopifyUrl: "https://shop.theurbanmonk.com/products/olympus-her",
  accentColor: "#f472b6",
  accentColorLight: "#f9a8d4",
  forGender: "women",
  tier: "base",
  heroHeadline: "Female Desire Starts in the Brain. Olympus Her Works There.",
  heroBody: "Bremelanotide (PT-141) is the only FDA-approved medication for Hypoactive Sexual Desire Disorder (HSDD) in premenopausal women. It works by activating melanocortin receptors in the hypothalamus — the brain region that governs desire — producing genuine, spontaneous arousal. Paired with Oxytocin, which deepens emotional bonding and enhances orgasm intensity, Olympus Her addresses both the neurological and relational dimensions of female sexual health.",
  ingredients: [
    {
      name: "Bremelanotide",
      dose: "1 mg (PT-141)",
      bullets: [
        "FDA-approved for female HSDD (Hypoactive Sexual Desire Disorder)",
        "Activates hypothalamic melanocortin receptors",
        "Produces genuine, spontaneous desire — not a hormonal patch",
        "Works regardless of hormonal status or relationship factors",
        "Onset: 30–45 minutes · Duration: 6–12 hours"
      ]
    },
    {
      name: "Oxytocin",
      dose: "20 IU",
      bullets: [
        "Amplifies emotional bonding and receptivity",
        "Enhances orgasm intensity and satisfaction",
        "Reduces anxiety and increases sense of safety",
        "Sublingual delivery for rapid absorption",
        "Synergistic with Bremelanotide's desire cascade"
      ]
    }
  ],
  benefits: [
    { icon: "🧠", title: "FDA-Approved Mechanism", body: "Bremelanotide is the only FDA-approved treatment for HSDD in women. This is clinically validated, not experimental." },
    { icon: "💗", title: "Emotional Depth", body: "Oxytocin amplifies bonding, receptivity, and emotional safety — the relational dimension of desire." },
    { icon: "🌸", title: "Hormone-Independent", body: "Works regardless of estrogen, progesterone, or testosterone levels. Effective across all hormonal phases." },
    { icon: "🎯", title: "Flex-Dose Format", body: "Start at 1/4 tablet to assess tolerance. Most women find their optimal dose between 1/4 and 1 full tablet." }
  ],
  howItWorks: [
    "Complete your intake form at checkout — takes under 5 minutes.",
    "Our clinical team reviews your form and issues a prescription if appropriate.",
    "Strive Pharmacy compounds your formula and ships it directly to your door.",
    "Place 1/4 to 1 tablet under your tongue 30–45 minutes before intimacy.",
    "Refill up to 3 times through your Shopify account — no new prescription needed."
  ],
  faqs: [
    { q: "Is this the same as the Vyleesi injection?", a: "Yes — Bremelanotide is the active ingredient in Vyleesi (the FDA-approved injectable). Olympus Her delivers the same molecule in a sublingual tablet, which is more convenient and allows for dose titration." },
    { q: "How is this different from flibanserin (Addyi)?", a: "Flibanserin is a daily pill that works on serotonin/dopamine. Bremelanotide is taken on-demand and works on melanocortin receptors. Many women find Bremelanotide more effective and better tolerated." },
    { q: "Does it work if I'm postmenopausal?", a: "Bremelanotide is FDA-approved for premenopausal women with HSDD. It is used off-label in postmenopausal women and many report benefit. The intake form will capture your hormonal status." },
    { q: "What are the most common side effects?", a: "Mild nausea and flushing are most common, especially at higher doses. Starting at 1/4 tablet significantly reduces these. Nausea typically resolves within 1–2 hours." },
    { q: "Can I take it while breastfeeding?", a: "No. Bremelanotide is not recommended during pregnancy or breastfeeding. Disclose this in your intake form." },
    { q: "How many tablets per month?", a: "12 tablets per fill. Maximum recommended frequency is 2 tablets per week. 3 refills are available." }
  ]
};

const OLYMPUS_HER_PLUS: OlympusProduct = {
  title: "Olympus Her+",
  subtitle: "Bremelanotide 1mg + Oxytocin 20IU + Tadalafil 5mg — Sublingual Flex-Dose Tablet",
  tagline: "Neurological desire activation plus enhanced genital blood flow — the complete female sexual health formula.",
  price: "$125",
  priceNote: "12 tablets · 1 month supply · 3 refills available",
  shopifyHandle: "olympus-her-plus",
  shopifyUrl: "https://shop.theurbanmonk.com/products/olympus-her",
  accentColor: "#c084fc",
  accentColorLight: "#d8b4fe",
  forGender: "women",
  tier: "plus",
  heroHeadline: "Desire, Arousal, and Sensation. The Complete Formula.",
  heroBody: "Olympus Her addresses the neurological side of desire. Olympus Her+ adds Tadalafil at the female-validated 5mg dose — enhancing clitoral blood flow, vaginal lubrication, and genital sensitivity. The result is a complete formula: Bremelanotide activates the brain's desire pathways, Oxytocin deepens emotional connection, and Tadalafil amplifies the physical arousal response. For women who want both the neurological drive and the physical sensation.",
  ingredients: [
    {
      name: "Bremelanotide",
      dose: "1 mg (PT-141)",
      bullets: [
        "FDA-approved mechanism for female HSDD",
        "Activates hypothalamic melanocortin receptors",
        "Genuine, spontaneous desire — hormone-independent",
        "Onset: 30–45 minutes"
      ]
    },
    {
      name: "Oxytocin",
      dose: "20 IU",
      bullets: [
        "Amplifies emotional bonding and receptivity",
        "Enhances orgasm intensity and satisfaction",
        "Reduces anxiety and increases sense of safety"
      ]
    },
    {
      name: "Tadalafil",
      dose: "5 mg (Female-Validated Dose)",
      bullets: [
        "Female-appropriate dose — intentionally not the male 10–20mg dose",
        "Enhances clitoral blood flow and engorgement",
        "Improves vaginal lubrication and sensitivity",
        "PDE5 inhibitor — clinically studied in women with sexual dysfunction"
      ]
    }
  ],
  benefits: [
    { icon: "🧠", title: "Neurological Desire", body: "Bremelanotide activates the brain's desire pathways — genuine arousal, not just a physical response." },
    { icon: "🌸", title: "Physical Sensation", body: "Tadalafil at the female-validated 5mg dose enhances clitoral blood flow and vaginal sensitivity." },
    { icon: "💗", title: "Emotional Connection", body: "Oxytocin deepens bonding, receptivity, and emotional safety." },
    { icon: "🎯", title: "Female-Specific Dosing", body: "Tadalafil is held at 5mg — the female-validated dose. Not the male 10–20mg dose." }
  ],
  howItWorks: [
    "Complete your intake form at checkout — takes under 5 minutes.",
    "Our clinical team reviews your form and issues a prescription if appropriate.",
    "Strive Pharmacy compounds your formula and ships it directly to your door.",
    "Place 1/4 to 1 tablet under your tongue 30–45 minutes before intimacy.",
    "Refill up to 3 times through your Shopify account — no new prescription needed."
  ],
  faqs: [
    { q: "How is Olympus Her+ different from Olympus Her?", a: "Olympus Her contains Bremelanotide + Oxytocin (neurological desire and bonding). Olympus Her+ adds Tadalafil at the female-validated 5mg dose, which enhances clitoral blood flow and vaginal sensitivity. If you want both the neurological and physical arousal response, Her+ is the complete formula." },
    { q: "Why is the Tadalafil dose only 5mg?", a: "5mg is the clinically validated female dose. The male dose (10–20mg) is not appropriate for women. The Her+ formula intentionally uses the female-appropriate dose." },
    { q: "Is Tadalafil safe for women?", a: "Yes. Tadalafil has been studied in women with sexual dysfunction and is used off-label for female sexual arousal disorder. The intake form will screen for contraindications." },
    { q: "What are the most common side effects?", a: "Mild nausea and flushing from Bremelanotide (start at 1/4 tablet). Headache is possible from Tadalafil. These are typically mild and transient." },
    { q: "Can I take it if I'm on hormonal birth control?", a: "Generally yes, but disclose all medications in your intake form. Tadalafil is contraindicated with nitrate medications." }
  ]
};

const OLYMPUS_HER_MAX: OlympusProduct = {
  title: "Olympus Her Max",
  subtitle: "Bremelanotide 2mg + Oxytocin 40IU + Tadalafil 5mg — Sublingual Flex-Dose Tablet",
  tagline: "The pinnacle of the Her line. Maximum-dose Bremelanotide and Oxytocin for established patients who require the full-strength neurological protocol.",
  price: "$185",
  priceNote: "12 tablets · 1 month supply · 3 refills available",
  shopifyHandle: "olympus-her-max",
  shopifyUrl: "https://shop.theurbanmonk.com/products/olympus-her-max",
  accentColor: "#fb923c",
  accentColorLight: "#fdba74",
  forGender: "women",
  tier: "max",
  isMaxDose: true,
  heroHeadline: "Maximum Neurological Desire. For Established Patients.",
  heroBody: "Olympus Her Max doubles the Bremelanotide and Oxytocin doses from the standard Her formula while intentionally keeping Tadalafil at the female-appropriate 5mg dose. This formula is for women who have established tolerance to Bremelanotide 1mg through Olympus Her or Olympus Her+ and have found that the standard dose produces insufficient desire activation. The flex-dose format allows precise titration — a 1/4 tablet delivers the equivalent of Olympus Her, while a full tablet delivers the complete Her Max experience.",
  ingredients: [
    {
      name: "Bremelanotide",
      dose: "2 mg — Max Dose (2× Standard)",
      bullets: [
        "Double the standard Her formula dose",
        "Maximum hypothalamic arousal cascade",
        "For patients with insufficient response to 1mg",
        "Titrate from 1/4 tablet — nausea more likely at 2mg",
        "Established patients only"
      ]
    },
    {
      name: "Oxytocin",
      dose: "40 IU — Max Dose (2× Standard)",
      bullets: [
        "Double the standard Her formula dose",
        "Maximum emotional bonding amplification",
        "Peak orgasm intensity enhancement",
        "Maximum anxiety reduction and receptivity"
      ]
    },
    {
      name: "Tadalafil",
      dose: "5 mg — Female-Appropriate (Held)",
      bullets: [
        "Intentionally held at 5mg — the female-validated dose",
        "Enhances clitoral blood flow and engorgement",
        "Improves vaginal lubrication and sensitivity",
        "Not escalated to male doses — by design"
      ]
    }
  ],
  benefits: [
    { icon: "🔥", title: "Maximum Desire Activation", body: "2mg Bremelanotide — double the standard dose — for women who require the full-strength neurological protocol." },
    { icon: "💗", title: "Maximum Bonding Effect", body: "40IU Oxytocin — double the standard dose — for peak emotional connection and orgasm intensity." },
    { icon: "🌸", title: "Female-Appropriate Tadalafil", body: "Tadalafil is intentionally held at 5mg. The Her Max formula maximizes the neurological pathways while maintaining the appropriate vascular dose." },
    { icon: "🎯", title: "Flex-Dose Titration", body: "1/4 tablet = Olympus Her equivalent. Full tablet = Her Max. Titrate to your optimal dose." }
  ],
  howItWorks: [
    "Confirm you have established tolerance to Bremelanotide 1mg through Olympus Her or Olympus Her+.",
    "Complete your intake form at checkout — your tolerance history will be reviewed.",
    "Our clinical team confirms your history and issues a prescription for Her Max.",
    "Strive Pharmacy compounds your formula and ships it directly to your door.",
    "Begin at 1/4 tablet and titrate up. Do not start at a full tablet."
  ],
  faqs: [
    { q: "Who is Olympus Her Max for?", a: "Her Max is for established patients who have already used Olympus Her or Olympus Her+ and have confirmed tolerance to Bremelanotide 1mg. It is not appropriate for first-time users." },
    { q: "Why do I need to establish tolerance first?", a: "Bremelanotide at 2mg significantly increases the likelihood of nausea and flushing. Starting at the standard 1mg dose allows your body to adapt. Jumping to 2mg without prior exposure is not recommended." },
    { q: "Can I start at a full tablet?", a: "No. Always begin at 1/4 tablet, even if you have used the standard Her formula. The 2mg dose requires careful titration." },
    { q: "Why is Tadalafil held at 5mg and not increased?", a: "5mg is the female-validated dose. Increasing Tadalafil beyond this dose does not improve efficacy in women and increases side effect risk. The Her Max formula intentionally maximizes the neurological pathways (Bremelanotide and Oxytocin) while holding Tadalafil at the appropriate female dose." },
    { q: "What are the most common side effects at this dose?", a: "Nausea and flushing are significantly more likely at 2mg Bremelanotide than at 1mg. Starting at 1/4 tablet and titrating slowly is essential. Nausea typically resolves within 1–2 hours." }
  ]
};

// ── Page Renderers ───────────────────────────────────────────────────────────

export function renderOlympusBasePage(): string {
  return renderOlympusPage(OLYMPUS);
}

export function renderOlympusPlusPage(): string {
  return renderOlympusPage(OLYMPUS_PLUS);
}

export function renderOlympusHerPage(): string {
  return renderOlympusPage(OLYMPUS_HER);
}

export function renderOlympusHerPlusPage(): string {
  return renderOlympusPage(OLYMPUS_HER_PLUS);
}

export function renderOlympusHerMaxPage(): string {
  return renderOlympusPage(OLYMPUS_HER_MAX);
}
