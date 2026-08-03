/**
 * kajabiSalesRouter.ts
 *
 * Pulls live purchase data from Kajabi for the Interconnected funnel SKUs.
 *
 * ── KAJABI API QUIRKS (fully documented Aug 3 2026) ──────────────────────────
 * ALL offer/product filters on the Kajabi v1 API are broken:
 *   - /purchases?filter[offer_id]=X  → returns global 30 records, ignores filter
 *   - /purchases?offer_id=X          → same
 *   - /transactions?filter[offer_id]=X → same
 *   - /orders?offer_id=X             → same
 *   - page=N causes 500; page[number]=N works
 *   - per_page > 25 causes 500
 *
 * WORKING APPROACH:
 *   GET /transactions?filter[site_id]=SITE_ID&page[number]=N
 *   Returns all site transactions with proper pagination (166 pages total).
 *   We paginate until we hit data older than our date window, then match
 *   transaction amounts to known offer price tiers.
 *
 * This correctly captures the $67 OTO and all other funnel tiers.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";

// ── Constants ─────────────────────────────────────────────────────────────────

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const KAJABI_TOKEN_URL = "https://api.kajabi.com/v1/oauth/token";
const SITE_ID = "2148432935"; // The Urban Monk Academy

// Map of amount_in_cents → tier definition
// These are the exact prices for each funnel offer. Since the API doesn't
// filter by offer, we identify offers by their unique price points.
const AMOUNT_TO_TIER: Record<number, { tier: string; label: string; priceCents: number }> = {
  // ── Interconnected Funnel ──────────────────────────────────────────────────
  6700:   { tier: "67",    label: "Interconnected $67 Bundle OTO",                              priceCents: 6700   },
  29900:  { tier: "299",   label: "Gut Permeability + Food Sensitivity Test w/ Coach ($299 Upsell)", priceCents: 29900  },
  39900:  { tier: "399",   label: "Gut Test + Health Coach Consultation $399",                  priceCents: 39900  },
  49900:  { tier: "499",   label: "Supported Package $499",                                     priceCents: 49900  },
  145000: { tier: "1450",  label: "Explore Tier $1,450",                                        priceCents: 145000 },
  165000: { tier: "1650",  label: "Explore Testing Tier DSS $1,650",                            priceCents: 165000 },
  // ── Upstream Course ────────────────────────────────────────────────────────
  10000:  { tier: "100",   label: "Upstream: Complete Microbiome $100",                         priceCents: 10000  },
  // ── Academy / Lights On ────────────────────────────────────────────────────
  29700:  { tier: "297",   label: "Academy Annual / Upstream Course $297",                      priceCents: 29700  },
  36900:  { tier: "369",   label: "Lights On Annual $369",                                      priceCents: 36900  },
  // ── High-Ticket Programs ───────────────────────────────────────────────────
  585000: { tier: "5850",  label: "Catalyst Coaching $5,850",                                   priceCents: 585000 },
  625000: { tier: "6250",  label: "International Client $6,250",                                priceCents: 625000 },
  // ── Legacy ─────────────────────────────────────────────────────────────────
  19700:  { tier: "197",   label: "Deep Sleep Solution $197",                                   priceCents: 19700  },
  19900:  { tier: "199",   label: "Enhanced Package $199",                                      priceCents: 19900  },
};

// ── Token cache ───────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Kajabi credentials not configured");

  const res = await fetch(KAJABI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json() as { access_token: string; expires_in: number; error?: string };
  if (!data.access_token) throw new Error(`Kajabi token error: ${data.error}`);
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.token;
}

// ── Data cache ────────────────────────────────────────────────────────────────

const CACHE_TTL = 10 * 60 * 1000; // 10 min
const dataCache: Record<string, { data: KajabiSalesMetrics; ts: number }> = {};

// ── Types ─────────────────────────────────────────────────────────────────────

interface TierSummary {
  tier: string;
  label: string;
  priceCents: number;
  count: number;
  revenueCents: number;
}

interface KajabiSalesMetrics {
  tiers: TierSummary[];
  totalRevenueCents: number;
  totalPurchases: number;
  fetchedAt: number;
  datePreset: string;
  offerIds: string[];
  apiMethod: string;
  pagesScanned: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getStartDate(datePreset: string): string {
  const now = new Date();
  switch (datePreset) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
    case "yesterday": {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
    }
    case "last_7d":    { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; }
    case "last_14d":   { const d = new Date(now); d.setDate(d.getDate() - 14); return d.toISOString().split("T")[0]; }
    case "this_month": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    default:           { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; }
  }
}

// ── Main fetch logic ──────────────────────────────────────────────────────────

async function fetchKajabiSalesCustomRange(startDate: string, endDate: string): Promise<KajabiSalesMetrics & { startDate: string; endDate: string; individualSales: Array<{ time: string; amountCents: number; label: string; offerId: string }> }> {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const tierMap: Record<string, TierSummary> = {};
  const individualSales: Array<{ time: string; amountCents: number; label: string; offerId: string }> = [];
  let pagesScanned = 0;
  let hitOldData = false;

  for (let page = 1; page <= 60 && !hitOldData; page++) {
    const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&page[number]=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;

    const data = await res.json() as {
      data?: Array<{
        id: string;
        attributes: { amount_in_cents: number; state: string; action: string; created_at: string };
        relationships?: { offer?: { data?: { id: string } } };
      }>;
      links?: { next?: string };
    };

    pagesScanned = page;
    const rows = data.data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const createdAt = row.attributes?.created_at || "";
      const dateStr = createdAt.substring(0, 10);

      // Stop when we go past the start date
      if (dateStr < startDate) { hitOldData = true; break; }
      // Skip if after end date
      if (dateStr > endDate) continue;

      const state = row.attributes?.state || "";
      const action = row.attributes?.action || "";
      const amount = row.attributes?.amount_in_cents || 0;
      if (amount <= 0 || state === "failed" || state === "refunded" || action === "refund") continue;

      const tierDef = AMOUNT_TO_TIER[amount];
      if (!tierDef) continue;

      const key = tierDef.tier;
      if (!tierMap[key]) {
        tierMap[key] = { tier: key, label: tierDef.label, priceCents: tierDef.priceCents, count: 0, revenueCents: 0 };
      }
      tierMap[key].count++;
      tierMap[key].revenueCents += amount;

      individualSales.push({
        time: createdAt,
        amountCents: amount,
        label: tierDef.label,
        offerId: row.relationships?.offer?.data?.id || "",
      });
    }

    if (!data.links?.next) break;
  }

  const tiers = Object.values(tierMap).sort((a, b) => a.priceCents - b.priceCents);
  const totalRevenueCents = tiers.reduce((s, t) => s + t.revenueCents, 0);
  const totalPurchases = tiers.reduce((s, t) => s + t.count, 0);

  return {
    tiers, totalRevenueCents, totalPurchases,
    fetchedAt: Date.now(),
    datePreset: `custom:${startDate}:${endDate}`,
    offerIds: Object.keys(AMOUNT_TO_TIER),
    apiMethod: "transactions_by_site_amount_match",
    pagesScanned,
    startDate,
    endDate,
    individualSales: individualSales.sort((a, b) => a.time.localeCompare(b.time)),
  };
}

async function fetchKajabiSales(datePreset: string): Promise<KajabiSalesMetrics> {
  const cacheKey = datePreset;
  const cached = dataCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const token = await getToken();
  const since = getStartDate(datePreset);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // Paginate through all site transactions until we hit data older than `since`
  // Max 20 pages (600 records) to stay within rate limits — covers 30+ days of activity
  const tierMap: Record<string, TierSummary> = {};
  let pagesScanned = 0;
  let hitOldData = false;

  for (let page = 1; page <= 20 && !hitOldData; page++) {
    const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&page[number]=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;

    const data = await res.json() as {
      data?: Array<{
        id: string;
        attributes: {
          amount_in_cents: number;
          state: string;
          action: string;
          created_at: string;
        };
      }>;
      links?: { next?: string };
    };

    pagesScanned = page;
    const rows = data.data || [];

    for (const row of rows) {
      const createdAt = row.attributes?.created_at || "";
      // Normalize: Kajabi returns "2026-08-02T20:26:32.995-05:00" — extract date portion
      const dateStr = createdAt.substring(0, 10);
      if (dateStr < since) {
        hitOldData = true;
        break;
      }

      const state = row.attributes?.state || "";
      const action = row.attributes?.action || "";
      const amount = row.attributes?.amount_in_cents || 0;

      // Skip failed, refunded, or zero-amount transactions
      if (amount <= 0 || state === "failed" || state === "refunded" || action === "refund") continue;

      // Match to a known tier by amount
      const tierDef = AMOUNT_TO_TIER[amount];
      if (!tierDef) continue; // skip unrecognized amounts (subscriptions, trials, etc.)

      const key = tierDef.tier;
      if (!tierMap[key]) {
        tierMap[key] = { tier: key, label: tierDef.label, priceCents: tierDef.priceCents, count: 0, revenueCents: 0 };
      }
      tierMap[key].count++;
      tierMap[key].revenueCents += amount;
    }

    if (!data.links?.next) break;
  }

  const tiers = Object.values(tierMap).sort((a, b) => a.priceCents - b.priceCents);
  const totalRevenueCents = tiers.reduce((s, t) => s + t.revenueCents, 0);
  const totalPurchases = tiers.reduce((s, t) => s + t.count, 0);

  const result: KajabiSalesMetrics = {
    tiers,
    totalRevenueCents,
    totalPurchases,
    fetchedAt: Date.now(),
    datePreset,
    offerIds: Object.keys(AMOUNT_TO_TIER),
    apiMethod: "transactions_by_site_amount_match",
    pagesScanned,
  };

  dataCache[cacheKey] = { data: result, ts: Date.now() };
  return result;
}

// ── Router ────────────────────────────────────────────────────────────────────

// ── Meta Ads Spend Fetcher ────────────────────────────────────────────────────
async function fetchMetaSpendForRange(startDate: string, endDate: string) {
  const accessToken = process.env.META_AD_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !adAccountId) {
    return { spend: 0, leads: 0, checkouts: 0, campaigns: [] as any[], error: "Meta credentials not configured" };
  }

  const fields = [
    "campaign_name", "adset_name",
    "spend", "impressions", "clicks",
    "actions", "cost_per_action_type",
  ].join(",");

  const timeRange = JSON.stringify({ since: startDate, until: endDate });
  // Use adset level so we can filter by adset name containing "Agora"
  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&level=adset&limit=500&access_token=${accessToken}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[MetaSpend] API error:", errText);
    return { spend: 0, leads: 0, checkouts: 0, campaigns: [] as any[], error: `Meta API error: ${resp.status}` };
  }

  const json = await resp.json() as any;
  const allData: any[] = json.data || [];

  // Filter to only Agora funnel ad sets — exclude unrelated campaigns
  const FUNNEL_SLUG = "agora";
  const data = allData.filter((row: any) => {
    const adsetName: string = (row.adset_name || "").toLowerCase();
    const campaignName: string = (row.campaign_name || "").toLowerCase();
    return adsetName.includes(FUNNEL_SLUG) || campaignName.includes(FUNNEL_SLUG);
  });

  let totalSpend = 0;
  let totalLeads = 0;
  let totalCheckouts = 0;
  const campaigns: any[] = [];

  for (const row of data) {
    const spend = parseFloat(row.spend || "0");
    const actions: any[] = row.actions || [];

    // Lead actions: lead, complete_registration, onsite_conversion.lead_grouped
    const leads =
      parseInt(actions.find((a: any) => a.action_type === "lead")?.value || "0") +
      parseInt(actions.find((a: any) => a.action_type === "onsite_conversion.lead_grouped")?.value || "0") +
      parseInt(actions.find((a: any) => a.action_type === "complete_registration")?.value || "0");

    // Checkout / add to cart actions
    const checkouts =
      parseInt(actions.find((a: any) => a.action_type === "initiate_checkout")?.value || "0") +
      parseInt(actions.find((a: any) => a.action_type === "add_to_cart")?.value || "0");

    totalSpend += spend;
    totalLeads += leads;
    totalCheckouts += checkouts;

    campaigns.push({
      name: row.campaign_name,
      spend: spend,
      leads: leads,
      checkouts: checkouts,
      cpl: leads > 0 ? spend / leads : null,
    });
  }

  return {
    spend: Math.round(totalSpend * 100) / 100,
    leads: totalLeads,
    checkouts: totalCheckouts,
    campaigns,
    error: null,
  };
}

export const kajabiSalesRouter = router({
  getMetaSpend: protectedProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      return fetchMetaSpendForRange(input.startDate, input.endDate);
    }),

  getCustomRangeSales: protectedProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      return fetchKajabiSalesCustomRange(input.startDate, input.endDate);
    }),

  getFunnelSales: protectedProcedure
    .input(z.object({
      datePreset: z
        .enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month"])
        .default("last_7d"),
    }))
    .query(async ({ input }) => {
      return fetchKajabiSales(input.datePreset);
    }),

  // Returns only purchases from the Interconnected funnel (webhook-confirmed, non-email-list)
  // This is the source of truth for the Command Center dashboard tier breakdown.
  getFunnelPurchases: protectedProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { kajabiPurchases } = await import("../drizzle/schema");
      const { and, eq, gte, lte } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { tiers: [], totalRevenueCents: 0, totalPurchases: 0 };

      // Convert date strings to epoch ms boundaries (UTC)
      const startMs = new Date(input.startDate + "T00:00:00.000Z").getTime();
      const endMs   = new Date(input.endDate   + "T23:59:59.999Z").getTime();

      const rows = await db
        .select()
        .from(kajabiPurchases)
        .where(
          and(
            eq(kajabiPurchases.funnelSource, "interconnected"),
            eq(kajabiPurchases.isEmailListBuyer, 0),
            gte(kajabiPurchases.createdAt, startMs),
            lte(kajabiPurchases.createdAt, endMs)
          )
        );

      // Build tier summary from local DB rows
      const tierMap: Record<string, { tier: string; label: string; priceCents: number; count: number; revenueCents: number }> = {};
      for (const row of rows) {
        const tierDef = AMOUNT_TO_TIER[row.amountCents];
        const key = tierDef?.tier ?? String(Math.round(row.amountCents / 100));
        const label = tierDef?.label ?? row.offerName ?? `$${Math.round(row.amountCents / 100)} Purchase`;
        if (!tierMap[key]) {
          tierMap[key] = { tier: key, label, priceCents: row.amountCents, count: 0, revenueCents: 0 };
        }
        tierMap[key].count++;
        tierMap[key].revenueCents += row.amountCents;
      }

      const tiers = Object.values(tierMap).sort((a, b) => a.priceCents - b.priceCents);
      const totalRevenueCents = tiers.reduce((s, t) => s + t.revenueCents, 0);
      const totalPurchases = tiers.reduce((s, t) => s + t.count, 0);
      return { tiers, totalRevenueCents, totalPurchases };
    }),
});
