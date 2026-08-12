import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { interconnectedLeads, leadPurchaseAttributions } from "../drizzle/schema";
import {
  classifyInterconnectedCohortPath,
  dayOffsetFromLead,
  isWithinFourteenDayWindow,
} from "./interconnectedCohorts";

export type ClosingTouch = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  method: "direct_email_click" | "modeled_kajabi_sequence" | "checkout" | "unknown";
  confidence: "direct" | "modeled" | "none";
};

export function inferKajabiClosingTouch(params: {
  kajabiTagged: boolean;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
}): ClosingTouch {
  if (params.source || params.medium || params.campaign || params.content) {
    return {
      source: params.source,
      medium: params.medium,
      campaign: params.campaign,
      content: params.content,
      method: "direct_email_click",
      confidence: "direct",
    };
  }
  if (params.kajabiTagged) {
    return {
      source: "kajabi",
      medium: "email",
      campaign: "interconnected_14day",
      method: "modeled_kajabi_sequence",
      confidence: "modeled",
    };
  }
  return { method: "unknown", confidence: "none" };
}

export async function recordLeadCohortPurchaseCredit(params: {
  funnelId: string;
  purchasePlatform: "shopify" | "kajabi";
  externalPurchaseId: string;
  purchaseEmail: string | null | undefined;
  purchaseAmountCents: number;
  purchasedAt: number;
  closingTouch: ClosingTouch;
}): Promise<void> {
  const email = params.purchaseEmail?.trim().toLowerCase();
  if (!email) return;
  const db = await getDb();
  if (!db) return;

  const [existing] = await db
    .select({ id: leadPurchaseAttributions.id })
    .from(leadPurchaseAttributions)
    .where(and(
      eq(leadPurchaseAttributions.purchasePlatform, params.purchasePlatform),
      eq(leadPurchaseAttributions.externalPurchaseId, params.externalPurchaseId)
    ))
    .limit(1);
  if (existing) return;

  const [lead] = await db
    .select()
    .from(interconnectedLeads)
    .where(eq(interconnectedLeads.email, email))
    .orderBy(asc(interconnectedLeads.createdAt))
    .limit(1);

  const cohortDay = lead ? dayOffsetFromLead(lead.createdAt, params.purchasedAt) : null;
  const acquisitionPath = lead
    ? classifyInterconnectedCohortPath(lead)
    : null;

  await db.insert(leadPurchaseAttributions).values({
    funnelId: params.funnelId,
    purchasePlatform: params.purchasePlatform,
    externalPurchaseId: params.externalPurchaseId,
    purchaseEmail: email,
    purchaseAmountCents: params.purchaseAmountCents,
    purchasedAt: params.purchasedAt,
    leadId: lead?.id ?? null,
    leadOptedInAt: lead?.createdAt ?? null,
    cohortDay,
    isWithin14Days: lead ? isWithinFourteenDayWindow(lead.createdAt, params.purchasedAt) : false,
    acquisitionPath,
    acquisitionSource: lead?.utmSource ?? null,
    acquisitionMedium: lead?.utmMedium ?? null,
    acquisitionCampaign: lead?.utmCampaign ?? null,
    closingSource: params.closingTouch.source ?? null,
    closingMedium: params.closingTouch.medium ?? null,
    closingCampaign: params.closingTouch.campaign ?? null,
    closingContent: params.closingTouch.content ?? null,
    closingMethod: params.closingTouch.method,
    closingConfidence: params.closingTouch.confidence,
  });
}
