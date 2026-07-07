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
import { advertorialPages, AdvertorialPage, metaAdVariants } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";
import { generateImage } from "./_core/imageGeneration";
import { getMetaAdsConfig } from "./metaAdsClient";

// ─── Meta push helpers (local to this router) ─────────────────────────────────
const META_API_VERSION = "v19.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const ADVERTORIAL_LANDING_URL = "https://theacademy.theurbanmonk.com/a/2148285846/PpCdamnj";

async function metaPostAdv<T = any>(
  endpoint: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const url = `${META_BASE_URL}/${endpoint}`;
  const flatParams: Record<string, string> = { access_token: accessToken };
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
      flatParams[k] = JSON.stringify(v);
    } else {
      flatParams[k] = String(v);
    }
  }
  const body = new URLSearchParams(flatParams);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta API error on POST /${endpoint}: ${msg}`);
  }
  return json as T;
}

/**
 * Upload an image to Meta's ad image library using the bytes (base64) method.
 * The url-based method requires special app permissions not available to most Marketing API apps.
 * The bytes method works with standard ads_management scope.
 */
async function uploadImageToMeta(
  imageUrl: string,
  adAccountId: string,
  accessToken: string
): Promise<string> {
  // Step 1: Download the image from S3/CDN into a buffer
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image for Meta upload: HTTP ${imgRes.status}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  const base64Image = imgBuffer.toString("base64");

  // Step 2: Upload to Meta using base64 bytes in a multipart POST
  const filename = `ad_image_${Date.now()}.jpg`;
  const actId = `act_${adAccountId}`;

  const formData = new FormData();
  formData.append("bytes", base64Image);
  formData.append("name", filename);
  formData.append("access_token", accessToken);

  const res = await fetch(`${META_BASE_URL}/${actId}/adimages`, {
    method: "POST",
    body: formData,
  });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta image upload error: ${msg}`);
  }
  // Response: { images: { "<filename>": { hash: "...", url: "..." } } }
  const firstEntry = Object.values(json.images ?? {})[0] as any;
  if (!firstEntry?.hash) throw new Error(`Meta image upload returned no hash. Response: ${JSON.stringify(json)}`);
  return firstEntry.hash as string;
}

/** Create a full PAUSED ad (campaign → adSet → creative → ad) in Meta Ads Manager */
async function createPausedMetaAd(opts: {
  campaignName: string;
  imageHash: string;
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  landingUrl: string;
  adAccountId: string;
  accessToken: string;
  pageId: string;
}): Promise<{ campaignId: string; adSetId: string; creativeId: string; adId: string }> {
  const actId = `act_${opts.adAccountId}`;

  // Step 1: Campaign
  const campaignRes = await metaPostAdv<{ id: string }>(
    `${actId}/campaigns`,
    {
      name: opts.campaignName,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    },
    opts.accessToken
  );

  // Step 2: Ad Set
  const adSetRes = await metaPostAdv<{ id: string }>(
    `${actId}/adsets`,
    {
      name: `${opts.campaignName} — Ad Set`,
      campaign_id: campaignRes.id,
      daily_budget: "500", // $5.00 placeholder — set before activating
      billing_event: "IMPRESSIONS",
      optimization_goal: "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: {
        age_min: 35,
        age_max: 65,
        geo_locations: { countries: ["US", "CA", "GB", "AU", "NZ"] },
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed"],
        instagram_positions: ["stream"],
        targeting_automation: { advantage_audience: 0 },
      },
      status: "PAUSED",
    },
    opts.accessToken
  );

  // Map CTA text to Meta enum value
  const ctaMap: Record<string, string> = {
    "Learn More": "LEARN_MORE",
    "Shop Now": "SHOP_NOW",
    "Get Offer": "GET_OFFER",
    "Sign Up": "SIGN_UP",
    "Book Now": "BOOK_TRAVEL",
  };
  const ctaEnum = ctaMap[opts.callToAction] ?? "LEARN_MORE";

  // Step 3: Creative
  const creativeRes = await metaPostAdv<{ id: string }>(
    `${actId}/adcreatives`,
    {
      name: `${opts.campaignName} — Creative`,
      object_story_spec: { page_id: opts.pageId },
      asset_feed_spec: {
        images: [{ hash: opts.imageHash }],
        bodies: [{ text: opts.primaryText }],
        titles: [{ text: opts.headline }],
        descriptions: [{ text: opts.description }],
        link_urls: [{ website_url: opts.landingUrl }],
        call_to_action_types: [ctaEnum],
        ad_formats: ["SINGLE_IMAGE"],
      },
    },
    opts.accessToken
  );

  // Step 4: Ad
  const adRes = await metaPostAdv<{ id: string }>(
    `${actId}/ads`,
    {
      name: `${opts.campaignName} — Ad`,
      adset_id: adSetRes.id,
      creative: { creative_id: creativeRes.id },
      status: "PAUSED",
    },
    opts.accessToken
  );

  return {
    campaignId: campaignRes.id,
    adSetId: adSetRes.id,
    creativeId: creativeRes.id,
    adId: adRes.id,
  };
}

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
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/47631630631066:1",
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
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/46719608946842:1",
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
    defaultCtaUrl: "https://theurbanmonkstore.myshopify.com/cart/48029578756250:1",
    defaultCtaText: "Get Your KBMO FIT22 Test →",
    defaultCtaSubtext: "$399 · At-home food sensitivity test kit with consultation",
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
<!-- NOTE: All styles are inline so Shopify's editor does not strip them -->

