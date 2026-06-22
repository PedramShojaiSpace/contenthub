/**
 * Meta Ad Push Router
 *
 * Handles pushing ad creatives from the Content Hub to Meta Ads Manager.
 * Supports:
 *   - Listing all ad batches (5 variants × 3 ads = 15 ads)
 *   - Pushing a single ad or entire variant batch to Meta (PAUSED, no budget)
 *   - Tracking push history in the database
 *   - Checking push status
 *
 * NOTE: The Meta app must be in Live mode for ad creative creation to work.
 * If the app is in development mode, the push will fail with error code 1885183.
 * To fix: go to developers.facebook.com → Your App → App Settings → switch to Live.
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { metaAdPushes } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getMetaAdsConfig } from "./metaAdsClient";

const API_VERSION = "v19.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const LANDING_URL = "https://theacademy.theurbanmonk.com/a/2148285846/PpCdamnj";
const PAGE_ID = process.env.META_PAGE_ID ?? "";

// ─── Ad Catalog Entry Type ──────────────────────────────────────────────────
interface AdEntry {
  adId: string;
  adName: string;
  imageFile: string;
  imageHash: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  landingUrl?: string;
}

// ─── Ad Copy Catalog ──────────────────────────────────────────────────────────
// All 15 ads: 5 variants × 3 ads each
// Images are already uploaded to Meta's ad image library
export const AD_CATALOG: Array<{ variantNum: number; variantSlug: string; variantName: string; ads: AdEntry[] }> = [
  // VARIANT 1: /precision — Chronically fatigued, dismissed by conventional medicine
  {
    variantNum: 1,
    variantSlug: "precision",
    variantName: "Precision Health — Normal Labs, Still Sick",
    ads: [
      {
        adId: "precision-a",
        adName: 'Ad 1-A — "Your Labs Say You\'re Fine"',
        imageFile: "ad-precision-1.webp",
        imageHash: "17740cd8293e363216359517407b14f8",
        headline: "Your Blood Work Is Normal. So Why Do You Feel Broken?",
        primaryText: `Your doctor ran the bloodwork. Everything came back normal.

But you're exhausted in a way that sleep doesn't fix. You're dragging through your days, doing all the right things, and still feeling like a fraction of yourself.

Here's what nobody told you: conventional blood panels don't test for gut permeability — the hidden inflammatory process that's been linked to chronic fatigue, brain fog, and systemic inflammation in tens of thousands of patients.

The KBMO FIT-22 test measures 22 foods and their cellular inflammatory response. Then you sit down with a certified health coach for a full hour to map out exactly what's driving your symptoms — and what to do about it.

Stop guessing. Start knowing.`,
        description: "The KBMO FIT-22 Test + 1-Hour Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "precision-b",
        adName: 'Ad 1-B — "Told You\'re Healthy. Still Feel Terrible."',
        imageFile: "ad-precision-2.webp",
        imageHash: "cf900bc60abb4c601016afa611bfbec6",
        headline: 'The Test That Explains Why You Feel Terrible Despite "Normal" Labs',
        primaryText: `You've been to the doctor. Maybe more than once.

The answer is always the same: "Your results look fine. Maybe try reducing stress."

But you know something is wrong. The fatigue is real. The brain fog is real. The feeling that your body is fighting something — that's real too.

What conventional medicine isn't testing is gut permeability. When the gut barrier breaks down, inflammatory proteins enter the bloodstream and trigger a cascade of symptoms that look like a dozen different conditions — none of which show up on standard labs.

The KBMO FIT-22 test identifies exactly which foods are driving your cellular inflammation. Your 1-hour consultation with a certified health coach turns those results into a clear, personalized action plan.

This is the test that changes the conversation.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "WATCH_MORE",
      },
      {
        adId: "precision-c",
        adName: 'Ad 1-C — "Slept 8 Hours. Still Exhausted."',
        imageFile: "ad-precision-3.webp",
        imageHash: "5e3a70b0bc00fdc1482d0b1420eafb23",
        headline: "Slept 8 Hours. Still Exhausted. Here's Why.",
        primaryText: `You're not lazy. You're not depressed. You're not "just getting older."

You're exhausted at a cellular level — and there's a specific, measurable reason for it.

When the gut barrier is compromised, a bacterial toxin called LPS leaks into the bloodstream. Your immune system responds with chronic low-grade inflammation. Your mitochondria — the energy factories inside every cell — start to fail.

The KBMO FIT-22 test identifies the specific foods triggering your inflammatory response. In your 1-hour session with a certified health coach, you'll get a personalized protocol to begin repairing the root cause.

This kind of tired has a root cause. It's time to find it.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
    ],
  },
  // VARIANT 2: /optimizer — Biohacker hitting an optimization ceiling
  {
    variantNum: 2,
    variantSlug: "optimizer",
    variantName: "Biohacker Ceiling — Optimized Everything Except the Gut",
    ads: [
      {
        adId: "optimizer-a",
        adName: 'Ad 2-A — "It\'s 3AM. Your Body Is Wide Awake."',
        imageFile: "ad-optimizer-1.webp",
        imageHash: "462889262c7636b3dc43b85d2dd80537",
        headline: "You've Optimized Everything. Your Gut Barrier Is Still Broken.",
        primaryText: `You track your sleep. You know your HRV. You've read Attia, Huberman, and Rhonda Patrick. You eat clean, exercise consistently, and have more supplements in your cabinet than most people have in their entire house.

And yet you're waking up at 3am completely wired — unable to get back to sleep.

Here's the mechanism nobody's talking about in the biohacking community: gut barrier failure allows LPS (lipopolysaccharide) to enter the bloodstream. Your liver peaks its detox cycle between 1–3am. When LPS is circulating, that detox process triggers cortisol — and cortisol wakes you up.

The KBMO FIT-22 test identifies the specific foods driving your gut permeability. Your 1-hour session with a certified health coach maps out the exact protocol to repair the barrier — and finally close the loop on your optimization stack.

This is the missing variable.`,
        description: "KBMO FIT-22 + 1-Hour Expert Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "optimizer-b",
        adName: 'Ad 2-B — "Your HRV Is Tanking. Your Gut Is the Reason."',
        imageFile: "ad-optimizer-2.webp",
        imageHash: "1d1528e99bf35d8c8542fa012cfdb6b5",
        headline: "Your HRV Is Declining. Your Gut Barrier Is the Missing Variable.",
        primaryText: `You've been tracking your HRV for months. The trend is clear — and it's not going in the right direction.

You've tried everything: better sleep hygiene, cold plunges, breathwork, magnesium, ashwagandha. Nothing is moving the needle.

Here's what most biohackers miss: HRV is a direct measure of vagal tone — and vagal tone is directly suppressed by systemic inflammation. If your gut barrier is compromised, LPS enters the bloodstream and triggers a chronic inflammatory state that your nervous system cannot escape.

The KBMO FIT-22 test identifies the specific foods driving your gut permeability. Your 1-hour consultation with a certified health coach gives you a targeted protocol to repair the barrier and restore the anti-inflammatory signaling your HRV depends on.

This is the variable your stack is missing.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "optimizer-c",
        adName: 'Ad 2-C — "You\'ve Optimized Everything. Except Your Gut Barrier."',
        imageFile: "ad-optimizer-3.webp",
        imageHash: "71540094e0c4650b7e36c593573ee3a6",
        headline: "The Optimization Ceiling Is a Gut Barrier Problem.",
        primaryText: `You've done the work. You've built the habits. You've invested in the tools.

And you've hit a ceiling you can't explain.

Energy that should be there — isn't. Recovery that should be faster — isn't. Mental clarity that should be sharper — isn't.

The biohacking community talks endlessly about inputs: sleep, light, cold, breathwork, supplements. What it rarely addresses is the upstream variable that determines how well your body can use any of those inputs: gut barrier integrity.

When the gut barrier fails, the inflammatory cascade it triggers suppresses mitochondrial function, disrupts cortisol rhythms, and blunts the very adaptations you're training for.

The KBMO FIT-22 test identifies the specific foods driving your gut permeability. Your 1-hour session with a certified health coach gives you a clear protocol to repair the root cause — and break through the ceiling.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
    ],
  },
  // VARIANT 3: /gutbrain — Anxiety/brain fog, mental health connection
  {
    variantNum: 3,
    variantSlug: "gutbrain",
    variantName: "Gut-Brain Axis — Anxiety & Brain Fog",
    ads: [
      {
        adId: "gutbrain-a",
        adName: 'Ad 3-A — "The Anxiety Is Real. But It\'s Not In Your Head."',
        imageFile: "ad-gutbrain-1.webp",
        imageHash: "31152c94f0a5f54a4eabf92c6320dcd2",
        headline: "The Anxiety Is Real. But It's Not In Your Head.",
        primaryText: `You've been told it's stress. You've been told to meditate. You've been told to breathe.

And you've tried all of it. The anxiety is still there.

Here's what the research shows: 90% of serotonin is produced in the gut — not the brain. When the gut barrier is compromised, the inflammatory cascade it triggers directly disrupts serotonin synthesis, vagal nerve signaling, and the neurochemical balance your nervous system depends on.

The KBMO FIT-22 test identifies the specific foods driving your gut permeability and the inflammatory response that's affecting your mental state. Your 1-hour consultation with a certified health coach gives you a clear, targeted protocol to address the root cause.

This is not a mindset problem. It's a biology problem. And it has a solution.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "gutbrain-b",
        adName: 'Ad 3-B — "Brain Fog Isn\'t a Mood. It\'s an Inflammation Signal."',
        imageFile: "ad-gutbrain-2.webp",
        imageHash: "6af7a5f1610f7913cea5cb00f1ee3ee2",
        headline: "Brain Fog Isn't a Mood. It's an Inflammation Signal.",
        primaryText: `You're not distracted. You're not unmotivated. You're not "just tired."

The fog is real. The inability to string a clear thought together — that's real. The feeling that you're operating through glass — that's real.

Brain fog is one of the most consistent symptoms of systemic inflammation. When the gut barrier breaks down, bacterial toxins enter the bloodstream and cross the blood-brain barrier. The neuroinflammation that follows disrupts cognitive function, working memory, and processing speed.

The KBMO FIT-22 test identifies the specific foods driving your gut permeability. Your 1-hour session with a certified health coach maps out a targeted protocol to reduce the inflammatory load and restore the mental clarity you've been missing.

This is a biology problem. And it has a measurable solution.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "gutbrain-c",
        adName: 'Ad 3-C — "Therapy Helps. But Is It Treating the Source?"',
        imageFile: "ad-gutbrain-3.webp",
        imageHash: "72d096f16a28a5ba149f71a042a177cf",
        headline: "Therapy Helps. But Is It Treating the Source?",
        primaryText: `You've done the work. The therapy. The journaling. The breathwork. The meditation.

And it helps. But the anxiety keeps coming back. The mood instability keeps returning. The fog never fully lifts.

Here's a question worth asking: what if part of what you're treating isn't psychological — it's biological?

The gut-brain axis is one of the most well-researched connections in modern neuroscience. When the gut barrier is compromised, the inflammatory cascade it triggers directly affects serotonin production, vagal nerve tone, and the neurochemical environment your mental health depends on.

The KBMO FIT-22 test identifies the specific foods driving your gut permeability. Your 1-hour consultation with a certified health coach gives you a targeted protocol to address the biological root — so the work you're already doing can actually land.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
    ],
  },
  // VARIANT 4: /autoimmune — Autoimmune flares, elimination diets
  {
    variantNum: 4,
    variantSlug: "autoimmune",
    variantName: "Autoimmune — Flares & Food Responses",
    ads: [
      {
        adId: "autoimmune-a",
        adName: 'Ad 4-A — "Your Immune System Isn\'t Broken. It\'s Fighting the Wrong Enemy."',
        imageFile: "ad-autoimmune-1.webp",
        imageHash: "22b859b60aa613e7b282b9b92af8cf54",
        headline: "Your Immune System Isn't Broken. It's Fighting the Wrong Enemy.",
        primaryText: `Autoimmune conditions don't come from nowhere.

They come from a gut barrier that has been compromised long enough that your immune system starts attacking your own tissue — because it can no longer tell the difference between a foreign invader and a part of you.

The KBMO FIT-22 test doesn't just look at food sensitivities. It measures the cellular inflammatory response to 22 specific foods — the same foods that may be driving the gut permeability that's fueling your immune system's misdirected attack.

Your 1-hour consultation with a certified health coach gives you a clear, targeted protocol to begin repairing the gut barrier — and reducing the inflammatory load your immune system is responding to.

This isn't about managing symptoms. It's about addressing the upstream cause.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "autoimmune-b",
        adName: 'Ad 4-B — "The Flares Aren\'t Random. They\'re a Food Response."',
        imageFile: "ad-autoimmune-2.webp",
        imageHash: "dabde5f8a048aa1cbd9bf5cdfb32035a",
        headline: "The Flares Aren't Random. They're a Food Response.",
        primaryText: `You've tracked your symptoms. You've noticed patterns. But you can't figure out the trigger.

Here's what makes autoimmune flares so confusing: the foods driving your immune response aren't always the obvious ones. Gluten and dairy get all the attention. But for many people, it's eggs, almonds, or even "healthy" foods like spinach that are triggering the cellular inflammatory response.

The KBMO FIT-22 test measures the specific cellular immune response to 22 foods — giving you a precise map of what's driving your inflammation, not a generic elimination protocol.

Your 1-hour consultation with a certified health coach turns those results into a clear, personalized action plan — so you can finally stop guessing and start healing.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "autoimmune-c",
        adName: 'Ad 4-C — "Tried Every Elimination Diet. Still Flaring."',
        imageFile: "ad-autoimmune-3.webp",
        imageHash: "3dffb5abb7b822b74287044cfd64b563",
        headline: "Tried Every Elimination Diet. Still Flaring. Here's Why.",
        primaryText: `You've done AIP. You've done Whole30. You've done low-FODMAP. You've removed gluten, dairy, soy, corn, eggs, and nightshades.

And you're still flaring.

The problem with standard elimination diets is that they're based on population-level data — not your specific immune response. The foods that trigger cellular inflammation are different for every person. And without testing, you're guessing.

The KBMO FIT-22 test measures your specific cellular inflammatory response to 22 foods. It tells you exactly which foods are driving your immune activation — not which foods drive inflammation in the average person.

Your 1-hour consultation with a certified health coach gives you a targeted, personalized protocol based on your actual results.

Stop eliminating everything. Start eliminating the right things.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
    ],
  },
  // VARIANT 5: /weight — Weight loss resistance, metabolic issues
  {
    variantNum: 5,
    variantSlug: "weight",
    variantName: "Weight Loss Resistance — Metabolic Inflammation",
    ads: [
      {
        adId: "weight-a",
        adName: 'Ad 5-A — "You\'re Doing Everything Right. So Why Won\'t the Scale Move?"',
        imageFile: "ad-weight-1.webp",
        imageHash: "8f5a4bc7001529752e1487d9f2763016",
        headline: "You're Doing Everything Right. So Why Won't the Scale Move?",
        primaryText: `You're eating less. You're moving more. You're tracking everything.

And the scale hasn't moved in months.

Here's what most weight loss programs don't tell you: inflammatory foods don't just affect your gut — they affect your metabolism. When the gut barrier is compromised, the LPS that enters the bloodstream triggers a chronic inflammatory state that directly impairs insulin sensitivity, disrupts leptin signaling, and puts your body into fat-storage mode.

The KBMO FIT-22 test identifies the specific foods driving your cellular inflammation. Your 1-hour consultation with a certified health coach gives you a clear protocol to reduce the inflammatory load that's blocking your metabolic function.

This isn't a willpower problem. It's a biology problem.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "weight-b",
        adName: 'Ad 5-B — "These Foods Are Healthy. For Most People."',
        imageFile: "ad-weight-2.webp",
        imageHash: "fdefe98c76f49b5e474744c4d5b7f23b",
        headline: "These Foods Are Healthy. For Most People. Not Necessarily for You.",
        primaryText: `Salmon. Almonds. Spinach. Eggs. Blueberries.

These are foods that every nutrition expert recommends. And for most people, they're genuinely healthy.

But for some people — people with specific gut permeability patterns — these foods trigger a cellular inflammatory response that drives weight gain, bloating, fatigue, and metabolic resistance.

The KBMO FIT-22 test doesn't measure general food quality. It measures your specific cellular immune response to 22 foods. It tells you which "healthy" foods are actually working against your body — and which ones are safe to eat.

Your 1-hour consultation with a certified health coach gives you a personalized protocol based on your actual results.

Eat for your biology. Not for the algorithm.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "weight-c",
        adName: 'Ad 5-C — "Tried Keto. Paleo. Fasting. The Scale Didn\'t Move."',
        imageFile: "ad-weight-3.webp",
        imageHash: "665ce0584c93bc1368e09ff9efc316fa",
        headline: "Tried Keto. Paleo. Fasting. The Scale Didn't Move. Here's Why.",
        primaryText: `You've tried every diet. You've read every book. You've followed every protocol.

And nothing has worked long-term.

Here's the pattern most people miss: every diet that "works for a while" works because it accidentally removes foods that were triggering your specific cellular inflammatory response. And every diet that "stops working" stops working because it reintroduces those foods — or because the inflammation was never fully addressed.

The KBMO FIT-22 test identifies the specific foods driving your cellular inflammation — not based on general principles, but based on your actual immune response.

Your 1-hour consultation with a certified health coach gives you a targeted, personalized protocol that works with your biology — not against it.

Stop cycling through diets. Start eating for your actual metabolism.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
    ],
  },
];

// ─── Meta API Helper ──────────────────────────────────────────────────────────
async function metaPost<T = any>(
  endpoint: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const url = `${BASE_URL}/${endpoint}`;
  const flatParams: Record<string, string> = { access_token: accessToken };
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
      flatParams[k] = JSON.stringify(v);
    } else {
      flatParams[k] = String(v);
    }
  }
  const body = new URLSearchParams(flatParams);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    const subcode = json.error?.error_subcode;
    if (subcode === 1885183) {
      throw new Error(
        "META_APP_DEV_MODE: The Meta app is in development mode. Go to developers.facebook.com → Your App → App Review → Switch to Live mode to enable ad creative creation."
      );
    }
    throw new Error(`Meta API error: ${msg}`);
  }
  return json as T;
}

// ─── Push a single ad to Meta ─────────────────────────────────────────────────
async function pushAdToMeta(
  ad: (typeof AD_CATALOG)[0]["ads"][0],
  variantSlug: string,
  variantName: string,
  accessToken: string,
  adAccountId: string,
  customAudienceId?: string
): Promise<{
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
}> {
  const actId = `act_${adAccountId}`;
  const campaignName = `KBMO — ${variantName} — ${ad.adName}`;

  // Step 1: Create Campaign (PAUSED, no budget)
  const campaignRes = await metaPost<{ id: string }>(
    `${actId}/campaigns`,
    {
      name: campaignName,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    },
    accessToken
  );

  // Step 2: Create Ad Set (PAUSED, no budget — will be set manually before launch)
  const adSetRes = await metaPost<{ id: string }>(
    `${actId}/adsets`,
    {
      name: `${campaignName} — Ad Set`,
      campaign_id: campaignRes.id,
      daily_budget: "500", // $5.00 placeholder — must be set before activating
      billing_event: "IMPRESSIONS",
      optimization_goal: "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify({
        age_min: 35,
        age_max: 65,
        geo_locations: { countries: ["US", "CA", "GB", "AU", "NZ"] },
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed"],
        instagram_positions: ["stream"],
        targeting_automation: { advantage_audience: 0 },
        ...(customAudienceId ? { custom_audiences: [{ id: customAudienceId }] } : {}),
      }),
      status: "PAUSED",
    },
    accessToken
  );

  // Step 3: Create Ad Creative using asset_feed_spec (matches existing account format)
  const creativeRes = await metaPost<{ id: string }>(
    `${actId}/adcreatives`,
    {
      name: `${campaignName} — Creative`,
      object_story_spec: JSON.stringify({ page_id: PAGE_ID }),
      asset_feed_spec: JSON.stringify({
        images: [{ hash: ad.imageHash }],
        bodies: [{ text: ad.primaryText }],
        titles: [{ text: ad.headline }],
        descriptions: [{ text: ad.description }],
        link_urls: [{ website_url: ad.landingUrl ?? LANDING_URL }],
        call_to_action_types: [ad.cta],
        ad_formats: ["SINGLE_IMAGE"],
      }),
    },
    accessToken
  );

  // Step 4: Create Ad (PAUSED)
  const adRes = await metaPost<{ id: string }>(
    `${actId}/ads`,
    {
      name: `${campaignName} — Ad`,
      adset_id: adSetRes.id,
      creative: JSON.stringify({ creative_id: creativeRes.id }),
      status: "PAUSED",
    },
    accessToken
  );

  return {
    campaignId: campaignRes.id,
    adSetId: adSetRes.id,
    creativeId: creativeRes.id,
    adId: adRes.id,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const metaAdPushRouter = router({
  // List the full ad catalog (no API calls)
  getCatalog: protectedProcedure.query(() => {
    return AD_CATALOG;
  }),

  // Get push history from DB
  getPushHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(metaAdPushes)
        .orderBy(desc(metaAdPushes.createdAt))
        .limit(input.limit);
    }),

  // Push a single ad to Meta
  pushAd: protectedProcedure
    .input(
      z.object({
        variantSlug: z.string(),
        adId: z.string(),
        batchName: z.string().optional(),
        customAudienceId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const config = getMetaAdsConfig();
      const db = await getDb();

      // Find the ad in the catalog
      const variant = AD_CATALOG.find((v) => v.variantSlug === input.variantSlug);
      if (!variant) throw new Error(`Variant not found: ${input.variantSlug}`);
      const ad = variant.ads.find((a) => a.adId === input.adId);
      if (!ad) throw new Error(`Ad not found: ${input.adId}`);

      const batchName = input.batchName ?? `KBMO Push ${new Date().toISOString().split("T")[0]}`;

      // Insert pending record
      let pushId: number | undefined;
      if (db) {
        const inserted = await db.insert(metaAdPushes).values({
          batchName,
          variantSlug: input.variantSlug,
          adName: ad.adName,
          imageFile: ad.imageFile,
          imageHash: ad.imageHash,
          headline: ad.headline,
          primaryText: ad.primaryText,
          description: ad.description ?? "",
          cta: ad.cta,
          landingUrl: ad.landingUrl ?? LANDING_URL,
          status: "pending",
        });
        pushId = (inserted as any).insertId;
      }

      try {
        const result = await pushAdToMeta(
          ad,
          input.variantSlug,
          variant.variantName,
          config.accessToken,
          config.adAccountId,
          input.customAudienceId
        );

        // Update DB with success
        if (db && pushId) {
          await db
            .update(metaAdPushes)
            .set({
              metaCampaignId: result.campaignId,
              metaAdSetId: result.adSetId,
              metaCreativeId: result.creativeId,
              metaAdId: result.adId,
              status: "pushed",
              pushedAt: Date.now(),
            })
            .where(eq(metaAdPushes.id, pushId));
        }

        return {
          success: true,
          ...result,
          adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${config.adAccountId}&campaign_ids=${result.campaignId}`,
        };
      } catch (err: any) {
        const errorMessage = err.message ?? "Unknown error";

        // Update DB with failure
        if (db && pushId) {
          await db
            .update(metaAdPushes)
            .set({
              status: "failed",
              errorMessage,
            })
            .where(eq(metaAdPushes.id, pushId));
        }

        // Re-throw with context
        throw new Error(errorMessage);
      }
    }),

  // Push all ads in a variant batch
  pushVariantBatch: protectedProcedure
    .input(
      z.object({
        variantSlug: z.string(),
        batchName: z.string().optional(),
        customAudienceId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const config = getMetaAdsConfig();
      const db = await getDb();

      const variant = AD_CATALOG.find((v) => v.variantSlug === input.variantSlug);
      if (!variant) throw new Error(`Variant not found: ${input.variantSlug}`);

      const batchName = input.batchName ?? `KBMO ${variant.variantName} — ${new Date().toISOString().split("T")[0]}`;
      const results: Array<{ adId: string; success: boolean; error?: string; metaIds?: any }> = [];

      for (const ad of variant.ads) {
        let pushId: number | undefined;
        if (db) {
          const inserted = await db.insert(metaAdPushes).values({
            batchName,
            variantSlug: input.variantSlug,
            adName: ad.adName,
            imageFile: ad.imageFile,
            imageHash: ad.imageHash,
            headline: ad.headline,
            primaryText: ad.primaryText,
            description: ad.description ?? "",
            cta: ad.cta,
            landingUrl: ad.landingUrl ?? LANDING_URL,
            status: "pending",
          });
          pushId = (inserted as any).insertId;
        }

        try {
          const result = await pushAdToMeta(
            ad,
            input.variantSlug,
            variant.variantName,
            config.accessToken,
            config.adAccountId,
            input.customAudienceId
          );

          if (db && pushId) {
            await db
              .update(metaAdPushes)
              .set({
                metaCampaignId: result.campaignId,
                metaAdSetId: result.adSetId,
                metaCreativeId: result.creativeId,
                metaAdId: result.adId,
                status: "pushed",
                pushedAt: Date.now(),
              })
              .where(eq(metaAdPushes.id, pushId));
          }

          results.push({ adId: ad.adId, success: true, metaIds: result });
        } catch (err: any) {
          const errorMessage = err.message ?? "Unknown error";
          if (db && pushId) {
            await db
              .update(metaAdPushes)
              .set({ status: "failed", errorMessage })
              .where(eq(metaAdPushes.id, pushId));
          }
          results.push({ adId: ad.adId, success: false, error: errorMessage });
        }
      }

      return { batchName, results };
    }),

  // Push ALL 15 ads across all 5 variants
  pushAllBatches: protectedProcedure
    .input(z.object({ batchName: z.string().optional(), customAudienceId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const config = getMetaAdsConfig();
      const db = await getDb();
      const batchName = input.batchName ?? `KBMO Full Push — ${new Date().toISOString().split("T")[0]}`;
      const allResults: Array<{ variantSlug: string; adId: string; success: boolean; error?: string }> = [];

      for (const variant of AD_CATALOG) {
        for (const ad of variant.ads) {
          let pushId: number | undefined;
          if (db) {
            const inserted = await db.insert(metaAdPushes).values({
              batchName,
              variantSlug: variant.variantSlug,
              adName: ad.adName,
              imageFile: ad.imageFile,
              imageHash: ad.imageHash,
              headline: ad.headline,
              primaryText: ad.primaryText,
              description: ad.description ?? "",
              cta: ad.cta,
              landingUrl: ad.landingUrl ?? LANDING_URL,
              status: "pending",
            });
            pushId = (inserted as any).insertId;
          }

          try {
          const result = await pushAdToMeta(
            ad,
            variant.variantSlug,
            variant.variantName,
            config.accessToken,
            config.adAccountId,
            input.customAudienceId
          );

            if (db && pushId) {
              await db
                .update(metaAdPushes)
                .set({
                  metaCampaignId: result.campaignId,
                  metaAdSetId: result.adSetId,
                  metaCreativeId: result.creativeId,
                  metaAdId: result.adId,
                  status: "pushed",
                  pushedAt: Date.now(),
                })
                .where(eq(metaAdPushes.id, pushId));
            }

            allResults.push({ variantSlug: variant.variantSlug, adId: ad.adId, success: true });
          } catch (err: any) {
            const errorMessage = err.message ?? "Unknown error";
            if (db && pushId) {
              await db
                .update(metaAdPushes)
                .set({ status: "failed", errorMessage })
                .where(eq(metaAdPushes.id, pushId));
            }
            allResults.push({ variantSlug: variant.variantSlug, adId: ad.adId, success: false, error: errorMessage });
          }
        }
      }

      const pushed = allResults.filter((r) => r.success).length;
      const failed = allResults.filter((r) => !r.success).length;
      return { batchName, pushed, failed, results: allResults };
    }),
});
