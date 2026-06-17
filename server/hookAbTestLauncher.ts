/**
 * hookAbTestLauncher.ts
 *
 * Creates a Meta A/B test campaign with one ad per video variant.
 * Each variant gets its own video URL (from VideoVariantFactory) and
 * optionally its own hook text (from the hook generator).
 *
 * Structure:
 *   Campaign: "Hook Test — [Topic] — [Date]" (PAUSED, manual activation)
 *   └── Ad Set 1: Hook Variant 1 ($X/day budget, own video)
 *   └── Ad Set 2: Hook Variant 2 ($X/day budget, own video)
 *   └── Ad Set N: Hook Variant N ($X/day budget, own video)
 *
 * Each ad set has its own video creative so Meta is truly testing
 * different video hooks, not just different ad copy.
 */

import { getDb } from "./db";
import { hookAbTests } from "../drizzle/schema";
import type { TargetProduct } from "./hookGenerator";

const META_API_BASE = "https://graph.facebook.com/v21.0";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.META_AD_ACCESS_TOKEN;

// Product → Landing page URL mapping
const PRODUCT_URLS: Record<TargetProduct, string> = {
  lightsOn: "https://lightson.theurbanmonk.com?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  lightsOnCourse: "https://lightson.theurbanmonk.com/course?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  academy: "https://theurbanmonk.com/academy?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  upstream: "https://upstream.theurbanmonk.com?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  kbmoTesting: "https://theurbanmonk.com/testing?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  sleepTestKit: "https://theurbanmonk.com/sleep-test?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
  orobiomeTestKit: "https://theurbanmonk.com/orobiome?utm_source=meta&utm_medium=paid&utm_campaign=hook_test",
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

export interface HookAbTestInput {
  topic: string;
  targetProduct: TargetProduct;
  variantVideoUrls: string[];   // one S3 URL per variant (from VideoVariantFactory)
  hookTexts?: string[];          // optional hook text per variant (matched by index)
  dailyBudgetPerVariant: number; // in USD
  durationDays: number;
}

export interface HookAbTestResult {
  campaignId: string;
  campaignName: string;
  adSetIds: string[];
  adIds: string[];
  adsCreated: number;
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

export async function launchHookAbTest(input: HookAbTestInput): Promise<HookAbTestResult> {
  if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) {
    throw new Error("META_AD_ACCOUNT_ID and META_AD_ACCESS_TOKEN must be set");
  }
  const pageId = process.env.META_PAGE_ID;
  if (!pageId) {
    throw new Error("META_PAGE_ID is not set — required to create ad creatives. Add it in Settings → Secrets.");
  }

  const { variantVideoUrls, hookTexts, topic, targetProduct, dailyBudgetPerVariant, durationDays } = input;
  const dateStr = new Date().toISOString().split("T")[0];
  const campaignName = `Hook Test — ${topic.slice(0, 40)} — ${dateStr}`;

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
  const landingUrl = PRODUCT_URLS[targetProduct];

  // 2. Create one Ad Set + Creative + Ad per variant
  for (let i = 0; i < variantVideoUrls.length; i++) {
    const videoUrl = variantVideoUrls[i];
    const hookText = hookTexts?.[i] ?? `Hook Variant ${i + 1}`;
    const adSetName = `Hook ${i + 1} — ${topic.slice(0, 30)}`;

    const adSet = await metaPost(`act_${AD_ACCOUNT_ID}/adsets`, {
      name: adSetName,
      campaign_id: campaignId,
      daily_budget: Math.round(dailyBudgetPerVariant * 100), // in cents
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      targeting: DEFAULT_TARGETING,
      status: "PAUSED",
      start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      end_time: new Date(Date.now() + durationDays * 24 * 3600000).toISOString(),
    });
    const adSetId = (adSet as any).id as string;
    adSetIds.push(adSetId);

    // Create Ad Creative — each variant gets its own video
    const creative = await metaPost(`act_${AD_ACCOUNT_ID}/adcreatives`, {
      name: `Creative — Hook ${i + 1}`,
      object_story_spec: {
        page_id: pageId,
        video_data: {
          video_url: videoUrl,
          message: hookText,
          call_to_action: {
            type: "LEARN_MORE",
            value: { link: landingUrl },
          },
        },
      },
    });
    const creativeId = (creative as any).id as string;

    // Create Ad
    const ad = await metaPost(`act_${AD_ACCOUNT_ID}/ads`, {
      name: `Ad — Hook ${i + 1}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
    });
    adIds.push((ad as any).id as string);
  }

  // 3. Save test record to DB
  const db = await getDb();
  if (db) {
    await db.insert(hookAbTests).values({
      hookGenerationId: 0, // no longer required — variants come from VideoVariantFactory
      campaignId,
      adSetIds: JSON.stringify(adSetIds),
      adIds: JSON.stringify(adIds),
      topic,
      targetProduct,
      dailyBudgetPerVariant: dailyBudgetPerVariant.toString(),
      testDurationDays: durationDays,
      status: "active",
      variantCount: variantVideoUrls.length,
    });
  }

  const totalDaily = dailyBudgetPerVariant * variantVideoUrls.length;
  const totalCost = totalDaily * durationDays;

  return {
    campaignId,
    campaignName,
    adSetIds,
    adIds,
    adsCreated: adIds.length,
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
