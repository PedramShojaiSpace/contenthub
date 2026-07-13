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
//
// COMPLIANCE NOTE (Meta Ad Policy 2026):
// All copy has been reviewed against Meta's Personal Attributes Policy,
// Cosmetic Procedures and Wellness Policy, and Health & Wellness rules.
// Key changes from original:
//   - Removed second-person health-status language ("You're exhausted", "The anxiety is still there")
//   - Replaced treatment/repair framing with structure-function language
//   - Removed implied diagnosis language ("You're not depressed", "You're not distracted")
//   - Reframed as educational/third-person where needed
//   - Kept strong hooks while removing personal attribute assertions
export const AD_CATALOG: Array<{ variantNum: number; variantSlug: string; variantName: string; ads: AdEntry[] }> = [
  // VARIANT 1: /precision — Chronically fatigued, dismissed by conventional medicine
  {
    variantNum: 1,
    variantSlug: "precision",
    variantName: "Precision Health — Normal Labs, Still Sick",
    ads: [
      {
        adId: "precision-a",
        adName: 'Ad 1-A — "Normal Labs, Still Sick"',
        imageFile: "ad-precision-1.webp",
        imageHash: "17740cd8293e363216359517407b14f8",
        headline: "Blood Work Comes Back Normal. Energy Still Isn't There.",
        primaryText: `Standard blood panels came back clean. The doctor says everything looks fine.

But persistent fatigue, brain fog, and low energy tell a different story — and conventional panels don't test for gut permeability, one of the most studied factors in how people feel day to day.

When the gut barrier is compromised, inflammatory proteins can enter the bloodstream and affect energy, cognition, and overall vitality in ways that don't appear on standard labs.

The KBMO FIT-22 test measures 22 foods and their cellular inflammatory response. A 1-hour session with a certified health coach maps out exactly what the data shows — and what to do with it.

Stop guessing. Start knowing.`,
        description: "The KBMO FIT-22 Test + 1-Hour Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "precision-b",
        adName: 'Ad 1-B — "The Test That Explains the Gap"',
        imageFile: "ad-precision-2.webp",
        imageHash: "cf900bc60abb4c601016afa611bfbec6",
        headline: "When Labs Look Fine But Energy Doesn't Match",
        primaryText: `Many people visit their doctor with persistent fatigue, brain fog, and a general sense that something is off — only to be told their results look fine.

Conventional medicine often doesn't test for gut permeability. When the gut barrier is compromised, inflammatory proteins enter the bloodstream and may contribute to a range of symptoms that don't appear on standard panels.

The KBMO FIT-22 test identifies which foods are driving cellular inflammation. The 1-hour consultation with a certified health coach turns those results into a clear, personalized action plan.

This is the test that gives you data to work with.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "WATCH_MORE",
      },
      {
        adId: "precision-c",
        adName: 'Ad 1-C — "Slept 8 Hours. Still Exhausted."',
        imageFile: "ad-precision-3.webp",
        imageHash: "5e3a70b0bc00fdc1482d0b1420eafb23",
        headline: "Slept 8 Hours. Still Exhausted. Here's the Biology.",
        primaryText: `Persistent fatigue despite adequate sleep is one of the most common complaints in functional medicine — and one of the most frequently overlooked.

When the gut barrier is compromised, a bacterial toxin called LPS can enter the bloodstream. The immune system responds with chronic low-grade inflammation. Mitochondrial function — the cellular energy production process — may be affected as a result.

The KBMO FIT-22 test identifies the specific foods associated with this inflammatory response. In a 1-hour session with a certified health coach, the results are translated into a personalized protocol to support gut barrier health.

Persistent fatigue has measurable contributors. This test helps identify them.`,
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
        adName: 'Ad 2-A — "The 3AM Wake-Up Has a Mechanism"',
        imageFile: "ad-optimizer-1.webp",
        imageHash: "462889262c7636b3dc43b85d2dd80537",
        headline: "Optimized Sleep Stack. Still Waking Up at 3AM. Here's Why.",
        primaryText: `Tracking sleep. Monitoring HRV. Clean diet, consistent exercise, a full supplement stack.

And still waking up at 3am, unable to get back to sleep.

Here's the mechanism the biohacking community rarely discusses: gut barrier compromise allows LPS (lipopolysaccharide) to enter the bloodstream. The liver peaks its detox cycle between 1–3am. When LPS is circulating, that detox process can trigger cortisol — and cortisol disrupts sleep.

The KBMO FIT-22 test identifies the specific foods associated with gut permeability. The 1-hour session with a certified health coach maps out a protocol to support gut barrier health and address the missing variable in the optimization stack.

This is the variable most stacks are missing.`,
        description: "KBMO FIT-22 + 1-Hour Expert Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "optimizer-b",
        adName: 'Ad 2-B — "HRV Declining. Gut Is the Missing Variable."',
        imageFile: "ad-optimizer-2.webp",
        imageHash: "1d1528e99bf35d8c8542fa012cfdb6b5",
        headline: "HRV Declining Despite Doing Everything Right. The Gut May Be Why.",
        primaryText: `Months of HRV tracking. The trend is moving in the wrong direction despite sleep hygiene, cold plunges, breathwork, magnesium, and ashwagandha.

Here's what most biohackers miss: HRV is a direct measure of vagal tone — and vagal tone is suppressed by systemic inflammation. When the gut barrier is compromised, LPS enters the bloodstream and may contribute to a chronic inflammatory state that affects nervous system recovery.

The KBMO FIT-22 test identifies the specific foods associated with gut permeability. The 1-hour consultation with a certified health coach provides a targeted protocol to support gut barrier integrity and the anti-inflammatory signaling that HRV depends on.

This is the variable most optimization stacks are missing.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "optimizer-c",
        adName: 'Ad 2-C — "The Optimization Ceiling Is a Gut Barrier Problem"',
        imageFile: "ad-optimizer-3.webp",
        imageHash: "71540094e0c4650b7e36c593573ee3a6",
        headline: "The Optimization Ceiling Is a Gut Barrier Problem.",
        primaryText: `The habits are built. The tools are in place. The work is being done.

And there's still a ceiling that can't be explained.

Energy that should be there isn't. Recovery that should be faster isn't. Mental clarity that should be sharper isn't.

The biohacking community focuses on inputs: sleep, light, cold, breathwork, supplements. What it rarely addresses is the upstream variable that determines how well the body uses any of those inputs: gut barrier integrity.

When the gut barrier is compromised, the resulting inflammatory cascade may suppress mitochondrial function, disrupt cortisol rhythms, and blunt the adaptations being trained for.

The KBMO FIT-22 test identifies the specific foods associated with gut permeability. The 1-hour session with a certified health coach provides a clear protocol to support gut barrier health and break through the ceiling.`,
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
        adName: 'Ad 3-A — "The Gut-Brain Connection"',
        imageFile: "ad-gutbrain-1.webp",
        imageHash: "31152c94f0a5f54a4eabf92c6320dcd2",
        headline: "The Gut-Brain Connection Is One of the Most Researched Areas in Modern Wellness.",
        primaryText: `90% of serotonin is produced in the gut — not the brain. This is one of the most replicated findings in modern neuroscience.

When the gut barrier is compromised, the inflammatory cascade it triggers may disrupt serotonin synthesis, vagal nerve signaling, and the neurochemical balance the nervous system depends on.

For many people, mood and cognitive symptoms have a biological component that standard approaches don't address.

The KBMO FIT-22 test identifies the specific foods associated with gut permeability and the inflammatory response that may affect mental clarity and mood. The 1-hour consultation with a certified health coach provides a clear, targeted protocol to support gut barrier health.

Gut health and mental wellness are connected. This test helps map that connection.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "gutbrain-b",
        adName: 'Ad 3-B — "Brain Fog Isn\'t a Mood. It\'s an Inflammation Signal."',
        imageFile: "ad-gutbrain-2.webp",
        imageHash: "6af7a5f1610f7913cea5cb00f1ee3ee2",
        headline: "Brain Fog Isn't a Mood. It's an Inflammation Signal.",
        primaryText: `Brain fog — the inability to think clearly, maintain focus, or access working memory — is one of the most consistent symptoms of systemic inflammation in functional medicine research.

When the gut barrier breaks down, bacterial toxins can enter the bloodstream and cross the blood-brain barrier. The neuroinflammation that follows may disrupt cognitive function, working memory, and processing speed.

The KBMO FIT-22 test identifies the specific foods associated with gut permeability. The 1-hour session with a certified health coach maps out a targeted protocol to support gut barrier health and the mental clarity that depends on it.

Brain fog has measurable contributors. This is how to identify them.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "gutbrain-c",
        adName: 'Ad 3-C — "Therapy Helps. But Is There a Biological Layer?"',
        imageFile: "ad-gutbrain-3.webp",
        imageHash: "72d096f16a28a5ba149f71a042a177cf",
        headline: "Therapy Helps. But Is There a Biological Layer Worth Exploring?",
        primaryText: `Therapy, journaling, breathwork, and meditation are valuable tools. Many people find they help.

But for some, mood challenges keep returning despite consistent effort. A question worth exploring: is there a biological component that isn't being addressed?

The gut-brain axis is one of the most well-researched connections in modern neuroscience. When the gut barrier is compromised, the inflammatory cascade it triggers may directly affect serotonin production, vagal nerve tone, and the neurochemical environment that mood depends on.

The KBMO FIT-22 test identifies the specific foods associated with gut permeability. The 1-hour consultation with a certified health coach provides a targeted protocol to support gut barrier health — so the other work being done can have a stronger foundation.`,
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
        adName: 'Ad 4-A — "Gut Barrier Integrity and Immune Function"',
        imageFile: "ad-autoimmune-1.webp",
        imageHash: "22b859b60aa613e7b282b9b92af8cf54",
        headline: "Gut Barrier Integrity Plays a Central Role in Immune Function.",
        primaryText: `Research consistently shows that gut barrier health is closely connected to how the immune system behaves.

When the gut barrier is compromised over time, the immune system may begin responding to substances that would otherwise be filtered out — contributing to the kind of chronic, low-grade immune activation that functional medicine practitioners often investigate.

The KBMO FIT-22 test measures the cellular inflammatory response to 22 specific foods — the same foods that may be associated with gut permeability and immune system activation.

The 1-hour consultation with a certified health coach provides a clear, targeted protocol to support gut barrier integrity and reduce the inflammatory load the immune system may be responding to.

Gut health and immune function are connected. This test helps identify the specific foods involved.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "autoimmune-b",
        adName: 'Ad 4-B — "Flares Aren\'t Random. They Follow a Food Pattern."',
        imageFile: "ad-autoimmune-2.webp",
        imageHash: "dabde5f8a048aa1cbd9bf5cdfb32035a",
        headline: "Flares Aren't Random. They Follow a Food Pattern.",
        primaryText: `Symptom tracking often reveals patterns — but identifying the specific trigger can be difficult when the foods involved aren't the obvious ones.

Gluten and dairy get most of the attention. But research shows that eggs, almonds, and even foods commonly considered "healthy" like spinach can trigger cellular inflammatory responses in people with specific gut permeability patterns.

The KBMO FIT-22 test measures the specific cellular immune response to 22 foods — providing a precise map of which foods are associated with inflammation, rather than a generic elimination protocol.

The 1-hour consultation with a certified health coach turns those results into a clear, personalized action plan based on the actual data.

Stop guessing at triggers. Start working from data.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "autoimmune-c",
        adName: 'Ad 4-C — "Tried Every Elimination Diet. Still Flaring."',
        imageFile: "ad-autoimmune-3.webp",
        imageHash: "3dffb5abb7b822b74287044cfd64b563",
        headline: "Tried AIP. Whole30. Low-FODMAP. Still Flaring. Here's Why.",
        primaryText: `AIP. Whole30. Low-FODMAP. Removing gluten, dairy, soy, corn, eggs, and nightshades.

And symptoms persist.

The limitation of standard elimination diets is that they're based on population-level data — not individual immune response. The foods that trigger cellular inflammation vary significantly from person to person. Without testing, the process is essentially guesswork.

The KBMO FIT-22 test measures the specific cellular inflammatory response to 22 foods. It identifies which foods are associated with immune activation for that individual — not which foods drive inflammation on average.

The 1-hour consultation with a certified health coach provides a targeted, personalized protocol based on the actual test results.

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
        adName: 'Ad 5-A — "Eating Less. Moving More. Scale Not Moving."',
        imageFile: "ad-weight-1.webp",
        imageHash: "8f5a4bc7001529752e1487d9f2763016",
        headline: "Eating Less. Moving More. Scale Not Moving. Here's the Biology.",
        primaryText: `Calorie deficit. Consistent exercise. Tracking every meal.

And the scale hasn't moved in months.

What most weight loss programs don't address: inflammatory foods don't just affect the gut — they affect metabolism. When the gut barrier is compromised, LPS that enters the bloodstream may trigger a chronic inflammatory state that can affect insulin sensitivity, leptin signaling, and the body's tendency toward fat storage.

The KBMO FIT-22 test identifies the specific foods associated with cellular inflammation. The 1-hour consultation with a certified health coach provides a clear protocol to support gut barrier health and the metabolic function that depends on it.

Weight loss resistance often has measurable biological contributors. This test helps identify them.`,
        description: "KBMO FIT-22 Gut Permeability Test + Expert Health Coach Consultation — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "weight-b",
        adName: 'Ad 5-B — "These Foods Are Healthy. For Most People."',
        imageFile: "ad-weight-2.webp",
        imageHash: "fdefe98c76f49b5e474744c4d5b7f23b",
        headline: "These Foods Are Healthy. For Most People. Individual Response Varies.",
        primaryText: `Salmon. Almonds. Spinach. Eggs. Blueberries.

Every nutrition expert recommends them. For most people, they're genuinely healthy.

But research shows that for individuals with specific gut permeability patterns, these same foods can trigger a cellular inflammatory response that may contribute to weight gain, bloating, fatigue, and metabolic resistance.

The KBMO FIT-22 test doesn't measure general food quality. It measures the specific cellular immune response to 22 foods — identifying which foods are associated with inflammation for that individual, not the average person.

The 1-hour consultation with a certified health coach provides a personalized protocol based on the actual test results.

Eat for your biology. Not for the algorithm.`,
        description: "KBMO FIT-22 + 1-Hour Certified Health Coach Session — $399",
        cta: "LEARN_MORE",
      },
      {
        adId: "weight-c",
        adName: 'Ad 5-C — "Tried Keto. Paleo. Fasting. The Scale Didn\'t Move."',
        imageFile: "ad-weight-3.webp",
        imageHash: "665ce0584c93bc1368e09ff9efc316fa",
        headline: "Tried Keto. Paleo. Fasting. The Scale Didn't Move. Here's the Pattern.",
        primaryText: `Every diet. Every book. Every protocol.

And nothing has worked long-term.

Here's a pattern worth understanding: diets that "work for a while" often work because they accidentally remove foods that were triggering a specific cellular inflammatory response. Diets that "stop working" often stop working because those foods get reintroduced — or because the underlying inflammation was never fully addressed.

The KBMO FIT-22 test identifies the specific foods associated with cellular inflammation — not based on general principles, but based on the individual's actual immune response.

The 1-hour consultation with a certified health coach provides a targeted, personalized protocol that works with individual biology.

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
