/**
 * keywordStrategyRouter.ts
 *
 * Proactive keyword strategy system:
 *  - Campaigns: topic cluster containers (e.g. "Gut Health Authority")
 *  - Targets: individual keywords within a campaign with funnel stage, monetization tag,
 *             DataForSEO volume/difficulty, GSC position, and content status
 *  - AI-assisted: generates a full keyword cluster from a pillar keyword using LLM + DataForSEO
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { keywordCampaigns, keywordTargets } from "../drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getKeywordOverview } from "./dataForSeo";
import { invokeLLM } from "./_core/llm";

// ─── Validation schemas ───────────────────────────────────────────────────────

const campaignInput = z.object({
  name: z.string().min(1).max(128),
  pillarKeyword: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  monetizationGoal: z.enum(["academy", "supplements", "testing", "free_lead"]).default("academy"),
});

const targetInput = z.object({
  campaignId: z.number().int().positive(),
  keyword: z.string().min(1).max(256),
  keywordType: z.enum(["pillar", "cluster", "conversion"]).default("cluster"),
  funnelStage: z.enum(["tofu", "mofu", "bofu"]).default("tofu"),
  monetizationTag: z
    .enum(["academy", "supplements", "testing", "free_lead", "affiliate"])
    .default("academy"),
  notes: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(100).default(50),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const keywordStrategyRouter = router({
  // ── Campaigns ──────────────────────────────────────────────────────────────

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const campaigns = await db!
      .select()
      .from(keywordCampaigns)
      .where(eq(keywordCampaigns.userId, ctx.user.id))
      .orderBy(desc(keywordCampaigns.createdAt));

    // For each campaign, count targets by content status
    const allTargets = await db!
      .select()
      .from(keywordTargets)
      .where(eq(keywordTargets.userId, ctx.user.id));

    const campaignsWithStats = campaigns.map((c) => {
      const targets = allTargets.filter((t) => t.campaignId === c.id);
      return {
        ...c,
        totalKeywords: targets.length,
        published: targets.filter((t) => t.contentStatus === "published").length,
        inProgress: targets.filter((t) => t.contentStatus === "in_progress").length,
        briefed: targets.filter((t) => t.contentStatus === "briefed").length,
        notStarted: targets.filter((t) => t.contentStatus === "not_started").length,
      };
    });

    return { campaigns: campaignsWithStats };
  }),

  createCampaign: protectedProcedure.input(campaignInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [result] = await db!.insert(keywordCampaigns).values({
      userId: ctx.user.id,
      name: input.name,
      pillarKeyword: input.pillarKeyword,
      description: input.description ?? null,
      monetizationGoal: input.monetizationGoal,
      status: "active",
    });
    return { id: result.insertId };
  }),

  updateCampaign: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(2000).optional(),
        monetizationGoal: z
          .enum(["academy", "supplements", "testing", "free_lead"])
          .optional(),
        status: z.enum(["active", "paused", "completed"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      await db!
        .update(keywordCampaigns)
        .set(updates)
        .where(and(eq(keywordCampaigns.id, id), eq(keywordCampaigns.userId, ctx.user.id)));
      return { ok: true };
    }),

  deleteCampaign: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Delete all targets first
      await db!
        .delete(keywordTargets)
        .where(
          and(eq(keywordTargets.campaignId, input.id), eq(keywordTargets.userId, ctx.user.id))
        );
      await db!
        .delete(keywordCampaigns)
        .where(
          and(eq(keywordCampaigns.id, input.id), eq(keywordCampaigns.userId, ctx.user.id))
        );
      return { ok: true };
    }),

  // ── Targets ────────────────────────────────────────────────────────────────

  listTargets: protectedProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const targets = await db!
        .select()
        .from(keywordTargets)
        .where(
          and(
            eq(keywordTargets.campaignId, input.campaignId),
            eq(keywordTargets.userId, ctx.user.id)
          )
        )
        .orderBy(asc(keywordTargets.funnelStage), desc(keywordTargets.priority));
      return { targets };
    }),

  addTarget: protectedProcedure.input(targetInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [result] = await db!.insert(keywordTargets).values({
      campaignId: input.campaignId,
      userId: ctx.user.id,
      keyword: input.keyword.toLowerCase().trim(),
      keywordType: input.keywordType,
      funnelStage: input.funnelStage,
      monetizationTag: input.monetizationTag,
      notes: input.notes ?? null,
      priority: input.priority,
      contentStatus: "not_started",
    });
    return { id: result.insertId };
  }),

  updateTarget: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        contentStatus: z
          .enum(["not_started", "briefed", "in_progress", "published"])
          .optional(),
        publishedUrl: z.string().url().optional(),
        notes: z.string().max(2000).optional(),
        priority: z.number().int().min(1).max(100).optional(),
        funnelStage: z.enum(["tofu", "mofu", "bofu"]).optional(),
        monetizationTag: z
          .enum(["academy", "supplements", "testing", "free_lead", "affiliate"])
          .optional(),
        keywordType: z.enum(["pillar", "cluster", "conversion"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      await db!
        .update(keywordTargets)
        .set(updates)
        .where(and(eq(keywordTargets.id, id), eq(keywordTargets.userId, ctx.user.id)));
      return { ok: true };
    }),

  removeTarget: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db!
        .delete(keywordTargets)
        .where(and(eq(keywordTargets.id, input.id), eq(keywordTargets.userId, ctx.user.id)));
      return { ok: true };
    }),

  // ── DataForSEO enrichment ──────────────────────────────────────────────────

  enrichTargets: protectedProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const targets = await db!
        .select()
        .from(keywordTargets)
        .where(
          and(
            eq(keywordTargets.campaignId, input.campaignId),
            eq(keywordTargets.userId, ctx.user.id)
          )
        );

      if (targets.length === 0) return { enriched: 0 };

      const keywords = targets.map((t) => t.keyword);
      const volumeData = await getKeywordOverview(keywords);

      // Build a map: keyword -> volume data
      const volumeMap = new Map(volumeData.map((v) => [v.keyword.toLowerCase(), v]));

      // Update each target with volume/difficulty/cpc
      let enriched = 0;
      for (const target of targets) {
        const data = volumeMap.get(target.keyword.toLowerCase());
        if (data) {
          await db!
            .update(keywordTargets)
            .set({
              searchVolume: data.search_volume ?? null,
              difficulty: data.keyword_difficulty ?? null,
              cpc: data.cpc != null ? String(data.cpc) : null,
            })
            .where(eq(keywordTargets.id, target.id));
          enriched++;
        }
      }

      return { enriched };
    }),

  // ── AI keyword cluster generation ─────────────────────────────────────────

  generateCluster: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        pillarKeyword: z.string().min(1).max(256),
        monetizationGoal: z.enum(["academy", "supplements", "testing", "free_lead"]),
        existingKeywords: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = (input.existingKeywords ?? []).join(", ");

      const systemPrompt = `You are an expert SEO strategist for The Urban Monk (theurbanmonk.com), 
a wellness brand run by Dr. Pedram Shojai, OMD. The site monetizes through:
- Urban Monk Academy membership ($297/year) — the primary conversion goal
- Supplement store (gut health, sleep, energy, adaptogens)
- Functional medicine testing (GI Map, KBMO FIT 176, Orobiome)
- Free lead magnets (ebooks, webinars) that feed the Academy funnel

Your task: generate a complete topic cluster keyword strategy for the pillar keyword provided.
Return ONLY valid JSON — no markdown, no explanation.`;

      const userPrompt = `Pillar keyword: "${input.pillarKeyword}"
Monetization goal: ${input.monetizationGoal}
${existing ? `Already have these keywords (do not repeat): ${existing}` : ""}

Generate a keyword cluster with exactly this JSON structure:
{
  "pillar": {
    "keyword": "...",
    "funnelStage": "tofu",
    "keywordType": "pillar",
    "monetizationTag": "${input.monetizationGoal}",
    "notes": "...",
    "priority": 90
  },
  "cluster": [
    {
      "keyword": "...",
      "funnelStage": "tofu|mofu|bofu",
      "keywordType": "cluster",
      "monetizationTag": "academy|supplements|testing|free_lead|affiliate",
      "notes": "why this keyword matters and what content angle to take",
      "priority": 1-100
    }
  ],
  "conversion": [
    {
      "keyword": "...",
      "funnelStage": "bofu",
      "keywordType": "conversion",
      "monetizationTag": "academy|supplements|testing",
      "notes": "...",
      "priority": 1-100
    }
  ]
}

Rules:
- 1 pillar keyword (broad, high-volume, TOFU — the authority hub page)
- 8-12 cluster keywords (educational, TOFU/MOFU — blog posts, videos, guides)
- 3-5 conversion keywords (high-intent, BOFU — program pages, product pages)
- Cluster keywords should cover: symptoms/problems, causes, solutions, comparisons, how-tos, science
- Conversion keywords should have clear purchase/sign-up intent
- Notes should be specific and actionable (e.g. "Write a 2,000-word guide comparing X vs Y, CTA to Academy gut health module")
- Prioritize keywords that connect to Pedram's unique angle: ancient wisdom + modern science, qigong, functional medicine, mind-body connection`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const raw = response.choices[0].message.content as string;
      const parsed = JSON.parse(raw) as {
        pillar: {
          keyword: string;
          funnelStage: string;
          keywordType: string;
          monetizationTag: string;
          notes: string;
          priority: number;
        };
        cluster: Array<{
          keyword: string;
          funnelStage: string;
          keywordType: string;
          monetizationTag: string;
          notes: string;
          priority: number;
        }>;
        conversion: Array<{
          keyword: string;
          funnelStage: string;
          keywordType: string;
          monetizationTag: string;
          notes: string;
          priority: number;
        }>;
      };

      const allKeywords = [parsed.pillar, ...parsed.cluster, ...parsed.conversion];

      // Insert all generated keywords into the DB
      const db = await getDb();
      const inserted: number[] = [];
      for (const kw of allKeywords) {
        const [result] = await db!.insert(keywordTargets).values({
          campaignId: input.campaignId,
          userId: ctx.user.id,
          keyword: kw.keyword.toLowerCase().trim(),
          keywordType: (kw.keywordType as "pillar" | "cluster" | "conversion") ?? "cluster",
          funnelStage: (kw.funnelStage as "tofu" | "mofu" | "bofu") ?? "tofu",
          monetizationTag:
            (kw.monetizationTag as
              | "academy"
              | "supplements"
              | "testing"
              | "free_lead"
              | "affiliate") ?? "academy",
          notes: kw.notes ?? null,
          priority: Math.min(100, Math.max(1, kw.priority ?? 50)),
          contentStatus: "not_started",
        });
        inserted.push(result.insertId);
      }

      return {
        inserted: inserted.length,
        keywords: allKeywords,
      };
    }),
});
