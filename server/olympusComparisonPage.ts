/**
 * Olympus Line Comparison Page
 * Route: GET /olympus
 * Dark navy theme — matches get.theurbanmonk.com/program
 * Includes: Chart.js radar/bar chart, feature comparison table, CTA links to each Shopify product
 */

export function renderOlympusComparisonPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Compare the Olympus Line | The Urban Monk</title>
  <meta name="description" content="Compare all 5 Olympus formulas — Olympus, Olympus+, Olympus Her, Olympus Her+, and Olympus Her Max. Find the right prescription compounded formula for your needs." />
  <link rel="icon" type="image/png" href="/favicon-32x32.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-darkest: #090d1a;
      --bg-dark: #0f1729;
      --bg-card: #172038;
      --bg-card2: #1e2a45;
      --accent-blue: #2563eb;
      --accent-light: #60a5fa;
      --accent-indigo: #818cf8;
      --accent-pink: #f472b6;
      --accent-purple: #c084fc;
      --accent-orange: #fb923c;
      --text-primary: #f0f4ff;
      --text-muted: #94a3b8;
      --border: rgba(255,255,255,0.08);
    }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg-darkest);
      color: var(--text-primary);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; text-decoration: none; }

    /* ── Header ── */
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(9,13,26,0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-mark {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(37,99,235,0.15);
      border: 1px solid rgba(37,99,235,0.3);
      display: flex; align-items: center; justify-content: center;
      font-family: 'EB Garamond', serif; font-size: 15px; font-weight: 700; color: var(--accent-light);
    }
    .logo-name { font-family: 'EB Garamond', serif; font-size: 18px; font-weight: 600; color: var(--text-primary); }
    .header-rx { font-size: 12px; color: var(--text-muted); letter-spacing: 0.05em; }

    /* ── Hero ── */
    .hero {
      background: linear-gradient(135deg, #090d1a 0%, #0d1428 60%, #0a1020 100%);
      padding: 80px 24px 64px;
      text-align: center;
      position: relative; overflow: hidden;
    }
    .hero::before {
      content: ''; position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
      width: 600px; height: 500px; border-radius: 50%;
      background: radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .eyebrow {
      font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--accent-light); margin-bottom: 16px; position: relative; z-index: 1;
    }
    .hero h1 {
      font-family: 'EB Garamond', serif; font-size: clamp(36px, 6vw, 60px); font-weight: 700;
      line-height: 1.1; color: var(--text-primary); margin-bottom: 20px; position: relative; z-index: 1;
    }
    .hero-sub {
      font-size: 17px; color: var(--text-muted); max-width: 600px; margin: 0 auto 40px;
      position: relative; z-index: 1;
    }
    .gender-tabs {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
      position: relative; z-index: 1;
    }
    .gender-tab {
      padding: 10px 28px; border-radius: 40px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted);
    }
    .gender-tab.active { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; }
    .gender-tab:hover:not(.active) { border-color: var(--accent-light); color: var(--text-primary); }

    /* ── Section ── */
    .section { padding: 72px 24px; max-width: 1100px; margin: 0 auto; }
    .section-alt { background: var(--bg-dark); }
    .section-alt .section { max-width: 100%; padding-left: 0; padding-right: 0; }
    .section-alt .section-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .section-title {
      font-family: 'EB Garamond', serif; font-size: clamp(28px, 4vw, 40px); font-weight: 700;
      color: var(--text-primary); margin-bottom: 12px; text-align: center;
    }
    .section-sub { font-size: 16px; color: var(--text-muted); text-align: center; margin-bottom: 48px; }

    /* ── Product Cards ── */
    .cards-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;
    }
    .product-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
      padding: 28px; display: flex; flex-direction: column; gap: 16px;
      transition: border-color 0.2s, transform 0.2s;
    }
    .product-card:hover { transform: translateY(-3px); }
    .card-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
    }
    .card-title {
      font-family: 'EB Garamond', serif; font-size: 28px; font-weight: 700; color: var(--text-primary);
    }
    .card-formula { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
    .card-price {
      font-size: 22px; font-weight: 700; color: var(--text-primary);
    }
    .card-price-note { font-size: 12px; color: var(--text-muted); }
    .card-bullets { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .card-bullets li {
      font-size: 13px; color: var(--text-muted); padding-left: 18px; position: relative;
    }
    .card-bullets li::before {
      content: '✓'; position: absolute; left: 0; font-weight: 700;
    }
    .card-cta {
      display: block; text-align: center; padding: 14px 24px; border-radius: 8px;
      font-size: 14px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      color: #fff; margin-top: auto; transition: opacity 0.2s;
    }
    .card-cta:hover { opacity: 0.88; }
    .card-cta-outline {
      display: block; text-align: center; padding: 12px 24px; border-radius: 8px;
      font-size: 13px; font-weight: 600; border: 1px solid; color: var(--text-muted);
      margin-top: 8px; transition: all 0.2s;
    }
    .card-cta-outline:hover { color: var(--text-primary); }

    /* ── Chart Section ── */
    .chart-wrap {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
      padding: 32px; margin-bottom: 48px;
    }
    .chart-title {
      font-family: 'EB Garamond', serif; font-size: 22px; font-weight: 700;
      color: var(--text-primary); margin-bottom: 6px;
    }
    .chart-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
    .chart-container { position: relative; height: 320px; }

    /* ── Comparison Table ── */
    .table-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; min-width: 700px; }
    thead { background: var(--bg-card2); }
    thead th {
      padding: 16px 20px; text-align: left; font-size: 12px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    thead th:first-child { color: var(--text-primary); }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.15s; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: rgba(255,255,255,0.03); }
    tbody td {
      padding: 14px 20px; font-size: 14px; color: var(--text-muted); vertical-align: middle;
    }
    tbody td:first-child { color: var(--text-primary); font-weight: 500; }
    .check { color: #4ade80; font-size: 16px; }
    .dash { color: rgba(255,255,255,0.2); }
    .product-name-cell { display: flex; align-items: center; gap: 8px; }
    .color-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .table-cta-cell { white-space: nowrap; }
    .table-cta {
      display: inline-block; padding: 8px 16px; border-radius: 6px;
      font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      color: #fff; transition: opacity 0.2s;
    }
    .table-cta:hover { opacity: 0.85; }

    /* ── Gender filter ── */
    .gender-section { display: none; }
    .gender-section.visible { display: block; }

    /* ── FAQ ── */
    .faq-list { display: flex; flex-direction: column; gap: 16px; max-width: 800px; margin: 0 auto; }
    .faq-item {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px;
    }
    .faq-q { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px; }
    .faq-a { font-size: 14px; color: var(--text-muted); line-height: 1.7; }

    /* ── Disclaimer ── */
    .disclaimer {
      background: rgba(251,146,60,0.06); border: 1px solid rgba(251,146,60,0.2);
      border-radius: 12px; padding: 20px 24px; max-width: 900px; margin: 0 auto 48px;
    }
    .disclaimer p { font-size: 12px; color: var(--text-muted); line-height: 1.7; }
    .disclaimer strong { color: var(--accent-orange); }

    /* ── Footer ── */
    footer {
      background: var(--bg-dark); border-top: 1px solid var(--border);
      padding: 32px 24px; text-align: center;
    }
    footer p { font-size: 12px; color: var(--text-muted); }
    footer a { color: var(--accent-light); }

    @media (max-width: 640px) {
      .hero { padding: 56px 16px 48px; }
      .section { padding: 48px 16px; }
      .cards-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-mark">UM</div>
    <span class="logo-name">The Urban Monk</span>
  </div>
  <span class="header-rx">Prescription Compounded · Strive Pharmacy</span>
</header>

<!-- Hero -->
<section class="hero">
  <p class="eyebrow">The Olympus Line</p>
  <h1>Find Your Formula</h1>
  <p class="hero-sub">Five precision-compounded formulas for men and women. Each one targets a different layer of sexual health — from neurological desire to vascular performance.</p>
  <div class="gender-tabs">
    <button class="gender-tab active" onclick="filterGender('all')" id="tab-all">All Formulas</button>
    <button class="gender-tab" onclick="filterGender('men')" id="tab-men">For Men</button>
    <button class="gender-tab" onclick="filterGender('women')" id="tab-women">For Women</button>
  </div>
</section>

<!-- Product Cards -->
<section style="background: var(--bg-darkest); padding: 64px 24px;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <p class="section-title" style="margin-bottom: 48px;">The Complete Olympus Line</p>

    <!-- Men's Cards -->
    <div id="cards-men" class="gender-section visible">
      <p class="eyebrow" style="text-align:center; margin-bottom:24px; color: var(--accent-light);">For Men</p>
      <div class="cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">

        <!-- Olympus -->
        <div class="product-card" style="border-color: rgba(96,165,250,0.25);">
          <div>
            <span class="card-badge" style="background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.3); color: #93c5fd;">Entry · Men</span>
          </div>
          <div class="card-title" style="color: #60a5fa;">Olympus</div>
          <div class="card-formula">Bremelanotide 1mg + Oxytocin 20IU<br/>Sublingual Flex-Dose Tablet</div>
          <ul class="card-bullets">
            <li>Neurological desire activation</li>
            <li>FDA-approved mechanism (PT-141)</li>
            <li>Emotional depth via Oxytocin</li>
            <li>No cardiovascular stimulation</li>
          </ul>
          <div>
            <div class="card-price">$120</div>
            <div class="card-price-note">12 tablets · 1 month supply · 3 refills</div>
          </div>
          <a href="https://shop.theurbanmonk.com/cart/48596830650522:1" class="card-cta" style="background: #2563eb;" target="_blank" rel="noopener">
            Get Olympus &rarr;
          </a>
          <a href="https://shop.theurbanmonk.com/products/olympus-1" class="card-cta-outline" style="border-color: rgba(96,165,250,0.3);" target="_blank" rel="noopener">
            View Product Page
          </a>
        </div>

        <!-- Olympus+ -->
        <div class="product-card" style="border-color: rgba(129,140,248,0.35);">
          <div>
            <span class="card-badge" style="background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.3); color: #a5b4fc;">Complete · Men</span>
          </div>
          <div class="card-title" style="color: #818cf8;">Olympus+</div>
          <div class="card-formula">Bremelanotide 1mg + Oxytocin 20IU + Tadalafil 5mg<br/>Sublingual Flex-Dose Tablet</div>
          <ul class="card-bullets">
            <li>Everything in Olympus, plus:</li>
            <li>Tadalafil 5mg (Cialis active ingredient)</li>
            <li>Enhanced vascular performance</li>
            <li>Dual mechanism: brain + blood flow</li>
          </ul>
          <div>
            <div class="card-price">$130</div>
            <div class="card-price-note">12 tablets · 1 month supply · 3 refills</div>
          </div>
          <a href="https://shop.theurbanmonk.com/cart/48596830748826:1" class="card-cta" style="background: #4f46e5;" target="_blank" rel="noopener">
            Get Olympus+ &rarr;
          </a>
          <a href="https://shop.theurbanmonk.com/products/olympus-2" class="card-cta-outline" style="border-color: rgba(129,140,248,0.3);" target="_blank" rel="noopener">
            View Product Page
          </a>
        </div>

      </div>
    </div>

    <!-- Women's Cards -->
    <div id="cards-women" class="gender-section visible" style="margin-top: 48px;">
      <p class="eyebrow" style="text-align:center; margin-bottom:24px; color: var(--accent-pink);">For Women</p>
      <div class="cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">

        <!-- Olympus Her -->
        <div class="product-card" style="border-color: rgba(244,114,182,0.25);">
          <div>
            <span class="card-badge" style="background: rgba(244,114,182,0.15); border: 1px solid rgba(244,114,182,0.3); color: #f9a8d4;">Entry · Women</span>
          </div>
          <div class="card-title" style="color: #f472b6;">Olympus Her</div>
          <div class="card-formula">Bremelanotide 1mg + Oxytocin 20IU<br/>Sublingual Flex-Dose Tablet</div>
          <ul class="card-bullets">
            <li>FDA-approved for female HSDD</li>
            <li>Genuine, spontaneous desire</li>
            <li>Emotional bonding via Oxytocin</li>
            <li>Hormone-independent mechanism</li>
          </ul>
          <div>
            <div class="card-price">$120</div>
            <div class="card-price-note">12 tablets · 1 month supply · 3 refills</div>
          </div>
          <a href="https://shop.theurbanmonk.com/cart/48596830355610:1" class="card-cta" style="background: #db2777;" target="_blank" rel="noopener">
            Get Olympus Her &rarr;
          </a>
          <a href="https://shop.theurbanmonk.com/products/olympus-her" class="card-cta-outline" style="border-color: rgba(244,114,182,0.3);" target="_blank" rel="noopener">
            View Product Page
          </a>
        </div>

        <!-- Olympus Her+ -->
        <div class="product-card" style="border-color: rgba(192,132,252,0.25);">
          <div>
            <span class="card-badge" style="background: rgba(192,132,252,0.15); border: 1px solid rgba(192,132,252,0.3); color: #d8b4fe;">Complete · Women</span>
          </div>
          <div class="card-title" style="color: #c084fc;">Olympus Her+</div>
          <div class="card-formula">Bremelanotide 1mg + Oxytocin 20IU + Tadalafil 5mg<br/>Sublingual Flex-Dose Tablet</div>
          <ul class="card-bullets">
            <li>Everything in Olympus Her, plus:</li>
            <li>Tadalafil 5mg (female-validated dose)</li>
            <li>Enhanced genital blood flow</li>
            <li>Improved lubrication &amp; sensitivity</li>
          </ul>
          <div>
            <div class="card-price">$125</div>
            <div class="card-price-note">12 tablets · 1 month supply · 3 refills</div>
          </div>
          <a href="https://shop.theurbanmonk.com/cart/48596830421146:1" class="card-cta" style="background: #7c3aed;" target="_blank" rel="noopener">
            Get Olympus Her+ &rarr;
          </a>
          <a href="https://shop.theurbanmonk.com/products/olympus-her-1" class="card-cta-outline" style="border-color: rgba(192,132,252,0.3);" target="_blank" rel="noopener">
            View Product Page
          </a>
        </div>

        <!-- Olympus Her Max -->
        <div class="product-card" style="border-color: rgba(251,146,60,0.35);">
          <div>
            <span class="card-badge" style="background: rgba(251,146,60,0.15); border: 1px solid rgba(251,146,60,0.3); color: #fdba74;">Max Dose · Women</span>
          </div>
          <div class="card-title" style="color: #fb923c;">Olympus Her Max</div>
          <div class="card-formula">Bremelanotide 2mg + Oxytocin 40IU + Tadalafil 5mg<br/>Sublingual Flex-Dose Tablet</div>
          <ul class="card-bullets">
            <li>Double-dose Bremelanotide &amp; Oxytocin</li>
            <li>For established patients only</li>
            <li>Flex-dose: titrate from 1/4 to full tablet</li>
            <li>Maximum neurological desire activation</li>
          </ul>
          <div>
            <div class="card-price">$185</div>
            <div class="card-price-note">12 tablets · 1 month supply · 3 refills</div>
          </div>
          <a href="https://shop.theurbanmonk.com/cart/48596830519450:1" class="card-cta" style="background: #c2410c;" target="_blank" rel="noopener">
            Get Olympus Her Max &rarr;
          </a>
          <a href="https://shop.theurbanmonk.com/products/olympus-her-max" class="card-cta-outline" style="border-color: rgba(251,146,60,0.3);" target="_blank" rel="noopener">
            View Product Page
          </a>
        </div>

      </div>
    </div>
  </div>
</section>

<!-- Chart Section -->
<div class="section-alt">
  <div class="section">
    <div class="section-inner">
      <p class="section-title">Formula Comparison at a Glance</p>
      <p class="section-sub">Each formula targets a different combination of mechanisms. See how they compare.</p>

      <div class="chart-wrap">
        <div class="chart-title">Active Ingredients by Formula</div>
        <div class="chart-sub">Relative dose strength across all 5 Olympus formulas (normalized to max dose)</div>
        <div class="chart-container">
          <canvas id="olympusChart"></canvas>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Comparison Table -->
<section style="background: var(--bg-darkest); padding: 64px 24px;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <p class="section-title" style="margin-bottom: 12px;">Side-by-Side Comparison</p>
    <p class="section-sub">Every feature, every formula.</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th><span class="product-name-cell"><span class="color-dot" style="background:#60a5fa;"></span>Olympus</span></th>
            <th><span class="product-name-cell"><span class="color-dot" style="background:#818cf8;"></span>Olympus+</span></th>
            <th><span class="product-name-cell"><span class="color-dot" style="background:#f472b6;"></span>Her</span></th>
            <th><span class="product-name-cell"><span class="color-dot" style="background:#c084fc;"></span>Her+</span></th>
            <th><span class="product-name-cell"><span class="color-dot" style="background:#fb923c;"></span>Her Max</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Target Gender</td>
            <td>Men</td><td>Men</td><td>Women</td><td>Women</td><td>Women</td>
          </tr>
          <tr>
            <td>Price</td>
            <td>$120</td><td>$130</td><td>$120</td><td>$125</td><td>$185</td>
          </tr>
          <tr>
            <td>Bremelanotide (PT-141)</td>
            <td>1mg</td><td>1mg</td><td>1mg</td><td>1mg</td><td>2mg</td>
          </tr>
          <tr>
            <td>Oxytocin</td>
            <td>20IU</td><td>20IU</td><td>20IU</td><td>20IU</td><td>40IU</td>
          </tr>
          <tr>
            <td>Tadalafil (Vascular)</td>
            <td class="dash">—</td><td>5mg</td><td class="dash">—</td><td>5mg</td><td>5mg</td>
          </tr>
          <tr>
            <td>Neurological Desire</td>
            <td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td>
          </tr>
          <tr>
            <td>Emotional Bonding (Oxytocin)</td>
            <td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td>
          </tr>
          <tr>
            <td>Vascular Performance</td>
            <td class="dash">—</td><td class="check">✓</td><td class="dash">—</td><td class="check">✓</td><td class="check">✓</td>
          </tr>
          <tr>
            <td>FDA-Approved Mechanism</td>
            <td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td>
          </tr>
          <tr>
            <td>Flex-Dose Format</td>
            <td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td>
          </tr>
          <tr>
            <td>Established Patients Only</td>
            <td class="dash">—</td><td class="dash">—</td><td class="dash">—</td><td class="dash">—</td><td class="check">✓</td>
          </tr>
          <tr>
            <td>Qty / Supply</td>
            <td colspan="5" style="text-align:center;">12 tablets · 1 month · 3 refills available</td>
          </tr>
          <tr>
            <td>Dispensed by</td>
            <td colspan="5" style="text-align:center;">Strive Pharmacy (prescription compounded)</td>
          </tr>
          <tr>
            <td>&nbsp;</td>
            <td class="table-cta-cell"><a href="https://shop.theurbanmonk.com/cart/48596830650522:1" class="table-cta" style="background:#2563eb;" target="_blank" rel="noopener">Get →</a></td>
            <td class="table-cta-cell"><a href="https://shop.theurbanmonk.com/cart/48596830748826:1" class="table-cta" style="background:#4f46e5;" target="_blank" rel="noopener">Get →</a></td>
            <td class="table-cta-cell"><a href="https://shop.theurbanmonk.com/cart/48596830355610:1" class="table-cta" style="background:#db2777;" target="_blank" rel="noopener">Get →</a></td>
            <td class="table-cta-cell"><a href="https://shop.theurbanmonk.com/cart/48596830421146:1" class="table-cta" style="background:#7c3aed;" target="_blank" rel="noopener">Get →</a></td>
            <td class="table-cta-cell"><a href="https://shop.theurbanmonk.com/cart/48596830519450:1" class="table-cta" style="background:#c2410c;" target="_blank" rel="noopener">Get →</a></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- FAQ -->
<div class="section-alt">
  <div class="section">
    <div class="section-inner">
      <p class="section-title">Common Questions</p>
      <p class="section-sub">Everything you need to know before choosing your formula.</p>
      <div class="faq-list">
        <div class="faq-item">
          <div class="faq-q">How do I know which formula is right for me?</div>
          <div class="faq-a">If you're new to Bremelanotide, start with Olympus (men) or Olympus Her (women) — the base formulas let you establish tolerance and gauge your response. If you already know you want vascular support alongside neurological desire activation, go directly to Olympus+ or Olympus Her+. Olympus Her Max is for women who have used Olympus Her or Her+ and found the standard dose insufficient.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">Is a prescription required?</div>
          <div class="faq-a">Yes. All Olympus formulas are prescription compounded medications dispensed by Strive Pharmacy. Your intake form is completed at checkout, and a licensed prescriber reviews and approves your order before dispensing. The prescription is included in the price.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">How does Bremelanotide (PT-141) work differently from Viagra or Cialis?</div>
          <div class="faq-a">Viagra and Cialis work on blood flow — they're vascular medications. Bremelanotide works upstream, in the brain. It activates melanocortin receptors in the hypothalamus to generate genuine, spontaneous desire. This means it works even when the issue is low libido rather than erectile or arousal dysfunction. Olympus+ and Olympus Her+ combine both mechanisms for a complete response.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">What is the flex-dose format?</div>
          <div class="faq-a">Each tablet is scored so it can be split into 1/4, 1/2, or full doses. This allows you to titrate your dose based on your response. Most patients start at 1/4 or 1/2 tablet and adjust from there. Olympus Her Max patients in particular benefit from this format since the full tablet delivers a double dose.</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">How long does shipping take?</div>
          <div class="faq-a">After your intake form is reviewed and approved (typically within 24–48 hours), Strive Pharmacy ships your formula directly to your door. Most patients receive their order within 3–5 business days.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Disclaimer -->
<section style="padding: 48px 24px 0;">
  <div class="disclaimer">
    <p><strong>Medical Disclaimer:</strong> All Olympus formulas are prescription compounded medications. They are not FDA-approved finished drug products. Bremelanotide (PT-141) is the active ingredient in Vyleesi, which is FDA-approved for HSDD in premenopausal women. These formulas are not intended to diagnose, treat, cure, or prevent any disease. Results vary. Consult your healthcare provider before use. Not for use if you have uncontrolled hypertension or cardiovascular disease. Olympus Her Max is intended for established patients with documented tolerance to standard-dose Bremelanotide.</p>
  </div>
</section>

<footer>
  <p>&copy; ${new Date().getFullYear()} The Urban Monk &nbsp;·&nbsp; <a href="https://theurbanmonk.com/privacy">Privacy</a> &nbsp;·&nbsp; <a href="https://theurbanmonk.com/terms">Terms</a> &nbsp;·&nbsp; <a href="https://shop.theurbanmonk.com">Shop</a></p>
</footer>

<script>
// Gender filter
function filterGender(gender) {
  const menCards = document.getElementById('cards-men');
  const womenCards = document.getElementById('cards-women');
  const tabs = document.querySelectorAll('.gender-tab');
  
  tabs.forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + gender).classList.add('active');
  
  if (gender === 'all') {
    menCards.classList.add('visible');
    womenCards.classList.add('visible');
  } else if (gender === 'men') {
    menCards.classList.add('visible');
    womenCards.classList.remove('visible');
  } else {
    menCards.classList.remove('visible');
    womenCards.classList.add('visible');
  }
}

// Chart.js Bar Chart
document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('olympusChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Olympus', 'Olympus+', 'Olympus Her', 'Olympus Her+', 'Olympus Her Max'],
      datasets: [
        {
          label: 'Bremelanotide (PT-141)',
          data: [50, 50, 50, 50, 100],
          backgroundColor: 'rgba(96,165,250,0.75)',
          borderColor: '#60a5fa',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Oxytocin',
          data: [50, 50, 50, 50, 100],
          backgroundColor: 'rgba(244,114,182,0.75)',
          borderColor: '#f472b6',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Tadalafil (Vascular)',
          data: [0, 100, 0, 100, 100],
          backgroundColor: 'rgba(192,132,252,0.75)',
          borderColor: '#c084fc',
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { size: 13, family: 'Inter' },
            padding: 20,
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const labels = {
                'Bremelanotide (PT-141)': { 50: '1mg', 100: '2mg' },
                'Oxytocin': { 50: '20IU', 100: '40IU' },
                'Tadalafil (Vascular)': { 0: 'Not included', 100: '5mg' }
              };
              const map = labels[ctx.dataset.label];
              return ctx.dataset.label + ': ' + (map ? map[ctx.raw] || ctx.raw : ctx.raw);
            }
          },
          backgroundColor: '#172038',
          titleColor: '#f0f4ff',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 12, family: 'Inter' } },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          max: 120,
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: 'Inter' },
            callback: function(val) {
              if (val === 0) return 'None';
              if (val === 50) return 'Standard';
              if (val === 100) return 'Max';
              return '';
            }
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        }
      }
    }
  });
});
</script>
</body>
</html>`;
}
