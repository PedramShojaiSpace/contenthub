import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { agoraPriceTestTrackerArms, agoraPriceTestTrackers } from "../drizzle/schema";
import { fetchKajabiTransactionsForExactOfferTracking } from "./kajabiSalesRouter";
import {
  PRICE_TEST_TRACKER_KEY,
  PRICE_TEST_TRACKER_OCUS_OFFER_ID,
  priceTestActivationBlockers,
  summarizeAgoraPriceTestTransactions,
  type PriceTestTrackerArmInput,
} from "./agoraPriceTestTracking";

const DATE_INPUT = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ARM_INPUT = z.object({
  armId: z.enum(["p49", "p67", "p99"]),
  offerId: z.string().trim().min(1).max(64).nullable(),
  checkoutUrl: z.string().url().max(1000).nullable(),
});

const SEED_ARMS: PriceTestTrackerArmInput[] = [
  { armId: "p49", label: "$49 treatment — P1", priceCents: 4900, isControl: false, offerId: null, checkoutUrl: null },
  { armId: "p67", label: "$67 current control", priceCents: 6700, isControl: true, offerId: "2151314475", checkoutUrl: null },
  { armId: "p99", label: "$99 treatment — P2", priceCents: 9900, isControl: false, offerId: null, checkoutUrl: null },
];

async function getTrackerWithArms() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [tracker] = await db
    .select()
    .from(agoraPriceTestTrackers)
    .where(eq(agoraPriceTestTrackers.testKey, PRICE_TEST_TRACKER_KEY))
    .limit(1);
  if (!tracker) return { db, tracker: null, arms: [] as PriceTestTrackerArmInput[] };

  const rows = await db
    .select()
    .from(agoraPriceTestTrackerArms)
    .where(eq(agoraPriceTestTrackerArms.trackerId, tracker.id));
  const arms = rows.map((row) => ({
    armId: row.armId,
    label: row.label,
    priceCents: row.priceCents,
    isControl: row.isControl,
    offerId: row.offerId,
    checkoutUrl: row.checkoutUrl,
  })) as PriceTestTrackerArmInput[];
  return { db, tracker, arms };
}

function trackerView(tracker: Awaited<ReturnType<typeof getTrackerWithArms>>["tracker"], arms: PriceTestTrackerArmInput[]) {
  if (!tracker) {
    return {
      initialized: false,
      testKey: PRICE_TEST_TRACKER_KEY,
      status: "draft" as const,
      arms: SEED_ARMS,
      blockers: ["Internal tracker record has not been initialized."],
      trafficAllocationActive: false,
      ocusOfferId: PRICE_TEST_TRACKER_OCUS_OFFER_ID,
      ocusParity: { p49: false, p67: true, p99: false },
    };
  }
  return {
    initialized: true,
    testKey: tracker.testKey,
    status: tracker.status,
    arms,
    blockers: priceTestActivationBlockers({
      status: tracker.status,
      trafficAllocationActive: tracker.trafficAllocationActive,
      ocusParityP49Verified: tracker.ocusParityP49Verified,
      ocusParityP67Verified: tracker.ocusParityP67Verified,
      ocusParityP99Verified: tracker.ocusParityP99Verified,
      arms,
    }),
    trafficAllocationActive: tracker.trafficAllocationActive,
    ocusOfferId: tracker.ocusOfferId ?? PRICE_TEST_TRACKER_OCUS_OFFER_ID,
    ocusParity: {
      p49: tracker.ocusParityP49Verified,
      p67: tracker.ocusParityP67Verified,
      p99: tracker.ocusParityP99Verified,
    },
  };
}

export const agoraPriceTestTrackingRouter = router({
  getTracker: protectedProcedure.query(async () => {
    const { tracker, arms } = await getTrackerWithArms();
    return trackerView(tracker, arms);
  }),

  initializeDraftTracker: protectedProcedure.mutation(async () => {
    const { db, tracker } = await getTrackerWithArms();
    if (tracker) return { initialized: false, reason: "already_initialized" as const };
    const now = Date.now();
    const result = await db.insert(agoraPriceTestTrackers).values({
      testKey: PRICE_TEST_TRACKER_KEY,
      status: "draft",
      ocusOfferId: PRICE_TEST_TRACKER_OCUS_OFFER_ID,
      trafficAllocationActive: false,
      createdAt: now,
      updatedAt: now,
    });
    const trackerId = Number((result as { insertId?: number }).insertId);
    await db.insert(agoraPriceTestTrackerArms).values(
      SEED_ARMS.map((arm) => ({
        trackerId,
        armId: arm.armId,
        label: arm.label,
        priceCents: arm.priceCents,
        isControl: arm.isControl,
        offerId: arm.offerId,
        checkoutUrl: arm.checkoutUrl,
        createdAt: now,
        updatedAt: now,
      })),
    );
    return { initialized: true };
  }),

  saveDraftMappings: protectedProcedure
    .input(z.object({
      arms: z.array(ARM_INPUT).length(3),
      ocusOfferId: z.string().trim().min(1).max(64),
      ocusParityP49Verified: z.boolean(),
      ocusParityP99Verified: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const { db, tracker } = await getTrackerWithArms();
      if (!tracker) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Initialize the draft tracker first." });
      const uniqueIds = new Set(input.arms.map((arm) => arm.offerId).filter(Boolean));
      if (uniqueIds.size !== input.arms.filter((arm) => arm.offerId).length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Each price arm requires a different exact Offer ID." });
      }
      const now = Date.now();
      for (const arm of input.arms) {
        await db.update(agoraPriceTestTrackerArms)
          .set({ offerId: arm.offerId, checkoutUrl: arm.checkoutUrl, updatedAt: now })
          .where(and(eq(agoraPriceTestTrackerArms.trackerId, tracker.id), eq(agoraPriceTestTrackerArms.armId, arm.armId)));
      }
      await db.update(agoraPriceTestTrackers)
        .set({
          ocusOfferId: input.ocusOfferId,
          ocusParityP49Verified: input.ocusParityP49Verified,
          ocusParityP99Verified: input.ocusParityP99Verified,
          status: "draft",
          trafficAllocationActive: false,
          updatedAt: now,
        })
        .where(eq(agoraPriceTestTrackers.id, tracker.id));
      return { ok: true };
    }),

  getResults: protectedProcedure
    .input(z.object({ startDate: DATE_INPUT, endDate: DATE_INPUT }))
    .query(async ({ input }) => {
      const { tracker, arms } = await getTrackerWithArms();
      const view = trackerView(tracker, arms);
      if (!tracker || arms.some((arm) => !arm.offerId)) {
        return { ...view, results: null, pagesScanned: 0, fetchedAt: null };
      }
      const read = await fetchKajabiTransactionsForExactOfferTracking(input.startDate, input.endDate);
      return {
        ...view,
        results: summarizeAgoraPriceTestTransactions(read.rows, input.startDate, input.endDate, arms, view.ocusOfferId),
        pagesScanned: read.pagesScanned,
        fetchedAt: read.fetchedAt,
      };
    }),
});
