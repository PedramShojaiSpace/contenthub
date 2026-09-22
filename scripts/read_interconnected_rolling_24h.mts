import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  CURRENT_INTERCONNECTED_OFFER_TIERS,
  fetchKajabiTransactionsForExactOfferTracking,
  operationalDate,
  type KajabiTransactionRow,
} from "../server/kajabiSalesRouter";
import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "../server/shopifyAdminAuth";

const startIso = process.env.START_ISO ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const endIso = process.env.END_ISO ?? new Date().toISOString();
const launchStartIso = process.env.LAUNCH_START_ISO ?? "2026-09-20T16:07:00.000Z";
const startMs = Date.parse(startIso);
const endMs = Date.parse(endIso);
const launchStartMs = Date.parse(launchStartIso);
const startDate = operationalDate(startIso);
const endDate = operationalDate(endIso);
const interconnectedProductTitle = "Interconnected: The Complete Healing Protocol";

type ShopifyOrder = {
  id: string;
  createdAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus: string;
  email?: string | null;
  totalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  lineItems?: { nodes?: Array<{ title?: string; discountedTotalSet?: { shopMoney?: { amount?: string } } }> };
};

type LeadRow = { email: string; funnelPath: string; createdAt: number };

type KajabiPurchase = { email: string; amountCents: number; purchasedAt: number; orderId: string };

function rowsFrom(value: unknown): Array<Record<string, unknown>> {
  const outer = Array.isArray(value) ? value[0] : value;
  return Array.isArray(outer) ? outer as Array<Record<string, unknown>> : outer ? [outer as Record<string, unknown>] : [];
}

function cents(value: string | undefined) {
  return Math.round((Number(value ?? "0") || 0) * 100);
}

function includedKajabiTransaction(row: KajabiTransactionRow) {
  const createdAt = Date.parse(row.attributes?.created_at || "");
  const amount = row.attributes?.amount_in_cents || 0;
  const state = row.attributes?.state || "";
  const action = row.attributes?.action || "";
  const offerId = row.relationships?.offer?.data?.id || "";
  const expected = CURRENT_INTERCONNECTED_OFFER_TIERS[offerId as keyof typeof CURRENT_INTERCONNECTED_OFFER_TIERS];
  return Number.isFinite(createdAt)
    && createdAt >= startMs
    && createdAt <= endMs
    && Boolean(expected)
    && amount === expected?.priceCents
    && amount > 0
    && state !== "failed"
    && state !== "refunded"
    && action !== "refund";
}

async function readShopifyOrders() {
  const token = await getShopifyAdminAccessToken();
  const domain = getShopifyAdminStoreDomain();
  const query = `#graphql
    query CurrentOrders($cursor: String, $search: String!) {
      orders(first: 100, after: $cursor, query: $search, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          createdAt
          cancelledAt
          displayFinancialStatus
          email
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 30) { nodes { title discountedTotalSet { shopMoney { amount } } } }
        }
      }
    }
  `;
  const orders: ShopifyOrder[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables: { cursor, search: `financial_status:paid created_at:>=${startIso}` } }),
    });
    const body = await response.json() as { data?: { orders?: { nodes?: ShopifyOrder[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } }; errors?: Array<{ message?: string }> };
    if (!response.ok || body.errors || !body.data?.orders) throw new Error(body.errors?.[0]?.message ?? `Shopify order read failed: HTTP ${response.status}`);
    orders.push(...(body.data.orders.nodes ?? []));
    const pageInfo = body.data.orders.pageInfo;
    if (!pageInfo?.hasNextPage) break;
    cursor = pageInfo.endCursor ?? null;
  }
  return orders.filter((order) => !order.cancelledAt && order.displayFinancialStatus === "PAID");
}

