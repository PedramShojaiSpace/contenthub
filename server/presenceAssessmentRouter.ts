/**
 * Presence Assessment Router
 *
 * Powers the 9-question quiz that identifies which of Dr. Pedram Shojai's
 * "9 presence channels" are suppressed in the user's life.
 *
 * Channels: sleep, stress, gut, energy, focus, movement, connection, purpose, environment
 *
 * Scoring:
 *  - Each channel is scored 1–5 (1 = severely suppressed, 5 = fully resourced)
 *  - Channels scoring ≤ 2 are flagged as "suppressed"
 *  - Overall score = average × 20 (0–100 scale)
 *  - primaryResult:
 *      "Highly Suppressed"    → overallScore < 40  (≥ 5 suppressed channels)
 *      "Partially Suppressed" → overallScore 40–69 (1–4 suppressed channels)
 *      "Well-Resourced"       → overallScore ≥ 70  (0 suppressed channels)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { presenceAssessmentResults } from "../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

// ─── Channel score schema ─────────────────────────────────────────────────────
const channelScoresSchema = z.object({
  sleep: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  gut: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  focus: z.number().int().min(1).max(5),
  movement: z.number().int().min(1).max(5),
  connection: z.number().int().min(1).max(5),
  purpose: z.number().int().min(1).max(5),
  environment: z.number().int().min(1).max(5),
});

type ChannelScores = z.infer<typeof channelScoresSchema>;
type ChannelKey = keyof ChannelScores;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeResults(scores: ChannelScores) {
  const channels = Object.keys(scores) as ChannelKey[];
  const suppressed = channels.filter((c) => scores[c] <= 2);
  const avg = channels.reduce((sum, c) => sum + scores[c], 0) / channels.length;
  const overallScore = Math.round(avg * 20);

  let primaryResult: string;
  if (overallScore < 40) {
    primaryResult = "Highly Suppressed";
  } else if (overallScore < 70) {
    primaryResult = "Partially Suppressed";
  } else {
    primaryResult = "Well-Resourced";
  }

  return { suppressed, overallScore, primaryResult };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const presenceAssessmentRouter = router({
  /**
   * Submit a completed quiz.
   * Works for both authenticated users (userId stored) and anonymous visitors
   * (userId = null, email captured for lead gen).
   */
  submitAssessment: publicProcedure
    .input(
      z.object({
        scores: channelScoresSchema,
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });

      const { suppressed, overallScore, primaryResult } = computeResults(
        input.scores
      );

      const [inserted] = await db.insert(presenceAssessmentResults).values({
        userId: ctx.user?.id ?? null,
        scores: JSON.stringify(input.scores),
        suppressedChannels: suppressed.join(",") || null,
        primaryResult,
        overallScore,
        email: input.email ?? null,
      });

      const resultId = (inserted as any).insertId as number;

      return {
        resultId,
        overallScore,
        primaryResult,
        suppressedChannels: suppressed,
        scores: input.scores,
      };
    }),

  /**
   * Retrieve the most recent assessment results for the authenticated user.
   */
  getMyResults: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });

      const results = await db
        .select()
        .from(presenceAssessmentResults)
        .where(eq(presenceAssessmentResults.userId, ctx.user.id))
        .orderBy(desc(presenceAssessmentResults.createdAt))
        .limit(input.limit);

      return results.map((r) => ({
        ...r,
        scores: JSON.parse(r.scores) as ChannelScores,
        suppressedChannels: r.suppressedChannels
          ? r.suppressedChannels.split(",")
          : [],
      }));
    }),

  /**
   * Get a single assessment result by ID (public — no auth required so results
   * page can be shared via link).
   */
  getResultById: publicProcedure
    .input(z.object({ resultId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });

      const [result] = await db
        .select()
        .from(presenceAssessmentResults)
        .where(eq(presenceAssessmentResults.id, input.resultId));

      if (!result)
        throw new TRPCError({ code: "NOT_FOUND", message: "Result not found" });

      return {
        ...result,
        scores: JSON.parse(result.scores) as ChannelScores,
        suppressedChannels: result.suppressedChannels
          ? result.suppressedChannels.split(",")
          : [],
      };
    }),
});
