/**
 * funnelsRouter.ts
 * Three-Funnel Command Dashboard backend
 *
 * Funnels:
 *   lights_on  — YouTube → Quiz → Lights On Academy ($299/yr)
 *   upstream   — YouTube → Upstream Webinar → Upstream ($97)
 *   web_of_life — QR/Web of Life lander → Web of Life course
 *
 * Revenue source of truth: Shopify (single source per project rules)
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { funnelEvents, funnelCohorts } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

const FUNNELS = ["lights_on", "upstream", "web_of_life"] as const;
type Funnel = typeof FUNNELS[number];

// Ordered stages per funnel (top → bottom of funnel)
const FUNNEL_STAGES: Record<Funnel, string[]> = {
  lights_on:   ["reach", "lead", "optin", "quiz", "offer", "purchase"],
  upstream:    ["reach", "lead", "optin", "webinar", "offer", "purchase"],
  web_of_life: ["reach", "lead", "optin", "offer", "purchase"],
};

// Revenue targets (cents) — $240K/month total across all funnels
const MONTHLY_REVENUE_TARGET_CENTS = 240_000_00; // $240,000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function getMonthStart(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const funnelsRouter = router({

  // ── Get full scorecard for all three funnels ──────────────────────────────
  getScorecard: protectedProcedure
    .input(z.object({
      windowDays: z.number().int().min(7).max(365).default(30),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const since = Date.now() - input.windowDays * 24 * 60 * 60 * 1000;

      // Aggregate counts and revenue per funnel × stage for the window
      const rows = await db
        .select({
          funnel: funnelEvents.funnel,
          stage: funnelEvents.stage,
          totalCount: sql<number>`SUM(${funnelEvents.count})`,
          totalRevenue: sql<number>`SUM(${funnelEvents.revenueUsd})`,
        })
        .from(funnelEvents)
        .where(gte(funnelEvents.recordedAt, since))
        .groupBy(funnelEvents.funnel, funnelEvents.stage);

      // Build scorecard per funnel
      const scorecards = FUNNELS.map((funnel) => {
        const stages = FUNNEL_STAGES[funnel];
        const funnelRows = rows.filter((r) => r.funnel === funnel);

        const stageData = stages.map((stage) => {
          const row = funnelRows.find((r) => r.stage === stage);
          return {
            stage,
            count: row?.totalCount ?? 0,
            revenueUsd: (row?.totalRevenue ?? 0) / 100,
          };
        });

        // Conversion rates between adjacent stages
        const conversions: { from: string; to: string; rate: number }[] = [];
        for (let i = 0; i < stageData.length - 1; i++) {
          const from = stageData[i];
          const to = stageData[i + 1];
          conversions.push({
            from: from.stage,
            to: to.stage,
            rate: from.count > 0 ? Math.round((to.count / from.count) * 1000) / 10 : 0,
          });
        }

        const totalRevenue = stageData.reduce((s, r) => s + r.revenueUsd, 0);
        const leads = stageData.find((s) => s.stage === "lead")?.count ?? 0;
        const purchases = stageData.find((s) => s.stage === "purchase")?.count ?? 0;
        const overallCvr = leads > 0 ? Math.round((purchases / leads) * 1000) / 10 : 0;

        return {
          funnel,
          stages: stageData,
          conversions,
          totalRevenueCents: totalRevenue * 100,
          totalRevenueUsd: totalRevenue,
          leads,
          purchases,
          overallCvr,
        };
      });

      const totalRevenue = scorecards.reduce((s, c) => s + c.totalRevenueUsd, 0);
      const targetUsd = (MONTHLY_REVENUE_TARGET_CENTS / 100) * (input.windowDays / 30);
      const revenueVsTarget = targetUsd > 0 ? Math.round((totalRevenue / targetUsd) * 1000) / 10 : 0;

      return {
        scorecards,
        totalRevenueUsd: totalRevenue,
        targetUsd,
        revenueVsTarget,
        windowDays: input.windowDays,
        generatedAt: Date.now(),
      };
    }),

  // ── Weekly trend data (last 12 weeks) ────────────────────────────────────
  getWeeklyTrend: protectedProcedure
    .input(z.object({
      funnel: z.enum(FUNNELS),
      stage: z.string().default("purchase"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const since = Date.now() - 12 * 7 * 24 * 60 * 60 * 1000;

      const rows = await db
        .select({
          weekStart: funnelEvents.weekStart,
          totalCount: sql<number>`SUM(${funnelEvents.count})`,
          totalRevenue: sql<number>`SUM(${funnelEvents.revenueUsd})`,
        })
        .from(funnelEvents)
        .where(
          and(
            eq(funnelEvents.funnel, input.funnel),
            eq(funnelEvents.stage, input.stage),
            gte(funnelEvents.recordedAt, since),
          )
        )
        .groupBy(funnelEvents.weekStart)
        .orderBy(funnelEvents.weekStart);

      return rows.map((r) => ({
        weekStart: r.weekStart,
        count: r.totalCount ?? 0,
        revenueUsd: (r.totalRevenue ?? 0) / 100,
      }));
    }),

  // ── Cohort take-rate table ────────────────────────────────────────────────
  getCohorts: protectedProcedure
    .input(z.object({
      funnel: z.enum(FUNNELS).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const query = db
        .select()
        .from(funnelCohorts)
        .orderBy(desc(funnelCohorts.cohortMonth));

      const rows = input.funnel
        ? await db.select().from(funnelCohorts).where(eq(funnelCohorts.funnel, input.funnel)).orderBy(desc(funnelCohorts.cohortMonth))
        : await query;

      return rows.map((r) => ({
        ...r,
        takeRate30d: r.leadsEntered > 0 ? Math.round((r.purchasedAt30d / r.leadsEntered) * 1000) / 10 : 0,
        takeRate60d: r.leadsEntered > 0 ? Math.round((r.purchasedAt60d / r.leadsEntered) * 1000) / 10 : 0,
        takeRate90d: r.leadsEntered > 0 ? Math.round((r.purchasedAt90d / r.leadsEntered) * 1000) / 10 : 0,
        revenueUsd: r.revenueUsd / 100,
      }));
    }),

  // ── Monday digest (biggest leak + top performer) ─────────────────────────
  getMondayDigest: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const since = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const rows = await db
        .select({
          funnel: funnelEvents.funnel,
          stage: funnelEvents.stage,
          totalCount: sql<number>`SUM(${funnelEvents.count})`,
          totalRevenue: sql<number>`SUM(${funnelEvents.revenueUsd})`,
        })
        .from(funnelEvents)
        .where(gte(funnelEvents.recordedAt, since))
        .groupBy(funnelEvents.funnel, funnelEvents.stage);

      // Find biggest conversion leak across all funnels
      let biggestLeak: { funnel: string; from: string; to: string; rate: number } | null = null;
      let lowestRate = 100;

      for (const funnel of FUNNELS) {
        const stages = FUNNEL_STAGES[funnel];
        for (let i = 0; i < stages.length - 1; i++) {
          const fromStage = stages[i];
          const toStage = stages[i + 1];
          const fromRow = rows.find((r) => r.funnel === funnel && r.stage === fromStage);
          const toRow = rows.find((r) => r.funnel === funnel && r.stage === toStage);
          const fromCount = fromRow?.totalCount ?? 0;
          const toCount = toRow?.totalCount ?? 0;
          if (fromCount > 10) {
            const rate = Math.round((toCount / fromCount) * 1000) / 10;
            if (rate < lowestRate) {
              lowestRate = rate;
              biggestLeak = { funnel, from: fromStage, to: toStage, rate };
            }
          }
        }
      }

      // Top performing funnel by revenue this week
      const funnelRevenue = FUNNELS.map((funnel) => ({
        funnel,
        revenueUsd: rows
          .filter((r) => r.funnel === funnel && r.stage === "purchase")
          .reduce((s, r) => s + (r.totalRevenue ?? 0), 0) / 100,
      })).sort((a, b) => b.revenueUsd - a.revenueUsd);

      const totalWeeklyRevenue = funnelRevenue.reduce((s, f) => s + f.revenueUsd, 0);
      const weeklyTarget = MONTHLY_REVENUE_TARGET_CENTS / 100 / 4.33;

      return {
        weeklyRevenueUsd: totalWeeklyRevenue,
        weeklyTargetUsd: weeklyTarget,
        weeklyVsTarget: weeklyTarget > 0 ? Math.round((totalWeeklyRevenue / weeklyTarget) * 1000) / 10 : 0,
        topFunnel: funnelRevenue[0] ?? null,
        biggestLeak,
        funnelRevenue,
        generatedAt: Date.now(),
      };
    }),

  // ── Manual event entry (log stage counts) ────────────────────────────────
  logEvent: protectedProcedure
    .input(z.object({
      funnel: z.enum(FUNNELS),
      stage: z.string().min(1),
      count: z.number().int().min(1).default(1),
      revenueUsd: z.number().min(0).default(0),
      utmSource: z.string().optional(),
      utmCampaign: z.string().optional(),
      notes: z.string().optional(),
      recordedAt: z.number().optional(), // allow backdating
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const ts = input.recordedAt ?? Date.now();
      const weekStart = getMondayOfWeek(ts);

      await db.insert(funnelEvents).values({
        funnel: input.funnel,
        stage: input.stage,
        count: input.count,
        revenueUsd: Math.round(input.revenueUsd * 100),
        utmSource: input.utmSource,
        utmCampaign: input.utmCampaign,
        notes: input.notes,
        recordedAt: ts,
        weekStart,
      });

      return { ok: true };
    }),

  // ── Upsert cohort row ─────────────────────────────────────────────────────
  upsertCohort: protectedProcedure
    .input(z.object({
      funnel: z.enum(FUNNELS),
      cohortMonth: z.string().regex(/^\d{4}-\d{2}$/),
      leadsEntered: z.number().int().min(0),
      purchasedAt30d: z.number().int().min(0).default(0),
      purchasedAt60d: z.number().int().min(0).default(0),
      purchasedAt90d: z.number().int().min(0).default(0),
      revenueUsd: z.number().min(0).default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const existing = await db
        .select()
        .from(funnelCohorts)
        .where(and(eq(funnelCohorts.funnel, input.funnel), eq(funnelCohorts.cohortMonth, input.cohortMonth)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(funnelCohorts)
          .set({
            leadsEntered: input.leadsEntered,
            purchasedAt30d: input.purchasedAt30d,
            purchasedAt60d: input.purchasedAt60d,
            purchasedAt90d: input.purchasedAt90d,
            revenueUsd: Math.round(input.revenueUsd * 100),
            updatedAt: Date.now(),
          })
          .where(eq(funnelCohorts.id, existing[0].id));
      } else {
        await db.insert(funnelCohorts).values({
          funnel: input.funnel,
          cohortMonth: input.cohortMonth,
          leadsEntered: input.leadsEntered,
          purchasedAt30d: input.purchasedAt30d,
          purchasedAt60d: input.purchasedAt60d,
          purchasedAt90d: input.purchasedAt90d,
          revenueUsd: Math.round(input.revenueUsd * 100),
          updatedAt: Date.now(),
        });
      }

      return { ok: true };
    }),

  // ── Get funnel stage definitions ──────────────────────────────────────────
  getFunnelConfig: protectedProcedure
    .query(() => {
      return {
        funnels: FUNNELS,
        stages: FUNNEL_STAGES,
        monthlyTargetUsd: MONTHLY_REVENUE_TARGET_CENTS / 100,
      };
    }),
});
