/**
 * kajabiSalesRouter.ts
 *
 * Pulls live purchase data from Kajabi for the Interconnected funnel SKUs:
 *   - $67  → Interconnected: The Complete Healing Protocol (OTO) — ID: 2151314475
 *   - $299 → UPSTREAM: The Complete Microbiome Solution — ID: 2151019899
 *   - $399 → Gut Permeability and Food Sensitivity Testing w/ Coach Consultation — IDs: 2150211911, 2151178828
 *   - $499 → Upstream: The Complete Microbiome Solution (Bundle w/ Testing) — ID: 2151031660
 *   - $369 → Lights On Course (Annual subscription) — ID: 2151004748
 *
 * Results are cached in-memory for 10 minutes.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";

// ── Constants ─────────────────────────────────────────────────────────────────

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const KAJABI_TOKEN_URL = "https://api.kajabi.com/v1/oauth/token";
const SITE_ID = "2148432935"; // The Urban Monk Academy

// Funnel offer IDs mapped to their price tier
const FUNNEL_OFFERS: Record<string, { label: string; priceCents: number; tier: string }> = {
  "2151314475": { label: "Interconnected $67 OTO",          priceCents: 6700,  tier: "67"  },
  "2151019899": { label: "Upstream $299",                   priceCents: 29900, tier: "299" },
  "2150211911": { label: "Gut Test + Consult $399 (v1)",    priceCents: 39900, tier: "399" },
  "2151178828": { label: "Gut Test + Consult $399 (v2)",    priceCents: 39900, tier: "399" },
  "2151031660": { label: "Upstream Bundle $499",            priceCents: 49900, tier: "499" },
  "2151004748": { label: "Lights On Annual $369",           priceCents: 36900, tier: "369" },
  "2150989697": { label: "Lights On Annual $297 (legacy)",  priceCents: 29700, tier: "297" },
  "2150847661": { label: "Lights On Annual $297 (v2)",      priceCents: 29700, tier: "297" },
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
  // Derived conversion rates (requires Meta lead count to compute)
  offerIds: string[];
}

// ── Fetch logic ───────────────────────────────────────────────────────────────

function getDateRange(datePreset: string): string {
  const now = new Date();
  switch (datePreset) {
    case "today":      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
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

async function fetchKajabiSales(datePreset: string): Promise<KajabiSalesMetrics> {
  const cacheKey = datePreset;
  const cached = dataCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const token = await getToken();
  const since = getDateRange(datePreset);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" };

  // Fetch all pages of purchases for this site
  const allPurchases: Array<{ offerId: string; amountCents: number }> = [];
  let page = 1;
  while (true) {
    const url = `${KAJABI_API_BASE}/purchases?filter[site_id]=${SITE_ID}&filter[created_at_gteq]=${since}&page[size]=100&page[number]=${page}`;
    const res = await fetch(url, { headers });
    const data = await res.json() as {
      data?: Array<{ relationships: { offer: { data: { id: string } } }; attributes: { amount_in_cents: number } }>;
      links?: { next?: string };
      errors?: unknown;
    };
    if (data.errors) throw new Error(`Kajabi purchases error: ${JSON.stringify(data.errors)}`);
    const rows = data.data || [];
    for (const row of rows) {
      allPurchases.push({
        offerId: row.relationships?.offer?.data?.id || "",
        amountCents: row.attributes?.amount_in_cents || 0,
      });
    }
    if (!data.links?.next || rows.length < 100) break;
    page++;
  }

  // Aggregate by tier
  const tierMap: Record<string, TierSummary> = {};
  for (const p of allPurchases) {
    const offerDef = FUNNEL_OFFERS[p.offerId];
    if (!offerDef) continue; // skip non-funnel offers
    const key = offerDef.tier;
    if (!tierMap[key]) {
      tierMap[key] = { tier: key, label: offerDef.label, priceCents: offerDef.priceCents, count: 0, revenueCents: 0 };
    }
    tierMap[key].count++;
    tierMap[key].revenueCents += p.amountCents;
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
    offerIds: Object.keys(FUNNEL_OFFERS),
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
