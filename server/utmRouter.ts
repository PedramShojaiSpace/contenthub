import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { utmLinks } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export const utmRouter = router({
  // List all saved UTM links, newest first
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(utmLinks).orderBy(desc(utmLinks.createdAt)).limit(100);
  }),

  // Save a generated UTM link to persistent history (deduplicates by exact URL)
  save: protectedProcedure
    .input(
      z.object({
        url: z.string().min(1),
        label: z.string().min(1),
        source: z.string().min(1),
        medium: z.string().min(1),
        campaign: z.string().min(1),
        content: z.string().optional(),
        term: z.string().optional(),
        destination: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Deduplication: check if an identical URL already exists in history
      const existing = await db
        .select({ id: utmLinks.id })
        .from(utmLinks)
        .where(eq(utmLinks.url, input.url))
        .limit(1);

      if (existing.length > 0) {
        // URL already saved — return the existing record id without inserting
        return { id: existing[0].id, duplicate: true };
      }

      const [result] = await db.insert(utmLinks).values({
        url: input.url,
        label: input.label,
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        content: input.content ?? null,
        term: input.term ?? null,
        destination: input.destination ?? null,
      });
      return { id: result.insertId, duplicate: false };
    }),

  // Delete a saved UTM link by id
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(utmLinks).where(eq(utmLinks.id, input.id));
      return { success: true };
    }),

  // Look up the base CTA URL for a given ctaBlockLabel (for building full UTM URLs in the UI)
  getCtaUrlForLabel: protectedProcedure
    .input(z.object({ label: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { url: null };
      const { ctaBlocks } = await import("../drizzle/schema");
      const { like } = await import("drizzle-orm");
      const results = await db.select({ url: ctaBlocks.url })
        .from(ctaBlocks)
        .where(like(ctaBlocks.label, `%${input.label}%`))
        .limit(1);
      return { url: results[0]?.url ?? null };
    }),
});
