/**
 * funnelReconciliationRouter.ts
 *
 * Per-funnel reconciliation: pulls Meta ad spend and Kajabi sales
 * scoped ONLY to the selected funnel's SKUs and ad campaign keywords.
 *
 * Funnels:
 *   interconnected_agora  – Interconnected Free Screening (Agora)   [active]
 *   gateway_health        – Gateway to Health Free Screening         [placeholder]
 *   lights_on             – Lights On                                [placeholder]
 *   reboot_7day           – 7 Day Reboot                             [placeholder]
 *   upstream_webinar      – Upstream Webinar                         [placeholder]
 *   dss_webinar           – DSS Webinar                              [placeholder]
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";

// ── Funnel registry ───────────────────────────────────────────────────────────

interface FunnelDef {
  id: string;
  label: string;
  /** Strings that must appear (case-insensitive) in Meta campaign OR adset name */
  metaKeywords: string[];
  /** Kajabi price points (amount_in_cents) that belong to this funnel */
  kajabSkus: Record<number, { tier: string; label: string }>;
  /** Whether this funnel is fully wired up or a placeholder */
  active: boolean;
}

export const FUNNELS: FunnelDef[] = [
  {
    id: "interconnected_agora",
    label: "Interconnected Free Screening (Agora)",
    metaKeywords: ["agora"],
    kajabSkus: {
      6700:   { tier: "67",   label: "Interconnected $67 Bundle OTO" },
      29900:  { tier: "299",  label: "Gut Permeability + Food Sensitivity Test ($299)" },
      39900:  { tier: "399",  label: "Gut Test + Health Coach Consultation ($399)" },
      49900:  { tier: "499",  label: "Supported Package ($499)" },
      145000: { tier: "1450", label: "Explore Tier ($1,450)" },
      165000: { tier: "1650", label: "Explore Testing Tier DSS ($1,650)" },
    },
    active: true,
  },
  {
    id: "gateway_health",
    label: "Gateway to Health Free Screening",
    metaKeywords: ["gateway"],
    kajabSkus: {},
    active: false,
  },
  {
    id: "lights_on",
    label: "Lights On",
    metaKeywords: ["lights on", "lights_on"],
    kajabSkus: {
      36900: { tier: "369", label: "Lights On Annual ($369)" },
    },
    active: false,
  },
  {
    id: "reboot_7day",
    label: "7 Day Reboot",
    metaKeywords: ["reboot", "7 day"],
    kajabSkus: {},
    active: false,
  },
  {
    id: "upstream_webinar",
    label: "Upstream Webinar",
    metaKeywords: ["upstream"],
    kajabSkus: {
      10000: { tier: "100", label: "Upstream: Complete Microbiome ($100)" },
      29700: { tier: "297", label: "Academy Annual / Upstream Course ($297)" },
    },
    active: false,
  },
  {
    id: "dss_webinar",
    label: "DSS Webinar",
    metaKeywords: ["dss", "deep sleep"],
    kajabSkus: {
      19700: { tier: "197", label: "Deep Sleep Solution ($197)" },
    },
    active: false,
  },
];

// ── Kajabi auth ───────────────────────────────────────────────────────────────

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const SITE_ID = "2148432935";
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getKajabiToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) return _tokenCache.token;
  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Kajabi credentials not configured");
  const res = await fetch("https://api.kajabi.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json() as { access_token: string; expires_in: number; error?: string };
  if (!data.access_token) throw new Error(`Kajabi token error: ${data.error}`);
  _tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return _tokenCache.token;
}

// ── Kajabi sales fetch (scoped to funnel SKUs) ────────────────────────────────

interface TierSummary {
  tier: string;
  label: string;
  priceCents: number;
  count: number;
  revenueCents: number;
}

interface IndividualSale {
  time: string;
  amountCents: number;
  label: string;
}

async function fetchKajabiForFunnel(
  funnel: FunnelDef,
  startDate: string,
  endDate: string
): Promise<{
  tiers: TierSummary[];
  totalRevenueCents: number;
  totalPurchases: number;
  individualSales: IndividualSale[];
  pagesScanned: number;
  note?: string;
}> {
  if (!funnel.active || Object.keys(funnel.kajabSkus).length === 0) {
    return { tiers: [], totalRevenueCents: 0, totalPurchases: 0, individualSales: [], pagesScanned: 0, note: "placeholder" };
  }

  const token = await getKajabiToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const tierMap: Record<string, TierSummary> = {};
  const individualSales: IndividualSale[] = [];
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
      }>;
      links?: { next?: string };
    };

    pagesScanned = page;
    const rows = data.data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const createdAt = row.attributes?.created_at || "";
      const dateStr = createdAt.substring(0, 10);
      if (dateStr < startDate) { hitOldData = true; break; }
      if (dateStr > endDate) continue;

      const state = row.attributes?.state || "";
      const action = row.attributes?.action || "";
      const amount = row.attributes?.amount_in_cents || 0;
      if (amount <= 0 || state === "failed" || state === "refunded" || action === "refund") continue;

      const skuDef = funnel.kajabSkus[amount];
      if (!skuDef) continue;

      const key = skuDef.tier;
      if (!tierMap[key]) {
        tierMap[key] = { tier: key, label: skuDef.label, priceCents: amount, count: 0, revenueCents: 0 };
      }
      tierMap[key].count++;
      tierMap[key].revenueCents += amount;
      individualSales.push({ time: createdAt, amountCents: amount, label: skuDef.label });
    }

    if (!data.links?.next) break;
  }

  const tiers = Object.values(tierMap).sort((a, b) => a.priceCents - b.priceCents);
  return {
    tiers,
    totalRevenueCents: tiers.reduce((s, t) => s + t.revenueCents, 0),
    totalPurchases: tiers.reduce((s, t) => s + t.count, 0),
    individualSales: individualSales.sort((a, b) => b.time.localeCompare(a.time)),
    pagesScanned,
  };
}

