/**
 * Hosted Landing Pages Router
 * Serves pages at ch.theurbanmonk.com/{campaign}/{slug}
 * Campaigns: lo | gut | sleep
 * Templates: optin | vsl | sales
 */

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { hostedLandingPages } from "../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { marked } from "marked";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const campaignEnum = z.enum(["lo", "gut", "sleep", "webinar"]);
const templateEnum = z.enum(["optin", "vsl", "sales"]);

const testimonialSchema = z.object({
  // Original manual-entry fields
  name: z.string().optional().default(""),
  title: z.string().optional(),
  quote: z.string(),
  avatarUrl: z.string().optional(),
  // Extended fields when imported from DB testimonials table
  authorName: z.string().optional(),   // DB field — display name
  authorTitle: z.string().optional(),  // DB field — title/role
  dateLabel: z.string().optional(),    // e.g. "Week 6 · Lights On"
  category: z.string().optional(),     // e.g. "NEUROCEPTION"
  dbId: z.number().optional(),         // original testimonials.id for reference
});

const pageContentSchema = z.object({
  title: z.string().min(1),
  internalLabel: z.string().optional(),
  campaign: campaignEnum,
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  template: templateEnum,

  headline: z.string().optional(),
  subheadline: z.string().optional(),
  heroImageUrl: z.string().optional(),

  videoEmbedCode: z.string().optional(),
  videoThumbnailUrl: z.string().optional(),

  bodyCopy: z.string().optional(),

  optinHeadline: z.string().optional(),
  optinButtonText: z.string().optional(),
  optinLeadMagnet: z.string().optional(),
  kajabiFormUrl: z.string().optional(),
  thankYouUrl: z.string().optional(),

  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  ctaSubtext: z.string().optional(),

  testimonials: z.array(testimonialSchema).optional(),

  facebookPixelId: z.string().optional(),
  ga4MeasurementId: z.string().optional(),
  customHeadScripts: z.string().optional(),

  accentColor: z.string().optional(),
  logoUrl: z.string().optional(),

  personaId: z.number().optional(),
  ebookId: z.number().optional(),
  webinarSessionId: z.number().optional(),
});

// ── Campaign brand config ─────────────────────────────────────────────────────

const CAMPAIGN_CONFIG: Record<string, { label: string; accentColor: string; description: string }> = {
  lo: {
    label: "Lights On",
    accentColor: "#E8A020",
    description: "Energy, focus, and cellular vitality",
  },
  gut: {
    label: "Gut Health",
    accentColor: "#2D7D46",
    description: "Microbiome, digestion, and gut-brain axis",
  },
  sleep: {
    label: "Sleep & Recovery",
    accentColor: "#3B5BA5",
    description: "Deep sleep, recovery, and circadian rhythm",
  },
};

// ── HTML renderer ─────────────────────────────────────────────────────────────

const DEFAULT_GA4_ID = "G-166813991";

