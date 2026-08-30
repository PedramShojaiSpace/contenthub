import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  signalAggregateResults,
  signalDecisionLogs,
  signalMessageClusters,
  signalTests,
} from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

const TEST_STATUSES = [
  "draft",
  "pending_policy_review",
  "ready_for_owner_review",
  "owner_approved_for_manual_setup",
  "needs_revision",
  "archived",
] as const;
const POLICY_STATUSES = ["not_started", "needs_revision", "reviewed"] as const;
const DATA_COVERAGE = ["not_connected", "partial", "complete"] as const;
const DECISIONS = ["hold", "refine", "prepare_manual_test", "not_selected"] as const;

const baseTestInput = z.object({
  title: z.string().trim().min(5).max(255),
  offer: z.string().trim().min(2).max(128),
  destinationUrl: z.string().url().max(512),
  audienceDescription: z.string().trim().min(10).max(2_000),
  objective: z.string().trim().min(3).max(128),
  primaryMetric: z.string().trim().min(3).max(128),
  fixedVariables: z.array(z.string().trim().min(2).max(160)).min(4).max(10),
  maxTestSpendCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

const clusterInput = z.object({
  label: z.string().trim().min(2).max(128),
  hypothesis: z.string().trim().min(10).max(2_000),
  headline: z.string().trim().min(3).max(255),
  primaryText: z.string().trim().min(10).max(5_000),
  description: z.string().trim().max(1_000).nullable().optional(),
  cta: z.string().trim().min(2).max(128),
  creativeReference: z.string().url().max(512).nullable().optional(),
});

const nonNegativeInt = z.number().int().min(0).max(1_000_000_000);

export function validateAggregateResult(input: {
  impressions: number;
  outboundClicks: number;
  landingPageViews: number;
  leads: number;
  qualifiedLeads: number;
  checkouts: number;
  purchases: number;
  spendCents: number;
  revenueCents: number;
}) {
  if (input.qualifiedLeads > input.leads) {
    throw new Error("Qualified leads cannot exceed total leads.");
  }
  if (input.purchases > input.checkouts) {
    throw new Error("Purchases cannot exceed checkouts in a single aggregate record.");
  }
  if (input.landingPageViews > input.outboundClicks) {
    throw new Error("Landing page views cannot exceed outbound clicks in a single aggregate record.");
  }
}

function parseFixedVariables(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

async function requireTest(testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [test] = await db.select().from(signalTests).where(eq(signalTests.id, testId)).limit(1);
  if (!test) throw new Error("Signal Lab test not found.");
  return { db, test };
}

async function refreshTestReviewState(testId: number) {
  const { db, test } = await requireTest(testId);
  const clusters = await db
    .select({ policyStatus: signalMessageClusters.policyStatus })
    .from(signalMessageClusters)
    .where(eq(signalMessageClusters.testId, testId));

  const allReviewed = clusters.length >= 2 && clusters.length <= 7 && clusters.every(cluster => cluster.policyStatus === "reviewed");
  const hasRevisionNeed = clusters.some(cluster => cluster.policyStatus === "needs_revision");
  const nextPolicyStatus = allReviewed ? "reviewed" : hasRevisionNeed ? "needs_revision" : "not_started";
  const nextStatus = allReviewed
    ? "ready_for_owner_review"
    : hasRevisionNeed
      ? "needs_revision"
      : test.status === "owner_approved_for_manual_setup"
        ? "draft"
        : test.status;

  await db
    .update(signalTests)
    .set({ policyStatus: nextPolicyStatus, status: nextStatus, updatedAt: new Date() })
    .where(eq(signalTests.id, testId));
}

export const signalLabRouter = router({
  listTests: adminProcedure
    .input(z.object({ status: z.enum([...TEST_STATUSES, "all"] as const).default("all") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(signalTests)
        .where(input.status === "all" ? undefined : eq(signalTests.status, input.status))
        .orderBy(desc(signalTests.updatedAt));
      return rows.map(row => ({ ...row, fixedVariables: parseFixedVariables(row.fixedVariables) }));
    }),

  getTest: adminProcedure.input(z.object({ testId: z.number().int().positive() })).query(async ({ input }) => {
    const { db, test } = await requireTest(input.testId);
    const [clusters, decisions] = await Promise.all([
      db.select().from(signalMessageClusters).where(eq(signalMessageClusters.testId, test.id)).orderBy(signalMessageClusters.id),
      db.select().from(signalDecisionLogs).where(eq(signalDecisionLogs.testId, test.id)).orderBy(desc(signalDecisionLogs.decidedAt)),
    ]);
    const clusterIds = clusters.map(cluster => cluster.id);
    const results = clusterIds.length
      ? await db.select().from(signalAggregateResults).where(inArray(signalAggregateResults.clusterId, clusterIds)).orderBy(desc(signalAggregateResults.resultDate))
      : [];
    return { ...test, fixedVariables: parseFixedVariables(test.fixedVariables), clusters, results, decisions };
  }),

  createTest: adminProcedure.input(baseTestInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [inserted] = await db.insert(signalTests).values({
      ...input,
      fixedVariables: JSON.stringify(input.fixedVariables),
      maxTestSpendCents: input.maxTestSpendCents ?? null,
      createdBy: ctx.user.name ?? ctx.user.openId,
      status: "draft",
      policyStatus: "not_started",
    });
    return { id: Number((inserted as { insertId?: number }).insertId) };
  }),

  updateTest: adminProcedure
    .input(z.object({ testId: z.number().int().positive(), changes: baseTestInput.partial() }))
    .mutation(async ({ input }) => {
      const { db, test } = await requireTest(input.testId);
      if (test.status === "owner_approved_for_manual_setup") {
        throw new Error("Create a new revision instead of editing an owner-approved manual setup brief.");
      }
      const changes = { ...input.changes } as Record<string, unknown>;
      if (input.changes.fixedVariables) changes.fixedVariables = JSON.stringify(input.changes.fixedVariables);
      await db.update(signalTests).set({ ...changes, updatedAt: new Date() }).where(eq(signalTests.id, input.testId));
      return { success: true };
    }),

  addCluster: adminProcedure
    .input(z.object({ testId: z.number().int().positive(), cluster: clusterInput }))
    .mutation(async ({ input }) => {
      const { db, test } = await requireTest(input.testId);
      if (test.status === "owner_approved_for_manual_setup") {
        throw new Error("Create a new revision instead of changing an owner-approved manual setup brief.");
      }
      const existing = await db.select({ id: signalMessageClusters.id }).from(signalMessageClusters).where(eq(signalMessageClusters.testId, input.testId));
      if (existing.length >= 7) throw new Error("A Signal Lab test supports no more than seven message clusters.");
      const [inserted] = await db.insert(signalMessageClusters).values({ testId: input.testId, ...input.cluster });
      await db.update(signalTests).set({ status: "draft", policyStatus: "not_started", updatedAt: new Date() }).where(eq(signalTests.id, input.testId));
      return { id: Number((inserted as { insertId?: number }).insertId) };
    }),

  submitForPolicyReview: adminProcedure
    .input(z.object({ testId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { db, test } = await requireTest(input.testId);
      if (test.status === "owner_approved_for_manual_setup") throw new Error("This brief is already approved for manual setup.");
      const clusters = await db.select({ id: signalMessageClusters.id }).from(signalMessageClusters).where(eq(signalMessageClusters.testId, input.testId));
      if (clusters.length < 2 || clusters.length > 7) throw new Error("Add between two and seven message clusters before policy review.");
      await db.update(signalTests).set({ status: "pending_policy_review", updatedAt: new Date() }).where(eq(signalTests.id, input.testId));
      return { success: true };
    }),

  reviewCluster: adminProcedure
    .input(z.object({ clusterId: z.number().int().positive(), policyStatus: z.enum(["reviewed", "needs_revision"]), policyNotes: z.string().trim().min(3).max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [cluster] = await db.select().from(signalMessageClusters).where(eq(signalMessageClusters.id, input.clusterId)).limit(1);
      if (!cluster) throw new Error("Signal Lab message cluster not found.");
      await db
        .update(signalMessageClusters)
        .set({ policyStatus: input.policyStatus, policyNotes: input.policyNotes, policyReviewer: ctx.user.name ?? ctx.user.openId, policyReviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(signalMessageClusters.id, input.clusterId));
      await refreshTestReviewState(cluster.testId);
      return { success: true };
    }),

  approveForManualSetup: adminProcedure
    .input(z.object({ testId: z.number().int().positive(), ownerApprovalNote: z.string().trim().min(10).max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireTest(input.testId);
      const clusters = await db.select({ policyStatus: signalMessageClusters.policyStatus }).from(signalMessageClusters).where(eq(signalMessageClusters.testId, input.testId));
      if (clusters.length < 2 || clusters.length > 7 || clusters.some(cluster => cluster.policyStatus !== "reviewed")) {
        throw new Error("Every one of two to seven message clusters must complete policy review before owner approval.");
      }
      await db
        .update(signalTests)
        .set({ status: "owner_approved_for_manual_setup", policyStatus: "reviewed", ownerApprovalNote: input.ownerApprovalNote, ownerApprovedBy: ctx.user.name ?? ctx.user.openId, ownerApprovedAt: new Date(), updatedAt: new Date() })
        .where(eq(signalTests.id, input.testId));
      return { success: true, externalActionTaken: false };
    }),

  recordAggregateResult: adminProcedure
    .input(z.object({
      clusterId: z.number().int().positive(),
      resultDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      metaCampaignId: z.string().trim().max(64).nullable().optional(),
      metaAdSetId: z.string().trim().max(64).nullable().optional(),
      metaAdId: z.string().trim().max(64).nullable().optional(),
      dataCoverage: z.enum(DATA_COVERAGE),
      impressions: nonNegativeInt,
      outboundClicks: nonNegativeInt,
      landingPageViews: nonNegativeInt,
      leads: nonNegativeInt,
      qualifiedLeads: nonNegativeInt,
      checkouts: nonNegativeInt,
      purchases: nonNegativeInt,
      spendCents: nonNegativeInt,
      revenueCents: nonNegativeInt,
      sourceNote: z.string().trim().max(2_000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      validateAggregateResult(input);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [cluster] = await db.select({ id: signalMessageClusters.id }).from(signalMessageClusters).where(eq(signalMessageClusters.id, input.clusterId)).limit(1);
      if (!cluster) throw new Error("Signal Lab message cluster not found.");
      const { clusterId, ...values } = input;
      await db.insert(signalAggregateResults).values({
        ...values,
        clusterId,
        metaCampaignId: values.metaCampaignId ?? null,
        metaAdSetId: values.metaAdSetId ?? null,
        metaAdId: values.metaAdId ?? null,
        sourceNote: values.sourceNote ?? null,
        recordedBy: ctx.user.name ?? ctx.user.openId,
      });
      return { success: true, externalActionTaken: false };
    }),

  recordDecision: adminProcedure
    .input(z.object({ testId: z.number().int().positive(), decision: z.enum(DECISIONS), rationale: z.string().trim().min(10).max(2_000), nextStep: z.string().trim().min(10).max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireTest(input.testId);
      await db.insert(signalDecisionLogs).values({ ...input, decidedBy: ctx.user.name ?? ctx.user.openId });
      return { success: true, externalActionTaken: false };
    }),
});
