import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { utmLinks } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export const utmRouter = router({
  // List all saved UTM links, newest first
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(utmLinks).orderBy(desc(utmLinks.createdAt)).limit(100);
  }),

  // Save a generated UTM link to persistent history
  save: publicProcedure
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
      return { id: result.insertId };
    }),

  // Delete a saved UTM link by id
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(utmLinks).where(eq(utmLinks.id, input.id));
      return { success: true };
    }),
});
