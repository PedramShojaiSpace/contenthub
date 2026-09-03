const businessId = process.argv[2];
const accessToken = process.env.META_AD_ACCESS_TOKEN;

if (!businessId || !accessToken) {
  throw new Error("Usage: META_AD_ACCESS_TOKEN=... node scripts/list-meta-business-ad-accounts.mjs <business-id>");
}

const url = new URL(`https://graph.facebook.com/v21.0/${businessId}/owned_ad_accounts`);
url.searchParams.set("access_token", accessToken);
url.searchParams.set("fields", "id,name,account_status,currency,timezone_name");
url.searchParams.set("limit", "100");

const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
const body = await response.json().catch(() => ({}));

console.log(JSON.stringify({
  readOnly: true,
  businessId,
  httpStatus: response.status,
  accounts: response.ok
    ? (body.data ?? []).map(account => ({
        id: account.id,
        name: account.name ?? null,
        accountStatus: account.account_status ?? null,
        currency: account.currency ?? null,
        timezone: account.timezone_name ?? null,
      }))
    : [],
  error: response.ok ? null : { code: body.error?.code ?? null, type: body.error?.type ?? null },
}, null, 2));
