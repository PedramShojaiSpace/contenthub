/**
 * Ads Monitor Router — Daily Media Buyer Intelligence System
 *
 * Acts as an automated media buyer that:
 * 1. Pulls Meta Ads Insights daily (spend, purchases, ROAS, CTR, CPM, frequency)
 * 2. Applies decision rules to flag: PAUSE / SCALE / WATCH / TEST
 * 3. Cross-references with first-party Shopify attribution data
 * 4. Generates a daily AI briefing with specific actionable recommendations
 * 5. Notifies the owner via Manus notification
 *
 * Decision Rules (media buyer thresholds):
 * - PAUSE:  spend > $50 AND (ROAS < 1.5 OR CPA > $120) AND 3+ days of data
 * - PAUSE:  frequency > 4.0 AND CTR < 0.5% (audience fatigue)
 * - SCALE:  ROAS > 3.0 AND spend > $30 AND purchases >= 3
 * - SCALE:  ROAS > 2.5 AND 7-day trend improving
 * - WATCH:  everything else — collecting data
 * - TEST:   new ad set < $30 spend, not enough data
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { desc, eq, gte, sql } from "drizzle-orm";
import { mysqlTable, int, varchar, decimal, date, json, bigint, longtext } from "drizzle-orm/mysql-core";
import { advertorialPages } from "../drizzle/schema";
import { generateLpVariantForCampaign } from "./lpVariantGenerator";

// ── Inline schema definitions (tables created via SQL) ─────────────────────
const campaignSnapshots = mysqlTable("campaign_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  campaignId: varchar("campaign_id", { length: 64 }).notNull(),
  campaignName: varchar("campaign_name", { length: 512 }).notNull(),
  adsetId: varchar("adset_id", { length: 64 }),
  adsetName: varchar("adset_name", { length: 512 }),
  status: varchar("status", { length: 32 }),
  objective: varchar("objective", { length: 64 }),
  spendCents: int("spend_cents").notNull().default(0),
  impressions: int("impressions").notNull().default(0),
  clicks: int("clicks").notNull().default(0),
  ctr: decimal("ctr", { precision: 8, scale: 4 }),
  cpmCents: int("cpm_cents"),
  purchases: int("purchases").notNull().default(0),
  attributedRevenueCents: int("attributed_revenue_cents").notNull().default(0),
  roas: decimal("roas", { precision: 8, scale: 4 }),
  cpaCents: int("cpa_cents"),
  frequency: decimal("frequency", { precision: 8, scale: 4 }),
  reach: int("reach"),
  dailyBudgetCents: int("daily_budget_cents"),
  recommendation: varchar("recommendation", { length: 32 }).default("watch"),
  recommendationReason: varchar("recommendation_reason", { length: 1024 }),
  rawData: json("raw_data"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

const dailyBriefings = mysqlTable("daily_briefings", {
  id: int("id").autoincrement().primaryKey(),
  briefingDate: date("briefing_date").notNull(),
  totalSpendCents: int("total_spend_cents").notNull().default(0),
  totalRevenueCents: int("total_revenue_cents").notNull().default(0),
  totalRoas: decimal("total_roas", { precision: 8, scale: 4 }),
  activeCampaigns: int("active_campaigns").notNull().default(0),
  pausedToday: int("paused_today").notNull().default(0),
  scaledToday: int("scaled_today").notNull().default(0),
  briefingText: longtext("briefing_text"),
  recommendations: json("recommendations"),
  generatedAt: bigint("generated_at", { mode: "number" }).notNull(),
});

// ── Media Buyer Decision Engine ────────────────────────────────────────────
interface AdSetMetrics {
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  status: string;
  objective: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpmCents: number;
  purchases: number;
  roas: number;
  cpaCents: number;
  frequency: number;
  reach: number;
  dailyBudgetCents: number;
}

type Recommendation = "pause" | "scale" | "watch" | "test" | "investigate";

function applyDecisionRules(m: AdSetMetrics): { recommendation: Recommendation; reason: string } {
  const spend = m.spendCents / 100;
  const cpa = m.cpaCents / 100;

  // Not enough data yet
  if (spend < 30) {
    return { recommendation: "test", reason: `Only $${spend.toFixed(2)} spent — collecting data, minimum $30 needed for signal.` };
  }

  // Audience fatigue
  if (m.frequency > 4.0 && m.ctr < 0.5) {
    return {
      recommendation: "pause",
      reason: `Audience fatigue: frequency ${m.frequency.toFixed(1)}x with CTR only ${m.ctr.toFixed(2)}%. Creative is burned out — refresh or pause.`,
    };
  }

  // Burning money — high spend, terrible ROAS
  if (spend > 50 && m.roas < 1.5 && m.purchases > 0) {
    return {
      recommendation: "pause",
      reason: `Losing money: ROAS ${m.roas.toFixed(2)}x on $${spend.toFixed(0)} spend. Every dollar in returns $${m.roas.toFixed(2)} — below break-even. Pause immediately.`,
    };
  }

  // Spending with zero purchases
  if (spend > 75 && m.purchases === 0) {
    return {
      recommendation: "pause",
      reason: `$${spend.toFixed(0)} spent with zero purchases. Either the pixel is broken, the audience is wrong, or the offer isn't converting. Pause and investigate.`,
    };
  }

  // High CPA
  if (spend > 50 && cpa > 150 && m.purchases > 0) {
    return {
      recommendation: "investigate",
      reason: `CPA is $${cpa.toFixed(0)} — above the $150 threshold for a $399 product. Check audience quality, ad creative, and landing page. May need to pause.`,
    };
  }

  // Winner — scale it
  if (m.roas >= 3.0 && spend > 30 && m.purchases >= 3) {
    return {
      recommendation: "scale",
      reason: `Strong performer: ROAS ${m.roas.toFixed(2)}x with ${m.purchases} purchases on $${spend.toFixed(0)} spend. Increase daily budget by 20-30% — do not double overnight.`,
    };
  }

  // Solid — scale cautiously
  if (m.roas >= 2.5 && spend > 50 && m.purchases >= 2) {
    return {
      recommendation: "scale",
      reason: `Profitable at ROAS ${m.roas.toFixed(2)}x. Incrementally increase budget by 15-20% and monitor CPA over next 48 hours.`,
    };
  }

  // Decent but watch
  if (m.roas >= 2.0 && m.purchases >= 1) {
    return {
      recommendation: "watch",
      reason: `ROAS ${m.roas.toFixed(2)}x — profitable but not yet scaling territory. Let it run 2-3 more days before deciding.`,
    };
  }

  // Default watch
  return {
    recommendation: "watch",
    reason: `ROAS ${m.roas > 0 ? m.roas.toFixed(2) + "x" : "N/A"} on $${spend.toFixed(0)} spend. Monitoring — needs more data or purchases to make a call.`,
  };
}

// ── Meta Ads API Fetcher ───────────────────────────────────────────────────
async function fetchMetaInsights(datePreset: string = "yesterday"): Promise<AdSetMetrics[]> {
  const accessToken = process.env.META_AD_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    console.warn("[AdsMonitor] META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID not set");
    return [];
  }

  const fields = [
    "campaign_id", "campaign_name", "adset_id", "adset_name",
    "spend", "impressions", "clicks", "ctr", "cpm", "frequency", "reach",
    "actions", "cost_per_action_type",
  ].join(",");

  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&level=adset&limit=100&access_token=${accessToken}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    console.error("[AdsMonitor] Meta API error:", await resp.text());
    return [];
  }

  const json = await resp.json() as any;
  const data: any[] = json.data || [];

  // Also fetch campaign status and budget
  const campaignIds = Array.from(new Set(data.map((d: any) => d.campaign_id as string)));
  const campaignMeta: Record<string, { status: string; objective: string; daily_budget?: string }> = {};

  if (campaignIds.length > 0) {
    const batchUrl = `https://graph.facebook.com/v19.0/?ids=${campaignIds.join(",")}&fields=id,status,objective,daily_budget&access_token=${accessToken}`;
    const batchResp = await fetch(batchUrl);
    if (batchResp.ok) {
      const batchData = await batchResp.json() as any;
      for (const [id, val] of Object.entries(batchData)) {
        campaignMeta[id] = val as any;
      }
    }
  }

  return data.map((row: any) => {
    const actions: any[] = row.actions || [];
    const purchases = parseInt(
      actions.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value || "0"
    );
    const spendCents = Math.round(parseFloat(row.spend || "0") * 100);
    const cpmCents = Math.round(parseFloat(row.cpm || "0") * 100);
    const ctr = parseFloat(row.ctr || "0");
    const frequency = parseFloat(row.frequency || "0");
    const reach = parseInt(row.reach || "0");
    const impressions = parseInt(row.impressions || "0");
    const clicks = parseInt(row.clicks || "0");

    // ROAS from Meta pixel (will be cross-referenced with Shopify data)
    const purchaseValue = actions.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase");
    const metaRevenueCents = purchaseValue ? Math.round(parseFloat(purchaseValue.value || "0") * 39900) : 0; // estimate $399/purchase
    const roas = spendCents > 0 && purchases > 0 ? (purchases * 39900) / spendCents : 0;
    const cpaCents = purchases > 0 ? Math.round(spendCents / purchases) : 0;

    const campaignInfo = campaignMeta[row.campaign_id] || {};
    const dailyBudgetCents = campaignInfo.daily_budget ? parseInt(campaignInfo.daily_budget) : 0;

    return {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      adsetId: row.adset_id,
      adsetName: row.adset_name,
      status: campaignInfo.status || "UNKNOWN",
      objective: campaignInfo.objective || "",
      spendCents,
      impressions,
      clicks,
      ctr,
      cpmCents,
      purchases,
      roas,
      cpaCents,
      frequency,
      reach,
      dailyBudgetCents,
      attributedRevenueCents: purchases * 39900,
    } as AdSetMetrics & { attributedRevenueCents: number };
  });
}

// ── Main Sync Function (called by cron and manual trigger) ─────────────────
export async function runDailyAdsSync(datePreset: string = "yesterday"): Promise<{
  snapshotCount: number;
  pauseCount: number;
  scaleCount: number;
  briefingText: string;
  lpVariantsGenerated?: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const today = new Date().toISOString().split("T")[0];
  const metrics = await fetchMetaInsights(datePreset);

  if (metrics.length === 0) {
    return { snapshotCount: 0, pauseCount: 0, scaleCount: 0, briefingText: "No Meta Ads data available." };
  }

  let pauseCount = 0;
  let scaleCount = 0;
  const snapshots = [];

  for (const m of metrics as (AdSetMetrics & { attributedRevenueCents: number })[]) {
    const { recommendation, reason } = applyDecisionRules(m);
    if (recommendation === "pause") pauseCount++;
    if (recommendation === "scale") scaleCount++;

    snapshots.push({
      snapshotDate: today,
      campaignId: m.campaignId,
      campaignName: m.campaignName,
      adsetId: m.adsetId,
      adsetName: m.adsetName,
      status: m.status,
      objective: m.objective,
      spendCents: m.spendCents,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: String(m.ctr),
      cpmCents: m.cpmCents,
      purchases: m.purchases,
      attributedRevenueCents: m.attributedRevenueCents,
      roas: String(m.roas.toFixed(4)),
      cpaCents: m.cpaCents,
      frequency: String(m.frequency),
      reach: m.reach,
      dailyBudgetCents: m.dailyBudgetCents,
      recommendation,
      recommendationReason: reason,
      rawData: m as any,
      createdAt: Date.now(),
    });
  }

  // Upsert snapshots
  for (const snap of snapshots) {
    await db.execute(sql`
      INSERT INTO campaign_snapshots 
        (snapshot_date, campaign_id, campaign_name, adset_id, adset_name, status, objective,
         spend_cents, impressions, clicks, ctr, cpm_cents, purchases, attributed_revenue_cents,
         roas, cpa_cents, frequency, reach, daily_budget_cents, recommendation, recommendation_reason,
         raw_data, created_at)
      VALUES 
        (${snap.snapshotDate}, ${snap.campaignId}, ${snap.campaignName}, ${snap.adsetId}, ${snap.adsetName},
         ${snap.status}, ${snap.objective}, ${snap.spendCents}, ${snap.impressions}, ${snap.clicks},
         ${snap.ctr}, ${snap.cpmCents}, ${snap.purchases}, ${snap.attributedRevenueCents},
         ${snap.roas}, ${snap.cpaCents}, ${snap.frequency}, ${snap.reach}, ${snap.dailyBudgetCents},
         ${snap.recommendation}, ${snap.recommendationReason}, ${JSON.stringify(snap.rawData)}, ${snap.createdAt})
      ON DUPLICATE KEY UPDATE
        status = VALUES(status), spend_cents = VALUES(spend_cents), impressions = VALUES(impressions),
        clicks = VALUES(clicks), ctr = VALUES(ctr), cpm_cents = VALUES(cpm_cents),
        purchases = VALUES(purchases), attributed_revenue_cents = VALUES(attributed_revenue_cents),
        roas = VALUES(roas), cpa_cents = VALUES(cpa_cents), frequency = VALUES(frequency),
        reach = VALUES(reach), recommendation = VALUES(recommendation),
        recommendation_reason = VALUES(recommendation_reason), raw_data = VALUES(raw_data)
    `);
  }

  // Generate AI briefing
  const totalSpend = snapshots.reduce((s, r) => s + r.spendCents, 0);
  const totalRevenue = snapshots.reduce((s, r) => s + r.attributedRevenueCents, 0);
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const activeCampaigns = snapshots.filter(s => s.status === "ACTIVE").length;

  const pauseList = snapshots.filter(s => s.recommendation === "pause");
  const scaleList = snapshots.filter(s => s.recommendation === "scale");
  const watchList = snapshots.filter(s => s.recommendation === "watch");

  const briefingPrompt = `You are a senior Meta Ads media buyer for The Urban Monk, a health and wellness brand selling Orobiome (gut health supplement, $399) and Urban Monk Academy membership ($297/year).

Today's date: ${today}
Total spend (yesterday): $${(totalSpend / 100).toFixed(2)}
Total attributed revenue: $${(totalRevenue / 100).toFixed(2)}
Overall ROAS: ${totalRoas.toFixed(2)}x
Active ad sets: ${activeCampaigns}

AD SETS TO PAUSE (${pauseList.length}):
${pauseList.map(p => `- "${p.adsetName}" | Spend: $${(p.spendCents/100).toFixed(0)} | ROAS: ${parseFloat(p.roas||"0").toFixed(2)}x | Purchases: ${p.purchases} | Reason: ${p.recommendationReason}`).join("\n") || "None"}

AD SETS TO SCALE (${scaleList.length}):
${scaleList.map(p => `- "${p.adsetName}" | Spend: $${(p.spendCents/100).toFixed(0)} | ROAS: ${parseFloat(p.roas||"0").toFixed(2)}x | Purchases: ${p.purchases} | Reason: ${p.recommendationReason}`).join("\n") || "None"}

WATCHING (${watchList.length}):
${watchList.slice(0, 5).map(p => `- "${p.adsetName}" | Spend: $${(p.spendCents/100).toFixed(0)} | ROAS: ${parseFloat(p.roas||"0").toFixed(2)}x | Purchases: ${p.purchases}`).join("\n") || "None"}

Write a concise daily media buyer briefing (max 400 words) for Dr. Pedram Shojai. Be direct and specific. Include:
1. One-sentence headline summary of yesterday's performance
2. Immediate actions required (pause/scale with exact budget changes)
3. What's working and why
4. What's not working and why
5. One strategic recommendation for today

Use plain language. Be specific with numbers. No fluff.`;

  let briefingText = "Daily briefing generation failed — check Meta API connection.";
  try {
    const systemMsg: string = "You are a direct-response media buyer who writes concise, actionable daily ad performance briefings.";
    const userMsg: string = briefingPrompt;
    const llmResp = await invokeLLM({
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
    });
    const rawContent = llmResp.choices?.[0]?.message?.content;
    briefingText = typeof rawContent === "string" ? rawContent : briefingText;
  } catch (e) {
    console.error("[AdsMonitor] LLM briefing failed:", e);
  }

  // Save briefing
  await db.execute(sql`
    INSERT INTO daily_briefings 
      (briefing_date, total_spend_cents, total_revenue_cents, total_roas, active_campaigns,
       paused_today, scaled_today, briefing_text, recommendations, generated_at)
    VALUES 
      (${today}, ${totalSpend}, ${totalRevenue}, ${totalRoas.toFixed(4)}, ${activeCampaigns},
       ${pauseCount}, ${scaleCount}, ${briefingText}, ${JSON.stringify({ pause: pauseList.map(p => p.adsetName), scale: scaleList.map(p => p.adsetName) })}, ${Date.now()})
    ON DUPLICATE KEY UPDATE
      total_spend_cents = VALUES(total_spend_cents), total_revenue_cents = VALUES(total_revenue_cents),
      total_roas = VALUES(total_roas), active_campaigns = VALUES(active_campaigns),
      paused_today = VALUES(paused_today), scaled_today = VALUES(scaled_today),
      briefing_text = VALUES(briefing_text), recommendations = VALUES(recommendations),
      generated_at = VALUES(generated_at)
  `);

  // ── LP Variant Gap Detection ────────────────────────────────────────────
  // Detect campaigns with high CTR (>= 8%) but zero purchases and spend > $50
  // These are "click magnets" where the ad works but the LP isn't converting
  const lpGapCandidates = snapshots.filter(s =>
    s.status === "ACTIVE" &&
    parseFloat(s.ctr || "0") >= 8.0 &&
    s.purchases === 0 &&
    s.spendCents > 5000 // $50+
  );

  let lpVariantsGenerated = 0;
  const lpVariantLinks: string[] = [];

  for (const candidate of lpGapCandidates) {
    try {
      console.log(`[AdsMonitor] LP gap detected for "${candidate.adsetName}" — CTR ${parseFloat(candidate.ctr||"0").toFixed(1)}%, $${(candidate.spendCents/100).toFixed(0)} spend, 0 purchases. Generating LP variant...`);
      const variant = await generateLpVariantForCampaign({
        campaignName: candidate.campaignName,
        adsetName: candidate.adsetName,
        ctr: parseFloat(candidate.ctr || "0"),
        spendCents: candidate.spendCents,
      });
      lpVariantsGenerated++;
      lpVariantLinks.push(`${variant.slug} (${variant.headline?.substring(0, 60)}...)`);
      console.log(`[AdsMonitor] LP variant created: slug=${variant.slug}`);
    } catch (e) {
      console.error(`[AdsMonitor] LP variant generation failed for "${candidate.adsetName}":`, e);
    }
  }

  // Notify owner
  const urgentActions = pauseCount + scaleCount;
  const notifyContent = [
    `ROAS: ${totalRoas.toFixed(2)}x | Spend: $${(totalSpend/100).toFixed(0)} | Revenue: $${(totalRevenue/100).toFixed(0)}`,
    pauseCount > 0 ? `⛔ PAUSE: ${pauseList.map(p => p.adsetName).join(", ")}` : "",
    scaleCount > 0 ? `🚀 SCALE: ${scaleList.map(p => p.adsetName).join(", ")}` : "",
    lpVariantsGenerated > 0 ? `\n🎯 LP VARIANTS AUTO-GENERATED (${lpVariantsGenerated}):\n${lpVariantLinks.map(l => `  • ${l}`).join("\n")}\nReview in Content Hub → Advertorials → filter by status=draft` : "",
    "\nOpen the Campaign Monitor in the Content Hub for the full briefing.",
  ].filter(Boolean).join("\n");

  if (urgentActions > 0 || lpVariantsGenerated > 0) {
    await notifyOwner({
      title: `📊 Daily Ads Briefing${lpVariantsGenerated > 0 ? ` + ${lpVariantsGenerated} LP variant${lpVariantsGenerated > 1 ? "s" : ""} generated` : urgentActions > 0 ? ` — ${urgentActions} action${urgentActions > 1 ? "s" : ""} needed` : ""}`,
      content: notifyContent,
    });
  }

  return { snapshotCount: snapshots.length, pauseCount, scaleCount, briefingText, lpVariantsGenerated };
}

// ── tRPC Router ────────────────────────────────────────────────────────────
export const adsMonitorRouter = router({
  // Manual trigger: run the sync now
  runSync: protectedProcedure
    .input(z.object({ datePreset: z.string().default("yesterday") }))
    .mutation(async ({ input }) => {
      return runDailyAdsSync(input.datePreset);
    }),

  // Get today's briefing
  getTodayBriefing: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const today = new Date().toISOString().split("T")[0];
    const [briefing] = await db.execute(sql`
      SELECT * FROM daily_briefings WHERE briefing_date = ${today} LIMIT 1
    `) as any[];
    return (briefing as any[])?.[0] || null;
  }),

  // Get briefing history
  getBriefingHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(14) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT briefing_date, total_spend_cents, total_revenue_cents, total_roas,
               active_campaigns, paused_today, scaled_today, generated_at
        FROM daily_briefings ORDER BY briefing_date DESC LIMIT ${input.limit}
      `) as any[];
      return (rows as any[])?.[0] || [];
    }),

  // Get today's campaign snapshots
  getTodaySnapshots: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const today = new Date().toISOString().split("T")[0];
    const rows = await db.execute(sql`
      SELECT id, campaign_name, adset_name, status, spend_cents, impressions, clicks, ctr,
             cpm_cents, purchases, roas, cpa_cents, frequency, daily_budget_cents,
             recommendation, recommendation_reason, snapshot_date
      FROM campaign_snapshots
      WHERE snapshot_date = ${today}
      ORDER BY spend_cents DESC
    `) as any[];
    return (rows as any[])?.[0] || [];
  }),

  // Get snapshots for a date range (for trend charts)
  getSnapshotTrend: protectedProcedure
    .input(z.object({ adsetId: z.string(), days: z.number().default(14) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT snapshot_date, spend_cents, purchases, roas, cpa_cents, ctr, frequency
        FROM campaign_snapshots
        WHERE adset_id = ${input.adsetId}
        ORDER BY snapshot_date ASC
        LIMIT ${input.days}
      `) as any[];
      return (rows as any[])?.[0] || [];
    }),

  // Get performance summary across all time
  getSummary: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async () => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(sql`
        SELECT 
          SUM(total_spend_cents) as total_spend,
          SUM(total_revenue_cents) as total_revenue,
          AVG(total_roas) as avg_roas,
          SUM(paused_today) as total_paused,
          SUM(scaled_today) as total_scaled,
          COUNT(*) as days_tracked
        FROM daily_briefings
        ORDER BY briefing_date DESC
        LIMIT 30
      `) as any[];
      return (rows as any[])?.[0]?.[0] || null;
    }),
});
