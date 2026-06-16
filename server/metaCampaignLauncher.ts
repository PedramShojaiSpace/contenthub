/**
 * Meta Campaign Launcher
 *
 * Creates Meta ad campaigns from Claude-generated recommendations.
 * Uses the Meta Marketing API (Graph API v21.0) to:
 *   1. Create the campaign
 *   2. Create an ad set with targeting and budget
 *   3. Create an ad creative using the YouTube video URL
 *   4. Create the ad linking creative to ad set
 *
 * All campaigns are created in PAUSED state for human review before going live.
 */

import { getMetaAdsConfig } from "./metaAdsClient";
import type { CampaignRecommendation } from "./campaignRecommendationEngine";
import { updateCandidateStatus } from "./organicSignalEngine";

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Re-export metaPost for internal use (it's not exported from metaAdsClient)
async function post<T = any>(
  endpoint: string,
  body: Record<string, any>,
  accessToken: string
): Promise<T> {
  const url = `${BASE_URL}/${endpoint}`;
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  for (const [k, v] of Object.entries(body)) {
    params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json() as any;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    const code = json.error?.code ?? res.status;
    throw new Error(`Meta API error [${code}] on POST /${endpoint}: ${msg}`);
  }
  return json as T;
}

export interface LaunchResult {
  campaignId: string;
  adSetId: string;
  adCreativeId: string;
  adId: string;
  adsManagerUrl: string;
}

/**
 * Map Claude's interest names to Meta's interest IDs.
 * Meta requires interest IDs for targeting — we use the search API to find them.
 */
async function resolveInterestIds(
  interests: string[],
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const resolved: Array<{ id: string; name: string }> = [];

  for (const interest of interests.slice(0, 8)) { // Max 8 interests
    try {
      const url = new URL(`${BASE_URL}/search`);
      url.searchParams.set("type", "adinterest");
      url.searchParams.set("q", interest);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("limit", "1");

      const res = await fetch(url.toString());
      const json = await res.json() as any;

      if (json.data?.[0]) {
        resolved.push({ id: json.data[0].id, name: json.data[0].name });
      }
    } catch (err) {
      console.warn(`[CampaignLauncher] Could not resolve interest "${interest}":`, err);
    }
  }

  return resolved;
}

/**
 * Launch a Meta ad campaign from a Claude recommendation.
 * All entities are created in PAUSED state.
 */
export async function launchCampaign(
  candidateId: number,
  youtubeVideoId: string,
  youtubeTitle: string,
  recommendation: CampaignRecommendation,
  launchedBy: string
): Promise<LaunchResult> {
  const config = getMetaAdsConfig();
  const { accessToken, adAccountId } = config;
  const actId = `act_${adAccountId}`;

  // ── Step 1: Create Campaign ───────────────────────────────────────────────
  console.log(`[CampaignLauncher] Creating campaign: "${recommendation.campaignName}"`);

  const campaignRes = await post<{ id: string }>(
    `${actId}/campaigns`,
    {
      name: recommendation.campaignName,
      objective: recommendation.objective,
      status: "PAUSED", // Always start paused — human reviews before activating
      special_ad_categories: "[]",
    },
    accessToken
  );
  const campaignId = campaignRes.id;
  console.log(`[CampaignLauncher] Campaign created: ${campaignId}`);

  // ── Step 2: Resolve Interest IDs ─────────────────────────────────────────
  const resolvedInterests = await resolveInterestIds(
    recommendation.targeting.interests,
    accessToken
  );

  // Build targeting spec
  const targetingSpec: Record<string, any> = {
    age_min: recommendation.targeting.ageMin,
    age_max: recommendation.targeting.ageMax,
    geo_locations: {
      countries: ["US", "CA", "GB", "AU", "NZ"], // English-speaking markets
    },
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "video_feeds"],
    instagram_positions: ["stream"],
  };

  // Add gender targeting if not both
  if (recommendation.targeting.genders.length === 1) {
    targetingSpec.genders = recommendation.targeting.genders[0] === "male" ? [1] : [2];
  }

  // Add interests if resolved
  if (resolvedInterests.length > 0) {
    targetingSpec.interests = resolvedInterests;
  }

  // ── Step 3: Create Ad Set ─────────────────────────────────────────────────
  console.log(`[CampaignLauncher] Creating ad set with $${recommendation.dailyBudgetUsd}/day budget`);

  const adSetRes = await post<{ id: string }>(
    `${actId}/adsets`,
    {
      name: `${recommendation.campaignName} — Ad Set`,
      campaign_id: campaignId,
      daily_budget: Math.round(recommendation.dailyBudgetUsd * 100), // Meta uses cents
      billing_event: "IMPRESSIONS",
      optimization_goal: recommendation.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: targetingSpec,
      status: "PAUSED",
      // Run for the recommended number of days from tomorrow
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 + recommendation.recommendedRunDays * 86400000).toISOString(),
    },
    accessToken
  );
  const adSetId = adSetRes.id;
  console.log(`[CampaignLauncher] Ad set created: ${adSetId}`);

  // ── Step 4: Create Ad Creative ────────────────────────────────────────────
  // Use the YouTube video as the ad creative via video URL
  console.log(`[CampaignLauncher] Creating ad creative for video ${youtubeVideoId}`);

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

  const creativeRes = await post<{ id: string }>(
    `${actId}/adcreatives`,
    {
      name: `${recommendation.campaignName} — Creative`,
      object_story_spec: JSON.stringify({
        page_id: process.env.META_PAGE_ID ?? adAccountId, // Use page ID if available
        link_data: {
          link: recommendation.landingPage.url,
          message: recommendation.creative.primaryText,
          name: recommendation.creative.headline,
          description: recommendation.creative.description,
          call_to_action: {
            type: recommendation.creative.callToAction.toUpperCase().replace(/ /g, "_"),
            value: { link: recommendation.landingPage.url },
          },
          // Include YouTube video as the media
          picture: `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
        },
      }),
    },
    accessToken
  );
  const adCreativeId = creativeRes.id;
  console.log(`[CampaignLauncher] Creative created: ${adCreativeId}`);

  // ── Step 5: Create Ad ─────────────────────────────────────────────────────
  const adRes = await post<{ id: string }>(
    `${actId}/ads`,
    {
      name: `${recommendation.campaignName} — Ad`,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: adCreativeId }),
      status: "PAUSED",
    },
    accessToken
  );
  const adId = adRes.id;
  console.log(`[CampaignLauncher] Ad created: ${adId}`);

  // ── Step 6: Update candidate status in DB ────────────────────────────────
  await updateCandidateStatus(candidateId, "launched", {
    metaCampaignId: campaignId,
    metaAdSetId: adSetId,
    metaAdId: adId,
    launchedBy,
  });

  const adsManagerUrl = `https://www.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${campaignId}`;

  console.log(`[CampaignLauncher] ✅ Campaign launched (PAUSED): ${adsManagerUrl}`);

  return {
    campaignId,
    adSetId,
    adCreativeId,
    adId,
    adsManagerUrl,
  };
}
