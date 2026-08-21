import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { orobiomeFunnelEvents } from "../drizzle/schema";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

type FunnelCounts = {
  pageViews: number;
  uniqueVisitors: number;
  scroll25: number;
  scroll50: number;
  scroll75: number;
  ctaClicks: number;
  cartIntents: number;
  purchases: number;
  revenueCents: number;
};

function emptyCounts(): FunnelCounts {
  return { pageViews: 0, uniqueVisitors: 0, scroll25: 0, scroll50: 0, scroll75: 0, ctaClicks: 0, cartIntents: 0, purchases: 0, revenueCents: 0 };
}

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

export const orobiomeFunnelRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(14) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const since = Date.now() - (input?.days ?? 14) * 24 * 60 * 60 * 1000;
      const rows = await db
        .select({
          variant: orobiomeFunnelEvents.variant,
          eventType: orobiomeFunnelEvents.eventType,
          eventCount: sql<number>`COUNT(*)`,
          uniqueVisitors: sql<number>`COUNT(DISTINCT ${orobiomeFunnelEvents.visitorId})`,
          revenueCents: sql<number>`COALESCE(SUM(${orobiomeFunnelEvents.orderTotalCents}), 0)`,
        })
        .from(orobiomeFunnelEvents)
        .where(gte(orobiomeFunnelEvents.eventAt, since))
        .groupBy(orobiomeFunnelEvents.variant, orobiomeFunnelEvents.eventType);

      const byVariant: Record<string, FunnelCounts> = {
        control: emptyCounts(),
        offer_clarity: emptyCounts(),
      };
      for (const row of rows) {
        const bucket = byVariant[row.variant] ?? (byVariant[row.variant] = emptyCounts());
        const count = asNumber(row.eventCount);
        const revenue = asNumber(row.revenueCents);
        switch (row.eventType) {
          case "page_view": bucket.pageViews = count; bucket.uniqueVisitors = asNumber(row.uniqueVisitors); break;
          case "scroll_25": bucket.scroll25 = count; break;
          case "scroll_50": bucket.scroll50 = count; break;
          case "scroll_75": bucket.scroll75 = count; break;
          case "cta_click": bucket.ctaClicks = count; break;
          case "cart_intent": bucket.cartIntents = count; break;
          case "purchase": bucket.purchases = count; bucket.revenueCents = revenue; break;
        }
      }
      const totals = emptyCounts();
      for (const variant of Object.values(byVariant)) {
        for (const key of Object.keys(totals) as Array<keyof FunnelCounts>) totals[key] += variant[key];
      }
      return { since, days: input?.days ?? 14, totals, byVariant };
    }),
});
