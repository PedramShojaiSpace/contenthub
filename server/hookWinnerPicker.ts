/**
 * hookWinnerPicker.ts
 * 
 * Monitors active hook A/B tests, identifies the winning variant,
 * and promotes it to a full-scale campaign.
 * 
 * Winner criteria (configurable, defaults below):
 * - Minimum 100 impressions per variant before declaring a winner
 * - Winner must have CTR at least 20% higher than the average
 * - If test duration has elapsed, pick the best performer regardless
 * 
 * On winner selection:
 * 1. Pauses all losing ad sets
 * 2. Updates hookAbTests record with winner info
 * 3. Optionally creates a new full-budget campaign with just the winner
 * 4. Updates frameworkPerformance table (for long-term learning)
 * 5. Notifies owner via the notification system
 */

import { getDb } from "./db";
import { hookAbTests, frameworkPerformance, hookGenerations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

const META_API_BASE = "https://graph.facebook.com/v21.0";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.META_AD_ACCESS_TOKEN;

const MIN_IMPRESSIONS_TO_DECIDE = 100;
const WINNER_CTR_LIFT_THRESHOLD = 0.20; // 20% better than average

interface AdInsight {
  adId: string;
  adSetId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  leads: number;
  cpl: number;
  framework: string;
}

async function metaGet(endpoint: string): Promise<Record<string, unknown>> {
  const url = `${META_API_BASE}/${endpoint}&access_token=${ACCESS_TOKEN}`;
  const res = await fetch(url);
  return res.json() as Promise<Record<string, unknown>>;
}

async function metaPost(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `${META_API_BASE}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: ACCESS_TOKEN }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getAdInsights(adIds: string[]): Promise<AdInsight[]> {
  if (!adIds.length) return [];

  const insights: AdInsight[] = [];

  for (const adId of adIds) {
    try {
      const data = await metaGet(
        `${adId}/insights?fields=impressions,clicks,ctr,spend,actions,adset_id&date_preset=lifetime`
      );
      const d = ((data as any).data?.[0]) as Record<string, unknown> | undefined;
      if (!d) continue;

      const leads = ((d.actions as any[]) ?? []).find(
        (a: any) => a.action_type === "lead"
      )?.value ?? 0;

      const impressions = parseInt((d.impressions as string) ?? "0");
      const clicks = parseInt((d.clicks as string) ?? "0");
      const ctr = parseFloat((d.ctr as string) ?? "0");
      const spend = parseFloat((d.spend as string) ?? "0");
      const leadsNum = parseInt(String(leads));
      const cpl = leadsNum > 0 ? spend / leadsNum : 0;

      insights.push({
        adId,
        adSetId: (d.adset_id as string) ?? "",
        impressions,
        clicks,
        ctr,
        spend,
        leads: leadsNum,
        cpl,
        framework: "", // filled in below from DB
      });
    } catch (e) {
      console.error(`[hookWinnerPicker] Failed to get insights for ad ${adId}:`, e);
    }
  }

  return insights;
}

export async function checkAndPickWinner(testId: number): Promise<{
  hasWinner: boolean;
  winner?: AdInsight;
  reason: string;
}> {
  const db = await getDb();
  if (!db) return { hasWinner: false, reason: "DB not available" };

  const [test] = await db
    .select()
    .from(hookAbTests)
    .where(eq(hookAbTests.id, testId));

  if (!test) return { hasWinner: false, reason: "Test not found" };
  if (test.status === "winner_selected") {
    return { hasWinner: true, reason: "Winner already selected" };
  }

  const adIds = JSON.parse(test.adIds) as string[];
  const adSetIds = JSON.parse(test.adSetIds) as string[];
  const insights = await getAdInsights(adIds);

  // Resolve framework names from hookGenerations hooksJson (adIds are in variant order)
  try {
    const [gen] = await db
      .select()
      .from(hookGenerations)
      .where(eq(hookGenerations.id, test.hookGenerationId));
    if (gen?.hooksJson) {
      const variants = JSON.parse(gen.hooksJson) as Array<{ framework: string }>;
      insights.forEach((ins, idx) => {
        if (variants[idx]?.framework) ins.framework = variants[idx].framework;
      });
    }
  } catch (e) {
    console.warn("[hookWinnerPicker] Could not resolve framework names:", e);
  }

  if (!insights.length) {
    return { hasWinner: false, reason: "No insights data yet — test may not have started" };
  }

  // Check if test duration has elapsed
  const testAge = Date.now() - new Date(test.createdAt).getTime();
  const testDurationMs = test.testDurationDays * 24 * 3600 * 1000;
  const testExpired = testAge >= testDurationMs;

  // Check minimum impressions
  const totalImpressions = insights.reduce((s, i) => s + i.impressions, 0);
  const avgImpressions = totalImpressions / insights.length;

  if (!testExpired && avgImpressions < MIN_IMPRESSIONS_TO_DECIDE) {
    return {
      hasWinner: false,
      reason: `Need at least ${MIN_IMPRESSIONS_TO_DECIDE} impressions per variant (current avg: ${Math.round(avgImpressions)})`,
    };
  }

  // Find winner by CTR
  const sorted = [...insights].sort((a, b) => b.ctr - a.ctr);
  const winner = sorted[0];
  const avgCtr = insights.reduce((s, i) => s + i.ctr, 0) / insights.length;
  const ctrLift = avgCtr > 0 ? (winner.ctr - avgCtr) / avgCtr : 0;

  if (!testExpired && ctrLift < WINNER_CTR_LIFT_THRESHOLD) {
    return {
      hasWinner: false,
      reason: `Winner CTR lift is only ${(ctrLift * 100).toFixed(1)}% (need ${WINNER_CTR_LIFT_THRESHOLD * 100}% minimum)`,
    };
  }

  // We have a winner — pause all losers
  for (const loser of sorted.slice(1)) {
    try {
      await metaPost(loser.adSetId, { status: "PAUSED" });
    } catch (e) {
      console.error(`[hookWinnerPicker] Failed to pause ad set ${loser.adSetId}:`, e);
    }
  }

  // Update DB
  await db
    .update(hookAbTests)
    .set({
      status: "winner_selected",
      winnerAdId: winner.adId,
      winnerFramework: winner.framework || "unknown",
      winnerCtr: winner.ctr.toFixed(4),
      winnerCpl: winner.cpl.toFixed(2),
    })
    .where(eq(hookAbTests.id, testId));

  // Update framework performance tracking
  try {
    const [existing] = await db
      .select()
      .from(frameworkPerformance)
      .where(
        and(
          eq(frameworkPerformance.platform, "meta"),
          eq(frameworkPerformance.framework, winner.framework || "unknown")
        )
      );

    if (existing) {
      await db
        .update(frameworkPerformance)
        .set({
          winCount: (existing.winCount ?? 0) + 1,
          totalTests: (existing.totalTests ?? 0) + 1,
        })
        .where(eq(frameworkPerformance.id, existing.id));
    }
  } catch (e) {
    console.error("[hookWinnerPicker] Failed to update framework performance:", e);
  }

  // Notify owner
  try {
    await notifyOwner({
      title: `🏆 Hook Test Winner: ${winner.framework || "Unknown Framework"}`,
      content: `Test for "${test.topic}" has a winner!\n\nWinner CTR: ${winner.ctr.toFixed(2)}% (${(ctrLift * 100).toFixed(0)}% above average)\nWinner CPL: $${winner.cpl.toFixed(2)}\n\nGo to Ads Manager → Hook Testing to promote to full campaign.`,
    });
  } catch (e) {
    console.error("[hookWinnerPicker] Failed to notify owner:", e);
  }

  return {
    hasWinner: true,
    winner,
    reason: testExpired
      ? `Test duration elapsed — best performer selected (CTR: ${winner.ctr.toFixed(2)}%)`
      : `Clear winner with ${(ctrLift * 100).toFixed(0)}% CTR lift (CTR: ${winner.ctr.toFixed(2)}%)`,
  };
}

export async function promoteWinnerToFullCampaign(
  testId: number,
  fullDailyBudget: number
): Promise<{ campaignId: string; metaAdsManagerUrl: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [test] = await db
    .select()
    .from(hookAbTests)
    .where(eq(hookAbTests.id, testId));

  if (!test || !test.winnerAdId) {
    throw new Error("No winner selected for this test");
  }

  // Get the winning ad's creative
  const adData = await metaGet(
    `${test.winnerAdId}?fields=creative,name,adset_id`
  );
  const creativeId = ((adData as any).creative?.id) as string;
  if (!creativeId) throw new Error("Could not retrieve winning ad creative");

  // Create a new full-budget campaign
  const dateStr = new Date().toISOString().split("T")[0];
  const campaign = await metaPost(`act_${AD_ACCOUNT_ID}/campaigns`, {
    name: `Full Campaign — ${test.topic.slice(0, 40)} — ${dateStr}`,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
  });
  const campaignId = (campaign as any).id as string;

  // Create a single ad set with the full budget
  const adSet = await metaPost(`act_${AD_ACCOUNT_ID}/adsets`, {
    name: `Winner — ${test.winnerFramework ?? "Best Hook"}`,
    campaign_id: campaignId,
    daily_budget: Math.round(fullDailyBudget * 100),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LEAD_GENERATION",
    targeting: {
      age_min: 35,
      age_max: 65,
      genders: [0],
      geo_locations: { countries: ["US", "CA", "GB", "AU"] },
      flexible_spec: [
        {
          interests: [
            { id: "6003139266461", name: "Health" },
            { id: "6003020834693", name: "Wellness" },
            { id: "6003107902433", name: "Meditation" },
          ],
        },
      ],
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed"],
      instagram_positions: ["stream"],
    },
    status: "PAUSED",
  });
  const adSetId = (adSet as any).id as string;

  // Create ad using the winning creative
  await metaPost(`act_${AD_ACCOUNT_ID}/ads`, {
    name: `Winner Ad — ${test.winnerFramework ?? "Best Hook"}`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });

  // Update DB with promoted campaign ID
  await db
    .update(hookAbTests)
    .set({ promotedCampaignId: campaignId, status: "completed" })
    .where(eq(hookAbTests.id, testId));

  return {
    campaignId,
    metaAdsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT_ID}&selected_campaign_ids=${campaignId}`,
  };
}

// Called by the daily heartbeat to check all active tests
export async function checkAllActiveTests(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const activeTests = await db
    .select()
    .from(hookAbTests)
    .where(eq(hookAbTests.status, "active"));

  for (const test of activeTests) {
    try {
      const result = await checkAndPickWinner(test.id);
      if (result.hasWinner) {
        console.log(`[hookWinnerPicker] Winner picked for test ${test.id}: ${result.reason}`);
      }
    } catch (e) {
      console.error(`[hookWinnerPicker] Error checking test ${test.id}:`, e);
    }
  }
}
