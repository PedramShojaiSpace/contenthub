import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "../server/shopifyAdminAuth";

const startIso = process.env.START_ISO ?? "2026-09-20T16:07:00.000Z";
const startDate = startIso.slice(0, 10);
const zipifyPublishedAt = Date.parse(process.env.ZIPIFY_PUBLISHED_AT ?? "2026-09-20T19:56:00.000Z");

const query = `#graphql
  query InterconnectedOrders($query: String!) {
    orders(first: 100, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        displayFinancialStatus
        cancelledAt
        processedAt
        paymentGatewayNames
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 25) { nodes { sku quantity } }
      }
    }
  }
`;

type Order = {
  id: string;
  displayFinancialStatus: string;
  cancelledAt: string | null;
  processedAt: string | null;
  paymentGatewayNames: string[];
  totalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  lineItems?: { nodes?: Array<{ sku?: string | null; quantity?: number }> };
};

async function main() {
  const token = await getShopifyAdminAccessToken();
  const domain = getShopifyAdminStoreDomain();
  const response = await fetch(`https://${domain}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables: { query: `created_at:>=${startDate} status:any` } }),
  });
  const body = await response.json() as { data?: { orders?: { nodes?: Order[] } }; errors?: unknown };
  if (!response.ok || body.errors) throw new Error(`Shopify GraphQL order read failed: ${response.status}`);

  const eligibleTriggerOrders = (body.data?.orders?.nodes ?? []).filter((order) =>
    order.lineItems?.nodes?.some((line) => line.sku === "UM-OTO")
    && order.displayFinancialStatus === "PAID"
    && !order.cancelledAt
  );

  const byGateway = new Map<string, { orders: number; revenue: number; currency: string }>();
  const byPublicationStatus = {
    beforeZipifyPublication: 0,
    afterZipifyPublication: 0,
    unknownTime: 0,
  };
  for (const order of eligibleTriggerOrders) {
    const gateway = order.paymentGatewayNames?.join(" + ") || "(missing)";
    const money = order.totalPriceSet?.shopMoney;
    const entry = byGateway.get(gateway) ?? { orders: 0, revenue: 0, currency: money?.currencyCode ?? "USD" };
    entry.orders += 1;
    entry.revenue += Number(money?.amount ?? 0) || 0;
    byGateway.set(gateway, entry);
    const processedAt = Date.parse(order.processedAt ?? "");
    if (!Number.isFinite(processedAt)) byPublicationStatus.unknownTime += 1;
    else if (processedAt < zipifyPublishedAt) byPublicationStatus.beforeZipifyPublication += 1;
    else byPublicationStatus.afterZipifyPublication += 1;
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    startIso,
    zipifyPublishedAt: new Date(zipifyPublishedAt).toISOString(),
    paidNonCancelledInterconnectedTriggerOrders: eligibleTriggerOrders.length,
    byPublicationStatus,
    paymentGatewayGroups: [...byGateway.entries()].map(([paymentGateway, value]) => ({
      paymentGateway,
      orders: value.orders,
      revenue: Math.round(value.revenue * 100) / 100,
      currency: value.currency,
    })),
    note: "Aggregate-only payment gateway read. This identifies whether the initial Zipify view gap may track with gateway eligibility; it does not expose customer or order identifiers.",
  }, null, 2));
}

await main();
