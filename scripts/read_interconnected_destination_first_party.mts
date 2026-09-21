import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  fetchKajabiTransactionsForExactOfferTracking,
  summarizeCurrentInterconnectedTransactions,
} from "../server/kajabiSalesRouter";

const startIso = process.env.START_ISO ?? "2026-09-20T16:07:00.000Z";
const endIso = process.env.END_ISO ?? new Date().toISOString();
const startMs = Date.parse(startIso);
const endMs = Date.parse(endIso);
const startDate = process.env.START_DATE ?? "2026-09-20";
const endDate = process.env.END_DATE ?? "2026-09-21";

type Lead = {
  email: string;
  funnelPath: string;
  utmCampaign: string;
  createdAt: number;
  klaviyoSynced: number;
};

type Purchase = {
  email: string;
  amountCents: number;
  offerName: string;
  funnelSource: string;
  kajabiOrderId: string;
  isEmailListBuyer: number;
  isMetaAttributed: number;
  purchasedAt: number;
};

function rowsFrom(value: unknown): Array<Record<string, unknown>> {
  const outer = Array.isArray(value) ? value[0] : value;
  return Array.isArray(outer) ? outer as Array<Record<string, unknown>> : outer ? [outer as Record<string, unknown>] : [];
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupRows<T extends { count: number; revenueCents: number }>(rows: T[]) {
  return rows.sort((a, b) => b.revenueCents - a.revenueCents || b.count - a.count);
}

async function main() {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error("Invalid reporting window");
  }

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [leadRaw, purchaseRaw, exactOfferRead] = await Promise.all([
    db.execute(sql`
      SELECT email, funnel_path, utm_campaign, created_at, klaviyo_synced
      FROM interconnected_leads
      WHERE created_at >= ${startMs} AND created_at <= ${endMs}
      ORDER BY created_at ASC
    `),
    db.execute(sql`
      SELECT email, amount_cents, offer_name, funnel_source, kajabi_order_id,
             is_email_list_buyer, is_meta_attributed, purchased_at
      FROM kajabi_purchases
      WHERE purchased_at IS NOT NULL
        AND purchased_at >= ${startMs}
        AND purchased_at <= ${endMs}
      ORDER BY purchased_at ASC
    `),
    fetchKajabiTransactionsForExactOfferTracking(startDate, endDate),
  ]);

  const leads = rowsFrom(leadRaw)
    .map((row): Lead => ({
      email: text(row.email).toLowerCase(),
      funnelPath: text(row.funnel_path) || "(unassigned)",
      utmCampaign: text(row.utm_campaign) || "(missing)",
      createdAt: number(row.created_at),
      klaviyoSynced: number(row.klaviyo_synced),
    }))
    .filter((row) => row.email);

  const purchases = rowsFrom(purchaseRaw)
    .map((row): Purchase => ({
      email: text(row.email).toLowerCase(),
      amountCents: number(row.amount_cents),
      offerName: text(row.offer_name) || "(missing)",
      funnelSource: text(row.funnel_source) || "(missing)",
      kajabiOrderId: text(row.kajabi_order_id),
      isEmailListBuyer: number(row.is_email_list_buyer),
      isMetaAttributed: number(row.is_meta_attributed),
      purchasedAt: number(row.purchased_at),
    }))
    .filter((row) => row.email && row.amountCents > 0);

  const firstLeadByEmail = new Map<string, Lead>();
  for (const lead of leads) {
    const previous = firstLeadByEmail.get(lead.email);
    if (!previous || lead.createdAt < previous.createdAt) firstLeadByEmail.set(lead.email, lead);
  }

  const leadGroups = new Map<string, { funnelPath: string; utmCampaign: string; emails: Set<string>; klaviyoSyncedEmails: Set<string> }>();
  for (const lead of firstLeadByEmail.values()) {
    const key = `${lead.funnelPath}\u0000${lead.utmCampaign}`;
    const group = leadGroups.get(key) ?? {
      funnelPath: lead.funnelPath,
      utmCampaign: lead.utmCampaign,
      emails: new Set<string>(),
      klaviyoSyncedEmails: new Set<string>(),
    };
    group.emails.add(lead.email);
    if (lead.klaviyoSynced) group.klaviyoSyncedEmails.add(lead.email);
    leadGroups.set(key, group);
  }

  const purchaseByKey = new Map<string, Purchase>();
  for (const purchase of purchases) {
    const key = purchase.kajabiOrderId || `${purchase.email}:${purchase.amountCents}:${Math.round(purchase.purchasedAt / 60_000)}`;
    if (!purchaseByKey.has(key)) purchaseByKey.set(key, purchase);
  }

  const purchaseGroups = new Map<string, { funnelSource: string; isMetaAttributed: boolean; isEmailListBuyer: boolean; count: number; revenueCents: number }>();
  const matchedByLeadPath = new Map<string, { funnelPath: string; utmCampaign: string; count: number; revenueCents: number; uniqueBuyers: Set<string> }>();
  let unmatchedPurchaseCount = 0;
  let unmatchedRevenueCents = 0;

  for (const purchase of purchaseByKey.values()) {
    const sourceKey = `${purchase.funnelSource}\u0000${purchase.isMetaAttributed ? 1 : 0}\u0000${purchase.isEmailListBuyer ? 1 : 0}`;
    const sourceGroup = purchaseGroups.get(sourceKey) ?? {
      funnelSource: purchase.funnelSource,
      isMetaAttributed: Boolean(purchase.isMetaAttributed),
      isEmailListBuyer: Boolean(purchase.isEmailListBuyer),
      count: 0,
      revenueCents: 0,
    };
    sourceGroup.count += 1;
    sourceGroup.revenueCents += purchase.amountCents;
    purchaseGroups.set(sourceKey, sourceGroup);

    const lead = firstLeadByEmail.get(purchase.email);
    if (!lead || purchase.purchasedAt < lead.createdAt) {
      unmatchedPurchaseCount += 1;
      unmatchedRevenueCents += purchase.amountCents;
      continue;
    }

    const key = `${lead.funnelPath}\u0000${lead.utmCampaign}`;
    const group = matchedByLeadPath.get(key) ?? {
      funnelPath: lead.funnelPath,
      utmCampaign: lead.utmCampaign,
      count: 0,
      revenueCents: 0,
      uniqueBuyers: new Set<string>(),
    };
    group.count += 1;
    group.revenueCents += purchase.amountCents;
    group.uniqueBuyers.add(purchase.email);
    matchedByLeadPath.set(key, group);
  }

  const exactCurrentOffers = summarizeCurrentInterconnectedTransactions(exactOfferRead.rows, startDate, endDate);

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    window: {
      firstKlaviyoLeadAt: startIso,
      through: endIso,
      kajabiTransactionCalendarDays: { startDate, endDate, timeZone: "America/Chicago" },
    },
    leadGroups: [...leadGroups.values()]
      .map((group) => ({
        funnelPath: group.funnelPath,
        utmCampaign: group.utmCampaign,
        uniqueLeads: group.emails.size,
        klaviyoSynced: group.klaviyoSyncedEmails.size,
      }))
      .sort((a, b) => b.uniqueLeads - a.uniqueLeads),
    kajabiWebhookPurchases: {
      deduplicatedPurchaseCount: purchaseByKey.size,
      purchaseGroups: groupRows([...purchaseGroups.values()]),
      matchedToLeadGroups: [...matchedByLeadPath.values()]
        .map((group) => ({
          funnelPath: group.funnelPath,
          utmCampaign: group.utmCampaign,
          purchases: group.count,
          uniqueBuyers: group.uniqueBuyers.size,
          revenueCents: group.revenueCents,
        }))
        .sort((a, b) => b.revenueCents - a.revenueCents),
      unmatchedPurchaseCount,
      unmatchedRevenueCents,
      note: "Webhook records are used only for first-party lead matching. They do not replace the direct Kajabi transaction API for offer-level financial totals.",
    },
    kajabiCurrentInterconnectedExactOffers: {
      ...exactCurrentOffers,
      fetchedAt: exactOfferRead.fetchedAt,
      pagesScanned: exactOfferRead.pagesScanned,
      note: "Direct Kajabi transaction API; exact offer IDs 2151314475 ($67) and 2151333044 ($199) only; failed/refunded rows excluded.",
    },
  }, null, 2));
}

await main();