// ── Meta spend fetch (scoped to funnel keywords) ──────────────────────────────

async function fetchMetaForFunnel(
  funnel: FunnelDef,
  startDate: string,
  endDate: string
): Promise<{
  spend: number;
  leads: number;
  checkouts: number;
  campaigns: Array<{ name: string; spend: number; leads: number; cpl: number | null }>;
  error: string | null;
  note?: string;
}> {
  if (!funnel.active) {
    return { spend: 0, leads: 0, checkouts: 0, campaigns: [], error: null, note: "placeholder" };
  }

  const accessToken = process.env.META_AD_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !adAccountId) {
    return { spend: 0, leads: 0, checkouts: 0, campaigns: [], error: "Meta credentials not configured" };
  }

  const fields = ["campaign_name", "adset_name", "spend", "actions"].join(",");
  const timeRange = JSON.stringify({ since: startDate, until: endDate });
  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&level=adset&limit=500&access_token=${accessToken}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const errText = await resp.text();
    return { spend: 0, leads: 0, checkouts: 0, campaigns: [], error: `Meta API error: ${resp.status} ${errText.slice(0, 200)}` };
  }

  const json = await resp.json() as { data?: any[]; error?: { message: string } };
  if (json.error) {
    return { spend: 0, leads: 0, checkouts: 0, campaigns: [], error: json.error.message };
  }

  const allRows: any[] = json.data || [];

  const filtered = allRows.filter((row: any) => {
    const adsetName: string = (row.adset_name || "").toLowerCase();
    const campaignName: string = (row.campaign_name || "").toLowerCase();
    return funnel.metaKeywords.some(kw => adsetName.includes(kw) || campaignName.includes(kw));
  });

  let totalSpend = 0;
  let totalLeads = 0;
  let totalCheckouts = 0;
  const campaignMap: Record<string, { spend: number; leads: number }> = {};

  for (const row of filtered) {
    const spend = parseFloat(row.spend || "0");
    const actions: any[] = row.actions || [];
    const leads =
      parseInt(actions.find((a: any) => a.action_type === "lead")?.value || "0") +
      parseInt(actions.find((a: any) => a.action_type === "onsite_conversion.lead_grouped")?.value || "0") +
      parseInt(actions.find((a: any) => a.action_type === "complete_registration")?.value || "0");
    const checkouts =
      parseInt(actions.find((a: any) => a.action_type === "initiate_checkout")?.value || "0") +
      parseInt(actions.find((a: any) => a.action_type === "add_to_cart")?.value || "0");

    totalSpend += spend;
    totalLeads += leads;
    totalCheckouts += checkouts;

    const name = row.campaign_name || "Unknown";
    if (!campaignMap[name]) campaignMap[name] = { spend: 0, leads: 0 };
    campaignMap[name].spend += spend;
    campaignMap[name].leads += leads;
  }

  const campaigns = Object.entries(campaignMap)
    .map(([name, v]) => ({
      name,
      spend: Math.round(v.spend * 100) / 100,
      leads: v.leads,
      cpl: v.leads > 0 ? Math.round((v.spend / v.leads) * 100) / 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    spend: Math.round(totalSpend * 100) / 100,
    leads: totalLeads,
    checkouts: totalCheckouts,
    campaigns,
    error: null,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const funnelReconciliationRouter = router({
  listFunnels: protectedProcedure.query(() => {
    return FUNNELS.map(f => ({ id: f.id, label: f.label, active: f.active }));
  }),

  getReconciliation: protectedProcedure
    .input(z.object({
      funnelId:  z.string(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const funnel = FUNNELS.find(f => f.id === input.funnelId);
      if (!funnel) throw new Error(`Unknown funnel: ${input.funnelId}`);

      const [kajabi, meta] = await Promise.all([
        fetchKajabiForFunnel(funnel, input.startDate, input.endDate),
        fetchMetaForFunnel(funnel, input.startDate, input.endDate),
      ]);

      const totalRevenue = kajabi.totalRevenueCents / 100;
      const roas = meta.spend > 0 ? Math.round((totalRevenue / meta.spend) * 100) / 100 : null;
      const cpl  = meta.spend > 0 && meta.leads > 0 ? Math.round((meta.spend / meta.leads) * 100) / 100 : null;
      const convRate = meta.leads > 0 && kajabi.totalPurchases > 0
        ? Math.round((kajabi.totalPurchases / meta.leads) * 10000) / 100
        : null;

      return {
        funnel: { id: funnel.id, label: funnel.label, active: funnel.active },
        dateRange: { startDate: input.startDate, endDate: input.endDate },
        meta: {
          spend: meta.spend,
          leads: meta.leads,
          checkouts: meta.checkouts,
          campaigns: meta.campaigns,
          error: meta.error,
          note: (meta as any).note as string | undefined,
        },
        kajabi: {
          tiers: kajabi.tiers,
          totalRevenueCents: kajabi.totalRevenueCents,
          totalPurchases: kajabi.totalPurchases,
          individualSales: kajabi.individualSales,
          pagesScanned: kajabi.pagesScanned,
          note: kajabi.note as string | undefined,
        },
        summary: { totalRevenue, roas, cpl, convRate },
      };
    }),
});
