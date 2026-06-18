/**
 * Lead Scrubber Router — 3-Tier Cold Lead Prospecting
 *
 * Tier 1: Reddit Intent Monitor — scan subreddits for keyword-matching posts
 * Tier 2: YouTube Comment Monitor — scan competitor channel comments for intent signals
 * Tier 3: Apollo.io Email Finder — find verified email by name + domain
 */

import { z } from "zod";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  leadProspects,
  leadKeywords,
  leadSubreddits,
  leadYtChannels,
  type InsertLeadProspect,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function searchReddit(
  subreddit: string,
  keywords: string[],
  limit: number
): Promise<InsertLeadProspect[]> {
  const results: InsertLeadProspect[] = [];
  for (const keyword of keywords) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&limit=${limit}&t=week`;
      const res = await fetch(url, {
        headers: { "User-Agent": "UrbanMonkContentHub/1.0 (research tool)" },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: { children?: Array<{ data: Record<string, unknown> }> };
      };
      const posts = data?.data?.children ?? [];
      for (const post of posts) {
        const p = post.data;
        const body = ((p.selftext as string) || (p.title as string) || "").slice(0, 2000);
        if (!body.trim()) continue;
        results.push({
          source: "reddit",
          sourceId: `reddit_${p.id as string}`,
          title: (p.title as string) || null,
          body,
          url: `https://www.reddit.com${p.permalink as string}`,
          author: (p.author as string) || null,
          subredditOrChannel: subreddit,
          keywordsMatched: JSON.stringify([keyword]),
          status: "new",
        });
      }
    } catch {
      // skip on error
    }
  }
  return results;
}

async function searchYouTubeComments(
  channelId: string,
  channelName: string,
  keywords: string[],
  apiKey: string
): Promise<InsertLeadProspect[]> {
  const results: InsertLeadProspect[] = [];
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=10&type=video`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return results;
    const searchData = (await searchRes.json()) as {
      items?: Array<{ id: { videoId: string }; snippet: { title: string } }>;
    };
    const videos = (searchData.items ?? []).slice(0, 5);

    for (const video of videos) {
      const videoId = video.id.videoId;
      const videoTitle = video.snippet.title;
      const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?key=${apiKey}&videoId=${videoId}&part=snippet&maxResults=100&order=relevance`;
      const commentsRes = await fetch(commentsUrl);
      if (!commentsRes.ok) continue;
      const commentsData = (await commentsRes.json()) as {
        items?: Array<{
          id: string;
          snippet: { topLevelComment: { snippet: { authorDisplayName: string; textDisplay: string } } };
        }>;
      };
      for (const comment of commentsData.items ?? []) {
        const commentText = comment.snippet.topLevelComment.snippet.textDisplay;
        const author = comment.snippet.topLevelComment.snippet.authorDisplayName;
        const matched = keywords.filter((kw) => commentText.toLowerCase().includes(kw.toLowerCase()));
        if (matched.length === 0) continue;
        results.push({
          source: "youtube",
          sourceId: `yt_${comment.id}`,
          title: videoTitle,
          body: commentText.slice(0, 2000),
          url: `https://www.youtube.com/watch?v=${videoId}&lc=${comment.id}`,
          author,
          subredditOrChannel: channelName,
          keywordsMatched: JSON.stringify(matched),
          status: "new",
        });
      }
    }
  } catch {
    // skip on error
  }
  return results;
}