<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');fbq('track','ViewContent',{content_name:'${(page.slug||'').replace(/'/g,"\\'")  }',content_category:'${(page.topic||'').replace(/'/g,"\\'") }',content_type:'product'${variantId ? `,content_ids:['${variantId}']` : ""}});
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>

<div style="max-width:680px;margin:0 auto;padding:40px 20px 80px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.7;">

  <!-- Publication bar -->
  <div style="background:#1a1a1a;color:#fff;padding:10px 20px;margin:-20px -20px 32px;display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;">
    <div>
      <div style="font-size:14px;font-weight:700;letter-spacing:0.05em;">${page.publicationName || "The Urban Monk Insider"}</div>
      <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;">Health · Longevity · Ancient Wisdom</div>
    </div>
    <div style="font-size:10px;color:#aaa;border:1px solid #444;padding:2px 8px;border-radius:2px;text-transform:uppercase;letter-spacing:0.1em;">Sponsored</div>
  </div>

  <!-- Category + Headline -->
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c0392b;margin-bottom:14px;">Health &amp; Longevity</div>
  <h1 style="font-size:32px;font-weight:700;line-height:1.25;color:#111;margin-bottom:14px;font-family:Georgia,'Times New Roman',serif;">${page.headline || ""}</h1>
  ${page.subheadline ? `<div style="font-size:18px;color:#444;line-height:1.5;margin-bottom:22px;font-style:italic;">${page.subheadline}</div>` : ""}

  <!-- Byline -->
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#666;padding-bottom:18px;border-bottom:1px solid #e0e0e0;margin-bottom:26px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
    <span>By <strong style="font-weight:600;color:#333;">${page.authorName || "Dr. Pedram Shojai, OMD"}</strong></span>
    <span>${pubDate}</span>
    <span style="background:#f0f0f0;padding:2px 8px;border-radius:12px;font-size:11px;">${page.readTime || "3 min read"}</span>
  </div>

  <!-- Hero image -->
  ${page.heroImageUrl
    ? `<img src="${page.heroImageUrl}" alt="${page.headline || "Article header"}" style="width:100%;height:260px;object-fit:cover;border-radius:4px;margin-bottom:26px;display:block;" />`
    : `<div style="width:100%;height:260px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:4px;margin-bottom:26px;"></div>`
  }

  <!-- Body copy -->
  <div style="font-size:17px;line-height:1.82;color:#1a1a1a;">${page.bodyHtml || ""}</div>

  <!-- CTA box -->
  <div style="margin-top:40px;padding:30px 28px;background:#1a1a1a;border-radius:8px;text-align:center;color:#fff;">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:10px;color:#fff;font-family:Georgia,'Times New Roman',serif;">Ready to Experience the Difference?</h2>
    <p style="font-size:14px;color:#ccc;margin-bottom:22px;font-family:Arial,sans-serif;">${page.ctaSubtext || "Ships within 2 business days · 30-day money-back guarantee"}</p>
    <a href="${finalCtaUrl}" style="display:inline-block;background:#00d4ff;color:#000;font-family:Arial,sans-serif;font-weight:700;font-size:16px;padding:14px 32px;border-radius:4px;text-decoration:none;letter-spacing:0.02em;" onclick="typeof fbq!=='undefined'&&fbq('track','AddToCart'${variantId ? `,{content_ids:['${variantId}'],content_type:'product'}` : ""})">
      ${page.ctaText || "Add to Cart →"}
    </a>
    <div style="font-size:12px;color:#888;margin-top:10px;font-family:Arial,sans-serif;">Secure checkout · Free shipping on orders over $75</div>
  </div>

  <!-- Disclaimer -->
  <div style="margin-top:44px;padding-top:18px;border-top:1px solid #e0e0e0;font-family:Arial,sans-serif;font-size:11px;color:#999;line-height:1.6;">
    <strong>Disclosure:</strong> This is a sponsored editorial. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Individual results may vary. Consult your healthcare provider before use. Dr. Pedram Shojai, OMD is a licensed Doctor of Oriental Medicine.
  </div>

