/**
 * Attribution Panel Router
 * Provides Kajabi email attribution (subscribers by tag/source) and
 * Shopify revenue attribution (orders by UTM campaign) for the analytics dashboard.
 *
 * Shopify data is the single source of truth for revenue metrics (per project policy).
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getKajabiTags, getKajabiContactsByTag } from "./kajabiApi";

// ─── Shopify Admin API helper ─────────────────────────────────────────────────
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? "theurbanmonkstore.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN ?? "";

/**
 * Fetch recent Shopify orders via the Admin REST API.
 * Returns orders with note_attributes (where UTM params are stored by most themes).
 */
async function fetchShopifyOrders(params: {
  limit?: number;
  createdAtMin?: string; // ISO date string
  status?: "any" | "open" | "closed" | "cancelled";
}): Promise<Array<{
  id: number;
  orderNumber: number;
  totalPriceCents: number;
  currency: string;
  createdAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  email: string | null;
  financialStatus: string;
}>> {
  const url = new URL(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json`);
  url.searchParams.set("limit", String(params.limit ?? 250));
  url.searchParams.set("status", params.status ?? "any");
  if (params.createdAtMin) url.searchParams.set("created_at_min", params.createdAtMin);

  const res = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify orders fetch failed (${res.status}): ${text}`);
  }

  type ShopifyOrder = {
    id: number;
    order_number: number;
    total_price: string;
    currency: string;
    created_at: string;
    email: string | null;
    financial_status: string;
    note_attributes: Array<{ name: string; value: string }>;
    landing_site?: string | null;
  };

  const data = await res.json() as { orders: ShopifyOrder[] };

  return (data.orders ?? []).map((o) => {
    // UTM params may be in note_attributes (set by theme) or parseable from landing_site
    const attrs: Record<string, string> = {};
    for (const a of o.note_attributes ?? []) {
      attrs[a.name.toLowerCase()] = a.value;
    }
    // Fallback: parse landing_site URL for UTM params
    if (o.landing_site) {
      try {
        const ls = new URL(o.landing_site.startsWith("http") ? o.landing_site : `https://x.com${o.landing_site}`);
        Array.from(ls.searchParams.entries()).forEach(([k, v]) => {
          if (!attrs[k]) attrs[k] = v;
        });
      } catch { /* ignore */ }
    }
    return {
      id: o.id,
      orderNumber: o.order_number,
      totalPriceCents: Math.round(parseFloat(o.total_price ?? "0") * 100),
      currency: o.currency ?? "USD",
      createdAt: o.created_at,
      utmSource: attrs["utm_source"] ?? null,
      utmMedium: attrs["utm_medium"] ?? null,
      utmCampaign: attrs["utm_campaign"] ?? null,
      utmContent: attrs["utm_content"] ?? null,
      email: o.email ?? null,
      financialStatus: o.financial_status ?? "unknown",
    };
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const attributionPanelRouter = router({
  /**
   * Kajabi email attribution: list all tags with subscriber counts.
   * Useful for seeing which source/campaign tags have the most contacts.
   */
  getKajabiTagSummary: protectedProcedure.query(async () => {
    const tags = await getKajabiTags();
    // Sort by contact count descending
    return tags.sort((a, b) => b.contactCount - a.contactCount);
  }),

  /**
   * Kajabi email attribution: get contacts for a specific tag.
   * Used to drill into a particular source/campaign.
   */
  getKajabiContactsByTag: protectedProcedure
    .input(z.object({ tagName: z.string().min(1) }))
    .query(async ({ input }) => {
      return getKajabiContactsByTag(input.tagName);
    }),

  /**
   * Shopify revenue attribution: aggregate orders by UTM source.
   * Returns a breakdown: source → order count + total revenue.
   */
  getShopifyRevenueBySource: protectedProcedure
    .input(z.object({
      daysBack: z.number().min(1).max(365).default(90),
    }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.daysBack * 24 * 60 * 60 * 1000).toISOString();
      const orders = await fetchShopifyOrders({ createdAtMin: since, status: "any" });

      // Only count paid orders
      const paid = orders.filter((o) => ["paid", "partially_paid"].includes(o.financialStatus));

      // Aggregate by UTM source
      const bySource: Record<string, { orders: number; revenueCents: number }> = {};
      for (const o of paid) {
        const src = o.utmSource ?? "(direct / unknown)";
        if (!bySource[src]) bySource[src] = { orders: 0, revenueCents: 0 };
        bySource[src].orders++;
        bySource[src].revenueCents += o.totalPriceCents;
      }

      return Object.entries(bySource)
        .map(([source, stats]) => ({
          source,
          orders: stats.orders,
          revenueCents: stats.revenueCents,
          revenueUsd: stats.revenueCents / 100,
        }))
        .sort((a, b) => b.revenueCents - a.revenueCents);
    }),

  /**
   * Shopify revenue attribution: aggregate orders by UTM campaign.
   * Returns a breakdown: campaign → order count + total revenue.
   */
  getShopifyRevenueByCampaign: protectedProcedure
    .input(z.object({
      daysBack: z.number().min(1).max(365).default(90),
    }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.daysBack * 24 * 60 * 60 * 1000).toISOString();
      const orders = await fetchShopifyOrders({ createdAtMin: since, status: "any" });

      const paid = orders.filter((o) => ["paid", "partially_paid"].includes(o.financialStatus));

      const byCampaign: Record<string, { orders: number; revenueCents: number; source: string }> = {};
      for (const o of paid) {
        const campaign = o.utmCampaign ?? "(no campaign)";
        if (!byCampaign[campaign]) byCampaign[campaign] = { orders: 0, revenueCents: 0, source: o.utmSource ?? "" };
        byCampaign[campaign].orders++;
        byCampaign[campaign].revenueCents += o.totalPriceCents;
      }

      return Object.entries(byCampaign)
        .map(([campaign, stats]) => ({
          campaign,
          source: stats.source,
          orders: stats.orders,
          revenueCents: stats.revenueCents,
          revenueUsd: stats.revenueCents / 100,
        }))
        .sort((a, b) => b.revenueCents - a.revenueCents);
    }),

  /**
   * Shopify revenue summary: total revenue, order count, AOV for the period.
   */
  getShopifyRevenueSummary: protectedProcedure
    .input(z.object({
      daysBack: z.number().min(1).max(365).default(90),
    }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.daysBack * 24 * 60 * 60 * 1000).toISOString();
      const orders = await fetchShopifyOrders({ createdAtMin: since, status: "any" });
      const paid = orders.filter((o) => ["paid", "partially_paid"].includes(o.financialStatus));
      const totalCents = paid.reduce((s, o) => s + o.totalPriceCents, 0);
      return {
        totalOrders: paid.length,
        totalRevenueCents: totalCents,
        totalRevenueUsd: totalCents / 100,
        aovCents: paid.length > 0 ? Math.round(totalCents / paid.length) : 0,
        aovUsd: paid.length > 0 ? totalCents / paid.length / 100 : 0,
        daysBack: input.daysBack,
      };
    }),
});
