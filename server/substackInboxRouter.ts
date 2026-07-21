/**
 * Substack Inbox Router
 *
 * Polls Substack posts for new comments and replies, stores them in the
 * substack_inbox_items table, and exposes a VA workflow queue so the team
 * can respond without flooding Pedram's personal email.
 *
 * Substack has no official webhook API — we poll using the same unofficial
 * cookie-auth approach already used by substackPublisher.ts.
 *
 * Cookie storage: The session cookie is stored in the app_settings table
 * (key = "substack_session_cookie") so it can be updated at runtime without
 * requiring a deployment or Manus Secrets panel update. Falls back to
 * ENV.substackSessionCookie if no DB value is set.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { substackInboxItems, contentItems, appSettings } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { ENV } from "./_core/env";
// Note: substack-api's addComment is not yet implemented in v4.0.2
// We use direct HTTP fetch with the session cookie instead (same pattern as substackPublisher.ts)

// ─── Cookie DB key ────────────────────────────────────────────────────────────
const COOKIE_SETTING_KEY = "substack_session_cookie";

/**
 * Get the Substack session cookie, preferring the DB-stored value over ENV.
 * This allows the cookie to be updated at runtime via the Quick Refresh flow
 * without requiring a deployment or Manus Secrets panel update.
 */
export async function getSubstackCookieFromDb(): Promise<string> {
  try {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, COOKIE_SETTING_KEY))
        .limit(1);
      if (row?.value) {
        return row.value;
      }
    }
  } catch {
    // Fall through to ENV fallback
  }
  return ENV.substackSessionCookie ?? "";
}

// ─── Substack API helpers ─────────────────────────────────────────────────────

async function getSubstackHeaders(): Promise<Record<string, string>> {
  const cookie = await getSubstackCookieFromDb();
  if (!cookie) throw new Error("SUBSTACK_SESSION_COOKIE is not set.");
  const cookieHeader = cookie.startsWith("substack.sid=") ? cookie : `substack.sid=${cookie}`;
  const pubUrl = ENV.substackPublicationUrl ?? "https://drpedramshojai.substack.com";
  const pubHost = pubUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Origin: `https://${pubHost}`,
    Referer: `https://${pubHost}`,
    Cookie: cookieHeader,
  };
}

