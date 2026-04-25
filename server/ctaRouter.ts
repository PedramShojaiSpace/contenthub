/**
 * ctaRouter.ts
 * Topical CTA Library for Urban Monk Content Hub.
 */

import { getDb } from "./db";
import { ctaBlocks } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";

/**
 * Maps a content platform to its UTM source and medium values.
 * Used to auto-append UTM params to CTA URLs injected into AI prompts.
 */
const PLATFORM_UTM: Record<string, { source: string; medium: string }> = {
  blog: { source: "blog", medium: "organic-content" },
  youtube: { source: "youtube", medium: "video" },
  meta: { source: "meta", medium: "organic-social" },
  instagram: { source: "instagram", medium: "organic-social" },
  linkedin: { source: "linkedin", medium: "organic-social" },
  x: { source: "twitter-x", medium: "organic-social" },
  tiktok: { source: "tiktok", medium: "organic-social" },
  podcast: { source: "podcast", medium: "audio" },
  all: { source: "content-hub", medium: "organic-content" },
};

/**
 * Appends UTM parameters to a CTA URL based on the content platform and campaign.
 * Campaign is derived from the CTA block label (slugified).
 */
export function appendUtmToCtaUrl(
  url: string | null,
  platform: string,
  campaignOverride?: string
): string {
  if (!url) return "";
  const utm = PLATFORM_UTM[platform] ?? { source: platform, medium: "organic-content" };
  const campaign = campaignOverride ?? "ic-free-screening";
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", utm.source);
    u.searchParams.set("utm_medium", utm.medium);
    u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    // Fallback for malformed URLs
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}utm_source=${utm.source}&utm_medium=${utm.medium}&utm_campaign=${campaign}`;
  }
}

/** Slugify a CTA label into a campaign slug, e.g. "Lights On (Default)" → "lights-on" */
export function ctaLabelToCampaign(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\(.*?\)/g, "")  // remove parenthetical
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 64);
}

const DEFAULT_CTA_BLOCKS = [
  {
    label: "Lights On (Default)",
    ctaText: "Ready to turn the lights on in your life? Join the Lights On course and get the exact system Dr. Pedram Shojai uses to help his patients reclaim their energy, focus, and vitality. Visit lightson.theurbanmonk.com to get started.",
    url: "https://lightson.theurbanmonk.com/",
    keywords: JSON.stringify(["general", "wellness", "health", "energy", "vitality", "life", "transformation"]),
    isDefault: true,
    active: true,
  },
  {
    label: "Sleep",
    ctaText: "If your sleep is broken, everything else suffers. At The Urban Monk, we have deep resources on sleep optimization — the science, the protocols, and the practices that actually work. Visit the link below to explore.",
    url: "https://theacademy.theurbanmonk.com/dss-webinar-kajabi",
    keywords: JSON.stringify(["sleep", "insomnia", "rest", "circadian", "melatonin", "deep sleep", "sleep quality", "night", "tired", "fatigue", "exhausted", "waking up"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Gut Health",
    ctaText: "Your gut is your second brain. Dr. Pedram Shojai's Upstream program goes deep on the microbiome, leaky gut, and the oral-gut-brain connection. Visit upstream.theurbanmonk.com to explore.",
    url: "https://upstream.theurbanmonk.com/",
    keywords: JSON.stringify(["gut", "microbiome", "digestion", "leaky gut", "probiotics", "prebiotics", "bloating", "IBS", "intestinal", "bowel", "stomach", "digestive", "oral health", "bacteria", "oral microbiome"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Detox",
    ctaText: "We live in the most toxic environment in human history. At The Urban Monk, we provide practical, science-backed detox protocols you can start today. Visit theurbanmonk.com to learn more.",
    url: "https://theurbanmonk.com",
    keywords: JSON.stringify(["detox", "toxins", "cleanse", "heavy metals", "mold", "pesticides", "chemicals", "liver", "lymph", "drainage", "environmental toxins", "clean living"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Stress & Nervous System",
    ctaText: "Chronic stress is the root of most modern disease. The Lights On Method teaches you how to move out of fight-or-flight and reset your nervous system for good. Visit the link below to get started.",
    url: "https://theacademy.theurbanmonk.com/LightsOn-opt-in-The-Lights-On-Method",
    keywords: JSON.stringify(["stress", "anxiety", "cortisol", "nervous system", "fight or flight", "parasympathetic", "vagus nerve", "burnout", "overwhelm", "adrenal", "HPA axis", "tension", "worry"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Energy & Mitochondria",
    ctaText: "Low energy is a mitochondrial problem. At The Urban Monk, we show you how to rebuild cellular energy from the ground up — no stimulants required. Visit theurbanmonk.com to learn more.",
    url: "https://theurbanmonk.com",
    keywords: JSON.stringify(["energy", "mitochondria", "fatigue", "tired", "ATP", "cellular energy", "coffee", "caffeine", "afternoon crash", "brain fog", "sluggish", "low energy"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Mindfulness & Meditation",
    ctaText: "Dr. Pedram Shojai has refined his personal Qigong and meditation practices over 30 years. The Lights On Method brings these teachings into a practical daily system. Visit the link below to get started.",
    url: "https://theacademy.theurbanmonk.com/LightsOn-opt-in-The-Lights-On-Method",
    keywords: JSON.stringify(["meditation", "mindfulness", "qigong", "breathwork", "presence", "awareness", "mind", "consciousness", "focus", "attention", "stillness", "inner peace", "zen"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Ancient Wisdom",
    ctaText: "The Urban Monk bridges 5,000 years of Eastern wisdom with cutting-edge Western science. Explore the full depth of this work at theurbanmonk.com.",
    url: "https://theurbanmonk.com",
    keywords: JSON.stringify(["ancient", "traditional", "TCM", "Chinese medicine", "Ayurveda", "acupuncture", "herbs", "qi", "chi", "meridian", "chakra", "wisdom", "ancestral", "indigenous", "shamanic"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Performance & Longevity",
    ctaText: "Peak performance is about recovering smarter. Dr. Pedram Shojai shares the biohacking protocols he uses with executives and athletes at theurbanmonk.com.",
    url: "https://theurbanmonk.com",
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

  // Only insert blocks that don't exist yet — never overwrite user edits
  for (const block of DEFAULT_CTA_BLOCKS) {
    const match = existing.find((e) => e.label === block.label);
    if (!match) {
      await db.insert(ctaBlocks).values(block);
    }
  }
  // (no overwrite — user edits to URLs/text/keywords persist)
}

export async function getCtaForTopic(topic: string): Promise<{
  label: string;
  ctaText: string;
  url: string | null;
}> {
  const db = await getDb();
  if (!db) return { label: "Lights On (Default)", ctaText: "Join the Lights On course at lightson.theurbanmonk.com and get the exact system Dr. Pedram Shojai uses to help his patients reclaim their energy, focus, and vitality.", url: "https://lightson.theurbanmonk.com/" };
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
    ctaText: defaultBlock?.ctaText ?? "Explore more resources from Dr. Pedram Shojai at theurbanmonk.com.",
    url: defaultBlock?.url ?? "https://lightson.theurbanmonk.com",
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
