/**
 * hookGenerator.ts
 * 
 * Generates 5 viral hook variants for a given topic/script using Claude.
 * Each variant uses a different proven framework, calibrated for:
 * - Pedram Shojai's handheld authentic video format
 * - Cold Meta audience (35-65, health/wellness interest)
 * - Urban Monk product suite (Lights On, Academy, Upstream, KBMO)
 * 
 * Based on analysis of 10,000+ Meta ads — see /viral-hook-research.md
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { hookGenerations } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export type HookFramework =
  | "contradiction"
  | "curiosityGap"
  | "specificity"
  | "socialProof"
  | "directChallenge"
  | "fearUrgency"
  | "repFormula"
  | "authorityOpener";

export type TargetProduct =
  | "lightsOn"
  | "lightsOnCourse"
  | "academy"
  | "upstream"
  | "kbmoTesting"
  | "sleepTestKit"
  | "orobiomeTestKit"
  | "general";

export interface HookVariant {
  framework: HookFramework;
  frameworkLabel: string;
  hookText: string;           // The spoken hook (first 3-5 seconds of video)
  overlayText: string;        // Short text overlay for top-third of frame (max 8 words)
  whyItWorks: string;         // Brief explanation for Pedram's reference
  estimatedCTRLift: string;   // e.g. "+35-55% vs generic hooks"
  deliveryNote: string;       // How Pedram should deliver this hook on camera
}

export interface BodyScript {
  spokenScript: string;        // Full body script Pedram reads on camera (30-60 seconds)
  keyPoints: string[];         // 3-4 bullet points covered in the body
  deliveryNote: string;        // Tone/pace/setting guidance
  estimatedDuration: string;   // e.g. "35-45 seconds"
}

export interface CtaVariant {
  ctaText: string;             // The spoken CTA (last 5-10 seconds)
  overlayText: string;         // Short text overlay (max 8 words)
  urgencyMechanism: string;    // What creates urgency (scarcity, transformation, etc.)
  deliveryNote: string;        // How to deliver it
}

export interface HookGenerationResult {
  topic: string;
  targetProduct: TargetProduct;
  variants: HookVariant[];
  bodyScript?: BodyScript;
  ctaVariants?: CtaVariant[];
  generatedAt: Date;
}

const FRAMEWORK_DESCRIPTIONS: Record<HookFramework, { label: string; ctrLift: string }> = {
  contradiction: {
    label: "Contradiction / Pattern Interrupt",
    ctrLift: "+35-55% vs generic hooks",
  },
  curiosityGap: {
    label: "Curiosity Gap",
    ctrLift: "+28-48% vs generic hooks",
  },
  specificity: {
    label: "Specificity / Data",
    ctrLift: "+22-40% vs generic hooks",
  },
  socialProof: {
    label: "Social Proof / Transformation",
    ctrLift: "+18-35% vs generic hooks",
  },
  directChallenge: {
    label: "Direct Challenge",
    ctrLift: "+30-50% vs generic hooks",
  },
  fearUrgency: {
    label: "Fear / Urgency",
    ctrLift: "+25-45% vs generic hooks",
  },
  repFormula: {
    label: "REP Formula (Relatable + Emotion + Payoff)",
    ctrLift: "+40-60% for authentic delivery",
  },
  authorityOpener: {
    label: "Authority Opener",
    ctrLift: "+20-38% for cold audiences",
  },
};

const PRODUCT_CONTEXT: Record<TargetProduct, string> = {
  lightsOn: `Lights On course ($369/year) — 10 modules, 52 weeks of perceptual training. 
    Best hooks: Contradiction + Specificity. Target: people feeling mentally foggy, distracted, spiritually adrift.`,
  lightsOnCourse: `Lights On Course (paid digital course) — energy, focus, and perceptual clarity training. 
    Best hooks: Contradiction + Specificity. Target: high-performers feeling foggy, burned out, or spiritually adrift.`,
  academy: `Urban Monk Academy ($297/year) — subscription community, courses, practices. 
    Best hooks: Authority + Transformation. Target: people seeking integrated health, Eastern + Western medicine.`,
  upstream: `Upstream Course — gut health, root cause medicine, functional health. 
    Best hooks: Direct Challenge + Specificity. Target: people with chronic symptoms who've tried everything.`,
  kbmoTesting: `KBMO Food Sensitivity Testing ($299) — identifies hidden inflammatory triggers. 
    Best hooks: Fear/Urgency + Specificity. Target: people with unexplained fatigue, bloating, inflammation.`,
  sleepTestKit: `Sleep Test Kit — at-home sleep quality analysis. 
    Best hooks: Fear/Urgency + Curiosity Gap. Target: people with poor sleep, fatigue, or suspected sleep apnea.`,
  orobiomeTestKit: `Orobiome Test Kit ($299) — oral microbiome analysis for systemic health. 
    Best hooks: Specificity + Curiosity Gap. Target: people with dental issues, gut problems, or chronic inflammation.`,
  general: `General Urban Monk brand awareness — Dr. Pedram Shojai, OMD, author of 8 books. 
    Best hooks: Authority + REP Formula. Target: health-conscious adults 35-65.`,
};

const HOOK_GENERATOR_PROMPT = (
  topic: string,
  targetProduct: TargetProduct,
  existingFrameworks: HookFramework[]
) => `You are a world-class direct response copywriter specializing in viral video hooks for Meta ads.

You are writing hooks for Dr. Pedram Shojai — an OMD (Doctor of Oriental Medicine), former monk, author of 8 books including "The Urban Monk" and "Rise and Shine", who has treated thousands of patients over 30 years. He speaks with calm authority, genuine warmth, and deep expertise. He is NOT a hype marketer — his hooks should feel authentic, credible, and slightly surprising.

VIDEO FORMAT: Handheld authentic video. Pedram speaking directly to camera, likely outdoors or in a natural setting. No teleprompter feel. Conversational but purposeful.

TOPIC: ${topic}

TARGET PRODUCT: ${PRODUCT_CONTEXT[targetProduct]}

CRITICAL RULES FOR HOOKS:
1. The hook is the FIRST 3-5 seconds of spoken audio — no intro, no "hey guys", no setup
2. Start mid-thought or with the core tension — pattern interrupt immediately
3. The hook text overlay (shown in top third of frame) is MAX 8 words — make it punchy
4. Delivery should feel like Pedram is sharing something he genuinely believes, not selling
5. Avoid: "I", "me", "my" as the first word — start with "You", "Most", "The", "What", "Stop", "After", etc.
6. Each hook must be DISTINCTLY different — different angle, different emotion, different entry point

FRAMEWORKS TO USE (generate one hook per framework, pick 5 from this list, AVOID these already used: ${existingFrameworks.join(", ")}):
- contradiction: Challenge a common belief ("Everyone says X. They're wrong.")
- curiosityGap: Create an open loop ("The reason you can't X has nothing to do with Y")
- specificity: Use data/credentials/numbers ("After 30 years and 10,000 patients...")
- socialProof: Transformation story ("My patients kept asking me why...")
- directChallenge: Call out the specific avatar ("If you're over 40 and still tired...")
- fearUrgency: Name the hidden threat ("The silent thing draining your energy every day")
- repFormula: Relatable → Emotional → Payoff (3-beat structure)
- authorityOpener: Lead with credentials in a non-braggy way

RESPOND WITH VALID JSON ONLY. No markdown, no explanation outside the JSON.

{
  "variants": [
    {
      "framework": "contradiction",
      "hookText": "The full spoken hook — 1-3 sentences, 3-5 seconds when spoken at natural pace",
      "overlayText": "Max 8 words for text overlay",
      "whyItWorks": "One sentence explaining the psychological mechanism",
      "deliveryNote": "How Pedram should physically deliver this — tone, pace, eye contact, setting"
    }
  ]
}`;

const BODY_SCRIPT_PROMPT = (topic: string, targetProduct: TargetProduct) =>
  `You are a world-class direct response copywriter writing for Dr. Pedram Shojai — an OMD, former monk, author of 8 books. He speaks with calm authority, genuine warmth, and deep expertise. NOT a hype marketer.

VIDEO FORMAT: Handheld authentic video. Pedram speaking directly to camera. Conversational but purposeful. 30-60 seconds of spoken content.

TOPIC: ${topic}
TARGET PRODUCT: ${PRODUCT_CONTEXT[targetProduct]}

Write the BODY SCRIPT — the middle section of the video that comes after the hook and before the CTA.

RULES:
1. Deliver the core value/insight promised by the hook — don't bait-and-switch
2. Use one concrete story, statistic, or patient example to make it real
3. Bridge naturally to the product — don't hard sell, let the insight create desire
4. Conversational sentences, max 2-3 sentences per beat
5. Total spoken length: 30-60 seconds at natural pace

RESPOND WITH VALID JSON ONLY.
{
  "spokenScript": "full script here",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "deliveryNote": "guidance for Pedram",
  "estimatedDuration": "35-45 seconds"
}`;

const CTA_PROMPT = (topic: string, targetProduct: TargetProduct) =>
  `You are a world-class direct response copywriter writing CTAs for Dr. Pedram Shojai — an OMD, former monk, author of 8 books. Calm authority, genuine warmth. NOT a hype marketer.

TOPIC: ${topic}
TARGET PRODUCT: ${PRODUCT_CONTEXT[targetProduct]}

Write 5 DIFFERENT CTA variants for the END of the video (last 5-10 seconds of spoken content).

Each CTA must:
1. Be a natural spoken close — not a hard sell
2. Direct the viewer to take ONE specific action (click link, take test, join, etc.)
3. Use a DIFFERENT urgency/motivation mechanism each time:
   - Transformation promise
   - Scarcity/exclusivity
   - Ease/simplicity
   - Social proof
   - Direct ask / challenge
4. Feel like Pedram genuinely recommending something he believes in
5. Max 2-3 sentences spoken

RESPOND WITH VALID JSON ONLY.
{
  "ctas": [
    {
      "ctaText": "full spoken CTA",
      "overlayText": "max 8 words for text overlay",
      "urgencyMechanism": "what creates the pull",
      "deliveryNote": "how Pedram should deliver this"
    }
  ]
}`;

export async function generateBodyAndCta(
  topic: string,
  targetProduct: TargetProduct = "general"
): Promise<{ bodyScript: BodyScript; ctaVariants: CtaVariant[] }> {
  // Run body and CTA generation in parallel
  const [bodyResponse, ctaResponse] = await Promise.all([
    invokeLLM({
      messages: [
        { role: "system", content: "You are a video script specialist. Respond ONLY with valid JSON. No markdown fences." },
        { role: "user", content: BODY_SCRIPT_PROMPT(topic, targetProduct) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "body_script",
          strict: true,
          schema: {
            type: "object",
            properties: {
              spokenScript: { type: "string" },
              keyPoints: { type: "array", items: { type: "string" } },
              deliveryNote: { type: "string" },
              estimatedDuration: { type: "string" },
            },
            required: ["spokenScript", "keyPoints", "deliveryNote", "estimatedDuration"],
            additionalProperties: false,
          },
        },
      },
    }),
    invokeLLM({
      messages: [
        { role: "system", content: "You are a direct response CTA specialist. Respond ONLY with valid JSON. No markdown fences." },
        { role: "user", content: CTA_PROMPT(topic, targetProduct) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cta_variants",
          strict: true,
          schema: {
            type: "object",
            properties: {
              ctas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ctaText: { type: "string" },
                    overlayText: { type: "string" },
                    urgencyMechanism: { type: "string" },
                    deliveryNote: { type: "string" },
                  },
                  required: ["ctaText", "overlayText", "urgencyMechanism", "deliveryNote"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ctas"],
            additionalProperties: false,
          },
        },
      },
    }),
  ]);

  const bodyRaw = bodyResponse.choices[0].message.content as string;
  const ctaRaw = ctaResponse.choices[0].message.content as string;

  const bodyScript = JSON.parse(bodyRaw) as BodyScript;
  const ctaVariants = (JSON.parse(ctaRaw) as { ctas: CtaVariant[] }).ctas.slice(0, 5);

  return { bodyScript, ctaVariants };
}

export async function generateHookVariants(
  topic: string,
  targetProduct: TargetProduct = "general",
  count: number = 5,
  existingFrameworks: HookFramework[] = []
): Promise<HookGenerationResult> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a viral video hook specialist. You respond ONLY with valid JSON. No markdown fences, no explanation.",
      },
      {
        role: "user",
        content: HOOK_GENERATOR_PROMPT(topic, targetProduct, existingFrameworks),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hook_variants",
        strict: true,
        schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  framework: { type: "string" },
                  hookText: { type: "string" },
                  overlayText: { type: "string" },
                  whyItWorks: { type: "string" },
                  deliveryNote: { type: "string" },
                },
                required: ["framework", "hookText", "overlayText", "whyItWorks", "deliveryNote"],
                additionalProperties: false,
              },
            },
          },
          required: ["variants"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0].message.content as string;
  const parsed = JSON.parse(raw) as { variants: Omit<HookVariant, "frameworkLabel" | "estimatedCTRLift">[] };

  const variants: HookVariant[] = parsed.variants.slice(0, count).map((v) => ({
    ...v,
    framework: v.framework as HookFramework,
    frameworkLabel:
      FRAMEWORK_DESCRIPTIONS[v.framework as HookFramework]?.label ?? v.framework,
    estimatedCTRLift:
      FRAMEWORK_DESCRIPTIONS[v.framework as HookFramework]?.ctrLift ?? "varies",
  }));

  return {
    topic,
    targetProduct,
    variants,
    generatedAt: new Date(),
  };
}

export async function saveHookGeneration(
  userId: string,
  topic: string,
  targetProduct: TargetProduct,
  variants: HookVariant[],
  _sessionId?: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(hookGenerations).values({
    topic,
    platform: "meta",
    targetPersona: targetProduct,
    hooksJson: JSON.stringify(variants),
  });
  return (result as any).insertId as number;
}

export async function getHookGenerations(_userId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(hookGenerations)
    .orderBy(desc(hookGenerations.createdAt))
    .limit(limit);
}
