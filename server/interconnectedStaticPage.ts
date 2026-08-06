/**
 * Interconnected — Static HTML Landing Page
 * Served at /interconnected — bypasses the React SPA bundle entirely.
 * Mobile PageSpeed target: 80+
 * No React, no 324KB CSS bundle, no framework overhead.
 * Form submission uses a lightweight vanilla JS fetch to the existing tRPC endpoint.
 */

export function renderInterconnectedPage(): string {
  const CDN = "/manus-storage/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/";
  const LOGO = CDN + "urban-monk-logo-white_bea7991f.png";
  const DOCTOR_PHOTO = CDN + "pedram-white-coat_7321e611.webp";
  const POSTER = CDN + "interconnected-poster_e31ef3aa.jpg";

  const FEATURED_EXPERTS = [
    { name: "Mark Hyman, MD", cred: "Cleveland Clinic Center for Functional Medicine", img: CDN + "mark-hyman-md_59f25bf6.jpg" },
    { name: "Dave Asprey", cred: "Founder of Bulletproof · Biohacker", img: CDN + "dave-aspey_cb9def9f.jpg" },
    { name: "Zach Bush, MD", cred: "Triple Board-Certified Physician", img: CDN + "zach-bush-md_50a4b43c.jpg" },
    { name: "Alessio Fassano, MD", cred: "Harvard Medical School · Leaky Gut Pioneer", img: CDN + "alessio-fassano-md_6d7caa9a.jpg" },
    { name: "Datis Kharrazian, PhD", cred: "Harvard Medical School Researcher", img: CDN + "datis-kharrazian-phd-dhsc_eec6ace2.jpg" },
    { name: "Max Lugavere", cred: "NYT Bestselling Author · Health Journalist", img: CDN + "max-lugavere_78f23e75.jpg" },
    { name: "JJ Virgin", cred: "Celebrity Nutrition Expert · NYT Bestselling Author", img: CDN + "jj-virgin_4bc75cbd.jpg" },
    { name: "Emeran Mayer, MD", cred: "UCLA · Author of The Mind-Gut Connection", img: CDN + "emaren-mayer-md_edf069aa.jpg" },
    { name: "Izabella Wentz, PharmD", cred: "NYT Bestselling Author · Thyroid Pharmacist", img: CDN + "izabella-wentz-pharm-d_88697c7e.jpg" },
    { name: "Tom O'Bryan, DC", cred: "World-Renowned Gluten & Autoimmunity Expert", img: CDN + "tom-o-bryan-dc-dacbn_4db66297.jpg" },
    { name: "Rangan Chatterjee, MD", cred: "BBC Doctor · Author of Feel Better in 5", img: CDN + "rangan-chatterjee-md_ef5a443c.jpg" },
    { name: "Martin Blaser, MD", cred: "NYU · Author of Missing Microbes", img: CDN + "martin-blaser-md_76654a0c.jpg" },
  ];

  const ALL_EXTRA_EXPERTS = [
    "Gurunduth Banavar", "Maggie Berghoff", "Razi Berry", "Robin Berzin, MD",
    "Christina Bjorndahl", "Summer Bock", "Eugenia Bone", "Elhanan Borenstein, PhD",
    "Jolene Brighten, ND", "Kenneth Brown, MD", "Robynne Chutkan, MD", "Edison De Mello, MD",
    "Afrouz Demehri, NMD", "Peter Diamandis, MD", "Carolyn Edelstein", "Joel Evans, MD",
    "Tom Fabian, PhD", "Kara Fitzgerald, ND", "Emily Fletcher", "Rob Franklin, DVM",
    "Claire Fraser, PhD", "Bob Harding, DO", "Jennifer Harmon-Meyer", "Tara Hunkin",
    "Pejman Katiraei, DO", "Raphael Kellman, MD", "Finian Makepeace", "Tom Malterre, MS",
    "Laura Markle Downton", "James Maskell", "Sarkis Mazmanian, PhD", "Mark Menolascino, MD",
    "Helen Messier, MD", "Gerard Mullin, MD", "Karen Nelson, PhD", "Barbara Olendzki, RD",
    "Ally Perlina", "Warren Phillips, MS", "Joe Pizzorno, ND", "Daniel Pompa, PSc.D",
    "David Relman, MD", "Robert Rountree, MD", "Michael Ruscio, DC", "Shivan Sarna",
    "Trudy Scott, CN", "Ann Shippy, MD", "Marvin Singh, MD", "Mariza Snyder, DC",
    "Joel Sprechman", "Sarah Anne Stewart", "Marisol Teijeiro, ND", "Momo Vuyisich",
    "Genevieve White", "Todd White", "Magdalena Wszelaki", "Eric Zielinski, DC",
  ];

  const EPISODES = [
    { num: 1, title: "The Invisible Organ: The Missing Piece in Health and Longevity", bullets: ["Why obesity, diabetes, autoimmune disease, and even cancer all start in the gut", "What indigenous tribes have that industrialized populations have lost", "The new diagnostic tools making gut medicine the foundation of modern healthcare"] },
    { num: 2, title: "The Human Microbiome: The Raging Battle From Within", bullets: ["The unholy trinity of autoimmune diseases — and how to protect yourself", "What ancient medicine knew about the gut that modern science is only now confirming", "Leaky gut: how to know if you have it and how to repair it"] },
    { num: 3, title: "The Truth About Probiotics", bullets: ["Why no single diet works for everyone — and what your unique microbiome demands", "What dysbiosis looks like and how it drives chronic disease", "Why adding probiotics to a toxic gut can make things worse, not better"] },
    { num: 4, title: "The Trouble With Toxins: Staying Alive in a Toxic World", bullets: ["The environmental toxins in your home killing your microbiome day by day", "The real cause of IBS — and how feeding good bacteria can stop it", "Why your body may be blocked from naturally eliminating disease-spreading toxins"] },
    { num: 5, title: "The Kids Aren't Alright: Leaky Gut — Leaky Brain — Leaky Kids", bullets: ["How gut microbiota are hardwired into your neurobiology, immunity, and longevity", "How nourishing the gut sends stress-relieving signals to the brain", "Does Parkinson's actually begin in the gut? New research says yes."] },
    { num: 6, title: "The Microbiome Solution: Thyroid, Obesity, and Diabetes", bullets: ["3 tell-tale signs of an underactive thyroid you're probably ignoring", "How microbiome care can help reverse Hashimoto's disease", "Why your microbiome may be triggering your weight gain — and how to fix it"] },
    { num: 7, title: "The Microbiome Solution: Cancer, Immunity, and Heart Disease", bullets: ["Can we predict cancer by analyzing gut microbes? Scientists say yes.", "How balancing your microbiome resolves skin problems — acne, eczema, and more", "The gut-heart connection: what your microbiome has to do with cardiovascular disease"] },
    { num: 8, title: "Ancient Wisdom and Modern Technology: Personalized Medicine", bullets: ["AI and microbiome testing: the breakthrough creating truly individualized medicine", "How ancient systems of medicine predicted the microbiome revolution", "The new GPS for treating disease that puts YOU in control of your health"] },
    { num: 9, title: "Healing Yourself: A Bright Future", bullets: ["How to wean yourself off the chronic disease-causing Standard American Diet", "Why the future is about building your own force field against disease", "The actionable roadmap to healing your gut starting today"] },
  ];

  const expertCards = FEATURED_EXPERTS.map(e => `
    <div class="expert-card">
      <div class="expert-img-wrap">
        <img src="${e.img}" alt="${e.name}" loading="lazy" decoding="async" width="90" height="90" />
      </div>
      <p class="expert-name">${e.name}</p>
      <p class="expert-cred">${e.cred}</p>
    </div>`).join("");

  const extraPills = ALL_EXTRA_EXPERTS.map(n => `<span class="pill">${n}</span>`).join("");

  const episodeItems = EPISODES.map(ep => `
    <div class="episode-item">
      <div class="ep-num">${ep.num}</div>
      <div>
        <h3 class="ep-title">${ep.title}</h3>
        <ul class="ep-bullets">
          ${ep.bullets.map(b => `<li><span class="check">✓</span>${b}</li>`).join("")}
        </ul>
      </div>
    </div>`).join("");

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Interconnected — The Power to Heal From Within | The Urban Monk</title>
  <meta name="description" content="70 world-leading doctors reveal the hidden root of chronic disease — and the breakthrough science that can heal it. Free 9-part documentary series." />
  <link rel="icon" type="image/x-icon" href="/manus-storage/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/urban-monk-favicon_27ae5d07.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=optional" rel="stylesheet" />
  <!-- Meta Pixel — PageView only on opt-in page. Lead event fires on thank-you page load (confirmed conversion). -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','1498608757116877');
    fbq('track','PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1498608757116877&ev=PageView&noscript=1"/></noscript>
  <!-- GA4 — deferred -->
  <script defer src="https://www.googletagmanager.com/gtag/js?id=G-CXZK2Q275S"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-CXZK2Q275S');</script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg0:#020d18;
      --bg1:#0a1520;
      --bg2:#0d1e2e;
      --bg3:#161E2A;
      --accent:#2E91FC;
      --accent-light:#7ecfdf;
      --text:#f0f4f8;
      --muted:#9ca3af;
      --card-bg:rgba(5,20,35,0.95);
      --card-border:rgba(46,145,252,0.35);
    }
    html{scroll-behavior:smooth}
    body{background:var(--bg1);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}

    /* ── Sticky bar ── */
    #sticky-bar{position:sticky;top:0;z-index:50;background:var(--bg0);border-bottom:1px solid rgba(46,145,252,0.4);padding:8px 16px;text-align:center;font-size:14px;font-weight:600;color:#fff}
    #sticky-bar .timer{color:var(--accent);font-family:monospace;font-weight:900}
    #sticky-bar a{color:var(--accent-light);text-decoration:underline;cursor:pointer;background:none;border:none;font:inherit;font-weight:700}

    /* ── Hero ── */
    .hero{position:relative;min-height:100svh;display:flex;align-items:center;background:linear-gradient(135deg,#020d18 0%,#051e2e 50%,#020d18 100%)}
    .hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.2;pointer-events:none}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(2,13,24,.9) 0%,rgba(2,13,24,.5) 50%,rgba(2,13,24,.8) 100%)}
    .hero-inner{position:relative;z-index:1;width:100%;max-width:1152px;margin:0 auto;padding:64px 16px}
    .logo{width:144px;display:block;margin:0 auto 32px}
    @media(min-width:768px){.logo{margin:0 0 32px}}
    .hero-grid{display:grid;gap:40px}
    @media(min-width:1024px){.hero-grid{grid-template-columns:1fr 1fr;align-items:start}}
    h1{font-size:clamp(2.2rem,4vw,3.5rem);font-weight:900;line-height:1;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:12px}
    .tagline{font-size:1.25rem;font-weight:300;font-style:italic;color:var(--accent-light);margin-bottom:24px}
    .claim-box{background:rgba(46,145,252,.1);border:1px solid rgba(46,145,252,.3);border-radius:8px;padding:20px;margin-bottom:24px}
    .claim-box p{font-size:1.25rem;font-weight:900;text-transform:uppercase;line-height:1.3}
    .claim-box span{color:var(--accent)}
    .lead-text{color:#d1d5db;font-size:1.1rem;line-height:1.7;margin-bottom:24px}
    .badges{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px}
    .badge{display:flex;align-items:center;gap:8px;font-size:.875rem;color:#a0d8e8;font-weight:600}
    .countdown-box{display:flex;align-items:center;gap:12px;background:rgba(10,20,30,.7);border:1px solid rgba(46,145,252,.3);border-radius:8px;padding:12px}
    .countdown-box .warn{font-size:1.25rem}
    .countdown-box .label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent-light)}
    .countdown-box .digits{font-family:monospace;font-size:1.5rem;font-weight:900;color:#fff;line-height:1}

    /* ── Form ── */
    .form-wrap{background:var(--card-bg);border:1px solid var(--card-border);border-radius:12px;padding:24px}
    .form-label{text-align:center;font-weight:900;font-size:.875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:16px}
    .form-wrap input[type=text],.form-wrap input[type=email],.form-wrap input[type=tel]{width:100%;padding:12px 16px;background:#fff;color:#111;border:0;border-radius:4px;font-size:1rem;margin-bottom:12px;outline:none}
    .form-wrap input:focus{box-shadow:0 0 0 2px #22d3ee}
    .sms-consent{display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:12px;margin-bottom:12px;cursor:pointer}
    .sms-consent input[type=checkbox]{width:20px;height:20px;flex-shrink:0;margin-top:2px;cursor:pointer;accent-color:#0891b2}
    .sms-consent span{font-size:.75rem;color:#d1d5db;line-height:1.5}
    .sms-consent a{color:#67e8f9;text-decoration:underline}
    .submit-btn{width:100%;padding:16px 24px;background:#018db1;color:#fff;border:0;border-radius:4px;font-size:1rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}
    .submit-btn:disabled{opacity:.6;cursor:not-allowed}
    .form-note{font-size:.75rem;color:#6b7280;text-align:center;margin-top:8px}
    .form-error{color:#fca5a5;font-size:.875rem;margin-bottom:8px}

    /* ── Sections ── */
    section{padding:56px 16px}
    .container{max-width:1152px;margin:0 auto}
    .container-md{max-width:900px;margin:0 auto}
    .container-sm{max-width:576px;margin:0 auto;text-align:center}
    .section-title{font-size:1.875rem;font-weight:900;text-transform:uppercase;color:var(--text);margin-bottom:8px}
    .section-sub{color:var(--accent-light);margin-bottom:40px}
    .divider{width:64px;height:4px;background:var(--accent);border-radius:2px;margin:0 auto 40px}
    .two-col{display:grid;gap:40px;align-items:center}
    @media(min-width:768px){.two-col{grid-template-columns:1fr 1fr}}
    .three-col{display:grid;gap:32px;align-items:center}
    @media(min-width:768px){.three-col{grid-template-columns:1fr 2fr}}

    /* ── Take advantage ── */
    .poster-img{border-radius:12px;width:100%;object-fit:cover;max-height:340px;box-shadow:0 25px 50px rgba(0,0,0,.5)}

    /* ── Mark Hyman quote ── */
    .quote-photo{width:180px;height:180px;border-radius:50%;overflow:hidden;border:4px solid rgba(46,145,252,.5);box-shadow:0 25px 50px rgba(0,0,0,.5);flex-shrink:0}
    .quote-photo img{width:100%;height:100%;object-fit:cover}
    .quote-mark{font-size:2.5rem;color:var(--accent);line-height:1;margin-bottom:8px}
    blockquote{font-size:1.25rem;font-style:italic;color:#f3f4f6;line-height:1.7;margin-bottom:16px}
    .quote-author{font-weight:900;font-size:1.125rem;color:var(--accent)}
    .quote-cred{font-size:.875rem;color:#9ca3af}

    /* ── Expert grid ── */
    .expert-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
    @media(min-width:640px){.expert-grid{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:768px){.expert-grid{grid-template-columns:repeat(4,1fr)}}
    @media(min-width:1024px){.expert-grid{grid-template-columns:repeat(6,1fr)}}
    .expert-card{display:flex;flex-direction:column;align-items:center;text-align:center}
    .expert-img-wrap{width:90px;height:90px;border-radius:50%;overflow:hidden;border:3px solid rgba(46,145,252,.4);background:var(--bg3);margin-bottom:12px;flex-shrink:0}
    .expert-img-wrap img{width:100%;height:100%;object-fit:cover}
    .expert-name{font-weight:700;font-size:.75rem;color:#fff;line-height:1.3;margin-bottom:2px}
    .expert-cred{font-size:.7rem;color:var(--accent-light);line-height:1.3}
    .pills-label{text-align:center;font-size:.875rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent-light);margin-bottom:20px}
    .pills{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
    .pill{font-size:.75rem;color:#d1d5db;padding:6px 12px;border-radius:999px;background:rgba(46,145,252,.08);border:1px solid rgba(46,145,252,.2)}

    /* ── Episodes ── */
    .episode-item{display:flex;gap:20px;align-items:flex-start;padding-bottom:20px;border-bottom:1px solid rgba(46,145,252,.12)}
    .episode-item:last-child{border-bottom:0}
    .ep-num{flex-shrink:0;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.875rem;background:rgba(46,145,252,.15);border:1px solid rgba(46,145,252,.4);color:var(--accent)}
    .ep-title{color:#fff;font-weight:700;margin-bottom:8px;line-height:1.4}
    .ep-bullets{list-style:none;display:flex;flex-direction:column;gap:4px}
    .ep-bullets li{display:flex;align-items:flex-start;gap:8px;color:#9ca3af;font-size:.875rem}
    .check{color:var(--accent);font-weight:700;flex-shrink:0;margin-top:1px}

    /* ── Host bio ── */
    .host-photo{border-radius:12px;overflow:hidden;border:1px solid rgba(46,145,252,.25);max-width:280px;width:100%}
    .host-photo img{width:100%;object-fit:cover;object-position:top;max-height:280px}
    .host-name{font-size:1.5rem;font-weight:900;margin-bottom:4px}
    .host-title{font-size:.875rem;color:var(--accent);margin-bottom:16px}
    .host-bio{color:#d1d5db;line-height:1.7;margin-bottom:12px}

    /* ── Bottom CTA ── */
    .cta-timer{font-family:monospace;font-size:3rem;font-weight:900;color:#fff;margin-bottom:24px}

    /* ── Footer ── */
    footer{background:var(--bg0);border-top:1px solid rgba(46,145,252,.1);padding:32px 16px;text-align:center}
    footer img{width:112px;opacity:.5;margin:0 auto 16px;display:block}
    .footer-legal{color:#4b5563;font-size:.75rem;max-width:672px;margin:0 auto 8px;line-height:1.6}
    .footer-links{display:flex;justify-content:center;gap:16px;margin-top:12px}
    .footer-links a{color:#4b5563;font-size:.75rem;text-decoration:none}
    .footer-links a:hover{color:#9ca3af}
  </style>
</head>
<body>

<!-- ── STICKY BAR ── -->
<div id="sticky-bar">
  Free viewing period closes in:&nbsp;
  <span class="timer" id="sticky-timer">--:--:--</span>
  &nbsp;—&nbsp;
  <a onclick="document.getElementById('hero-form').scrollIntoView({behavior:'smooth',block:'center'})">Claim your free access now</a>
</div>

<!-- ── HERO ── -->
<section class="hero">
  <img src="${POSTER}" alt="" aria-hidden="true" fetchpriority="high" decoding="sync" class="hero-bg" width="1200" height="800" />
  <div class="hero-overlay"></div>
  <div class="hero-inner">
    <img src="${LOGO}" alt="The Urban Monk" class="logo" width="144" height="40" fetchpriority="high" />
    <div class="hero-grid">
      <!-- Left: copy -->
      <div>
        <h1>INTERCONNECTED</h1>
        <p class="tagline">The Power to Heal From Within</p>
        <div class="claim-box">
          <p>THE SOURCE OF 90% OF ALL CHRONIC DISEASE:<span> DISCOVERED</span></p>
        </div>
        <p class="lead-text">
          70 of the world's leading doctors, researchers, and scientists reveal the hidden root
          of obesity, autoimmunity, brain fog, fatigue, and chronic disease — and the
          breakthrough science that can heal it.
        </p>
        <div class="badges">
          <div class="badge"><span>🎬</span><span>9-Part Documentary Series</span></div>
          <div class="badge"><span>👨‍⚕️</span><span>70+ World-Class Experts</span></div>
          <div class="badge"><span>🎁</span><span>100% Free Access</span></div>
        </div>
        <div class="countdown-box">
          <span class="warn">⚠</span>
          <div>
            <p class="label">Free viewing period closes in:</p>
            <p class="digits" id="hero-timer">--:--:--</p>
          </div>
        </div>
      </div>
      <!-- Right: form -->
      <div id="hero-form">
        <div class="form-wrap">
          <p class="form-label">Register NOW for a limited-time FREE viewing of this groundbreaking 9-part documentary series.</p>
          <div id="form-error-hero" class="form-error" style="display:none"></div>
          <form id="optin-form-hero" onsubmit="submitForm(event,'hero')">
            <input type="text" name="name" placeholder="First Name" required autocomplete="given-name" />
            <input type="email" name="email" placeholder="Email" required autocomplete="email" />
            <input type="tel" name="phone" placeholder="Mobile Phone (optional — episode reminders)" autocomplete="tel" />
            <label class="sms-consent">
              <input type="checkbox" name="smsConsent" />
              <span>By checking this box you agree to receive recurring, automated marketing text messages from The Urban Monk and select third-party partners, at the phone number you provide, even if it is on a Do Not Call list. Consent is not required to purchase. Msg frequency varies. Msg&amp;Data rates may apply. Reply HELP for support or STOP to cancel. <a href="https://theurbanmonk.com/sms-terms" target="_blank" rel="noopener">SMS Terms</a> | <a href="https://theurbanmonk.com/privacy" target="_blank" rel="noopener">Privacy Policy</a></span>
            </label>
            <button type="submit" class="submit-btn" id="submit-hero">REGISTER NOW!</button>
            <p class="form-note">100% free. No credit card required.</p>
          </form>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── TAKE ADVANTAGE ── -->
<section style="background:var(--bg2)">
  <div class="container">
    <div class="two-col">
      <div>
        <img src="${POSTER}" alt="Interconnected Documentary" class="poster-img" loading="lazy" decoding="async" width="600" height="340" />
      </div>
      <div>
        <h2 class="section-title">Take Advantage of the Next Frontier of Medicine:</h2>
        <p style="color:#d1d5db;font-size:1.1rem;line-height:1.7;margin-bottom:16px">
          Naturally heal chronic disease, sharpen your thinking, and boost your immune system when you
          discover how to feed, nurture, and control your gut's microbiome — the vast community of
          bacteria, viruses, and microorganisms that science has now proven we cannot function without.
        </p>
        <p style="color:#d1d5db;font-size:1.1rem;line-height:1.7">
          This is the hottest area of medical research today — and it changes everything you thought
          you knew about health, disease, and the human body.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- ── MARK HYMAN QUOTE ── -->
<section style="background:var(--bg3)">
  <div class="container-md">
    <div class="three-col">
      <div style="display:flex;justify-content:center">
        <div class="quote-photo">
          <img src="${CDN}mark-hyman-md_59f25bf6.jpg" alt="Mark Hyman, MD" loading="lazy" decoding="async" width="180" height="180" />
        </div>
      </div>
      <div>
        <p class="quote-mark">&ldquo;</p>
        <blockquote>The microbiome is the next frontier in medicine. Understanding it and optimizing it is going to be critical to solving so many of our healthcare issues.</blockquote>
        <p class="quote-author">Mark Hyman, MD</p>
        <p class="quote-cred">Cleveland Clinic Center for Functional Medicine</p>
      </div>
    </div>
  </div>
</section>

<!-- ── EXPERT GRID ── -->
<section style="background:var(--bg1)">
  <div class="container">
    <h2 class="section-title" style="text-align:center">Meet the All-Star Lineup</h2>
    <p class="section-sub" style="text-align:center">Here are the preeminent doctors, researchers, and experts you'll meet inside Interconnected:</p>
    <div class="divider"></div>
    <div class="expert-grid">${expertCards}</div>
    <div style="margin-top:48px">
      <p class="pills-label">Plus 58 More World-Renowned Experts Including:</p>
      <div class="pills">${extraPills}</div>
    </div>
  </div>
</section>

<!-- ── EPISODES ── -->
<section style="background:var(--bg2)">
  <div class="container-md">
    <h2 class="section-title" style="text-align:center">Here's a Peek at What You'll Discover Inside</h2>
    <p class="section-sub" style="text-align:center">Interconnected: The Power to Heal From Within — 9 Episodes</p>
    <div style="display:flex;flex-direction:column;gap:20px">${episodeItems}</div>
  </div>
</section>

<!-- ── MID-PAGE CTA ── -->
<section style="background:var(--bg3)">
  <div class="container-sm">
    <h2 class="section-title">Discover the Secret to Reversing Chronic Disease</h2>
    <p style="color:var(--accent-light);margin-bottom:24px">Register now before the free viewing period ends.</p>
    <div class="form-wrap">
      <div id="form-error-mid" class="form-error" style="display:none"></div>
      <form id="optin-form-mid" onsubmit="submitForm(event,'mid')">
        <input type="text" name="name" placeholder="First Name" required autocomplete="given-name" />
        <input type="email" name="email" placeholder="Email" required autocomplete="email" />
        <button type="submit" class="submit-btn" id="submit-mid">REGISTER NOW!</button>
        <p class="form-note">100% free. No credit card required.</p>
      </form>
    </div>
  </div>
</section>

<!-- ── HOST BIO ── -->
<section style="background:var(--bg1)">
  <div class="container-md">
    <p style="text-align:center;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:24px">Meet Your Host</p>
    <div class="three-col">
      <div style="display:flex;justify-content:center">
        <div class="host-photo">
          <img src="${DOCTOR_PHOTO}" alt="Dr. Pedram Shojai, OMD" loading="lazy" decoding="async" width="280" height="280" />
        </div>
      </div>
      <div>
        <h3 class="host-name">Dr. Pedram Shojai, OMD</h3>
        <p class="host-title">Doctor of Oriental Medicine &nbsp;|&nbsp; Former Taoist Monk &nbsp;|&nbsp; NYT Bestselling Author</p>
        <p class="host-bio">Dr. Pedram Shojai is a Doctor of Oriental Medicine, former Taoist monk, and New York Times bestselling author of <em>The Urban Monk</em> and <em>The Art of Stopping Time</em>. He is the producer of the documentary films <em>Vitality</em>, <em>Origins</em>, and <em>Prosperity</em>, and the host and executive producer of <em>Interconnected</em>.</p>
        <p class="host-bio">With over 20 years of clinical practice and a deep grounding in both Eastern and Western medicine, Dr. Shojai brings a uniquely integrated perspective to the science of the microbiome — one that bridges ancient wisdom with cutting-edge research.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── BOTTOM CTA ── -->
<section style="background:var(--bg2)">
  <div class="container-sm">
    <h2 class="section-title">Don't Miss the Free Viewing Period</h2>
    <p style="color:var(--accent-light);margin-bottom:8px">Access closes in:</p>
    <p class="cta-timer" id="bottom-timer">--:--:--</p>
    <div class="form-wrap">
      <div id="form-error-bottom" class="form-error" style="display:none"></div>
      <form id="optin-form-bottom" onsubmit="submitForm(event,'bottom')">
        <input type="text" name="name" placeholder="First Name" required autocomplete="given-name" />
        <input type="email" name="email" placeholder="Email" required autocomplete="email" />
        <button type="submit" class="submit-btn" id="submit-bottom">REGISTER NOW!</button>
        <p class="form-note">100% free. No credit card required.</p>
      </form>
    </div>
  </div>
</section>

<!-- ── FOOTER ── -->
<footer>
  <img src="${LOGO}" alt="The Urban Monk" loading="lazy" width="112" height="32" />
  <p class="footer-legal">THE INFORMATION ON THIS SITE IS FOR EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS MEDICAL ADVICE. READERS ARE ADVISED TO CONSULT A QUALIFIED PROFESSIONAL ABOUT ANY ISSUE REGARDING THEIR HEALTH AND WELL-BEING.</p>
  <p class="footer-legal">Facebook and Instagram are trademarks of Meta Inc and are not associated with this page.</p>
  <p class="footer-legal" style="color:#374151">Brought to you by The Urban Monk Productions &copy; ${year} All Rights Reserved.</p>
  <div class="footer-links">
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </div>
</footer>

<script>
// ── Countdown Timer ──────────────────────────────────────────────────────────
(function() {
  var KEY = 'ic_end_47h';
  var stored = sessionStorage.getItem(KEY);
  var end;
  if (stored) {
    end = parseInt(stored, 10);
  } else {
    end = Date.now() + 47 * 3600 * 1000;
    sessionStorage.setItem(KEY, end);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var diff = Math.max(0, end - Date.now());
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var str = pad(h) + ':' + pad(m) + ':' + pad(s);
    var el1 = document.getElementById('sticky-timer');
    var el2 = document.getElementById('hero-timer');
    var el3 = document.getElementById('bottom-timer');
    if (el1) el1.textContent = str;
    if (el2) el2.textContent = str;
    if (el3) el3.textContent = str;
  }

  tick();
  setInterval(tick, 1000);
})();

// ── Form Submission ──────────────────────────────────────────────────────────
function submitForm(e, id) {
  e.preventDefault();
  var form = e.target;
  var btn = document.getElementById('submit-' + id);
  var errEl = document.getElementById('form-error-' + id);
  var name = (form.elements['name'] || {value:''}).value.trim();
  var email = (form.elements['email'] || {value:''}).value.trim();
  var phone = (form.elements['phone'] || {value:''}).value.trim();
  var smsConsent = !!(form.elements['smsConsent'] && form.elements['smsConsent'].checked);

  if (!name || !email) {
    if (errEl) { errEl.textContent = 'Please enter your name and email.'; errEl.style.display = 'block'; }
    return;
  }
  if (phone && !smsConsent) {
    if (errEl) { errEl.textContent = 'Please check the SMS consent box to include your phone number.'; errEl.style.display = 'block'; }
    var cbEl = form.elements['smsConsent'];
    if (cbEl) { cbEl.style.outline = '2px solid #f87171'; cbEl.focus(); }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Registering...'; }

  // Capture UTM + Meta attribution signals for CAPI matching
  var params = new URLSearchParams(window.location.search);
  var fbclid = params.get('fbclid') || '';
  function getCookie(n) { var m = document.cookie.match('(?:^|;\\s*)' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  var fbp = getCookie('_fbp');
  var fbc = getCookie('_fbc') || (fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '');
  var payload = {
    name: name, email: email, phone: phone || undefined, smsConsent: smsConsent,
    pageVariant: 'A',
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent: params.get('utm_content') || undefined,
    referrer: document.referrer || undefined,
    fbclid: fbclid || undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined
  };

  fetch('/api/trpc/interconnected.register?batch=1', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ "0": { json: payload } })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var result = data && data[0] && data[0].result;
    if (result && result.data) {
      // Tag landing page variant so TY splitter can cross-tabulate LP-A vs LP-B
      try { localStorage.setItem('ic_lp_variant', 'A'); } catch(e) {}
      // Redirect to thank-you page — Lead pixel fires there on confirmed load
      window.location.href = '/interconnected/thank-you';
    } else {
      var msg = (data && data[0] && data[0].error && data[0].error.message) || 'Something went wrong. Please try again.';
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      if (btn) { btn.disabled = false; btn.textContent = 'REGISTER NOW!'; }
    }
  })
  .catch(function() {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
    if (btn) { btn.disabled = false; btn.textContent = 'REGISTER NOW!'; }
  });
}
</script>
</body>
</html>`;
}
