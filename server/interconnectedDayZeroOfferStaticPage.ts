/**
 * Interconnected Day 0 Offer Page
 *
 * A compact, static email landing page that provides context before the $67
 * Shopify checkout. It intentionally avoids the high-pressure thank-you-page
 * framing while preserving the user's one-time Day 0 invitation.
 */

const SHOPIFY_67_CART_PERMALINK = "https://shop.theurbanmonk.com/cart/48959577653402:1";

function buildTrackedCheckoutUrl(): string {
  const params = new URLSearchParams({
    destination: SHOPIFY_67_CART_PERMALINK,
    utm_source: "klaviyo",
    utm_medium: "email",
    utm_campaign: "interconnected_14day",
    utm_content: "day0_67_offer_page",
  });
  return `/r/checkout?${params.toString()}`;
}

export function renderInterconnectedDayZeroOfferPage(): string {
  const checkoutUrl = buildTrackedCheckoutUrl();
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Interconnected All-Access Bundle | The Urban Monk</title>
  <link rel="icon" type="image/x-icon" href="/manus-storage/urban-monk-favicon_27ae5d07.ico" />
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','1498608757116877');
    fbq('track','PageView');
    function fireCheckout(){
      try {
        var eventId = 'ic_day0_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        fbq('track','InitiateCheckout',{value:67,currency:'USD',content_name:'Interconnected All-Access Bundle'},{eventID:eventId});
      } catch(e) {}
    }
  </script>
  <style>
    :root{--ink:#102a32;--forest:#173f47;--sage:#52766e;--paper:#f6f2e8;--cream:#fffdf8;--line:#d9d1c1;--gold:#c4933b;--muted:#5f6c6a}
    *{box-sizing:border-box}
    html{background:var(--paper)}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
    .top{background:var(--forest);padding:24px 20px 22px;text-align:center}
    .top img{display:block;width:150px;height:auto;margin:0 auto}
    main{max-width:760px;margin:0 auto;padding:44px 20px 56px}
    .eyebrow{margin:0 0 16px;color:var(--sage);font-size:12px;font-weight:700;letter-spacing:.12em;text-align:center;text-transform:uppercase}
    h1{max-width:650px;margin:0 auto 18px;color:var(--forest);font-family:Georgia,'Times New Roman',serif;font-size:clamp(34px,6vw,52px);line-height:1.08;text-align:center}
    .lead{max-width:620px;margin:0 auto 30px;color:#30494b;font-size:19px;text-align:center}
    .note{max-width:620px;margin:0 auto 34px;padding:14px 16px;border-left:3px solid var(--gold);background:#fffaf0;color:#4a4d46;font-size:15px}
    .bundle{margin:0 auto 28px;border:1px solid var(--line);background:var(--cream)}
    .bundle-header{padding:20px 24px;background:#edf2ec;border-bottom:1px solid var(--line)}
    .bundle-header p{margin:0 0 4px;color:var(--sage);font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    .bundle-header h2{margin:0;color:var(--forest);font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2}
    .bundle-body{padding:24px}
    .bundle-body>p{margin:0 0 18px;font-size:17px}
    ul{display:grid;gap:13px;margin:0;padding:0;list-style:none}
    li{display:flex;gap:11px;align-items:flex-start;color:#263e40}
    li::before{content:'✓';display:grid;flex:0 0 21px;place-items:center;width:21px;height:21px;margin-top:2px;border-radius:50%;background:var(--sage);color:#fff;font-size:13px;font-weight:700}
    .price{padding:24px 24px 26px;border-top:1px solid var(--line);text-align:center}
    .price-label{margin:0 0 4px;color:var(--sage);font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .price-row{display:flex;justify-content:center;align-items:baseline;gap:10px;margin:0 0 8px}
    .was{color:#75817e;font-size:18px;text-decoration:line-through}
    .now{color:var(--forest);font-family:Georgia,'Times New Roman',serif;font-size:52px;font-weight:700;line-height:1}
    .price-note{margin:0;color:var(--muted);font-size:14px}
    .cta{display:block;max-width:460px;margin:24px auto 12px;padding:17px 22px;border-radius:3px;background:var(--forest);color:#fff;font-size:17px;font-weight:700;text-align:center;text-decoration:none}
    .cta:focus,.cta:hover{background:#0f3036;text-decoration:none}
    .cta-note{margin:0;color:var(--muted);font-size:13px;text-align:center}
    .support{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:38px 0}
    .support section{padding:0 2px}
    .support h2{margin:0 0 8px;color:var(--forest);font-family:Georgia,'Times New Roman',serif;font-size:21px}
    .support p{margin:0;color:#496063;font-size:15px}
    details{border-top:1px solid var(--line);padding:16px 0}
    details:last-of-type{border-bottom:1px solid var(--line)}
    summary{color:var(--forest);cursor:pointer;font-weight:700}
    details p{margin:10px 0 0;color:#4b6060;font-size:15px}
    footer{max-width:760px;margin:0 auto;padding:0 20px 34px;color:#667573;font-size:12px;text-align:center}
    @media(max-width:560px){main{padding-top:32px}.support{grid-template-columns:1fr;gap:22px}.bundle-body,.price{padding-left:20px;padding-right:20px}}
  </style>
</head>
<body>
  <header class="top"><img src="/manus-storage/urban-monk-logo-white_bea7991f.png" alt="The Urban Monk" width="150" height="42" fetchpriority="high" /></header>
  <main>
    <p class="eyebrow">Before the series begins</p>
    <h1>Get the complete Interconnected series on your own schedule.</h1>
    <p class="lead">You are registered for the free daily event. If you would rather keep every episode, guide, and resource available whenever you need it, the Interconnected All-Access Bundle is available in this Day 0 invitation.</p>
    <p class="note">This is not required to participate in the free series. Your first episode still arrives tomorrow. This invitation is simply for people who prefer permanent, on-demand access from the start.</p>

    <section class="bundle" aria-labelledby="bundle-title">
      <div class="bundle-header"><p>The Interconnected All-Access Bundle</p><h2 id="bundle-title">Everything from the series, kept together.</h2></div>
      <div class="bundle-body">
        <p>Instead of following the daily viewing window, you will receive:</p>
        <ul>
          <li>Permanent, on-demand access to all 9 Interconnected episodes.</li>
          <li>The Interconnected Companion Guide with episode-by-episode action steps.</li>
          <li>The Gut Restoration Starter Protocol, a 30-day educational reset plan.</li>
          <li>Private Healing Community access and the “5 Root Causes” masterclass bonus.</li>
        </ul>
      </div>
      <div class="price">
        <p class="price-label">Your Day 0 all-access invitation</p>
        <p class="price-row"><span class="was">$197</span><span class="now">$67</span></p>
        <p class="price-note">One payment. No recurring charge.</p>
        <a class="cta" href="${checkoutUrl}" onclick="fireCheckout()">Get the All-Access Bundle for $67</a>
        <p class="cta-note">Secure Shopify checkout · Immediate access after purchase</p>
      </div>
    </section>

    <div class="support">
      <section><h2>What stays free</h2><p>The daily Interconnected event begins tomorrow. You will receive one episode each day through email, with access during its viewing window.</p></section>
      <section><h2>Why someone chooses all access</h2><p>It is for the person who wants to watch in any order, return to an expert’s lesson, and keep the companion resources without following a daily schedule.</p></section>
    </div>

    <section aria-label="Frequently asked questions">
      <details><summary>Do I need this to watch the free series?</summary><p>No. You are already registered. The free series will begin tomorrow as scheduled.</p></details>
      <details><summary>How will I receive the bundle?</summary><p>After purchase, you will receive instructions for immediate digital access through the Urban Monk platform.</p></details>
      <details><summary>Is this the same as the daily series?</summary><p>It includes the complete series plus the Companion Guide, Gut Restoration Starter Protocol, community access, and masterclass bonus, all available on demand.</p></details>
      <details><summary>Can I ask a question before purchasing?</summary><p>Yes. Reply to any Interconnected email and the Urban Monk team will help.</p></details>
    </section>

    <a class="cta" href="${checkoutUrl}" onclick="fireCheckout()">Yes — I want permanent access for $67</a>
    <p class="cta-note">This Day 0 invitation is optional and available through this email path.</p>
  </main>
  <footer>Interconnected is provided for educational and informational purposes only and is not medical advice. Always consult a licensed healthcare professional about personal health decisions.<br /><br />© ${year} The Urban Monk. All rights reserved.</footer>
</body>
</html>`;
}

