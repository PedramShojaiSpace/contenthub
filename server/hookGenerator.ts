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
  | "academy"
  | "upstream"
  | "kbmoTesting"
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

export interface HookGenerationResult {
  topic: string;
  targetProduct: TargetProduct;
  variants: HookVariant[];
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
  academy: `Urban Monk Academy ($297/year) — subscription community, courses, practices. 
    Best hooks: Authority + Transformation. Target: people seeking integrated health, Eastern + Western medicine.`,
  upstream: `Upstream Course — gut health, root cause medicine, functional health. 
    Best hooks: Direct Challenge + Specificity. Target: people with chronic symptoms who've tried everything.`,
  kbmoTesting: `KBMO Food Sensitivity Testing ($299) — identifies hidden inflammatory triggers. 
    Best hooks: Fear/Urgency + Specificity. Target: people with unexplained fatigue, bloating, inflammation.`,
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
