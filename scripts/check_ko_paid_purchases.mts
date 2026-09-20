import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "../server/shopifyAdminAuth";

const now = Date.now();
const sinceMinutes = Number(process.env.SINCE_MINUTES ?? "240");
const sinceMs = now - sinceMinutes * 60_000;
const interconnectedProductTitle = "Interconnected: The Complete Healing Protocol";

type LeadRow = { email: string; created_at: number };
type ShopifyOrder = {
  id: string;
  createdAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus: string;
  email?: string | null;
  lineItems: {
    nodes: Array<{
      title: string;
      quantity: number;
      originalTotalSet: { shopMoney: { amount: string } };
      discountedTotalSet: { shopMoney: { amount: string } };
    }>;
  };
};

function rowsFrom(value: unknown): Array<Record<string, unknown>> {
  const outer = Array.isArray(value) ? value[0] : value;
  return Array.isArray(outer) ? outer as Array<Record<string, unknown>> : outer ? [outer as Record<string, unknown>] : [];
}

function toCents(amount: string) {
  return Math.round(Number(amount) * 100);
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const rawLeads = await db.execute(sql`
    SELECT email, created_at
    FROM interconnected_leads
    WHERE funnel_path = 'ko_klaviyo' AND created_at >= ${sinceMs}
    ORDER BY created_at ASC
  `);
  const leads = rowsFrom(rawLeads).map((row): LeadRow => ({
    email: String(row.email ?? "").trim().toLowerCase(),
    created_at: Number(row.created_at ?? 0),
  })).filter((row) => row.email);
  const leadByEmail = new Map(leads.map((lead) => [lead.email, lead]));

  const accessToken = await getShopifyAdminAccessToken();
  const storeDomain = getShopifyAdminStoreDomain();
  const searchStart = new Date(sinceMs).toISOString();
  const query = `
    query RecentPaidOrders($cursor: String) {
      orders(first: 100, after: $cursor, query: "financial_status:paid created_at:>=${searchStart}") {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          createdAt
          cancelledAt
          displayFinancialStatus
          email
          lineItems(first: 30) {
            nodes {
              title
              quantity
              originalTotalSet { shopMoney { amount } }
              discountedTotalSet { shopMoney { amount } }
            }
          }
        }
      }
    }
  `;

  const orders: ShopifyOrder[] = [];
  let cursor: string | null = null;
  let pages = 0;
  while (pages < 10) {
    const response = await fetch(`https://${storeDomain}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    });
    const body = await response.json() as any;
    if (!response.ok || body.errors || !body.data?.orders) {
      throw new Error(body.errors?.[0]?.message ?? `Shopify order query failed: HTTP ${response.status}`);
    }
    orders.push(...body.data.orders.nodes);
    pages += 1;
    if (!body.data.orders.pageInfo.hasNextPage) break;
    cursor = body.data.orders.pageInfo.endCursor;
  }

  const eligibleOrders = orders.filter((order) => !order.cancelledAt && order.displayFinancialStatus === "PAID");
  const productOrders = eligibleOrders.map((order) => {
    const matchingLines = order.lineItems.nodes.filter((line) => line.title === interconnectedProductTitle);
    const productRevenueCents = matchingLines.reduce(
      (sum, line) => sum + toCents(line.discountedTotalSet?.shopMoney?.amount ?? line.originalTotalSet.shopMoney.amount),
      0,
    );
    return { order, productRevenueCents };
  }).filter(({ productRevenueCents }) => productRevenueCents > 0);

  const matchedKoOrders = productOrders.filter(({ order }) => {
    const email = order.email?.trim().toLowerCase() ?? "";
    const lead = leadByEmail.get(email);
    return Boolean(lead && Date.parse(order.createdAt) >= lead.created_at);
  });
  const matchedRevenueCents = matchedKoOrders.reduce((sum, row) => sum + row.productRevenueCents, 0);
  const matched67Orders = matchedKoOrders.filter((row) => row.productRevenueCents === 6700);

  console.log(JSON.stringify({
    checkedAt: new Date(now).toISOString(),
    lookbackMinutes: sinceMinutes,
    koLeads: leads.length,
    paidInterconnectedOrdersInStore: productOrders.length,
    paidInterconnectedOrdersMatchedToKoLeads: matchedKoOrders.length,
    matched67Orders: matched67Orders.length,
    matchedInterconnectedRevenueCents: matchedRevenueCents,
    leadToPaidOrderConversionRate: leads.length ? Number((matchedKoOrders.length / leads.length * 100).toFixed(2)) : null,
    note: "Shopify paid orders are the transaction authority. Counts include only paid, non-cancelled orders whose buyer email matches a paid LP-3 KO lead created before the order; customer/order identifiers are intentionally omitted.",
  }, null, 2));
}

await main();
process.exit(0);
