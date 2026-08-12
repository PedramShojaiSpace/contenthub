/**
 * funnelReconciliationRouter.ts
 *
 * Per-funnel reconciliation: Meta ad spend + Kajabi sales + Shopify orders,
 * each scoped ONLY to the selected funnel's registered products/SKUs.
 *
 * Funnels:
 *   interconnected_agora  – Interconnected Free Screening (Agora)   [Kajabi active, Shopify disabled per owner]
 *   gateway_health        – Gateway to Health Free Screening         [Shopify placeholder — no paid products yet]
 *   lights_on             – Lights On                                [placeholder]
 *   reboot_7day           – 7 Day Reboot                             [placeholder]
 *   upstream_webinar      – Upstream Webinar / Gut Check             [Shopify active]
 *   dss_webinar           – DSS Webinar / Deep Sleep Solution        [Shopify active]
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { kajabiPurchases, interconnectedLeads, leadPurchaseAttributions } from "../drizzle/schema";
import { and, gte, lte, eq, inArray, sql } from "drizzle-orm";
import {
  classifyInterconnectedCohortPath,
  dayOffsetFromLead,
  isWithinFourteenDayWindow,
  toUtcDateKey,
  type InterconnectedCohortPath,
} from "./interconnectedCohorts";

// ── Funnel registry ───────────────────────────────────────────────────────────

interface ShopifyProductDef {
  productId: string;   // Shopify numeric product ID (without GID prefix)
  label: string;
}

interface FunnelDef {
  id: string;
  label: string;
  /** Strings that must appear (case-insensitive) in Meta campaign OR adset name */
  metaKeywords: string[];
  /** Kajabi price points (amount_in_cents) that belong to this funnel */
  kajabSkus: Record<number, { tier: string; label: string }>;
  /** Shopify product IDs that belong to this funnel */
  shopifyProducts: ShopifyProductDef[];
  /** Whether Kajabi data is live */
  kajabiActive: boolean;
  /** Whether Shopify data is live (owner controls this per funnel) */
  shopifyActive: boolean;
  /** Whether Meta spend is live */
  metaActive: boolean;
}

