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

// ── Reddit OAuth token cache ─────────────────────────────────────────────────
let _redditToken: string | null = null;
let _redditTokenExpiry = 0;

async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Return cached token if still valid (with 60s buffer)
  if (_redditToken && Date.now() < _redditTokenExpiry - 60_000) return _redditToken;

  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "UrbanMonkBot/1.0",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
    if (data.error || !data.access_token) return null;
    _redditToken = data.access_token;
    _redditTokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;
    return _redditToken;
  } catch {
    return null;
  }
}

async function searchReddit(
  subreddit: string,
  keywords: Array<{ keyword: string; category: string }>,
  limit: number
): Promise<InsertLeadProspect[]> {
  const token = await getRedditToken();
  if (!token) {
    // No OAuth credentials — return empty with a flag
    return [];
  }

  const results: InsertLeadProspect[] = [];
  for (const kw of keywords) {
    try {
      const url = `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(kw.keyword)}&restrict_sr=1&sort=new&limit=${limit}&t=week`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "UrbanMonkBot/1.0",
        },
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
          keywordsMatched: JSON.stringify([kw.keyword]),
          category: kw.category,
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
  keywords: Array<{ keyword: string; category: string }>,
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
        const matched = keywords.filter((kw) => commentText.toLowerCase().includes(kw.keyword.toLowerCase()));
        if (matched.length === 0) continue;
        // Use the category of the first matched keyword
        const primaryCategory = matched[0]?.category ?? "general";
        results.push({
          source: "youtube",
          sourceId: `yt_${comment.id}`,
          title: videoTitle,
          body: commentText.slice(0, 2000),
          category: primaryCategory,
          url: `https://www.youtube.com/watch?v=${videoId}&lc=${comment.id}`,
          author,
          subredditOrChannel: channelName,
          keywordsMatched: JSON.stringify(matched.map((m) => m.keyword)),
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

      // Check for Reddit OAuth credentials
      if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
        return {
          saved: 0,
          scanned: 0,
          message: "Reddit API credentials not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Settings → Secrets. Get them at reddit.com/prefs/apps (create a 'script' app).",
          needsCredentials: true,
        };
      }

      const kwList = keywords.map((k) => ({ keyword: k.keyword, category: k.category }));
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

    const kwList = keywords.map((k) => ({ keyword: k.keyword, category: k.category }));
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
      // All fields are now optional — we try with whatever we have
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      name: z.string().optional(),          // full name alternative
      domain: z.string().optional(),
      organizationName: z.string().optional(), // company name fallback
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

      // Build the Apollo payload with whatever we have
      const apolloPayload: Record<string, string | boolean> = {
        reveal_personal_emails: false,
      };
      if (input.firstName) apolloPayload.first_name = input.firstName;
      if (input.lastName) apolloPayload.last_name = input.lastName;
      if (input.name && !input.firstName) apolloPayload.name = input.name;
      if (input.domain) apolloPayload.domain = input.domain;
      if (input.organizationName && !input.domain) apolloPayload.organization_name = input.organizationName;

      try {
        const res = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apolloApiKey,
          },
          body: JSON.stringify(apolloPayload),
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
          // Update the lead record
          await db
            .update(leadProspects)
            .set({ emailFound: email, emailConfidence: confidence, status: "email_found" })
            .where(eq(leadProspects.id, input.prospectId));

          // Auto-push to matching Meta Custom Audience (fire-and-forget)
          try {
            const { metaCustomAudiences: mca, metaAudienceLeads: mal } = await import("../drizzle/schema");
            const { isNotNull: _isNotNull } = await import("drizzle-orm");
            // Get the lead's category
            const [lead] = await db
              .select({ category: leadProspects.category })
              .from(leadProspects)
              .where(eq(leadProspects.id, input.prospectId))
              .limit(1);
            const category = lead?.category ?? null;

            // Find matching audiences (category match OR "all" audiences)
            const allAudiences = await db.select().from(mca);
            const matchingAudiences = allAudiences.filter(
              (a) => !a.category || a.category === category
            );

            for (const audience of matchingAudiences) {
              // Check if email already in this audience
              const existing = await db
                .select({ id: mal.id })
                .from(mal)
                .where(eq(mal.audienceId, audience.id))
                .limit(1);
              // Simple dedup by emailRaw
              const alreadyIn = existing.length > 0;
              if (alreadyIn) continue;

              // Hash and push to Meta
              const crypto = await import("crypto");
              const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
              const token = process.env.META_AD_ACCESS_TOKEN;
              if (!token) continue;
              await fetch(`https://graph.facebook.com/v21.0/${audience.metaAudienceId}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  payload: { schema: ["EMAIL_SHA256"], data: [[emailHash]] },
                  access_token: token,
                }),
              });
              // Track in DB
              await db.insert(mal).values({
                audienceId: audience.id,
                leadProspectId: input.prospectId,
                emailHash,
                emailRaw: email,
              });
              await db
                .update(mca)
                .set({ emailCount: sql`${mca.emailCount} + 1` })
                .where(eq(mca.id, audience.id));
            }
          } catch (autoErr) {
            // Non-fatal: log but don't fail the findEmail response
            console.warn("[findEmail] Auto-audience push failed:", autoErr);
          }
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
      source: z.enum(["reddit", "youtube", "apollo", "all"]).default("all"),
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

      // Save to lead_prospects DB — ONLY save leads that have an email address
      const db = await getDb();
      if (db && people.length > 0) {
        for (const p of people) {
          if (!p.name) continue;
          if (!p.email) continue; // email-only policy — no email = not useful
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

  // Apollo daily draw stats — total, email reveal rate, per-day breakdown
  getDailyStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const totalRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadProspects)
      .where(eq(leadProspects.source, "apollo"));
    const total = Number(totalRows[0]?.count ?? 0);
    const emailRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadProspects)
      .where(and(
        eq(leadProspects.source, "apollo"),
        sql`emailFound IS NOT NULL AND emailFound != ''`
      ));
    const emailFound = Number(emailRows[0]?.count ?? 0);
    const metaRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadProspects)
      .where(and(
        eq(leadProspects.source, "apollo"),
        eq(leadProspects.status, "converted")
      ));
    const metaPushed = Number(metaRows[0]?.count ?? 0);
    const dailyRows = await db
      .select({
        day: sql<string>`DATE(FROM_UNIXTIME(lp_createdAt / 1000))`,
        count: sql<number>`count(*)`,
        emailsFound: sql<number>`SUM(CASE WHEN emailFound IS NOT NULL AND emailFound != '' THEN 1 ELSE 0 END)`,
      })
      .from(leadProspects)
      .where(and(
        eq(leadProspects.source, "apollo"),
        sql`lp_createdAt >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 14 DAY)) * 1000`
      ))
      .groupBy(sql`DATE(FROM_UNIXTIME(lp_createdAt / 1000))`)
      .orderBy(sql`DATE(FROM_UNIXTIME(lp_createdAt / 1000)) DESC`);
    const categoryRows = await db
      .select({
        category: leadProspects.category,
        count: sql<number>`count(*)`,
        emailsFound: sql<number>`SUM(CASE WHEN emailFound IS NOT NULL AND emailFound != '' THEN 1 ELSE 0 END)`,
      })
      .from(leadProspects)
      .where(eq(leadProspects.source, "apollo"))
      .groupBy(leadProspects.category)
      .orderBy(sql`count(*) DESC`);
    return {
      total,
      emailFound,
      metaPushed,
      emailRevealRate: total > 0 ? Math.round((emailFound / total) * 100) : 0,
      daily: dailyRows.map(r => ({ day: r.day, count: Number(r.count), emailsFound: Number(r.emailsFound) })),
      byCategory: categoryRows.map(r => ({ category: r.category ?? "unknown", count: Number(r.count), emailsFound: Number(r.emailsFound) })),
    };
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
        // If provided, use this tag. Otherwise derive from category.
        tagName: z.string().optional(),
        // Category from keyword match or persona — used to derive the tag
        category: z.string().optional(),
        // Source of the lead (reddit, youtube, apollo)
        source: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { kajabiOptIn } = await import("./kajabiApi");

      // Derive a specific Kajabi tag based on category and source
      const tag = input.tagName ?? deriveKajabiTag(input.category, input.source);

      const { contactId } = await kajabiOptIn({
        email: input.email,
        name: input.name,
        tagName: tag,
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

      return { success: true, contactId, tag };
    }),
});

// ─── Tag Derivation Helper ────────────────────────────────────────────────────

/**
 * Maps keyword category + lead source to a specific Kajabi tag.
 * This ensures gut/oral health leads are tagged differently from
 * personal development or longevity leads.
 */
export function deriveKajabiTag(category?: string, source?: string): string {
  const categoryTagMap: Record<string, string> = {
    gut_health:      "Lead - Gut Health",
    oral_health:     "Lead - Oral Health",
    supplements:     "Lead - Health & Wellness",
    health:          "Lead - Health & Wellness",
    stress:          "Lead - Personal Development",
    sleep:           "Lead - Personal Development",
    meditation:      "Lead - Personal Development",
    ancient_wisdom:  "Lead - Personal Development",
    longevity:       "Lead - Longevity",
    brand:           "Lead - Brand Aware",
    // Apollo persona categories
    wellness_coach:  "Lead - Personal Development",
    functional_med:  "Lead - Health & Wellness",
    nutritionist:    "Lead - Health & Wellness",
    biohacker:       "Lead - Longevity",
    burnout:         "Lead - Personal Development",
    meditation_teacher: "Lead - Personal Development",
    medical_doctor:  "Lead - Medical Professional",
    nurse:           "Lead - Medical Professional",
    dentist:         "Lead - Medical Professional",
  };

  if (category && categoryTagMap[category]) {
    return categoryTagMap[category];
  }

  // Fallback by source
  if (source === "reddit")  return "Lead - Reddit";
  if (source === "youtube") return "Lead - YouTube";
  if (source === "apollo")  return "Lead - Apollo Cold";

  return "Lead - Scrubber";
}
