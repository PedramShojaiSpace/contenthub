/**
 * hookAbTestLauncher.ts
 * 
 * Creates a Meta A/B test campaign with one ad per hook variant.
 * Each ad uses the same video creative but different hook text overlays
 * (via ad copy / primary text differences) so Meta can test which hook
 * drives the best CTR and CPL.
 * 
 * Structure:
 *   Campaign: "Hook Test — [Topic] — [Date]" (PAUSED, manual activation)
 *   └── Ad Set: "Cold — [Age] — [Interests]" ($X/day budget)
 *       └── Ad 1: Hook A (contradiction)
 *       └── Ad 2: Hook B (curiosityGap)
 *       └── Ad 3: Hook C (specificity)
 *       └── Ad 4: Hook D (directChallenge)
 *       └── Ad 5: Hook E (repFormula)
 * 
 * Note: Meta's native split-test requires identical budgets per variant.
 * We use a single ad set with multiple ads — Meta's delivery system
 * naturally allocates spend toward better performers (Advantage+ delivery).
 * 
 * For true isolated testing, each hook gets its own ad set at $3-5/day.
 */

import { getDb } from "./db";
import { hookAbTests } from "../drizzle/schema";
import type { HookVariant, TargetProduct } from "./hookGenerator";

const META_API_BASE = "https://graph.facebook.com/v21.0";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.META_AD_ACCESS_TOKEN;

// Product → Landing page URL mapping
const PRODUCT_URLS: Record<TargetProduct, string> = {
  lightsOn: "https://lightson.theurbanmonk.com?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  academy: "https://theurbanmonk.com/academy?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  upstream: "https://upstream.theurbanmonk.com?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  kbmoTesting: "https://theurbanmonk.com/testing?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  general: "https://theurbanmonk.com?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
};

// Default cold audience targeting for Urban Monk
const DEFAULT_TARGETING = {
  age_min: 35,
  age_max: 65,
  genders: [0], // all genders
  geo_locations: {
    countries: ["US", "CA", "GB", "AU"],
  },
  flexible_spec: [
    {
      interests: [
        { id: "6003139266461", name: "Health" },
        { id: "6003020834693", name: "Wellness" },
        { id: "6003107902433", name: "Meditation" },
        { id: "6003195167424", name: "Mindfulness" },
        { id: "6003348604981", name: "Yoga" },
      ],
    },
  ],
  publisher_platforms: ["facebook", "instagram"],
  facebook_positions: ["feed"],
  instagram_positions: ["stream"],
  device_platforms: ["mobile"],
};

export interface HookAbTestConfig {
  topic: string;
  targetProduct: TargetProduct;
  variants: HookVariant[];
  videoUrl: string;           // S3 URL of the video to use as creative
  dailyBudgetPerVariant: number; // in USD, e.g. 5 for $5/day
  testDurationDays: number;   // e.g. 5
  hookGenerationId: number;   // FK to hookGenerations table
}

export interface HookAbTestResult {
  campaignId: string;
  adSetIds: string[];
  adIds: string[];
  metaAdsManagerUrl: string;
  estimatedTotalDailyBudget: number;
  estimatedTotalTestCost: number;
}

async function metaPost(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `${META_API_BASE}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: ACCESS_TOKEN }),
  });
  const data = await res.json() as Record<string, unknown>;
  if ((data as any).error) {
    throw new Error(`Meta API error: ${JSON.stringify((data as any).error)}`);
  }
  return data;
}

export async function launchHookAbTest(
  config: HookAbTestConfig
): Promise<HookAbTestResult> {
  if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) {
    throw new Error("META_AD_ACCOUNT_ID and META_AD_ACCESS_TOKEN must be set");
  }
  const pageId = process.env.META_PAGE_ID;
  if (!pageId) {
    throw new Error("META_PAGE_ID is not set — required to create ad creatives. Add it in Settings → Secrets.");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const campaignName = `Hook Test — ${config.topic.slice(0, 40)} — ${dateStr}`;

  // 1. Create Campaign (PAUSED — user activates manually after review)
  const campaign = await metaPost(`act_${AD_ACCOUNT_ID}/campaigns`, {
    name: campaignName,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  });
  const campaignId = (campaign as any).id as string;

  const adSetIds: string[] = [];
  const adIds: string[] = [];
  const landingUrl = PRODUCT_URLS[config.targetProduct];

  // 2. Create one Ad Set per variant (isolated budget per hook)
  for (let i = 0; i < config.variants.length; i++) {
    const variant = config.variants[i];
    const adSetName = `Hook ${i + 1} — ${variant.frameworkLabel}`;

    const adSet = await metaPost(`act_${AD_ACCOUNT_ID}/adsets`, {
      name: adSetName,
      campaign_id: campaignId,
      daily_budget: Math.round(config.dailyBudgetPerVariant * 100), // in cents
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      targeting: DEFAULT_TARGETING,
      status: "PAUSED",
      start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      end_time: new Date(
        Date.now() + config.testDurationDays * 24 * 3600000
      ).toISOString(),
    });
    const adSetId = (adSet as any).id as string;
    adSetIds.push(adSetId);

    // 3. Create Ad Creative for this variant
    // Primary text = hook text (what Pedram says in the video)
    // Headline = overlay text (short punchy version)
    const creative = await metaPost(`act_${AD_ACCOUNT_ID}/adcreatives`, {
      name: `Creative — Hook ${i + 1} — ${variant.framework}`,
      object_story_spec: {
        page_id: pageId,
        video_data: {
          video_url: config.videoUrl,
          message: variant.hookText,
          title: variant.overlayText,
          call_to_action: {
            type: "LEARN_MORE",
            value: { link: landingUrl },
          },
        },
      },
    });
    const creativeId = (creative as any).id as string;

    // 4. Create Ad
    const ad = await metaPost(`act_${AD_ACCOUNT_ID}/ads`, {
      name: `Ad — Hook ${i + 1} — ${variant.framework}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
    });
    adIds.push((ad as any).id as string);
  }

  // 5. Save test record to DB
  const db = await getDb();
  if (db) {
    await db.insert(hookAbTests).values({
      hookGenerationId: config.hookGenerationId,
      campaignId,
      adSetIds: JSON.stringify(adSetIds),
      adIds: JSON.stringify(adIds),
      topic: config.topic,
      targetProduct: config.targetProduct,
      dailyBudgetPerVariant: config.dailyBudgetPerVariant.toString(),
      testDurationDays: config.testDurationDays,
      status: "active",
      variantCount: config.variants.length,
    });
  }

  const totalDaily = config.dailyBudgetPerVariant * config.variants.length;
  const totalCost = totalDaily * config.testDurationDays;

  return {
    campaignId,
    adSetIds,
    adIds,
    metaAdsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT_ID}&selected_campaign_ids=${campaignId}`,
    estimatedTotalDailyBudget: totalDaily,
    estimatedTotalTestCost: totalCost,
  };
}

export async function getHookAbTests(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(hookAbTests)
    .orderBy(hookAbTests.createdAt)
    .limit(limit);
}
