/**
 * Backlink Outreach Engine
 *
 * Phase 1 — Prospect Discovery:
 *   Uses DataForSEO SERP API to find sites ranking for target keywords,
 *   then scores and stores them as prospects for owner review.
 *
 * Phase 2 — Email Drafting:
 *   Uses LLM to generate personalized outreach emails for approved prospects.
 *   Tracks email status through the full pipeline.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import {
  backlinkProspects,
  backlinkEmails,
  type BacklinkProspect,
} from "../drizzle/schema";
import { eq, desc, and, inArray, not } from "drizzle-orm";
import { getAuthHeader } from "./dataForSeo";
import { getGmailAuthUrl, isGmailAuthorized, sendGmailOutreach } from "./gmail";


// ─── DataForSEO helpers ───────────────────────────────────────────────────────

const DFS_BASE = "https://api.dataforseo.com/v3";
const LOCATION_CODE = 2840; // United States
const LANGUAGE_CODE = "en";

// Domains to always exclude (your own domain + big authority sites that won't link)
const EXCLUDED_DOMAINS = new Set([
  "theurbanmonk.com",
  "urbanmonkacademy.com",
  "wikipedia.org",
  "amazon.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "reddit.com",
  "pinterest.com",
  "healthline.com",
  "webmd.com",
  "mayoclinic.org",
  "medicalnewstoday.com",
  "nih.gov",
  "cdc.gov",
]);

interface SerpOrganicItem {
  type: string;
  rank_group: number;
  domain: string;
  title: string;
  url: string;
  description?: string;
}

interface DomainMetrics {
  domain_rank?: number;
  organic_traffic?: number;
}

/**
 * Fetch top organic SERP results for a keyword (positions 1-20).
 * Returns an array of organic results with domain, title, url.
 */
