const clientId = process.env.KAJABI_CLIENT_ID;
const clientSecret = process.env.KAJABI_CLIENT_SECRET;
const siteId = "2148432935";

if (!clientId || !clientSecret) {
  throw new Error("Kajabi API credentials are unavailable");
}

const tokenResponse = await fetch("https://api.kajabi.com/v1/oauth/token", {
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
  throw new Error(`Kajabi token request failed (${tokenResponse.status})`);
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

const transactions = [];
for (let page = 1; page <= 20; page += 1) {
  const url = `https://api.kajabi.com/v1/transactions?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Kajabi transaction query failed (${response.status})`);
  const payload = await response.json();
  const rows = payload.data || [];
  if (!rows.length) break;

  let reachedEarlierMonth = false;
  for (const row of rows) {
    const attributes = row.attributes || {};
    const createdAt = attributes.created_at || "";
    const date = createdAt.slice(0, 10);
    if (date < "2026-08-01") {
      reachedEarlierMonth = true;
      break;
    }
    if (date > "2026-08-31") continue;
    const amountCents = attributes.amount_in_cents || 0;
    const state = attributes.state || "";
    const action = attributes.action || "";
    if (amountCents !== 6700 || state === "failed" || state === "refunded" || action === "refund") continue;
    transactions.push({
      transactionId: row.id,
      createdAt,
      dateCT: dateInCentral(createdAt),
      hourCT: hourInCentral(createdAt),
      state,
      action,
      amountCents,
    });
  }
  if (reachedEarlierMonth || !payload.links?.next) break;
}

const hourCounts = Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, 0]));
const dayCounts = {};
for (const transaction of transactions) {
  hourCounts[transaction.hourCT] += 1;
  dayCounts[transaction.dateCT] = (dayCounts[transaction.dateCT] || 0) + 1;
}
const eveningOrders = transactions.filter((transaction) => transaction.hourCT >= 17 && transaction.hourCT <= 22).length;

console.log(JSON.stringify({
  timezone: "America/Chicago",
  source: "Kajabi transactions API; successful/non-refunded $67 transactions",
  totalPaid67Orders: transactions.length,
  totalRevenue: transactions.length * 67,
  eveningOrders17to22CT: eveningOrders,
  eveningShare: transactions.length ? Number((eveningOrders / transactions.length).toFixed(4)) : null,
  hourCounts,
  dayCounts,
  transactions,
}, null, 2));