function getBaseUrl(): string {
  const pubUrl = ENV.substackPublicationUrl ?? "https://drpedramshojai.substack.com";
  const pubHost = pubUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${pubHost}`;
}

interface SubstackComment {
  id: number;
  body: string;
  name: string;
  email?: string;
  handle?: string;
  date: string;
  parent_id?: number;
  children?: SubstackComment[];
}

async function fetchCommentsForPost(postId: string): Promise<SubstackComment[]> {
  const baseUrl = getBaseUrl();
  const headers = await getSubstackHeaders();
  const res = await fetch(`${baseUrl}/api/v1/post/${postId}/comments?all_comments=true&sort=best_first`, { headers });
  if (!res.ok) {
    if (res.status === 404) return []; // post not found / no comments
    throw new Error(`Substack comments API returned ${res.status} for post ${postId}`);
  }
  const data = await res.json() as { comments?: SubstackComment[] };
  return data.comments ?? [];
}

// Flatten nested comment tree into a flat list with parent_id set on replies
function flattenComments(comments: SubstackComment[], parentId?: number): Array<SubstackComment & { resolvedParentId?: number }> {
  const result: Array<SubstackComment & { resolvedParentId?: number }> = [];
  for (const c of comments) {
    result.push({ ...c, resolvedParentId: parentId });
    if (c.children?.length) {
      result.push(...flattenComments(c.children, c.id));
    }
  }
  return result;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const substackInboxRouter = router({
  /**
   * Update the Substack session cookie stored in the DB.
   * This allows the cookie to be refreshed at runtime without a deployment.
   * The new value is stored in app_settings (key = "substack_session_cookie").
   */
  updateSubstackCookie: protectedProcedure
    .input(z.object({
      cookie: z.string().min(10, "Cookie value is too short"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Normalize: strip the "substack.sid=" prefix if present — store just the value
      const cookieValue = input.cookie.startsWith("substack.sid=")
        ? input.cookie.slice("substack.sid=".length)
        : input.cookie;

      // Upsert into app_settings
      const existing = await db
        .select({ id: appSettings.id })
        .from(appSettings)
        .where(eq(appSettings.key, COOKIE_SETTING_KEY))
        .limit(1);

      if (existing.length) {
        await db
          .update(appSettings)
          .set({ value: cookieValue })
          .where(eq(appSettings.key, COOKIE_SETTING_KEY));
      } else {
        await db
          .insert(appSettings)
          .values({ key: COOKIE_SETTING_KEY, value: cookieValue });
      }

      return { success: true };
    }),

  /**
   * Poll Substack for new comments across all published posts.
   * Deduplicates by substackCommentId so it's safe to run repeatedly.
   */
  pollComments: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all published content items that have a substackPostId
    const publishedPosts = await db
      .select({
        substackPostId: contentItems.substackPostId,
        substackPostUrl: contentItems.substackPostUrl,
        title: contentItems.title,
      })
      .from(contentItems)
      .where(
        and(
          sql`${contentItems.substackPostId} IS NOT NULL`,
          sql`${contentItems.substackPostId} != ''`
        )
      )
      .limit(50); // Poll the 50 most recent published posts

    if (!publishedPosts.length) {
      return { newComments: 0, postsPolled: 0 };
    }

    let newComments = 0;

    for (const post of publishedPosts) {
      if (!post.substackPostId) continue;
      try {
        const rawComments = await fetchCommentsForPost(post.substackPostId);
        const flat = flattenComments(rawComments);

        for (const comment of flat) {
          const commentId = String(comment.id);
          // Upsert — skip if already stored
          const existing = await db
            .select({ id: substackInboxItems.id })
            .from(substackInboxItems)
            .where(eq(substackInboxItems.substackCommentId, commentId))
            .limit(1);

          if (existing.length) continue;

          await db.insert(substackInboxItems).values({
            substackCommentId: commentId,
            substackPostId: post.substackPostId,
            substackPostUrl: post.substackPostUrl ?? null,
            postTitle: post.title ?? null,
            authorName: comment.name ?? null,
            authorEmail: comment.email ?? null,
            authorHandle: comment.handle ?? null,
            body: comment.body,
            isReply: !!comment.resolvedParentId,
            parentCommentId: comment.resolvedParentId ? String(comment.resolvedParentId) : null,
            status: "new",
            postedAt: comment.date ? new Date(comment.date).getTime() : null,
          });
          newComments++;
        }
      } catch (err) {
        // Log but don't fail the whole poll if one post errors
        console.error(`[SubstackInbox] Failed to poll post ${post.substackPostId}:`, err);
      }
    }

    return { newComments, postsPolled: publishedPosts.length };
  }),

  /**
   * List inbox items for the VA queue.
   */
  listItems: protectedProcedure
    .input(z.object({
      status: z.enum(["new", "in_progress", "responded", "archived", "all"]).default("new"),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const conditions = input.status === "all"
      ? []
      : [eq(substackInboxItems.status, input.status as "new" | "in_progress" | "responded" | "archived")];

    const items = await db
      .select()
        .from(substackInboxItems)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(substackInboxItems.postedAt))
        .limit(input.limit);

      return items;
    }),

  /**
   * Get counts for the badge display in the VA Dashboard.
   */
  getCounts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { new: 0, in_progress: 0, responded: 0, archived: 0 };

    const rows = await db
      .select({
        status: substackInboxItems.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(substackInboxItems)
      .groupBy(substackInboxItems.status);

    const counts: Record<string, number> = { new: 0, in_progress: 0, responded: 0, archived: 0 };
    for (const row of rows) {
      if (row.status) counts[row.status] = Number(row.count);
    }
    return counts;
  }),

  /**
   * Update the status of an inbox item (VA workflow).
   */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "in_progress", "responded", "archived"]),
      vaNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(substackInboxItems)
        .set({
          status: input.status,
          vaNote: input.vaNote ?? undefined,
          respondedAt: input.status === "responded" ? Date.now() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(substackInboxItems.id, input.id));
      return { success: true };
    }),

  /**
   * Save a VA note / draft response on an item.
   */
  saveNote: protectedProcedure
    .input(z.object({
      id: z.number(),
      vaNote: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(substackInboxItems)
        .set({
          vaNote: input.vaNote,
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(substackInboxItems.id, input.id));
      return { success: true };
    }),

  /**
   * Post a reply directly to a Substack comment from the VA Dashboard.
   * Uses Substack's unofficial internal API with the session cookie.
   * Posts as Dr. Pedram Shojai (the publication owner).
   *
   * Endpoint: POST https://{pub}.substack.com/api/v1/comments/{commentId}/children
   * Body: { body: string }
   */
  postReply: protectedProcedure
    .input(z.object({
      id: z.number(),           // substackInboxItems row id
      replyBody: z.string().min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch the inbox item to get the Substack comment ID
      const [item] = await db
        .select()
        .from(substackInboxItems)
        .where(eq(substackInboxItems.id, input.id))
        .limit(1);

      if (!item) throw new Error("Inbox item not found");
      if (!item.substackCommentId) throw new Error("No Substack comment ID on this item");

      const headers = await getSubstackHeaders();
      const baseUrl = getBaseUrl();

      // POST a reply to the comment using Substack's internal API
      // The endpoint accepts the parent comment ID as a path param
      const replyRes = await fetch(
        `${baseUrl}/api/v1/comments/${item.substackCommentId}/children`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ body: input.replyBody }),
        }
      );

      if (!replyRes.ok) {
        const errText = await replyRes.text().catch(() => "");
        if (replyRes.status === 401 || replyRes.status === 403) {
          throw new Error("Substack authentication failed — session cookie may have expired. Use the Quick Refresh button to update it.");
        }
        throw new Error(`Substack API returned ${replyRes.status}: ${errText.slice(0, 200)}`);
      }

      // Mark the item as responded and save the reply text as the VA note
      await db
        .update(substackInboxItems)
        .set({
          status: "responded",
          vaNote: input.replyBody,
          respondedAt: Date.now(),
          updatedAt: new Date(),
        })
        .where(eq(substackInboxItems.id, input.id));

      return { success: true };
    }),

  /**
   * Test Substack API connectivity (validates the session cookie).
   * Uses the same user info endpoint as substackPublisher.ts.
   * Reads cookie from DB first, falls back to ENV.
   */
  testConnection: protectedProcedure.query(async () => {
    const cookie = await getSubstackCookieFromDb();
    if (!cookie) return { connected: false, reason: "SUBSTACK_SESSION_COOKIE not set" };

    try {
      const headers = await getSubstackHeaders();
      const res = await fetch("https://substack.com/api/v1/user/login", {
        method: "GET",
        headers,
      });
      if (res.ok) {
        return { connected: true, reason: "OK" };
      }
      if (res.status === 401 || res.status === 403) {
        return { connected: false, reason: "Session cookie expired — use Quick Refresh to update it" };
      }
      return { connected: false, reason: `API returned ${res.status}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, reason: msg };
    }
  }),
});
