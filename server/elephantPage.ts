/**
 * Traditional Education Landing Page
 * Served at /elephant — the destination for QR codes embedded in the Traditional Education merchandise.
 * Theme: conditioned limitation — the baby elephant who stopped trying.
 * Mobile-first. Tone: "you already know this story."
 */

export function renderElephantPage(
  videoUrl?: string | null,
  productImageUrl?: string | null,
  shopifyUrl?: string | null
): string {
  const PLACEHOLDER_PRODUCT_IMAGE = ""; // filled in when Shopify link arrives
  const SHOPIFY_LINK = shopifyUrl || "#";
  const productImg = productImageUrl || PLACEHOLDER_PRODUCT_IMAGE;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Traditional Education — The Urban Monk</title>
  <meta name="description" content="A baby elephant learns it cannot move. By the time it's full grown, it believes the rope is real. This design is a reminder to question what's holding you." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ink: #1a1a18;
      --parchment: #f7f4ef;
      --warm-gray: #8a8278;
      --gold: #b8965a;
      --gold-light: #d4b07a;
      --deep-earth: #3d2f1e;
    }

    html { scroll-behavior: smooth; }

    body {
      background: var(--parchment);
      color: var(--ink);
      font-family: 'Inter', sans-serif;
      font-weight: 300;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Header ── */
    .header {
      padding: 28px 24px 0;
      display: flex;
      justify-content: center;
    }
    .header img {
      height: 36px;
      width: auto;
      opacity: 0.85;
    }

    /* ── Hero ── */
    .hero {
      padding: 52px 24px 0;
      text-align: center;
      max-width: 600px;
      margin: 0 auto;
    }
    .eyebrow {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 20px;
    }
    .hero h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(38px, 8vw, 60px);
      font-weight: 300;
      line-height: 1.12;
      letter-spacing: -0.01em;
      color: var(--ink);
      margin-bottom: 22px;
    }
    .hero h1 em {
      font-style: italic;
      color: var(--gold);
    }
    .hero-sub {
      font-size: 16px;
      color: var(--warm-gray);
      max-width: 440px;
      margin: 0 auto 44px;
      line-height: 1.65;
    }

    /* ── Video Embed ── */
    .video-section {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 24px 52px;
    }
    .video-wrapper {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%;
      background: var(--ink);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(26,26,24,0.18);
    }
    .video-wrapper iframe,
    .video-wrapper video {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
    /* Video placeholder — shown until video is assigned */
    .video-placeholder {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%;
      background: var(--deep-earth);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(26,26,24,0.18);
    }
    .video-placeholder-inner {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: rgba(247,244,239,0.5);
    }
    .video-placeholder-inner svg {
      width: 48px;
      height: 48px;
      opacity: 0.4;
    }
    .video-placeholder-inner p {
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.5;
    }
    .video-caption {
      text-align: center;
      font-size: 12px;
      color: var(--warm-gray);
      margin-top: 12px;
      letter-spacing: 0.06em;
    }

    /* ── Narrative ── */
    .narrative {
      max-width: 600px;
      margin: 0 auto;
      padding: 0 28px 56px;
    }
    .narrative p {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(18px, 4vw, 22px);
      font-weight: 300;
      line-height: 1.78;
      color: var(--ink);
      margin-bottom: 28px;
    }
    .narrative p:last-child { margin-bottom: 0; }
    .narrative strong {
      font-weight: 600;
      color: var(--ink);
    }
    .narrative em {
      font-style: italic;
      color: var(--deep-earth);
    }

    /* ── Pull Quote ── */
    .pull-quote {
      max-width: 520px;
      margin: 0 auto 56px;
      padding: 32px 32px;
      border-left: 3px solid var(--gold);
      background: rgba(184,150,90,0.06);
    }
    .pull-quote p {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(20px, 4.5vw, 26px);
      font-weight: 300;
      font-style: italic;
      line-height: 1.55;
      color: var(--deep-earth);
    }

    /* ── Divider ── */
    .divider {
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 320px;
      margin: 0 auto 56px;
      padding: 0 28px;
    }
    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--gold-light), transparent);
    }
    .divider-icon {
      width: 22px;
      height: 22px;
      opacity: 0.45;
    }

    /* ── Product Section ── */
    .product-section {
      max-width: 480px;
      margin: 0 auto;
      padding: 0 24px 56px;
    }
    .product-frame {
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(26,26,24,0.12);
      background: #fff;
      margin-bottom: 20px;
    }
    .product-frame img {
      width: 100%;
      height: auto;
      display: block;
    }
    .product-placeholder {
      width: 100%;
      aspect-ratio: 1 / 1;
      background: #ede8e0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--warm-gray);
      font-size: 13px;
      letter-spacing: 0.06em;
    }
    .product-placeholder svg {
      width: 36px;
      height: 36px;
      opacity: 0.3;
    }
    .product-caption {
      text-align: center;
      font-size: 12px;
      color: var(--warm-gray);
      letter-spacing: 0.06em;
    }

    /* ── CTA Section ── */
    .cta-section {
      max-width: 560px;
      margin: 0 auto;
      padding: 0 28px 80px;
      text-align: center;
    }
    .cta-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--warm-gray);
      margin-bottom: 20px;
    }
    .cta-heading {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(26px, 6vw, 38px);
      font-weight: 400;
      line-height: 1.28;
      color: var(--ink);
      margin-bottom: 16px;
    }
    .cta-body {
      font-size: 15px;
      color: var(--warm-gray);
      line-height: 1.7;
      margin-bottom: 36px;
      max-width: 440px;
      margin-left: auto;
      margin-right: auto;
    }
    .cta-btn {
      display: inline-block;
      padding: 16px 40px;
      background: var(--ink);
      color: var(--parchment);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-decoration: none;
      border-radius: 2px;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-btn:hover { background: #2d2d2a; }
    .cta-btn-secondary {
      display: inline-block;
      margin-top: 14px;
      padding: 14px 36px;
      background: transparent;
      color: var(--ink);
      border: 1px solid rgba(26,26,24,0.25);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 400;
      letter-spacing: 0.06em;
      text-decoration: none;
      border-radius: 2px;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-btn-secondary:hover { border-color: var(--ink); }
    .cta-note {
      margin-top: 16px;
      font-size: 12px;
      color: var(--warm-gray);
      opacity: 0.7;
    }
    .cta-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    /* ── QR Section ── */
    .qr-section {
      background: #fff;
      border-top: 1px solid rgba(26,26,24,0.08);
      padding: 48px 28px 64px;
      text-align: center;
    }
    .qr-section h3 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      font-weight: 400;
      color: var(--ink);
      margin-bottom: 8px;
    }
    .qr-section p {
      font-size: 13px;
      color: var(--warm-gray);
      margin-bottom: 24px;
      max-width: 320px;
      margin-left: auto;
      margin-right: auto;
    }
    .qr-img {
      width: 140px;
      height: 140px;
      margin: 0 auto;
      display: block;
    }

    /* ── Footer ── */
    .footer {
      padding: 32px 28px;
      text-align: center;
      border-top: 1px solid rgba(26,26,24,0.06);
    }
    .footer p {
      font-size: 12px;
      color: var(--warm-gray);
      opacity: 0.6;
    }
    .footer a {
      color: var(--warm-gray);
      text-decoration: none;
    }
    .footer a:hover { color: var(--ink); }

    /* ── Fade-in animation ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-up { animation: fadeUp 0.8s ease both; }
    .fade-up-2 { animation-delay: 0.15s; }
    .fade-up-3 { animation-delay: 0.3s; }
    .fade-up-4 { animation-delay: 0.45s; }
    .fade-up-5 { animation-delay: 0.6s; }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header fade-up">
    <a href="https://theurbanmonk.com" target="_blank" rel="noopener">
      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/weboflife/logo-yang.png" alt="The Urban Monk" />
    </a>
  </header>

  <!-- Hero -->
  <section class="hero fade-up fade-up-2">
    <p class="eyebrow">Traditional Education</p>
    <h1>The rope<br>is <em>not real.</em></h1>
    <p class="hero-sub">A baby elephant learns it cannot move. By the time it's full grown, it never tries again. The rope hasn't changed. The elephant has.</p>
  </section>

  <!-- Video Embed or Placeholder -->
  <section class="video-section fade-up fade-up-3">
    ${videoUrl ? `
    <div class="video-wrapper">
      ${videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
        ? `<iframe src="${videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}?autoplay=0&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
        : `<video src="${videoUrl}" controls playsinline preload="metadata"></video>`
      }
    </div>
    <p class="video-caption">Watch before you scroll.</p>
    ` : `
    <div class="video-placeholder">
      <div class="video-placeholder-inner">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
        </svg>
        <p>Animation coming soon</p>
      </div>
    </div>
    <p class="video-caption">The animation is being prepared — check back soon.</p>
    `}
  </section>

  <!-- Narrative -->
  <section class="narrative fade-up fade-up-4">
    <p>
      When a baby elephant is trained, its leg is tied to a small stake in the ground. It pulls. It strains. It tries with everything it has. And it cannot move. So it stops trying.
    </p>
    <p>
      Years later, that same elephant — now capable of uprooting trees — stands calmly beside a stake it could snap with a flick of its ankle. <strong>It doesn't try.</strong> Not because the rope is strong. Because the belief is.
    </p>
    <p>
      This is what traditional education does. It teaches us the limits of what we are before we've had a chance to discover what we might become. It rewards compliance and punishes curiosity. It measures intelligence with a single ruler and calls everything else a deficiency.
    </p>
    <p>
      Most of us are walking around with a rope on our ankle that hasn't been real for decades. The question isn't whether you can break it. <em>The question is whether you know it's there.</em>
    </p>
  </section>

  <!-- Pull Quote -->
  <div class="pull-quote fade-up fade-up-4">
    <p>"The most dangerous prison is the one you can't see."</p>
  </div>

  <!-- Divider -->
  <div class="divider">
    <div class="divider-line"></div>
    <svg class="divider-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3" stroke="#b8965a" stroke-width="1.5"/>
      <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#b8965a" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <div class="divider-line"></div>
  </div>

  <!-- Product Image (placeholder until Shopify link arrives) -->
  <section class="product-section fade-up fade-up-4">
    ${productImg ? `
    <div class="product-frame">
      <img src="${productImg}" alt="Traditional Education — Urban Monk" loading="lazy" />
    </div>
    ` : `
    <div class="product-frame">
      <div class="product-placeholder">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>Product image coming soon</span>
      </div>
    </div>
    `}
    <p class="product-caption">Traditional Education — Urban Monk Series</p>
  </section>

  <!-- CTA -->
  <section class="cta-section fade-up fade-up-5">
    <p class="cta-label">If this resonates</p>
    <h2 class="cta-heading">The work of unlearning<br>is the real education</h2>
    <p class="cta-body">
      Dr. Pedram Shojai's work is about exactly this — identifying the invisible constraints that govern your energy, your clarity, and your sense of what's possible, and dismantling them one by one.
    </p>
    <div class="cta-stack">
      ${SHOPIFY_LINK !== '#' ? `
      <a href="${SHOPIFY_LINK}" class="cta-btn" target="_blank" rel="noopener">
        Get the Shirt →
      </a>
      ` : `
      <a href="#" class="cta-btn" style="opacity:0.4; pointer-events:none; cursor:default;">
        Shop Coming Soon
      </a>
      `}
      <a href="https://theurbanmonk.com/academy" class="cta-btn-secondary" target="_blank" rel="noopener">
        Explore the Academy
      </a>
    </div>
    <p class="cta-note">Wear the reminder. Question the rope.</p>
  </section>

  <!-- QR Reference -->
  <section class="qr-section">
    <h3>The QR in the design</h3>
    <p>The QR code embedded in this design brought you here. That was intentional — everything on this shirt has a reason.</p>
    <img
      class="qr-img"
      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/elephant-qr_18b71bc6.webp"
      alt="Urban Monk QR code — Traditional Education"
      loading="lazy"
    />
  </section>

  <!-- Footer -->
  <footer class="footer">
    <p>
      <a href="https://theurbanmonk.com" target="_blank" rel="noopener">theurbanmonk.com</a>
      &nbsp;·&nbsp;
      Dr. Pedram Shojai, OMD
    </p>
  </footer>

</body>
</html>`;
}
