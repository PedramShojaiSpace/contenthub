import type { KajabiTransactionRow } from "./kajabiSalesRouter";
import { operationalDate } from "./kajabiSalesRouter";
import type { AgoraPriceArmId } from "./agoraPriceTest";

export const PRICE_TEST_TRACKER_KEY = "agora-entry-price-v1" as const;
export const PRICE_TEST_TRACKER_OCUS_OFFER_ID = "2151333044" as const;

export type PriceTestTrackerStatus = "draft" | "ready_for_activation" | "running" | "concluded";

export interface PriceTestTrackerArmInput {
  armId: AgoraPriceArmId;
  label: string;
  priceCents: number;
  isControl: boolean;
  offerId: string | null;
  checkoutUrl: string | null;
}

export interface PriceTestTrackingSummary {
  startDate: string;
  endDate: string;
  arms: Array<PriceTestTrackerArmInput & {
    clearedPurchases: number;
    clearedRevenueCents: number;
    excludedRefundRows: number;
    offerMapped: boolean;
  }>;
  sharedOcus: {
    offerId: string;
    expectedPriceCents: number;
    clearedPurchases: number;
    clearedRevenueCents: number;
    excludedRefundRows: number;
    attributionStatus: "unassigned_until_live_cohort_link";
  };
}

function isRefundOrFailure(row: KajabiTransactionRow) {
  const state = row.attributes?.state || "";
  const action = row.attributes?.action || "";
  return state === "failed" || state === "refunded" || action === "refund";
}

/**
 * Aggregate only direct Kajabi exact-offer transactions. The shared $199 OCUS is
 * reported separately because a standalone Kajabi transaction does not prove the
 * originating price arm before a later approved live cohort link is in place.
 */
export function summarizeAgoraPriceTestTransactions(
  rows: KajabiTransactionRow[],
  startDate: string,
  endDate: string,
  arms: PriceTestTrackerArmInput[],
  ocusOfferId = PRICE_TEST_TRACKER_OCUS_OFFER_ID,
) : PriceTestTrackingSummary {
  const armStats = new Map(arms.map((arm) => [arm.armId, {
    ...arm,
    clearedPurchases: 0,
    clearedRevenueCents: 0,
    excludedRefundRows: 0,
    offerMapped: Boolean(arm.offerId),
  }]));
  const sharedOcus = {
    offerId: ocusOfferId,
    expectedPriceCents: 19900,
    clearedPurchases: 0,
    clearedRevenueCents: 0,
    excludedRefundRows: 0,
    attributionStatus: "unassigned_until_live_cohort_link" as const,
  };

  for (const row of rows) {
    const dateStr = operationalDate(row.attributes?.created_at || "");
    if (dateStr < startDate || dateStr > endDate) continue;

    const offerId = row.relationships?.offer?.data?.id || "";
    const amount = row.attributes?.amount_in_cents || 0;
    const excluded = isRefundOrFailure(row) || amount <= 0;
    const matchingArm = [...armStats.values()].find(
      (arm) => arm.offerId === offerId && arm.priceCents === amount,
    );

    if (matchingArm) {
      if (excluded) matchingArm.excludedRefundRows++;
      else {
        matchingArm.clearedPurchases++;
        matchingArm.clearedRevenueCents += amount;
      }
      continue;
    }

    if (offerId === ocusOfferId && amount === sharedOcus.expectedPriceCents) {
      if (excluded) sharedOcus.excludedRefundRows++;
      else {
        sharedOcus.clearedPurchases++;
        sharedOcus.clearedRevenueCents += amount;
      }
    }
  }

  return { startDate, endDate, arms: [...armStats.values()], sharedOcus };
}

export function priceTestActivationBlockers(input: {
  status: PriceTestTrackerStatus;
  trafficAllocationActive: boolean;
  ocusParityP49Verified: boolean;
  ocusParityP67Verified: boolean;
  ocusParityP99Verified: boolean;
  arms: PriceTestTrackerArmInput[];
}) {
  const blockers: string[] = [];
  for (const arm of input.arms) {
    if (!arm.offerId) blockers.push(`${arm.label} is missing an exact Kajabi Offer ID.`);
    if (!arm.checkoutUrl) blockers.push(`${arm.label} is missing its recorded checkout URL.`);
  }
  if (!input.ocusParityP49Verified) blockers.push("$199 OCUS parity is not verified for the $49 arm.");
  if (!input.ocusParityP67Verified) blockers.push("$199 OCUS parity is not verified for the $67 control.");
  if (!input.ocusParityP99Verified) blockers.push("$199 OCUS parity is not verified for the $99 arm.");
  if (input.trafficAllocationActive) blockers.push("Traffic allocation is active; this tracker does not activate or control it.");
  if (input.status !== "draft") blockers.push(`Tracker status is ${input.status}; manual activation requires a separate owner-approved workflow.`);
  return blockers;
}
