/**
 * Organic Signal Engine
 *
 * Monitors organic content across YouTube, Meta (Facebook Page), and LinkedIn.
 * Runs on a schedule (every 6 hours) to:
 *   1. Take engagement snapshots at 24h, 48h, 72h, 7d, and 14d post-publish
 *   2. Score each piece of content on engagement rate and velocity
 *   3. Flag strong performers as paid promotion candidates
 *
 * Thresholds for flagging:
 *   - "strong":      engagement rate ≥ 3% OR view velocity ≥ 200/day OR outlier score ≥ 1.5
 *   - "exceptional": engagement rate ≥ 6% OR view velocity ≥ 500/day OR outlier score ≥ 3.0
 *
 * Meta posts: engagement rate = (likes + comments + shares) / reach * 100
 * LinkedIn posts: engagement rate = (likes + comments + shares) / impressions * 100
 * TikTok: placeholder — wired up when TikTok API access is available
 */

import { getDb } from "./db";
import {
  videoJobs,
  videoEngagementSnapshots,
  paidPromoCandidates,
} from "../drizzle/schema";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import { getYTClient } from "./youtubeRouter";

// Snapshot checkpoints in hours after publish
const SNAPSHOT_HOURS = [24, 48, 72, 168, 336] as const;

// Engagement thresholds
const THRESHOLDS = {
  strong: { engagementRate: 3.0, viewVelocity: 200, outlierScore: 1.5 },
  exceptional: { engagementRate: 6.0, viewVelocity: 500, outlierScore: 3.0 },
};

// Meta post thresholds (lower because organic reach is more limited)
const META_THRESHOLDS = {
  strong: { engagementRate: 2.0, reachVelocity: 500 },
  exceptional: { engagementRate: 5.0, reachVelocity: 2000 },
};

// LinkedIn post thresholds
const LINKEDIN_THRESHOLDS = {
  strong: { engagementRate: 2.5, impressionVelocity: 300 },
  exceptional: { engagementRate: 6.0, impressionVelocity: 1000 },
};

// Minimum views/reach before we bother scoring
const MIN_VIEWS_TO_SCORE = 50;
const MIN_REACH_TO_SCORE = 100;

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function computeEngagementRate(views: number, likes: number, comments: number): number {
  if (views === 0) return 0;
  return Math.round(((likes + comments) / views) * 10000) / 100;
}

function computeViewVelocity(views: number, publishedAtMs: number): number {
  const daysSince = Math.max(1, (Date.now() - publishedAtMs) / 86400000);
  return Math.round(views / daysSince);
}

function computeOutlierScore(
  videoViews: number,
  channelTotalViews: number,
  channelVideoCount: number
): number {
  if (channelVideoCount === 0 || channelTotalViews === 0) return 0;
  const avg = channelTotalViews / channelVideoCount;
  return Math.round((videoViews / avg) * 100) / 100;
}

function classifySignalStrength(
  engagementRate: number,
  viewVelocity: number,
  outlierScore: number
): "strong" | "exceptional" | null {
  if (
    engagementRate >= THRESHOLDS.exceptional.engagementRate ||
    viewVelocity >= THRESHOLDS.exceptional.viewVelocity ||
    outlierScore >= THRESHOLDS.exceptional.outlierScore
  ) return "exceptional";
  if (
    engagementRate >= THRESHOLDS.strong.engagementRate ||
    viewVelocity >= THRESHOLDS.strong.viewVelocity ||
    outlierScore >= THRESHOLDS.strong.outlierScore
  ) return "strong";
  return null;
}

function classifyMetaSignal(
  engagementRate: number,
  reachVelocity: number
): "strong" | "exceptional" | null {
  if (
    engagementRate >= META_THRESHOLDS.exceptional.engagementRate ||
    reachVelocity >= META_THRESHOLDS.exceptional.reachVelocity
  ) return "exceptional";
  if (
    engagementRate >= META_THRESHOLDS.strong.engagementRate ||
    reachVelocity >= META_THRESHOLDS.strong.reachVelocity
  ) return "strong";
  return null;
}

