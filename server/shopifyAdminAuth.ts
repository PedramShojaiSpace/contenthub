const DEFAULT_ADMIN_STORE_DOMAIN = "theurbanmonkstore.myshopify.com";

type ShopifyTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

export function getShopifyAdminStoreDomain() {
  const configured = process.env.SHOPIFY_ADMIN_STORE_DOMAIN
    ?.replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  return configured?.endsWith(".myshopify.com")
    ? configured
    : DEFAULT_ADMIN_STORE_DOMAIN;
}

export async function getShopifyAdminAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Shopify Admin order-read credentials are not configured");
  }

  const response = await fetch(
    `https://${getShopifyAdminStoreDomain()}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  const responseText = await response.text();
  let tokenResponse: ShopifyTokenResponse;
  try {
    tokenResponse = JSON.parse(responseText) as ShopifyTokenResponse;
  } catch {
    throw new Error(`Shopify token exchange returned HTTP ${response.status}`);
  }

  if (!response.ok || !tokenResponse.access_token) {
    throw new Error(`Shopify token exchange failed with HTTP ${response.status}`);
  }

  if (!tokenResponse.scope?.split(",").includes("read_orders")) {
    throw new Error("Shopify token is missing the required read_orders scope");
  }

  cachedToken = {
    value: tokenResponse.access_token,
    expiresAt: now + (tokenResponse.expires_in ?? 86_399) * 1000,
  };
  return cachedToken.value;
}
