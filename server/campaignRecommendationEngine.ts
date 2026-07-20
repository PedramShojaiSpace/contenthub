/**
 * Campaign Recommendation Engine
 *
 * Uses Claude to generate Meta ad campaign recommendations for videos
 * flagged by the organic signal engine as strong performers.
 *
 * Output includes:
 *   - Campaign objective and structure
 *   - Audience targeting recommendations
 *   - Budget and bid strategy
 *   - Ad creative brief (headline, body, CTA)
 *   - Landing page recommendation
 *   - Expected performance benchmarks
 */

import { invokeLLM } from "./_core/llm";
import { updateCandidateStatus } from "./organicSignalEngine";
import type { PaidPromoCandidate } from "../drizzle/schema";

export interface CampaignRecommendation {
  // Campaign structure
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS";
  objectiveRationale: string;
  campaignName: string;

  // Budget
  dailyBudgetUsd: number;
  budgetRationale: string;
  recommendedRunDays: number;

  // Audience targeting
  targeting: {
    ageMin: number;
    ageMax: number;
    genders: ("male" | "female")[];
    interests: string[];
    behaviors: string[];
    customAudienceSuggestions: string[];
    excludedAudiences: string[];
    geographicFocus: string;
  };

  // Ad creative
  creative: {
    primaryText: string;       // Main ad body copy (max 125 chars for feed)
    headline: string;          // 40 chars max
    description: string;       // 30 chars max
    callToAction: string;      // e.g. "Learn More", "Sign Up", "Watch Now"
    videoUsage: "full_video" | "first_30s" | "highlight_clip";
    videoUsageRationale: string;
  };

  // Landing page
  landingPage: {
    url: string;
    rationale: string;
  };

  // Expected benchmarks
  benchmarks: {
    expectedCPM: string;       // e.g. "$8–$14"
    expectedCTR: string;       // e.g. "1.5–3%"
    expectedCPL: string;       // e.g. "$12–$25"
    expectedLeadsPerDay: string; // e.g. "3–8"
  };

  // Why this video
  whyThisVideo: string;

  // Risks and notes
  notes: string;
}

// Urban Monk product catalog for landing page recommendations
const PRODUCT_CATALOG = [
  {
    name: "Lights On Course",
    url: "https://lightson.theurbanmonk.com?utm_source=meta&utm_medium=paid_social&utm_campaign=organic_signal",
    price: "$369/year",
    topics: ["mindfulness", "productivity", "focus", "morning routine", "energy", "purpose", "habits", "stress", "sleep"],
  },
  {
    name: "Urban Monk Academy",
    url: "https://lightson.theurbanmonk.com?utm_source=meta&utm_medium=paid_social&utm_campaign=organic_signal",
    price: "$297/year",
    topics: ["meditation", "health", "wellness", "longevity", "nutrition", "qi gong", "spiritual", "taoist"],
  },
  {
    name: "Upstream Course",
    url: "https://theurbanmonk.com/upstream?utm_source=meta&utm_medium=paid_social&utm_campaign=organic_signal",
    price: "$399",
    topics: ["gut health", "inflammation", "autoimmune", "food sensitivity", "microbiome", "digestion"],
  },
  {
    name: "KBMO Testing",
    url: "https://theurbanmonk.com/testing?utm_source=meta&utm_medium=paid_social&utm_campaign=organic_signal",
    price: "$299",
    topics: ["testing", "lab work", "health assessment", "food sensitivity", "gut permeability"],
  },
];

/**
 * Generate a campaign recommendation for a paid promo candidate using Claude.
 */