function classifyLinkedInSignal(
  engagementRate: number,
  impressionVelocity: number
): "strong" | "exceptional" | null {
  if (
    engagementRate >= LINKEDIN_THRESHOLDS.exceptional.engagementRate ||
    impressionVelocity >= LINKEDIN_THRESHOLDS.exceptional.impressionVelocity
  ) return "exceptional";
  if (
    engagementRate >= LINKEDIN_THRESHOLDS.strong.engagementRate ||
    impressionVelocity >= LINKEDIN_THRESHOLDS.strong.impressionVelocity
  ) return "strong";
  return null;
}

// ─── Meta Page post scanner ───────────────────────────────────────────────────

interface MetaPostStats {
  id: string;
  message: string;
  createdTime: string;
  permalink: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  thumbnailUrl?: string;
}

async function fetchMetaPagePosts(limit = 25): Promise<MetaPostStats[]> {
  const token = process.env.META_AD_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) {
    console.warn("[OrganicSignal/Meta] META_AD_ACCESS_TOKEN or META_PAGE_ID not set — skipping Meta scan");
    return [];
  }

  try {
    // Fetch recent posts with insights
    const fields = "id,message,created_time,permalink_url,full_picture,insights.metric(post_impressions_unique,post_reactions_by_type_total,post_comments,post_shares)";
    const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.error) {
      console.error("[OrganicSignal/Meta] API error:", data.error.message);
      return [];
    }

    const posts: MetaPostStats[] = [];
    for (const post of (data.data ?? [])) {
      const insights = post.insights?.data ?? [];
      const reach = insights.find((i: any) => i.name === "post_impressions_unique")?.values?.[0]?.value ?? 0;
      const reactions = insights.find((i: any) => i.name === "post_reactions_by_type_total")?.values?.[0]?.value ?? {};
      const likes = Object.values(reactions as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
      const comments = insights.find((i: any) => i.name === "post_comments")?.values?.[0]?.value ?? 0;
      const shares = insights.find((i: any) => i.name === "post_shares")?.values?.[0]?.value ?? 0;

      posts.push({
        id: post.id,
        message: (post.message ?? "").slice(0, 512),
        createdTime: post.created_time,
        permalink: post.permalink_url ?? `https://www.facebook.com/${post.id}`,
        reach,
        likes,
        comments,
        shares,
        thumbnailUrl: post.full_picture,
      });
    }
    return posts;
  } catch (err) {
    console.error("[OrganicSignal/Meta] Failed to fetch posts:", err);
    return [];
  }
}

// ─── LinkedIn post scanner ────────────────────────────────────────────────────

interface LinkedInPostStats {
  id: string;
  text: string;
  publishedAt: number; // ms
  permalink: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  thumbnailUrl?: string;
}

async function fetchLinkedInPosts(limit = 20): Promise<LinkedInPostStats[]> {
  // LinkedIn requires OAuth with r_organization_social + r_organization_admin scopes
  // and a URN for the organization. We check for the access token here.
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORG_ID; // e.g. "urn:li:organization:12345678"

  if (!token || !orgId) {
    console.info("[OrganicSignal/LinkedIn] LINKEDIN_ACCESS_TOKEN or LINKEDIN_ORG_ID not set — skipping LinkedIn scan");
    return [];
  }

  try {
    // Fetch organization posts
    const postsUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(orgId)})&count=${limit}`;
    const postsRes = await fetch(postsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    const postsData = await postsRes.json() as any;

    if (postsData.status === 401 || postsData.status === 403) {
      console.warn("[OrganicSignal/LinkedIn] Auth error — check LINKEDIN_ACCESS_TOKEN scopes");
      return [];
    }

    const posts: LinkedInPostStats[] = [];
    for (const post of (postsData.elements ?? [])) {
      const postId = post.id;
      const text = post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text ?? "";
      const publishedAt = post.created?.time ?? Date.now();

      // Fetch post statistics
      let impressions = 0, likes = 0, comments = 0, shares = 0;
      try {
        const statsUrl = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgId)}&ugcPosts=List(${encodeURIComponent(postId)})`;
        const statsRes = await fetch(statsUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });
        const statsData = await statsRes.json() as any;
        const stats = statsData.elements?.[0]?.totalShareStatistics;
        if (stats) {
          impressions = stats.impressionCount ?? 0;
          likes = stats.likeCount ?? 0;
          comments = stats.commentCount ?? 0;
          shares = stats.shareCount ?? 0;
        }
      } catch (e) {
        console.warn("[OrganicSignal/LinkedIn] Could not fetch stats for post", postId);
      }

      posts.push({
        id: postId,
        text: text.slice(0, 512),
        publishedAt,
        permalink: `https://www.linkedin.com/feed/update/${postId}`,
        impressions,
        likes,
        comments,
        shares,
      });
    }
    return posts;
  } catch (err) {
    console.error("[OrganicSignal/LinkedIn] Failed to fetch posts:", err);
    return [];
  }
}