async function main() {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs || !Number.isFinite(launchStartMs)) {
    throw new Error("Invalid reporting timestamps");
  }
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [leadRaw, kajabiPurchaseRaw, kajabiRows, shopifyOrders] = await Promise.all([
    db.execute(sql`
      SELECT email, funnel_path, created_at
      FROM interconnected_leads
      WHERE created_at >= ${launchStartMs} AND created_at <= ${endMs}
    `),
    db.execute(sql`
      SELECT email, amount_cents, purchased_at, kajabi_order_id
      FROM kajabi_purchases
      WHERE purchased_at >= ${startMs} AND purchased_at <= ${endMs}
    `),
    fetchKajabiTransactionsForExactOfferTracking(startDate, endDate),
    readShopifyOrders(),
  ]);

  const allLeads = rowsFrom(leadRaw).map((row): LeadRow => ({
    email: String(row.email ?? "").trim().toLowerCase(),
    funnelPath: String(row.funnel_path ?? "").trim() || "(unassigned)",
    createdAt: Number(row.created_at ?? 0),
  })).filter((row) => row.email && Number.isFinite(row.createdAt));

  const firstLeadByPathAndEmail = new Map<string, LeadRow>();
  for (const lead of allLeads) {
    const key = `${lead.funnelPath}\u0000${lead.email}`;
    const prior = firstLeadByPathAndEmail.get(key);
    if (!prior || lead.createdAt < prior.createdAt) firstLeadByPathAndEmail.set(key, lead);
  }

  const rollingLeadCounts = new Map<string, number>();
  for (const lead of firstLeadByPathAndEmail.values()) {
    if (lead.createdAt < startMs) continue;
    rollingLeadCounts.set(lead.funnelPath, (rollingLeadCounts.get(lead.funnelPath) ?? 0) + 1);
  }

  const allKoLeadsByEmail = new Map<string, LeadRow>();
  for (const lead of firstLeadByPathAndEmail.values()) {
    if (lead.funnelPath !== "ko_klaviyo") continue;
    const prior = allKoLeadsByEmail.get(lead.email);
    if (!prior || lead.createdAt < prior.createdAt) allKoLeadsByEmail.set(lead.email, lead);
  }

  const currentKajabiTransactions = kajabiRows.rows.filter(includedKajabiTransaction);
  const kajabiOperational = {
    entry67Count: currentKajabiTransactions.filter((row) => row.attributes.amount_in_cents === 6700).length,
    upsell199Count: currentKajabiTransactions.filter((row) => row.attributes.amount_in_cents === 19900).length,
    revenueCents: currentKajabiTransactions.reduce((sum, row) => sum + row.attributes.amount_in_cents, 0),
  };

  const kajabiPurchases = rowsFrom(kajabiPurchaseRaw).map((row): KajabiPurchase => ({
    email: String(row.email ?? "").trim().toLowerCase(),
    amountCents: Number(row.amount_cents ?? 0),
    purchasedAt: Number(row.purchased_at ?? 0),
    orderId: String(row.kajabi_order_id ?? ""),
  })).filter((row) => row.email && row.amountCents > 0 && Number.isFinite(row.purchasedAt));

  const allKajabiLeadsByEmail = new Map<string, LeadRow>();
  for (const lead of firstLeadByPathAndEmail.values()) {
    if (lead.funnelPath !== "kajabi") continue;
    const prior = allKajabiLeadsByEmail.get(lead.email);
    if (!prior || lead.createdAt < prior.createdAt) allKajabiLeadsByEmail.set(lead.email, lead);
  }

  const dedupKajabiOrders = new Set<string>();
  let kajabiMatchedCashOrders = 0;
  let kajabiMatchedCashRevenueCents = 0;
  let kajabiMatchedRollingCohortOrders = 0;
  let kajabiMatchedRollingCohortRevenueCents = 0;
  for (const purchase of kajabiPurchases) {
    const dedup = purchase.orderId || `${purchase.email}:${purchase.amountCents}:${Math.round(purchase.purchasedAt / 60_000)}`;
    if (dedupKajabiOrders.has(dedup)) continue;
    dedupKajabiOrders.add(dedup);
    const lead = allKajabiLeadsByEmail.get(purchase.email);
    if (!lead || purchase.purchasedAt < lead.createdAt) continue;
    kajabiMatchedCashOrders += 1;
    kajabiMatchedCashRevenueCents += purchase.amountCents;
    if (lead.createdAt >= startMs) {
      kajabiMatchedRollingCohortOrders += 1;
      kajabiMatchedRollingCohortRevenueCents += purchase.amountCents;
    }
  }

  const interconnectedShopifyOrders = shopifyOrders.map((order) => {
    const entryRevenueCents = (order.lineItems?.nodes ?? [])
      .filter((line) => line.title === interconnectedProductTitle)
      .reduce((sum, line) => sum + cents(line.discountedTotalSet?.shopMoney?.amount), 0);
    return { order, entryRevenueCents, finalOrderRevenueCents: cents(order.totalPriceSet?.shopMoney?.amount) };
  }).filter((row) => row.entryRevenueCents > 0);

  let shopifyMatchedCashOrders = 0;
  let shopifyMatchedCashEntryRevenueCents = 0;
  let shopifyMatchedCashFinalRevenueCents = 0;
  let shopifyMatchedRollingCohortOrders = 0;
  let shopifyMatchedRollingCohortEntryRevenueCents = 0;
  let shopifyMatchedRollingCohortFinalRevenueCents = 0;
  for (const row of interconnectedShopifyOrders) {
    const email = row.order.email?.trim().toLowerCase() ?? "";
    const lead = allKoLeadsByEmail.get(email);
    const orderMs = Date.parse(row.order.createdAt);
    if (!lead || !Number.isFinite(orderMs) || orderMs < lead.createdAt) continue;
    shopifyMatchedCashOrders += 1;
    shopifyMatchedCashEntryRevenueCents += row.entryRevenueCents;
    shopifyMatchedCashFinalRevenueCents += row.finalOrderRevenueCents;
    if (lead.createdAt >= startMs) {
      shopifyMatchedRollingCohortOrders += 1;
      shopifyMatchedRollingCohortEntryRevenueCents += row.entryRevenueCents;
      shopifyMatchedRollingCohortFinalRevenueCents += row.finalOrderRevenueCents;
    }
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    window: { startIso, endIso, durationHours: Number(((endMs - startMs) / 3_600_000).toFixed(3)) },
    rolling24hNewLeads: {
      kajabi: rollingLeadCounts.get("kajabi") ?? 0,
      klaviyoShopify: rollingLeadCounts.get("ko_klaviyo") ?? 0,
    },
    operationalCashCollectedDuringWindow: {
      kajabi: {
        directExactOfferTransactions: {
          entry67Count: kajabiOperational.entry67Count,
          upsell199Count: kajabiOperational.upsell199Count,
          revenueCents: kajabiOperational.revenueCents,
          note: "Direct Kajabi transaction API; exact current offer IDs; no matching to lead required for this cash view.",
        },
        matchedPurchaseLedger: { orders: kajabiMatchedCashOrders, revenueCents: kajabiMatchedCashRevenueCents },
      },
      klaviyoShopify: {
        matchedOrders: shopifyMatchedCashOrders,
        entryRevenueCents: shopifyMatchedCashEntryRevenueCents,
        finalOrderRevenueCents: shopifyMatchedCashFinalRevenueCents,
        note: "Shopify paid, non-cancelled Interconnected orders during the rolling window, matched by normalized email and chronology to a KO lead acquired since launch.",
      },
    },
    rolling24hLeadCohortOutcomesSoFar: {
      kajabi: { matchedOrders: kajabiMatchedRollingCohortOrders, revenueCents: kajabiMatchedRollingCohortRevenueCents },
      klaviyoShopify: { matchedOrders: shopifyMatchedRollingCohortOrders, entryRevenueCents: shopifyMatchedRollingCohortEntryRevenueCents, finalOrderRevenueCents: shopifyMatchedRollingCohortFinalRevenueCents },
    },
    safeguards: [
      "Kajabi and Shopify cash ledgers remain separate.",
      "Shopify final order revenue includes an accepted native post-purchase item only if Shopify reports it on the paid order total.",
      "The rolling lead cohort is immature and is not a winner declaration.",
      "No PII is emitted.",
    ],
  }, null, 2));
}

await main();
