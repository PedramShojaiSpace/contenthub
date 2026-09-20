import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const startIso = process.env.START_ISO ?? "2026-09-20T16:00:00.000Z";
const postRepairIso = process.env.POST_REPAIR_ISO ?? "2026-09-20T17:42:47.000Z";
const startMs = Date.parse(startIso);
const postRepairMs = Date.parse(postRepairIso);
const productTitle = "Interconnected: The Complete Healing Protocol";

function rowsFrom(value: unknown): Array<Record<string, unknown>> {
  const outer = Array.isArray(value) ? value[0] : value;
  return Array.isArray(outer) ? outer as Array<Record<string, unknown>> : outer ? [outer as Record<string, unknown>] : [];
}

function numeric(value: unknown) {
  return Number(value ?? 0);
}

async function main() {
  if (!Number.isFinite(startMs) || !Number.isFinite(postRepairMs)) throw new Error("Invalid reporting window");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [leadsByPathRaw, koSalesRaw, checkoutRaw, rawLedgerRaw] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(funnel_path, '(unassigned)') AS funnel_path,
        COUNT(*) AS leads,
        SUM(CASE WHEN klaviyo_synced = 1 THEN 1 ELSE 0 END) AS klaviyo_synced,
        SUM(CASE WHEN capi_lead_sent = 1 THEN 1 ELSE 0 END) AS capi_lead_sent
      FROM interconnected_leads
      WHERE created_at >= ${startMs}
      GROUP BY funnel_path
      ORDER BY leads DESC
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS locally_recorded_orders,
        COUNT(DISTINCT s.shopify_order_id) AS unique_shopify_order_ids,
        COALESCE(SUM(s.order_total), 0) AS final_order_revenue_cents,
        COALESCE(SUM(CASE WHEN s.capi_event_sent = 1 THEN 1 ELSE 0 END), 0) AS capi_purchase_events_sent,
        COALESCE(SUM(CASE WHEN s.capi_event_id IS NOT NULL AND s.capi_event_id <> '' THEN 1 ELSE 0 END), 0) AS distinct_capi_purchase_event_ids,
        COALESCE(SUM(CASE WHEN s.order_total = 6700 THEN 1 ELSE 0 END), 0) AS exact_67_orders
      FROM attributed_sales s
      INNER JOIN interconnected_leads l
        ON LOWER(TRIM(s.customer_email)) = LOWER(TRIM(l.email))
        AND s.order_created_at >= l.created_at
      WHERE l.funnel_path = 'ko_klaviyo'
        AND l.created_at >= ${startMs}
        AND s.order_created_at >= ${startMs}
        AND s.line_items LIKE ${`%${productTitle}%`}
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS post_repair_checkout_starts,
        COUNT(DISTINCT click_token) AS unique_checkout_tokens
      FROM interconnected_email_checkout_touches
      WHERE funnel_path = 'ko_klaviyo'
        AND clicked_at >= ${postRepairMs}
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS orders_with_any_ko_lead_match,
        COUNT(DISTINCT s.shopify_order_id) AS unique_orders_with_any_ko_lead_match,
        COALESCE(SUM(s.order_total), 0) AS final_order_revenue_cents,
        COALESCE(SUM(CASE WHEN s.capi_event_sent = 1 THEN 1 ELSE 0 END), 0) AS capi_purchase_events_sent
      FROM attributed_sales s
      INNER JOIN interconnected_leads l
        ON LOWER(TRIM(s.customer_email)) = LOWER(TRIM(l.email))
        AND s.order_created_at >= l.created_at
      WHERE l.funnel_path = 'ko_klaviyo'
        AND l.created_at >= ${startMs}
        AND s.order_created_at >= ${startMs}
    `),
  ]);

  const leadRows = rowsFrom(leadsByPathRaw).map((row) => ({
    funnelPath: String(row.funnel_path ?? "(unassigned)"),
    leads: numeric(row.leads),
    klaviyoSynced: numeric(row.klaviyo_synced),
    capiLeadSent: numeric(row.capi_lead_sent),
  }));
  const koSales = rowsFrom(koSalesRaw)[0] ?? {};
  const checkout = rowsFrom(checkoutRaw)[0] ?? {};
  const rawLedger = rowsFrom(rawLedgerRaw)[0] ?? {};

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    start: startIso,
    postRepairStart: postRepairIso,
    leadLedgerByPath: leadRows,
    koProductSalesInLocalLedger: {
      locallyRecordedOrders: numeric(koSales.locally_recorded_orders),
      uniqueShopifyOrderIds: numeric(koSales.unique_shopify_order_ids),
      exact67Orders: numeric(koSales.exact_67_orders),
      finalOrderRevenueCents: numeric(koSales.final_order_revenue_cents),
      capiPurchaseEventsSent: numeric(koSales.capi_purchase_events_sent),
      distinctCapiPurchaseEventIds: numeric(koSales.distinct_capi_purchase_event_ids),
    },
    postRepairThankYouCheckoutStarts: {
      starts: numeric(checkout.post_repair_checkout_starts),
      uniqueTokens: numeric(checkout.unique_checkout_tokens),
    },
    allKoLeadMatchedLocalOrderRows: {
      orderRows: numeric(rawLedger.orders_with_any_ko_lead_match),
      uniqueShopifyOrderIds: numeric(rawLedger.unique_orders_with_any_ko_lead_match),
      finalOrderRevenueCents: numeric(rawLedger.final_order_revenue_cents),
      capiPurchaseEventsSent: numeric(rawLedger.capi_purchase_events_sent),
    },
    note: "Aggregate-only first-party diagnostics. Shopify Admin paid-order reconciliation remains the transaction authority; the local ledger is a webhook and CAPI audit, not a substitute for Shopify financial status.",
  }, null, 2));
}

await main();
