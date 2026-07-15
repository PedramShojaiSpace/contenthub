/**
 * Web of Life Landing Page
 * Served at /weboflife — the destination for QR codes embedded in the Web of Life t-shirt.
 * Mobile-first. Tone: "you found a secret."
 * Theme: Dark navy matching get.theurbanmonk.com/program
 */

export function renderWebOfLifePage(videoUrl?: string | null): string {
  // Wistia embed code (web component style)
  const WISTIA_MEDIA_ID = "170ikm1w63";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>The Web of Life — The Urban Monk</title>
  <meta name="description" content="You found something. The meditating figure at the center of the web — that's you. Here's what it means." />
  <link rel="icon" type="image/x-icon" href="/manus-storage/urban-monk-favicon_27ae5d07.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/manus-storage/urban-monk-favicon-32_ac18d482.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/manus-storage/urban-monk-favicon-180_7cd1c802.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <!-- Wistia web component -->
  <script src="https://fast.wistia.com/player.js" async></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      /* Dark navy palette — matches get.theurbanmonk.com/program */
      --bg-darkest:  #090d1a;   /* page background */
      --bg-dark:     #0f1729;   /* section alternates */
      --bg-card:     #172038;   /* card / panel bg */
      --bg-mid:      #1e2d4a;   /* slightly lighter panels */
      --accent-blue: #2563eb;   /* primary CTA blue */
      --accent-light:#60a5fa;   /* light blue text / highlights */
      --text-primary:#f0f4ff;   /* near-white body text */
      --text-muted:  #94a3b8;   /* secondary / muted text */
      --border:      rgba(96,165,250,0.12); /* subtle blue border */
      --gold:        #b8965a;   /* warm gold accent (kept for brand continuity) */
      --gold-light:  #d4b07a;
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

    /* ── Header ── */
    .header {
      padding: 28px 24px 0;
      display: flex;
      justify-content: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
    }
    .header img {
      height: 36px;
      width: auto;
      filter: brightness(1.1);
    }

    /* ── Hero ── */
    .hero {
      padding: 56px 24px 0;
      text-align: center;
      max-width: 640px;
      margin: 0 auto;
    }
    .eyebrow {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent-light);
      margin-bottom: 20px;
    }
    .hero h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(38px, 8vw, 62px);
      font-weight: 300;
      line-height: 1.12;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      margin-bottom: 20px;
    }
    .hero h1 em {
      font-style: italic;
      color: var(--accent-light);
    }
    .hero-sub {
      font-size: 17px;
      color: var(--text-muted);
      max-width: 460px;
      margin: 0 auto 48px;
      line-height: 1.7;
    }

    /* ── Video Section ── */
    .video-section {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 24px 56px;
    }
    .video-wrapper {
      position: relative;
      width: 100%;
      background: var(--bg-card);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 16px 60px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
    }
    /* Wistia web component fills naturally */
    wistia-player {
      display: block;
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 8px;
      overflow: hidden;
    }
    /* Fallback iframe wrapper */
    .video-iframe-wrapper {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%;
    }
    .video-iframe-wrapper iframe,
    .video-iframe-wrapper video {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
    .video-caption {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 14px;
      letter-spacing: 0.06em;
    }

    /* ── Design Image ── */
    .design-section {
      max-width: 500px;
      margin: 0 auto;
      padding: 0 24px 56px;
    }
    .design-frame {
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 16px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
      background: var(--bg-card);
    }
    .design-frame img {
      width: 100%;
      height: auto;
      display: block;
    }
    .design-caption {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 14px;
      letter-spacing: 0.06em;
    }

    /* ── Shirt Product Section ── */
    .shirt-section {
      max-width: 560px;
      margin: 0 auto;
      padding: 0 24px 64px;
      text-align: center;
    }
    .shirt-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent-light);
      margin-bottom: 16px;
    }
    .shirt-frame {
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 16px 60px rgba(0,0,0,0.45), 0 0 0 1px var(--border);
      background: var(--bg-card);
      margin-bottom: 24px;
    }
    .shirt-frame img {
      width: 100%;
      height: auto;
      display: block;
    }
    .shirt-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(22px, 5vw, 30px);
      font-weight: 400;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    .shirt-price {
      font-size: 15px;
      color: var(--text-muted);
      margin-bottom: 24px;
    }
    .shirt-btn {
      display: inline-block;
      padding: 16px 44px;
      background: var(--accent-blue);
      color: #ffffff;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-decoration: none;
      border-radius: 6px;
      -webkit-tap-highlight-color: transparent;
    }
    .shirt-btn:hover { background: #1d4ed8; }

    /* ── Explore Deeper Section ── */
    .explore-section {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 24px 72px;
      text-align: center;
    }
    .explore-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent-light);
      margin-bottom: 16px;
    }
    .explore-heading {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(26px, 5.5vw, 38px);
      font-weight: 300;
      line-height: 1.25;
      color: var(--text-primary);
      margin-bottom: 14px;
    }
    .explore-body {
      font-size: 16px;
      color: var(--text-muted);
      line-height: 1.7;
      max-width: 480px;
      margin: 0 auto 32px;
    }
    .explore-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 18px 48px;
      background: transparent;
      color: var(--accent-light);
      border: 1.5px solid var(--accent-blue);
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-decoration: none;
      border-radius: 6px;
      -webkit-tap-highlight-color: transparent;
    }
    .explore-btn:hover {
      background: rgba(37,99,235,0.12);
      border-color: var(--accent-light);
      color: #ffffff;
    }
    .explore-btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    /* ── Narrative ── */
    .narrative {
      max-width: 620px;
      margin: 0 auto;
      padding: 0 28px 64px;
    }
    .narrative p {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(18px, 4vw, 23px);
      font-weight: 300;
      line-height: 1.78;
      color: var(--text-primary);
      margin-bottom: 28px;
    }
    .narrative p:last-child { margin-bottom: 0; }
    .narrative strong {
      font-weight: 600;
      color: var(--accent-light);
    }

    /* ── Divider ── */
    .divider {
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 320px;
      margin: 0 auto 64px;
      padding: 0 28px;
    }
    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--accent-blue), transparent);
      opacity: 0.4;
    }
    .divider-icon {
      width: 24px;
      height: 24px;
      opacity: 0.4;
    }

    /* ── CTA Section ── */
    .cta-section {
      background: var(--bg-dark);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      max-width: 100%;
      padding: 72px 28px;
      text-align: center;
    }
    .cta-inner {
      max-width: 560px;
      margin: 0 auto;
    }
    .cta-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent-light);
      margin-bottom: 20px;
    }
    .cta-heading {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(28px, 6vw, 42px);
      font-weight: 400;
      line-height: 1.25;
      color: var(--text-primary);
      margin-bottom: 16px;
    }
    .cta-body {
      font-size: 16px;
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 40px;
      max-width: 460px;
      margin-left: auto;
      margin-right: auto;
    }
    .cta-btn {
      display: inline-block;
      padding: 16px 44px;
      background: var(--accent-blue);
      color: #ffffff;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-decoration: none;
      border-radius: 6px;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-btn:hover { background: #1d4ed8; }
    .cta-note {
      margin-top: 18px;
      font-size: 13px;
      color: var(--text-muted);
      opacity: 0.7;
    }

    /* ── QR Section ── */
    .qr-section {
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      padding: 56px 28px 72px;
      text-align: center;
    }
    .qr-section h3 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 24px;
      font-weight: 400;
      color: var(--text-primary);
      margin-bottom: 10px;
    }
    .qr-section p {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 28px;
      max-width: 340px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.6;
    }
    .qr-img {
      width: 140px;
      height: 140px;
      margin: 0 auto;
      display: block;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }

    /* ── Footer ── */
    .footer {
      background: var(--bg-darkest);
      padding: 32px 28px;
      text-align: center;
      border-top: 1px solid var(--border);
    }
    .footer p {
      font-size: 12px;
      color: var(--text-muted);
      opacity: 0.6;
    }
    .footer a {
      color: var(--text-muted);
      text-decoration: none;
    }
    .footer a:hover { color: var(--accent-light); }

    /* ── Fade-in animation ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-up {
      animation: fadeUp 0.9s ease both;
    }
    .fade-up-2 { animation-delay: 0.15s; }
    .fade-up-3 { animation-delay: 0.3s; }
    .fade-up-4 { animation-delay: 0.45s; }
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
    <p class="eyebrow">You found something</p>
    <h1>The <em>Web of Life</em><br>is not a metaphor.</h1>
    <p class="hero-sub">The meditating figure at the center of that web — that's you. And the web is real.</p>
  </section>

  <!-- Wistia Video (always shown — embedded directly) -->
  <section class="video-section fade-up fade-up-3">
    <div class="video-wrapper">
      <wistia-player media-id="${WISTIA_MEDIA_ID}" seo="true"></wistia-player>
    </div>
    <p class="video-caption">Watch before you scroll — this is the context for everything below.</p>
  </section>

  <!-- Design Image -->
  <div class="design-section fade-up fade-up-3">
    <div class="design-frame">
      <img
        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/weboflife/web-of-life-design.webp"
        alt="Web of Life — Urban Monk scientific illustration of a meditating figure at the center of a microbiome web"
        loading="lazy"
      />
    </div>
    <p class="design-caption">Web of Life — Urban Monk × Microbiome Series</p>
  </div>

  <!-- Shirt Product Section -->
  <section class="shirt-section fade-up fade-up-3">
    <p class="shirt-label">Wear the web</p>
    <div class="shirt-frame">
      <img
        src="https://cdn.shopify.com/s/files/1/0564/2430/0698/files/unisex-v-neck-tee-white-front-6a4d8aca34fca.jpg?v=1783466717"
        alt="The Web of Life V-Neck Tee — The Urban Monk"
        loading="lazy"
      />
    </div>
    <h3 class="shirt-title">The Web of Life Tee</h3>
    <p class="shirt-price">$35 &mdash; Unisex V-Neck</p>
    <a href="https://shop.theurbanmonk.com/products/the-web-of-life-v" class="shirt-btn" target="_blank" rel="noopener">
      Get Your Shirt Now &rarr;
    </a>
  </section>

  <!-- Explore Deeper -->
  <section class="explore-section fade-up fade-up-3">
    <p class="explore-label">There is more</p>
    <h3 class="explore-heading">The web goes deeper<br>than the image</h3>
    <p class="explore-body">The fungal kingdom built the soil. Your mitochondria are ancient bacteria. The web communicates — and it may be conscious. Watch the deep dive.</p>
    <a href="#deep-dive" class="explore-btn" id="explore-deeper-btn">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
      </svg>
      Explore Deeper
    </a>
  </section>

  <!-- Narrative -->
  <section class="narrative fade-up fade-up-4">
    <p>
      Your body is home to <strong>38 trillion microorganisms</strong> — bacteria, fungi, archaea, viruses — each one a node in a living network that regulates your mood, your immunity, your clarity, your sleep. The illustration on this shirt is not art. It's a map.
    </p>
    <p>
      Ancient medicine knew this. Long before we had microscopes, healers understood that the human being was a <strong>community, not an individual</strong>. The gut was considered the second brain. The terrain was the treatment. The web was the medicine.
    </p>
    <p>
      Modern science is catching up. What we're learning is that the quality of your inner ecosystem determines the quality of your outer life — your energy, your resilience, your capacity to be present. The monk at the center of the web isn't separate from it. <strong>He is it.</strong>
    </p>
  </section>

  <!-- Divider -->
  <div class="divider">
    <div class="divider-line"></div>
    <svg class="divider-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3" stroke="${'#60a5fa'}" stroke-width="1.5"/>
      <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="${'#60a5fa'}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 14c-4 0-7 1.5-7 4" stroke="${'#60a5fa'}" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
      <path d="M12 14c4 0 7 1.5 7 4" stroke="${'#60a5fa'}" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
    </svg>
    <div class="divider-line"></div>
  </div>

  <!-- CTA -->
  <section class="cta-section">
    <div class="cta-inner">
      <p class="cta-label">If this resonates</p>
      <h2 class="cta-heading">There's more where this came from</h2>
      <p class="cta-body">
        The Lights On program is Dr. Pedram Shojai's deep dive into the systems that govern your energy, clarity, and longevity — the microbiome, the nervous system, the circadian rhythm, and the practices that bring them into alignment.
      </p>
      <a href="https://lightson.theurbanmonk.com" class="cta-btn" target="_blank" rel="noopener">
        Explore Lights On →
      </a>
      <p class="cta-note">No pressure. Just more of this.</p>
    </div>
  </section>

  <!-- QR Reference -->
  <section class="qr-section">
    <h3>The QR in the web</h3>
    <p>One of the circular nodes in the illustration is a functional QR code.<br>You found it. That's the point.</p>
    <img
      class="qr-img"
      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/weboflife/qr-weboflife.png"
      alt="Urban Monk QR code — Web of Life"
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
