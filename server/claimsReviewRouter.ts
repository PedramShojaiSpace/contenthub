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
import { buildRubricSystemPrompt, RUBRIC_RULES, getMetaOnlyRules } from "./claimsRubric";

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

// ─── Meta Ad Pre-flight Compliance Check ────────────────────────────────────

export interface MetaComplianceResult {
  passed: boolean;
  riskScore: number; // 0-100, higher = more likely to be rejected
  blockingViolations: RubricVerdict[];
  warnings: RubricVerdict[];
  flaggedPhrases: string[];
  recommendation: string;
}

export async function runMetaComplianceCheck(
  adCopy: string
): Promise<MetaComplianceResult> {
  const systemPrompt = buildRubricSystemPrompt(true); // include Meta rules

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Please review the following Meta ad copy for Meta Advertising Policy compliance. Pay special attention to the Meta-specific rules (meta_personal_attributes, meta_disease_treatment_language, meta_physician_endorsement_risk):\n\n---\n${adCopy}\n---`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meta_compliance_result",
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
  if (!raw) throw new Error("No response from LLM Meta compliance engine");

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const verdicts: RubricVerdict[] = parsed.verdicts ?? [];

  const blockingViolations = verdicts.filter(
    (v) => !v.passed && RUBRIC_RULES.find((r) => r.ruleId === v.ruleId)?.severity === "block"
  );
  const warnings = verdicts.filter(
    (v) => !v.passed && RUBRIC_RULES.find((r) => r.ruleId === v.ruleId)?.severity === "warn"
  );
  const flaggedPhrases = verdicts
    .filter((v) => !v.passed && v.flaggedText)
    .map((v) => v.flaggedText as string);

  // Risk score: blocking violations are worth 25 pts each (max 75), warnings 10 pts each (max 25)
  const riskScore = Math.min(
    100,
    blockingViolations.length * 25 + warnings.length * 10
  );

  const passed = blockingViolations.length === 0;
  const recommendation = passed
    ? warnings.length > 0
      ? `Ad copy is likely approvable but has ${warnings.length} warning(s). Review flagged phrases before pushing.`
      : "Ad copy appears compliant with Meta's advertising policies."
    : `Ad copy has ${blockingViolations.length} blocking violation(s) that will likely cause rejection. Rewrite flagged phrases before pushing.`;

  return {
    passed,
    riskScore,
    blockingViolations,
    warnings,
    flaggedPhrases,
    recommendation,
  };
}

/**
 * v2.2 Part 3E — the content types a claims review may be created for.
 *
 * `claims_reviews.content_type` is varchar(64) in the live schema (Part 0
 * SHOW COLUMNS; a scratch-DB insert of 'youtube_script' succeeded), so adding a
 * value needs NO DDL. The only thing rejecting scripts before this change was
 * the zod enum below, which returned HTTP 400 in the Part 2b probe.
 */
export const CLAIMS_CONTENT_TYPES = [
  "wordpress_post",
  "meta_ad",
  "advertorial",
  "email_sequence",
  "landing_page",
  "youtube_script",
  "other",
] as const;

export type ClaimsContentType = (typeof CLAIMS_CONTENT_TYPES)[number];

/**
 * Create a claims review through the ONE canonical path.
 *
 * Extracted from `reviewContent` so the Script Factory can route through the
 * same rubric, the same verdict shape and the same table, instead of growing a
 * parallel claims engine. A second engine would mean the Claims Review page
 * shows some reviews and not others — which is worse than no review at all,
 * because it looks complete.
 *
 * Throws on rubric or DB failure. Callers that must not fail because of a
 * claims problem (script generation, notably) are responsible for wrapping this
 * in try/catch — see the post-commit call in scriptFactoryRouter.
 */
export async function createClaimsReview(input: {
  contentType: ClaimsContentType;
  contentId?: string | null;
  contentTitle?: string | null;
  contentText: string;
}): Promise<ReviewResult & { reviewId: number | null }> {
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

  return { ...result, reviewId: (inserted as any)?.insertId ?? null };
}

export const claimsReviewRouter = router({
  /**
   * Run the AI rubric on a piece of content and save the review record.
   */
  reviewContent: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(CLAIMS_CONTENT_TYPES),
        contentId: z.string().optional(),
        contentTitle: z.string().optional(),
        contentText: z.string().min(10),
      })
    )
    .mutation(async ({ input }) => {
      // Same helper the Script Factory uses — one creation path, by construction.
      return createClaimsReview(input);
    }),

  /**
   * v2.2 Part 3E — claims status for one piece of content, by type + id.
   *
   * Powers the script-detail badge. Returns the NEWEST review for the content,
   * because a regenerated or edited script is reviewed again and the stale
   * verdict must not be the one on display.
   */
  getForContent: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(CLAIMS_CONTENT_TYPES),
        contentId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select({
          id: claimsReviews.id,
          status: claimsReviews.status,
          flagCount: claimsReviews.flagCount,
          overallFlag: claimsReviews.overallFlag,
          createdAt: claimsReviews.createdAt,
        })
        .from(claimsReviews)
        .where(
          and(
            eq(claimsReviews.contentType, input.contentType as any),
            eq(claimsReviews.contentId, input.contentId)
          )
        )
        .orderBy(desc(claimsReviews.createdAt))
        .limit(1);

      return row ?? null;
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
   * Run Meta-specific ad policy pre-flight check on ad copy.
   * Returns risk score, blocking violations, and flagged phrases.
   * Call this before pushing any ad to Meta to catch likely rejections.
   */
  metaComplianceCheck: protectedProcedure
    .input(
      z.object({
        adId: z.string().optional(),
        adName: z.string().optional(),
        headline: z.string(),
        primaryText: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const adCopy = [
        `Headline: ${input.headline}`,
        `Primary Text: ${input.primaryText}`,
        input.description ? `Description: ${input.description}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const result = await runMetaComplianceCheck(adCopy);
      return result;
    }),

  /**
   * Get the current rubric rules (for the rubric editor UI).
   */
  getRubric: protectedProcedure.query(async () => {
    return RUBRIC_RULES;
  }),

  /**
   * Get only the Meta-specific rubric rules.
   */
  getMetaRules: protectedProcedure.query(async () => {
    return getMetaOnlyRules();
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
