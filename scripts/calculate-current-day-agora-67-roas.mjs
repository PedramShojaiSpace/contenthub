const clientId = process.env.KAJABI_CLIENT_ID;
const clientSecret = process.env.KAJABI_CLIENT_SECRET;
const siteId = "2148432935";
const metaAccessToken = process.env.META_AD_ACCESS_TOKEN;
const metaAdAccountId = process.env.META_AD_ACCOUNT_ID;
const dateCT = "2026-08-12";

if (!clientId || !clientSecret || !metaAccessToken || !metaAdAccountId) {
  throw new Error("Kajabi or Meta credentials are unavailable");
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
if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error("Kajabi token request failed");

const isDateInCT = (dateString) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(dateString)) === dateCT;

const paid67Transactions = [];
for (let page = 1; page <= 5; page += 1) {
  const response = await fetch(
    `https://api.kajabi.com/v1/transactions?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`,
    { headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/json" } }
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(`Kajabi transactions request failed (${response.status})`);
  for (const row of payload.data || []) {
    const attributes = row.attributes || {};
    const createdAt = attributes.created_at || "";
    if (!isDateInCT(createdAt)) continue;
    const amountCents = Number(attributes.amount_in_cents || 0);
    const state = String(attributes.state || "");
    const action = String(attributes.action || "");
    if (amountCents === 6700 && state !== "failed" && state !== "refunded" && action !== "refund") {
      paid67Transactions.push({
        transactionId: row.id,
        createdAt,
        amountCents,
        state,
        action,
      });
    }
  }
  if (!payload.links?.next) break;
}

const insightsUrl = new URL(`https://graph.facebook.com/v19.0/act_${metaAdAccountId}/insights`);
insightsUrl.searchParams.set("fields", "campaign_name,spend");
insightsUrl.searchParams.set("time_range", JSON.stringify({ since: dateCT, until: dateCT }));
insightsUrl.searchParams.set("level", "campaign");
insightsUrl.searchParams.set("limit", "500");
insightsUrl.searchParams.set("access_token", metaAccessToken);
const insightsResponse = await fetch(insightsUrl);
const insightsPayload = await insightsResponse.json();
if (!insightsResponse.ok || insightsPayload.error) {
  throw new Error(`Meta insights request failed: ${insightsPayload.error?.message || insightsResponse.status}`);
}
const agoraRows = (insightsPayload.data || []).filter((row) => String(row.campaign_name || "").toLowerCase().includes("agora"));
const agoraSpend = agoraRows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
const revenue = paid67Transactions.reduce((sum, transaction) => sum + transaction.amountCents / 100, 0);

console.log(JSON.stringify({
  dateCT,
  scope: "Agora campaign-name Meta spend and successful/non-refunded Kajabi $67 transactions only",
  agoraSpend: Number(agoraSpend.toFixed(2)),
  paid67Orders: paid67Transactions.length,
  paid67Revenue: Number(revenue.toFixed(2)),
  roas: agoraSpend ? Number((revenue / agoraSpend).toFixed(4)) : null,
  transactions: paid67Transactions,
  agoraCampaigns: agoraRows.map((row) => ({ campaignName: row.campaign_name, spend: Number(row.spend || 0) })),
}, null, 2));
