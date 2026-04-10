import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { contentPillars, enrollmentWindows } from "../drizzle/schema";
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

  // ─── Enrollment Windows ─────────────────────────────────────────────────────
  listWindows: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(enrollmentWindows).orderBy(enrollmentWindows.openDate);
  }),

  seedWindows: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const existing = await db.select().from(enrollmentWindows);
    if (existing.length > 0) return { seeded: false, count: existing.length };

    const now = new Date();
    const year = now.getFullYear();

    const defaultWindows = [
      {
        name: "Fall Enrollment — Lights On",
        openDate: new Date(`${year}-08-18`),
        closeDate: new Date(`${year}-09-01`),
        goal: "Conversion",
        targetSignups: 100,
        notes: "6-week content push starting August 18. Shift content goal to Audience Growth. Increase posting frequency to 7x/week. Final 3 days: direct offer posts only.",
        active: true,
      },
      {
        name: "New Year Enrollment — Lights On",
        openDate: new Date(`${year}-12-15`),
        closeDate: new Date(`${year + 1}-01-01`),
        goal: "Conversion",
        targetSignups: 150,
        notes: "6-week content push starting December 15. New Year transformation angle. Shift content goal to Audience Growth. Final week: countdown posts.",
        active: true,
      },
    ];

    await db.insert(enrollmentWindows).values(defaultWindows);
    return { seeded: true, count: defaultWindows.length };
  }),

  upsertWindow: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      openDate: z.string(), // ISO date string
      closeDate: z.string(),
      goal: z.string().optional(),
      targetSignups: z.number().optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const values = {
        name: input.name,
        openDate: new Date(input.openDate),
        closeDate: new Date(input.closeDate),
        goal: input.goal,
        targetSignups: input.targetSignups,
        notes: input.notes,
        active: input.active ?? true,
      };
      if (input.id) {
        await db.update(enrollmentWindows).set(values).where(eq(enrollmentWindows.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(enrollmentWindows).values(values);
        return { id: (result as any).insertId };
      }
    }),

  // ─── Weekly Cadence Summary ──────────────────────────────────────────────────
  weeklyCadence: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { postsThisWeek: 0, targetPosts: 5, pillars: [], nextWindow: null };

    // Get content pillars
    const pillars = await db.select().from(contentPillars).where(eq(contentPillars.active, true));

    // Get next enrollment window
    const now = new Date();
    const windows = await db.select().from(enrollmentWindows)
      .where(eq(enrollmentWindows.active, true));
    
    const nextWindow = windows
      .filter(w => w.closeDate > now)
      .sort((a, b) => a.openDate.getTime() - b.openDate.getTime())[0] ?? null;

    // Calculate days until next window
    let daysUntilOpen: number | null = null;
    let isWindowOpen = false;
    if (nextWindow) {
      const msUntilOpen = nextWindow.openDate.getTime() - now.getTime();
      daysUntilOpen = Math.ceil(msUntilOpen / (1000 * 60 * 60 * 24));
      isWindowOpen = now >= nextWindow.openDate && now <= nextWindow.closeDate;
    }

    return {
      pillars,
      nextWindow: nextWindow ? {
        ...nextWindow,
        daysUntilOpen,
        isWindowOpen,
      } : null,
    };
  }),
});
