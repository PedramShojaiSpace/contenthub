/**
 * ctaRouter.ts
 * Topical CTA Library for Urban Monk Content Hub.
 */

import { getDb } from "./db";
import { ctaBlocks } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";

const DEFAULT_CTA_BLOCKS = [
  {
    label: "Lights On (Default)",
    ctaText: "Ready to turn the lights on in your life? Join the Lights On course — $369/yr — and get the exact system Dr. Pedram Shojai uses to help his patients reclaim their energy, focus, and vitality. go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1",
    url: "https://go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1",
    keywords: JSON.stringify(["general", "wellness", "health", "energy", "vitality", "life", "transformation"]),
    isDefault: true,
    active: true,
  },
  {
    label: "Sleep",
    ctaText: "If your sleep is broken, everything else suffers. The Urban Monk Academy has a complete Sleep Optimization module. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["sleep", "insomnia", "rest", "circadian", "melatonin", "deep sleep", "sleep quality", "night", "tired", "fatigue", "exhausted", "waking up"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Gut Health",
    ctaText: "Your gut is your second brain. The Urban Monk Academy's Gut Health module covers the microbiome, leaky gut, and the food-mood-energy connection. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["gut", "microbiome", "digestion", "leaky gut", "probiotics", "prebiotics", "bloating", "IBS", "intestinal", "bowel", "stomach", "digestive", "oral health", "bacteria"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Detox",
    ctaText: "We live in the most toxic environment in human history. The Urban Monk Academy's Detox module gives you a practical, science-backed protocol. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["detox", "toxins", "cleanse", "heavy metals", "mold", "pesticides", "chemicals", "liver", "lymph", "drainage", "environmental toxins", "clean living"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Stress & Nervous System",
    ctaText: "Chronic stress is the root of most modern disease. The Urban Monk Academy's Nervous System Reset module teaches you how to move out of fight-or-flight. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["stress", "anxiety", "cortisol", "nervous system", "fight or flight", "parasympathetic", "vagus nerve", "burnout", "overwhelm", "adrenal", "HPA axis", "tension", "worry"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Energy & Mitochondria",
    ctaText: "Low energy is a mitochondrial problem. The Urban Monk Academy's Energy Optimization module shows you how to rebuild cellular energy from the ground up. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["energy", "mitochondria", "fatigue", "tired", "ATP", "cellular energy", "coffee", "caffeine", "afternoon crash", "brain fog", "sluggish", "low energy"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Mindfulness & Meditation",
    ctaText: "The Urban Monk Academy's Meditation module includes Dr. Pedram's personal Qigong and meditation practices, refined over 30 years. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["meditation", "mindfulness", "qigong", "breathwork", "presence", "awareness", "mind", "consciousness", "focus", "attention", "stillness", "inner peace", "zen"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Ancient Wisdom",
    ctaText: "The Urban Monk Academy bridges 5,000 years of Eastern wisdom with cutting-edge Western science. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["ancient", "traditional", "TCM", "Chinese medicine", "Ayurveda", "acupuncture", "herbs", "qi", "chi", "meridian", "chakra", "wisdom", "ancestral", "indigenous", "shamanic"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Performance & Longevity",
    ctaText: "Peak performance is about recovering smarter. The Urban Monk Academy's Performance module covers the biohacking protocols Dr. Pedram uses with executives and athletes. urbanmonk.com/academy",
    url: "https://urbanmonk.com/academy",
    keywords: JSON.stringify(["performance", "longevity", "biohacking", "optimization", "productivity", "cognitive", "brain", "nootropics", "flow state", "peak", "athlete", "executive", "high performer"]),
    isDefault: false,
    active: true,
  },
];

export async function seedCtaBlocks(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(ctaBlocks);

  if (existing.length === 0) {
    // Fresh install — insert all defaults
    for (const block of DEFAULT_CTA_BLOCKS) {
      await db.insert(ctaBlocks).values(block);
    }
    console.log("[CTA] Seeded", DEFAULT_CTA_BLOCKS.length, "CTA blocks.");
    return;
  }

  // Update existing blocks to ensure URLs and text are always current
  for (const block of DEFAULT_CTA_BLOCKS) {
    const match = existing.find((e) => e.label === block.label);
    if (match) {
      await db
        .update(ctaBlocks)
        .set({
          ctaText: block.ctaText,
          url: block.url,
          keywords: block.keywords,
          isDefault: block.isDefault,
          active: block.active,
        })
        .where(eq(ctaBlocks.id, match.id));
    } else {
      await db.insert(ctaBlocks).values(block);
    }
  }
  console.log("[CTA] Refreshed", DEFAULT_CTA_BLOCKS.length, "CTA blocks.");
}

export async function getCtaForTopic(topic: string): Promise<{
  label: string;
  ctaText: string;
  url: string | null;
}> {
  const db = await getDb();
  if (!db) return { label: "Lights On (Default)", ctaText: "Join the Lights On course — $369/yr — at go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1", url: "https://go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1" };
  await seedCtaBlocks();
  const allBlocks = await db.select().from(ctaBlocks).where(eq(ctaBlocks.active, true));
  const topicLower = topic.toLowerCase();
  let bestMatch: typeof allBlocks[0] | null = null;
  let bestScore = 0;

  for (const block of allBlocks) {
    if (block.isDefault) continue;
    const keywords: string[] = JSON.parse(block.keywords ?? "[]");
    let score = 0;
    for (const kw of keywords) {
      if (topicLower.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = block;
    }
  }

  if (bestMatch && bestScore > 0) {
    return { label: bestMatch.label, ctaText: bestMatch.ctaText, url: bestMatch.url ?? null };
  }

  const defaultBlock = allBlocks.find((b) => b.isDefault);
  return {
    label: defaultBlock?.label ?? "Lights On (Default)",
    ctaText: defaultBlock?.ctaText ?? "Join the Urban Monk Academy at urbanmonk.com/academy",
    url: defaultBlock?.url ?? "https://go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1",
  };
}

export const ctaRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedCtaBlocks();
    return db.select().from(ctaBlocks).orderBy(ctaBlocks.isDefault, ctaBlocks.label);
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        label: z.string().min(1).max(128),
        topic: z.string().max(128).optional().default(""),
        ctaText: z.string().min(1),
        url: z.string().url().optional().or(z.literal("")),
        keywords: z.array(z.string()),
        isDefault: z.boolean().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const values = {
        label: input.label,
        topic: input.topic ?? "",
        ctaText: input.ctaText,
        url: input.url || null,
        keywords: JSON.stringify(input.keywords),
        isDefault: input.isDefault ?? false,
        active: input.active ?? true,
      };
      if (input.id) {
        await db.update(ctaBlocks).set(values).where(eq(ctaBlocks.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(ctaBlocks).values(values);
        return { success: true, id: (result as any).insertId };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [block] = await db.select().from(ctaBlocks).where(eq(ctaBlocks.id, input.id));
      if (block?.isDefault) throw new Error("Cannot delete the default CTA block.");
      await db.delete(ctaBlocks).where(eq(ctaBlocks.id, input.id));
      return { success: true };
    }),

  preview: protectedProcedure
    .input(z.object({ topic: z.string() }))
    .query(async ({ input }) => {
      return getCtaForTopic(input.topic);
    }),
});
