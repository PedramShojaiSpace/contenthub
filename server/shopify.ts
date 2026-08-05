/**
 * Shopify Commerce helpers
 * - Checkout URL builder (cart permalinks with attribution tokens)
 * - Funnel product SKU map
 * - Klaviyo post-purchase tagging
 * - Storefront API checkout creation
 */

import { ENV } from "./_core/env";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? "theurbanmonkstore.myshopify.com";
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN ?? "";
const STOREFRONT_API_URL = `https://${STORE_DOMAIN}/api/2024-10/graphql.json`;

export const FUNNEL_PRODUCTS: Record<string, {
  name: string;
  variantId: string;
  priceCents: number;
  klaviyoTag: string;
  klaviyoFlowListId?: string;
  funnelSource: string;
  checkoutUrl: string;
}> = {
  interconnected_oto: {
    name: "Interconnected All-Access Bundle",
    variantId: "43591081296026",
    priceCents: 6700,
    klaviyoTag: "purchased_interconnected_oto",
    funnelSource: "interconnected",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/43591081296026:1",
  },
  interconnected_package_upgrade: {
    name: "Interconnected Package Upgrade",
    variantId: "46719608946842",
    priceCents: 29900,
    klaviyoTag: "purchased_interconnected_upgrade",
    funnelSource: "interconnected",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/46719608946842:1",
  },
  full_gut_testing: {
    name: "Full Gut Testing Upgrade",
    variantId: "46719608946842",
    priceCents: 39900,
    klaviyoTag: "purchased_full_gut_testing",
    funnelSource: "interconnected",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/46719608946842:1",
  },
  gut_retest: {
    name: "Gut Retest Kit",
    variantId: "46719641452698",
    priceCents: 19900,
    klaviyoTag: "purchased_gut_retest",
    funnelSource: "interconnected",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/46719641452698:1",
  },
  upstream_academy: {
    name: "Urban Monk Academy — Annual",
    variantId: "",
    priceCents: 29700,
    klaviyoTag: "purchased_academy_annual",
    funnelSource: "upstream_webinar",
    checkoutUrl: "",
  },
  vibe: {
    name: "VIBE",
    variantId: "45449033940122",
    priceCents: 5900,
    klaviyoTag: "purchased_supplement_vibe",
    funnelSource: "supplement",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033940122:1",
  },
  vaguvibe: {
    name: "VaguVibe",
    variantId: "45449033973914",
    priceCents: 5900,
    klaviyoTag: "purchased_supplement_vaguvibe",
    funnelSource: "supplement",
    checkoutUrl: "https://theurbanmonkstore.myshopify.com/cart/45449033973914:1",
  },
};

