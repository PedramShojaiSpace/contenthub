/**
 * Claims-Review Router
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-powered rubric gate on every health-claim publish path.
 * Flagged content enters a human approvals queue before publication.
 * All verdicts are logged with the content version for audit trail.
 */

import { z } from "zod";
import { desc, eq, and, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { claimsReviews } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { buildRubricSystemPrompt, RUBRIC_RULES } from "./claimsRubric";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RubricVerdict {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  flaggedText: string | null;
  explanation: string;
}

export interface ReviewResult {
  verdicts: RubricVerdict[];
  overallFlag: boolean;
  flagCount: number;
  summary: string;
  status: "pending" | "auto_approved";
}

// ─── Core rubric engine (exported for testing) ───────────────────────────────

export async function runRubricOnContent(
  contentText: string
): Promise<ReviewResult> {
  const systemPrompt = buildRubricSystemPrompt();

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Please review the following content for health-claim compliance:\n\n---\n${contentText}\n---`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "claims_review_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            verdicts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ruleId: { type: "string" },
                  ruleName: { type: "string" },
                  passed: { type: "boolean" },
                  flaggedText: { type: ["string", "null"] },
                  explanation: { type: "string" },
                },
                required: ["ruleId", "ruleName", "passed", "flaggedText", "explanation"],
                additionalProperties: false,
              },
            },
            overallFlag: { type: "boolean" },
            summary: { type: "string" },
          },
          required: ["verdicts", "overallFlag", "summary"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No response from LLM rubric engine");

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const verdicts: RubricVerdict[] = parsed.verdicts ?? [];
  const flagCount = verdicts.filter((v) => !v.passed).length;

  return {
    verdicts,
    overallFlag: parsed.overallFlag ?? flagCount > 0,
    flagCount,
    summary: parsed.summary ?? "",
    status: flagCount === 0 ? "auto_approved" : "pending",
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const claimsReviewRouter = router({
  /**
   * Run the AI rubric on a piece of content and save the review record.
   */
  reviewContent: protectedProcedure
    .input(
      z.object({
        contentType: z.enum([
          "wordpress_post",
          "meta_ad",
          "advertorial",
          "email_sequence",
          "landing_page",
          "other",
        ]),
        contentId: z.string().optional(),
        contentTitle: z.string().optional(),
        contentText: z.string().min(10),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const result = await runRubricOnContent(input.contentText);

      const [inserted] = await db.insert(claimsReviews).values({
        contentType: input.contentType,
        contentId: input.contentId ?? null,
        contentTitle: input.contentTitle ?? null,
        contentText: input.contentText,
        verdicts: result.verdicts,
        overallFlag: result.overallFlag ? 1 : 0,
        flagCount: result.flagCount,
        status: result.status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { ...result, reviewId: (inserted as any).insertId ?? null };
    }),

  /**
   * List all pending reviews (awaiting human approval).
   */
  listPending: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select({
        id: claimsReviews.id,
        contentType: claimsReviews.contentType,
        contentId: claimsReviews.contentId,
        contentTitle: claimsReviews.contentTitle,
        overallFlag: claimsReviews.overallFlag,
        flagCount: claimsReviews.flagCount,
        status: claimsReviews.status,
        createdAt: claimsReviews.createdAt,
      })
      .from(claimsReviews)
      .where(eq(claimsReviews.status, "pending"))
      .orderBy(desc(claimsReviews.createdAt))
      .limit(100);
  }),

  /**
   * List all reviews with optional filters.
   */
  listAll: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "approved", "rejected", "auto_approved", "all"])
          .default("all"),
        contentType: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { rows: [], total: 0 };

      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(claimsReviews.status, input.status as any));
      }
      if (input.contentType) {
        conditions.push(eq(claimsReviews.contentType, input.contentType as any));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(claimsReviews)
        .where(whereClause);

      const rows = await db
        .select({
          id: claimsReviews.id,
          contentType: claimsReviews.contentType,
          contentId: claimsReviews.contentId,
          contentTitle: claimsReviews.contentTitle,
          overallFlag: claimsReviews.overallFlag,
          flagCount: claimsReviews.flagCount,
          status: claimsReviews.status,
          reviewedBy: claimsReviews.reviewedBy,
          reviewedAt: claimsReviews.reviewedAt,
          reviewerNote: claimsReviews.reviewerNote,
          createdAt: claimsReviews.createdAt,
        })
        .from(claimsReviews)
        .where(whereClause)
        .orderBy(desc(claimsReviews.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { rows, total: Number(countResult?.total ?? 0) };
    }),

  /**
   * Get the full detail of a single review including verdicts.
   */
  getReview: protectedProcedure
    .input(z.object({ reviewId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(claimsReviews)
        .where(eq(claimsReviews.id, input.reviewId))
        .limit(1);

      return row ?? null;
    }),

  /**
   * Approve a flagged review — content is cleared for publication.
   */
  approveReview: protectedProcedure
    .input(
      z.object({
        reviewId: z.number(),
        reviewerNote: z.string().optional(),
        reviewedBy: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(claimsReviews)
        .set({
          status: "approved",
          reviewedBy: input.reviewedBy ?? (ctx.user as any)?.name ?? "unknown",
          reviewedAt: Date.now(),
          reviewerNote: input.reviewerNote ?? null,
          updatedAt: Date.now(),
        })
        .where(eq(claimsReviews.id, input.reviewId));

      return { success: true };
    }),

  /**
   * Reject a flagged review — content must be revised before re-submission.
   */
  rejectReview: protectedProcedure
    .input(
      z.object({
        reviewId: z.number(),
        reviewerNote: z.string().min(1, "Rejection reason is required"),
        reviewedBy: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(claimsReviews)
        .set({
          status: "rejected",
          reviewedBy: input.reviewedBy ?? (ctx.user as any)?.name ?? "unknown",
          reviewedAt: Date.now(),
          reviewerNote: input.reviewerNote,
          updatedAt: Date.now(),
        })
        .where(eq(claimsReviews.id, input.reviewId));

      return { success: true };
    }),

  /**
   * Get the current rubric rules (for the rubric editor UI).
   */
  getRubric: protectedProcedure.query(async () => {
    return RUBRIC_RULES;
  }),

  /**
   * Get review statistics for the dashboard header.
   */
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return { pending: 0, approved: 0, rejected: 0, autoApproved: 0, total: 0, flagRate: 0 };
    }

    const rows = await db
      .select({
        status: claimsReviews.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(claimsReviews)
      .groupBy(claimsReviews.status);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const flagged = (counts["pending"] ?? 0) + (counts["rejected"] ?? 0);
    const flagRate = total > 0 ? Math.round((flagged / total) * 100) : 0;

    return {
      pending: counts["pending"] ?? 0,
      approved: counts["approved"] ?? 0,
      rejected: counts["rejected"] ?? 0,
      autoApproved: counts["auto_approved"] ?? 0,
      total,
      flagRate,
    };
  }),
});

export type ClaimsReviewRouter = typeof claimsReviewRouter;
