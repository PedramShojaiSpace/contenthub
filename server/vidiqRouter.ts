/**
 * vidIQ tRPC Router
 * Exposes vidIQ MCP tools as tRPC procedures for the Content Hub frontend.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  vidiqKeywordResearch,
  vidiqOutliers,
  vidiqTrendingVideos,
  vidiqChannelStats,
  vidiqVideoStats,
  vidiqBalance,
} from "./vidiq";

export const vidiqRouter = router({
  /**
   * Research a YouTube keyword: volume, competition, overall score, related keywords.
   * Used in YouTube-to-Blog and Video Production Studio.
   * Cost: 5 credits per call.
   */
  keywordResearch: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(100),
        includeRelated: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      return vidiqKeywordResearch(input.keyword, input.includeRelated);
    }),

  /**
   * Find viral/breakout videos for a keyword — useful for content ideation.
   * Cost: 5 credits per call.
   */
  outliers: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(100),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      return vidiqOutliers(input.keyword, input.limit);
    }),

  /**
   * Find currently trending videos for a keyword/niche.
   * Cost: 5 credits per call.
   */
  trendingVideos: protectedProcedure
    .input(
      z.object({
        titleQuery: z.string().min(1).max(100),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      return vidiqTrendingVideos(input.titleQuery, input.limit);
    }),

  /**
   * Get stats for a YouTube channel (subscriber count, views, growth).
   * Cost: 5 credits per call.
   */
  channelStats: protectedProcedure
    .input(z.object({ channelId: z.string().min(1) }))
    .query(async ({ input }) => {
      return vidiqChannelStats(input.channelId);
    }),

  /**
   * Get historical stats for a YouTube video.
   * Cost: 5 credits per call.
   */
  videoStats: protectedProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .query(async ({ input }) => {
      return vidiqVideoStats(input.videoId);
    }),

  /**
   * Get remaining vidIQ MCP credits balance.
   * Cost: 0 credits.
   */
  balance: protectedProcedure.query(async () => {
    return vidiqBalance();
  }),

  /**
   * Suggest the best focus keyword for a video based on transcript content.
   * Runs keyword research on the LLM-suggested keyword and top alternatives,
   * then returns the one with the best opportunity score.
   * Cost: 5–25 credits per call (1–5 keyword lookups).
   */
  suggestFocusKeyword: protectedProcedure
    .input(
      z.object({
        videoTitle: z.string().min(1),
        suggestedKeyword: z.string().min(1), // LLM-suggested keyword from transcript
      })
    )
    .mutation(async ({ input }) => {
      // Research the LLM-suggested keyword
      const primary = await vidiqKeywordResearch(input.suggestedKeyword, true);

      // Pick the best keyword: primary vs top related by overall score
      const candidates = [
        { keyword: primary.keyword, overall: primary.overall, volume: primary.volume, competition: primary.competition, estimatedMonthlySearch: primary.estimatedMonthlySearch },
        ...primary.related.slice(0, 4).map((r) => ({
          keyword: r.keyword,
          overall: r.overall,
          volume: r.volume,
          competition: r.competition,
          estimatedMonthlySearch: r.estimatedMonthlySearch,
        })),
      ].filter((c) => c.overall > 0);

      // Sort by overall score (opportunity = high volume, lower competition)
      candidates.sort((a, b) => b.overall - a.overall);

      return {
        recommended: candidates[0] ?? { keyword: input.suggestedKeyword, overall: 0, volume: 0, competition: 0, estimatedMonthlySearch: 0 },
        alternatives: candidates.slice(1, 5),
        primaryResearch: primary,
      };
    }),
});