function renderTrackingScripts(fbPixelId: string, ga4Id?: string | null, customHead?: string | null): string {
  const resolvedGa4Id = ga4Id || DEFAULT_GA4_ID;
  const fbPixel = `
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${fbPixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;

  const ga4Script = `
<!-- Google Analytics GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${resolvedGa4Id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${resolvedGa4Id}');
</script>`;

  return fbPixel + ga4Script + (customHead || "");
}

// Helper to render a single testimonial card (shared across all templates)
function renderTestimonialCard(t: Record<string, any>): string {
  const displayName = t.authorName || t.name || "Anonymous";
  const displayTitle = t.authorTitle || t.title || "";
  const initial = displayName.charAt(0).toUpperCase();
  return `
        <div class="testimonial-card">
          ${t.category ? `<div class="testimonial-category">${t.category}</div>` : ""}
          <p class="testimonial-quote">"${t.quote}"</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar">
              ${t.avatarUrl ? `<img src="${t.avatarUrl}" alt="${displayName}">` : initial}
            </div>
            <div>
              <div class="testimonial-name">${displayName}</div>
              ${displayTitle ? `<div class="testimonial-title">${displayTitle}</div>` : ""}
              ${t.dateLabel ? `<div class="testimonial-date">${t.dateLabel}</div>` : ""}
            </div>
          </div>
        </div>`;
}

const TESTIMONIAL_CARD_CSS = `
    .testimonial-card { background: white; border-radius: 12px; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); display: flex; flex-direction: column; }
    .testimonial-category { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); background: rgba(var(--accent-rgb,232,160,32),0.1); border: 1px solid rgba(var(--accent-rgb,232,160,32),0.25); border-radius: 4px; padding: 2px 8px; margin-bottom: 12px; width: fit-content; }
    .testimonial-quote { font-size: 15px; color: #444; line-height: 1.7; margin-bottom: 20px; font-style: italic; flex: 1; }
    .testimonial-author { display: flex; align-items: center; gap: 12px; margin-top: auto; }
    .testimonial-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden; }
    .testimonial-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .testimonial-name { font-weight: 600; font-size: 14px; }
    .testimonial-title { font-size: 12px; color: #888; }
    .testimonial-date { font-size: 11px; color: #aaa; margin-top: 2px; }`;

function renderOptinTemplate(page: typeof hostedLandingPages.$inferSelect, bodyHtml: string): string {
  const brand = CAMPAIGN_CONFIG[page.campaign] || CAMPAIGN_CONFIG.lo;
  const accent = page.accentColor || brand.accentColor;
  const testimonials: Array<Record<string, any>> = page.testimonials
    ? JSON.parse(page.testimonials)
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  ${renderTrackingScripts(page.facebookPixelId || "1498608757116877", page.ga4MeasurementId, page.customHeadScripts)}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --accent: ${accent}; --dark: #1a1a1a; --light: #f9f7f4; }
    body { font-family: 'Inter', sans-serif; background: var(--light); color: var(--dark); line-height: 1.6; }
    .hero { background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 80px 24px 60px; text-align: center; }
    .hero-inner { max-width: 760px; margin: 0 auto; }
    .campaign-badge { display: inline-block; background: var(--accent); color: white; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; margin-bottom: 24px; }
    .hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 52px); line-height: 1.2; margin-bottom: 20px; }
    .hero p { font-size: clamp(16px, 2.5vw, 20px); opacity: 0.85; max-width: 600px; margin: 0 auto 32px; }
    .hero-img { width: 100%; max-width: 600px; border-radius: 12px; margin: 0 auto 32px; display: block; }
    .optin-box { background: white; border-radius: 16px; padding: 40px 32px; max-width: 520px; margin: -40px auto 0; position: relative; z-index: 10; box-shadow: 0 20px 60px rgba(0,0,0,0.12); }
    .optin-box h2 { font-family: 'Playfair Display', serif; font-size: 24px; margin-bottom: 8px; text-align: center; }
    .optin-box p { font-size: 14px; color: #666; text-align: center; margin-bottom: 24px; }
    .optin-form { display: flex; flex-direction: column; gap: 12px; }
    .optin-form input { padding: 14px 16px; border: 2px solid #e5e5e5; border-radius: 8px; font-size: 16px; font-family: inherit; transition: border-color 0.2s; }
    .optin-form input:focus { outline: none; border-color: var(--accent); }
    .optin-btn { background: var(--accent); color: white; border: none; padding: 16px; border-radius: 8px; font-size: 18px; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.1s; font-family: inherit; }
    .optin-btn:hover { opacity: 0.92; transform: translateY(-1px); }
    .optin-btn:active { transform: translateY(0); }
    .privacy-note { font-size: 12px; color: #999; text-align: center; margin-top: 12px; }
    .body-section { max-width: 760px; margin: 60px auto; padding: 0 24px; }
    .body-section h2 { font-family: 'Playfair Display', serif; font-size: 28px; margin-bottom: 16px; }
    .body-section p { margin-bottom: 16px; color: #444; }
    .testimonials { background: #f0ede8; padding: 60px 24px; }
    .testimonials-inner { max-width: 900px; margin: 0 auto; }
    .testimonials h2 { font-family: 'Playfair Display', serif; font-size: 28px; text-align: center; margin-bottom: 40px; }
    .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: start; }
    ${TESTIMONIAL_CARD_CSS}
    .footer { background: #1a1a1a; color: #888; text-align: center; padding: 32px 24px; font-size: 13px; }
    .footer a { color: #aaa; text-decoration: none; }
    @media (max-width: 600px) { .optin-box { margin: -20px 16px 0; padding: 28px 20px; } }
  </style>
</head>
<body>
  <section class="hero">
    <div class="hero-inner">
      <span class="campaign-badge">${brand.label}</span>
      ${page.heroImageUrl ? `<img src="${page.heroImageUrl}" alt="" class="hero-img">` : ""}
      <h1>${page.headline || page.title}</h1>
      ${page.subheadline ? `<p>${page.subheadline}</p>` : ""}
    </div>
  </section>

  <div class="optin-box">
    ${page.optinHeadline ? `<h2>${page.optinHeadline}</h2>` : ""}
    ${page.optinLeadMagnet ? `<p>Get your free <strong>${page.optinLeadMagnet}</strong> instantly</p>` : ""}
    ${page.kajabiFormUrl ? `
    <form class="optin-form" action="${page.kajabiFormUrl}" method="POST" id="optin-form">
      <input type="text" name="first_name" placeholder="First Name" required>
      <input type="email" name="email" placeholder="Email Address" required>
      <button type="submit" class="optin-btn">${page.optinButtonText || "Yes, Send It To Me!"}</button>
    </form>
    <p class="privacy-note">🔒 Your information is 100% secure. No spam, ever.</p>
    ` : `<p style="text-align:center;color:#888;font-size:14px;">Opt-in form coming soon.</p>`}
  </div>

  ${bodyHtml ? `<div class="body-section">${bodyHtml}</div>` : ""}

  ${testimonials.length > 0 ? `
  <section class="testimonials">
    <div class="testimonials-inner">
      <h2>What People Are Saying</h2>
      <div class="testimonials-grid">
        ${testimonials.map(t => renderTestimonialCard(t)).join("")}
      </div>
    </div>
  </section>` : ""}

  <footer class="footer">
    <p>© ${new Date().getFullYear()} Dr. Pedram Shojai · The Urban Monk · <a href="https://theurbanmonk.com/privacy">Privacy Policy</a></p>
  </footer>

  <script>
    // Track opt-in with FB Pixel
    const form = document.getElementById('optin-form');
    if (form) {
      form.addEventListener('submit', function() {
        if (typeof fbq !== 'undefined') fbq('track', 'Lead');
      });
    }
  </script>
</body>
</html>`;
}

function renderVslTemplate(page: typeof hostedLandingPages.$inferSelect, bodyHtml: string): string {
  const brand = CAMPAIGN_CONFIG[page.campaign] || CAMPAIGN_CONFIG.lo;
  const accent = page.accentColor || brand.accentColor;
  const testimonials: Array<Record<string, any>> = page.testimonials
    ? JSON.parse(page.testimonials)
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  ${renderTrackingScripts(page.facebookPixelId || "1498608757116877", page.ga4MeasurementId, page.customHeadScripts)}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --accent: ${accent}; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #1a1a1a; line-height: 1.6; }
    .top-bar { background: #1a1a1a; color: white; text-align: center; padding: 12px 24px; font-size: 14px; }
    .hero { padding: 60px 24px 40px; text-align: center; max-width: 860px; margin: 0 auto; }
    .campaign-badge { display: inline-block; background: var(--accent); color: white; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; margin-bottom: 20px; }
    .hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(26px, 4.5vw, 48px); line-height: 1.2; margin-bottom: 16px; }
    .hero p { font-size: clamp(15px, 2vw, 18px); color: #555; max-width: 640px; margin: 0 auto 32px; }
    .video-wrapper { max-width: 760px; margin: 0 auto 48px; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); background: #000; aspect-ratio: 16/9; position: relative; }
    .video-wrapper iframe, .video-wrapper video { width: 100%; height: 100%; border: none; }
    .video-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #111; color: #555; font-size: 14px; }
    .cta-section { text-align: center; padding: 40px 24px; }
    .cta-btn { display: inline-block; background: var(--accent); color: white; text-decoration: none; padding: 20px 48px; border-radius: 8px; font-size: 20px; font-weight: 700; font-family: inherit; border: none; cursor: pointer; transition: opacity 0.2s, transform 0.1s; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .cta-btn:hover { opacity: 0.92; transform: translateY(-2px); }
    .cta-subtext { margin-top: 12px; font-size: 13px; color: #888; }
    .body-section { max-width: 760px; margin: 0 auto 60px; padding: 0 24px; }
    .body-section h2 { font-family: 'Playfair Display', serif; font-size: 28px; margin-bottom: 16px; }
    .body-section p { margin-bottom: 16px; color: #444; }
    .testimonials { background: #f5f3ef; padding: 60px 24px; }
    .testimonials-inner { max-width: 900px; margin: 0 auto; }
    .testimonials h2 { font-family: 'Playfair Display', serif; font-size: 28px; text-align: center; margin-bottom: 40px; }
    .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: start; }
    ${TESTIMONIAL_CARD_CSS}
    .footer { background: #1a1a1a; color: #888; text-align: center; padding: 32px 24px; font-size: 13px; }
    .footer a { color: #aaa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="top-bar">Watch this short video to discover ${brand.description}</div>

  <div class="hero">
    <span class="campaign-badge">${brand.label}</span>
    <h1>${page.headline || page.title}</h1>
    ${page.subheadline ? `<p>${page.subheadline}</p>` : ""}
  </div>

  <div class="video-wrapper" style="max-width:760px;margin:0 auto 48px;">
    ${page.videoEmbedCode
      ? page.videoEmbedCode
      : `<div class="video-placeholder">Video embed code not yet configured</div>`}
  </div>

  ${(page.ctaText || page.ctaUrl) ? `
  <div class="cta-section">
    <a href="${page.ctaUrl || "#"}" class="cta-btn" onclick="if(typeof fbq!=='undefined')fbq('track','InitiateCheckout')">
      ${page.ctaText || "Get Started Now"}
    </a>
    ${page.ctaSubtext ? `<p class="cta-subtext">${page.ctaSubtext}</p>` : ""}
  </div>` : ""}

  ${bodyHtml ? `<div class="body-section">${bodyHtml}</div>` : ""}

  ${testimonials.length > 0 ? `
  <section class="testimonials">
    <div class="testimonials-inner">
      <h2>What People Are Saying</h2>
      <div class="testimonials-grid">
        ${testimonials.map(t => renderTestimonialCard(t)).join("")}
      </div>
    </div>
  </section>` : ""}

  ${(page.ctaText || page.ctaUrl) ? `
  <div class="cta-section" style="padding-bottom:60px;">
    <a href="${page.ctaUrl || "#"}" class="cta-btn" onclick="if(typeof fbq!=='undefined')fbq('track','InitiateCheckout')">
      ${page.ctaText || "Get Started Now"}
    </a>
    ${page.ctaSubtext ? `<p class="cta-subtext">${page.ctaSubtext}</p>` : ""}
  </div>` : ""}

  <footer class="footer">
    <p>© ${new Date().getFullYear()} Dr. Pedram Shojai · The Urban Monk · <a href="https://theurbanmonk.com/privacy">Privacy Policy</a></p>
  </footer>
</body>
</html>`;
}

function renderSalesTemplate(page: typeof hostedLandingPages.$inferSelect, bodyHtml: string): string {
  const brand = CAMPAIGN_CONFIG[page.campaign] || CAMPAIGN_CONFIG.lo;
  const accent = page.accentColor || brand.accentColor;
  const testimonials: Array<Record<string, any>> = page.testimonials
    ? JSON.parse(page.testimonials)
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  ${renderTrackingScripts(page.facebookPixelId || "1498608757116877", page.ga4MeasurementId, page.customHeadScripts)}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --accent: ${accent}; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #1a1a1a; line-height: 1.7; }
    .hero { background: linear-gradient(160deg, #1a1a1a 0%, #2a2a2a 100%); color: white; padding: 80px 24px 60px; }
    .hero-inner { max-width: 820px; margin: 0 auto; }
    .campaign-badge { display: inline-block; background: var(--accent); color: white; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; margin-bottom: 24px; }
    .hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 54px); line-height: 1.15; margin-bottom: 20px; }
    .hero p { font-size: clamp(16px, 2vw, 20px); opacity: 0.85; max-width: 680px; margin-bottom: 36px; }
    .hero-img { width: 100%; max-width: 700px; border-radius: 12px; margin-top: 32px; }
    .sales-body { max-width: 760px; margin: 0 auto; padding: 60px 24px; }
    .sales-body h2 { font-family: 'Playfair Display', serif; font-size: 30px; margin: 40px 0 16px; color: #1a1a1a; }
    .sales-body h3 { font-family: 'Playfair Display', serif; font-size: 22px; margin: 28px 0 12px; }
    .sales-body p { margin-bottom: 18px; color: #333; font-size: 17px; }
    .sales-body ul, .sales-body ol { padding-left: 24px; margin-bottom: 18px; }
    .sales-body li { margin-bottom: 8px; color: #333; font-size: 17px; }
    .cta-block { background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); color: white; border-radius: 16px; padding: 48px 40px; text-align: center; margin: 48px 0; }
    .cta-block h2 { font-family: 'Playfair Display', serif; font-size: 28px; margin-bottom: 12px; }
    .cta-block p { opacity: 0.8; margin-bottom: 28px; }
    .cta-btn { display: inline-block; background: var(--accent); color: white; text-decoration: none; padding: 20px 48px; border-radius: 8px; font-size: 20px; font-weight: 700; font-family: inherit; border: none; cursor: pointer; transition: opacity 0.2s, transform 0.1s; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .cta-btn:hover { opacity: 0.92; transform: translateY(-2px); }
    .cta-subtext { margin-top: 12px; font-size: 13px; opacity: 0.6; }
    .testimonials { background: #f5f3ef; padding: 60px 24px; }
    .testimonials-inner { max-width: 900px; margin: 0 auto; }
    .testimonials h2 { font-family: 'Playfair Display', serif; font-size: 28px; text-align: center; margin-bottom: 40px; }
    .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: start; }
    ${TESTIMONIAL_CARD_CSS}
    .footer { background: #1a1a1a; color: #888; text-align: center; padding: 32px 24px; font-size: 13px; }
    .footer a { color: #aaa; text-decoration: none; }
  </style>
</head>
<body>
  <section class="hero">
    <div class="hero-inner">
      <span class="campaign-badge">${brand.label}</span>
      <h1>${page.headline || page.title}</h1>
      ${page.subheadline ? `<p>${page.subheadline}</p>` : ""}
      ${(page.ctaText || page.ctaUrl) ? `
      <a href="${page.ctaUrl || "#"}" class="cta-btn" onclick="if(typeof fbq!=='undefined')fbq('track','InitiateCheckout')">
        ${page.ctaText || "Get Started Now"}
      </a>` : ""}
      ${page.heroImageUrl ? `<img src="${page.heroImageUrl}" alt="" class="hero-img">` : ""}
    </div>
  </section>

  <div class="sales-body">
    ${bodyHtml}

    ${(page.ctaText || page.ctaUrl) ? `
    <div class="cta-block">
      <h2>Ready to Transform Your ${brand.label}?</h2>
      ${page.ctaSubtext ? `<p>${page.ctaSubtext}</p>` : ""}
      <a href="${page.ctaUrl || "#"}" class="cta-btn" onclick="if(typeof fbq!=='undefined')fbq('track','InitiateCheckout')">
        ${page.ctaText || "Get Started Now"}
      </a>
    </div>` : ""}
  </div>

  ${testimonials.length > 0 ? `
  <section class="testimonials">
    <div class="testimonials-inner">
      <h2>Real Results from Real People</h2>
      <div class="testimonials-grid">
        ${testimonials.map(t => renderTestimonialCard(t)).join("")}
      </div>
    </div>
  </section>` : ""}

  ${(page.ctaText || page.ctaUrl) ? `
  <div style="text-align:center;padding:60px 24px;">
    <a href="${page.ctaUrl || "#"}" class="cta-btn" onclick="if(typeof fbq!=='undefined')fbq('track','InitiateCheckout')">
      ${page.ctaText || "Get Started Now"}
    </a>
    ${page.ctaSubtext ? `<p style="margin-top:12px;font-size:13px;color:#888;">${page.ctaSubtext}</p>` : ""}
  </div>` : ""}

  <footer class="footer">
    <p>© ${new Date().getFullYear()} Dr. Pedram Shojai · The Urban Monk · <a href="https://theurbanmonk.com/privacy">Privacy Policy</a></p>
  </footer>
</body>
</html>`;
}

export function renderLandingPageHtml(page: typeof hostedLandingPages.$inferSelect): string {
  const bodyHtml = page.bodyCopy ? marked.parse(page.bodyCopy) as string : "";
  switch (page.template) {
    case "vsl":
      return renderVslTemplate(page, bodyHtml);
    case "sales":
      return renderSalesTemplate(page, bodyHtml);
    default:
      return renderOptinTemplate(page, bodyHtml);
  }
}

// ── tRPC Router ───────────────────────────────────────────────────────────────

export const hostedLandingPagesRouter = router({
  // List all pages (admin)
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(hostedLandingPages).orderBy(desc(hostedLandingPages.createdAt));
  }),

  // Get one page by ID — alias used by CH builder's fromLpId auto-populate
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db
        .select()
        .from(hostedLandingPages)
        .where(eq(hostedLandingPages.id, input.id))
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  // Get one page by ID (admin)
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db
        .select()
        .from(hostedLandingPages)
        .where(eq(hostedLandingPages.id, input.id))
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  // Get one page by campaign + slug (public — for rendering)
  getBySlug: publicProcedure
    .input(z.object({ campaign: campaignEnum, slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db
        .select()
        .from(hostedLandingPages)
        .where(
          and(
            eq(hostedLandingPages.campaign, input.campaign),
            eq(hostedLandingPages.slug, input.slug),
          )
        )
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  // Create a new page
  create: protectedProcedure
    .input(pageContentSchema)
    .mutation(async ({ input }) => {
      // Check slug uniqueness within campaign
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select({ id: hostedLandingPages.id })
        .from(hostedLandingPages)
        .where(
          and(
            eq(hostedLandingPages.campaign, input.campaign),
            eq(hostedLandingPages.slug, input.slug),
          )
        )
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A page already exists at /${input.campaign}/${input.slug}`,
        });
      }

      const testimonialsJson = input.testimonials ? JSON.stringify(input.testimonials) : null;

      const [result] = await db.insert(hostedLandingPages).values({
        campaign: input.campaign,
        slug: input.slug,
        template: input.template,
        status: "draft",
        title: input.title,
        internalLabel: input.internalLabel,
        headline: input.headline,
        subheadline: input.subheadline,
        heroImageUrl: input.heroImageUrl,
        videoEmbedCode: input.videoEmbedCode,
        videoThumbnailUrl: input.videoThumbnailUrl,
        bodyCopy: input.bodyCopy,
        optinHeadline: input.optinHeadline,
        optinButtonText: input.optinButtonText || "Yes, Send It To Me!",
        optinLeadMagnet: input.optinLeadMagnet,
        kajabiFormUrl: input.kajabiFormUrl,
        thankYouUrl: input.thankYouUrl,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
        ctaSubtext: input.ctaSubtext,
        testimonials: testimonialsJson,
        facebookPixelId: input.facebookPixelId || "1498608757116877",
        ga4MeasurementId: input.ga4MeasurementId,
        customHeadScripts: input.customHeadScripts,
        accentColor: input.accentColor,
        logoUrl: input.logoUrl,
        personaId: input.personaId,
        ebookId: input.ebookId,
        webinarSessionId: input.webinarSessionId,
      });

      return { id: (result as any).insertId as number };
    }),

  // Update a page
  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(pageContentSchema.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, testimonials, ...rest } = input;

      const updateData: Record<string, unknown> = { ...rest };
      if (testimonials !== undefined) {
        updateData.testimonials = JSON.stringify(testimonials);
      }

      await db
        .update(hostedLandingPages)
        .set(updateData)
        .where(eq(hostedLandingPages.id, id));

      return { success: true };
    }),

  // Publish a page
  publish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(hostedLandingPages)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(hostedLandingPages.id, input.id));
      return { success: true };
    }),

  // Unpublish (back to draft)
  unpublish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(hostedLandingPages)
        .set({ status: "draft", publishedAt: null })
        .where(eq(hostedLandingPages.id, input.id));
      return { success: true };
    }),

  // Archive a page
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(hostedLandingPages)
        .set({ status: "archived" })
        .where(eq(hostedLandingPages.id, input.id));
      return { success: true };
    }),

  // Delete a page
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(hostedLandingPages).where(eq(hostedLandingPages.id, input.id));
      return { success: true };
    }),

  // Track a view (public — called from the rendered page JS)
  trackView: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      // Increment view count — fire and forget
      await db
        .update(hostedLandingPages)
        .set({ viewCount: sql`${hostedLandingPages.viewCount} + 1` })
        .where(eq(hostedLandingPages.id, input.id))
        .catch(() => {});
      return { success: true };
    }),

  // AI copy generator — drafts headline, subheadline, body copy, CTA, and opt-in text from a single prompt
  generateCopy: protectedProcedure
    .input(z.object({
      campaign: z.enum(["lo", "gut", "sleep", "webinar"]),
      template: z.enum(["optin", "vsl", "sales"]),
      prompt: z.string().min(10).max(500),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");

      const campaignContext: Record<string, string> = {
        lo: "Lights On — Dr. Pedram Shojai's program about reclaiming energy, vitality, and focus. Target audience: burned-out professionals, entrepreneurs, and high-achievers who feel exhausted, foggy, and disconnected. Core promise: restore your energy and mental clarity naturally.",
        gut: "Gut Health — Dr. Pedram Shojai's program about healing the gut, reducing inflammation, and restoring digestive health. Target audience: people suffering from bloating, fatigue, brain fog, and chronic digestive issues. Core promise: heal your gut and transform your health from the inside out.",
        sleep: "Sleep — Dr. Pedram Shojai's program about mastering deep, restorative sleep. Target audience: insomniacs, light sleepers, and chronically tired people. Core promise: fall asleep faster, stay asleep longer, and wake up fully restored.",
      };

      const templateContext: Record<string, string> = {
        optin: "opt-in page (lead magnet / free gift). Needs: punchy headline, benefit-driven subheadline, short body copy (2–3 sentences), opt-in form headline, and button text.",
        vsl: "video sales letter page. Needs: curiosity-driven headline, subheadline that teases the video, short pre-video body copy (1–2 sentences), and a strong CTA button text.",
        sales: "long-form sales page. Needs: bold headline, empathetic subheadline, longer body copy (3–4 paragraphs covering problem, agitation, solution), and a compelling CTA.",
      };

      const systemPrompt = `You are a world-class direct-response copywriter for Dr. Pedram Shojai, The Urban Monk — a bestselling author, filmmaker, and wellness expert. You write in his voice: warm, authoritative, practical, and slightly irreverent. You never use hype or fake urgency. You write copy that converts because it is deeply true and resonant.

Campaign context: ${campaignContext[input.campaign]}
Page type: ${templateContext[input.template]}

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "headline": "string (max 80 chars, bold promise or pattern interrupt)",
  "subheadline": "string (max 140 chars, expands on headline with empathy or curiosity)",
  "bodyCopy": "string (markdown-formatted body copy appropriate for the template type)",
  "optinHeadline": "string (max 60 chars, the text above the email form — e.g. 'Get Instant Access')",
  "optinButtonText": "string (max 40 chars, the CTA button — e.g. 'Yes, Send It To Me!')",
  "ctaText": "string (max 40 chars, primary CTA button text)",
  "ctaSubtext": "string (max 100 chars, reassurance text below CTA — e.g. 'No credit card required.')"
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write landing page copy for this page. Additional context from user: ${input.prompt}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "landing_page_copy",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                subheadline: { type: "string" },
                bodyCopy: { type: "string" },
                optinHeadline: { type: "string" },
                optinButtonText: { type: "string" },
                ctaText: { type: "string" },
                ctaSubtext: { type: "string" },
              },
              required: ["headline", "subheadline", "bodyCopy", "optinHeadline", "optinButtonText", "ctaText", "ctaSubtext"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response?.choices?.[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : null;
      if (!raw) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty response" });
      try {
        const copy = JSON.parse(raw);
        return copy as {
          headline: string;
          subheadline: string;
          bodyCopy: string;
          optinHeadline: string;
          optinButtonText: string;
          ctaText: string;
          ctaSubtext: string;
        };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse LLM response" });
      }
    }),

  // Get rendered HTML for preview (admin)
  preview: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db
        .select()
        .from(hostedLandingPages)
        .where(eq(hostedLandingPages.id, input.id))
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return { html: renderLandingPageHtml(page) };
    }),
});
