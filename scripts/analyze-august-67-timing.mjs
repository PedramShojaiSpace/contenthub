const storeDomain = (process.env.SHOPIFY_ADMIN_STORE_DOMAIN || "theurbanmonkstore.myshopify.com")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error("Shopify Admin read-orders credentials are unavailable");
}

const tokenResponse = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }),
});
const tokenPayload = await tokenResponse.json();
if (!tokenResponse.ok || !tokenPayload.access_token) {
  throw new Error(`Shopify token exchange failed (${tokenResponse.status})`);
}

const query = `query AugustOrders {
  orders(first: 250, query: "created_at:>=2026-08-01", sortKey: CREATED_AT) {
    edges {
      node {
        id
        name
        createdAt
        processedAt
        displayFinancialStatus
        lineItems(first: 20) {
          edges {
            node {
              title
              quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage }
  }
}`;

const ordersResponse = await fetch(`https://${storeDomain}/admin/api/2026-07/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": tokenPayload.access_token,
  },
  body: JSON.stringify({ query }),
});
const ordersPayload = await ordersResponse.json();
if (!ordersResponse.ok || ordersPayload.errors) {
  throw new Error(`Shopify order query failed: ${JSON.stringify(ordersPayload.errors || ordersPayload)}`);
}

const hourInCentral = (dateString) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(dateString));
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
};

const dateInCentral = (dateString) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(dateString));

const allOrders = ordersPayload.data.orders.edges.map(({ node }) => node);
const paidLineItemTitles = Object.fromEntries(
  allOrders
    .filter((order) => order.displayFinancialStatus === "PAID")
    .flatMap((order) => order.lineItems.edges.map(({ node: line }) => [line.title, 0]))
    .map(([title]) => [title, 0])
);
for (const order of allOrders) {
  if (order.displayFinancialStatus !== "PAID") continue;
  for (const { node: line } of order.lineItems.edges) {
    paidLineItemTitles[line.title] = (paidLineItemTitles[line.title] || 0) + line.quantity;
  }
}
const matchingOrders = [];
for (const order of allOrders) {
  if (order.displayFinancialStatus !== "PAID") continue;
  for (const { node: line } of order.lineItems.edges) {
    if (line.title !== "Interconnected: The Complete Healing Protocol") continue;
    const timestamp = order.processedAt || order.createdAt;
    matchingOrders.push({
      order: order.name,
      timestamp,
      dateCT: dateInCentral(timestamp),
      hourCT: hourInCentral(timestamp),
      quantity: line.quantity,
      lineRevenue: Number(line.originalUnitPriceSet.shopMoney.amount) * line.quantity,
      currency: line.originalUnitPriceSet.shopMoney.currencyCode,
    });
  }
}

const hourCounts = Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, 0]));
const dayCounts = {};
for (const order of matchingOrders) {
  hourCounts[order.hourCT] += 1;
  dayCounts[order.dateCT] = (dayCounts[order.dateCT] || 0) + 1;
}

const total = matchingOrders.length;
const evening = matchingOrders.filter((order) => order.hourCT >= 17 && order.hourCT <= 22).length;
const summary = {
  timezone: "America/Chicago",
  source: "Shopify Admin paid orders; matched line item only",
  month: "2026-08 through query time",
  totalPaid67Orders: total,
  totalLineRevenue: matchingOrders.reduce((sum, order) => sum + order.lineRevenue, 0),
  eveningOrders17to22CT: evening,
  eveningShare: total ? Number((evening / total).toFixed(4)) : null,
  hourCounts,
  dayCounts,
  orders: matchingOrders,
  paidLineItemTitles,
  shopifyReturnedAllOrders: allOrders.length,
  hasAdditionalPages: ordersPayload.data.orders.pageInfo.hasNextPage,
};

console.log(JSON.stringify(summary, null, 2));
