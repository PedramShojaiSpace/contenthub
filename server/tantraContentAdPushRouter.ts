import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TANTRA_CONTENT_AD_VARIANTS } from "../shared/tantraContentAds";
import { metaAdPushes } from "../drizzle/schema";
import { getDb } from "./db";
import { getMetaAdsConfig } from "./metaAdsClient";
import { protectedProcedure, router } from "./_core/trpc";

const API_VERSION = "v19.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const PAGE_ID = process.env.META_PAGE_ID ?? "";
const PUBLIC_ORIGIN = "https://content.theurbanmonk.com";

type MetaPushResult = { campaignId: string; adSetId: string; adIds: string[]; adsManagerUrl: string };

function getVariant(slug: string) {
  const variant = TANTRA_CONTENT_AD_VARIANTS.find((entry) => entry.slug === slug);
  if (!variant) throw new Error(`Content-ad package not found: ${slug}`);
  return variant;
}

async function metaPost<T>(endpoint: string, params: Record<string, unknown>, accessToken: string): Promise<T> {
  const body = new URLSearchParams({ access_token: accessToken });
  for (const [key, value] of Object.entries(params)) {
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const result = await response.json() as { error?: { message?: string; error_subcode?: number } } & T;
  if (!response.ok || result.error) {
    if (result.error?.error_subcode === 1885183) {
      throw new Error("META_APP_DEV_MODE: The Meta app must be switched to Live mode before Content Hub can create paused drafts.");
    }
    throw new Error(`Meta API error: ${result.error?.message ?? `HTTP ${response.status}`}`);
  }
  return result;
}

export const tantraContentAdPushRouter = router({
  getCatalog: protectedProcedure.query(() => TANTRA_CONTENT_AD_VARIANTS),

  createPausedVariantDrafts: protectedProcedure
    .input(z.object({
      slug: z.string(),
      optimizationGoal: z.enum(["LINK_CLICKS", "LANDING_PAGE_VIEWS"]).default("LINK_CLICKS"),
      dailyBudgetCents: z.number().int().min(100).max(10000).default(200),
    }))
    .mutation(async ({ input }): Promise<MetaPushResult> => {
      const variant = getVariant(input.slug);
      const config = getMetaAdsConfig();
      const db = await getDb();
      const account = `act_${config.adAccountId}`;
      const campaignName = `DRAFT — UM — Content — ${variant.title}`;

      const campaign = await metaPost<{ id: string }>(`${account}/campaigns`, {
        name: campaignName,
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
      }, config.accessToken);

      const adSet = await metaPost<{ id: string }>(`${account}/adsets`, {
        name: `DRAFT — Content — ${variant.title} — Broad US`,
        campaign_id: campaign.id,
        daily_budget: String(input.dailyBudgetCents),
        billing_event: "IMPRESSIONS",
        optimization_goal: input.optimizationGoal,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: {
          age_min: 35,
          age_max: 65,
          geo_locations: { countries: ["US"] },
          publisher_platforms: ["facebook", "instagram"],
          facebook_positions: ["feed"],
          instagram_positions: ["stream"],
          targeting_automation: { advantage_audience: 0 },
        },
        status: "PAUSED",
      }, config.accessToken);

      const image = await metaPost<{ images: Record<string, { hash: string }> }>(`${account}/adimages`, {
        url: `${PUBLIC_ORIGIN}${variant.imageUrl}`,
      }, config.accessToken);
      const imageHash = Object.values(image.images)[0]?.hash;
      if (!imageHash) throw new Error("Meta did not return an image hash for the approved content-ad visual.");

      const adIds: string[] = [];
      for (const ad of variant.ads) {
        const pending = db ? await db.insert(metaAdPushes).values({
          batchName: `Content Traffic — ${variant.title}`,
          variantSlug: variant.slug,
          adName: ad.adName,
          imageFile: variant.imageUrl,
          imageHash,
          headline: ad.headline,
          primaryText: ad.primaryText,
          description: ad.description,
          cta: ad.cta,
          landingUrl: ad.destinationUrl,
          status: "pending",
        }) : null;
        const pushId = (pending as any)?.insertId as number | undefined;
        try {
          const creative = await metaPost<{ id: string }>(`${account}/adcreatives`, {
            name: `${ad.adName} — Creative`,
            object_story_spec: { page_id: PAGE_ID },
            asset_feed_spec: {
              images: [{ hash: imageHash }],
              bodies: [{ text: ad.primaryText }],
              titles: [{ text: ad.headline }],
              descriptions: [{ text: ad.description }],
              link_urls: [{ website_url: ad.destinationUrl }],
              call_to_action_types: [ad.cta],
              ad_formats: ["SINGLE_IMAGE"],
            },
          }, config.accessToken);
          const metaAd = await metaPost<{ id: string }>(`${account}/ads`, {
            name: ad.adName,
            adset_id: adSet.id,
            creative: { creative_id: creative.id },
            status: "PAUSED",
          }, config.accessToken);
          adIds.push(metaAd.id);
          if (db && pushId) await db.update(metaAdPushes).set({
            metaCampaignId: campaign.id, metaAdSetId: adSet.id, metaCreativeId: creative.id, metaAdId: metaAd.id,
            status: "pushed", pushedAt: Date.now(),
          }).where(eq(metaAdPushes.id, pushId));
        } catch (error) {
          if (db && pushId) await db.update(metaAdPushes).set({ status: "failed", errorMessage: error instanceof Error ? error.message : String(error) }).where(eq(metaAdPushes.id, pushId));
          throw error;
        }
      }

      return {
        campaignId: campaign.id,
        adSetId: adSet.id,
        adIds,
        adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${config.adAccountId}&campaign_ids=${campaign.id}`,
      };
    }),

  getRecentContentDrafts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(metaAdPushes).where(eq(metaAdPushes.batchName, "Content Traffic")).orderBy(desc(metaAdPushes.createdAt)).limit(50);
  }),
});
