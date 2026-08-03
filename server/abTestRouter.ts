/**
 * A/B Testing Router — Rec 8 (Fable Five Audit)
 *
 * Provides:
 *  - Test + variant management (create, update, start, pause, conclude)
 *  - Sticky server-side variant assignment (by visitor id, weighted random)
 *  - Exposure + conversion recording
 *  - Two-proportion z-test significance engine (min 300 exposures per variant)
 *  - Auto-promote winner when significance threshold is met
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  abTests,
  abVariants,
  abExposures,
  abConversions,
} from "../drizzle/schema";

// ─── Statistical helpers ──────────────────────────────────────────────────────

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Accurate to ~7 decimal places.
 */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const approx =
    1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? approx : 1 - approx;
}

export interface VariantStats {
  variantId: number;
  name: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  conversionRate: number;
  revenueCents: number;
  revenuePerExposure: number;
}

export interface SignificanceResult {
  controlId: number;
  treatmentId: number;
  zScore: number;
  pValue: number;
  confidence: number;
  isSignificant: boolean;
  relativeLift: number;
  hasEnoughData: boolean;
}

/**
 * Two-proportion z-test (one-tailed, treatment > control).
 */
export function twoProportionZTest(
  control: VariantStats,
  treatment: VariantStats,
  minExposures = 300,
  threshold = 0.95
): SignificanceResult {
  const hasEnoughData =
    control.exposures >= minExposures && treatment.exposures >= minExposures;

  if (!hasEnoughData || control.exposures === 0 || treatment.exposures === 0) {
    return {
      controlId: control.variantId,
      treatmentId: treatment.variantId,
      zScore: 0,
      pValue: 0.5,
      confidence: 0,
      isSignificant: false,
      relativeLift: 0,
      hasEnoughData,
    };
  }

  const p1 = control.conversionRate;
  const p2 = treatment.conversionRate;
  const n1 = control.exposures;
  const n2 = treatment.exposures;

  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const zScore = se === 0 ? 0 : (p2 - p1) / se;
  const confidence = normalCdf(zScore);
  const pValue = 1 - confidence;
  const relativeLift = p1 === 0 ? 0 : ((p2 - p1) / p1) * 100;

  return {
    controlId: control.variantId,
    treatmentId: treatment.variantId,
    zScore,
    pValue,
    confidence,
    isSignificant: confidence >= threshold,
    relativeLift,
    hasEnoughData,
  };
}

/**
 * Weighted random variant selection.
 */