// ─── Main poller ──────────────────────────────────────────────────────────────

export async function runOrganicSignalPoller(): Promise<{
  videosChecked: number;
  snapshotsTaken: number;
  candidatesFlagged: number;
  metaPostsChecked: number;
  linkedInPostsChecked: number;
}> {
  const db = await getDb();
  if (!db) return { videosChecked: 0, snapshotsTaken: 0, candidatesFlagged: 0, metaPostsChecked: 0, linkedInPostsChecked: 0 };

  let snapshotsTaken = 0;
  let candidatesFlagged = 0;

  // ── 1. YouTube ──────────────────────────────────────────────────────────────
  const publishedJobs = await db
    .select({
      id: videoJobs.id,
      youtubeVideoId: videoJobs.youtubeVideoId,
      youtubeTitle: videoJobs.youtubeTitle,
      youtubeThumbnailUrl: videoJobs.youtubeThumbnailUrl,
      publishedAt: videoJobs.publishedAt,
    })
    .from(videoJobs)
    .where(
      and(
        isNotNull(videoJobs.youtubeVideoId),
        isNotNull(videoJobs.publishedAt),
        eq(videoJobs.status, "published")
      )
    );

  if (publishedJobs.length > 0) {
    const videoIds = publishedJobs.map((j) => j.youtubeVideoId).filter(Boolean) as string[];
    const yt = await getYTClient();

    let channelTotalViews = 0;
    let channelVideoCount = 0;
    try {
      const channelRes = await yt.channels.list({ part: ["statistics"], mine: true });
      const channelStats = channelRes.data.items?.[0]?.statistics;
      channelTotalViews = parseInt(channelStats?.viewCount ?? "0", 10);
      channelVideoCount = parseInt(channelStats?.videoCount ?? "0", 10);
    } catch (err) {
      console.warn("[OrganicSignal/YouTube] Could not fetch channel stats:", err);
    }

    const videoStatsMap = new Map<string, {
      viewCount: number; likeCount: number; commentCount: number;
      publishedAt: string; title: string; thumbnail: string;
    }>();

    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      try {
        const res = await yt.videos.list({ part: ["snippet", "statistics"], id: chunk });
        for (const item of res.data.items ?? []) {
          if (!item.id) continue;
          videoStatsMap.set(item.id, {
            viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
            likeCount: parseInt(item.statistics?.likeCount ?? "0", 10),
            commentCount: parseInt(item.statistics?.commentCount ?? "0", 10),
            publishedAt: item.snippet?.publishedAt ?? "",
            title: item.snippet?.title ?? "",
            thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
          });
        }
      } catch (err) {
        console.error("[OrganicSignal/YouTube] Failed to fetch video stats batch:", err);
      }
    }

    for (const job of publishedJobs) {
      if (!job.youtubeVideoId || !job.publishedAt) continue;
      const stats = videoStatsMap.get(job.youtubeVideoId);
      if (!stats) continue;

      const publishedAtMs = job.publishedAt;
      const hoursSincePublish = (Date.now() - publishedAtMs) / 3600000;

      for (const snapshotHour of SNAPSHOT_HOURS) {
        if (hoursSincePublish < snapshotHour) continue;
        const existing = await db
          .select({ id: videoEngagementSnapshots.id })
          .from(videoEngagementSnapshots)
          .where(and(
            eq(videoEngagementSnapshots.videoJobId, job.id),
            eq(videoEngagementSnapshots.snapshotHour, snapshotHour)
          ))
          .limit(1);
        if (existing.length > 0) continue;

        const viewVelocity = computeViewVelocity(stats.viewCount, publishedAtMs);
        const engagementRate = computeEngagementRate(stats.viewCount, stats.likeCount, stats.commentCount);
        const outlierScore = computeOutlierScore(stats.viewCount, channelTotalViews, channelVideoCount);

        await db.insert(videoEngagementSnapshots).values({
          videoJobId: job.id,
          youtubeVideoId: job.youtubeVideoId,
          snapshotHour,
          viewCount: stats.viewCount,
          likeCount: stats.likeCount,
          commentCount: stats.commentCount,
          viewVelocity,
          engagementRate: engagementRate.toFixed(2),
          outlierScore: outlierScore.toFixed(2),
        });
        snapshotsTaken++;

        if (snapshotHour === 72 && stats.viewCount >= MIN_VIEWS_TO_SCORE) {
          const signalStrength = classifySignalStrength(engagementRate, viewVelocity, outlierScore);
          if (signalStrength) {
            const alreadyFlagged = await db
              .select({ id: paidPromoCandidates.id })
              .from(paidPromoCandidates)
              .where(and(
                eq(paidPromoCandidates.platform, "youtube"),
                eq(paidPromoCandidates.youtubeVideoId as any, job.youtubeVideoId)
              ))
              .limit(1);
            if (alreadyFlagged.length === 0) {
              await db.insert(paidPromoCandidates).values({
                platform: "youtube",
                videoJobId: job.id,
                youtubeVideoId: job.youtubeVideoId,
                youtubeTitle: job.youtubeTitle ?? stats.title,
                youtubeThumbnailUrl: job.youtubeThumbnailUrl ?? stats.thumbnail,
                viewCount: stats.viewCount,
                likeCount: stats.likeCount,
                commentCount: stats.commentCount,
                viewVelocity,
                engagementRate: engagementRate.toFixed(2),
                outlierScore: outlierScore.toFixed(2),
                signalStrength,
                status: "flagged",
              });
              candidatesFlagged++;
            }
          }
        }
      }
    }
  }

  // ── 2. Meta Page posts ──────────────────────────────────────────────────────
  const metaPosts = await fetchMetaPagePosts(25);
  for (const post of metaPosts) {
    if (post.reach < MIN_REACH_TO_SCORE) continue;

    const publishedAtMs = new Date(post.createdTime).getTime();
    const hoursSincePublish = (Date.now() - publishedAtMs) / 3600000;
    if (hoursSincePublish < 24) continue; // Need at least 24h of data

    const engagementRate = post.reach > 0
      ? Math.round(((post.likes + post.comments + post.shares) / post.reach) * 10000) / 100
      : 0;
    const reachVelocity = computeViewVelocity(post.reach, publishedAtMs);
    const signalStrength = classifyMetaSignal(engagementRate, reachVelocity);

    if (!signalStrength) continue;

    // Check if already flagged
    const alreadyFlagged = await db
      .select({ id: paidPromoCandidates.id })
      .from(paidPromoCandidates)
      .where(and(
        eq(paidPromoCandidates.platform, "meta"),
        eq(paidPromoCandidates.sourcePostId as any, post.id)
      ))
      .limit(1);

    if (alreadyFlagged.length === 0) {
      await db.insert(paidPromoCandidates).values({
        platform: "meta",
        sourcePostId: post.id,
        youtubeTitle: post.message.slice(0, 200) || `Meta post ${post.id}`,
        youtubeThumbnailUrl: post.thumbnailUrl,
        viewCount: post.reach,
        likeCount: post.likes,
        commentCount: post.comments + post.shares,
        viewVelocity: reachVelocity,
        engagementRate: engagementRate.toFixed(2),
        outlierScore: "0",
        signalStrength,
        status: "flagged",
      });
      candidatesFlagged++;
      console.log(`[OrganicSignal/Meta] Flagged post "${post.message.slice(0, 60)}..." as ${signalStrength} (ER: ${engagementRate.toFixed(1)}%, reach/day: ${reachVelocity})`);
    }
  }

  // ── 3. LinkedIn posts ───────────────────────────────────────────────────────
  const linkedInPosts = await fetchLinkedInPosts(20);
  for (const post of linkedInPosts) {
    if (post.impressions < MIN_REACH_TO_SCORE) continue;

    const hoursSincePublish = (Date.now() - post.publishedAt) / 3600000;
    if (hoursSincePublish < 24) continue;

    const engagementRate = post.impressions > 0
      ? Math.round(((post.likes + post.comments + post.shares) / post.impressions) * 10000) / 100
      : 0;
    const impressionVelocity = computeViewVelocity(post.impressions, post.publishedAt);
    const signalStrength = classifyLinkedInSignal(engagementRate, impressionVelocity);

    if (!signalStrength) continue;

    const alreadyFlagged = await db
      .select({ id: paidPromoCandidates.id })
      .from(paidPromoCandidates)
      .where(and(
        eq(paidPromoCandidates.platform, "linkedin"),
        eq(paidPromoCandidates.sourcePostId as any, post.id)
      ))
      .limit(1);

    if (alreadyFlagged.length === 0) {
      await db.insert(paidPromoCandidates).values({
        platform: "linkedin",
        sourcePostId: post.id,
        youtubeTitle: post.text.slice(0, 200) || `LinkedIn post ${post.id}`,
        youtubeThumbnailUrl: post.thumbnailUrl,
        viewCount: post.impressions,
        likeCount: post.likes,
        commentCount: post.comments + post.shares,
        viewVelocity: impressionVelocity,
        engagementRate: engagementRate.toFixed(2),
        outlierScore: "0",
        signalStrength,
        status: "flagged",
      });
      candidatesFlagged++;
      console.log(`[OrganicSignal/LinkedIn] Flagged post "${post.text.slice(0, 60)}..." as ${signalStrength}`);
    }
  }

  // ── 4. TikTok — placeholder ─────────────────────────────────────────────────
  // TikTok Business API requires separate OAuth approval.
  // When TIKTOK_ACCESS_TOKEN is set, add fetchTikTokPosts() here.

  return {
    videosChecked: publishedJobs.length,
    snapshotsTaken,
    candidatesFlagged,
    metaPostsChecked: metaPosts.length,
    linkedInPostsChecked: linkedInPosts.length,
  };
}

