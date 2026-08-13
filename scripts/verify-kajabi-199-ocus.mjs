const clientId = process.env.KAJABI_CLIENT_ID;
const clientSecret = process.env.KAJABI_CLIENT_SECRET;
const siteId = "2148432935";
const upsellId = "NHCArjLDhTMbteTJAeSQmHgt";

if (!clientId || !clientSecret) throw new Error("Kajabi API credentials are unavailable");

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

const matches = [];
for (let page = 1; page <= 20; page += 1) {
  const response = await fetch(
    `https://api.kajabi.com/v1/transactions?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`,
    { headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/json" } }
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(`Kajabi transactions request failed (${response.status})`);
  const rows = payload.data || [];
  if (!rows.length) break;

  for (const row of rows) {
    const attributes = row.attributes || {};
    const serialized = JSON.stringify(attributes);
    const amountCents = Number(attributes.amount_in_cents || 0);
    const state = String(attributes.state || "");
    const action = String(attributes.action || "");
    const isCandidate = amountCents === 19900 || serialized.includes(upsellId) || /(?:\$?199|ocus)/i.test(serialized);
    if (!isCandidate) continue;
    matches.push({
      transactionId: row.id,
      createdAt: attributes.created_at || null,
      amountCents,
      state,
      action,
      hasConfiguredUpsellId: serialized.includes(upsellId),
      offerId: attributes.offer_id || attributes.offer?.id || null,
      upsellId: attributes.upsell_id || attributes.upsell?.id || null,
      description: attributes.description || attributes.offer?.name || attributes.product_name || null,
    });
  }
  if (!payload.links?.next) break;
}

const successful199 = matches.filter((row) => row.amountCents === 19900 && row.state !== "failed" && row.state !== "refunded" && row.action !== "refund");
console.log(JSON.stringify({
  configuredUpsellId: upsellId,
  classificationRule: "Configured upsell ID resolves to 19900 cents; generic zero-value OCU after a prior $67 purchase also resolves to 19900 cents.",
  matchedCandidateTransactions: matches,
  successful199Transactions: successful199,
  successful199Count: successful199.length,
}, null, 2));