</div>`;
}

// ─── Bridge page HTML renderer (external domain) — CRO-optimized ─────────────
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
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_name: '${(page.slug || "").replace(/'/g, "\\'")}', content_category: '${(page.topic || "").replace(/'/g, "\\'")}' });
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>

  <!-- Google Fonts: matches Urban Monk store typography -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Cormorant Garamond', Georgia, serif; background: #ffffff; color: #1c1c1c; line-height: 1.8; font-size: 18px; }

    /* ── Progress bar ── */
    #read-progress { position: fixed; top: 0; left: 0; height: 3px; background: #e05c3a; width: 0%; z-index: 9999; transition: width 0.1s linear; }

    /* ── Sticky CTA bar (Fix #1) ── */
    .sticky-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1c1c1c; color: #fff; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 20px; z-index: 9000; box-shadow: 0 -2px 12px rgba(0,0,0,0.18); flex-wrap: wrap; }
    .sticky-bar-text { font-family: 'Montserrat', Arial, sans-serif; font-size: 13px; color: #ddd; }
    .sticky-bar-text strong { color: #fff; }
    .sticky-bar-btn { background: #e05c3a; color: #fff !important; font-family: 'Montserrat', Arial, sans-serif; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 3px; text-decoration: none !important; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
    .sticky-bar-guarantee { font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; color: #aaa; }
    @media (max-width: 600px) { .sticky-bar-text { display: none; } .sticky-bar { padding: 10px 16px; } }

    /* ── Minimal editorial header — no store nav (Fix #2) ── */
    .pub-header { background: #1c1c1c; color: #fff; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'Montserrat', Arial, sans-serif; }
    .pub-name { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .pub-tagline { font-size: 10px; color: #aaa; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px; }
    .sponsored-label { font-size: 9px; color: #e05c3a; text-transform: uppercase; letter-spacing: 0.12em; border: 1px solid #e05c3a; padding: 3px 10px; border-radius: 2px; font-family: 'Montserrat', Arial, sans-serif; font-weight: 600; }

    /* ── Article layout ── */
    .article-wrap { max-width: 700px; margin: 0 auto; padding: 44px 24px 120px; }
    .article-category { font-family: 'Montserrat', Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #e05c3a; margin-bottom: 18px; }
    h1.headline { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(30px, 5vw, 46px); font-weight: 700; line-height: 1.18; color: #1c1c1c; margin-bottom: 18px; }
    .subheadline { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 21px; color: #555; line-height: 1.55; margin-bottom: 26px; font-style: italic; }

    /* ── Byline with author photo (Fix: author photo) ── */
    .byline { font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #777; padding-bottom: 20px; border-bottom: 1px solid #e8e8e8; margin-bottom: 30px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .byline-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e8e8e8; flex-shrink: 0; }
    .byline-avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #e05c3a, #c94e2e); display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; font-weight: 700; flex-shrink: 0; }
    .byline .author { font-weight: 600; color: #444; }
    .byline .read-time { background: #f5f5f5; padding: 2px 10px; border-radius: 12px; font-size: 10px; letter-spacing: 0.05em; }

    /* ── Hero image (Fix #3) ── */
    .hero-img { width: 100%; height: clamp(220px, 40vw, 420px); object-fit: cover; border-radius: 4px; margin-bottom: 30px; display: block; }
    .hero-placeholder { width: 100%; height: clamp(220px, 40vw, 420px); background: linear-gradient(135deg, #f9f3ec 0%, #ede4d8 50%, #e0d0be 100%); border-radius: 4px; margin-bottom: 30px; display: flex; align-items: center; justify-content: center; }
    .hero-placeholder-text { font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; color: #b0a090; letter-spacing: 0.1em; text-transform: uppercase; }

    /* ── As Seen In (Fix #13) ── */
    .as-seen-in { margin: 0 0 32px; text-align: center; }
    .as-seen-in-label { font-family: 'Montserrat', Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #bbb; margin-bottom: 16px; }
    .as-seen-in-logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 20px 28px; }
    .as-seen-in-logos span { font-family: 'Montserrat', Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #999; opacity: 0.85; white-space: nowrap; }

    /* ── Body copy (Fix: 17-18px, 1.8 line height) ── */
    .body-copy p { margin-bottom: 24px; font-size: 18px; line-height: 1.82; }
    .body-copy h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 700; margin: 40px 0 14px; color: #e05c3a; border-left: 3px solid #e05c3a; padding-left: 14px; }
    .body-copy h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 21px; font-weight: 600; margin: 28px 0 10px; color: #2c2c2c; }
    .body-copy ul, .body-copy ol { margin: 16px 0 24px 28px; }
    .body-copy li { margin-bottom: 10px; font-size: 18px; line-height: 1.78; }
    .body-copy strong { color: #1c1c1c; font-weight: 600; }
    .body-copy blockquote { border-left: 4px solid #e05c3a; margin: 28px 0; padding: 16px 22px; background: #fdf8f5; font-style: italic; color: #555; font-size: 19px; line-height: 1.7; }

    /* ── Inline CTA text link (Fix #6) ── */
    .inline-cta { display: block; margin: 32px 0; padding: 18px 24px; background: #fdf8f5; border: 1px solid #f0e4d8; border-radius: 4px; text-align: center; font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #e05c3a !important; font-weight: 700; text-decoration: none !important; letter-spacing: 0.04em; }
    .inline-cta:hover { background: #f9ede3; }

    /* ── Testimonials (Fix #7) ── */
    .testimonials-section { margin: 44px 0; }
    .testimonials-label { font-family: 'Montserrat', Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #bbb; margin-bottom: 20px; text-align: center; }
    .testimonial-card { background: #fafafa; border: 1px solid #ebebeb; border-radius: 4px; padding: 22px 24px; margin-bottom: 16px; }
    .testimonial-stars { color: #e05c3a; font-size: 16px; margin-bottom: 10px; letter-spacing: 2px; }
    .testimonial-quote { font-size: 17px; line-height: 1.75; color: #333; margin-bottom: 14px; font-style: italic; }
    .testimonial-author { display: flex; align-items: center; gap: 10px; }
    .testimonial-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #e8ddd4, #d4c8bc); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', Arial, sans-serif; font-size: 13px; font-weight: 700; color: #888; flex-shrink: 0; }
    .testimonial-name { font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; font-weight: 600; color: #444; }
    .testimonial-location { font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; color: #999; }

    /* ── Mid-page CTA box (Fix #8) ── */
    .mid-cta { margin: 44px 0; padding: 30px 28px; background: linear-gradient(135deg, #1c1c1c 0%, #2e2e2e 100%); border-radius: 6px; text-align: center; }
    .mid-cta h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 10px; }
    .mid-cta p { font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #ccc; margin-bottom: 20px; line-height: 1.6; }
    .mid-cta .cta-btn { font-size: 14px; padding: 13px 30px; }
    .mid-cta-subtext { font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; color: #888; margin-top: 10px; }

    /* ── Bottom CTA section (Fix #4, #5) ── */
    .cta-section { margin-top: 44px; padding: 40px 36px; background: #f9f5f0; border: 1px solid #e8ddd4; border-radius: 6px; text-align: center; }
    .cta-section h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #1c1c1c; }
    .cta-section .cta-subheadline { font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #777; margin-bottom: 20px; line-height: 1.6; }
    .star-rating { font-size: 22px; color: #e05c3a; letter-spacing: 3px; margin-bottom: 4px; }
    .review-count { font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #888; margin-bottom: 24px; }
    .cta-btn { display: inline-block; background: #e05c3a; color: #fff !important; font-family: 'Montserrat', Arial, sans-serif; font-weight: 700; font-size: 16px; padding: 16px 40px; border-radius: 3px; text-decoration: none !important; letter-spacing: 0.06em; text-transform: uppercase; }
    .cta-btn:hover { background: #c94e2e; color: #fff !important; }
    .cta-subtext { font-size: 12px; color: #999; margin-top: 14px; font-family: 'Montserrat', Arial, sans-serif; }
    /* Guarantee badge (Fix #4) */
    .guarantee-badge { display: inline-flex; align-items: center; gap: 10px; margin-top: 18px; padding: 12px 20px; border: 1px solid #d4c8bc; border-radius: 4px; background: #fff; }
    .guarantee-icon { font-size: 22px; }
    .guarantee-text { font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #555; text-align: left; line-height: 1.5; }
    .guarantee-text strong { color: #1c1c1c; display: block; font-size: 13px; }
    /* Urgency (Fix #15) */
    .urgency-note { font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #c94e2e; font-weight: 600; margin-bottom: 20px; letter-spacing: 0.02em; }

    /* ── Author bio (Fix #9) ── */
    .author-bio { margin: 44px 0; padding: 28px 28px; background: #fafafa; border: 1px solid #ebebeb; border-radius: 4px; display: flex; gap: 20px; align-items: flex-start; }
    .author-bio-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #e05c3a, #c94e2e); display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Montserrat', Arial, sans-serif; font-size: 22px; font-weight: 700; flex-shrink: 0; }
    .author-bio-content h4 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 700; color: #1c1c1c; margin-bottom: 4px; }
    .author-bio-content .author-title { font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; color: #e05c3a; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
    .author-bio-content p { font-size: 15px; color: #555; line-height: 1.7; margin: 0; }
    @media (max-width: 500px) { .author-bio { flex-direction: column; } }

    /* ── FAQ section (Fix: addresses objections) ── */
    .faq-section { margin: 44px 0; }
    .faq-section h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 700; color: #1c1c1c; margin-bottom: 20px; }
    .faq-item { border-bottom: 1px solid #ebebeb; padding: 16px 0; }
    .faq-q { font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #1c1c1c; margin-bottom: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .faq-q::after { content: '+'; font-size: 18px; color: #e05c3a; font-weight: 400; }
    .faq-q.open::after { content: '−'; }
    .faq-a { font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #555; line-height: 1.7; display: none; padding-top: 4px; }
    .faq-a.open { display: block; }

    /* ── Disclaimer ── */
    .disclaimer { margin-top: 52px; padding-top: 22px; border-top: 1px solid #ebebeb; font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; color: #aaa; line-height: 1.7; }

    @media (max-width: 600px) {
      .article-wrap { padding: 28px 18px 120px; }
      h1.headline { font-size: 28px; }
      .cta-section { padding: 28px 18px; }
      .mid-cta { padding: 24px 18px; }
      .guarantee-badge { flex-direction: column; text-align: center; }
    }
  </style>
</head>
<body>
  <!-- Reading progress bar -->
  <div id="read-progress"></div>

  <!-- Minimal editorial header — no store navigation (Fix #2) -->
  <div class="pub-header">
    <div>
      <div class="pub-name">${page.publicationName || "The Urban Monk Insider"}</div>
      <div class="pub-tagline">Health · Longevity · Ancient Wisdom</div>
    </div>
    <div class="sponsored-label">Sponsored Content</div>
  </div>

  <!-- Sticky CTA bar (Fix #1) -->
  <div class="sticky-bar" id="sticky-bar">
    <span class="sticky-bar-text"><strong>${page.ctaText || "Get Your Orobiome Test"}</strong> — Results in 2–3 weeks</span>
    <a href="${page.ctaUrl || "https://shop.theurbanmonk.com"}" class="sticky-bar-btn" onclick="typeof fbq!=='undefined'&&fbq('track','Lead')">
      ${page.ctaText || "Order Now →"}
    </a>
    <span class="sticky-bar-guarantee">🔒 30-Day Guarantee</span>
  </div>

  <div class="article-wrap">
    <div class="article-category">Health &amp; Longevity</div>
    <h1 class="headline">${page.headline || ""}</h1>
    ${page.subheadline ? `<div class="subheadline">${page.subheadline}</div>` : ""}

    <!-- Byline with author avatar (Fix: author photo) -->
    <div class="byline">
      <div class="byline-avatar-placeholder">PS</div>
      <div>
        <div>By <span class="author">${page.authorName || "Dr. Pedram Shojai, OMD"}</span></div>
        <div style="font-size:11px;color:#aaa;margin-top:2px;">Doctor of Oriental Medicine · Founder, The Urban Monk</div>
      </div>
      <span>${pubDate}</span>
      <span class="read-time">${page.readTime || "5 min read"}</span>
    </div>

    <!-- Hero image (Fix #3) -->
    ${(page.heroImageUrl || (page.topic === 'orobiome' ? 'https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/orobiome-hero-ZCUZwYhXHosbVwqbwAuRaX.png' : null))
      ? `<img class="hero-img" src="${page.heroImageUrl || 'https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/orobiome-hero-ZCUZwYhXHosbVwqbwAuRaX.png'}" alt="${(page.headline || 'Article header').replace(/"/g, '&quot;')}" />`
      : `<div class="hero-placeholder" style="background:linear-gradient(135deg,#1c1c1c 0%,#2e2e2e 50%,#1c1c1c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;"><span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#e05c3a;">The Urban Monk</span><span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(22px,4vw,36px);font-weight:600;color:#f5f0ea;letter-spacing:0.04em;text-align:center;padding:0 24px;">Insider</span><span style="width:40px;height:2px;background:#e05c3a;"></span></div>`
    }

    <!-- As Seen In logos (Fix #13) -->
    <div class="as-seen-in">
      <div class="as-seen-in-label">As Seen In</div>
      <div class="as-seen-in-logos">
        <span>TODAY</span>
        <span>well+good</span>
        <span>Dr. Oz Show</span>
        <span>New York Magazine</span>
        <span>ESPN</span>
        <span>mindbodygreen</span>
        <span>ABC News</span>
        <span>Women's Health</span>
      </div>
    </div>

    <!-- Body copy -->
    <div class="body-copy">${page.bodyHtml || ""}</div>

    <!-- Inline CTA #1 — appears after ~400 words (Fix #6) -->
    <a href="${page.ctaUrl || "https://shop.theurbanmonk.com"}" class="inline-cta" onclick="typeof fbq!=='undefined'&&fbq('track','Lead')">
      → ${page.ctaText || "Take the Orobiome Test"} — Find out what's living in your mouth
    </a>

    <!-- Testimonials (Fix #7) -->
    <div class="testimonials-section">
      <div class="testimonials-label">What Our Customers Are Saying</div>

      <div class="testimonial-card">
        <div class="testimonial-stars">★★★★★</div>
        <div class="testimonial-quote">"I'd been struggling with brain fog and fatigue for years. My doctor ran every test imaginable and found nothing. After doing the Orobiome test, we discovered a significant imbalance I never would have known about. Six weeks later my energy is back and the fog has lifted. I'm genuinely shocked."</div>
        <div class="testimonial-author">
          <div class="testimonial-avatar">MR</div>
          <div>
            <div class="testimonial-name">Michael R.</div>
            <div class="testimonial-location">Austin, TX · Verified Purchase</div>
          </div>
        </div>
      </div>

      <div class="testimonial-card">
        <div class="testimonial-stars">★★★★★</div>
        <div class="testimonial-quote">"The connection between my oral health and my chronic inflammation never occurred to me. The test was simple, the results were eye-opening, and the protocol Dr. Shojai's team recommended has made a real difference. My dentist is now asking me about it."</div>
        <div class="testimonial-author">
          <div class="testimonial-avatar">SL</div>
          <div>
            <div class="testimonial-name">Sarah L.</div>
            <div class="testimonial-location">Denver, CO · Verified Purchase</div>
          </div>
        </div>
      </div>

      <div class="testimonial-card">
        <div class="testimonial-stars">★★★★★</div>
        <div class="testimonial-quote">"As a functional medicine practitioner, I've been recommending the Orobiome test to my patients for months. The data it provides is unlike anything else available — it's become a foundational piece of my intake protocol."</div>
        <div class="testimonial-author">
          <div class="testimonial-avatar">DK</div>
          <div>
            <div class="testimonial-name">Dr. Karen D., FMD</div>
            <div class="testimonial-location">San Francisco, CA · Verified Purchase</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mid-page CTA box (Fix #8) -->
    <div class="mid-cta">
      <h3>Ready to See Your Oral Blueprint?</h3>
      <p>Join thousands of people who have discovered the hidden driver behind their chronic symptoms.</p>
      <a href="${page.ctaUrl || "https://shop.theurbanmonk.com"}" class="cta-btn" onclick="typeof fbq!=='undefined'&&fbq('track','Lead')">
        ${page.ctaText || "Get Your Orobiome Test →"}
      </a>
      <div class="mid-cta-subtext">Results in 2–3 weeks · 30-day satisfaction guarantee</div>
    </div>

    <!-- Inline CTA #2 (Fix #6) -->
    <a href="${page.ctaUrl || "https://shop.theurbanmonk.com"}" class="inline-cta" onclick="typeof fbq!=='undefined'&&fbq('track','Lead')">
      → Still reading? Your oral microbiome results are waiting — ${page.ctaText || "Order the Test"}
    </a>

    <!-- Author bio (Fix #9) -->
    <div class="author-bio">
      <div class="author-bio-avatar">PS</div>
      <div class="author-bio-content">
        <h4>Dr. Pedram Shojai, OMD</h4>
        <div class="author-title">Doctor of Oriental Medicine · NY Times Bestselling Author</div>
        <p>Dr. Shojai is the founder of The Urban Monk Academy, a New York Times bestselling author, and a licensed Doctor of Oriental Medicine with over 20 years of clinical experience. He has been featured on TODAY, Dr. Oz, ABC, ESPN, New York Magazine, well+good, mindbodygreen, and Women's Health. His mission is to bridge ancient wisdom with modern science to help people reclaim their vitality.</p>
      </div>
    </div>

    <!-- FAQ section (addresses purchase objections) -->
    <div class="faq-section">
      <h3>Frequently Asked Questions</h3>

      <div class="faq-item">
        <div class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">How does the Orobiome test work?</div>
        <div class="faq-a">The test uses a simple at-home swab collection. You receive a kit in the mail, collect a sample, and return it in the prepaid envelope. Results are delivered digitally within 2–3 weeks, along with a personalized protocol based on your findings.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">Is this a medical diagnosis?</div>
        <div class="faq-a">No. The Orobiome test is a wellness assessment, not a medical diagnostic. The results provide information about your oral microbiome composition. We always recommend discussing your results with your healthcare provider, especially if you have existing health conditions.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">What if I'm not satisfied with my results?</div>
        <div class="faq-a">We stand behind every test with a 30-day satisfaction guarantee. If you're not satisfied for any reason, contact our support team and we'll make it right — no questions asked.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">How is this different from a regular dental checkup?</div>
        <div class="faq-a">A standard dental exam checks for cavities, gum disease, and structural issues. The Orobiome test analyzes the specific bacterial species present in your oral microbiome at a genomic level — information that no visual exam or standard dental X-ray can provide.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">How quickly will I receive my kit?</div>
        <div class="faq-a">Your collection kit ships within 1–2 business days. Free shipping is included on all orders. Once your sample is received at the lab, results are typically ready within 2–3 weeks.</div>
      </div>
    </div>

    <!-- Bottom CTA section with star rating + guarantee (Fix #4, #5) -->
    <div class="cta-section">
      <div class="star-rating">★★★★★</div>
      <div class="review-count">4.8 out of 5 · Based on 1,200+ verified reviews</div>
      <h2>${page.headline ? "Ready to Find Out What's Really Going On?" : "Take the Orobiome Test"}</h2>
      <div class="cta-subheadline">${page.ctaSubtext || "At-home collection kit · Results in 2–3 weeks · Personalized protocol included"}</div>
      <div class="urgency-note">⚡ Limited kits available — ships within 1–2 business days</div>
      <a href="${page.ctaUrl || "https://shop.theurbanmonk.com"}" class="cta-btn" onclick="typeof fbq!=='undefined'&&fbq('track','Lead')">
        ${page.ctaText || "Get Your Orobiome Test →"}
      </a>
      <div class="cta-subtext">Secure checkout · Free shipping on orders over $75</div>
      <div style="display:flex;justify-content:center;margin-top:16px;">
        <div class="guarantee-badge">
          <span class="guarantee-icon">🛡️</span>
          <div class="guarantee-text">
            <strong>30-Day Satisfaction Guarantee</strong>
            Not satisfied? We'll make it right — no questions asked.
          </div>
        </div>
      </div>
    </div>

    <div class="disclaimer">
      <strong>Disclosure:</strong> This is a sponsored editorial. The information provided is for educational purposes only and is not intended as medical advice. Individual results may vary. Consult your healthcare provider before making any changes to your health regimen. Dr. Pedram Shojai, OMD is a licensed Doctor of Oriental Medicine. These statements have not been evaluated by the Food and Drug Administration.
    </div>
  </div>

  <script>
    // Reading progress bar
    window.addEventListener('scroll', function() {
      var el = document.getElementById('read-progress');
      if (!el) return;
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      el.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
    });

    // First-Party Attribution: capture UTM params + fbclid on page load
    (function() {
      var params = new URLSearchParams(window.location.search);
      var utmSource = params.get('utm_source');
      var utmMedium = params.get('utm_medium');
      var utmCampaign = params.get('utm_campaign');
      var utmContent = params.get('utm_content');
      var utmTerm = params.get('utm_term');
      var fbclid = params.get('fbclid');
      if (!utmSource && !fbclid && !utmCampaign) return;
      var existingToken = sessionStorage.getItem('_um_click_token');
      if (existingToken) {
        appendTokenToCtaLinks(existingToken);
        return;
      }
      fetch('/api/attribution/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utmSource: utmSource,
          utmMedium: utmMedium,
          utmCampaign: utmCampaign,
          utmContent: utmContent,
          utmTerm: utmTerm,
          fbclid: fbclid,
          advertorialSlug: '${(page.slug || "").replace(/'/g, "\'")}',
          advertorialId: ${page.id || 0}
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.clickToken) {
          sessionStorage.setItem('_um_click_token', data.clickToken);
          appendTokenToCtaLinks(data.clickToken);
        }
      })
      .catch(function() {});
      function appendTokenToCtaLinks(token) {
        var ctaLinks = document.querySelectorAll('a[href*="shop.theurbanmonk.com"], a[href*="theurbanmonkstore.myshopify.com"]');
        ctaLinks.forEach(function(link) {
          try {
            var url = new URL(link.href);
            url.searchParams.set('_um_ct', token);
            link.href = url.toString();
          } catch(e) {}
        });
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * renderShopifySafeHtml — full CRO advertorial with styles injected via <script>
 * Shopify's editor strips <style> tags but not <script> tags, so we embed all
 * CSS inside a JS snippet that dynamically creates a <style> element at runtime.
 */
export function renderShopifySafeHtml(page: AdvertorialPage): string {
  const fullHtml = renderAdvertorialHtml(page);
  // Extract the <style> block
  const styleMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/);
  const css = styleMatch ? styleMatch[1] : '';
  // Extract Google Fonts link href
  const fontMatch = fullHtml.match(/href=["'](https:\/\/fonts\.googleapis\.com\/css2[^"']+)["']/);
  const fontHref = fontMatch
    ? fontMatch[1]
    : 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Montserrat:wght@400;500;600;700&display=swap';
  // Escape CSS for JS template literal
  const cssEscaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  // Build the style injector script (uses string concat to avoid TS template literal issues)
  const styleInjector = [
    '<script>',
    '(function() {',
    '  var style = document.createElement(\'style\');',
    '  style.textContent = `' + cssEscaped + '`;',
    '  document.head.appendChild(style);',
    '  var l1 = document.createElement(\'link\');',
    '  l1.rel = \'preconnect\'; l1.href = \'https://fonts.googleapis.com\';',
    '  document.head.appendChild(l1);',
    '  var l2 = document.createElement(\'link\');',
    '  l2.rel = \'preconnect\'; l2.href = \'https://fonts.gstatic.com\'; l2.crossOrigin = \'anonymous\';',
    '  document.head.appendChild(l2);',
    '  var l3 = document.createElement(\'link\');',
    '  l3.rel = \'stylesheet\';',
    `  l3.href = '${fontHref}';`,
    '  document.head.appendChild(l3);',
    '})();',
    '<\/script>',
  ].join('\n');
  // Strip <html>, <head>, <body> wrappers and the <style> block (Shopify provides those)
  const body = fullHtml
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g, '')
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '')
    .trim();
  return styleInjector + '\n' + body;
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
        generationPrompt: advertorialPages.generationPrompt,
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

  // Lightweight summary — only returns fields needed for MetaAds page header (no bodyHtml)
  getSummary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db
        .select({
          id: advertorialPages.id,
          headline: advertorialPages.headline,
          topic: advertorialPages.topic,
          status: advertorialPages.status,
          ctaUrl: advertorialPages.ctaUrl,
        })
        .from(advertorialPages)
        .where(eq(advertorialPages.id, input.id));
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
        html: renderShopifySafeHtml(page),
        shopifyAdminUrl: `https://admin.shopify.com/store/theurbanmonkstore/pages`,
        pageUrl: `https://shop.theurbanmonk.com/pages/${page.slug}`,
        instructions: [
          "1. Go to Shopify Admin → Online Store → Pages",
          `2. Find the page with handle: ${page.slug} (or create a new one)`,
          "3. Click the </> (HTML) button in the content editor",
          "4. Select all existing content and delete it",
          "5. Paste the HTML below into the editor",
          "6. Click Save",
          `7. Your page will be live at: https://shop.theurbanmonk.com/pages/${page.slug}`,
          "8. Styles are embedded in a <script> tag — Shopify cannot strip them",
          "9. Use this URL as your Meta ad destination — the CTA goes directly to Shopify checkout",
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

  // ─── Meta Ad Variants ─────────────────────────────────────────────────────
  generateMetaAds: protectedProcedure
    .input(z.object({ advertorialId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.advertorialId));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Advertorial not found" });

      const topicConfig = TOPIC_CONFIGS[page.topic];
      const topicLabel = topicConfig?.label || page.topic;
      const offer = topicConfig?.offer || page.headline || "";
      const ctaUrl = page.ctaUrl || topicConfig?.defaultCtaUrl || "";

      const systemPrompt = `You are a world-class Meta (Facebook/Instagram) ad copywriter for Dr. Pedram Shojai's Urban Monk brand.
You write high-converting ad copy for cold traffic that drives clicks to native advertorial bridge pages.
The brand voice is: authoritative but warm, ancient wisdom meets modern science, never hype-y or salesy.
Dr. Shojai is a Doctor of Oriental Medicine, bestselling author, and former Taoist monk.
The ads run as single-image or carousel ads on Facebook and Instagram.`;

      const userPrompt = `Generate 5 distinct Meta ad variants for this advertorial:

TOPIC: ${topicLabel}
HEADLINE: ${page.headline || ""}
SUBHEADLINE: ${page.subheadline || ""}
OFFER: ${offer}
CTA URL: ${ctaUrl}
MECHANISM: ${page.mechanismAngle || topicConfig?.mechanism || ""}

For each variant, create a different angle:
- Variant 1: Pain-point hook (agitate the problem)
- Variant 2: Curiosity/mechanism hook (the surprising root cause)
- Variant 3: Social proof / authority hook (Dr. Shojai's credentials + results)
- Variant 4: Transformation hook (before/after emotional journey)
- Variant 5: Direct offer hook (clear value proposition, price if applicable)

Return a JSON array of exactly 5 objects. Each object must have:
- primaryText: string (125 chars ideal, max 200 — the main ad body above the image)
- headline: string (max 40 chars — bold text below the image)
- description: string (max 30 chars — optional subtext below headline)
- callToAction: string (one of: "Learn More", "Shop Now", "Get Offer", "Sign Up", "Book Now")
- imagePrompt: string (detailed DALL-E / Midjourney prompt for a compelling ad image — no text in image)
- audienceNote: string (brief note on who this variant targets best, e.g. "Women 40-55 interested in gut health")`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meta_ad_variants",
            strict: true,
            schema: {
              type: "object",
              properties: {
                variants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      primaryText: { type: "string" },
                      headline: { type: "string" },
                      description: { type: "string" },
                      callToAction: { type: "string" },
                      imagePrompt: { type: "string" },
                      audienceNote: { type: "string" },
                    },
                    required: ["primaryText", "headline", "description", "callToAction", "imagePrompt", "audienceNote"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["variants"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      const variants: Array<{
        primaryText: string;
        headline: string;
        description: string;
        callToAction: string;
        imagePrompt: string;
        audienceNote: string;
      }> = parsed.variants;

      // Delete any existing variants for this advertorial before inserting new ones
      await db.delete(metaAdVariants).where(eq(metaAdVariants.advertorialId, input.advertorialId));

      const now = Date.now();
      const rows = variants.map((v, i) => ({
        advertorialId: input.advertorialId,
        variantNumber: i + 1,
        primaryText: v.primaryText,
        headline: v.headline,
        description: v.description || null,
        callToAction: v.callToAction || "Learn More",
        imagePrompt: v.imagePrompt || null,
        audienceNote: v.audienceNote || null,
        status: "draft" as const,
        createdAt: now,
        updatedAt: now,
      }));

      await db.insert(metaAdVariants).values(rows);

      const saved = await db.select().from(metaAdVariants).where(eq(metaAdVariants.advertorialId, input.advertorialId));
      return saved;
    }),

  listMetaAds: protectedProcedure
    .input(z.object({ advertorialId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return await db.select().from(metaAdVariants).where(eq(metaAdVariants.advertorialId, input.advertorialId));
    }),

  updateMetaAdStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "approved", "running", "paused", "archived"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(metaAdVariants).set({ status: input.status, updatedAt: Date.now() }).where(eq(metaAdVariants.id, input.id));
      const [updated] = await db.select().from(metaAdVariants).where(eq(metaAdVariants.id, input.id));
      return updated;
    }),

  // ─── Generate image + push full ad to Meta Ads Manager (PAUSED draft) ──────────────────
  generateImageAndPushToMeta: protectedProcedure
    .input(z.object({ variantId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // 1. Fetch the variant
      const [variant] = await db.select().from(metaAdVariants).where(eq(metaAdVariants.id, input.variantId));
      if (!variant) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
      if (!variant.imagePrompt) throw new TRPCError({ code: "BAD_REQUEST", message: "Variant has no imagePrompt" });

      // 2. Get Meta credentials
      let config: ReturnType<typeof getMetaAdsConfig>;
      try {
        config = getMetaAdsConfig();
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Meta credentials missing: ${err.message}` });
      }

      const pageId = process.env.META_PAGE_ID ?? "";
      if (!pageId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "META_PAGE_ID is not set" });

      // 3. Generate the ad image (focus on anonymous health struggle, not user likeness)
      const imagePrompt = variant.imagePrompt as string; // null check done above
      let imageUrl: string;
      try {
        const result = await generateImage({ prompt: imagePrompt });
        if (!result.url) throw new Error("generateImage returned no URL");
        imageUrl = result.url;
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Image generation failed: ${err.message}` });
      }

      // 4. Upload image to Meta ad image library → get imageHash
      let imageHash: string;
      try {
        imageHash = await uploadImageToMeta(imageUrl, config.adAccountId, config.accessToken);
      } catch (err: any) {
        // Store imageUrl even if Meta upload fails, so it’s not lost
        await db.update(metaAdVariants).set({
          imageUrl,
          metaPushError: `Meta image upload failed: ${err.message}`,
          updatedAt: Date.now(),
        }).where(eq(metaAdVariants.id, input.variantId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Meta image upload failed: ${err.message}` });
      }

      // 5. Persist imageUrl + imageHash before creating the ad (so we don’t lose them on failure)
      await db.update(metaAdVariants).set({
        imageUrl,
        imageHash,
        updatedAt: Date.now(),
      }).where(eq(metaAdVariants.id, input.variantId));

      // 6. Fetch the parent advertorial for campaign naming
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, variant.advertorialId));
      const topicLabel = page?.topic ? (TOPIC_CONFIGS[page.topic]?.label ?? page.topic) : "Urban Monk";
      const campaignName = `UM — ${topicLabel} — V${variant.variantNumber} — ${variant.headline.slice(0, 40)}`;

      // 7. Create PAUSED ad in Meta Ads Manager
      let metaIds: { campaignId: string; adSetId: string; creativeId: string; adId: string };
      try {
        metaIds = await createPausedMetaAd({
          campaignName,
          imageHash,
          primaryText: variant.primaryText,
          headline: variant.headline,
          description: variant.description ?? "",
          callToAction: variant.callToAction,
          landingUrl: page?.ctaUrl ?? ADVERTORIAL_LANDING_URL,
          adAccountId: config.adAccountId,
          accessToken: config.accessToken,
          pageId,
        });
      } catch (err: any) {
        await db.update(metaAdVariants).set({
          metaPushError: err.message,
          updatedAt: Date.now(),
        }).where(eq(metaAdVariants.id, input.variantId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Meta ad creation failed: ${err.message}` });
      }

      // 8. Update DB with all Meta IDs
      await db.update(metaAdVariants).set({
        metaCampaignId: metaIds.campaignId,
        metaAdSetId: metaIds.adSetId,
        metaCreativeId: metaIds.creativeId,
        metaAdId: metaIds.adId,
        status: "paused",
        metaPushError: null,
        metaPushedAt: Date.now(),
        updatedAt: Date.now(),
      }).where(eq(metaAdVariants.id, input.variantId));

      const adsManagerUrl = `https://www.facebook.com/adsmanager/manage/campaigns?act=${config.adAccountId}&campaign_ids=${metaIds.campaignId}`;

      return {
        success: true,
        imageUrl,
        imageHash,
        metaAdId: metaIds.adId,
        metaCampaignId: metaIds.campaignId,
        adsManagerUrl,
      };
    }),
});
