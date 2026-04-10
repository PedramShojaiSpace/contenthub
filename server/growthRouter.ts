import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { contentPillars } from "../drizzle/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

export const growthRouter = router({
  // ─── Content Pillars ────────────────────────────────────────────────────────
  listPillars: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contentPillars).orderBy(contentPillars.dayOfWeek);
  }),

  seedPillars: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const existing = await db.select().from(contentPillars);
    if (existing.length > 0) return { seeded: false, count: existing.length };

    const defaultPillars = [
      {
        name: "Sleep & Recovery",
        dayOfWeek: 1, // Monday
        description: "Content about sleep optimization, circadian rhythm, and recovery practices.",
        topicExamples: JSON.stringify(["sleep cycles", "cortisol reset", "evening wind-down", "sleep debt", "chronobiology"]),
      },
      {
        name: "Detox & Cleansing",
        dayOfWeek: 3, // Wednesday
        description: "Content about detoxification, liver health, environmental toxins, and cleansing protocols.",
        topicExamples: JSON.stringify(["liver detox", "heavy metals", "environmental toxins", "lymphatic drainage", "fasting"]),
      },
      {
        name: "Gut & Oral Health",
        dayOfWeek: 4, // Thursday
        description: "Content about gut microbiome, oral health, digestion, and the gut-brain axis.",
        topicExamples: JSON.stringify(["microbiome", "leaky gut", "oral microbiome", "probiotics", "gut-brain axis"]),
      },
      {
        name: "Ancient Wisdom",
        dayOfWeek: 6, // Saturday
        description: "Content bridging ancient practices (Qigong, Ayurveda, TCM) with modern science.",
        topicExamples: JSON.stringify(["Qigong", "Ayurveda", "TCM", "meditation", "breathwork", "acupuncture"]),
      },
    ];

    await db.insert(contentPillars).values(defaultPillars);
    return { seeded: true, count: defaultPillars.length };
  }),

  upsertPillar: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      dayOfWeek: z.number().min(0).max(6).optional(),
      description: z.string().optional(),
      topicExamples: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const values = {
        name: input.name,
        dayOfWeek: input.dayOfWeek,
        description: input.description,
        topicExamples: input.topicExamples ? JSON.stringify(input.topicExamples) : undefined,
        active: input.active ?? true,
      };
      if (input.id) {
        await db.update(contentPillars).set(values).where(eq(contentPillars.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(contentPillars).values(values);
        return { id: (result as any).insertId };
      }
    }),

  // ─── Weekly Cadence Summary ──────────────────────────────────────────────────
  weeklyCadence: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { pillars: [], evergreen: true };

    const pillars = await db.select().from(contentPillars).where(eq(contentPillars.active, true));

    return {
      pillars,
      // Lights On is perpetual — always open, no enrollment windows
      evergreen: true,
    };
  }),
});
