/**
 * Funnel Command Router — Owner's Monday View
 *
 * Aggregates cross-funnel data into three scorecards:
 *   1. Lights On ($299/yr standalone course)
 *   2. Oral Biome (supplement funnel)
 *   3. Gut (supplement funnel)
 *
 * Each scorecard shows:
 *   - Revenue (last 7d / last 30d)
 *   - New buyers
 *   - Take-rate: % of optin/click traffic that converts
 *   - EV per buyer (raw + Academy upgrade probability × $299 LTV)
 *   - Top traffic source
 *   - Trend direction (up/flat/down vs prior period)
 *
 * Also exposes:
 *   - getWeeklyDigest: the latest Monday digest for the Owner's review
 *   - getTakeRateCohorts: cohort table showing take-rate by traffic source
 *   - getAscensionFunnel: how many Lights On buyers have been offered Year 2
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  attributedSales,
  contentItems,
  landingPages,
  keywordCampaigns,
  adClicks,
} from "../drizzle/schema";
import { eq, gte, sql, and, desc, lt, isNotNull } from "drizzle-orm";

// ── Constants ─────────────────────────────────────────────────────────────────

const FUNNEL_IDS = ["lights_on", "oral_biome", "gut"] as const;
type FunnelId = typeof FUNNEL_IDS[number];

const FUNNEL_LABELS: Record<FunnelId, string> = {
  lights_on: "Lights On",
  oral_biome: "Oral Biome",
  gut: "Gut Health",
};

// UTM campaign prefixes that map to each funnel
const FUNNEL_UTM_PREFIXES: Record<FunnelId, string[]> = {
  lights_on: ["lights_on", "lightson", "lights-on", "lo_"],
  oral_biome: ["oral_biome", "oralbiome", "oral-biome", "ob_"],
  gut: ["gut", "gut_health", "gut-health", "gh_"],
};

// Academy Year 2 LTV assumption (per project instructions: at least double $299)
const ACADEMY_Y2_PRICE_CENTS = 59800; // $598 minimum (2× $299)
const ACADEMY_UPGRADE_RATE_DEFAULT = 0.12; // 12% default assumption

function funnelForCampaign(utmCampaign: string | null): FunnelId | null {
  if (!utmCampaign) return null;
  const lower = utmCampaign.toLowerCase();
  for (const funnelId of FUNNEL_IDS) {
    if (FUNNEL_UTM_PREFIXES[funnelId].some(prefix => lower.startsWith(prefix) || lower.includes(prefix))) {
      return funnelId;
    }
  }
  return null;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const funnelCommandRouter = router({

  /**
   * getScorecards — the main Monday view
   * Returns a scorecard for each of the three funnels.
   */
  getScorecards: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      academyUpgradeRate: z.number().min(0).max(1).default(ACADEMY_UPGRADE_RATE_DEFAULT),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const now = Date.now();
      const since = now - input.days * 24 * 60 * 60 * 1000;
      const priorSince = since - input.days * 24 * 60 * 60 * 1000;

      // Pull all attributed sales in the window
      const currentSales = await db
        .select({
          utmCampaign: attributedSales.utmCampaign,
          orderTotal: attributedSales.orderTotal,
          receivedAt: attributedSales.receivedAt,
        })
        .from(attributedSales)
        .where(gte(attributedSales.receivedAt, since));

      const priorSales = await db
        .select({
          utmCampaign: attributedSales.utmCampaign,
          orderTotal: attributedSales.orderTotal,
        })
        .from(attributedSales)
        .where(and(gte(attributedSales.receivedAt, priorSince), lt(attributedSales.receivedAt, since)));

      // Pull ad clicks for take-rate denominator
      const currentClicks = await db
        .select({
          utmCampaign: adClicks.utmCampaign,
          count: sql<number>`COUNT(*)`,
        })
        .from(adClicks)
        .where(gte(adClicks.clickedAt, since))
        .groupBy(adClicks.utmCampaign);

      // Build per-funnel aggregates
      const scorecards = FUNNEL_IDS.map(funnelId => {
        const label = FUNNEL_LABELS[funnelId];

        // Current period
        const funnelSales = currentSales.filter(s => funnelForCampaign(s.utmCampaign) === funnelId);
        const revenue = funnelSales.reduce((sum, s) => sum + (s.orderTotal ?? 0), 0);
        const buyers = funnelSales.length;

        // Prior period for trend
        const priorFunnelSales = priorSales.filter(s => funnelForCampaign(s.utmCampaign) === funnelId);
        const priorRevenue = priorFunnelSales.reduce((sum, s) => sum + (s.orderTotal ?? 0), 0);
        const priorBuyers = priorFunnelSales.length;

        // Take-rate: buyers / clicks
        const funnelClicks = currentClicks
          .filter(c => funnelForCampaign(c.utmCampaign) === funnelId)
          .reduce((sum, c) => sum + Number(c.count), 0);
        const takeRate = funnelClicks > 0 ? buyers / funnelClicks : null;

        // EV per buyer (raw + Academy Year 2 upgrade probability)
        const avgOrderCents = buyers > 0 ? revenue / buyers : 0;
        const evPerBuyerCents = avgOrderCents + (input.academyUpgradeRate * ACADEMY_Y2_PRICE_CENTS);

        // Trend
        const revenueTrend: "up" | "flat" | "down" =
          priorRevenue === 0 ? "flat"
          : revenue > priorRevenue * 1.05 ? "up"
          : revenue < priorRevenue * 0.95 ? "down"
          : "flat";

        // Content pieces tagged to this funnel
        // (counted from contentItems.funnelId — requires the migration to be applied)
        return {
          funnelId,
          label,
          revenue,
          buyers,
          priorRevenue,
          priorBuyers,
          funnelClicks,
          takeRate,
          avgOrderCents,
          evPerBuyerCents,
          revenueTrend,
          days: input.days,
        };
      });

      return {
        scorecards,
        generatedAt: now,
        academyUpgradeRate: input.academyUpgradeRate,
        academyY2PriceCents: ACADEMY_Y2_PRICE_CENTS,
        note: "Take-rate = buyers / ad clicks. EV includes Academy Year 2 upgrade probability at $598.",
      };
    }),

  /**
   * getTakeRateCohorts — break down take-rate by traffic source
   */
  getTakeRateCohorts: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const since = Date.now() - input.days * 24 * 60 * 60 * 1000;

      // Sales by UTM source
      const salesBySource = await db
        .select({
          utmSource: attributedSales.utmSource,
          utmCampaign: attributedSales.utmCampaign,
          sales: sql<number>`COUNT(*)`,
          revenue: sql<number>`SUM(order_total)`,
        })
        .from(attributedSales)
        .where(gte(attributedSales.receivedAt, since))
        .groupBy(attributedSales.utmSource, attributedSales.utmCampaign)
        .orderBy(desc(sql`SUM(order_total)`));

      // Clicks by UTM source
      const clicksBySource = await db
        .select({
          utmSource: adClicks.utmSource,
          utmCampaign: adClicks.utmCampaign,
          clicks: sql<number>`COUNT(*)`,
        })
        .from(adClicks)
        .where(gte(adClicks.clickedAt, since))
        .groupBy(adClicks.utmSource, adClicks.utmCampaign);

      // Build cohort table
      const cohorts = salesBySource.map(row => {
        const matchingClicks = clicksBySource.find(
          c => c.utmSource === row.utmSource && c.utmCampaign === row.utmCampaign
        );
        const clicks = matchingClicks ? Number(matchingClicks.clicks) : 0;
        const sales = Number(row.sales);
        const revenue = Number(row.revenue);
        const takeRate = clicks > 0 ? sales / clicks : null;
        const funnelId = funnelForCampaign(row.utmCampaign);

        return {
          utmSource: row.utmSource || "(direct)",
          utmCampaign: row.utmCampaign || "(none)",
          funnelId,
          funnelLabel: funnelId ? FUNNEL_LABELS[funnelId] : "Untagged",
          clicks,
          sales,
          revenue,
          takeRate,
          avgOrderCents: sales > 0 ? Math.round(revenue / sales) : 0,
        };
      });

      return { cohorts, days: input.days };
    }),

  /**
   * getContentByFunnel — count content items tagged to each funnel
   */
  getContentByFunnel: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const counts = await db
        .select({
          funnelId: contentItems.funnelId,
          count: sql<number>`COUNT(*)`,
        })
        .from(contentItems)
        .groupBy(contentItems.funnelId);

      const result: Record<string, number> = { lights_on: 0, oral_biome: 0, gut: 0, none: 0 };
      for (const row of counts) {
        const key = row.funnelId ?? "none";
        result[key] = Number(row.count);
      }
      return result;
    }),

  /**
   * getWeeklyDigest — latest Monday digest summary for the Owner view
   */
  getWeeklyDigest: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Pull the most recent weekly digest from adsWeeklyDigests
      const { adsWeeklyDigests } = await import("../drizzle/schema");
      const [latest] = await db
        .select()
        .from(adsWeeklyDigests)
        .orderBy(desc(adsWeeklyDigests.weekStartDate))
        .limit(1);

      return latest ?? null;
    }),

  /**
   * getAscensionSummary — how many Lights On buyers are eligible for Year 2 offer
   * (placeholder: returns counts from attributed_sales where funnel = lights_on)
   */
  getAscensionSummary: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Count Lights On buyers (by UTM campaign prefix)
      const allLightsOnSales = await db
        .select({
          utmCampaign: attributedSales.utmCampaign,
          receivedAt: attributedSales.receivedAt,
          orderTotal: attributedSales.orderTotal,
        })
        .from(attributedSales)
        .where(isNotNull(attributedSales.utmCampaign));

      const lightsOnBuyers = allLightsOnSales.filter(
        s => funnelForCampaign(s.utmCampaign) === "lights_on"
      );

      // Buyers who purchased > 300 days ago are eligible for Year 2 offer
      const eligibleCutoff = Date.now() - 300 * 24 * 60 * 60 * 1000;
      const eligibleForY2 = lightsOnBuyers.filter(s => (s.receivedAt ?? 0) < eligibleCutoff);

      return {
        totalLightsOnBuyers: lightsOnBuyers.length,
        eligibleForY2: eligibleForY2.length,
        y2PriceCents: ACADEMY_Y2_PRICE_CENTS,
        potentialRevenueCents: eligibleForY2.length * ACADEMY_Y2_PRICE_CENTS,
        note: "Eligible = purchased Lights On > 300 days ago. Y2 price = $598 (2× Year 1).",
      };
    }),
});
