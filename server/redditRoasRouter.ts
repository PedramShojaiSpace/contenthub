/**
 * Reddit ROAS Attribution Router
 *
 * Tracks Reddit campaigns (RedRover or in-house VA), individual posts,
 * and Shopify order conversions attributed to Reddit traffic via UTM parameters.
 *
 * Attribution flow:
 * 1. Create a campaign (RedRover or VA) with monthly spend
 * 2. For each Reddit post, generate a UTM-tagged destination URL
 * 3. When a Shopify order comes in with utm_source=reddit, the Shopify webhook
 *    (shared with attributionRouter) records it here
 * 4. Dashboard shows per-campaign and per-post ROAS in real time
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { redditCampaigns, redditLinks, redditConversions } from "../drizzle/schema";
import { eq, desc, and, sql, sum, count, gte, lte } from "drizzle-orm";

// ─── UTM Link Builder ─────────────────────────────────────────────────────────

function buildUtmUrl(
  destinationBase: string,
  params: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign: string;
    utmContent?: string;
    utmTerm?: string;
  }
): string {
  const url = new URL(destinationBase);
  url.searchParams.set("utm_source", params.utmSource || "reddit");
  url.searchParams.set("utm_medium", params.utmMedium || "organic");
  url.searchParams.set("utm_campaign", params.utmCampaign);
  if (params.utmContent) url.searchParams.set("utm_content", params.utmContent);
  if (params.utmTerm) url.searchParams.set("utm_term", params.utmTerm);
  return url.toString();
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const redditRoasRouter = router({

  // ── Campaigns ──────────────────────────────────────────────────────────────

  listCampaigns: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const campaigns = await db
      .select()
      .from(redditCampaigns)
      .orderBy(desc(redditCampaigns.createdAt));
    return campaigns;
  }),

  createCampaign: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      source: z.enum(["redrover", "va", "pedram"]),
      skuLabel: z.string().optional(),
      shopifyProductId: z.string().optional(),
      monthlySpendCents: z.number().int().min(0).default(0),
      utmCampaign: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, hyphens, underscores only"),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(redditCampaigns).values({
        name: input.name,
        source: input.source,
        skuLabel: input.skuLabel || null,
        shopifyProductId: input.shopifyProductId || null,
        monthlySpendCents: input.monthlySpendCents,
        utmCampaign: input.utmCampaign,
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        active: true,
        notes: input.notes || null,
      });
      return { id: (result as any).insertId };
    }),

  updateCampaign: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      monthlySpendCents: z.number().int().min(0).optional(),
      active: z.boolean().optional(),
      notes: z.string().optional(),
      endDate: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updates } = input;
      await db.update(redditCampaigns).set(updates).where(eq(redditCampaigns.id, id));
      return { ok: true };
    }),

  deleteCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(redditCampaigns).where(eq(redditCampaigns.id, input.id));
      return { ok: true };
    }),

  // ── Links (individual posts) ────────────────────────────────────────────────

  listLinks: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = input.campaignId
        ? await db.select().from(redditLinks).where(eq(redditLinks.campaignId, input.campaignId)).orderBy(desc(redditLinks.createdAt))
        : await db.select().from(redditLinks).orderBy(desc(redditLinks.createdAt));
      return rows;
    }),

  generateLink: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      destinationBase: z.string().url("Must be a valid URL"),
      subreddit: z.string().optional(),
      postType: z.enum(["question", "comment", "direct_post"]).default("direct_post"),
      postedBy: z.string().optional(),
      utmContent: z.string().optional(),
      utmTerm: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Fetch campaign to get utmCampaign slug
      const [campaign] = await db
        .select()
        .from(redditCampaigns)
        .where(eq(redditCampaigns.id, input.campaignId))
        .limit(1);
      if (!campaign) throw new Error("Campaign not found");

      // Auto-generate utmContent from subreddit + timestamp if not provided
      const utmContent = input.utmContent ||
        `${(input.subreddit || "reddit").replace(/^r\//, "").toLowerCase()}-${Date.now()}`;

      const destinationUrl = buildUtmUrl(input.destinationBase, {
        utmCampaign: campaign.utmCampaign,
        utmContent,
        utmTerm: input.utmTerm,
      });

      const [result] = await db.insert(redditLinks).values({
        campaignId: input.campaignId,
        subreddit: input.subreddit || null,
        destinationUrl,
        utmSource: "reddit",
        utmMedium: "organic",
        utmCampaign: campaign.utmCampaign,
        utmContent,
        utmTerm: input.utmTerm || null,
        postType: input.postType,
        postedBy: input.postedBy || null,
        revenueAttributedCents: 0,
        conversionCount: 0,
      });

      return { id: (result as any).insertId, destinationUrl, utmContent };
    }),

  updateLink: protectedProcedure
    .input(z.object({
      id: z.number(),
      redditPostUrl: z.string().url().optional(),
      postedAt: z.number().optional(),
      upvotes: z.number().int().min(0).optional(),
      comments: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updates } = input;
      await db.update(redditLinks).set(updates).where(eq(redditLinks.id, id));
      return { ok: true };
    }),

  deleteLink: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(redditLinks).where(eq(redditLinks.id, input.id));
      return { ok: true };
    }),

  // ── Manual conversion recording (for RedRover-reported conversions) ─────────

  recordManualConversion: protectedProcedure
    .input(z.object({
      linkId: z.number(),
      campaignId: z.number(),
      shopifyOrderId: z.string(),
      shopifyOrderNumber: z.string().optional(),
      orderTotalCents: z.number().int().min(0),
      customerEmail: z.string().email().optional(),
      utmContent: z.string().optional(),
      orderCreatedAt: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Dedup check
      const existing = await db
        .select({ id: redditConversions.id })
        .from(redditConversions)
        .where(eq(redditConversions.shopifyOrderId, input.shopifyOrderId))
        .limit(1);
      if (existing.length > 0) return { status: "duplicate" };

      await db.insert(redditConversions).values({
        linkId: input.linkId,
        campaignId: input.campaignId,
        shopifyOrderId: input.shopifyOrderId,
        shopifyOrderNumber: input.shopifyOrderNumber || null,
        orderTotalCents: input.orderTotalCents,
        currency: "USD",
        customerEmail: input.customerEmail || null,
        utmSource: "reddit",
        utmMedium: "organic",
        utmCampaign: undefined,
        utmContent: input.utmContent || null,
        attributionType: "manual",
        orderCreatedAt: input.orderCreatedAt || Date.now(),
        receivedAt: Date.now(),
      });

      // Update link revenue + conversion count
      await db
        .update(redditLinks)
        .set({
          revenueAttributedCents: sql`revenueAttributedCents + ${input.orderTotalCents}`,
          conversionCount: sql`conversionCount + 1`,
        })
        .where(eq(redditLinks.id, input.linkId));

      return { status: "ok" };
    }),

  // ── ROAS Dashboard ──────────────────────────────────────────────────────────

  getDashboard: protectedProcedure
    .input(z.object({
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // All campaigns with aggregated stats
      const campaigns = await db.select().from(redditCampaigns).orderBy(desc(redditCampaigns.createdAt));

      // All conversions (optionally filtered by date)
      const conversionsQuery = db.select().from(redditConversions);
      const allConversions = await conversionsQuery.orderBy(desc(redditConversions.orderCreatedAt));

      // All links
      const allLinks = await db.select().from(redditLinks).orderBy(desc(redditLinks.createdAt));

      // Build per-campaign ROAS
      const campaignStats = campaigns.map(campaign => {
        const campaignLinks = allLinks.filter(l => l.campaignId === campaign.id);
        const campaignConversions = allConversions.filter(c => c.campaignId === campaign.id);

        const totalRevenueCents = campaignConversions.reduce((sum, c) => sum + c.orderTotalCents, 0);
        const totalConversions = campaignConversions.length;
        const totalPosts = campaignLinks.length;

        // ROAS = Revenue / Spend (both in dollars)
        const spendDollars = (campaign.monthlySpendCents || 0) / 100;
        const revenueDollars = totalRevenueCents / 100;
        const roas = spendDollars > 0 ? revenueDollars / spendDollars : null;

        // Best performing post
        const bestLink = campaignLinks.reduce((best, link) => {
          if (!best || (link.revenueAttributedCents ?? 0) > (best.revenueAttributedCents ?? 0)) return link;
          return best;
        }, null as typeof allLinks[0] | null);

        return {
          campaign,
          totalRevenueCents,
          totalConversions,
          totalPosts,
          spendDollars,
          revenueDollars,
          roas,
          bestLink,
          recentConversions: campaignConversions.slice(0, 5),
        };
      });

      // Overall totals
      const totalRevenueCents = allConversions.reduce((s, c) => s + c.orderTotalCents, 0);
      const totalSpendCents = campaigns.reduce((s, c) => s + (c.monthlySpendCents || 0), 0);
      const overallRoas = totalSpendCents > 0 ? (totalRevenueCents / totalSpendCents) : null;

      // Revenue by subreddit
      const subredditRevenue: Record<string, number> = {};
      for (const link of allLinks) {
        const sub = link.subreddit || "unknown";
        subredditRevenue[sub] = (subredditRevenue[sub] || 0) + (link.revenueAttributedCents || 0);
      }
      const topSubreddits = Object.entries(subredditRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([subreddit, revenueCents]) => ({ subreddit, revenueCents }));

      // Recent conversions across all campaigns
      const recentConversions = allConversions.slice(0, 20);

      return {
        campaignStats,
        overallRoas,
        totalRevenueCents,
        totalSpendCents,
        totalConversions: allConversions.length,
        totalPosts: allLinks.length,
        topSubreddits,
        recentConversions,
      };
    }),

  // ── Shopify webhook handler (called from Express, not tRPC) ─────────────────
  // This is exposed as a public procedure so the webhook can call it server-side
  // The actual Express endpoint is registered in server/_core/index.ts

  processShopifyOrder: publicProcedure
    .input(z.object({
      shopifyOrderId: z.string(),
      shopifyOrderNumber: z.string().optional(),
      orderTotalCents: z.number().int().min(0),
      currency: z.string().default("USD"),
      customerEmail: z.string().optional(),
      lineItems: z.string().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().optional(),
      orderCreatedAt: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Only process orders attributed to reddit
      if (!input.utmSource || input.utmSource.toLowerCase() !== "reddit") {
        return { status: "not_reddit", recorded: false };
      }

      const db = await getDb();
      if (!db) return { status: "db_unavailable", recorded: false };

      // Dedup
      const existing = await db
        .select({ id: redditConversions.id })
        .from(redditConversions)
        .where(eq(redditConversions.shopifyOrderId, input.shopifyOrderId))
        .limit(1);
      if (existing.length > 0) return { status: "duplicate", recorded: false };

      // Find the matching link by utmContent (most precise) or utmCampaign
      let matchedLink: typeof redditLinks.$inferSelect | null = null;
      let matchedCampaign: typeof redditCampaigns.$inferSelect | null = null;

      if (input.utmContent) {
        const [link] = await db
          .select()
          .from(redditLinks)
          .where(eq(redditLinks.utmContent, input.utmContent))
          .limit(1);
        if (link) {
          matchedLink = link;
          const [campaign] = await db
            .select()
            .from(redditCampaigns)
            .where(eq(redditCampaigns.id, link.campaignId))
            .limit(1);
          matchedCampaign = campaign || null;
        }
      }

      // Fallback: match by utmCampaign slug
      if (!matchedLink && input.utmCampaign) {
        const [campaign] = await db
          .select()
          .from(redditCampaigns)
          .where(eq(redditCampaigns.utmCampaign, input.utmCampaign))
          .limit(1);
        if (campaign) {
          matchedCampaign = campaign;
          // Use the most recent link for this campaign as the attributed post
          const [link] = await db
            .select()
            .from(redditLinks)
            .where(eq(redditLinks.campaignId, campaign.id))
            .orderBy(desc(redditLinks.createdAt))
            .limit(1);
          matchedLink = link || null;
        }
      }

      if (!matchedLink || !matchedCampaign) {
        // Record as unmatched reddit conversion for manual review
        console.log(`[reddit-roas] Unmatched Reddit order ${input.shopifyOrderId} — utm_campaign=${input.utmCampaign}, utm_content=${input.utmContent}`);
        return { status: "unmatched", recorded: false };
      }

      // Record conversion
      await db.insert(redditConversions).values({
        linkId: matchedLink.id,
        campaignId: matchedCampaign.id,
        shopifyOrderId: input.shopifyOrderId,
        shopifyOrderNumber: input.shopifyOrderNumber || null,
        orderTotalCents: input.orderTotalCents,
        currency: input.currency,
        customerEmail: input.customerEmail || null,
        lineItems: input.lineItems || null,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
        utmContent: input.utmContent || null,
        attributionType: input.utmContent ? "direct" : "probabilistic",
        orderCreatedAt: input.orderCreatedAt || Date.now(),
        receivedAt: Date.now(),
      });

      // Update link revenue + conversion count
      await db
        .update(redditLinks)
        .set({
          revenueAttributedCents: sql`revenueAttributedCents + ${input.orderTotalCents}`,
          conversionCount: sql`conversionCount + 1`,
        })
        .where(eq(redditLinks.id, matchedLink.id));

      console.log(`[reddit-roas] Attributed order ${input.shopifyOrderId} ($${(input.orderTotalCents / 100).toFixed(2)}) to campaign "${matchedCampaign.name}" / post ${matchedLink.id}`);
      return { status: "ok", recorded: true, campaignId: matchedCampaign.id, linkId: matchedLink.id };
    }),

  // ── Conversions list ────────────────────────────────────────────────────────

  listConversions: protectedProcedure
    .input(z.object({
      campaignId: z.number().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = input.campaignId
        ? await db.select().from(redditConversions)
            .where(eq(redditConversions.campaignId, input.campaignId))
            .orderBy(desc(redditConversions.orderCreatedAt))
            .limit(input.limit)
        : await db.select().from(redditConversions)
            .orderBy(desc(redditConversions.orderCreatedAt))
            .limit(input.limit);
      return rows;
    }),
});
