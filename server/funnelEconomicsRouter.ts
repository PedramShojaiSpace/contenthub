/**
 * funnelEconomicsRouter.ts
 * Save and retrieve funnel economics scenario snapshots.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { funnelEconomicsScenarios } from "../drizzle/schema";
import { desc } from "drizzle-orm";

export const funnelEconomicsRouter = router({
  saveScenario: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      leadsPerMonth: z.number().int().min(1),
      cpl: z.number().min(0),
      cr67: z.number().min(0).max(100),
      crBump: z.number().min(0).max(100),
      crOto: z.number().min(0).max(100),
      crMid: z.number().min(0).max(100),
      midPrice: z.number().int(),
      crHighTicket: z.number().min(0).max(100),
      totalRevenue: z.number(),
      netProfit: z.number(),
      roas: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.insert(funnelEconomicsScenarios).values({
        name: input.name,
        leadsPerMonth: input.leadsPerMonth,
        cpl: input.cpl,
        cr67: input.cr67,
        crBump: input.crBump,
        crOto: input.crOto,
        crMid: input.crMid,
        midPrice: input.midPrice,
        crHighTicket: input.crHighTicket,
        totalRevenue: input.totalRevenue,
        netProfit: input.netProfit,
        roas: input.roas,
        createdAt: Date.now(),
      });
      return { ok: true };
    }),

  listScenarios: protectedProcedure
    .query(async () => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(funnelEconomicsScenarios)
        .orderBy(desc(funnelEconomicsScenarios.createdAt))
        .limit(50);
      return rows;
    }),
});
