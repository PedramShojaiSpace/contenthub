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
  6700:   { tier: "67",    label: "Interconnected $67 Bundle OTO",    priceCents: 6700   },
  10000:  { tier: "100",   label: "Upstream: Complete Microbiome",     priceCents: 10000  },
  29900:  { tier: "299",   label: "Mid-Tier Program $299",             priceCents: 29900  },
  29700:  { tier: "297",   label: "Academy Annual $297",               priceCents: 29700  },
  36900:  { tier: "369",   label: "Lights On Annual $369",             priceCents: 36900  },
  39900:  { tier: "399",   label: "Testing Package $399",              priceCents: 39900  },
  49900:  { tier: "499",   label: "Supported Package $499",            priceCents: 49900  },
  165000: { tier: "1650",  label: "Explore Testing Tier DSS $1650",    priceCents: 165000 },
  585000: { tier: "5850",  label: "Catalyst Coaching $5850",           priceCents: 585000 },
  625000: { tier: "6250",  label: "International Client $6250",        priceCents: 625000 },
  // Legacy
  19700:  { tier: "197",   label: "Deep Sleep Solution $197",          priceCents: 19700  },
  19900:  { tier: "199",   label: "Enhanced Package $199",             priceCents: 19900  },
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

export const kajabiSalesRouter = router({
  getFunnelSales: protectedProcedure
    .input(z.object({
      datePreset: z
        .enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month"])
        .default("last_7d"),
    }))
    .query(async ({ input }) => {
      return fetchKajabiSales(input.datePreset);
    }),
});
