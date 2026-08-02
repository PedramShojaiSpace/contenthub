const CDN = "https://content.theurbanmonk.com/manus-storage/";

export function renderInterconnectedBPage(): string {
  const experts = [
    { name: "Mark Hyman, MD", img: "mark-hyman-md_59f25bf6.jpg" },
    { name: "Dave Asprey", img: "dave-aspey_cb9def9f.jpg" },
    { name: "Zach Bush, MD", img: "zach-bush-md_50a4b43c.jpg" },
    { name: "Alessio Fassano, MD", img: "alessio-fassano-md_6d7caa9a.jpg" },
    { name: "Max Lugavere", img: "max-lugavere_78f23e75.jpg" },
    { name: "JJ Virgin", img: "jj-virgin_4bc75cbd.jpg" },
    { name: "Emeran Mayer, MD", img: "emaren-mayer-md_edf069aa.jpg" },
    { name: "Izabella Wentz, PharmD", img: "izabella-wentz-pharm-d_88697c7e.jpg" },
  ];

  const expertGrid = experts.map(e => `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid rgba(46,145,252,0.4);background:#161E2A;margin-bottom:6px;">
        <img src="${CDN}${e.img}" alt="${e.name}" loading="lazy" decoding="async"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none'">
      </div>
      <p style="font-size:10px;color:#9ca3af;text-align:center;line-height:1.3;">${e.name.split(",")[0]}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>INTERCONNECTED — Free Documentary Series | The Urban Monk</title>
<meta name="description" content="70 world-renowned doctors reveal the hidden root of chronic disease. Free 9-part documentary series. Limited time access.">
<link rel="icon" href="/favicon.ico">

<!-- Preconnect for critical CDN -->
<link rel="preconnect" href="https://content.theurbanmonk.com" crossorigin>
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
<link rel="dns-prefetch" href="https://connect.facebook.net">

<!-- Preload LCP image -->
<link rel="preload" as="image" href="${CDN}urban-monk-logo-white_bea7991f.png" fetchpriority="high">

<!-- Google Fonts — minimal subset, font-display:optional prevents CLS -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=optional" rel="stylesheet">

<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:#0a1520;color:#fff;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
input,button{font-family:inherit}

/* Sticky urgency bar */
.urgency-bar{
  position:sticky;top:0;z-index:50;
  background:#161E2A;
  border-bottom:1px solid rgba(46,145,252,0.3);
  text-align:center;padding:8px 16px;
  font-size:14px;font-weight:700;
}
.urgency-bar .timer{font-family:monospace;font-weight:900;color:#2E91FC;font-size:16px;}
.urgency-bar a{color:#7ecfdf;text-decoration:underline;cursor:pointer;background:none;border:none;font-size:14px;font-weight:700;}

/* Hero */
.hero{
  position:relative;padding:64px 16px;
  background:linear-gradient(180deg,#020d18 0%,#051e2e 60%,#020d18 100%);
}
.hero-bg{
  position:absolute;inset:0;
  background-image:url(${CDN}interconnected-poster_e31ef3aa.jpg);
  background-size:cover;background-position:center;
  opacity:0.15;
}
.hero-overlay{position:absolute;inset:0;background:rgba(2,13,24,0.85);}
.hero-inner{position:relative;z-index:1;max-width:640px;margin:0 auto;text-align:center;}
.hero-logo{width:128px;margin:0 auto 32px;}
.badge{
  display:inline-block;font-size:11px;font-weight:900;text-transform:uppercase;
  letter-spacing:0.1em;padding:6px 16px;border-radius:9999px;margin-bottom:16px;
  background:rgba(46,145,252,0.15);border:1px solid rgba(46,145,252,0.3);color:#2E91FC;
}
.hero h1{
  font-size:clamp(2.5rem,7vw,4rem);font-weight:900;text-transform:uppercase;
  letter-spacing:-0.02em;line-height:1;margin-bottom:12px;
}
.hero-sub{font-size:20px;font-style:italic;color:#7ecfdf;margin-bottom:24px;}
.hero-box{
  background:rgba(46,145,252,0.1);border:1px solid rgba(46,145,252,0.3);
  border-radius:8px;padding:16px;margin-bottom:24px;max-width:480px;margin-left:auto;margin-right:auto;
}
.hero-box p{font-weight:900;font-size:18px;text-transform:uppercase;color:#f0f4f8;}
.hero-box span{color:#2E91FC;}
.hero-desc{color:#d1d5db;font-size:18px;line-height:1.6;margin-bottom:24px;max-width:480px;margin-left:auto;margin-right:auto;}
.hero-stats{font-size:14px;color:#7ecfdf;margin-bottom:32px;}
.hero-stats strong{color:#fff;}

/* Form card */
.form-card{
  background:rgba(5,20,35,0.95);border:1px solid rgba(46,145,252,0.35);
  border-radius:12px;padding:24px;text-align:left;
}
.form-label{
  text-align:center;font-weight:900;font-size:12px;text-transform:uppercase;
  letter-spacing:0.1em;color:#2E91FC;margin-bottom:16px;
}
.form-card input[type=text],
.form-card input[type=email],
.form-card input[type=tel]{
  width:100%;padding:12px 16px;
  background:#fff;color:#111;border:0;border-radius:6px;
  font-size:16px;margin-bottom:12px;
  outline:none;
}
.form-card input:focus{box-shadow:0 0 0 2px #22d3ee;}
.sms-label{
  display:flex;align-items:flex-start;gap:12px;
  background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
  border-radius:6px;padding:12px;cursor:pointer;margin-bottom:12px;
}
.checkbox-box{
  width:20px;height:20px;border-radius:4px;border:2px solid #9ca3af;
  background:#fff;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;margin-top:2px;transition:background 0.15s,border-color 0.15s;
}
.checkbox-box.checked{background:#0891b2;border-color:#0891b2;}
.sms-text{font-size:11px;color:#d1d5db;line-height:1.5;}
.sms-text a{color:#67e8f9;text-decoration:underline;}
.error-msg{color:#fca5a5;font-size:13px;text-align:center;margin-bottom:8px;display:none;}
.submit-btn{
  width:100%;padding:16px 24px;
  background:#018db1;color:#fff;
  font-weight:900;font-size:15px;text-transform:uppercase;
  letter-spacing:0.06em;border:0;border-radius:6px;cursor:pointer;
  transition:opacity 0.15s;
}
.submit-btn:disabled{opacity:0.6;cursor:not-allowed;}
.submit-btn:hover:not(:disabled){opacity:0.9;}
.form-note{font-size:11px;color:#6b7280;text-align:center;margin-top:8px;}

/* Quote section */
.quote-section{padding:48px 16px;background:#161E2A;}
.quote-inner{max-width:768px;margin:0 auto;display:flex;flex-direction:column;gap:24px;align-items:center;}
@media(min-width:640px){.quote-inner{flex-direction:row;}}
.quote-photo{
  width:100px;height:100px;border-radius:50%;overflow:hidden;flex-shrink:0;
  border:3px solid rgba(46,145,252,0.5);
}
.quote-photo img{width:100%;height:100%;object-fit:cover;}
.quote-mark{font-size:30px;color:#2E91FC;line-height:1;margin-bottom:4px;}
blockquote{font-size:18px;color:#e5e7eb;font-style:italic;line-height:1.6;margin-bottom:8px;}
.quote-name{font-weight:900;color:#2E91FC;}
.quote-title{font-size:13px;color:#6b7280;}

/* Experts grid */
.experts-section{padding:48px 16px;background:#0a1520;}
.experts-inner{max-width:768px;margin:0 auto;text-align:center;}
.experts-inner h2{font-size:24px;font-weight:900;text-transform:uppercase;color:#f0f4f8;margin-bottom:8px;}
.experts-sub{font-size:13px;color:#7ecfdf;margin-bottom:32px;}
.experts-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;justify-items:center;}
@media(min-width:640px){.experts-grid{grid-template-columns:repeat(8,1fr);}}
.experts-more{font-size:11px;color:#7ecfdf;margin-top:24px;}

/* Discover section */
.discover-section{padding:48px 16px;background:#0d1e2e;}
.discover-inner{max-width:640px;margin:0 auto;}
.discover-inner h2{font-size:24px;font-weight:900;text-transform:uppercase;text-align:center;color:#f0f4f8;margin-bottom:24px;}
.discover-list{list-style:none;}
.discover-list li{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;}
.check-icon{
  width:20px;height:20px;border-radius:50%;flex-shrink:0;margin-top:2px;
  display:flex;align-items:center;justify-content:center;
  background:rgba(46,145,252,0.2);border:1px solid rgba(46,145,252,0.4);
  color:#2E91FC;font-size:11px;font-weight:700;
}
.discover-list span{color:#d1d5db;font-size:16px;}

/* Bottom CTA */
.bottom-cta{padding:56px 16px;background:#161E2A;}
.bottom-cta-inner{max-width:480px;margin:0 auto;text-align:center;}
.bottom-cta h2{font-size:24px;font-weight:900;text-transform:uppercase;color:#f0f4f8;margin-bottom:8px;}
.bottom-cta-sub{color:#7ecfdf;margin-bottom:8px;}
.bottom-timer{font-family:monospace;font-weight:900;font-size:36px;color:#fff;margin-bottom:24px;}

/* Host */
.host-section{padding:40px 16px;background:#0a1520;}
.host-inner{max-width:480px;margin:0 auto;text-align:center;}
.host-label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#2E91FC;margin-bottom:12px;}
.host-name{font-weight:900;font-size:20px;margin-bottom:4px;}
.host-title{font-size:13px;color:#7ecfdf;}

/* Footer */
footer{padding:32px 16px;background:#020d18;border-top:1px solid rgba(46,145,252,0.1);text-align:center;}
.footer-logo{width:96px;margin:0 auto 16px;opacity:0.4;}
.footer-legal{font-size:11px;color:#374151;max-width:480px;margin:0 auto 8px;line-height:1.5;}
.footer-copy{font-size:11px;color:#374151;}
.footer-links{display:flex;justify-content:center;gap:16px;margin-top:12px;}
.footer-links a{font-size:11px;color:#374151;}
.footer-links a:hover{color:#9ca3af;}
</style>
</head>
<body>

<!-- Urgency Bar -->
<div class="urgency-bar">
  Free viewing period closes in:&nbsp;
  <span class="timer" id="timer">47:00:00</span>
  &nbsp;—&nbsp;
  <a onclick="document.getElementById('form-top').scrollIntoView({behavior:'smooth',block:'center'})">Claim your free access now</a>
</div>

<!-- Hero -->
<section class="hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="hero-overlay" aria-hidden="true"></div>
  <div class="hero-inner">
    <img src="${CDN}urban-monk-logo-white_bea7991f.png" alt="The Urban Monk" class="hero-logo" fetchpriority="high" decoding="async">

    <p class="badge">Free Documentary Series — Limited Access</p>

    <h1>INTERCONNECTED</h1>
    <p class="hero-sub">The Power to Heal From Within</p>

    <div class="hero-box">
      <p>The Source of 90% of All Chronic Disease:<span> Discovered</span></p>
    </div>

    <p class="hero-desc">
      70 of the world's leading doctors, researchers, and scientists reveal the hidden root
      of chronic disease — and the breakthrough science that can heal it.
    </p>

    <p class="hero-stats">
      Watched by <strong>2.4 million people</strong> worldwide &nbsp;·&nbsp; 9 episodes &nbsp;·&nbsp; Free for a limited time
    </p>

    <!-- Form Card -->
    <div class="form-card" id="form-top">
      <p class="form-label">Register NOW for a limited-time FREE viewing of this groundbreaking 9-part documentary series.</p>
      <form id="optin-form" onsubmit="handleSubmit(event)">
        <input type="text" id="field-name" placeholder="First Name" required autocomplete="given-name">
        <input type="email" id="field-email" placeholder="Email Address" required autocomplete="email">
        <input type="tel" id="field-phone" placeholder="Mobile Phone (optional — episode reminders)" autocomplete="tel">
        <label class="sms-label" onclick="toggleSms()">
          <div class="checkbox-box" id="sms-box"></div>
          <span class="sms-text">
            By checking this box you agree to receive recurring, automated marketing text messages from The Urban Monk and select third-party partners, at the phone number you provide, even if it is on a Do Not Call list. Consent is not required to purchase. Msg frequency varies. Msg&amp;Data rates may apply. Reply HELP for support or STOP to cancel.
            <a href="https://theurbanmonk.com/sms-terms" target="_blank" rel="noopener noreferrer">SMS Terms</a> |
            <a href="https://theurbanmonk.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </span>
        </label>
        <p class="error-msg" id="error-msg"></p>
        <button type="submit" class="submit-btn" id="submit-btn">REGISTER NOW — FREE ACCESS</button>
        <p class="form-note">100% free. No credit card required.</p>
      </form>
    </div>
  </div>
</section>

<!-- Mark Hyman Quote -->
<section class="quote-section" style="contain:content;">
  <div class="quote-inner">
    <div class="quote-photo">
      <img src="${CDN}mark-hyman-md_59f25bf6.jpg" alt="Mark Hyman, MD" loading="lazy" decoding="async">
    </div>
    <div>
      <p class="quote-mark">&ldquo;</p>
      <blockquote>The microbiome is the next frontier in medicine. Understanding it and optimizing it is going to be critical to solving so many of our healthcare issues.</blockquote>
      <p class="quote-name">Mark Hyman, MD</p>
      <p class="quote-title">Cleveland Clinic Center for Functional Medicine</p>
    </div>
  </div>
</section>

<!-- Expert Headshots -->
<section class="experts-section" style="contain:content;">
  <div class="experts-inner">
    <h2>70 World-Renowned Experts</h2>
    <p class="experts-sub">Including the world's top doctors, researchers, and health pioneers</p>
    <div class="experts-grid">${expertGrid}</div>
    <p class="experts-more">+ 62 more world-class doctors, researchers, and health experts</p>
  </div>
</section>

<!-- What You'll Discover -->
<section class="discover-section" style="contain:content;">
  <div class="discover-inner">
    <h2>What You'll Discover</h2>
    <ul class="discover-list">
      ${[
        "Why obesity, diabetes, autoimmune disease, and cancer all start in the gut",
        "The gut-brain connection your doctor never told you about",
        "Why 80% of your immune system lives in your gut — and how to protect it",
        "The inflammation loop driving fatigue, brain fog, and chronic pain",
        "Ancient healing wisdom now validated by cutting-edge science",
        "Practical protocols you can start today — no prescriptions needed",
      ].map(item => `<li><span class="check-icon">✓</span><span>${item}</span></li>`).join("")}
    </ul>
  </div>
</section>

<!-- Bottom CTA -->
<section class="bottom-cta" style="contain:content;">
  <div class="bottom-cta-inner">
    <h2>Don't Miss the Free Viewing Period</h2>
    <p class="bottom-cta-sub">Access closes in:</p>
    <p class="bottom-timer" id="timer-bottom">47:00:00</p>
    <div class="form-card">
      <form id="optin-form-bottom" onsubmit="handleSubmit(event,'bottom')">
        <input type="text" id="field-name-bottom" placeholder="First Name" required autocomplete="given-name">
        <input type="email" id="field-email-bottom" placeholder="Email Address" required autocomplete="email">
        <input type="tel" id="field-phone-bottom" placeholder="Mobile Phone (optional)" autocomplete="tel">
        <label class="sms-label" onclick="toggleSms('bottom')">
          <div class="checkbox-box" id="sms-box-bottom"></div>
          <span class="sms-text">
            By checking this box you agree to receive recurring, automated marketing text messages from The Urban Monk and select third-party partners, at the phone number you provide, even if it is on a Do Not Call list. Consent is not required to purchase. Msg frequency varies. Msg&amp;Data rates may apply. Reply HELP for support or STOP to cancel.
            <a href="https://theurbanmonk.com/sms-terms" target="_blank" rel="noopener noreferrer">SMS Terms</a> |
            <a href="https://theurbanmonk.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </span>
        </label>
        <p class="error-msg" id="error-msg-bottom"></p>
        <button type="submit" class="submit-btn" id="submit-btn-bottom">REGISTER NOW — FREE ACCESS</button>
        <p class="form-note">100% free. No credit card required.</p>
      </form>
    </div>
  </div>
</section>

<!-- Host -->
<section class="host-section" style="contain:content;">
  <div class="host-inner">
    <p class="host-label">Hosted by</p>
    <p class="host-name">Dr. Pedram Shojai, OMD</p>
    <p class="host-title">Doctor of Oriental Medicine &nbsp;·&nbsp; Former Taoist Monk &nbsp;·&nbsp; NYT Bestselling Author</p>
  </div>
</section>

<!-- Footer -->
<footer>
  <img src="${CDN}urban-monk-logo-white_bea7991f.png" alt="The Urban Monk" class="footer-logo" loading="lazy">
  <p class="footer-legal">THE INFORMATION ON THIS SITE IS FOR EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS MEDICAL ADVICE.</p>
  <p class="footer-copy">Brought to you by The Urban Monk Productions &copy; ${new Date().getFullYear()} All Rights Reserved.</p>
  <div class="footer-links">
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </div>
</footer>

<script>
// ── Countdown Timer ──────────────────────────────────────────────────────────
(function() {
  var KEY = 'ic_b_end';
  var HOURS = 47;
  var end = parseInt(sessionStorage.getItem(KEY) || '0', 10);
  if (!end || end < Date.now()) {
    end = Date.now() + HOURS * 3600000;
    sessionStorage.setItem(KEY, end);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var diff = Math.max(0, end - Date.now());
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var str = pad(h) + ':' + pad(m) + ':' + pad(s);
    var t1 = document.getElementById('timer');
    var t2 = document.getElementById('timer-bottom');
    if (t1) t1.textContent = str;
    if (t2) t2.textContent = str;
  }
  tick();
  setInterval(tick, 1000);
})();

// ── SMS Checkbox ─────────────────────────────────────────────────────────────
var smsChecked = false;
var smsCheckedBottom = false;
function toggleSms(which) {
  if (which === 'bottom') {
    smsCheckedBottom = !smsCheckedBottom;
    var box = document.getElementById('sms-box-bottom');
    if (box) {
      box.classList.toggle('checked', smsCheckedBottom);
      box.innerHTML = smsCheckedBottom
        ? '<svg width="12" height="12" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
    }
  } else {
    smsChecked = !smsChecked;
    var box = document.getElementById('sms-box');
    if (box) {
      box.classList.toggle('checked', smsChecked);
      box.innerHTML = smsChecked
        ? '<svg width="12" height="12" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
    }
  }
}

// ── Form Submission ───────────────────────────────────────────────────────────
function handleSubmit(e, which) {
  e.preventDefault();
  var suffix = which === 'bottom' ? '-bottom' : '';
  var nameEl = document.getElementById('field-name' + suffix);
  var emailEl = document.getElementById('field-email' + suffix);
  var phoneEl = document.getElementById('field-phone' + suffix);
  var errEl = document.getElementById('error-msg' + suffix);
  var btnEl = document.getElementById('submit-btn' + suffix);
  var consent = which === 'bottom' ? smsCheckedBottom : smsChecked;

  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  var phone = phoneEl ? phoneEl.value.trim() : '';

  if (!name || !email) {
    if (errEl) { errEl.textContent = 'Please enter your name and email.'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Registering...'; }

  // Capture UTM params
  var params = new URLSearchParams(window.location.search);
  var utm = {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
    referrer: document.referrer || ''
  };

  fetch('/api/trpc/interconnected.register?batch=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ "0": { json: { name: name, email: email, phone: phone || undefined, smsConsent: consent, ...utm } } })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var result = Array.isArray(data) ? data[0] : data;
    if (result && result.result && result.result.data && result.result.data.json && result.result.data.json.success) {
      window.location.href = '/interconnected/thank-you';
    } else {
      var msg = (result && result.error && result.error.message) ? result.error.message : 'Something went wrong. Please try again.';
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'REGISTER NOW — FREE ACCESS'; }
    }
  })
  .catch(function() {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'REGISTER NOW — FREE ACCESS'; }
  });
}
</script>

<!-- Meta Pixel — deferred 3s after load -->
<script>
window.addEventListener('load', function() {
  setTimeout(function() {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1234567890');
    fbq('track', 'PageView');
  }, 3000);
});
</script>

</body>
</html>`;
}
