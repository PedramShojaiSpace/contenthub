/**
 * Advertorial Bridge Page Router
 * Generates and manages native advertorial pages for cold traffic Meta ads.
 *
 * Two deployment modes:
 *  1. "bridge" — hosted at ch.theurbanmonk.com/bridge/{slug} (external domain)
 *  2. "shopify" — pushed as a Shopify page at theurbanmonkstore.myshopify.com/pages/{slug}
 *                 CTA uses Shopify cart permalink — zero domain hop, direct to checkout
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { advertorialPages, AdvertorialPage } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";

// ─── Shopify supplement product map ───────────────────────────────────────────
// variant_id is the numeric Shopify variant ID (from GID gid://shopify/ProductVariant/{id})
export const SHOPIFY_PRODUCTS: Array<{
  title: string;
  handle: string;
  variantId: string;
  price: string;
  cartUrl: string;
  checkoutUrl: string;
  topic: string[];
}> = [
  {
    title: "Sleep (Mag)nifier",
    handle: "sleep-magnifier-mixed-berry",
    variantId: "45449033940122", // will be fetched dynamically; placeholder
    price: "49.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033940122:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033940122:1?storefront=true",
    topic: ["sleep"],
  },
  {
    title: "Symbio Serenity",
    handle: "symbio-serenity-30c",
    variantId: "45449033973914",
    price: "43.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033973914:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033973914:1?storefront=true",
    topic: ["stress", "gut_health"],
  },
  {
    title: "RESTORE Flow",
    handle: "downshift-cherry-60sv",
    variantId: "45449034006682",
    price: "59.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034006682:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034006682:1?storefront=true",
    topic: ["stress", "energy"],
  },
  {
    title: "Mito Boost",
    handle: "mito-boost-30c",
    variantId: "45449034039450",
    price: "42.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034039450:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034039450:1?storefront=true",
    topic: ["energy", "longevity"],
  },
  {
    title: "BRB Trim",
    handle: "brb-trim-60c",
    variantId: "45449034072218",
    price: "49.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034072218:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034072218:1?storefront=true",
    topic: ["inflammation", "gut_health"],
  },
  {
    title: "RESTORE Zen",
    handle: "chill-60c",
    variantId: "45449034137754",
    price: "54.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034137754:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034137754:1?storefront=true",
    topic: ["stress", "sleep"],
  },
  {
    title: "Move",
    handle: "move-60c",
    variantId: "45449034170522",
    price: "23.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034170522:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034170522:1?storefront=true",
    topic: ["inflammation", "longevity"],
  },
  {
    title: "Boost",
    handle: "adrenal-boost",
    variantId: "45929052635290",
    price: "27.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45929052635290:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45929052635290:1?storefront=true",
    topic: ["energy", "stress"],
  },
  {
    title: "Clear",
    handle: "clear",
    variantId: "45929066496154",
    price: "59.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45929066496154:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45929066496154:1?storefront=true",
    topic: ["gut_health", "inflammation"],
  },
  {
    title: "Detox Support",
    handle: "detox-support",
    variantId: "45929079505050",
    price: "40.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45929079505050:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45929079505050:1?storefront=true",
    topic: ["gut_health", "inflammation"],
  },
  {
    title: "JING",
    handle: "jing",
    variantId: "45934256619674",
    price: "47.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45934256619674:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45934256619674:1?storefront=true",
    topic: ["longevity", "energy"],
  },
  {
    title: "SymbioLean",
    handle: "symbiolean",
    variantId: "45934349713562",
    price: "62.99",
    cartUrl: "https://theurbanmonkstore.myshopify.com/cart/45934349713562:1",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45934349713562:1?storefront=true",
    topic: ["gut_health", "inflammation"],
  },
];

// ─── Topic configs ─────────────────────────────────────────────────────────────
// ─── Flagship funnel entry points (top-level) + supplement topics ─────────────
// ORDER MATTERS: flagship products appear first in the UI
const TOPIC_CONFIGS: Record<string, {
  label: string;
  defaultCampaign: string;
  defaultCtaUrl: string;
  defaultCtaText: string;
  defaultCtaSubtext: string;
  painPoints: string[];
  mechanism: string;
  offer: string;
  defaultShopifyProduct?: string; // handle of the default supplement for this topic
}> = {
  // ── FLAGSHIP ENTRY POINTS ──────────────────────────────────────────────────
  lights_on: {
    label: "LIGHTS ON Program",
    defaultCampaign: "lo",
    defaultCtaUrl: "https://ch.theurbanmonk.com/lights-on",
    defaultCtaText: "Start the LIGHTS ON Program →",
    defaultCtaSubtext: "$369 · Lifetime access · 30-day money-back guarantee",
    painPoints: [
      "waking up exhausted no matter how many hours you sleep",
      "brain fog that makes simple tasks feel impossible",
      "energy that crashes by 2pm every single day",
      "relying on caffeine just to function",
      "feeling like your body is working against you",
    ],
    mechanism: "Five Element organ clock energy depletion — the ancient Chinese medical system that maps organ function to time of day",
    offer: "LIGHTS ON — Dr. Pedram Shojai's 8-week energy restoration program ($369)",
    defaultShopifyProduct: undefined,
  },
  orobiome: {
    label: "Orobiome Test",
    defaultCampaign: "orobiome",
    defaultCtaUrl: "https://ch.theurbanmonk.com/orobiome",
    defaultCtaText: "Get Your Orobiome Test →",
    defaultCtaSubtext: "$399 · At-home oral microbiome test · Results in 2-3 weeks",
    painPoints: [
      "chronic bad breath that won't go away no matter what you do",
      "gum disease and dental issues that keep coming back",
      "brain fog and cognitive decline that started gradually",
      "heart health concerns your dentist and doctor both dismiss",
      "systemic inflammation with no clear source",
    ],
    mechanism: "oral-systemic axis — the mouth is the gateway to the body, and an imbalanced oral microbiome silently drives inflammation, heart disease, and cognitive decline",
    offer: "Orobiome Test — At-home oral microbiome analysis ($399)",
    defaultShopifyProduct: undefined,
  },
  kbmo_fit22: {
    label: "KBMO FIT22 Test",
    defaultCampaign: "kbmo",
    defaultCtaUrl: "https://ch.theurbanmonk.com/kbmo",
    defaultCtaText: "Get Your KBMO FIT22 Test →",
    defaultCtaSubtext: "$399 · At-home food sensitivity test · 22 foods tested",
    painPoints: [
      "bloating and digestive distress after eating 'healthy' foods",
      "unexplained weight gain that won't budge",
      "skin flare-ups, eczema, or rashes with no clear trigger",
      "joint pain and inflammation that comes and goes",
      "fatigue and brain fog after meals",
    ],
    mechanism: "delayed IgG food sensitivity — unlike immediate allergies, these reactions happen 2-72 hours after eating, making the trigger nearly impossible to identify without testing",
    offer: "KBMO FIT22 Food Sensitivity Test — at-home test kit ($399)",
    defaultShopifyProduct: undefined,
  },

  // ── SUPPLEMENT TOPICS ────────────────────────────────────────────────────────
  gut_health: {
    label: "Gut Health",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/45929066496154:1",
    defaultCtaText: "Get Clear — Add to Cart →",
    defaultCtaSubtext: "Ships within 2 business days · 30-day money-back guarantee",
    painPoints: [
      "chronic bloating and digestive discomfort",
      "brain fog and inability to concentrate",
      "unexplained fatigue that sleep doesn't fix",
      "food sensitivities that keep expanding",
      "inflammation that doctors can't explain",
    ],
    mechanism: "gut-brain axis inflammation cascade",
    offer: "Clear — Advanced Gut Health Formula",
    defaultShopifyProduct: "clear",
  },
  sleep: {
    label: "Sleep & Fatigue",
    defaultCampaign: "lo",
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033940122:1",
    defaultCtaText: "Get Sleep (Mag)nifier — Add to Cart →",
    defaultCtaSubtext: "Ships within 2 business days · 30-day money-back guarantee",
    painPoints: [
      "waking up exhausted no matter how much sleep you get",
      "racing mind that won't shut off at night",
      "afternoon energy crashes that derail your day",
      "relying on caffeine just to function",
      "feeling disconnected and foggy all day",
    ],
    mechanism: "Five Element organ body clock imbalance",
    offer: "Sleep (Mag)nifier — Deep Sleep Magnesium Formula",
    defaultShopifyProduct: "sleep-magnifier-mixed-berry",
  },
  energy: {
    label: "Energy & Vitality",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034039450:1",
    defaultCtaText: "Get Mito Boost — Add to Cart →",
    defaultCtaSubtext: "Ships within 2 business days · 30-day money-back guarantee",
    painPoints: [
      "chronic fatigue that no amount of rest fixes",
      "immune system that keeps getting triggered",
      "inflammation sapping your vitality",
      "feeling old before your time",
      "low motivation and drive",
    ],
    mechanism: "mitochondrial dysfunction from chronic immune activation",
    offer: "Mito Boost — Cellular Energy & Antioxidant Formula",
    defaultShopifyProduct: "mito-boost-30c",
  },
  inflammation: {
    label: "Inflammation",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034072218:1",
    defaultCtaText: "Get BRB Trim — Add to Cart →",
    defaultCtaSubtext: "Ships within 2 business days · 30-day money-back guarantee",
    painPoints: [
      "joint pain and stiffness that limits your life",
      "skin issues that flare without warning",
      "autoimmune symptoms doctors dismiss",
      "weight gain that won't budge despite clean eating",
      "mood swings and anxiety tied to physical symptoms",
    ],
    mechanism: "leaky gut triggering systemic inflammatory cascade",
    offer: "BRB Trim — Inflammation & Metabolic Support Formula",
    defaultShopifyProduct: "brb-trim-60c",
  },
  stress: {
    label: "Stress & Cortisol",
    defaultCampaign: "lo",
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034137754:1",
    defaultCtaText: "Get RESTORE Zen — Add to Cart →",
    defaultCtaSubtext: "Ships within 2 business days · 30-day money-back guarantee",
    painPoints: [
      "constant low-grade anxiety that never fully goes away",
      "cortisol dysregulation destroying your sleep",
      "stress eating and weight gain around the midsection",
      "feeling overwhelmed by things that used to be easy",
      "burnout that a vacation can't fix",
    ],
    mechanism: "HPA axis dysregulation from modern lifestyle overload",
    offer: "RESTORE Zen — Adaptogenic Stress & Cortisol Formula",
    defaultShopifyProduct: "chill-60c",
  },
  longevity: {
    label: "Longevity & Anti-Aging",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/45449034039450:1",
    defaultCtaText: "Get Mito Boost — Add to Cart →",
    defaultCtaSubtext: "Ships within 2 business days · 30-day money-back guarantee",
    painPoints: [
      "aging faster than your peers",
      "declining cognitive function and memory",
      "loss of muscle mass and strength",
      "chronic disease risk that keeps climbing",
      "feeling like your best years are behind you",
    ],
    mechanism: "accelerated cellular aging from gut-driven inflammation",
    offer: "Mito Boost — Cellular Longevity & Antioxidant Formula",
    defaultShopifyProduct: "mito-boost-30c",
  },
};

// ─── Generate advertorial copy via LLM ────────────────────────────────────────
async function generateAdvertorialCopy(params: {
  topic: string;
  customAngle?: string;
  targetAudience?: string;
  deploymentMode?: "bridge" | "shopify";
  productTitle?: string;
  productPrice?: string;
}): Promise<{
  headline: string;
  subheadline: string;
  mechanismAngle: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
}> {
  const config = TOPIC_CONFIGS[params.topic];
  if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown topic: ${params.topic}` });

  const audience = params.targetAudience || "health-conscious adults 35-65 who are frustrated with conventional medicine";
  const angle = params.customAngle || config.mechanism;
  const isShopify = params.deploymentMode === "shopify";
  const productTitle = params.productTitle || config.offer;
  const productPrice = params.productPrice;

  const systemPrompt = `You are a world-class direct response copywriter specializing in native advertorials for health and wellness brands.
You write editorial-style content that reads like journalism, not advertising.
Your advertorials follow the proven anatomy:
1. Skeptic-destroying headline — specific, benefit-driven, speaks to the reader's biggest pain
2. Invisible mechanism angle — a metaphor or concept that explains the hidden root cause
3. 3-minute deep engagement — reads like a news article, builds credibility, maximizes completion
4. Seamless bridge CTA — natural next step that pre-qualifies the reader

The brand is Dr. Pedram Shojai, OMD — Doctor of Oriental Medicine, Daoist monk, NYT bestselling author, PBS filmmaker.
He bridges ancient Eastern wisdom with modern functional medicine.
His authority: 30 years of practice, 8 books, The Urban Monk Academy.

${isShopify ? `SHOPIFY MODE: This advertorial lives DIRECTLY on the Shopify store. The CTA button adds the product to cart with zero redirect. 
Write the CTA copy as a direct product purchase invitation (e.g., "Add to Cart", "Get Your Bottle", "Try ${productTitle} Today").
The product is: ${productTitle}${productPrice ? ` — $${productPrice}` : ""}.
Include the product naturally in the final paragraphs as the solution Dr. Shojai recommends.` : ""}

CRITICAL RULES:
- Write in editorial/journalistic voice — NEVER sound like an ad
- Use "researchers have found" / "a growing body of evidence" / "practitioners are seeing" framing
- Include Dr. Shojai's credentials naturally in the narrative
- The mechanism angle must be specific and counterintuitive (not generic "inflammation is bad")
- Body copy should be 600-900 words of genuine educational value
- End with a soft, curiosity-driven CTA that feels like a logical next step
- No exclamation marks in headlines. No "revolutionary" or "breakthrough" language.
- Output ONLY valid JSON, no markdown code blocks`;

  const userPrompt = `Generate a complete advertorial bridge page for the following:

TOPIC: ${config.label}
MECHANISM ANGLE: ${angle}
TARGET AUDIENCE: ${audience}
PAIN POINTS TO ADDRESS: ${config.painPoints.join(", ")}
OFFER: ${productTitle}${productPrice ? ` ($${productPrice})` : ""}
DEPLOYMENT: ${isShopify ? "Shopify native page — CTA goes directly to cart" : "Bridge page — CTA links to assessment/offer page"}

Return a JSON object with these exact fields:
{
  "headline": "The main headline (skeptic-destroying, specific, 10-15 words max)",
  "subheadline": "Supporting subheadline that deepens curiosity (15-25 words)",
  "mechanismAngle": "1-2 sentence explanation of the invisible mechanism concept used in this advertorial",
  "bodyHtml": "Full article body as HTML (use <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em> tags only). 600-900 words. Structure: hook paragraph → mechanism explanation → social proof reference → Dr. Shojai's approach → what most people get wrong → the solution framework → bridge to CTA",
  "metaTitle": "SEO title (55-60 chars)",
  "metaDescription": "Meta description (140-155 chars)"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "advertorial_copy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            subheadline: { type: "string" },
            mechanismAngle: { type: "string" },
            bodyHtml: { type: "string" },
            metaTitle: { type: "string" },
            metaDescription: { type: "string" },
          },
          required: ["headline", "subheadline", "mechanismAngle", "bodyHtml", "metaTitle", "metaDescription"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return parsed;
}

// ─── Shopify page HTML generator (Liquid-compatible) ──────────────────────────
export function renderShopifyPageHtml(page: AdvertorialPage): string {
  const pixelId = page.metaPixelId || "1498608757116877";
  const pubDate = new Date(page.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  // Extract variant ID from cart URL if present
  const cartUrl = page.ctaUrl || "";
  const variantMatch = cartUrl.match(/\/cart\/(\d+):(\d+)/);
  const variantId = variantMatch ? variantMatch[1] : null;
  const quantity = variantMatch ? variantMatch[2] : "1";

  // Build the CTA — if we have a variant ID, use Shopify's native cart permalink
  const finalCtaUrl = variantId
    ? `https://theurbanmonkstore.myshopify.com/cart/${variantId}:${quantity}`
    : cartUrl;

  return `<!-- Urban Monk Advertorial: ${page.slug} -->
<!-- Generated by Urban Monk Content Hub — paste into Shopify Admin > Online Store > Pages > HTML editor -->
<!-- Page URL will be: https://theurbanmonkstore.myshopify.com/pages/${page.slug} -->

<style>
  .adv-wrap { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.7; }
  .adv-pub-bar { background: #1a1a1a; color: #fff; padding: 10px 20px; margin: -20px -20px 32px; display: flex; align-items: center; justify-content: space-between; font-family: Arial, sans-serif; }
  .adv-pub-name { font-size: 14px; font-weight: 700; letter-spacing: 0.05em; }
  .adv-pub-tag { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.08em; }
  .adv-sponsored { font-size: 10px; color: #aaa; border: 1px solid #444; padding: 2px 8px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.1em; }
  .adv-category { font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c0392b; margin-bottom: 14px; }
  .adv-headline { font-size: clamp(24px, 5vw, 36px); font-weight: 700; line-height: 1.25; color: #111; margin-bottom: 14px; }
  .adv-sub { font-size: 18px; color: #444; line-height: 1.5; margin-bottom: 22px; font-style: italic; }
  .adv-byline { font-family: Arial, sans-serif; font-size: 13px; color: #666; padding-bottom: 18px; border-bottom: 1px solid #e0e0e0; margin-bottom: 26px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .adv-byline .adv-author { font-weight: 600; color: #333; }
  .adv-byline .adv-rt { background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
  .adv-hero { width: 100%; height: 260px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 4px; margin-bottom: 26px; }
  .adv-body p { margin-bottom: 18px; font-size: 17px; }
  .adv-body h2 { font-size: 21px; font-weight: 700; margin: 30px 0 10px; color: #111; }
  .adv-body h3 { font-size: 17px; font-weight: 700; margin: 22px 0 8px; color: #222; }
  .adv-body ul, .adv-body ol { margin: 14px 0 18px 22px; }
  .adv-body li { margin-bottom: 7px; font-size: 17px; }
  .adv-body strong { color: #111; }
  .adv-cta { margin-top: 40px; padding: 30px 28px; background: #1a1a1a; border-radius: 8px; text-align: center; color: #fff; }
  .adv-cta h2 { font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #fff; }
  .adv-cta p { font-size: 14px; color: #ccc; margin-bottom: 22px; font-family: Arial, sans-serif; }
  .adv-btn { display: inline-block; background: #00d4ff; color: #000 !important; font-family: Arial, sans-serif; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 4px; text-decoration: none !important; letter-spacing: 0.02em; }
  .adv-btn:hover { background: #00b8d9; color: #000 !important; }
  .adv-subtext { font-size: 12px; color: #888; margin-top: 10px; font-family: Arial, sans-serif; }
  .adv-disclaimer { margin-top: 44px; padding-top: 18px; border-top: 1px solid #e0e0e0; font-family: Arial, sans-serif; font-size: 11px; color: #999; line-height: 1.6; }
  @media (max-width: 600px) { .adv-wrap { padding: 20px 14px 50px; } .adv-headline { font-size: 22px; } .adv-cta { padding: 20px 14px; } }
</style>

<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');fbq('track','ViewContent',{content_name:'${(page.slug||"").replace(/'/g,"\\'")}',content_category:'${(page.topic||"").replace(/'/g,"\\'")}',content_type:'product'${variantId ? `,content_ids:['${variantId}']` : ""}});
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>

<div class="adv-wrap">
  <div class="adv-pub-bar">
    <div>
      <div class="adv-pub-name">${page.publicationName || "The Urban Monk Insider"}</div>
      <div class="adv-pub-tag">Health · Longevity · Ancient Wisdom</div>
    </div>
    <div class="adv-sponsored">Sponsored</div>
  </div>

  <div class="adv-category">Health &amp; Longevity</div>
  <h1 class="adv-headline">${page.headline || ""}</h1>
  ${page.subheadline ? `<div class="adv-sub">${page.subheadline}</div>` : ""}
  <div class="adv-byline">
    <span>By <span class="adv-author">${page.authorName || "Dr. Pedram Shojai, OMD"}</span></span>
    <span>${pubDate}</span>
    <span class="adv-rt">${page.readTime || "3 min read"}</span>
  </div>
  ${page.heroImageUrl
    ? `<img src="${page.heroImageUrl}" alt="${page.headline || "Article header"}" style="width:100%;height:260px;object-fit:cover;border-radius:4px;margin-bottom:26px;" />`
    : `<div class="adv-hero"></div>`
  }
  <div class="adv-body">${page.bodyHtml || ""}</div>

  <div class="adv-cta">
    <h2>Ready to Experience the Difference?</h2>
    <p>${page.ctaSubtext || "Ships within 2 business days · 30-day money-back guarantee"}</p>
    <a href="${finalCtaUrl}" class="adv-btn" onclick="typeof fbq!=='undefined'&&fbq('track','AddToCart'${variantId ? `,{content_ids:['${variantId}'],content_type:'product'}` : ""})">
      ${page.ctaText || "Add to Cart →"}
    </a>
    <div class="adv-subtext">Secure checkout · Free shipping on orders over $75</div>
  </div>

  <div class="adv-disclaimer">
    <strong>Disclosure:</strong> This is a sponsored editorial. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Individual results may vary. Consult your healthcare provider before use. Dr. Pedram Shojai, OMD is a licensed Doctor of Oriental Medicine.
  </div>
</div>`;
}

// ─── Bridge page HTML renderer (external domain) ──────────────────────────────
export function renderAdvertorialHtml(page: AdvertorialPage): string {
  const pixelId = page.metaPixelId || "1498608757116877";
  const ga4Id = page.ga4Id || "G-CXZK2Q275S";
  const pubDate = new Date(page.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.metaTitle || page.headline || "The Urban Monk Insider"}</title>
  <meta name="description" content="${page.metaDescription || ""}" />
  <meta property="og:title" content="${page.headline || ""}" />
  <meta property="og:description" content="${page.subheadline || ""}" />
  <meta property="og:type" content="article" />

  <!-- Meta Pixel -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_name: '${(page.slug || "").replace(/'/g, "\\'")}', content_category: '${(page.topic || "").replace(/'/g, "\\'")}' });
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #fafaf8; color: #1a1a1a; line-height: 1.7; }
    .pub-header { background: #1a1a1a; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .pub-name { font-size: 15px; font-weight: 700; letter-spacing: 0.05em; }
    .pub-tagline { font-size: 11px; color: #999; letter-spacing: 0.08em; text-transform: uppercase; }
    .sponsored-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid #444; padding: 2px 8px; border-radius: 2px; }
    .article-wrap { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
    .article-category { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c0392b; margin-bottom: 16px; }
    h1.headline { font-size: clamp(26px, 5vw, 38px); font-weight: 700; line-height: 1.25; color: #111; margin-bottom: 16px; }
    .subheadline { font-size: 18px; color: #444; line-height: 1.5; margin-bottom: 24px; font-style: italic; }
    .byline { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #666; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0; margin-bottom: 28px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .byline .author { font-weight: 600; color: #333; }
    .byline .read-time { background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
    .hero-placeholder { width: 100%; height: 280px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 4px; margin-bottom: 28px; }
    .body-copy p { margin-bottom: 20px; font-size: 17px; }
    .body-copy h2 { font-size: 22px; font-weight: 700; margin: 32px 0 12px; color: #111; }
    .body-copy h3 { font-size: 18px; font-weight: 700; margin: 24px 0 10px; color: #222; }
    .body-copy ul, .body-copy ol { margin: 16px 0 20px 24px; }
    .body-copy li { margin-bottom: 8px; font-size: 17px; }
    .body-copy strong { color: #111; }
    .cta-section { margin-top: 40px; padding: 32px; background: #1a1a1a; border-radius: 8px; text-align: center; color: #fff; }
    .cta-section h2 { font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #fff; }
    .cta-section p { font-size: 15px; color: #ccc; margin-bottom: 24px; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .cta-btn { display: inline-block; background: #00d4ff; color: #000; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 4px; text-decoration: none; letter-spacing: 0.02em; }
    .cta-subtext { font-size: 12px; color: #888; margin-top: 12px; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .disclaimer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #999; line-height: 1.6; }
    @media (max-width: 600px) { .article-wrap { padding: 24px 16px 60px; } h1.headline { font-size: 24px; } .cta-section { padding: 24px 16px; } }
  </style>
</head>
<body>
  <div class="pub-header">
    <div>
      <div class="pub-name">${page.publicationName || "The Urban Monk Insider"}</div>
      <div class="pub-tagline">Health · Longevity · Ancient Wisdom</div>
    </div>
    <div class="sponsored-label">Sponsored</div>
  </div>

  <div class="article-wrap">
    <div class="article-category">Health &amp; Longevity</div>
    <h1 class="headline">${page.headline || ""}</h1>
    ${page.subheadline ? `<div class="subheadline">${page.subheadline}</div>` : ""}
    <div class="byline">
      <span>By <span class="author">${page.authorName || "Dr. Pedram Shojai, OMD"}</span></span>
      <span>${pubDate}</span>
      <span class="read-time">${page.readTime || "3 min read"}</span>
    </div>
    ${page.heroImageUrl
      ? `<img src="${page.heroImageUrl}" alt="Article header" style="width:100%;height:280px;object-fit:cover;border-radius:4px;margin-bottom:28px;" />`
      : `<div class="hero-placeholder"></div>`
    }
    <div class="body-copy">${page.bodyHtml || ""}</div>

    <div class="cta-section">
      <h2>Ready to Find Out What's Really Going On?</h2>
      <p>${page.ctaSubtext || "Take the free 60-second assessment and get your personalized protocol."}</p>
      <a href="${page.ctaUrl || "https://theacademy.theurbanmonk.com"}" class="cta-btn" onclick="typeof fbq !== 'undefined' && fbq('track', 'Lead')">
        ${page.ctaText || "Check Your Eligibility →"}
      </a>
    </div>

    <div class="disclaimer">
      <strong>Disclosure:</strong> This is a sponsored editorial. The information provided is for educational purposes only and is not intended as medical advice. Individual results may vary. Consult your healthcare provider before making any changes to your health regimen. Dr. Pedram Shojai, OMD is a licensed Doctor of Oriental Medicine.
    </div>
  </div>
</body>
</html>`;
}

// ─── Router ────────────────────────────────────────────────────────────────────
export const advertorialRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return await db
      .select({
        id: advertorialPages.id,
        slug: advertorialPages.slug,
        topic: advertorialPages.topic,
        campaign: advertorialPages.campaign,
        status: advertorialPages.status,
        headline: advertorialPages.headline,
        ctaUrl: advertorialPages.ctaUrl,
        createdAt: advertorialPages.createdAt,
        publishedAt: advertorialPages.publishedAt,
      })
      .from(advertorialPages)
      .orderBy(advertorialPages.createdAt);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  getTopics: protectedProcedure.query(async () => {
    return Object.entries(TOPIC_CONFIGS).map(([key, config]) => ({
      key,
      label: config.label,
      defaultCampaign: config.defaultCampaign,
      defaultCtaUrl: config.defaultCtaUrl,
      defaultCtaText: config.defaultCtaText,
      defaultCtaSubtext: config.defaultCtaSubtext,
      defaultShopifyProduct: config.defaultShopifyProduct,
    }));
  }),

  getProducts: protectedProcedure.query(async () => {
    return SHOPIFY_PRODUCTS;
  }),

  generate: protectedProcedure
    .input(z.object({
      topic: z.string(),
      customAngle: z.string().optional(),
      targetAudience: z.string().optional(),
      slug: z.string().min(3).max(128).regex(/^[a-z0-9-]+$/),
      campaign: z.string().optional(),
      ctaUrl: z.string().optional(),
      ctaText: z.string().optional(),
      ctaSubtext: z.string().optional(),
      publicationName: z.string().optional(),
      authorName: z.string().optional(),
      deploymentMode: z.enum(["bridge", "shopify"]).default("shopify"),
      shopifyProductHandle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const config = TOPIC_CONFIGS[input.topic];
      if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown topic" });

      // Resolve product for Shopify mode
      let productTitle = config.offer;
      let productPrice: string | undefined;
      let resolvedCtaUrl = input.ctaUrl || config.defaultCtaUrl;
      let resolvedCtaText = input.ctaText || config.defaultCtaText;

      if (input.deploymentMode === "shopify") {
        const handle = input.shopifyProductHandle || config.defaultShopifyProduct;
        const product = SHOPIFY_PRODUCTS.find(p => p.handle === handle);
        if (product) {
          productTitle = product.title;
          productPrice = product.price;
          resolvedCtaUrl = product.cartUrl;
          resolvedCtaText = input.ctaText || `Get ${product.title} — Add to Cart →`;
        }
      }

      const copy = await generateAdvertorialCopy({
        topic: input.topic,
        customAngle: input.customAngle,
        targetAudience: input.targetAudience,
        deploymentMode: input.deploymentMode,
        productTitle,
        productPrice,
      });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const [result] = await db.insert(advertorialPages).values({
        slug: input.slug,
        topic: input.topic,
        campaign: input.campaign || config.defaultCampaign,
        status: "draft",
        publicationName: input.publicationName || "The Urban Monk Insider",
        authorName: input.authorName || "Dr. Pedram Shojai, OMD",
        readTime: "3 min read",
        headline: copy.headline,
        subheadline: copy.subheadline,
        mechanismAngle: copy.mechanismAngle,
        bodyHtml: copy.bodyHtml,
        ctaText: resolvedCtaText,
        ctaSubtext: input.ctaSubtext || config.defaultCtaSubtext,
        ctaUrl: resolvedCtaUrl,
        metaTitle: copy.metaTitle,
        metaDescription: copy.metaDescription,
        generationPrompt: `topic:${input.topic} angle:${input.customAngle || config.mechanism} mode:${input.deploymentMode}`,
        generationModel: "default",
        createdAt: now,
        updatedAt: now,
      });

      const insertId = (result as any).insertId;
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, insertId));
      return page;
    }),

  getShopifyHtml: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        html: renderShopifyPageHtml(page),
        shopifyAdminUrl: `https://admin.shopify.com/store/theurbanmonkstore/pages/new`,
        pageUrl: `https://theurbanmonkstore.myshopify.com/pages/${page.slug}`,
        instructions: [
          "1. Go to Shopify Admin → Online Store → Pages → Add page",
          `2. Set the page title to: ${page.headline || page.slug}`,
          `3. Set the URL handle to: ${page.slug}`,
          "4. Click the </> (HTML) button in the content editor",
          "5. Paste the HTML below into the editor",
          "6. Click Save",
          `7. Your page will be live at: https://theurbanmonkstore.myshopify.com/pages/${page.slug}`,
          "8. Use this URL as your Meta ad destination — the CTA goes directly to Shopify checkout",
        ],
      };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      bodyHtml: z.string().optional(),
      ctaText: z.string().optional(),
      ctaSubtext: z.string().optional(),
      ctaUrl: z.string().optional(),
      heroImageUrl: z.string().optional(),
      publicationName: z.string().optional(),
      authorName: z.string().optional(),
      readTime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...fields } = input;
      const updates: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updates[k] = v;
      }
      await db.update(advertorialPages).set(updates).where(eq(advertorialPages.id, id));
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, id));
      return page;
    }),

  setStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "published", "archived"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      await db.update(advertorialPages).set({
        status: input.status,
        publishedAt: input.status === "published" ? now : undefined,
        updatedAt: now,
      }).where(eq(advertorialPages.id, input.id));
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      return page;
    }),

  regenerate: protectedProcedure
    .input(z.object({
      id: z.number(),
      customAngle: z.string().optional(),
      targetAudience: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      const copy = await generateAdvertorialCopy({
        topic: page.topic,
        customAngle: input.customAngle,
        targetAudience: input.targetAudience,
      });

      const now = Date.now();
      await db.update(advertorialPages).set({
        headline: copy.headline,
        subheadline: copy.subheadline,
        mechanismAngle: copy.mechanismAngle,
        bodyHtml: copy.bodyHtml,
        metaTitle: copy.metaTitle,
        metaDescription: copy.metaDescription,
        updatedAt: now,
      }).where(eq(advertorialPages.id, input.id));

      const [updated] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(advertorialPages).where(eq(advertorialPages.id, input.id));
      return { success: true };
    }),
});