export async function generateCampaignRecommendation(
  candidate: PaidPromoCandidate
): Promise<CampaignRecommendation> {
  const engagementRate = parseFloat(candidate.engagementRate ?? "0");
  const outlierScore = parseFloat(candidate.outlierScore ?? "0");
  const viewVelocity = candidate.viewVelocity ?? 0;

  const systemPrompt = `You are an expert Meta (Facebook/Instagram) advertising strategist for Dr. Pedram Shojai, the Urban Monk. 

Dr. Pedram Shojai is a Doctor of Oriental Medicine, New York Times bestselling author, and wellness entrepreneur. His audience is health-conscious, spiritually curious, high-performing professionals aged 35–65 who want to optimize their mind, body, and spirit.

His core products:
${PRODUCT_CATALOG.map(p => `- ${p.name} (${p.price}): Best for topics: ${p.topics.join(", ")}`).join("\n")}

Your job is to generate a precise, actionable Meta ad campaign recommendation for a YouTube video that is outperforming organically. The recommendation must be realistic, data-driven, and immediately executable.

Return ONLY valid JSON matching the CampaignRecommendation schema. No markdown, no explanation outside the JSON.`;

  const userPrompt = `Generate a Meta ad campaign recommendation for this high-performing YouTube video:

Title: "${candidate.youtubeTitle}"
YouTube URL: https://www.youtube.com/watch?v=${candidate.youtubeVideoId}

Organic Performance Metrics (72 hours post-publish):
- Views: ${candidate.viewCount.toLocaleString()}
- Likes: ${candidate.likeCount.toLocaleString()}
- Comments: ${candidate.commentCount.toLocaleString()}
- Engagement Rate: ${engagementRate.toFixed(2)}% (likes+comments/views)
- View Velocity: ${viewVelocity} views/day
- Outlier Score: ${outlierScore.toFixed(2)}x (vs channel average)
- Signal Strength: ${candidate.signalStrength}

Based on the video title and these metrics, determine:
1. Which Urban Monk product this video best leads to
2. The right campaign objective (leads for courses, traffic for awareness)
3. Specific Meta interest and behavior targeting for Dr. Pedram's audience
4. A daily budget appropriate for testing ($30–$100/day range)
5. Ad copy that mirrors the organic hook that made this video perform well
6. Realistic CPL benchmarks for the wellness/personal development niche

Return this exact JSON structure:
{
  "objective": "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS",
  "objectiveRationale": "string",
  "campaignName": "string (max 50 chars)",
  "dailyBudgetUsd": number,
  "budgetRationale": "string",
  "recommendedRunDays": number,
  "targeting": {
    "ageMin": number,
    "ageMax": number,
    "genders": ["male", "female"],
    "interests": ["array of 5-8 specific Meta interest categories"],
    "behaviors": ["array of 2-4 Meta behavior categories"],
    "customAudienceSuggestions": ["array of 2-3 custom audience ideas"],
    "excludedAudiences": ["array of audiences to exclude"],
    "geographicFocus": "string"
  },
  "creative": {
    "primaryText": "string (max 125 chars, hook-first, no emojis in first line)",
    "headline": "string (max 40 chars)",
    "description": "string (max 30 chars)",
    "callToAction": "Learn More" | "Sign Up" | "Watch More" | "Get Started",
    "videoUsage": "full_video" | "first_30s" | "highlight_clip",
    "videoUsageRationale": "string"
  },
  "landingPage": {
    "url": "string (one of the product URLs above with UTM params)",
    "rationale": "string"
  },
  "benchmarks": {
    "expectedCPM": "string e.g. $8–$14",
    "expectedCTR": "string e.g. 1.5–3%",
    "expectedCPL": "string e.g. $12–$25",
    "expectedLeadsPerDay": "string e.g. 3–8"
  },
  "whyThisVideo": "string (2-3 sentences on why this organic signal indicates paid potential)",
  "notes": "string (any risks, creative testing suggestions, or optimization tips)"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "campaign_recommendation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            objective: { type: "string", enum: ["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"] },
            objectiveRationale: { type: "string" },
            campaignName: { type: "string" },
            dailyBudgetUsd: { type: "number" },
            budgetRationale: { type: "string" },
            recommendedRunDays: { type: "number" },
            targeting: {
              type: "object",
              properties: {
                ageMin: { type: "number" },
                ageMax: { type: "number" },
                genders: { type: "array", items: { type: "string" } },
                interests: { type: "array", items: { type: "string" } },
                behaviors: { type: "array", items: { type: "string" } },
                customAudienceSuggestions: { type: "array", items: { type: "string" } },
                excludedAudiences: { type: "array", items: { type: "string" } },
                geographicFocus: { type: "string" },
              },
              required: ["ageMin", "ageMax", "genders", "interests", "behaviors", "customAudienceSuggestions", "excludedAudiences", "geographicFocus"],
              additionalProperties: false,
            },
            creative: {
              type: "object",
              properties: {
                primaryText: { type: "string" },
                headline: { type: "string" },
                description: { type: "string" },
                callToAction: { type: "string" },
                videoUsage: { type: "string", enum: ["full_video", "first_30s", "highlight_clip"] },
                videoUsageRationale: { type: "string" },
              },
              required: ["primaryText", "headline", "description", "callToAction", "videoUsage", "videoUsageRationale"],
              additionalProperties: false,
            },
            landingPage: {
              type: "object",
              properties: {
                url: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["url", "rationale"],
              additionalProperties: false,
            },
            benchmarks: {
              type: "object",
              properties: {
                expectedCPM: { type: "string" },
                expectedCTR: { type: "string" },
                expectedCPL: { type: "string" },
                expectedLeadsPerDay: { type: "string" },
              },
              required: ["expectedCPM", "expectedCTR", "expectedCPL", "expectedLeadsPerDay"],
              additionalProperties: false,
            },
            whyThisVideo: { type: "string" },
            notes: { type: "string" },
          },
          required: [
            "objective", "objectiveRationale", "campaignName", "dailyBudgetUsd",
            "budgetRationale", "recommendedRunDays", "targeting", "creative",
            "landingPage", "benchmarks", "whyThisVideo", "notes"
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  const recommendation: CampaignRecommendation = JSON.parse(content);
  return recommendation;
}

/**
 * Generate recommendation for a candidate and save it to the DB.
 */
export async function generateAndSaveRecommendation(
  candidate: PaidPromoCandidate
): Promise<CampaignRecommendation> {
  const recommendation = await generateCampaignRecommendation(candidate);

  await updateCandidateStatus(candidate.id, "recommended", {
    claudeRecommendation: recommendation,
  });

  return recommendation;
}
