/**
 * Meta Ads tRPC Router
 * Exposes campaign data, insights, creative fatigue alerts, and pixel diagnostics
 * to the Content Hub Ads Manager dashboard.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
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
});
