/**
 * Meta Custom Audience Router
 *
 * Manages email-based Custom Audiences in Meta Ads Manager.
 * Pipeline:
 *   1. createAudience  — create a new Custom Audience in Meta + DB
 *   2. addEmails       — hash emails (SHA256) and push to Meta + track in DB
 *   3. createLookalike — build a Lookalike Audience from a seed Custom Audience
 *   4. listAudiences   — list all tracked audiences with stats
 *   5. syncLeadEmails  — batch-add all found emails from lead_prospects not yet in an audience
 *
 * Meta API: https://graph.facebook.com/v21.0/
 * Requires: META_AD_ACCESS_TOKEN, META_AD_ACCOUNT_ID
 */

import crypto from "crypto";
import { eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leadProspects, metaAudienceLeads, metaCustomAudiences } from "../drizzle/schema";
import { z } from "zod";

function getMetaConfig() {
  const accessToken = process.env.META_AD_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken) throw new Error("META_AD_ACCESS_TOKEN is not set");
  if (!adAccountId) throw new Error("META_AD_ACCOUNT_ID is not set");
  return { accessToken, adAccountId };
}

async function metaPost(path: string, body: Record<string, unknown>) {
  const { accessToken } = getMetaConfig();
  const res = await fetch(`https://graph.facebook.com/v21.0${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (data.error) {
    const err = data.error as { message?: string; code?: number };
    throw new Error(`Meta API error ${err.code}: ${err.message}`);
  }
  return data;
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const { accessToken } = getMetaConfig();
  const qs = new URLSearchParams({ ...params, access_token: accessToken }).toString();
  const res = await fetch(`https://graph.facebook.com/v21.0${path}?${qs}`);
  const data = await res.json() as Record<string, unknown>;
  if (data.error) {
    const err = data.error as { message?: string; code?: number };
    throw new Error(`Meta API error ${err.code}: ${err.message}`);
  }
  return data;
}

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

export const metaCustomAudienceRouter = router({

  // ── List all tracked audiences ────────────────────────────────────────────
  listAudiences: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const audiences = await db.select().from(metaCustomAudiences).orderBy(metaCustomAudiences.createdAt);
    return audiences;
  }),

  // ── Create a new Custom Audience in Meta + track in DB ────────────────────
  createAudience: protectedProcedure
    .input(z.object({
      name: z.string().min(3),
      description: z.string().optional(),
      category: z.string().optional(), // e.g. "gut_health", "sleep", "all"
    }))
    .mutation(async ({ input }) => {
      const { adAccountId } = getMetaConfig();
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Create in Meta
      const result = await metaPost(`/act_${adAccountId}/customaudiences`, {
        name: input.name,
        description: input.description ?? `Urban Monk lead scraper audience — ${input.category ?? "all categories"}`,
        subtype: "CUSTOM",
        customer_file_source: "USER_PROVIDED_ONLY",
      }) as { id: string };

      // Track in DB
      await db.insert(metaCustomAudiences).values({
        metaAudienceId: result.id,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        emailCount: 0,
      });

      return { success: true, metaAudienceId: result.id, name: input.name };
    }),

  // ── Add emails to an audience (hashed, deduped) ───────────────────────────
  addEmails: protectedProcedure
    .input(z.object({
      audienceId: z.number(),           // DB id of the metaCustomAudiences row
      emails: z.array(z.string().email()),
      leadProspectIds: z.array(z.number()).optional(), // parallel array of lead IDs
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get the audience
      const [audience] = await db
        .select()
        .from(metaCustomAudiences)
        .where(eq(metaCustomAudiences.id, input.audienceId))
        .limit(1);
      if (!audience) throw new Error("Audience not found");

      // Dedup: skip emails already in this audience
      const existingHashes = await db
        .select({ emailHash: metaAudienceLeads.emailHash })
        .from(metaAudienceLeads)
        .where(eq(metaAudienceLeads.audienceId, input.audienceId));
      const existingHashSet = new Set(existingHashes.map((r) => r.emailHash));

      const newEmails = input.emails.filter((e) => !existingHashSet.has(hashEmail(e)));
      if (newEmails.length === 0) {
        return { success: true, added: 0, skipped: input.emails.length, message: "All emails already in audience" };
      }

      // Hash all new emails
      const hashedData = newEmails.map((e) => [hashEmail(e)]);

      // Push to Meta in batches of 1000
      const BATCH = 1000;
      let totalReceived = 0;
      for (let i = 0; i < hashedData.length; i += BATCH) {
        const batch = hashedData.slice(i, i + BATCH);
        const result = await metaPost(`/${audience.metaAudienceId}/users`, {
          payload: { schema: ["EMAIL_SHA256"], data: batch },
        }) as { num_received?: number };
        totalReceived += result.num_received ?? batch.length;
      }

      // Track in DB
      const rows = newEmails.map((email, idx) => ({
        audienceId: input.audienceId,
        leadProspectId: input.leadProspectIds?.[idx] ?? null,
        emailHash: hashEmail(email),
        emailRaw: email,
      }));
      await db.insert(metaAudienceLeads).values(rows);

      // Update count
      await db
        .update(metaCustomAudiences)
        .set({ emailCount: sql`${metaCustomAudiences.emailCount} + ${newEmails.length}` })
        .where(eq(metaCustomAudiences.id, input.audienceId));

      return {
        success: true,
        added: newEmails.length,
        skipped: input.emails.length - newEmails.length,
        metaReceived: totalReceived,
      };
    }),

  // ── Sync all found lead emails not yet in any audience ────────────────────
  syncLeadEmails: protectedProcedure
    .input(z.object({
      audienceId: z.number(),
      category: z.string().optional(), // filter leads by category
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get all lead emails already tracked in this audience
      const alreadyAdded = await db
        .select({ emailRaw: metaAudienceLeads.emailRaw })
        .from(metaAudienceLeads)
        .where(eq(metaAudienceLeads.audienceId, input.audienceId));
      const alreadySet = new Set(alreadyAdded.map((r) => r.emailRaw?.toLowerCase()));

      // Fetch leads with found emails
      const leads = await db
        .select({ id: leadProspects.id, emailFound: leadProspects.emailFound, category: leadProspects.category })
        .from(leadProspects)
        .where(isNotNull(leadProspects.emailFound));

      const filtered = leads.filter((l) => {
        if (!l.emailFound) return false;
        if (alreadySet.has(l.emailFound.toLowerCase())) return false;
        if (input.category && l.category !== input.category) return false;
        return true;
      });

      if (filtered.length === 0) {
        return { success: true, added: 0, message: "No new lead emails to sync" };
      }

      const emails = filtered.map((l) => l.emailFound!);
      const leadIds = filtered.map((l) => l.id);

      // Reuse addEmails logic inline
      const [audience] = await db
        .select()
        .from(metaCustomAudiences)
        .where(eq(metaCustomAudiences.id, input.audienceId))
        .limit(1);
      if (!audience) throw new Error("Audience not found");

      const hashedData = emails.map((e) => [hashEmail(e)]);
      const BATCH = 1000;
      let totalReceived = 0;
      for (let i = 0; i < hashedData.length; i += BATCH) {
        const batch = hashedData.slice(i, i + BATCH);
        const result = await metaPost(`/${audience.metaAudienceId}/users`, {
          payload: { schema: ["EMAIL_SHA256"], data: batch },
        }) as { num_received?: number };
        totalReceived += result.num_received ?? batch.length;
      }

      const rows = emails.map((email, idx) => ({
        audienceId: input.audienceId,
        leadProspectId: leadIds[idx],
        emailHash: hashEmail(email),
        emailRaw: email,
      }));
      await db.insert(metaAudienceLeads).values(rows);
      await db
        .update(metaCustomAudiences)
        .set({ emailCount: sql`${metaCustomAudiences.emailCount} + ${emails.length}` })
        .where(eq(metaCustomAudiences.id, input.audienceId));

      return { success: true, added: emails.length, metaReceived: totalReceived };
    }),

  // ── Create a Lookalike Audience from a seed Custom Audience ───────────────
  createLookalike: protectedProcedure
    .input(z.object({
      audienceId: z.number(),  // DB id of the seed audience
      ratio: z.number().min(0.01).max(0.20).default(0.01), // 1% = 0.01
      country: z.string().default("US"),
    }))
    .mutation(async ({ input }) => {
      const { adAccountId } = getMetaConfig();
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [audience] = await db
        .select()
        .from(metaCustomAudiences)
        .where(eq(metaCustomAudiences.id, input.audienceId))
        .limit(1);
      if (!audience) throw new Error("Audience not found");

      if (audience.emailCount < 100) {
        throw new Error(`Audience needs at least 100 emails to create a Lookalike (currently ${audience.emailCount})`);
      }

      const result = await metaPost(`/act_${adAccountId}/customaudiences`, {
        name: `LAL ${Math.round(input.ratio * 100)}% ${input.country} — ${audience.name}`,
        subtype: "LOOKALIKE",
        origin_audience_id: audience.metaAudienceId,
        lookalike_spec: JSON.stringify({
          ratio: input.ratio,
          country: input.country,
          type: "similarity",
        }),
      }) as { id: string };

      // Track the lookalike ID on the seed audience
      await db
        .update(metaCustomAudiences)
        .set({ lookalikeSeedId: result.id })
        .where(eq(metaCustomAudiences.id, input.audienceId));

      return { success: true, lookalikeId: result.id };
    }),

  // ── Get live stats from Meta for all tracked audiences ────────────────────
  getAudienceStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const audiences = await db.select().from(metaCustomAudiences);
    if (audiences.length === 0) return [];

    // Fetch live counts from Meta in parallel
    const stats = await Promise.allSettled(
      audiences.map(async (a) => {
        try {
          const data = await metaGet(`/${a.metaAudienceId}`, {
            fields: "id,name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status",
          }) as {
            approximate_count_lower_bound?: number;
            approximate_count_upper_bound?: number;
            delivery_status?: { code: number; description: string };
          };
          return {
            ...a,
            metaCountLower: data.approximate_count_lower_bound ?? 0,
            metaCountUpper: data.approximate_count_upper_bound ?? 0,
            deliveryStatus: data.delivery_status?.description ?? "Unknown",
          };
        } catch {
          return { ...a, metaCountLower: 0, metaCountUpper: 0, deliveryStatus: "Error fetching" };
        }
      })
    );

    return stats.map((s) => (s.status === "fulfilled" ? s.value : null)).filter(Boolean);
  }),
});