/**
 * Get all paid promo candidates with their latest engagement data.
 */
export async function getPaidPromoCandidates(statusFilter?: string[]) {
  const db = await getDb();
  if (!db) return [];
  const conditions = statusFilter && statusFilter.length > 0
    ? [inArray(paidPromoCandidates.status, statusFilter as any[])]
    : [];

  const candidates = await db
    .select()
    .from(paidPromoCandidates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${paidPromoCandidates.flaggedAt} DESC`);

  return candidates.map((c) => ({
    ...c,
    claudeRecommendation: c.claudeRecommendation
      ? JSON.parse(c.claudeRecommendation)
      : null,
  }));
}

/**
 * Update a paid promo candidate's status.
 */
export async function updateCandidateStatus(
  candidateId: number,
  status: "flagged" | "recommended" | "approved" | "launched" | "dismissed",
  extra?: {
    claudeRecommendation?: object;
    metaCampaignId?: string;
    metaAdSetId?: string;
    metaAdId?: string;
    launchedBy?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(paidPromoCandidates)
    .set({
      status,
      ...(extra?.claudeRecommendation
        ? {
            claudeRecommendation: JSON.stringify(extra.claudeRecommendation),
            recommendationGeneratedAt: new Date(),
          }
        : {}),
      ...(extra?.metaCampaignId ? { metaCampaignId: extra.metaCampaignId } : {}),
      ...(extra?.metaAdSetId ? { metaAdSetId: extra.metaAdSetId } : {}),
      ...(extra?.metaAdId ? { metaAdId: extra.metaAdId } : {}),
      ...(extra?.launchedBy ? { launchedBy: extra.launchedBy, launchedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(paidPromoCandidates.id, candidateId));
}