async function saveLeads(leads: InsertLeadProspect[]): Promise<number> {
  if (leads.length === 0) return 0;
  const db = await getDb();
      if (!db) throw new Error("Database unavailable");
  let saved = 0;
  for (const lead of leads) {
    try {
      await db.insert(leadProspects).ignore().values(lead);
      saved++;
    } catch {
      // duplicate or error — skip
    }
  }
  return saved;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const leadScrubberRouter = router({

  // ── Config: Keywords ──────────────────────────────────────────────────────

  listKeywords: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(leadKeywords).orderBy(leadKeywords.category, leadKeywords.keyword);
  }),

  addKeyword: protectedProcedure
    .input(z.object({ keyword: z.string().min(2).max(128), category: z.string().max(64).default("general") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(leadKeywords).values({ keyword: input.keyword.toLowerCase().trim(), category: input.category });
      return { success: true };
    }),

  toggleKeyword: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(leadKeywords).set({ active: input.active }).where(eq(leadKeywords.id, input.id));
      return { success: true };
    }),

  deleteKeyword: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(leadKeywords).where(eq(leadKeywords.id, input.id));
      return { success: true };
    }),

  // ── Config: Subreddits ────────────────────────────────────────────────────

  listSubreddits: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(leadSubreddits).orderBy(leadSubreddits.subreddit);
  }),

  addSubreddit: protectedProcedure
    .input(z.object({ subreddit: z.string().min(2).max(128) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const clean = input.subreddit.replace(/^r\//, "").trim();
      await db.insert(leadSubreddits).values({ subreddit: clean });
      return { success: true };
    }),

  toggleSubreddit: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(leadSubreddits).set({ active: input.active }).where(eq(leadSubreddits.id, input.id));
      return { success: true };
    }),

  // ── Config: YouTube Channels ──────────────────────────────────────────────

  listYtChannels: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(leadYtChannels).orderBy(leadYtChannels.channelName);
  }),

  addYtChannel: protectedProcedure
    .input(z.object({ channelId: z.string().min(2).max(64), channelName: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(leadYtChannels).values({ channelId: input.channelId.trim(), channelName: input.channelName.trim() });
      return { success: true };
    }),

  toggleYtChannel: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(leadYtChannels).set({ active: input.active }).where(eq(leadYtChannels.id, input.id));
      return { success: true };
    }),

  // ── Tier 1: Reddit Scan ───────────────────────────────────────────────────

  scanReddit: protectedProcedure
    .input(z.object({ limit: z.number().min(5).max(50).default(25) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [keywords, subreddits] = await Promise.all([
        db.select().from(leadKeywords).where(eq(leadKeywords.active, true)),
        db.select().from(leadSubreddits).where(eq(leadSubreddits.active, true)),
      ]);

      if (keywords.length === 0 || subreddits.length === 0) {
        return { saved: 0, scanned: 0, message: "No active keywords or subreddits configured." };
      }

      const kwList = keywords.map((k) => k.keyword);
      let allLeads: InsertLeadProspect[] = [];

      for (const sub of subreddits) {
        const leads = await searchReddit(sub.subreddit, kwList, input.limit);
        allLeads = allLeads.concat(leads);
      }

      const saved = await saveLeads(allLeads);
      return { saved, scanned: allLeads.length, message: `Scanned ${allLeads.length} posts, saved ${saved} new leads.` };
    }),

  // ── Tier 2: YouTube Comment Scan ─────────────────────────────────────────

  scanYouTube: protectedProcedure.mutation(async () => {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY || "";

    if (!apiKey) {
      return {
        saved: 0,
        scanned: 0,
        message: "YouTube Data API key not configured. Add YOUTUBE_DATA_API_KEY to secrets.",
      };
    }

    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const [keywords, channels] = await Promise.all([
      db.select().from(leadKeywords).where(eq(leadKeywords.active, true)),
      db.select().from(leadYtChannels).where(eq(leadYtChannels.active, true)),
    ]);

    if (keywords.length === 0 || channels.length === 0) {
      return { saved: 0, scanned: 0, message: "No active keywords or channels configured." };
    }

    const kwList = keywords.map((k) => k.keyword);
    let allLeads: InsertLeadProspect[] = [];

    for (const channel of channels) {
      const leads = await searchYouTubeComments(channel.channelId, channel.channelName, kwList, apiKey);
      allLeads = allLeads.concat(leads);
    }

    const saved = await saveLeads(allLeads);
    return { saved, scanned: allLeads.length, message: `Scanned ${allLeads.length} comments, saved ${saved} new leads.` };
  }),

  // ── Tier 3: Apollo Email Finder ───────────────────────────────────────────

  findEmail: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      domain: z.string().min(3),
      prospectId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const apolloApiKey = process.env.APOLLO_API_KEY || "";

      if (!apolloApiKey) {
        return {
          success: false,
          email: null,
          confidence: null,
          message: "Apollo API key not configured. Add APOLLO_API_KEY to secrets.",
        };
      }

      try {
        const res = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apolloApiKey,
          },
          body: JSON.stringify({
            first_name: input.firstName,
            last_name: input.lastName,
            domain: input.domain,
            reveal_personal_emails: false,
          }),
        });

        if (!res.ok) {
          return { success: false, email: null, confidence: null, message: `Apollo API error: ${res.status}` };
        }

        const data = (await res.json()) as {
          person?: { email?: string; email_status?: string };
        };

        const email = data?.person?.email ?? null;
        const confidence = data?.person?.email_status ?? null;

        if (email && input.prospectId) {
          const db = await getDb();
      if (!db) throw new Error("Database unavailable");
          await db
            .update(leadProspects)
            .set({ emailFound: email, emailConfidence: confidence, status: "email_found" })
            .where(eq(leadProspects.id, input.prospectId));
        }

        return {
          success: !!email,
          email,
          confidence,
          message: email ? `Found: ${email} (${confidence})` : "No email found for this person.",
        };
      } catch {
        return { success: false, email: null, confidence: null, message: "Apollo lookup failed." };
      }
    }),

  // ── Lead Management ───────────────────────────────────────────────────────

  listLeads: protectedProcedure
    .input(z.object({
      source: z.enum(["reddit", "youtube", "all"]).default("all"),
      status: z.enum(["new", "engaged", "email_found", "converted", "archived", "active"]).default("active"),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(5).max(100).default(25),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const offset = (input.page - 1) * input.pageSize;

      const conditions = [];
      if (input.source !== "all") {
        conditions.push(eq(leadProspects.source, input.source));
      }
      if (input.status === "active") {
        conditions.push(isNull(leadProspects.archivedAt));
      } else {
        conditions.push(eq(leadProspects.status, input.status));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(leadProspects)
          .where(where)
          .orderBy(desc(leadProspects.createdAt as any))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(leadProspects)
          .where(where),
      ]);

      return {
        leads: rows,
        total: Number(countRows[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  updateLeadStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "engaged", "email_found", "converted", "archived"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const update: Record<string, unknown> = { status: input.status };
      if (input.status === "engaged") update.engagedAt = Date.now();
      if (input.status === "archived") update.archivedAt = Date.now();
      await db.update(leadProspects).set(update).where(eq(leadProspects.id, input.id));
      return { success: true };
    }),

  addNote: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string().max(2000) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(leadProspects).set({ notes: input.notes }).where(eq(leadProspects.id, input.id));
      return { success: true };
    }),

  archiveLead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(leadProspects)
        .set({ status: "archived", archivedAt: Date.now() })
        .where(eq(leadProspects.id, input.id));
      return { success: true };
    }),

  restoreLead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(leadProspects)
        .set({ status: "new", archivedAt: null })
        .where(eq(leadProspects.id, input.id));
      return { success: true };
    }),

  // ─── Tier 3b: Apollo Cold Lead Search ────────────────────────────────────
  apolloSearchLeads: protectedProcedure
    .input(
      z.object({
        titles: z.array(z.string()).optional(),       // e.g. ["wellness coach", "health coach"]
        keywords: z.array(z.string()).optional(),     // keyword filters
        industries: z.array(z.string()).optional(),  // e.g. ["health, wellness and fitness"]
        locations: z.array(z.string()).optional(),   // e.g. ["United States"]
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(25).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const apolloApiKey = process.env.APOLLO_API_KEY || "";
      if (!apolloApiKey) {
        return { success: false, people: [], total: 0, message: "Apollo API key not configured." };
      }

      const body: Record<string, unknown> = {
        page: input.page,
        per_page: input.perPage,
      };
      if (input.titles?.length)     body.person_titles = input.titles;
      if (input.keywords?.length)   body.q_keywords = input.keywords.join(" ");
      if (input.industries?.length) body.organization_industry_tag_ids = input.industries;
      if (input.locations?.length)  body.person_locations = input.locations;

      const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apolloApiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, people: [], total: 0, message: `Apollo API error ${res.status}: ${errText.slice(0, 200)}` };
      }

      const data = (await res.json()) as {
        people?: Array<{
          id?: string;
          name?: string;
          first_name?: string;
          last_name?: string;
          title?: string;
          email?: string;
          email_status?: string;
          linkedin_url?: string;
          organization?: { name?: string; website_url?: string };
          city?: string;
          state?: string;
          country?: string;
        }>;
        pagination?: { total_entries?: number };
        error?: string;
      };

      if (data.error) {
        return { success: false, people: [], total: 0, message: data.error };
      }

      const people = (data.people ?? []).map((p) => ({
        id: p.id ?? "",
        name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        title: p.title ?? "",
        email: p.email ?? null,
        emailStatus: p.email_status ?? null,
        linkedinUrl: p.linkedin_url ?? null,
        company: p.organization?.name ?? null,
        domain: p.organization?.website_url?.replace(/^https?:\/\//, "").split("/")[0] ?? null,
        location: [p.city, p.state, p.country].filter(Boolean).join(", "),
      }));

      // Save to lead_prospects DB so they appear in the main queue
      const db = await getDb();
      if (db && people.length > 0) {
        for (const p of people) {
          if (!p.name) continue;
          try {
            await db
              .insert(leadProspects)
              .ignore()
              .values({
                source: "apollo",
                sourceId: `apollo_${p.id || p.name.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`,
                title: p.title || null,
                body: `${p.name} — ${p.title || ""} at ${p.company || "unknown company"}. Location: ${p.location || "unknown"}.`,
                url: p.linkedinUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(p.name)}`,
                author: p.name,
                subredditOrChannel: p.company || null,
                keywordsMatched: JSON.stringify(input.titles ?? input.keywords ?? []),
                emailFound: p.email || null,
                emailConfidence: p.emailStatus || null,
                status: p.email ? "email_found" : "new",
              });
          } catch {
            // ignore duplicate sourceId
          }
        }
      }

      return {
        success: true,
        people,
        total: data.pagination?.total_entries ?? people.length,
        message: `Found ${people.length} leads (${data.pagination?.total_entries ?? "?"} total matching).`,
      };
    }),

  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const rows = await db
      .select({
        status: leadProspects.status,
        source: leadProspects.source,
        count: sql<number>`count(*)`,
      })
      .from(leadProspects)
      .groupBy(leadProspects.status, leadProspects.source);
    return rows;
  }),

  /**
   * Push a lead to Kajabi as a tagged contact.
   * Works for any lead source (Reddit, YouTube, Apollo, manual).
   * If leadId is provided, marks the lead as converted in the DB.
   * The tag defaults to "Lead Scrubber" so all pushed leads are
   * segmentable in Kajabi without extra setup.
   */
  pushToKajabi: protectedProcedure
    .input(
      z.object({
        leadId: z.number().optional(),
        email: z.string().email(),
        name: z.string().optional(),
        tagName: z.string().default("Lead Scrubber"),
      })
    )
    .mutation(async ({ input }) => {
      const { kajabiOptIn } = await import("./kajabiApi");

      const { contactId } = await kajabiOptIn({
        email: input.email,
        name: input.name,
        tagName: input.tagName,
      });

      if (input.leadId) {
        const db = await getDb();
        if (db) {
          await db
            .update(leadProspects)
            .set({ status: "converted" })
            .where(eq(leadProspects.id, input.leadId));
        }
      }

      return { success: true, contactId };
    }),
});
