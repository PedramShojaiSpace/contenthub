/**
 * Meta Ads tRPC Router
 * Exposes campaign data, insights, creative fatigue alerts, and pixel diagnostics
 * to the Content Hub Ads Manager dashboard.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { adsGuardrails, adsOptimizationLogs, adsWeeklyDigests, skuCpaTargets } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import {
  getMetaAdsConfig,
  getCampaigns,
  getAccountInsights,
  getCampaignInsights,
  getAdSets,
  getAdSetInsights,
  getAds,
  getAdInsights,
  detectCreativeFatigue,
  getPixelDiagnostics,
  updateCampaignStatus,
  validateToken,
} from "./metaAdsClient";
import { getPaidPromoCandidates, updateCandidateStatus, runOrganicSignalPoller } from "./organicSignalEngine";
import { generateAndSaveRecommendation } from "./campaignRecommendationEngine";
import { launchCampaign } from "./metaCampaignLauncher";

const DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
] as const;

export const metaAdsRouter = router({
  // ── Token / connection health ──────────────────────────────────────────────
  validateConnection: protectedProcedure.query(async () => {
    const config = getMetaAdsConfig();
    return validateToken(config);
  }),

  // ── Account-level overview ─────────────────────────────────────────────────
  getAccountOverview: protectedProcedure
    .input(z.object({ datePreset: z.enum(DATE_PRESETS).default("last_30d") }))
    .query(async ({ input }) => {
      const config = getMetaAdsConfig();
      const [campaigns, insights] = await Promise.all([
        getCampaigns(config),
        getAccountInsights(config, input.datePreset),
      ]);

      // Merge insights into campaigns
      const insightMap = new Map(insights.map((i) => [i.campaign_id, i]));

      const enriched = campaigns.map((c) => {
        const ins = insightMap.get(c.id);
        const spend = parseFloat(ins?.spend ?? "0");
        const impressions = parseInt(ins?.impressions ?? "0", 10);
        const clicks = parseInt(ins?.clicks ?? "0", 10);
        const ctr = parseFloat(ins?.ctr ?? "0");
        const cpc = parseFloat(ins?.cpc ?? "0");
        const frequency = parseFloat(ins?.frequency ?? "0");

        // Extract lead/purchase conversions from actions array
        const actions = ins?.actions ?? [];
        const leads = actions.find((a) => a.action_type === "lead")?.value ?? "0";
        const purchases = actions.find((a) => a.action_type === "purchase")?.value ?? "0";
        const landingPageViews = actions.find((a) => a.action_type === "landing_page_view")?.value ?? "0";

        const leadCount = parseInt(leads, 10);
        const cpl = leadCount > 0 ? spend / leadCount : null;

        return {
          ...c,
          insights: ins
            ? {
                spend,
                impressions,
                clicks,
                ctr,
                cpc,
                frequency,
                leads: leadCount,
                purchases: parseInt(purchases, 10),
                landingPageViews: parseInt(landingPageViews, 10),
                cpl,
              }
            : null,
        };
      });

      // Summary totals
      const activeCampaigns = enriched.filter((c) => c.effective_status === "ACTIVE");
      const totalSpend = enriched.reduce((sum, c) => sum + (c.insights?.spend ?? 0), 0);
      const totalImpressions = enriched.reduce((sum, c) => sum + (c.insights?.impressions ?? 0), 0);
      const totalClicks = enriched.reduce((sum, c) => sum + (c.insights?.clicks ?? 0), 0);
      const totalLeads = enriched.reduce((sum, c) => sum + (c.insights?.leads ?? 0), 0);
      const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null;
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      return {
        campaigns: enriched,
        summary: {
          totalCampaigns: campaigns.length,
          activeCampaigns: activeCampaigns.length,
          totalSpend,
          totalImpressions,
          totalClicks,
          totalLeads,
          avgCpl,
          avgCtr,
        },
      };
    }),

  // ── Campaign drill-down ────────────────────────────────────────────────────
  getCampaignDetail: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        datePreset: z.enum(DATE_PRESETS).default("last_30d"),
      })
    )
    .query(async ({ input }) => {
      const config = getMetaAdsConfig();
      const [adSets, campaignInsights] = await Promise.all([
        getAdSets(config, input.campaignId),
        getCampaignInsights(config, input.campaignId, input.datePreset),
      ]);

      // Get insights for each ad set
      const adSetInsightsArr = await Promise.all(
        adSets.map((as) => getAdSetInsights(config, as.id, input.datePreset))
      );

      const insightMap = new Map(
        adSetInsightsArr.flatMap((arr) => arr.map((i) => [i.adset_id, i]))
      );

      const enrichedAdSets = adSets.map((as) => ({
        ...as,
        insights: insightMap.get(as.id) ?? null,
      }));

      return {
        campaignInsights: campaignInsights[0] ?? null,
        adSets: enrichedAdSets,
      };
    }),

  // ── Ad set drill-down ──────────────────────────────────────────────────────
  getAdSetDetail: protectedProcedure
    .input(
      z.object({
        adSetId: z.string(),
        datePreset: z.enum(DATE_PRESETS).default("last_30d"),
      })
    )
    .query(async ({ input }) => {
      const config = getMetaAdsConfig();
      const [ads, adSetInsights] = await Promise.all([
        getAds(config, input.adSetId),
        getAdSetInsights(config, input.adSetId, input.datePreset),
      ]);

      const adInsightsArr = await Promise.all(
        ads.map((ad) => getAdInsights(config, ad.id, input.datePreset))
      );

      const insightMap = new Map(
        adInsightsArr.flatMap((arr) => arr.map((i) => [i.ad_id, i]))
      );

      const enrichedAds = ads.map((ad) => ({
        ...ad,
        insights: insightMap.get(ad.id) ?? null,
      }));

      return {
        adSetInsights: adSetInsights[0] ?? null,
        ads: enrichedAds,
      };
    }),

  // ── Creative fatigue alerts ────────────────────────────────────────────────
  getFatigueAlerts: protectedProcedure
    .input(z.object({ datePreset: z.enum(DATE_PRESETS).default("last_14d") }))
    .query(async ({ input }) => {
      const config = getMetaAdsConfig();
      return detectCreativeFatigue(config, input.datePreset);
    }),

  // ── Pixel diagnostics ─────────────────────────────────────────────────────
  getPixelDiagnostics: protectedProcedure.query(async () => {
    const config = getMetaAdsConfig();
    return getPixelDiagnostics(config);
  }),

  // ── Campaign status controls ───────────────────────────────────────────────
  updateCampaignStatus: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        status: z.enum(["ACTIVE", "PAUSED"]),
      })
    )
    .mutation(async ({ input }) => {
      const config = getMetaAdsConfig();
      const success = await updateCampaignStatus(config, input.campaignId, input.status);
      return { success };
    }),

  // ── Organic-to-Paid Signal Engine ─────────────────────────────────────────

  // Get all paid promo candidates
  getPaidPromoCandidates: protectedProcedure
    .input(
      z.object({
        status: z.array(z.enum(["flagged", "recommended", "approved", "launched", "dismissed"])).optional(),
      })
    )
    .query(async ({ input }) => {
      return getPaidPromoCandidates(input.status);
    }),

  // Manually trigger the organic signal poller (for testing / on-demand)
  runSignalPoller: protectedProcedure.mutation(async () => {
    return runOrganicSignalPoller();
  }),

  // Generate a Claude campaign recommendation for a candidate
  generateRecommendation: protectedProcedure
    .input(z.object({ candidateId: z.number() }))
    .mutation(async ({ input }) => {
      const candidates = await getPaidPromoCandidates();
      const candidate = candidates.find((c) => c.id === input.candidateId);
      if (!candidate) throw new Error("Candidate not found");
      return generateAndSaveRecommendation(candidate as any);
    }),

  // Approve a recommendation (marks it ready to launch)
  approveRecommendation: protectedProcedure
    .input(z.object({ candidateId: z.number() }))
    .mutation(async ({ input }) => {
      await updateCandidateStatus(input.candidateId, "approved");
      return { success: true };
    }),

  // Dismiss a candidate (not worth promoting)
  dismissCandidate: protectedProcedure
    .input(z.object({ candidateId: z.number() }))
    .mutation(async ({ input }) => {
      await updateCandidateStatus(input.candidateId, "dismissed");
      return { success: true };
    }),

    // Launch a campaign in Meta (creates PAUSED campaign for review)
  launchCampaign: protectedProcedure
    .input(z.object({ candidateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const candidates = await getPaidPromoCandidates(["approved"]);
      const candidate = candidates.find((c) => c.id === input.candidateId);
      if (!candidate) throw new Error("Approved candidate not found");
      if (!candidate.claudeRecommendation) throw new Error("No recommendation found — generate one first");
      if (!candidate.youtubeVideoId) throw new Error("No YouTube video ID on candidate");
      return launchCampaign(
        candidate.id,
        candidate.youtubeVideoId,
        candidate.youtubeTitle ?? "",
        candidate.claudeRecommendation as any,
        ctx.user?.name ?? "Content Hub"
      );
    }),

  // ── Phase 3: Guardrails Config ──────────────────────────────────────────────
  getGuardrails: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db.select().from(adsGuardrails).limit(1);
    return rows[0] ?? null;
  }),

  updateGuardrails: protectedProcedure
    .input(z.object({
      targetCpl: z.number().min(1).max(500),
      minDailyBudget: z.number().min(5).max(10000),
      maxDailyBudget: z.number().min(10).max(100000),
      autoScaleEnabled: z.boolean(),
      autoPauseEnabled: z.boolean(),
      maxFrequencyBeforePause: z.number().min(1).max(20),
      minCtrBeforePause: z.number().min(0.01).max(10),
      scaleUpMultiplier: z.number().min(1.05).max(2.0),
      minSpendForAction: z.number().min(1).max(1000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const existing = await db.select().from(adsGuardrails).limit(1);
      if (existing.length > 0) {
        await db.update(adsGuardrails)
          .set({
            targetCpl: input.targetCpl.toFixed(2),
            minDailyBudget: input.minDailyBudget.toFixed(2),
            maxDailyBudget: input.maxDailyBudget.toFixed(2),
            autoScaleEnabled: input.autoScaleEnabled,
            autoPauseEnabled: input.autoPauseEnabled,
            maxFrequencyBeforePause: input.maxFrequencyBeforePause.toFixed(1),
            minCtrBeforePause: input.minCtrBeforePause.toFixed(2),
            scaleUpMultiplier: input.scaleUpMultiplier.toFixed(2),
            minSpendForAction: input.minSpendForAction.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(adsGuardrails.id, existing[0].id));
      } else {
        await db.insert(adsGuardrails).values({
          targetCpl: input.targetCpl.toFixed(2),
          minDailyBudget: input.minDailyBudget.toFixed(2),
          maxDailyBudget: input.maxDailyBudget.toFixed(2),
          autoScaleEnabled: input.autoScaleEnabled,
          autoPauseEnabled: input.autoPauseEnabled,
          maxFrequencyBeforePause: input.maxFrequencyBeforePause.toFixed(1),
          minCtrBeforePause: input.minCtrBeforePause.toFixed(2),
          scaleUpMultiplier: input.scaleUpMultiplier.toFixed(2),
          minSpendForAction: input.minSpendForAction.toFixed(2),
          updatedAt: new Date(),
        });
      }
      return { success: true };
    }),

  // ── Phase 3: Optimization Log ───────────────────────────────────────────────
  // ── Per-SKU CPA Targets: read all ─────────────────────────────────────────────────────
  getSkuCpaTargets: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return db.select().from(skuCpaTargets).orderBy(skuCpaTargets.id);
  }),

  // ── Per-SKU CPA Targets: update one row ─────────────────────────────────────────────────
  updateSkuCpaTarget: protectedProcedure
    .input(z.object({
      skuId: z.string().min(1),
      targetCpa: z.number().min(1).max(10000),
      minDailyBudget: z.number().min(1).max(100000),
      maxDailyBudget: z.number().min(1).max(100000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(skuCpaTargets)
        .set({
          targetCpa: input.targetCpa.toFixed(2),
          minDailyBudget: input.minDailyBudget.toFixed(2),
          maxDailyBudget: input.maxDailyBudget.toFixed(2),
        })
        .where(eq(skuCpaTargets.skuId, input.skuId));
      return { success: true };
    }),

  getOptimizationLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(adsOptimizationLogs)
        .orderBy(desc(adsOptimizationLogs.createdAt))
        .limit(input.limit);
    }),

  // ── Phase 3: Weekly Digests ─────────────────────────────────────────────────
  getWeeklyDigests: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(52).default(12) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(adsWeeklyDigests)
        .orderBy(desc(adsWeeklyDigests.createdAt))
        .limit(input.limit);
    }),

  // ── Phase 3: Manual trigger for optimization run ────────────────────────────
  runOptimizationNow: protectedProcedure.mutation(async () => {
    const { runDailyOptimization } = await import("./adsOptimizationEngine");
    return runDailyOptimization();
  }),

  // ── Phase 3: Manual trigger for weekly digest ───────────────────────────────
  generateDigestNow: protectedProcedure.mutation(async () => {
    const { generateWeeklyDigest } = await import("./adsWeeklyDigest");
    return generateWeeklyDigest();
  }),

  // ── Hook Testing: Generate hook variants + body script + CTA variants via Claude ─
  generateHooks: protectedProcedure
    .input(z.object({
      topic: z.string().min(5),
      targetProduct: z.enum(["lightsOn", "lightsOnCourse", "academy", "upstream", "kbmoTesting", "sleepTestKit", "orobiomeTestKit", "general"]),
      count: z.number().min(3).max(8).default(5),
    }))
    .mutation(async ({ input }) => {
      const { generateHookVariants, generateBodyAndCta, saveHookGeneration } = await import("./hookGenerator");
      // Run hooks + body/CTA in parallel for speed
      const [hooksResult, bodyCta] = await Promise.all([
        generateHookVariants(input.topic, input.targetProduct, input.count),
        generateBodyAndCta(input.topic, input.targetProduct),
      ]);
      const id = await saveHookGeneration("system", input.topic, input.targetProduct, hooksResult.variants);
      return {
        ...hooksResult,
        bodyScript: bodyCta.bodyScript,
        ctaVariants: bodyCta.ctaVariants,
        id,
      };
    }),

  // ── Hook Testing: Get past hook generations ───────────────────────────────────
  getHookGenerations: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const { getHookGenerations } = await import("./hookGenerator");
      return getHookGenerations("system", input.limit);
    }),

  // ── Hook Testing: Launch A/B test campaign in Meta ───────────────────────────
  launchHookAbTest: protectedProcedure
    .input(z.object({
      topic: z.string(),
      targetProduct: z.enum(["lightsOn", "lightsOnCourse", "academy", "upstream", "kbmoTesting", "sleepTestKit", "orobiomeTestKit", "general"]),
      // Multi-variant mode: one video URL per variant (from VideoVariantFactory)
      variantVideoUrls: z.array(z.string().url()).min(1).max(10),
      // Optional hook texts — if provided, matched by index to variantVideoUrls
      hookTexts: z.array(z.string()).optional(),
      dailyBudgetPerVariant: z.number().min(1).max(50).default(5),
      durationDays: z.number().min(1).max(30).default(7),
    }))
    .mutation(async ({ input }) => {
      const { launchHookAbTest } = await import("./hookAbTestLauncher");
      return launchHookAbTest(input);
    }),

  // ── Hook Testing: Get all A/B tests ──────────────────────────────────────────
  getHookAbTests: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const { getHookAbTests } = await import("./hookAbTestLauncher");
      return getHookAbTests(input.limit);
    }),

  // ── Hook Testing: Check winner for a specific test ───────────────────────────
  checkHookWinner: protectedProcedure
    .input(z.object({ testId: z.number() }))
    .mutation(async ({ input }) => {
      const { checkAndPickWinner } = await import("./hookWinnerPicker");
      return checkAndPickWinner(input.testId);
    }),

  // ── Hook Testing: Promote winner to full campaign ─────────────────────────────
  promoteHookWinner: protectedProcedure
    .input(z.object({
      testId: z.number(),
      fullDailyBudget: z.number().min(10).max(500).default(50),
    }))
    .mutation(async ({ input }) => {
      const { promoteWinnerToFullCampaign } = await import("./hookWinnerPicker");
      return promoteWinnerToFullCampaign(input.testId, input.fullDailyBudget);
    }),
});