export const FUNNELS: FunnelDef[] = [
  {
    id: "interconnected_agora",
    label: "Interconnected Free Screening (Agora)",
    metaKeywords: ["agora"],
    kajabSkus: {
      6700:   { tier: "67",   label: "Interconnected $67 Bundle OTO" },
      19900:  { tier: "199",  label: "Gut Permeability + Food Sensitivity Test ($199 OCU)" },
      29900:  { tier: "299",  label: "Gut Permeability + Food Sensitivity Test ($299)" },
      39900:  { tier: "399",  label: "Gut Test + Health Coach Consultation ($399)" },
      49900:  { tier: "499",  label: "Supported Package ($499)" },
      145000: { tier: "1450", label: "Explore Tier ($1,450)" },
      165000: { tier: "1650", label: "Explore Testing Tier DSS ($1,650)" },
    },
    // Shopify products exist but funnel is NOT currently being pushed through Shopify
    shopifyProducts: [
      { productId: "7825447518362", label: "Interconnected Supported Package ($499)" },
      { productId: "7827463405722", label: "Interconnected Series Silver Pre-Purchase ($67)" },
      { productId: "7839840272538", label: "Interconnected Platinum Upgrade Pre-Purchase ($89)" },
      { productId: "8615260356762", label: "Package Upgrade Interconnected ($100)" },
      { productId: "7826664718490", label: "Interconnected Series Platinum ($199)" },
    ],
    kajabiActive: true,
    shopifyActive: false,  // Owner: not being pushed through Shopify currently
    metaActive: true,
  },
  {
    id: "gateway_health",
    label: "Gateway to Health Free Screening",
    metaKeywords: ["gateway"],
    kajabSkus: {},
    shopifyProducts: [
      { productId: "7842784444570", label: "Gateway To Health" },
      { productId: "7894858727578", label: "Copy of Gateway To Health Platinum" },
    ],
    kajabiActive: false,
    shopifyActive: false,  // Products have $0 price — not yet selling
    metaActive: false,
  },
  {
    id: "lights_on",
    label: "Lights On",
    metaKeywords: ["lights on", "lights_on"],
    kajabSkus: {
      36900: { tier: "369", label: "Lights On Annual ($369)" },
    },
    shopifyProducts: [],
    kajabiActive: false,
    shopifyActive: false,
    metaActive: false,
  },
  {
    id: "reboot_7day",
    label: "7 Day Reboot",
    metaKeywords: ["reboot", "7 day"],
    kajabSkus: {},
    shopifyProducts: [],
    kajabiActive: false,
    shopifyActive: false,
    metaActive: false,
  },
  {
    id: "upstream_webinar",
    label: "Upstream Webinar / Gut Check",
    metaKeywords: ["upstream", "gut check"],
    kajabSkus: {
      10000: { tier: "100", label: "Upstream: Complete Microbiome ($100)" },
      29700: { tier: "297", label: "Academy Annual / Upstream Course ($297)" },
    },
    shopifyProducts: [
      { productId: "7724413223066", label: "Gut Check Series - Platinum Package ($199)" },
      { productId: "7825447321754", label: "Gut Check Series - Gold Package ($199)" },
      { productId: "7845884756122", label: "Gut Check Series" },
      { productId: "7900289597594", label: "Copy of Gut Check Series Gold/Platinum" },
      { productId: "8626195005594", label: "KBMO Fit 22/Gut Permeability Test Kit ($199)" },
      { productId: "8626252218522", label: "Full Gut Testing Upgrade ($249)" },
      { productId: "8626257035418", label: "Gut Retest Kit ($99)" },
    ],
    kajabiActive: false,
    shopifyActive: true,
    metaActive: false,
  },
  {
    id: "dss_webinar",
    label: "DSS Webinar / Deep Sleep Solution",
    metaKeywords: ["dss", "deep sleep"],
    kajabSkus: {
      19700: { tier: "197", label: "Deep Sleep Solution ($197)" },
    },
    shopifyProducts: [
      { productId: "7768797839514", label: "The Deep Sleep Solution Core Program ($299)" },
      { productId: "8645430870170", label: "Deep Sleep ($129)" },
    ],
    kajabiActive: false,
    shopifyActive: true,
    metaActive: false,
  },
  {
    id: "tantra_quiz",
    label: "Tantra Quiz — Sexual Vitality",
    metaKeywords: ["tantra"],
    kajabSkus: {},
    shopifyProducts: [
      { productId: "9068203376794", label: "Tantra Him ($185/mo)" },
      { productId: "9068203442330", label: "Tantra Her ($185/mo)" },
      { productId: "9068203540634", label: "Tantra Bundle — Him & Her ($369/mo)" },
    ],
    kajabiActive: false,
    shopifyActive: true,
    metaActive: true,
  },
];

// ── Kajabi auth ───────────────────────────────────────────────────────────────

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const SITE_ID = "2148432935";
let _kajabiTokenCache: { token: string; expiresAt: number } | null = null;

async function getKajabiToken(): Promise<string> {
  const now = Date.now();
  if (_kajabiTokenCache && _kajabiTokenCache.expiresAt > now + 60_000) return _kajabiTokenCache.token;
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
  _kajabiTokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return _kajabiTokenCache.token;
}

// ── Kajabi sales fetch ────────────────────────────────────────────────────────

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
  source: "kajabi" | "shopify";
  /** Attribution type for this sale */
  customerType: "meta_lead" | "returning" | "unknown";
  /** ISO date the lead opted into our funnel (if meta_lead) */
  leadOptInDate?: string;
}

/**
 * Build a lookup map from the kajabi_purchases DB table for the given date range.
 * Returns a map of email -> { isMetaAttributed, leadCreatedAt }
 */
async function buildKajabiPurchasesLookup(
  startDate: string,
  endDate: string
): Promise<Map<string, { isMetaAttributed: number; leadCreatedAt: number | null }>> {
  const map = new Map<string, { isMetaAttributed: number; leadCreatedAt: number | null }>();
  try {
    const db = await getDb();
    if (!db) return map;
    const startMs = new Date(startDate + "T00:00:00Z").getTime();
    const endMs   = new Date(endDate   + "T23:59:59Z").getTime();
    const rows = await db.select({
      email: kajabiPurchases.email,
      isMetaAttributed: kajabiPurchases.isMetaAttributed,
      purchasedAt: kajabiPurchases.purchasedAt,
    }).from(kajabiPurchases)
      .where(and(
        gte(kajabiPurchases.purchasedAt, startMs),
        lte(kajabiPurchases.purchasedAt, endMs)
      ));
    for (const row of rows) {
      if (!row.email) continue;
      // Also look up when this person opted in as a lead
      let leadCreatedAt: number | null = null;
      if (row.isMetaAttributed) {
        const leadRows = await db.select({ createdAt: interconnectedLeads.createdAt })
          .from(interconnectedLeads)
          .where(eq(interconnectedLeads.email, row.email.toLowerCase().trim()))
          .limit(1);
        leadCreatedAt = leadRows[0]?.createdAt ?? null;
      }
      map.set(row.email.toLowerCase().trim(), {
        isMetaAttributed: row.isMetaAttributed ?? 0,
        leadCreatedAt,
      });
    }
  } catch (e) {
    // Non-fatal — fall back to unknown attribution
    console.warn("[reconciliation] DB lookup failed:", (e as Error).message);
  }
  return map;
}

