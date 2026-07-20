/**
 * Substack Inbox Router
 *
 * Polls Substack posts for new comments and replies, stores them in the
 * substack_inbox_items table, and exposes a VA workflow queue so the team
 * can respond without flooding Pedram's personal email.
 *
 * Substack has no official webhook API — we poll using the same unofficial
 * cookie-auth approach already used by substackPublisher.ts.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { substackInboxItems, contentItems } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { ENV } from "./_core/env";

// ─── Substack API helpers ─────────────────────────────────────────────────────

function getSubstackHeaders(): Record<string, string> {
  const cookie = ENV.substackSessionCookie;
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
  const headers = getSubstackHeaders();
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
});
