import { desc } from "drizzle-orm";
import { attributedSales } from "../drizzle/schema";
import { getDb } from "./db";
import { testKlaviyoConnection } from "./klaviyo";
import { protectedProcedure, router } from "./_core/trpc";

type HealthStatus = "ok" | "degraded" | "error";

type ServiceHealth = {
  status: HealthStatus;
  detail: string;
  checkedAt: number;
};

const CHECK_TIMEOUT_MS = 8_000;

function nowHealth(status: HealthStatus, detail: string): ServiceHealth {
  return { status, detail, checkedAt: Date.now() };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 180);
}

async function checkWordPress(): Promise<ServiceHealth> {
  const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
  const username = process.env.WORDPRESS_USERNAME ?? "";
  const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
  if (!baseUrl || !username || !appPassword) return nowHealth("error", "WordPress credentials are not fully configured.");

  try {
    const authHeader = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return nowHealth("error", `WordPress returned HTTP ${response.status}.`);
    const data = await response.json() as { name?: string };
    return nowHealth("ok", `Connected as ${data.name ?? "authenticated WordPress user"}.`);
  } catch (error) {
    return nowHealth("error", `WordPress check failed: ${errorMessage(error)}`);
  }
}

async function checkShopify(): Promise<ServiceHealth> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN;
  if (!domain || !token) return nowHealth("error", "Shopify Storefront credentials are not fully configured.");

  try {
    const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: "{ shop { name } }" }),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    const payload = await response.json() as { data?: { shop?: { name?: string } }; errors?: Array<{ message?: string }> };
    if (!response.ok || payload.errors?.length || !payload.data?.shop?.name) {
      return nowHealth("error", `Shopify check failed: ${payload.errors?.[0]?.message ?? `HTTP ${response.status}`}.`);
    }
    return nowHealth("ok", `Storefront API connected to ${payload.data.shop.name}.`);
  } catch (error) {
    return nowHealth("error", `Shopify check failed: ${errorMessage(error)}`);
  }
}

async function checkMeta(): Promise<ServiceHealth> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const token = process.env.META_AD_ACCESS_TOKEN;
  if (!accountId || !token) return nowHealth("error", "Meta ad-account credentials are not fully configured.");

  try {
    const id = accountId.replace(/^act_/, "");
    const params = new URLSearchParams({ fields: "id,name", access_token: token });
    const response = await fetch(`https://graph.facebook.com/v22.0/act_${id}?${params.toString()}`, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    const payload = await response.json() as { id?: string; name?: string; error?: { message?: string } };
    if (!response.ok || !payload.id) return nowHealth("error", `Meta check failed: ${payload.error?.message ?? `HTTP ${response.status}`}.`);
    return nowHealth("ok", `Connected to ${payload.name ?? `ad account ${id}`}.`);
  } catch (error) {
    return nowHealth("error", `Meta check failed: ${errorMessage(error)}`);
  }
}

async function checkKajabi(): Promise<ServiceHealth> {
  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  if (!clientId || !clientSecret) return nowHealth("error", "Kajabi OAuth credentials are not fully configured.");

  try {
    const response = await fetch("https://api.kajabi.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    const payload = await response.json() as { access_token?: string; error_description?: string; error?: string };
    if (!response.ok || !payload.access_token) return nowHealth("error", `Kajabi OAuth check failed: ${payload.error_description ?? payload.error ?? `HTTP ${response.status}`}.`);
    return nowHealth("ok", "Kajabi OAuth token issued successfully.");
  } catch (error) {
    return nowHealth("error", `Kajabi check failed: ${errorMessage(error)}`);
  }
}

async function checkKlaviyo(): Promise<ServiceHealth> {
  try {
    const result = await testKlaviyoConnection();
    return result.ok
      ? nowHealth("ok", `Connected to ${result.accountName ?? "Klaviyo account"}.`)
      : nowHealth("error", result.error ?? "Klaviyo connection failed.");
  } catch (error) {
    return nowHealth("error", `Klaviyo check failed: ${errorMessage(error)}`);
  }
}

async function checkShopifyWebhookFreshness(): Promise<ServiceHealth> {
  try {
    const db = await getDb();
    if (!db) return nowHealth("error", "Database unavailable for webhook freshness check.");
    const latest = await db
      .select({ receivedAt: attributedSales.receivedAt })
      .from(attributedSales)
      .orderBy(desc(attributedSales.receivedAt))
      .limit(1);
    const receivedAt = latest[0]?.receivedAt;
    if (!receivedAt) return nowHealth("degraded", "No attributed Shopify paid-order webhook has been recorded yet.");

    const ageDays = Math.floor((Date.now() - receivedAt) / 86_400_000);
    if (ageDays > 30) return nowHealth("degraded", `Last attributed Shopify paid-order webhook was ${ageDays} days ago.`);
    return nowHealth("ok", `Last attributed Shopify paid-order webhook was ${ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`}.`);
  } catch (error) {
    return nowHealth("error", `Webhook freshness check failed: ${errorMessage(error)}`);
  }
}

export const integrationHealthRouter = router({
  critical: protectedProcedure.query(async () => {
    const [wordpress, shopify, meta, kajabi, klaviyo, shopifyWebhook] = await Promise.all([
      checkWordPress(),
      checkShopify(),
      checkMeta(),
      checkKajabi(),
      checkKlaviyo(),
      checkShopifyWebhookFreshness(),
    ]);

    return { checkedAt: Date.now(), services: { wordpress, shopify, meta, kajabi, klaviyo, shopifyWebhook } };
  }),
});