type CohortRevenueSummary = {
  path: InterconnectedCohortPath;
  label: string;
  uniqueLeads: number;
  maturedLeads: number;
  day0Purchases: number;
  day0RevenueCents: number;
  day1to14Purchases: number;
  day1to14RevenueCents: number;
  total14DayRevenueCents: number;
};

const COHORT_LABELS: Record<InterconnectedCohortPath, string> = {
  kajabi_page: "Kajabi Page Cohort",
  klaviyo_sms: "Klaviyo / SMS Cohort",
  meta_paid: "Meta-Paid Cohort",
  other: "Other / Untagged Cohort",
};

/**
 * Cohort economics are lead-acquisition based: leads are included by their
 * opt-in date, and only purchases from those leads within 14 days count toward
 * their cohort LTV. This deliberately differs from a purchase-date ROAS view.
 */
async function getInterconnectedCohortAnalytics(startDate: string, endDate: string) {
  const empty = {
    definition: "Lead-acquisition cohorts: revenue is counted only when the matching lead buys within 14 days of opt-in. Ledger reporting separately assigns original acquisition credit and the later email/SMS closing touch; those two views must never be added together.",
    totalUniqueLeads: 0,
    dailyLeads: [] as Array<{ date: string; uniqueLeads: number; kajabiPage: number; klaviyoSms: number; metaPaid: number; other: number }>,
    cohorts: [] as CohortRevenueSummary[],
    emailClickAttributionAvailable: false,
    attributionLedger: {
      purchaseCount: 0,
      creditedRevenueCents: 0,
      directClosingRevenueCents: 0,
      modeledClosingRevenueCents: 0,
      acquisitionCredits: [] as Array<{ path: string; purchases: number; revenueCents: number }>,
      closingTouches: [] as Array<{ label: string; confidence: string; purchases: number; revenueCents: number }>,
    },
  };
  const db = await getDb();
  if (!db) return empty;

  const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
  const endMs = new Date(`${endDate}T23:59:59Z`).getTime();
  const leadRows = await db.select({
    email: interconnectedLeads.email,
    createdAt: interconnectedLeads.createdAt,
    utmSource: interconnectedLeads.utmSource,
    utmMedium: interconnectedLeads.utmMedium,
    utmCampaign: interconnectedLeads.utmCampaign,
    fbclid: interconnectedLeads.fbclid,
  }).from(interconnectedLeads).where(and(
    gte(interconnectedLeads.createdAt, startMs),
    lte(interconnectedLeads.createdAt, endMs)
  ));

  const uniqueLeads = new Map<string, {
    email: string;
    createdAt: number;
    path: InterconnectedCohortPath;
  }>();
  for (const lead of leadRows) {
    const email = lead.email.toLowerCase().trim();
    const path = classifyInterconnectedCohortPath(lead);
    const existing = uniqueLeads.get(email);
    if (!existing || lead.createdAt < existing.createdAt) {
      uniqueLeads.set(email, { email, createdAt: lead.createdAt, path });
    }
  }

  const cohortMap = new Map<InterconnectedCohortPath, CohortRevenueSummary>();
  const dailyMap = new Map<string, { date: string; uniqueLeads: number; kajabiPage: number; klaviyoSms: number; metaPaid: number; other: number }>();
  for (const path of Object.keys(COHORT_LABELS) as InterconnectedCohortPath[]) {
    cohortMap.set(path, {
      path,
      label: COHORT_LABELS[path],
      uniqueLeads: 0,
      maturedLeads: 0,
      day0Purchases: 0,
      day0RevenueCents: 0,
      day1to14Purchases: 0,
      day1to14RevenueCents: 0,
      total14DayRevenueCents: 0,
    });
  }

  const now = Date.now();
  for (const lead of uniqueLeads.values()) {
    const cohort = cohortMap.get(lead.path)!;
    cohort.uniqueLeads++;
    if (lead.createdAt <= now - 14 * 86_400_000) cohort.maturedLeads++;
    const date = toUtcDateKey(lead.createdAt);
    const daily = dailyMap.get(date) ?? { date, uniqueLeads: 0, kajabiPage: 0, klaviyoSms: 0, metaPaid: 0, other: 0 };
    daily.uniqueLeads++;
    if (lead.path === "kajabi_page") daily.kajabiPage++;
    else if (lead.path === "klaviyo_sms") daily.klaviyoSms++;
    else if (lead.path === "meta_paid") daily.metaPaid++;
    else daily.other++;
    dailyMap.set(date, daily);
  }

  const emails = [...uniqueLeads.keys()];
  if (emails.length === 0) {
    return { ...empty, cohorts: [...cohortMap.values()], dailyLeads: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }

  // Query purchases across the maximum cohort observation window. Dedup by
  // email + value + minute because webhook retries should never inflate LTV.
  const purchaseRows = await db.select({
    email: kajabiPurchases.email,
    amountCents: kajabiPurchases.amountCents,
    purchasedAt: kajabiPurchases.purchasedAt,
  }).from(kajabiPurchases).where(and(
    inArray(kajabiPurchases.email, emails),
    gte(kajabiPurchases.purchasedAt, startMs),
    lte(kajabiPurchases.purchasedAt, endMs + 14 * 86_400_000)
  ));

  const processed = new Set<string>();
  for (const purchase of purchaseRows) {
    if (!purchase.email || !purchase.purchasedAt || !purchase.amountCents || purchase.amountCents <= 0) continue;
    const email = purchase.email.toLowerCase().trim();
    const lead = uniqueLeads.get(email);
    if (!lead) continue;
    const dedupeKey = `${email}:${purchase.amountCents}:${Math.round(purchase.purchasedAt / 60_000)}`;
    if (processed.has(dedupeKey)) continue;
    processed.add(dedupeKey);
    if (!isWithinFourteenDayWindow(lead.createdAt, purchase.purchasedAt)) continue;
    const cohort = cohortMap.get(lead.path)!;
    const dayOffset = dayOffsetFromLead(lead.createdAt, purchase.purchasedAt)!;
    cohort.total14DayRevenueCents += purchase.amountCents;
    if (dayOffset === 0) {
      cohort.day0Purchases++;
      cohort.day0RevenueCents += purchase.amountCents;
    } else {
      cohort.day1to14Purchases++;
      cohort.day1to14RevenueCents += purchase.amountCents;
    }
  }

  // Forward-looking ledger: every confirmed purchase is credited once to its
  // original opt-in cohort and reported separately by its checkout closing touch.
  // The two reporting views are alternate lenses on the same revenue—not additive.
  const ledgerRows = await db.select({
    amountCents: leadPurchaseAttributions.purchaseAmountCents,
    acquisitionPath: leadPurchaseAttributions.acquisitionPath,
    closingSource: leadPurchaseAttributions.closingSource,
    closingMedium: leadPurchaseAttributions.closingMedium,
    closingMethod: leadPurchaseAttributions.closingMethod,
    closingConfidence: leadPurchaseAttributions.closingConfidence,
  }).from(leadPurchaseAttributions).where(and(
    eq(leadPurchaseAttributions.funnelId, "interconnected_agora"),
    eq(leadPurchaseAttributions.isWithin14Days, true),
    gte(leadPurchaseAttributions.leadOptedInAt, startMs),
    lte(leadPurchaseAttributions.leadOptedInAt, endMs)
  ));

  const acquisitionCreditMap = new Map<string, { path: string; purchases: number; revenueCents: number }>();
  const closingTouchMap = new Map<string, { label: string; confidence: string; purchases: number; revenueCents: number }>();
  let directClosingRevenueCents = 0;
  let modeledClosingRevenueCents = 0;
  for (const row of ledgerRows) {
    const acquisitionPath = row.acquisitionPath || "other";
    const acquisition = acquisitionCreditMap.get(acquisitionPath) ?? { path: acquisitionPath, purchases: 0, revenueCents: 0 };
    acquisition.purchases++;
    acquisition.revenueCents += row.amountCents;
    acquisitionCreditMap.set(acquisitionPath, acquisition);

    const label = row.closingSource
      ? `${row.closingSource}${row.closingMedium ? ` / ${row.closingMedium}` : ""}${row.closingMethod === "direct_email_click" && row.closingSource ? " click" : ""}`
      : row.closingMethod === "unknown" ? "Unresolved checkout touch" : row.closingMethod.replace(/_/g, " ");
    const closing = closingTouchMap.get(label) ?? { label, confidence: row.closingConfidence, purchases: 0, revenueCents: 0 };
    closing.purchases++;
    closing.revenueCents += row.amountCents;
    closingTouchMap.set(label, closing);
    if (row.closingConfidence === "direct") directClosingRevenueCents += row.amountCents;
    if (row.closingConfidence === "modeled") modeledClosingRevenueCents += row.amountCents;
  }

  return {
    ...empty,
    totalUniqueLeads: uniqueLeads.size,
    cohorts: [...cohortMap.values()],
    dailyLeads: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    emailClickAttributionAvailable: ledgerRows.some((row) => row.closingConfidence === "direct"),
    attributionLedger: {
      purchaseCount: ledgerRows.length,
      creditedRevenueCents: ledgerRows.reduce((sum, row) => sum + row.amountCents, 0),
      directClosingRevenueCents,
      modeledClosingRevenueCents,
      acquisitionCredits: [...acquisitionCreditMap.values()].sort((a, b) => b.revenueCents - a.revenueCents),
      closingTouches: [...closingTouchMap.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    },
  };
}

async function fetchKajabiForFunnel(
  funnel: FunnelDef,
  startDate: string,
  endDate: string,
  dbLookup?: Map<string, { isMetaAttributed: number; leadCreatedAt: number | null }>
): Promise<{
  tiers: TierSummary[];
  totalRevenueCents: number;
  totalPurchases: number;
  individualSales: IndividualSale[];
  pagesScanned: number;
  note?: string;
}> {
  if (!funnel.kajabiActive || Object.keys(funnel.kajabSkus).length === 0) {
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
      // Determine customer type from DB lookup (if available)
      // The transaction API doesn't return email, so we match by time+amount from webhook DB
      // For now mark as "unknown" — the DB cross-reference happens at the procedure level
      individualSales.push({ time: createdAt, amountCents: amount, label: skuDef.label, source: "kajabi", customerType: "unknown" });
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

// ── Shopify order fetch ───────────────────────────────────────────────────────

interface ShopifyTierSummary {
  productId: string;
  label: string;
  count: number;
  revenueCents: number;
}

async function fetchShopifyForFunnel(
  funnel: FunnelDef,
  startDate: string,
  endDate: string
): Promise<{
  tiers: ShopifyTierSummary[];
  totalRevenueCents: number;
  totalOrders: number;
  individualSales: IndividualSale[];
  note?: string;
}> {
  if (!funnel.shopifyActive || funnel.shopifyProducts.length === 0) {
    return { tiers: [], totalRevenueCents: 0, totalOrders: 0, individualSales: [], note: "placeholder" };
  }

  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN;
  if (!storeDomain || !accessToken) {
    return { tiers: [], totalRevenueCents: 0, totalOrders: 0, individualSales: [], note: "credentials_missing" };
  }

  // Build a set of product IDs for fast lookup
  const productIdSet = new Set(funnel.shopifyProducts.map(p => p.productId));
  const productLabelMap: Record<string, string> = {};
  for (const p of funnel.shopifyProducts) productLabelMap[p.productId] = p.label;

  const tierMap: Record<string, ShopifyTierSummary> = {};
  const individualSales: IndividualSale[] = [];

  // Use Shopify Admin REST API — orders endpoint with date filter
  // We need Admin API token, not Storefront token
  const adminToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN;
  const baseUrl = `https://${storeDomain}/admin/api/2024-01/orders.json`;

  let pageUrl: string | null =
    `${baseUrl}?status=paid&created_at_min=${startDate}T00:00:00-06:00&created_at_max=${endDate}T23:59:59-06:00&limit=250&fields=id,created_at,line_items,financial_status,total_price`;

  let pagesScanned = 0;

  while (pageUrl && pagesScanned < 20) {
    const res = await fetch(pageUrl, {
      headers: {
        "X-Shopify-Access-Token": adminToken || "",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      // If Admin token doesn't work, fall back to GraphQL
      break;
    }

    pagesScanned++;
    const data = await res.json() as {
      orders?: Array<{
        id: number;
        created_at: string;
        financial_status: string;
        line_items: Array<{
          product_id: number;
          title: string;
          quantity: number;
          price: string;
        }>;
      }>;
    };

    const orders = data.orders || [];
    if (orders.length === 0) break;

    for (const order of orders) {
      if (order.financial_status !== "paid" && order.financial_status !== "partially_paid") continue;

      for (const item of order.line_items) {
        const pid = String(item.product_id);
        if (!productIdSet.has(pid)) continue;

        const label = productLabelMap[pid] || item.title;
        const priceCents = Math.round(parseFloat(item.price) * 100) * item.quantity;
        if (priceCents <= 0) continue;

        if (!tierMap[pid]) {
          tierMap[pid] = { productId: pid, label, count: 0, revenueCents: 0 };
        }
        tierMap[pid].count += item.quantity;
        tierMap[pid].revenueCents += priceCents;
        individualSales.push({ time: order.created_at, amountCents: priceCents, label, source: "shopify" });
      }
    }

    // Check for next page via Link header
    const linkHeader = res.headers.get("Link") || "";
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    pageUrl = nextMatch ? nextMatch[1] : null;
  }

  // If REST didn't work (no admin token), try GraphQL Admin API
  if (pagesScanned === 0) {
    const gqlResult = await fetchShopifyOrdersViaGraphQL(funnel, startDate, endDate, storeDomain, adminToken || "");
    return gqlResult;
  }

  const tiers = Object.values(tierMap).sort((a, b) => b.revenueCents - a.revenueCents);
  return {
    tiers,
    totalRevenueCents: tiers.reduce((s, t) => s + t.revenueCents, 0),
    totalOrders: tiers.reduce((s, t) => s + t.count, 0),
    individualSales: individualSales.sort((a, b) => b.time.localeCompare(a.time)),
  };
}

async function fetchShopifyOrdersViaGraphQL(
  funnel: FunnelDef,
  startDate: string,
  endDate: string,
  storeDomain: string,
  accessToken: string
): Promise<{
  tiers: ShopifyTierSummary[];
  totalRevenueCents: number;
  totalOrders: number;
  individualSales: IndividualSale[];
  note?: string;
}> {
  const productIdSet = new Set(funnel.shopifyProducts.map(p => p.productId));
  const productLabelMap: Record<string, string> = {};
  for (const p of funnel.shopifyProducts) productLabelMap[p.productId] = p.label;

  const tierMap: Record<string, ShopifyTierSummary> = {};
  const individualSales: IndividualSale[] = [];

  const query = `
    query GetOrders($cursor: String) {
      orders(
        first: 250,
        after: $cursor,
        query: "financial_status:paid created_at:>=${startDate} created_at:<=${endDate}"
      ) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            createdAt
            financialStatus
            lineItems(first: 20) {
              edges {
                node {
                  product { id }
                  title
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                }
              }
            }
          }
        }
      }
    }
  `;

  let cursor: string | null = null;
  let pages = 0;

  while (pages < 20) {
    const res = await fetch(`https://${storeDomain}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    });

    if (!res.ok) break;
    pages++;

    const json = await res.json() as {
      data?: {
        orders?: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          edges: Array<{
            node: {
              id: string;
              createdAt: string;
              financialStatus: string;
              lineItems: {
                edges: Array<{
                  node: {
                    product: { id: string } | null;
                    title: string;
                    quantity: number;
                    originalUnitPriceSet: { shopMoney: { amount: string } };
                  };
                }>;
              };
            };
          }>;
        };
      };
      errors?: any[];
    };

    if (json.errors || !json.data?.orders) break;

    for (const edge of json.data.orders.edges) {
      const order = edge.node;
      for (const liEdge of order.lineItems.edges) {
        const li = liEdge.node;
        if (!li.product) continue;
        // Extract numeric ID from GID
        const pid = li.product.id.replace("gid://shopify/Product/", "");
        if (!productIdSet.has(pid)) continue;

        const label = productLabelMap[pid] || li.title;
        const priceCents = Math.round(parseFloat(li.originalUnitPriceSet.shopMoney.amount) * 100) * li.quantity;
        if (priceCents <= 0) continue;

        if (!tierMap[pid]) {
          tierMap[pid] = { productId: pid, label, count: 0, revenueCents: 0 };
        }
        tierMap[pid].count += li.quantity;
        tierMap[pid].revenueCents += priceCents;
        individualSales.push({ time: order.createdAt, amountCents: priceCents, label, source: "shopify" });
      }
    }

    if (!json.data.orders.pageInfo.hasNextPage) break;
    cursor = json.data.orders.pageInfo.endCursor;
  }

  const tiers = Object.values(tierMap).sort((a, b) => b.revenueCents - a.revenueCents);
  return {
    tiers,
    totalRevenueCents: tiers.reduce((s, t) => s + t.revenueCents, 0),
    totalOrders: tiers.reduce((s, t) => s + t.count, 0),
    individualSales: individualSales.sort((a, b) => b.time.localeCompare(a.time)),
  };
}

// ── Meta spend fetch ──────────────────────────────────────────────────────────

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
  if (!funnel.metaActive) {
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
    return FUNNELS.map(f => ({
      id: f.id,
      label: f.label,
      kajabiActive: f.kajabiActive,
      shopifyActive: f.shopifyActive,
      metaActive: f.metaActive,
    }));
  }),

  getReconciliation: protectedProcedure
    .input(z.object({
      funnelId:        z.string(),
      startDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** When true, only count sales from buyers who opted in during the campaign window */
      newCustomersOnly: z.boolean().optional().default(false),
      /** Attribution filter: 'all' | 'meta_only' | 'non_meta' */
      attributionFilter: z.enum(["all", "meta_only", "non_meta"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const funnel = FUNNELS.find(f => f.id === input.funnelId);
      if (!funnel) throw new Error(`Unknown funnel: ${input.funnelId}`);

      // Build DB lookup for attribution cross-reference
      const dbLookup = await buildKajabiPurchasesLookup(input.startDate, input.endDate);

      const [kajabi, shopify, meta, cohortAnalytics] = await Promise.all([
        fetchKajabiForFunnel(funnel, input.startDate, input.endDate, dbLookup),
        fetchShopifyForFunnel(funnel, input.startDate, input.endDate),
        fetchMetaForFunnel(funnel, input.startDate, input.endDate),
        funnel.id === "interconnected_agora"
          ? getInterconnectedCohortAnalytics(input.startDate, input.endDate)
          : Promise.resolve(null),
      ]);

      // ── Cross-reference Kajabi sales with DB attribution data ──────────────
      // The DB lookup is keyed by email, but the transaction scan doesn't return emails.
      // We use the webhook DB records to enrich sales: if a sale's timestamp+amount
      // matches a DB record, we can flag it. For now, we use the DB count of
      // meta-attributed purchases in the window to produce a separate "meta-attributed" total.
      let metaAttributedCount = 0;
      let metaAttributedRevenueCents = 0;
      let returningCount = 0;
      let returningRevenueCents = 0;

      // Count from DB records (webhook-captured purchases)
      for (const [, v] of dbLookup) {
        // We don't have per-sale amounts in the lookup, so count records
        if (v.isMetaAttributed) metaAttributedCount++;
        else returningCount++;
      }

      // ── Apply attribution filter to individual sales ────────────────────────
      // Since transaction scan doesn't have emails, we use the DB record count
      // to annotate the summary. Individual sale rows are annotated as "unknown"
      // unless the webhook DB has a matching record (matched by purchasedAt timestamp).
      //
      // Build a timestamp set from DB for fast matching
      const dbTimestamps = new Map<number, { isMetaAttributed: number; leadCreatedAt: number | null }>();
      try {
        const db = await getDb();
        if (db) {
          const startMs = new Date(input.startDate + "T00:00:00Z").getTime();
          const endMs   = new Date(input.endDate   + "T23:59:59Z").getTime();
          const rows = await db.select({
            email: kajabiPurchases.email,
            amountCents: kajabiPurchases.amountCents,
            isMetaAttributed: kajabiPurchases.isMetaAttributed,
            purchasedAt: kajabiPurchases.purchasedAt,
          }).from(kajabiPurchases)
            .where(and(
              gte(kajabiPurchases.purchasedAt, startMs),
              lte(kajabiPurchases.purchasedAt, endMs)
            ));
          for (const row of rows) {
            if (row.purchasedAt) {
              // Round to nearest minute for fuzzy matching with Kajabi transaction timestamps
              const roundedMs = Math.round(row.purchasedAt / 60000) * 60000;
              dbTimestamps.set(roundedMs, {
                isMetaAttributed: row.isMetaAttributed ?? 0,
                leadCreatedAt: null,
              });
            }
          }
        }
      } catch (e) { /* non-fatal */ }

      // Annotate individual Kajabi sales with attribution type
      const annotatedKajabiSales: IndividualSale[] = kajabi.individualSales.map(sale => {
        const saleMs = new Date(sale.time).getTime();
        const roundedMs = Math.round(saleMs / 60000) * 60000;
        const dbRecord = dbTimestamps.get(roundedMs);
        let customerType: IndividualSale["customerType"] = "unknown";
        let leadOptInDate: string | undefined;
        if (dbRecord) {
          customerType = dbRecord.isMetaAttributed ? "meta_lead" : "returning";
          if (dbRecord.leadCreatedAt) {
            leadOptInDate = new Date(dbRecord.leadCreatedAt).toISOString().substring(0, 10);
          }
        }
        return { ...sale, customerType, leadOptInDate };
      });

      // ── Apply filters ──────────────────────────────────────────────────────
      const filterSales = (sales: IndividualSale[]) => {
        let filtered = sales;
        if (input.newCustomersOnly) {
          // Only include sales where we have a meta_lead attribution
          filtered = filtered.filter(s => s.customerType === "meta_lead");
        }
        if (input.attributionFilter === "meta_only") {
          filtered = filtered.filter(s => s.customerType === "meta_lead");
        } else if (input.attributionFilter === "non_meta") {
          filtered = filtered.filter(s => s.customerType !== "meta_lead");
        }
        return filtered;
      };

      const filteredKajabiSales = filterSales(annotatedKajabiSales);
      const filteredKajabiRevenueCents = filteredKajabiSales.reduce((s, t) => s + t.amountCents, 0);
      const filteredKajabiPurchases = filteredKajabiSales.length;

      const totalRevenueCents = filteredKajabiRevenueCents + shopify.totalRevenueCents;
      const totalRevenue = totalRevenueCents / 100;
      const roas = meta.spend > 0 ? Math.round((totalRevenue / meta.spend) * 100) / 100 : null;
      const cpl  = meta.spend > 0 && meta.leads > 0 ? Math.round((meta.spend / meta.leads) * 100) / 100 : null;
      const totalPurchases = filteredKajabiPurchases + shopify.totalOrders;
      const convRate = meta.leads > 0 && totalPurchases > 0
        ? Math.round((totalPurchases / meta.leads) * 10000) / 100
        : null;

      // Merge and sort individual sales
      const allSales = [
        ...filteredKajabiSales,
        ...shopify.individualSales,
      ].sort((a, b) => b.time.localeCompare(a.time));

      return {
        funnel: {
          id: funnel.id,
          label: funnel.label,
          kajabiActive: funnel.kajabiActive,
          shopifyActive: funnel.shopifyActive,
          metaActive: funnel.metaActive,
        },
        dateRange: { startDate: input.startDate, endDate: input.endDate },
        cohortAnalytics,
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
          totalRevenueCents: filteredKajabiRevenueCents,
          totalPurchases: filteredKajabiPurchases,
          pagesScanned: kajabi.pagesScanned,
          note: kajabi.note as string | undefined,
          // Attribution breakdown from DB webhook records
          attribution: {
            metaAttributed: metaAttributedCount,
            returning: returningCount,
            unknown: kajabi.totalPurchases - metaAttributedCount - returningCount,
            dbCoverage: dbLookup.size, // how many purchases hit the webhook
          },
        },
        shopify: {
          tiers: shopify.tiers,
          totalRevenueCents: shopify.totalRevenueCents,
          totalOrders: shopify.totalOrders,
          note: shopify.note as string | undefined,
        },
        summary: {
          totalRevenue,
          totalRevenueCents,
          kajabiRevenue: filteredKajabiRevenueCents / 100,
          shopifyRevenue: shopify.totalRevenueCents / 100,
          roas,
          cpl,
          convRate,
          totalPurchases,
          // Filter context
          filterApplied: input.newCustomersOnly || input.attributionFilter !== "all",
          newCustomersOnly: input.newCustomersOnly,
          attributionFilter: input.attributionFilter,
        },
        individualSales: allSales.slice(0, 200), // cap at 200 rows
      };
    }),
});
