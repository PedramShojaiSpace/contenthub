import { z } from "zod";
import { and, eq, gte, isNotNull, lt } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { attributedSales, tantraContentEvents, tantraQuizLeads } from "../drizzle/schema";
import {
  TANTRA_CONTENT_EVENT_TYPES,
  TANTRA_CONTENT_SOURCE_KEYS,
  TANTRA_CONTENT_SOURCES,
  type TantraContentSourceKey,
} from "../shared/tantraContentAttribution";

const sourcePageSchema = z.enum(TANTRA_CONTENT_SOURCE_KEYS);
const eventTypeSchema = z.enum(TANTRA_CONTENT_EVENT_TYPES);

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function extractTantraLineItemMetrics(rawLineItems: string | null | undefined) {
  if (!rawLineItems) return { units: 0, revenueCents: 0 };
  try {
    const lineItems = JSON.parse(rawLineItems) as Array<{ title?: unknown; quantity?: unknown; price?: unknown }>;
    return lineItems.reduce((total, line) => {
      const title = typeof line.title === "string" ? line.title.trim().toLowerCase() : "";
      if (!/^(tantra him|tantra her|tantra bundle)/.test(title)) return total;
      const quantity = Number(line.quantity ?? 0);
      const price = Number(line.price ?? 0);
      if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) return total;
      return {
        units: total.units + quantity,
        revenueCents: total.revenueCents + Math.round(quantity * price * 100),
      };
    }, { units: 0, revenueCents: 0 });
  } catch {
    return { units: 0, revenueCents: 0 };
  }
}

function utcDayRange(startDate: string, endDate: string) {
  const startAt = Date.parse(`${startDate}T00:00:00.000Z`);
  const endExclusive = Date.parse(`${endDate}T00:00:00.000Z`) + 86_400_000;
  return { startAt, endExclusive };
}

export const tantraContentAttributionRouter = router({
  trackEvent: publicProcedure
    .input(z.object({
      sourcePage: sourcePageSchema,
      eventType: eventTypeSchema,
      visitorId: z.string().min(8).max(128),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.eventType !== "page_view") {
        const [existing] = await db.select({ id: tantraContentEvents.id })
          .from(tantraContentEvents)
          .where(and(
            eq(tantraContentEvents.sourcePage, input.sourcePage),
            eq(tantraContentEvents.eventType, input.eventType),
            eq(tantraContentEvents.visitorId, input.visitorId)
          ))
          .limit(1);
        if (existing) return { ok: true, deduped: true };
      }

      const source = TANTRA_CONTENT_SOURCES.find((candidate) => candidate.key === input.sourcePage)!;
      await db.insert(tantraContentEvents).values({
        sourcePage: input.sourcePage,
        visitorId: input.visitorId,
        eventType: input.eventType,
        mediaId: source.mediaId,
        eventAt: Date.now(),
      });
      return { ok: true, deduped: false };
    }),

  getReport: protectedProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { startAt, endExclusive } = utcDayRange(input.startDate, input.endDate);

      const [events, leads, sales] = await Promise.all([
        db.select().from(tantraContentEvents).where(and(
          gte(tantraContentEvents.eventAt, startAt),
          lt(tantraContentEvents.eventAt, endExclusive)
        )),
        db.select().from(tantraQuizLeads).where(isNotNull(tantraQuizLeads.sourcePage)),
        db.select().from(attributedSales).where(and(
          gte(attributedSales.orderCreatedAt, startAt),
          lt(attributedSales.orderCreatedAt, endExclusive)
        )),
      ]);

      const rows = new Map(TANTRA_CONTENT_SOURCES.map((source) => [source.key, {
        sourcePage: source.key,
        label: source.label,
        path: source.path,
        mediaId: source.mediaId,
        pageHits: 0,
        uniquePageVisitors: new Set<string>(),
        videoPlayVisitors: new Set<string>(),
        video25Visitors: new Set<string>(),
        video50Visitors: new Set<string>(),
        video75Visitors: new Set<string>(),
        videoCompleteVisitors: new Set<string>(),
        quizCtaVisitors: new Set<string>(),
        quizStarts: 0,
        quizCompleted: 0,
        emailCaptured: 0,
        paidUnits: 0,
        attributedRevenueCents: 0,
      }]));

      for (const event of events) {
        const row = rows.get(event.sourcePage as TantraContentSourceKey);
        if (!row) continue;
        if (event.eventType === "page_view") {
          row.pageHits++;
          row.uniquePageVisitors.add(event.visitorId);
        }
        if (event.eventType === "video_play") row.videoPlayVisitors.add(event.visitorId);
        if (event.eventType === "video_25") row.video25Visitors.add(event.visitorId);
        if (event.eventType === "video_50") row.video50Visitors.add(event.visitorId);
        if (event.eventType === "video_75") row.video75Visitors.add(event.visitorId);
        if (event.eventType === "video_complete") row.videoCompleteVisitors.add(event.visitorId);
        if (event.eventType === "quiz_cta") row.quizCtaVisitors.add(event.visitorId);
      }

      const sourceLeadByEmail = new Map<string, typeof leads[number]>();
      for (const lead of leads) {
        const row = rows.get(lead.sourcePage as TantraContentSourceKey);
        if (!row) continue;
        if (lead.createdAt >= startAt && lead.createdAt < endExclusive) {
          row.quizStarts++;
          if (lead.completedAt) row.quizCompleted++;
          if (lead.emailCapturedAt) row.emailCaptured++;
        }
        const email = normalizeEmail(lead.email);
        if (!email || !lead.emailCapturedAt) continue;
        const existing = sourceLeadByEmail.get(email);
        if (!existing || (lead.emailCapturedAt ?? lead.createdAt) < (existing.emailCapturedAt ?? existing.createdAt)) {
          sourceLeadByEmail.set(email, lead);
        }
      }

      for (const sale of sales) {
        const lead = sourceLeadByEmail.get(normalizeEmail(sale.customerEmail));
        if (!lead || !lead.sourcePage || !lead.emailCapturedAt || lead.emailCapturedAt > sale.orderCreatedAt) continue;
        const row = rows.get(lead.sourcePage as TantraContentSourceKey);
        if (!row) continue;
        const metrics = extractTantraLineItemMetrics(sale.lineItems);
        row.paidUnits += metrics.units;
        row.attributedRevenueCents += metrics.revenueCents;
      }

      return {
        startDate: input.startDate,
        endDate: input.endDate,
        attributionBasis: "First-party page/video events, source-tagged quiz sessions, and email-matched paid Shopify webhook line items. Sales appear only after the paid-order webhook is received and only when the captured quiz email predates the order.",
        rows: [...rows.values()].map((row) => ({
          sourcePage: row.sourcePage,
          label: row.label,
          path: row.path,
          mediaId: row.mediaId,
          pageHits: row.pageHits,
          uniquePageVisitors: row.uniquePageVisitors.size,
          videoPlays: row.videoPlayVisitors.size,
          video25: row.video25Visitors.size,
          video50: row.video50Visitors.size,
          video75: row.video75Visitors.size,
          videoComplete: row.videoCompleteVisitors.size,
          quizCtas: row.quizCtaVisitors.size,
          quizStarts: row.quizStarts,
          quizCompleted: row.quizCompleted,
          emailCaptured: row.emailCaptured,
          paidUnits: row.paidUnits,
          attributedRevenueCents: row.attributedRevenueCents,
        })),
      };
    }),
});
