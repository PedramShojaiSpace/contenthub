/**
 * Web of Life Landing Page
 * Served at /weboflife — the destination for QR codes embedded in the Web of Life t-shirt.
 * Mobile-first. Tone: "you found a secret."
 */

export function renderWebOfLifePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>The Web of Life — The Urban Monk</title>
  <meta name="description" content="You found something. The meditating figure at the center of the web — that's you. Here's what it means." />
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
      padding: 48px 24px 0;
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
      font-size: clamp(38px, 8vw, 58px);
      font-weight: 300;
      line-height: 1.15;
      letter-spacing: -0.01em;
      color: var(--ink);
      margin-bottom: 20px;
    }
    .hero h1 em {
      font-style: italic;
      color: var(--gold);
    }
    .hero-sub {
      font-size: 16px;
      color: var(--warm-gray);
      max-width: 420px;
      margin: 0 auto 40px;
      line-height: 1.65;
    }

    /* ── Design Image ── */
    .design-section {
      max-width: 480px;
      margin: 0 auto;
      padding: 0 24px 48px;
    }
    .design-frame {
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(26,26,24,0.12);
      background: #fff;
    }
    .design-frame img {
      width: 100%;
      height: auto;
      display: block;
    }
    .design-caption {
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
      line-height: 1.75;
      color: var(--ink);
      margin-bottom: 28px;
    }
    .narrative p:last-child { margin-bottom: 0; }
    .narrative strong {
      font-weight: 600;
      color: var(--ink);
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
      width: 24px;
      height: 24px;
      opacity: 0.5;
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
      font-size: clamp(26px, 6vw, 36px);
      font-weight: 400;
      line-height: 1.3;
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
      transition: background 0.2s, transform 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-btn:hover { background: #2d2d2a; transform: translateY(-1px); }
    .cta-btn:active { transform: translateY(0); }
    .cta-note {
      margin-top: 16px;
      font-size: 12px;
      color: var(--warm-gray);
      opacity: 0.7;
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
    .fade-up {
      animation: fadeUp 0.8s ease both;
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
      <img src="https://cdn.manus.space/manus-storage/logo-yang_f6cf1550.png" alt="The Urban Monk" />
    </a>
  </header>

  <!-- Hero -->
  <section class="hero fade-up fade-up-2">
    <p class="eyebrow">You found something</p>
    <h1>The <em>Web of Life</em><br>is not a metaphor.</h1>
    <p class="hero-sub">The meditating figure at the center of that web — that's you. And the web is real.</p>
  </section>

  <!-- Design Image -->
  <div class="design-section fade-up fade-up-3">
    <div class="design-frame">
      <img
        src="https://cdn.manus.space/manus-storage/web-of-life-design_e8895b52.png"
        alt="Web of Life — Urban Monk scientific illustration of a meditating figure at the center of a microbiome web"
        loading="lazy"
      />
    </div>
    <p class="design-caption">Web of Life — Urban Monk × Microbiome Series</p>
  </div>

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
      <circle cx="12" cy="8" r="3" stroke="#b8965a" stroke-width="1.5"/>
      <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#b8965a" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 14c-4 0-7 1.5-7 4" stroke="#b8965a" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
      <path d="M12 14c4 0 7 1.5 7 4" stroke="#b8965a" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
    </svg>
    <div class="divider-line"></div>
  </div>

  <!-- CTA -->
  <section class="cta-section">
    <p class="cta-label">If this resonates</p>
    <h2 class="cta-heading">There's more where this came from</h2>
    <p class="cta-body">
      The Lights On program is Dr. Pedram Shojai's deep dive into the systems that govern your energy, clarity, and longevity — the microbiome, the nervous system, the circadian rhythm, and the practices that bring them into alignment.
    </p>
    <a href="https://lightson.theurbanmonk.com" class="cta-btn" target="_blank" rel="noopener">
      Explore Lights On →
    </a>
    <p class="cta-note">No pressure. Just more of this.</p>
  </section>

  <!-- QR Reference -->
  <section class="qr-section">
    <h3>The QR in the web</h3>
    <p>One of the circular nodes in the illustration is a functional QR code.<br>You found it. That's the point.</p>
    <img
      class="qr-img"
      src="https://cdn.manus.space/manus-storage/qr-weboflife_d86afd85.png"
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
