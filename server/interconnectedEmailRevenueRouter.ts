import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { canonicalKoKlaviyoMessageKey } from "./interconnectedEmailAttributionHygiene";
import {
  attributedSales,
  interconnectedEmailCheckoutTouches,
  interconnectedEmailPerformanceSnapshots,
  interconnectedLeads,
  leadPurchaseAttributions,
} from "../drizzle/schema";

const FLOW_ID = "VMpbLV";
const PATHS = ["kajabi", "ko_klaviyo"] as const;
type FunnelPath = (typeof PATHS)[number];

const inputWindow = z.object({
  startAt: z.number().int().positive(),
  endAt: z.number().int().positive(),
  funnelPath: z.enum(["kajabi", "ko_klaviyo", "all"]).default("all"),
});

function uniqueSnapshotKey(messageId: string, startAt: number, endAt: number) {
  return `ko_klaviyo:${messageId}:${startAt}:${endAt}`;
}

async function klaviyoRequest(path: string, init: RequestInit = {}) {
  const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
  if (!apiKey) throw new Error("Klaviyo reporting key is unavailable");
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...init,
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: "2026-07-15",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Klaviyo ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function collectKlaviyoSnapshot(startAt: number, endAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const metrics = await klaviyoRequest("/metrics/");
  const placedOrder = (metrics.data ?? []).find((metric: any) => metric.attributes?.name === "Placed Order");
  if (!placedOrder?.id) throw new Error("Klaviyo Placed Order metric is unavailable");
  const report = await klaviyoRequest("/flow-values-reports/", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "flow-values-report",
        attributes: {
          timeframe: { start: new Date(startAt).toISOString(), end: new Date(endAt).toISOString() },
          conversion_metric_id: placedOrder.id,
          filter: `equals(flow_id,\"${FLOW_ID}\")`,
          statistics: ["recipients", "delivered", "delivery_rate", "opens", "open_rate", "clicks", "click_rate", "conversion_uniques", "conversion_value"],
          group_by: ["flow_message_id", "flow_id", "flow_message_name", "send_channel"],
        },
      },
    }),
  });
  const collectedAt = Date.now();
  const rows = report.data?.attributes?.results ?? [];
  for (const row of rows) {
    const groupings = row.groupings ?? {};
    const statistics = row.statistics ?? {};
    const messageId = String(groupings.flow_message_id ?? "");
    if (!messageId) continue;
    await db.insert(interconnectedEmailPerformanceSnapshots).values({
      snapshotKey: uniqueSnapshotKey(messageId, startAt, endAt),
      funnelPath: "ko_klaviyo",
      platform: "klaviyo",
      flowId: String(groupings.flow_id ?? FLOW_ID),
      messageId,
      messageName: groupings.flow_message_name ?? null,
      messageKey: canonicalKoKlaviyoMessageKey(messageId),
      sendChannel: groupings.send_channel === "sms" ? "sms" : "email",
      windowStart: startAt,
      windowEnd: endAt,
      recipients: Number(statistics.recipients ?? 0),
      delivered: Number(statistics.delivered ?? 0),
      deliveryRate: Number(statistics.delivery_rate ?? 0),
      opens: Number(statistics.opens ?? 0),
      openRate: Number(statistics.open_rate ?? 0),
      clicks: Number(statistics.clicks ?? 0),
      clickRate: Number(statistics.click_rate ?? 0),
      platformConversions: Number(statistics.conversion_uniques ?? 0),
      platformRevenueCents: Math.round(Number(statistics.conversion_value ?? 0) * 100),
      rawMetrics: JSON.stringify(row),
      collectedAt,
    }).onDuplicateKeyUpdate({
      set: {
        messageName: groupings.flow_message_name ?? null,
        messageKey: canonicalKoKlaviyoMessageKey(messageId),
        sendChannel: groupings.send_channel === "sms" ? "sms" : "email",
        recipients: Number(statistics.recipients ?? 0), delivered: Number(statistics.delivered ?? 0), deliveryRate: Number(statistics.delivery_rate ?? 0),
        opens: Number(statistics.opens ?? 0), openRate: Number(statistics.open_rate ?? 0), clicks: Number(statistics.clicks ?? 0), clickRate: Number(statistics.click_rate ?? 0),
        platformConversions: Number(statistics.conversion_uniques ?? 0), platformRevenueCents: Math.round(Number(statistics.conversion_value ?? 0) * 100),
        rawMetrics: JSON.stringify(row), collectedAt,
      },
    });
  }
  return { collectedAt, messageRows: rows.length };
}

