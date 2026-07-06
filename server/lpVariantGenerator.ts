/**
 * LP Variant Generator — Auto-generates CRO-optimized landing page variants
 * when a high-CTR / low-convert gap is detected in Meta Ads.
 *
 * Triggered by runDailyAdsSync when:
 *   - Campaign CTR >= 8%
 *   - Purchases = 0
 *   - Spend > $50
 *
 * The generator:
 * 1. Infers the ad angle from the campaign/adset name
 * 2. Generates a new advertorial copy variant via LLM, matching the ad hook
 * 3. Saves it to the advertorial_pages table with status="draft"
 * 4. Returns the new page record for notification
 */

import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { advertorialPages } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Topic inference from campaign/adset name ─────────────────────────────────
function inferTopicFromCampaignName(campaignName: string, adsetName: string): {
  topic: string;
  angle: string;
  targetAudience: string;
} {
  const combined = `${campaignName} ${adsetName}`.toLowerCase();

  // Gut health / oral biome signals
  if (combined.match(/gut|biome|digestive|microbiome|oral|bacteria|probiotic/)) {
    return {
      topic: "gut_health",
      angle: "The hidden oral-gut axis: how the bacteria in your mouth are silently programming your digestive health",
      targetAudience: "health-conscious adults 45-65 with chronic digestive issues who've tried everything",
    };
  }

  // Energy / fatigue signals
  if (combined.match(/energy|fatigue|tired|exhausted|vitality|adrenal|cortisol/)) {
    return {
      topic: "energy",
      angle: "Mitochondrial dysfunction from chronic immune activation — why your cells can't make energy even when you sleep 8 hours",
      targetAudience: "high-performing professionals 40-65 who feel exhausted despite doing everything right",
    };
  }

  // Sleep signals
  if (combined.match(/sleep|insomnia|rest|recovery|melatonin|circadian/)) {
    return {
      topic: "sleep",
      angle: "The organ clock disruption pattern — why ancient Chinese medicine predicted your 3am wake-ups 2,000 years ago",
      targetAudience: "adults 45-65 who wake up between 1-3am and can't fall back asleep",
    };
  }

  // Stress / anxiety signals
  if (combined.match(/stress|anxiety|overwhelm|cortisol|nervous|calm|monk/)) {
    return {
      topic: "stress",
      angle: "The HPA axis dysregulation loop — why modern stress management advice makes chronic stress worse",
      targetAudience: "high-achieving professionals 40-65 who feel wired-but-tired and can't shut off their mind",
    };
  }

  // Inflammation / immune signals
  if (combined.match(/inflam|immune|autoimmune|pain|joint|arthritis/)) {
    return {
      topic: "inflammation",
      angle: "Leaky gut as the master switch — the hidden intestinal permeability pattern driving systemic inflammation",
      targetAudience: "adults 45-65 with chronic inflammation, joint pain, or autoimmune conditions",
    };
  }

  // Default: gut health (most common for Orobiome)
  return {
    topic: "gut_health",
    angle: "The oral microbiome connection — why your gut health problems start in your mouth, not your stomach",
    targetAudience: "health-conscious adults 45-65 who have tried probiotics and diets but still feel off",
  };
}

// ── Slug generator ────────────────────────────────────────────────────────────
function generateSlug(campaignName: string, adsetName: string): string {
  const base = `${campaignName}-${adsetName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
  const timestamp = Date.now().toString(36); // short unique suffix
  return `${base}-v${timestamp}`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateLpVariantForCampaign(params: {
  campaignName: string;
  adsetName: string;
  ctr: number;
  spendCents: number;
}): Promise<{ id: number; slug: string; headline: string | null }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const { topic, angle, targetAudience } = inferTopicFromCampaignName(
    params.campaignName,
    params.adsetName
  );

  // Build a campaign-specific prompt that matches the ad angle
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

TOPIC: ${topic}
MECHANISM ANGLE: ${angle}
TARGET AUDIENCE: ${targetAudience}
SOURCE AD CAMPAIGN: "${params.campaignName}" / "${params.adsetName}"
CONTEXT: This ad set has a ${params.ctr.toFixed(1)}% CTR (exceptional) but zero purchases — the ad hook is working perfectly but the landing page isn't matching the promise. Write copy that directly continues the conversation the ad started, matching the emotional state of someone who clicked because they recognized the problem.

OFFER: Orobiome Oral Microbiome Test ($399) — a comprehensive at-home test that analyzes 50+ oral bacteria species and provides a personalized protocol
CTA: "Take the Orobiome Test" linking to https://shop.theurbanmonk.com/products/orobiome-oral-microbiome-test

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
  const copy = typeof content === "string" ? JSON.parse(content) : content;

  const slug = generateSlug(params.campaignName, params.adsetName);
  const now = Date.now();

  const [result] = await db.insert(advertorialPages).values({
    slug,
    topic,
    campaign: `${params.campaignName} / ${params.adsetName}`,
    status: "draft",
    publicationName: "The Urban Monk Insider",
    authorName: "Dr. Pedram Shojai, OMD",
    readTime: "3 min read",
    headline: copy.headline,
    subheadline: copy.subheadline,
    mechanismAngle: copy.mechanismAngle,
    bodyHtml: copy.bodyHtml,
    ctaText: "Take the Orobiome Test →",
    ctaSubtext: `CTR ${params.ctr.toFixed(1)}% — auto-generated variant for "${params.adsetName}"`,
    ctaUrl: "https://shop.theurbanmonk.com/products/orobiome-oral-microbiome-test",
    metaTitle: copy.metaTitle,
    metaDescription: copy.metaDescription,
    metaPixelId: "1498608757116877",
    ga4Id: "G-CXZK2Q275S",
    generationPrompt: `auto-variant topic:${topic} angle:${angle} campaign:"${params.campaignName}" adset:"${params.adsetName}" ctr:${params.ctr.toFixed(1)}%`,
    generationModel: "default",
    createdAt: now,
    updatedAt: now,
  });

  const insertId = (result as any).insertId;
  const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, insertId));

  return { id: page.id, slug: page.slug, headline: page.headline };
}
