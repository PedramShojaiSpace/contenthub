/**
 * Push all 3 Tantra quiz ads to Meta Ads Manager as PAUSED drafts
 * Calls the Content Hub's tRPC endpoint directly
 */
import https from "https";
import { config } from "dotenv";

config({ path: ".env" });

const ACCESS_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
  console.error("Missing META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  process.exit(1);
}

// Call Meta Graph API directly to push each ad
// Campaign → Ad Set → Creative → Ad (all PAUSED)

const BASE_URL = "https://graph.facebook.com/v19.0";
const accountId = AD_ACCOUNT_ID.replace("act_", "");

const TANTRA_ADS = [
  {
    adId: "tantra-a",
    adName: 'Ad T-A — "Is Your Life Force Running on Empty?"',
    imageHash: "7209ffde013d2c4f8e380b202251753b",
    headline: "Is Your Life Force Running on Empty?",
    primaryText: `I spent 10 years as a Taoist monk studying the traditions that treat sexual energy as the root of all vitality.

What I found changed everything I knew about medicine.

Most people think low libido is about age. Or stress. Or just "how it is now."

It isn't.

It's a signal — your body's way of telling you that the root system is depleted. And when the root is depleted, everything suffers: energy, mood, drive, connection, aliveness.

The good news? It's reversible. But you have to know what's actually depleting you first.

Take this free 2-minute quiz. I'll show you exactly what's draining your life force — and what to do about it.`,
    description: "Free 2-minute quiz — personalized results from Dr. Pedram Shojai, OMD",
    cta: "LEARN_MORE",
    landingUrl: "https://content.theurbanmonk.com/quiz/tantra",
  },
  {
    adId: "tantra-b",
    adName: "Ad T-B — \"Why Don't I Want to Anymore?\"",
    imageHash: "6010d473874a5ea927ad3676024cfa13",
    headline: "Why Don't I Want to Anymore?",
    primaryText: `It's one of the most common questions I hear in my practice — and almost nobody talks about it out loud.

"I used to want to. Now I just... don't."

This isn't a relationship problem. It isn't a willpower problem. It isn't even an aging problem.

It's a biology problem — specifically, the depletion of three neurochemicals that drive desire, connection, and aliveness.

Modern life systematically strips them out. Chronic stress. Poor sleep. Environmental toxins. The wrong foods. Years of running on cortisol.

The result? A flatness that feels permanent but isn't.

I built a 2-minute quiz that identifies exactly which pathway is depleted in your body — and gives you a personalized East-West protocol to restore it.

No credit card. No email required to start. Just answers.`,
    description: "Find out what's actually depleting your desire — free quiz from Dr. Pedram Shojai",
    cta: "LEARN_MORE",
    landingUrl: "https://content.theurbanmonk.com/quiz/tantra",
  },
  {
    adId: "tantra-c",
    adName: "Ad T-C — \"The Taoist Secret to Sexual Vitality\"",
    imageHash: "756cc9bab2a3388507b94f83b4301d2d",
    headline: "The Taoist Secret to Sexual Vitality (It's Not What You Think)",
    primaryText: `In Taoist medicine, sexual energy isn't separate from health — it IS health.

The ancient masters called it Jing: the root essence that powers your immune system, your brain, your hormones, and your will to live.

When Jing is full, everything works. When it's depleted — and modern life depletes it relentlessly — you feel it everywhere. Low drive. Brain fog. Emotional flatness. The spark gone from your relationship.

I spent 10 years as a Taoist monk and 20 years as a doctor of Oriental medicine studying how to restore it.

What I found is that the ancient approach and modern clinical science point to the same three compounds — and when you combine them in the right ratios, the results are remarkable.

Take this free 2-minute quiz to find out which formula is right for your body.`,
    description: "Ancient wisdom + modern science — free personalized quiz from Dr. Pedram Shojai, OMD",
    cta: "LEARN_MORE",
    landingUrl: "https://content.theurbanmonk.com/quiz/tantra",
  },
];

function post(endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({ access_token: ACCESS_TOKEN, ...params }).toString();
    const urlObj = new URL(`${BASE_URL}/${endpoint}`);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("Parse error: " + data)); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function pushAd(ad) {
  const campaignName = `Tantra Quiz — ${ad.adName}`;
  console.log(`\n→ Pushing: ${ad.adName}`);

  // 1. Create Campaign
  const campaign = await post(`act_${accountId}/campaigns`, {
    name: campaignName,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: JSON.stringify([]),
    is_adset_budget_sharing_enabled: "false",
  });
  if (campaign.error) throw new Error(`Campaign: ${campaign.error.message} (code ${campaign.error.code}, subcode ${campaign.error.error_subcode}) — ${JSON.stringify(campaign.error)}`);
  console.log(`  Campaign: ${campaign.id}`);

  // 2. Create Ad Set
  const adSet = await post(`act_${accountId}/adsets`, {
    name: `${campaignName} — Ad Set`,
    campaign_id: campaign.id,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_amount: "500",
    daily_budget: "2000",
    targeting: JSON.stringify({
      geo_locations: { countries: ["US", "CA", "GB", "AU", "NZ"] },
      age_min: 35,
      age_max: 65,
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed"],
      instagram_positions: ["stream"],
      targeting_automation: { advantage_audience: 0 },
    }),
    status: "PAUSED",
  });
  if (adSet.error) throw new Error(`AdSet: ${adSet.error.message} — ${JSON.stringify(adSet.error)}`);
  console.log(`  Ad Set:   ${adSet.id}`);

  // 3. Create Ad Creative
  const creative = await post(`act_${accountId}/adcreatives`, {
    name: `${campaignName} — Creative`,
    object_story_spec: JSON.stringify({
      page_id: process.env.META_PAGE_ID,
      link_data: {
        image_hash: ad.imageHash,
        link: ad.landingUrl,
        message: ad.primaryText,
        name: ad.headline,
        description: ad.description,
        call_to_action: { type: ad.cta, value: { link: ad.landingUrl } },
      },
    }),
  });
  if (creative.error) throw new Error(`Creative: ${creative.error.message}`);
  console.log(`  Creative: ${creative.id}`);

  // 4. Create Ad
  const adResult = await post(`act_${accountId}/ads`, {
    name: campaignName,
    adset_id: adSet.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: "PAUSED",
  });
  if (adResult.error) throw new Error(`Ad: ${adResult.error.message}`);
  console.log(`  Ad:       ${adResult.id}`);

  return { campaignId: campaign.id, adSetId: adSet.id, creativeId: creative.id, adId: adResult.id };
}

console.log("=== Pushing 3 Tantra Quiz Ads to Meta (PAUSED) ===");
const results = [];
for (const ad of TANTRA_ADS) {
  try {
    const ids = await pushAd(ad);
    results.push({ adId: ad.adId, success: true, ...ids });
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    results.push({ adId: ad.adId, success: false, error: e.message });
  }
}

console.log("\n=== PUSH RESULTS ===");
console.log(JSON.stringify(results, null, 2));

const succeeded = results.filter((r) => r.success).length;
const failed = results.filter((r) => !r.success).length;
console.log(`\n✓ ${succeeded} ads pushed successfully as PAUSED drafts`);
if (failed > 0) console.log(`✗ ${failed} ads failed`);
