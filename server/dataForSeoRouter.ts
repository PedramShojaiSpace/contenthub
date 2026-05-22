/**
 * DataForSEO tRPC Router
 *
 * Procedures:
 *   dfs.status           — credential check + account balance
 *   dfs.keywordOverview  — search volume, CPC, difficulty, intent for up to 20 keywords
 *   dfs.keywordsForSite  — top keywords a domain ranks for (sorted by volume)
 *   dfs.competitors      — top competitor domains for a given domain
 *   dfs.domainIntersection — keywords both your domain and a competitor share
 *   dfs.rankedKeywords   — top keywords a competitor ranks for (gap analysis source)
 *   dfs.domainRankOverview — organic ranking distribution summary for a domain
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  testCredentials,
  getKeywordOverview,
  getKeywordsForSite,
  getCompetitorDomains,
  getDomainIntersection,
  getRankedKeywords,
  getDomainRankOverview,
} from "./dataForSeo";

export const dataForSeoRouter = router({
  // ── Credential / account status ──────────────────────────────────────────
  status: protectedProcedure.query(async () => {
    try {
      const result = await testCredentials();
      return { connected: true, login: result.login, balance: result.balance };
    } catch {
      return { connected: false, login: null, balance: 0 };
    }
  }),

  // ── Keyword overview: volume, CPC, difficulty, intent ────────────────────
  keywordOverview: protectedProcedure
    .input(
      z.object({
        keywords: z.array(z.string().min(1)).min(1).max(20),
      })
    )
    .query(async ({ input }) => {
      const items = await getKeywordOverview(input.keywords);
      return { items };
    }),

  // ── Keywords a domain ranks for ──────────────────────────────────────────
  keywordsForSite: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const result = await getKeywordsForSite(input.domain, input.limit, input.offset);
      return result;
    }),

  // ── Competitor domains ────────────────────────────────────────────────────
  competitors: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const result = await getCompetitorDomains(input.domain, input.limit);
      return result;
    }),

  // ── Domain intersection (shared keywords) ────────────────────────────────
  domainIntersection: protectedProcedure
    .input(
      z.object({
        target1: z.string().min(1),
        target2: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const result = await getDomainIntersection(input.target1, input.target2, input.limit);
      return result;
    }),

  // ── Ranked keywords for a competitor (gap analysis) ──────────────────────
  rankedKeywords: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(100),
      })
    )
    .query(async ({ input }) => {
      const result = await getRankedKeywords(input.domain, input.limit);
      return result;
    }),

  // ── Domain rank overview ──────────────────────────────────────────────────
  domainRankOverview: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const result = await getDomainRankOverview(input.domain);
      return result;
    }),
});