export function pickVariantByWeight(
  variantIds: number[],
  weights: number[]
): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < variantIds.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return variantIds[i];
  }
  return variantIds[variantIds.length - 1];
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const abTestRouter = router({
  // ── Test management ──────────────────────────────────────────────────────

  listTests: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const tests = await db.select().from(abTests).orderBy(desc(abTests.createdAt));
    return tests;
  }),

  getTest: protectedProcedure
    .input(z.object({ testId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [test] = await db
        .select()
        .from(abTests)
        .where(eq(abTests.id, input.testId));
      if (!test) throw new TRPCError({ code: "NOT_FOUND" });
      const variants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.testId, input.testId));
      return { test, variants };
    }),

  createTest: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        pageUrl: z.string().optional(),
        minExposures: z.number().int().min(50).default(300),
        significanceThreshold: z.number().min(0.8).max(0.99).default(0.95),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const result = await db.insert(abTests).values({
        name: input.name,
        description: input.description,
        pageUrl: input.pageUrl,
        status: "draft",
        minExposures: input.minExposures,
        significanceThreshold: String(input.significanceThreshold),
        createdAt: now,
        updatedAt: now,
      });
      return { testId: (result as any).insertId as number };
    }),

  updateTestStatus: protectedProcedure
    .input(
      z.object({
        testId: z.number(),
        status: z.enum(["draft", "running", "paused", "concluded"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const updates: Record<string, any> = { status: input.status, updatedAt: now };
      if (input.status === "running") updates.startedAt = now;
      if (input.status === "concluded") updates.concludedAt = now;
      await db.update(abTests).set(updates).where(eq(abTests.id, input.testId));
      return { ok: true };
    }),

  // ── Variant management ────────────────────────────────────────────────────

  createVariant: protectedProcedure
    .input(
      z.object({
        testId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        isControl: z.boolean().default(false),
        weight: z.number().int().min(1).max(100).default(50),
        headline: z.string().optional(),
        ctaText: z.string().optional(),
        pageContent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const result = await db.insert(abVariants).values({
        testId: input.testId,
        name: input.name,
        description: input.description,
        isControl: input.isControl,
        weight: input.weight,
        headline: input.headline,
        ctaText: input.ctaText,
        pageContent: input.pageContent,
        createdAt: now,
        updatedAt: now,
      });
      return { variantId: (result as any).insertId as number };
    }),

  // ── Variant assignment (public — called by landing pages) ─────────────────

  assignVariant: publicProcedure
    .input(
      z.object({
        testId: z.number(),
        visitorId: z.string().min(1),
        sessionId: z.string().optional(),
        utmSource: z.string().optional(),
        utmCampaign: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [test] = await db
        .select()
        .from(abTests)
        .where(and(eq(abTests.id, input.testId), eq(abTests.status, "running")));
      if (!test) throw new TRPCError({ code: "NOT_FOUND", message: "Test not running" });

      // Check for existing sticky assignment
      const existing = await db
        .select({ variantId: abExposures.variantId })
        .from(abExposures)
        .where(
          and(
            eq(abExposures.visitorId, input.visitorId),
            eq(abExposures.testId, input.testId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const [variant] = await db
          .select()
          .from(abVariants)
          .where(eq(abVariants.id, existing[0].variantId));
        return {
          variantId: existing[0].variantId,
          name: variant?.name ?? "",
          headline: variant?.headline ?? null,
          ctaText: variant?.ctaText ?? null,
          pageContent: variant?.pageContent ?? null,
          isControl: variant?.isControl ?? false,
          isNewAssignment: false,
        };
      }

      // Pick variant by weight
      const variants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.testId, input.testId));
      if (!variants.length)
        throw new TRPCError({ code: "NOT_FOUND", message: "No variants configured" });

      const chosenId = pickVariantByWeight(
        variants.map((v) => v.id),
        variants.map((v) => v.weight)
      );
      const chosen = variants.find((v) => v.id === chosenId)!;

      await db.insert(abExposures).values({
        testId: input.testId,
        variantId: chosenId,
        visitorId: input.visitorId,
        sessionId: input.sessionId,
        utmSource: input.utmSource,
        utmCampaign: input.utmCampaign,
        exposedAt: Date.now(),
      });

      return {
        variantId: chosenId,
        name: chosen.name,
        headline: chosen.headline ?? null,
        ctaText: chosen.ctaText ?? null,
        pageContent: chosen.pageContent ?? null,
        isControl: chosen.isControl,
        isNewAssignment: true,
      };
    }),

  // ── Conversion recording (public) ─────────────────────────────────────────

  recordConversion: publicProcedure
    .input(
      z.object({
        testId: z.number(),
        visitorId: z.string().min(1),
        conversionType: z
          .enum(["purchase", "email_capture", "quiz_start", "checkout_start", "custom"])
          .default("purchase"),
        revenueCents: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [exposure] = await db
        .select({ variantId: abExposures.variantId })
        .from(abExposures)
        .where(
          and(
            eq(abExposures.visitorId, input.visitorId),
            eq(abExposures.testId, input.testId)
          )
        )
        .limit(1);
      if (!exposure) return { ok: false, reason: "no_exposure" };

      await db.insert(abConversions).values({
        testId: input.testId,
        variantId: exposure.variantId,
        visitorId: input.visitorId,
        conversionType: input.conversionType,
        revenueCents: input.revenueCents,
        convertedAt: Date.now(),
      });
      return { ok: true };
    }),

  // ── Results + significance ─────────────────────────────────────────────────

  getResults: publicProcedure
    .input(z.object({ testId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [test] = await db
        .select()
        .from(abTests)
        .where(eq(abTests.id, input.testId));
      if (!test) throw new TRPCError({ code: "NOT_FOUND" });

      const variants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.testId, input.testId));

      // Count exposures and conversions per variant
      const exposureCounts = await db
        .select({
          variantId: abExposures.variantId,
          count: sql<number>`COUNT(*)`,
        })
        .from(abExposures)
        .where(eq(abExposures.testId, input.testId))
        .groupBy(abExposures.variantId);

      const conversionCounts = await db
        .select({
          variantId: abConversions.variantId,
          count: sql<number>`COUNT(*)`,
          revenueCents: sql<number>`COALESCE(SUM(revenue_cents), 0)`,
        })
        .from(abConversions)
        .where(eq(abConversions.testId, input.testId))
        .groupBy(abConversions.variantId);

      const expMap = new Map(exposureCounts.map((r) => [r.variantId, Number(r.count)]));
      const convMap = new Map(
        conversionCounts.map((r) => [
          r.variantId,
          { count: Number(r.count), revenue: Number(r.revenueCents) },
        ])
      );

      const stats: VariantStats[] = variants.map((v) => {
        const exp = expMap.get(v.id) ?? 0;
        const conv = convMap.get(v.id) ?? { count: 0, revenue: 0 };
        return {
          variantId: v.id,
          name: v.name,
          isControl: v.isControl,
          exposures: exp,
          conversions: conv.count,
          conversionRate: exp > 0 ? conv.count / exp : 0,
          revenueCents: conv.revenue,
          revenuePerExposure: exp > 0 ? conv.revenue / exp : 0,
        };
      });

      const control = stats.find((s) => s.isControl);
      const treatments = stats.filter((s) => !s.isControl);
      const minExp = test.minExposures ?? 300;
      const threshold = Number(test.significanceThreshold ?? 0.95);

      const significance: SignificanceResult[] = control
        ? treatments.map((t) => twoProportionZTest(control, t, minExp, threshold))
        : [];

      // Auto-promote winner
      const winner = significance.find((s) => s.isSignificant);
      if (winner && test.status === "running" && !test.winnerVariantId) {
        const now = Date.now();
        await db
          .update(abTests)
          .set({ winnerVariantId: winner.treatmentId, status: "concluded", concludedAt: now, updatedAt: now })
          .where(eq(abTests.id, input.testId));
        test.winnerVariantId = winner.treatmentId;
        (test as any).status = "concluded";
      }

      return { test, stats, significance };
    }),

  // ── Promote winner manually ───────────────────────────────────────────────

  promoteWinner: protectedProcedure
    .input(z.object({ testId: z.number(), variantId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      await db
        .update(abTests)
        .set({ winnerVariantId: input.variantId, status: "concluded", concludedAt: now, updatedAt: now })
        .where(eq(abTests.id, input.testId));
      return { ok: true };
    }),
});
