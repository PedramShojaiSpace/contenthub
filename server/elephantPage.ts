/**
 * Traditional Education Landing Page
 * Served at /elephant — the destination for QR codes embedded in the Traditional Education merchandise.
 * Theme: conditioned limitation — the baby elephant who stopped trying.
 * Mobile-first. Tone: "you already know this story."
 * Theme: Dark navy matching get.theurbanmonk.com/program
 */

export function renderElephantPage(
  videoUrl?: string | null,
  productImageUrl?: string | null,
  shopifyUrl?: string | null
): string {
  const SHOPIFY_LINK = shopifyUrl || "#";
  const productImg = productImageUrl || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Traditional Education — The Urban Monk</title>
  <meta name="description" content="A baby elephant learns it cannot move. By the time it's full grown, it believes the rope is real. This design is a reminder to question what's holding you." />
  <link rel="icon" type="image/x-icon" href="/manus-storage/urban-monk-favicon_27ae5d07.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/manus-storage/urban-monk-favicon-32_ac18d482.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/manus-storage/urban-monk-favicon-180_7cd1c802.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      /* Dark navy palette — matches get.theurbanmonk.com/program */
      --bg-darkest:  #090d1a;
      --bg-dark:     #0f1729;
      --bg-card:     #172038;
      --bg-mid:      #1e2d4a;
      --accent-blue: #2563eb;
      --accent-light:#60a5fa;
      --text-primary:#f0f4ff;
      --text-muted:  #94a3b8;
      --border:      rgba(96,165,250,0.12);
      --gold:        #b8965a;
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
      padding: 28px 24px 24px;
      display: flex;
      justify-content: center;
      border-bottom: 1px solid var(--border);
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
      margin-bottom: 22px;
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
    /* Video placeholder */
    .video-placeholder {
      width: 100%;
      aspect-ratio: 16/9;
      background: var(--bg-mid);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      color: var(--text-muted);
    }
    .video-placeholder svg {
      width: 52px;
      height: 52px;
      opacity: 0.3;
    }
    .video-placeholder p {
      font-size: 13px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.5;
    }
    .video-caption {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 14px;
      letter-spacing: 0.06em;
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
    .narrative em {
      font-style: italic;
      color: var(--accent-light);
      opacity: 0.85;
    }

    /* ── Pull Quote ── */
    .pull-quote {
      max-width: 560px;
      margin: 0 auto 64px;
      padding: 32px 36px;
      border-left: 3px solid var(--accent-blue);
      background: var(--bg-card);
      border-radius: 0 8px 8px 0;
    }
    .pull-quote p {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(20px, 4.5vw, 28px);
      font-weight: 300;
      font-style: italic;
      line-height: 1.55;
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
      width: 22px;
      height: 22px;
      opacity: 0.35;
    }

    /* ── Product Section ── */
    .product-section {
      max-width: 500px;
      margin: 0 auto;
      padding: 0 24px 64px;
    }
    .product-frame {
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 16px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
      background: var(--bg-card);
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
      background: var(--bg-mid);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--text-muted);
      font-size: 13px;
      letter-spacing: 0.08em;
    }
    .product-placeholder svg {
      width: 40px;
      height: 40px;
      opacity: 0.25;
    }
    .product-caption {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 0.06em;
    }

    /* ── CTA Section ── */
    .cta-section {
      background: var(--bg-dark);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
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
    .cta-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
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
    .cta-btn-disabled {
      display: inline-block;
      padding: 16px 44px;
      background: var(--bg-mid);
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-decoration: none;
      border-radius: 6px;
      opacity: 0.5;
      cursor: default;
      pointer-events: none;
    }
    .cta-btn-secondary {
      display: inline-block;
      padding: 14px 40px;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 0.04em;
      text-decoration: none;
      border-radius: 6px;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-btn-secondary:hover {
      border-color: var(--accent-light);
      color: var(--accent-light);
    }
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
    .fade-up { animation: fadeUp 0.9s ease both; }
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
        ? `<div class="video-iframe-wrapper"><iframe src="${videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}?autoplay=0&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
        : videoUrl.includes('wistia.com')
          ? `<div class="video-iframe-wrapper"><iframe src="${videoUrl}" allowtransparency="true" frameborder="0" scrolling="no" allowfullscreen></iframe></div>`
          : `<div class="video-iframe-wrapper"><video src="${videoUrl}" controls playsinline preload="metadata"></video></div>`
      }
    </div>
    <p class="video-caption">Watch before you scroll.</p>
    ` : `
    <div class="video-wrapper">
      <div class="video-placeholder">
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
      But the school system is not the only institution that trains you to stay in your lane.
    </p>
    <p>
      The medical system does it too. And for many of us, it does it even more effectively — because it does it when we are already vulnerable.
    </p>
    <p>
      You go to your doctor. You have symptoms — fatigue, brain fog, joint pain, a gut that hasn't worked right in years, a mood that doesn't lift. You describe them. The doctor runs tests. The tests come back "normal." And the doctor says: <em>"Everything looks fine. You might want to manage your stress."</em>
    </p>
    <p>
      And you leave. Not just dismissed — <strong>corrected.</strong> The authority figure with the white coat and the system behind them has just told you that what you're experiencing is not real enough to warrant investigation. That you are, in some fundamental way, the problem.
    </p>
    <p>
      So you go home. You try harder. You sleep more. You exercise. You cut out sugar. You still feel terrible. You go back. The tests are still normal. And eventually — because you are a reasonable person who trusts institutions — you begin to wonder if maybe they're right. Maybe this is just aging. Maybe this is just stress. Maybe you need to lower your expectations.
    </p>
    <p>
      <strong>The rope goes on.</strong>
    </p>
    <p>
      Conventional medicine was built for acute care — infections, injuries, emergencies. It is extraordinary at those things. But chronic, multisystemic dysfunction — fatigue and inflammation and mood dysregulation and gut dysfunction all at once — is not an acute problem. It is a systems problem. And a model designed to match symptoms to diagnoses and diagnoses to drugs cannot see systems.
    </p>
    <p>
      When your problem doesn't fit the template, you don't get a different template. You get told there's nothing wrong.
    </p>
    <p>
      And here's the deeper conditioning: the medical system doesn't just fail to help you. It actively trains you to stop asking questions. <em>"Your numbers are normal"</em> — normal compared to a population that is, by most measures, chronically ill. <em>"There's nothing we can do"</em> — nothing within this system, in this fifteen-minute appointment. <em>"Try managing your stress"</em> — which puts the responsibility back on you without giving you any actual tools.
    </p>
    <p>
      I was pre-med. I became a monk, then got my doctorate in Oriental medicine, and spent decades in clinical practice. The patients who came to me had been so thoroughly conditioned to doubt themselves that they apologized for coming in.
    </p>
    <p>
      <em>"I know my tests are normal. I'm probably just being dramatic."</em>
    </p>
    <p>
      That's the rope. That's the stake. And it was put there by an institution that should have been helping them. The villain is not your doctor as a person — most doctors are trying. The villain is a system built for a different problem, one that has enormous cultural authority to define what is real and what is not, and no billing code for root cause.
    </p>
    <p>
      Most of us are walking around with a rope on our ankle that hasn't been real for decades. The question isn't whether you can break it. <em>The question is whether you know it's there.</em>
    </p>
  </section>
  <!-- Pull Quote -->
  <div class="pull-quote fade-up fade-up-4">
    <p>"The most dangerous prison is the one you can't see — and the most common warden wears a white coat."</p>
  </div>

  <!-- Divider -->
  <div class="divider">
    <div class="divider-line"></div>
    <svg class="divider-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3" stroke="#60a5fa" stroke-width="1.5"/>
      <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <div class="divider-line"></div>
  </div>

  <!-- Shirt Product Section -->
  <section class="product-section fade-up fade-up-4">
    <p class="eyebrow" style="text-align:center;margin-bottom:16px;">WEAR THE REMINDER</p>
    ${productImg ? `
    <div class="product-frame">
      <img src="${productImg}" alt="Traditional Education Tee — Urban Monk" loading="lazy" />
    </div>
    ` : ``}
    <div style="text-align:center;margin-top:18px;margin-bottom:8px;">
      <p style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-primary);margin-bottom:6px;">Traditional Education Tee</p>
      <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px;">$35 &mdash; Unisex V-Neck</p>
      ${SHOPIFY_LINK !== '#' ? `
      <a href="${SHOPIFY_LINK}" target="_blank" rel="noopener" style="display:inline-block;background:var(--accent-blue);color:#fff;font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;padding:13px 32px;border-radius:4px;">Get Your Shirt Now &rarr;</a>
      ` : ``}
    </div>
  </section>

  <!-- Explore Deeper -->
  <section style="max-width:500px;margin:0 auto;padding:0 24px 64px;text-align:center;" class="fade-up fade-up-4" id="deep-dive">
    <div style="border:1px solid var(--border);border-radius:8px;padding:36px 28px;background:var(--bg-card);">
      <p class="eyebrow" style="margin-bottom:14px;">GO DEEPER</p>
      <p style="font-family:'Cormorant Garamond',serif;font-size:clamp(20px,4.5vw,28px);font-weight:300;color:var(--text-primary);line-height:1.4;margin-bottom:14px;">The rope is a story.<br>Who wrote it?</p>
      <p style="font-size:15px;color:var(--text-muted);line-height:1.7;margin-bottom:24px;">Traditional education didn't just limit what you learned — it conditioned what you believe is possible. Watch the deep dive: the neuroscience of learned helplessness, how belief becomes biology, and the practice of breaking the stake.</p>
      <a href="#deep-dive-video" style="display:inline-flex;align-items:center;gap:10px;border:1px solid var(--accent-blue);color:var(--accent-light);font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:13px 28px;border-radius:4px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Explore Deeper
      </a>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta-section fade-up fade-up-5">
    <div class="cta-inner">
      <p class="cta-label">Ready to break the stake?</p>
      <h2 class="cta-heading">Turn the Lights On</h2>
      <p class="cta-body">
        The Lights On course is where the unlearning becomes a practice. Dr. Pedram Shojai's year-long program gives you the science, the tools, and the community to dismantle the invisible constraints — and rebuild your energy, clarity, and sense of what's possible from the inside out.
      </p>
      <div class="cta-stack">
        <a href="https://lightson.theurbanmonk.com" class="cta-btn" target="_blank" rel="noopener">
          Explore the Course →
        </a>
        ${SHOPIFY_LINK !== '#' ? `
        <a href="${SHOPIFY_LINK}" class="cta-btn-secondary" target="_blank" rel="noopener">
          Get the Shirt
        </a>
        ` : ``}
      </div>
      <p class="cta-note">Wear the reminder. Do the work.</p>
    </div>
  </section>

  <!-- QR Reference -->
  <section class="qr-section">
    <h3>The QR in the design</h3>
    <p>The QR code embedded in this design brought you here. That was intentional — everything on this shirt has a reason.</p>
    <img
      class="qr-img"
      src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/jtoXLKomiMZUXFvy.webp"
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