async function getSerpResults(keyword: string, depth = 20): Promise<SerpOrganicItem[]> {
  const body = [
    {
      keyword,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      depth,
    },
  ];

  const raw = await fetch(`${DFS_BASE}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!raw.ok) return [];

  const json = (await raw.json()) as {
    tasks?: Array<{
      status_code: number;
      result?: Array<{
        items?: SerpOrganicItem[];
      }>;
    }>;
  };

  const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
  return items.filter((i) => i.type === "organic");
}

/**
 * Fetch domain authority (rank) and organic traffic estimate for a domain.
 * Uses DataForSEO Labs Domain Rank Overview.
 */
async function getDomainMetrics(domain: string): Promise<DomainMetrics> {
  try {
    const body = [{ target: domain, location_code: LOCATION_CODE, language_code: LANGUAGE_CODE }];
    const raw = await fetch(`${DFS_BASE}/dataforseo_labs/google/domain_rank_overview/live`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!raw.ok) return {};
    const json = (await raw.json()) as {
      tasks?: Array<{
        result?: Array<{
          metrics?: {
            organic?: { count?: number; etv?: number };
          };
          domain_rank?: number;
        }>;
      }>;
    };
    const result = json.tasks?.[0]?.result?.[0];
    return {
      domain_rank: result?.domain_rank,
      organic_traffic: result?.metrics?.organic?.etv,
    };
  } catch {
    return {};
  }
}

// ─── Email prompt templates ───────────────────────────────────────────────────

function buildGuestPostEmail(prospect: BacklinkProspect): { subject: string; systemPrompt: string; userPrompt: string } {
  return {
    subject: `Guest Post Idea for ${prospect.domain} — Dr. Pedram Shojai`,
    systemPrompt: `You are Dr. Pedram Shojai's outreach assistant. Write a warm, genuine, non-salesy guest post pitch email.
Rules:
- From: Dr. Pedram Shojai (OMD, NY Times bestselling author, founder of The Urban Monk)
- Tone: collegial, warm, peer-to-peer — not a cold sales pitch
- Length: 150-200 words maximum
- Reference their specific content naturally (use the page title provided)
- Pitch a specific guest article topic relevant to their audience and Pedram's expertise
- End with a simple, low-pressure ask
- No subject line in the body — return only the email body
- No placeholders like [YOUR NAME] — use "Dr. Pedram Shojai" or "Pedram"`,
    userPrompt: `Write a guest post pitch email to the editor/owner of ${prospect.domain}.

Their page: "${prospect.pageTitle || prospect.pageUrl}"
Topic relevance: ${prospect.topicRelevance || "health, wellness, mindfulness"}
Outreach type: Guest Post

Pedram's credentials to weave in naturally:
- Oriental Medicine Doctor (OMD)
- NY Times bestselling author (The Urban Monk, Rise and Shine, others)
- Host of The Urban Monk Podcast (millions of downloads)
- Founder of The Urban Monk Academy
- Expert in integrative medicine, Taoist philosophy, stress, sleep, gut health, longevity

Suggest a specific guest article topic that would serve their audience well.`,
  };
}

function buildResourcePageEmail(prospect: BacklinkProspect): { subject: string; systemPrompt: string; userPrompt: string } {
  return {
    subject: `Resource Suggestion for ${prospect.domain}`,
    systemPrompt: `You are Dr. Pedram Shojai's outreach assistant. Write a brief, friendly resource suggestion email.
Rules:
- Tone: helpful, collegial, not pushy
- Length: 100-150 words maximum
- Reference their specific resource page naturally
- Suggest theurbanmonk.com as a relevant addition
- No subject line in the body — return only the email body`,
    userPrompt: `Write a resource page link suggestion email to the owner of ${prospect.domain}.

Their resource page: "${prospect.pageTitle || prospect.pageUrl}"
Topic: ${prospect.topicRelevance || "health, wellness"}

Suggest adding theurbanmonk.com as a resource. Mention that Dr. Pedram Shojai (OMD, NY Times bestselling author) provides free evidence-based content on integrative health, stress, sleep, and longevity.`,
  };
}

function buildFollowUpEmail(
  prospect: BacklinkProspect,
  followUpNumber: 1 | 2,
  originalSubject: string
): { subject: string; systemPrompt: string; userPrompt: string } {
  return {
    subject: `Re: ${originalSubject}`,
    systemPrompt: `You are Dr. Pedram Shojai's outreach assistant. Write a brief, friendly follow-up email.
Rules:
- Tone: warm, understanding, not pushy
- Length: 60-80 words maximum — very brief
- Acknowledge they are busy
- Restate the value offer in one sentence
- Simple ask at the end
- No subject line in the body — return only the email body`,
    userPrompt: `Write follow-up #${followUpNumber} for an outreach email to ${prospect.domain}.
Original outreach type: ${prospect.outreachType}
Topic: ${prospect.topicRelevance || "health, wellness"}
This is a gentle nudge — keep it very short and warm.`,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const backlinkRouter = router({
  /**
   * Discover prospects by searching for sites ranking for a given keyword.
   * Fetches top 20 SERP results, filters out excluded domains and already-known
   * prospects, enriches with domain metrics, and stores as "discovered" status.
   */
  discoverProspects: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(2).max(200),
        outreachType: z.enum(["guest_post", "resource_page", "broken_link"]).default("guest_post"),
        depth: z.number().min(5).max(20).default(15),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // 1. Fetch SERP results
      const serpResults = await getSerpResults(input.keyword, input.depth);

      // 2. Filter out excluded domains
      const filtered = serpResults.filter(
        (r) => !EXCLUDED_DOMAINS.has(r.domain) && !EXCLUDED_DOMAINS.has(r.domain.replace(/^www\./, ""))
      );

      if (filtered.length === 0) {
        return { added: 0, skipped: 0, prospects: [] };
      }

      // 3. Check which domains are already in the database
      const domains = filtered.map((r) => r.domain);
      const existing = await db
        .select({ domain: backlinkProspects.domain })
        .from(backlinkProspects)
        .where(inArray(backlinkProspects.domain, domains));
      const existingDomains = new Set(existing.map((e) => e.domain));

      const newResults = filtered.filter((r) => !existingDomains.has(r.domain));
      const skipped = filtered.length - newResults.length;

      if (newResults.length === 0) {
        return { added: 0, skipped, prospects: [] };
      }

      // 4. Enrich top 10 new results with domain metrics (rate-limit friendly)
      const toEnrich = newResults.slice(0, 10);
      const enriched: Array<{
        result: SerpOrganicItem;
        metrics: DomainMetrics;
      }> = [];

      for (const r of toEnrich) {
        const metrics = await getDomainMetrics(r.domain);
        enriched.push({ result: r, metrics });
      }

      // 5. Insert new prospects
      const rows = enriched.map(({ result, metrics }) => ({
        domain: result.domain,
        pageUrl: result.url,
        pageTitle: result.title?.slice(0, 512) || null,
        domainAuthority: metrics.domain_rank ?? null,
        organicTraffic: metrics.organic_traffic ?? null,
        topicRelevance: input.keyword,
        discoveryKeyword: input.keyword,
        outreachType: input.outreachType,
        status: "discovered" as const,
      }));

      await db.insert(backlinkProspects).values(rows);

      const inserted = await db
        .select()
        .from(backlinkProspects)
        .where(inArray(backlinkProspects.domain, rows.map((r) => r.domain)))
        .orderBy(desc(backlinkProspects.discoveredAt))
        .limit(rows.length);

      return { added: rows.length, skipped, prospects: inserted };
    }),

  /**
   * List all prospects with optional status filter.
   */
  listProspects: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            "discovered",
            "approved",
            "rejected",
            "emailed",
            "followed_up",
            "followed_up_2",
            "responded",
            "won",
            "lost",
          ])
          .optional(),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const conditions = input.status
        ? [eq(backlinkProspects.status, input.status)]
        : [not(eq(backlinkProspects.status, "rejected"))];

      return db
        .select()
        .from(backlinkProspects)
        .where(and(...conditions))
        .orderBy(desc(backlinkProspects.discoveredAt))
        .limit(input.limit);
    }),

  /**
   * Approve a prospect — moves it to "approved" status.
   */
  approveProspect: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(backlinkProspects)
        .set({
          status: "approved",
          approvedAt: new Date(),
          ownerNotes: input.notes ?? null,
        })
        .where(eq(backlinkProspects.id, input.id));
      return { success: true };
    }),

  /**
   * Reject a prospect — moves it to "rejected" status.
   */
  rejectProspect: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(backlinkProspects)
        .set({
          status: "rejected",
          ownerNotes: input.notes ?? null,
        })
        .where(eq(backlinkProspects.id, input.id));
      return { success: true };
    }),

  /**
   * Update prospect contact info (email, name, contact page URL).
   */
  updateContact: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        contactEmail: z.string().email().optional(),
        contactName: z.string().optional(),
        contactPageUrl: z.string().url().optional(),
        outreachType: z.enum(["guest_post", "resource_page", "broken_link"]).optional(),
        ownerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...fields } = input;
      await db
        .update(backlinkProspects)
        .set(fields)
        .where(eq(backlinkProspects.id, id));
      return { success: true };
    }),

  /**
   * Draft an outreach email for an approved prospect using LLM.
   * Stores the draft in backlink_emails with status "draft".
   */
  draftEmail: protectedProcedure
    .input(
      z.object({
        prospectId: z.number(),
        emailType: z.enum(["initial", "follow_up_1", "follow_up_2"]).default("initial"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Load prospect
      const [prospect] = await db
        .select()
        .from(backlinkProspects)
        .where(eq(backlinkProspects.id, input.prospectId))
        .limit(1);

      if (!prospect) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });
      }

      // Build prompt based on email type and outreach type
      let promptConfig: { subject: string; systemPrompt: string; userPrompt: string };

      if (input.emailType === "initial") {
        promptConfig =
          prospect.outreachType === "resource_page"
            ? buildResourcePageEmail(prospect)
            : buildGuestPostEmail(prospect);
      } else {
        // For follow-ups, find the original email subject
        const [originalEmail] = await db
          .select({ subject: backlinkEmails.subject })
          .from(backlinkEmails)
          .where(
            and(
              eq(backlinkEmails.prospectId, input.prospectId),
              eq(backlinkEmails.emailType, "initial")
            )
          )
          .limit(1);

        const originalSubject = originalEmail?.subject ?? `Outreach from Dr. Pedram Shojai`;
        promptConfig = buildFollowUpEmail(
          prospect,
          input.emailType === "follow_up_1" ? 1 : 2,
          originalSubject
        );
      }

      // Generate email body via LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: promptConfig.systemPrompt },
          { role: "user", content: promptConfig.userPrompt },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const body = typeof rawContent === "string" ? rawContent.trim() : "";

      if (!body) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty email body" });
      }

      // Store draft
      const [inserted] = await db
        .insert(backlinkEmails)
        .values({
          prospectId: input.prospectId,
          emailType: input.emailType,
          subject: promptConfig.subject,
          body,
          status: "draft",
        })
        .$returningId();

      const [email] = await db
        .select()
        .from(backlinkEmails)
        .where(eq(backlinkEmails.id, inserted.id))
        .limit(1);

      return email;
    }),

  /**
   * List all emails for a prospect.
   */
  listEmails: protectedProcedure
    .input(z.object({ prospectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db
        .select()
        .from(backlinkEmails)
        .where(eq(backlinkEmails.prospectId, input.prospectId))
        .orderBy(desc(backlinkEmails.createdAt));
    }),

  /**
   * Update an email draft (subject, body, or status).
   */
  updateEmail: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        subject: z.string().optional(),
        body: z.string().optional(),
        status: z.enum(["draft", "approved", "sent", "bounced"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...fields } = input;
      await db.update(backlinkEmails).set(fields).where(eq(backlinkEmails.id, id));
      return { success: true };
    }),

  /**
   * Mark an email as sent and update the prospect status accordingly.
   */
  markEmailSent: protectedProcedure
    .input(z.object({ emailId: z.number(), prospectId: z.number(), emailType: z.enum(["initial", "follow_up_1", "follow_up_2", "custom"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = new Date();

      // Update email status
      await db
        .update(backlinkEmails)
        .set({ status: "sent", sentAt: now })
        .where(eq(backlinkEmails.id, input.emailId));

      // Update prospect status
      const newStatus =
        input.emailType === "initial"
          ? "emailed"
          : input.emailType === "follow_up_1"
          ? "followed_up"
          : "followed_up_2";

      const updateFields: Partial<typeof backlinkProspects.$inferInsert> = {
        status: newStatus as BacklinkProspect["status"],
        lastFollowUpAt: input.emailType !== "initial" ? now : undefined,
      };
      if (input.emailType === "initial") {
        updateFields.firstEmailSentAt = now;
      }

      await db
        .update(backlinkProspects)
        .set(updateFields)
        .where(eq(backlinkProspects.id, input.prospectId));

      return { success: true };
    }),

  /**
   * Update prospect status manually (e.g., mark as responded, won, lost).
   */
  updateProspectStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "discovered",
          "approved",
          "rejected",
          "emailed",
          "followed_up",
          "followed_up_2",
          "responded",
          "won",
          "lost",
        ]),
        placedLinkUrl: z.string().url().optional(),
        linkAnchorText: z.string().optional(),
        ownerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = new Date();
      const { id, status, ...rest } = input;

      const updateFields: Partial<typeof backlinkProspects.$inferInsert> = {
        status,
        ...rest,
      };

      if (status === "responded") updateFields.respondedAt = now;
      if (status === "won") {
        updateFields.wonAt = now;
        updateFields.linkLiveAt = now;
      }

      await db
        .update(backlinkProspects)
        .set(updateFields)
        .where(eq(backlinkProspects.id, id));

      return { success: true };
    }),

  /**
   * Bulk discover prospects from a predefined list of Urban Monk blog topic keywords.
   * Runs all keywords sequentially (to avoid rate-limiting), deduplicates by domain,
   * and returns a summary of how many new prospects were added.
   */
  bulkDiscoverProspects: protectedProcedure
    .input(
      z.object({
        keywords: z.array(z.string().min(2).max(200)).min(1).max(20),
        outreachType: z.enum(["guest_post", "resource_page", "broken_link"]).default("guest_post"),
        depth: z.number().min(5).max(20).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let totalAdded = 0;
      let totalSkipped = 0;
      const errors: string[] = [];

      for (const keyword of input.keywords) {
        try {
          // Fetch SERP results for this keyword
          const serpResults = await getSerpResults(keyword, input.depth);
          const filtered = serpResults.filter(
            (r) => !EXCLUDED_DOMAINS.has(r.domain) && !EXCLUDED_DOMAINS.has(r.domain.replace(/^www\./, ""))
          );

          if (filtered.length === 0) continue;

          // Check which domains are already in the database
          const domains = filtered.map((r) => r.domain);
          const existing = await db
            .select({ domain: backlinkProspects.domain })
            .from(backlinkProspects)
            .where(inArray(backlinkProspects.domain, domains));
          const existingDomains = new Set(existing.map((e) => e.domain));

          const newResults = filtered.filter((r) => !existingDomains.has(r.domain));
          totalSkipped += filtered.length - newResults.length;

          if (newResults.length === 0) continue;

          // Enrich top 5 per keyword (rate-limit friendly)
          const toEnrich = newResults.slice(0, 5);
          const rows: Array<typeof backlinkProspects.$inferInsert> = [];

          for (const r of toEnrich) {
            const metrics = await getDomainMetrics(r.domain);
            rows.push({
              domain: r.domain,
              pageUrl: r.url,
              pageTitle: r.title?.slice(0, 512) || null,
              domainAuthority: metrics.domain_rank ?? null,
              organicTraffic: metrics.organic_traffic ?? null,
              topicRelevance: keyword,
              discoveryKeyword: keyword,
              outreachType: input.outreachType,
              status: "discovered" as const,
            });
          }

          if (rows.length > 0) {
            await db.insert(backlinkProspects).values(rows);
            totalAdded += rows.length;
          }

          // Small delay between keywords to be respectful of rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (err) {
          errors.push(`${keyword}: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }

      return { totalAdded, totalSkipped, errors };
    }),

  /**
   * Check if a placed backlink is still live.
   * Fetches the target page and scans for a link to theurbanmonk.com.
   * Returns whether the link was found, the HTTP status, and a timestamp.
   */
  checkLinkLive: protectedProcedure
    .input(z.object({ prospectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [prospect] = await db
        .select()
        .from(backlinkProspects)
        .where(eq(backlinkProspects.id, input.prospectId))
        .limit(1);

      if (!prospect) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });
      }

      const urlToCheck = prospect.placedLinkUrl || prospect.pageUrl;

      let httpStatus = 0;
      let linkFound = false;
      let errorMsg: string | null = null;

      try {
        const response = await fetch(urlToCheck, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LinkChecker/1.0; +https://theurbanmonk.com)",
          },
          signal: AbortSignal.timeout(15000),
        });

        httpStatus = response.status;

        if (response.ok) {
          const html = await response.text();
          // Check for any link to theurbanmonk.com
          linkFound =
            html.includes("theurbanmonk.com") ||
            html.includes("urbanmonkacademy.com") ||
            html.includes("pedramshojai");
        }
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Fetch failed";
        httpStatus = 0;
      }

      // Update the prospect with the check result
      await db
        .update(backlinkProspects)
        .set({ linkLastCheckedAt: new Date(), linkIsLive: linkFound })
        .where(eq(backlinkProspects.id, input.prospectId));

      // If link was previously won but is now gone, notify owner
      if (prospect.status === "won" && !linkFound && !errorMsg) {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `⚠️ Backlink removed: ${prospect.domain}`,
          content: `The backlink from ${prospect.domain} (${urlToCheck}) no longer contains a link to theurbanmonk.com. HTTP status: ${httpStatus}. You may want to follow up.`,
        });
      }

      return { linkFound, httpStatus, errorMsg, checkedAt: new Date() };
    }),


  /**
   * Check if Gmail is authorized for Alyzza's account.
   */
  getGmailStatus: protectedProcedure.query(() => {
    return { authorized: isGmailAuthorized() };
  }),

  /**
   * Get the Gmail OAuth authorization URL for Alyzza to authorize.
   */
  getGmailAuthUrl: protectedProcedure.query(() => {
    try {
      const url = getGmailAuthUrl();
      return { url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: msg });
    }
  }),

  /**
   * Send an approved outreach email via Alyzza's Gmail account.
   * Updates the email status to "sent" and records the Gmail thread ID.
   */
  sendEmail: protectedProcedure
    .input(z.object({
      emailId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Load the email and its prospect
      const [email] = await db
        .select()
        .from(backlinkEmails)
        .where(eq(backlinkEmails.id, input.emailId));
      if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      if (email.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email must be approved before sending" });
      }

      const [prospect] = await db
        .select()
        .from(backlinkProspects)
        .where(eq(backlinkProspects.id, email.prospectId));
      if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });
      if (!prospect.contactEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Prospect has no contact email set" });
      }

      // Send via Gmail
      const result = await sendGmailOutreach({
        to: prospect.contactEmail,
        toName: prospect.contactName ?? undefined,
        subject: email.subject,
        body: email.body,
        threadId: email.gmailThreadId ?? undefined,
        inReplyToMessageId: email.gmailMessageId ?? undefined,
      });

      // Update email record
      await db.update(backlinkEmails)
        .set({
          status: "sent",
          sentAt: new Date(),
          gmailThreadId: result.threadId,
          gmailMessageId: result.messageId,
        })
        .where(eq(backlinkEmails.id, input.emailId));

      // Update prospect status
      const newStatus = email.emailType === "initial" ? "emailed" : "followed_up";
      const updateData: Partial<typeof backlinkProspects.$inferInsert> = {
        status: newStatus as typeof backlinkProspects.$inferSelect["status"],
      };
      if (email.emailType === "initial") {
        updateData.firstEmailSentAt = new Date();
      } else {
        updateData.lastFollowUpAt = new Date();
      }
      await db.update(backlinkProspects)
        .set(updateData)
        .where(eq(backlinkProspects.id, email.prospectId));

      return { success: true, messageId: result.messageId, threadId: result.threadId };
    }),

  /**
   * Draft and queue a follow-up email for a prospect that hasn't responded.
   * Called by the heartbeat job 7 days after the initial email.
   */
  draftFollowUp: protectedProcedure
    .input(z.object({
      prospectId: z.number(),
      followUpNumber: z.number().min(1).max(2).default(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [prospect] = await db
        .select()
        .from(backlinkProspects)
        .where(eq(backlinkProspects.id, input.prospectId));
      if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });

      // Get the original email for context
      const [originalEmail] = await db
        .select()
        .from(backlinkEmails)
        .where(and(
          eq(backlinkEmails.prospectId, input.prospectId),
          eq(backlinkEmails.emailType, "initial")
        ));

      const followUpType = input.followUpNumber === 1 ? "follow_up_1" : "follow_up_2";

      // Generate follow-up copy via LLM
      const prompt = `You are writing a brief, warm follow-up email for Dr. Pedram Shojai (The Urban Monk).

Context:
- Site we reached out to: ${prospect.domain}
- Page we referenced: ${prospect.pageTitle ?? prospect.pageUrl}
- Outreach type: ${prospect.outreachType === "guest_post" ? "Guest post offer" : "Resource page link request"}
- Follow-up number: ${input.followUpNumber} of 2
- Original email subject: ${originalEmail?.subject ?? "our previous message"}

Write a ${input.followUpNumber === 1 ? "gentle 3-sentence" : "final 2-sentence"} follow-up email.
- Follow-up 1: Friendly bump, assume they're busy, restate the value briefly
- Follow-up 2: Short final check-in, no pressure, leave the door open

Rules:
- NO structural labels (Hook:, CTA:, etc.)
- DO NOT use "I hope this email finds you well" or similar clichés
- Keep it under 100 words
- Sign off as Dr. Pedram Shojai

Return JSON: { "subject": "Re: [original subject]", "body": "..." }`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert email copywriter. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content;
      const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));

      // Save the follow-up draft
      const [inserted] = await db.insert(backlinkEmails).values({
        prospectId: input.prospectId,
        emailType: followUpType as "follow_up_1" | "follow_up_2",
        subject: parsed.subject ?? `Follow-up: ${originalEmail?.subject ?? "our collaboration"}`,
        body: parsed.body ?? "",
        status: "draft",
        gmailThreadId: originalEmail?.gmailThreadId ?? null,
        gmailMessageId: originalEmail?.gmailMessageId ?? null,
      }).$returningId();

      return { emailId: inserted.id, subject: parsed.subject, body: parsed.body };
    }),
  /**
   * Get summary stats for the outreach dashboard.
   */
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const all = await db.select({ status: backlinkProspects.status }).from(backlinkProspects);

    const counts: Record<string, number> = {};
    for (const row of all) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }

    return {
      total: all.length,
      discovered: counts["discovered"] ?? 0,
      approved: counts["approved"] ?? 0,
      rejected: counts["rejected"] ?? 0,
      emailed: counts["emailed"] ?? 0,
      followed_up: (counts["followed_up"] ?? 0) + (counts["followed_up_2"] ?? 0),
      responded: counts["responded"] ?? 0,
      won: counts["won"] ?? 0,
      lost: counts["lost"] ?? 0,
    };
  }),
});