export const interconnectedEmailRevenueRouter = router({
  collectKlaviyo: protectedProcedure.input(inputWindow.pick({ startAt: true, endAt: true })).mutation(async ({ input }) => {
    if (input.endAt <= input.startAt) throw new Error("End date must follow start date");
    if (input.endAt - input.startAt > 31 * 86_400_000) throw new Error("Choose a 31-day or shorter collection window");
    return collectKlaviyoSnapshot(input.startAt, input.endAt);
  }),

  getReport: protectedProcedure.input(inputWindow).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const paths: FunnelPath[] = input.funnelPath === "all" ? [...PATHS] : [input.funnelPath];
    const snapshots = await db.select().from(interconnectedEmailPerformanceSnapshots)
      .where(and(gte(interconnectedEmailPerformanceSnapshots.windowStart, input.startAt), lte(interconnectedEmailPerformanceSnapshots.windowEnd, input.endAt)))
      .orderBy(desc(interconnectedEmailPerformanceSnapshots.collectedAt));
    const touches = await db.select({
      funnelPath: interconnectedEmailCheckoutTouches.funnelPath,
      messageKey: interconnectedEmailCheckoutTouches.messageKey,
      touches: sql<number>`COUNT(*)`,
      purchases: sql<number>`SUM(CASE WHEN ${attributedSales.id} IS NOT NULL THEN 1 ELSE 0 END)`,
      revenueCents: sql<number>`COALESCE(SUM(${attributedSales.orderTotal}), 0)`,
    }).from(interconnectedEmailCheckoutTouches)
      .leftJoin(attributedSales, eq(interconnectedEmailCheckoutTouches.clickToken, attributedSales.clickToken))
      .where(and(gte(interconnectedEmailCheckoutTouches.clickedAt, input.startAt), lte(interconnectedEmailCheckoutTouches.clickedAt, input.endAt)))
      .groupBy(interconnectedEmailCheckoutTouches.funnelPath, interconnectedEmailCheckoutTouches.messageKey);
    const cohortRevenue = await db.select({
      funnelPath: interconnectedLeads.funnelPath,
      purchases: sql<number>`COUNT(*)`,
      revenueCents: sql<number>`COALESCE(SUM(${leadPurchaseAttributions.purchaseAmountCents}), 0)`,
    }).from(leadPurchaseAttributions)
      .innerJoin(interconnectedLeads, eq(leadPurchaseAttributions.leadId, interconnectedLeads.id))
      .where(and(gte(leadPurchaseAttributions.leadOptedInAt, input.startAt), lte(leadPurchaseAttributions.leadOptedInAt, input.endAt), eq(leadPurchaseAttributions.isWithin14Days, true)))
      .groupBy(interconnectedLeads.funnelPath);
    const leadCounts = await db.select({ funnelPath: interconnectedLeads.funnelPath, leads: sql<number>`COUNT(*)` })
      .from(interconnectedLeads)
      .where(and(gte(interconnectedLeads.createdAt, input.startAt), lte(interconnectedLeads.createdAt, input.endAt)))
      .groupBy(interconnectedLeads.funnelPath);
    return {
      window: { startAt: input.startAt, endAt: input.endAt },
      paths: paths.map((funnelPath) => ({
        funnelPath,
        snapshots: snapshots.filter((row) => row.funnelPath === funnelPath).map((snapshot) => {
          const direct = snapshot.messageKey ? touches.find((touch) => touch.funnelPath === funnelPath && touch.messageKey === snapshot.messageKey) : undefined;
          return {
            ...snapshot,
            directCheckoutTouches: Number(direct?.touches ?? 0),
            directPurchases: Number(direct?.purchases ?? 0),
            directRevenueCents: Number(direct?.revenueCents ?? 0),
          };
        }),
        checkoutTouches: touches.filter((row) => row.funnelPath === funnelPath).map((row) => ({ ...row, touches: Number(row.touches), purchases: Number(row.purchases), revenueCents: Number(row.revenueCents) })),
        cohort: (() => {
          const revenue = cohortRevenue.find((row) => row.funnelPath === funnelPath);
          const leads = leadCounts.find((row) => row.funnelPath === funnelPath);
          const revenueCents = Number(revenue?.revenueCents ?? 0);
          const leadCount = Number(leads?.leads ?? 0);
          return { leads: leadCount, purchases: Number(revenue?.purchases ?? 0), revenueCents, ltvCents: leadCount ? Math.round(revenueCents / leadCount) : 0 };
        })(),
      })),
      rules: { pooledWinnerMetricsForbidden: true, legacyUnbucketedLeadsExcluded: true, kajabiPlatformRevenueSeparateFromDirectShopifyRevenue: true },
    };
  }),
});