export function buildCheckoutUrl(
  variantId: string,
  qty = 1,
  opts: {
    clickToken?: string;
    email?: string;
    utmSource?: string;
    utmCampaign?: string;
    utmContent?: string;
    discountCode?: string;
  } = {}
): string {
  if (!variantId) return "";
  const base = `https://${STORE_DOMAIN}/cart/${variantId}:${qty}`;
  const params = new URLSearchParams();
  if (opts.discountCode) params.set("discount", opts.discountCode);
  if (opts.email) params.set("checkout[email]", opts.email);
  if (opts.clickToken) params.set("attributes[_um_click_token]", opts.clickToken);
  if (opts.utmSource) params.set("attributes[utm_source]", opts.utmSource);
  if (opts.utmCampaign) params.set("attributes[utm_campaign]", opts.utmCampaign);
  if (opts.utmContent) params.set("attributes[utm_content]", opts.utmContent);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function tagKlaviyoPurchaser(opts: {
  email: string;
  firstName?: string;
  phone?: string;
  tags: string[];
  listId?: string;
  orderTotal: number;
  shopifyOrderId: string;
  lineItems: Array<{ title: string; sku?: string; price: string }>;
}): Promise<{ ok: boolean; profileId?: string; error?: string }> {
  const klaviyoKey = ENV.klaviyoPrivateKey;
  if (!klaviyoKey) return { ok: false, error: "no_api_key" };

  const KLAVIYO_BASE = "https://a.klaviyo.com/api";
  const REVISION = "2024-10-15";
  const headers = {
    "Authorization": `Klaviyo-API-Key ${klaviyoKey}`,
    "Content-Type": "application/json",
    "revision": REVISION,
  };

  try {
    const profileAttrs: Record<string, unknown> = {
      email: opts.email,
      ...(opts.firstName ? { first_name: opts.firstName } : {}),
      ...(opts.phone ? { phone_number: normalizePhone(opts.phone) } : {}),
      properties: {
        last_purchase_total: (opts.orderTotal / 100).toFixed(2),
        last_purchase_order_id: opts.shopifyOrderId,
        last_purchase_source: "shopify",
        last_purchase_at: new Date().toISOString(),
        is_buyer: true,
        purchased_products: opts.lineItems.map(li => li.title).join(", "),
        ...Object.fromEntries(opts.tags.map(tag => [tag, true])),
      },
    };

    let profileId: string;
    const profileRes = await fetch(`${KLAVIYO_BASE}/profiles/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: { type: "profile", attributes: profileAttrs } }),
    });
    const profileJson = await profileRes.json() as any;

    if (profileRes.status === 409) {
      profileId = profileJson?.errors?.[0]?.meta?.duplicate_profile_id;
      if (!profileId) throw new Error("409 but no duplicate_profile_id");
      await fetch(`${KLAVIYO_BASE}/profiles/${profileId}/`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ data: { type: "profile", id: profileId, attributes: profileAttrs } }),
      });
    } else if (!profileRes.ok) {
      throw new Error(`upsertProfile failed (${profileRes.status}): ${JSON.stringify(profileJson)}`);
    } else {
      profileId = profileJson.data.id;
    }

    if (opts.listId && profileId) {
      await fetch(`${KLAVIYO_BASE}/lists/${opts.listId}/relationships/profiles/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: [{ type: "profile", id: profileId }] }),
      });
    }

    await fetch(`${KLAVIYO_BASE}/events/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: { data: { type: "metric", attributes: { name: "Placed Order" } } },
            profile: { data: { type: "profile", id: profileId } },
            properties: {
              OrderId: opts.shopifyOrderId,
              OrderValue: (opts.orderTotal / 100).toFixed(2),
              ItemNames: opts.lineItems.map(li => li.title),
              Items: opts.lineItems.map(li => ({ ProductName: li.title, SKU: li.sku ?? "", ItemPrice: li.price })),
            },
            value: opts.orderTotal / 100,
            time: new Date().toISOString(),
          },
        },
      }),
    });

    console.log(`[Klaviyo] Purchase tagged for ${opts.email} — order ${opts.shopifyOrderId}`);
    return { ok: true, profileId };
  } catch (err: any) {
    console.error("[Klaviyo] tagKlaviyoPurchaser error:", err?.message);
    return { ok: false, error: err?.message };
  }
}

export async function createStorefrontCheckout(opts: {
  variantId: string;
  qty?: number;
  email?: string;
  customAttributes?: Array<{ key: string; value: string }>;
  discountCode?: string;
}): Promise<{ checkoutUrl: string; checkoutId: string } | null> {
  if (!STOREFRONT_TOKEN) return null;

  const mutation = `
    mutation checkoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout { id webUrl }
        checkoutUserErrors { code field message }
      }
    }
  `;

  try {
    const res = await fetch(STOREFRONT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            lineItems: [{ variantId: `gid://shopify/ProductVariant/${opts.variantId}`, quantity: opts.qty ?? 1 }],
            email: opts.email ?? undefined,
            customAttributes: opts.customAttributes ?? [],
            ...(opts.discountCode ? { discountCodes: [opts.discountCode] } : {}),
          },
        },
      }),
    });
    const json = await res.json() as any;
    const checkout = json?.data?.checkoutCreate?.checkout;
    const errors = json?.data?.checkoutCreate?.checkoutUserErrors ?? [];
    if (errors.length > 0 || !checkout?.webUrl) return null;
    return { checkoutUrl: checkout.webUrl, checkoutId: checkout.id };
  } catch (err: any) {
    console.error("[Shopify] createStorefrontCheckout error:", err?.message);
    return null;
  }
}

export function detectFunnelProduct(lineItem: {
  title?: string;
  sku?: string;
  variant_id?: number | string;
}): { key: string; product: typeof FUNNEL_PRODUCTS[string] } | null {
  const variantId = String(lineItem.variant_id ?? "");
  const title = String(lineItem.title ?? "").toLowerCase();

  for (const [key, product] of Object.entries(FUNNEL_PRODUCTS)) {
    if (product.variantId && product.variantId === variantId) return { key, product };
  }

  if (title.includes("interconnected") && (title.includes("all-access") || title.includes("bundle"))) return { key: "interconnected_oto", product: FUNNEL_PRODUCTS.interconnected_oto };
  if (title.includes("interconnected") && title.includes("upgrade")) return { key: "interconnected_package_upgrade", product: FUNNEL_PRODUCTS.interconnected_package_upgrade };
  if (title.includes("gut") && (title.includes("test") || title.includes("permeability"))) return { key: "full_gut_testing", product: FUNNEL_PRODUCTS.full_gut_testing };
  if (title.includes("retest")) return { key: "gut_retest", product: FUNNEL_PRODUCTS.gut_retest };
  if (title.includes("vaguvibe")) return { key: "vaguvibe", product: FUNNEL_PRODUCTS.vaguvibe };
  if (title.includes("vibe")) return { key: "vibe", product: FUNNEL_PRODUCTS.vibe };

  return null;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
}
