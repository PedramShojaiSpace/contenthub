import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { collectiveSourcingCandidates } from "../drizzle/schema";
import { eq, desc, and, gte, like, or, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Brand Criteria ──────────────────────────────────────────────────────────
const BRAND_CRITERIA = `
Urban Monk brand criteria for sourcing products:
1. FUNCTIONAL MEDICINE: Supports gut health, hormonal balance, metabolic health, immune function, cognitive performance, sleep, stress resilience, or longevity.
2. PERSONAL DEVELOPMENT: Supports mindfulness, meditation, focus, energy, emotional regulation, or physical performance.
3. NON-TOXIC (mandatory): Must NOT contain: parabens, phthalates, artificial colors/dyes, artificial flavors, synthetic fragrances, sodium lauryl sulfate, formaldehyde releasers, BPA, heavy metals above safe limits, GMO ingredients (unless verified safe), high-fructose corn syrup, hydrogenated oils, MSG, aspartame/sucralose/saccharin, carrageenan, titanium dioxide.
4. CLEAN LABEL: Prefer organic, third-party tested, transparent ingredient sourcing, minimal processing.
5. PHILOSOPHY ALIGNMENT: Aligns with Dr. Pedram Shojai's Taoist wellness philosophy — balance, energy cultivation (qi), mind-body integration, sustainable living, ancient wisdom + modern science.
6. QUALITY THRESHOLD: Professional-grade or clinical-grade quality. Not mass-market junk.
`;

export const collectiveRouter = router({
  // ─── Get candidates ──────────────────────────────────────────────────────
  getCandidates: protectedProcedure
    .input(z.object({
      status: z.enum(["all", "candidate", "approved", "rejected", "imported"]).default("all"),
      search: z.string().optional(),
      minScore: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(collectiveSourcingCandidates.status, input.status));
      }
      if (input.search) {
        conditions.push(or(
          like(collectiveSourcingCandidates.title, `%${input.search}%`),
          like(collectiveSourcingCandidates.vendor, `%${input.search}%`),
          like(collectiveSourcingCandidates.tags, `%${input.search}%`),
        ));
      }
      if (input.minScore !== undefined) {
        conditions.push(gte(collectiveSourcingCandidates.brandFitScore, input.minScore));
      }

      const rows = await db
        .select()
        .from(collectiveSourcingCandidates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(collectiveSourcingCandidates.createdAt));

      return rows;
    }),

  // ─── Get stats ───────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const rows = await db
      .select({
        status: collectiveSourcingCandidates.status,
        count: sql<number>`COUNT(*)`,
        avgScore: sql<number>`AVG(brand_fit_score)`,
      })
      .from(collectiveSourcingCandidates)
      .groupBy(collectiveSourcingCandidates.status);

    const stats = { total: 0, candidates: 0, approved: 0, rejected: 0, imported: 0, avgScore: null as number | null };
    let totalScore = 0;
    let scoredCount = 0;

    for (const row of rows) {
      const count = Number(row.count);
      stats.total += count;
      if (row.status === "candidate") stats.candidates = count;
      if (row.status === "approved") stats.approved = count;
      if (row.status === "rejected") stats.rejected = count;
      if (row.status === "imported") stats.imported = count;
      if (row.avgScore !== null) {
        totalScore += Number(row.avgScore) * count;
        scoredCount += count;
      }
    }

    if (scoredCount > 0) stats.avgScore = Math.round(totalScore / scoredCount);
    return stats;
  }),

  // ─── Add candidate ───────────────────────────────────────────────────────
  addCandidate: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      vendor: z.string().optional(),
      productType: z.string().optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      imageUrl: z.string().optional(),
      tags: z.string().optional(),
      supplierName: z.string().optional(),
      supplierDomain: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const now = Date.now();
      const [result] = await db.insert(collectiveSourcingCandidates).values({
        title: input.title,
        vendor: input.vendor ?? null,
        productType: input.productType ?? null,
        description: input.description ?? null,
        price: input.price ?? null,
        imageUrl: input.imageUrl ?? null,
        tags: input.tags ?? null,
        supplierName: input.supplierName ?? null,
        supplierDomain: input.supplierDomain ?? null,
        status: "candidate",
        createdAt: now,
        updatedAt: now,
      });

      return { id: (result as any).insertId };
    }),

  // ─── Score a product with AI ─────────────────────────────────────────────
  scoreProduct: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [product] = await db
        .select()
        .from(collectiveSourcingCandidates)
        .where(eq(collectiveSourcingCandidates.id, input.id));

      if (!product) throw new Error("Product not found");

      const prompt = `You are a brand compliance officer for The Urban Monk, a functional medicine and personal development brand founded by Dr. Pedram Shojai, OMD.

${BRAND_CRITERIA}

Evaluate this product for brand fit:
Title: ${product.title}
Vendor: ${product.vendor ?? "Unknown"}
Product Type: ${product.productType ?? "Unknown"}
Description: ${product.description ?? "No description provided"}
Tags: ${product.tags ?? "None"}
Price: ${product.price ?? "Unknown"}

Return a JSON object with these exact fields:
{
  "score": <integer 0-100 representing brand fit>,
  "recommendation": <"Excellent fit" | "Good fit" | "Borderline" | "Poor fit" | "Reject - toxic">,
  "reason": <2-3 sentence explanation of the score>,
  "toxicFlags": <array of strings listing any toxic ingredients, harmful claims, or brand misalignments found — empty array if none>,
  "strengths": <array of 2-3 strings listing what makes this product a good fit>,
  "concerns": <array of strings listing any concerns — empty array if none>
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a brand compliance expert. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "brand_fit_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "integer" },
                recommendation: { type: "string" },
                reason: { type: "string" },
                toxicFlags: { type: "array", items: { type: "string" } },
                strengths: { type: "array", items: { type: "string" } },
                concerns: { type: "array", items: { type: "string" } },
              },
              required: ["score", "recommendation", "reason", "toxicFlags", "strengths", "concerns"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : content;

      await db
        .update(collectiveSourcingCandidates)
        .set({
          brandFitScore: parsed.score,
          brandFitReason: `${parsed.recommendation}: ${parsed.reason}`,
          toxicFlags: JSON.stringify(parsed.toxicFlags),
          updatedAt: Date.now(),
        })
        .where(eq(collectiveSourcingCandidates.id, input.id));

      return {
        score: parsed.score,
        recommendation: parsed.recommendation,
        reason: parsed.reason,
        toxicFlags: parsed.toxicFlags as string[],
        strengths: parsed.strengths as string[],
        concerns: parsed.concerns as string[],
      };
    }),

  // ─── Score all unscored ──────────────────────────────────────────────────
  scoreAllUnscored: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const unscored = await db
      .select({ id: collectiveSourcingCandidates.id })
      .from(collectiveSourcingCandidates)
      .where(sql`brand_fit_score IS NULL`);

    let scored = 0;
    for (const row of unscored) {
      try {
        // Re-use scoreProduct logic inline
        const [product] = await db
          .select()
          .from(collectiveSourcingCandidates)
          .where(eq(collectiveSourcingCandidates.id, row.id));

        if (!product) continue;

        const prompt = `${BRAND_CRITERIA}\n\nProduct: ${product.title}\nVendor: ${product.vendor ?? "Unknown"}\nDescription: ${product.description ?? "None"}\nTags: ${product.tags ?? "None"}\n\nReturn JSON: {"score": integer 0-100, "recommendation": string, "reason": string, "toxicFlags": string[], "strengths": string[], "concerns": string[]}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a brand compliance expert. Respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        await db
          .update(collectiveSourcingCandidates)
          .set({
            brandFitScore: parsed.score ?? 0,
            brandFitReason: `${parsed.recommendation ?? ""}: ${parsed.reason ?? ""}`,
            toxicFlags: JSON.stringify(parsed.toxicFlags ?? []),
            updatedAt: Date.now(),
          })
          .where(eq(collectiveSourcingCandidates.id, row.id));

        scored++;
      } catch {
        // continue on error
      }
    }

    return { scored };
  }),

  // ─── Update status ───────────────────────────────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["candidate", "approved", "rejected", "imported"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(collectiveSourcingCandidates)
        .set({ status: input.status, updatedAt: Date.now() })
        .where(eq(collectiveSourcingCandidates.id, input.id));

      return { success: true };
    }),

  // ─── Import to Shopify (opens admin URL) ────────────────────────────────
  importToShopify: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [product] = await db
        .select()
        .from(collectiveSourcingCandidates)
        .where(eq(collectiveSourcingCandidates.id, input.id));

      if (!product) throw new Error("Product not found");

      // Mark as imported
      await db
        .update(collectiveSourcingCandidates)
        .set({ status: "imported", updatedAt: Date.now() })
        .where(eq(collectiveSourcingCandidates.id, input.id));

      return {
        message: "Marked as imported. Opening Shopify Collective in your admin to complete the import.",
        shopifyAdminUrl: "https://admin.shopify.com/apps/merchant-to-merchant",
      };
    }),

  // ─── Delete candidate ────────────────────────────────────────────────────
  deleteCandidate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .delete(collectiveSourcingCandidates)
        .where(eq(collectiveSourcingCandidates.id, input.id));

      return { success: true };
    }),
});
