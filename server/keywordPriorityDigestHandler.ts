/**
 * keywordPriorityDigestHandler.ts
 *
 * Heartbeat handler for the weekly Keyword Strategy priority digest.
 * Triggered every Monday at 09:30 UTC via project-level Heartbeat cron.
 *
 * What it does:
 *  1. Loads all active keyword campaigns
 *  2. For each campaign, finds the top 3 not-started keywords with the highest search volume
 *  3. Sends a combined priority digest notification via notifyOwner
 *
 * Registered at: POST /api/scheduled/keyword-priority-digest
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import { keywordCampaigns, keywordTargets } from "../drizzle/schema";
import { eq, and, isNotNull, desc, asc } from "drizzle-orm";

const FUNNEL_LABEL: Record<string, string> = {
  tofu: "Awareness",
  mofu: "Consideration",
  bofu: "Conversion",
};

const MONO_LABEL: Record<string, string> = {
  academy: "Academy",
  supplements: "Supplements",
  testing: "Testing",
  free_lead: "Lead Magnet",
};

export async function keywordPriorityDigestHandler(req: Request, res: Response) {
  try {
    const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!taskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    // Load all active campaigns
    const campaigns = await db
      .select()
      .from(keywordCampaigns)
      .where(eq(keywordCampaigns.status, "active"));

    if (!campaigns.length) {
      await notifyOwner({
        title: "📊 Weekly Keyword Priority — No Active Campaigns",
        content: "No active keyword campaigns found. Visit /keyword-strategy to create one.",
      });
      return res.json({ ok: true, message: "no campaigns" });
    }

    const sections: string[] = [];
    let totalOpportunities = 0;

    for (const campaign of campaigns) {
      // Top 3 not-started keywords with highest search volume (volume must be set)
      const topKeywords = await db!
        .select()
        .from(keywordTargets)
        .where(
          and(
            eq(keywordTargets.campaignId, campaign.id),
            eq(keywordTargets.contentStatus, "not_started"),
            isNotNull(keywordTargets.searchVolume)
          )
        )
        .orderBy(desc(keywordTargets.searchVolume), asc(keywordTargets.priority))
        .limit(3);

      // Also get a count of all not-started keywords for context
      const allNotStarted = await db!
        .select({ id: keywordTargets.id, searchVolume: keywordTargets.searchVolume })
        .from(keywordTargets)
        .where(
          and(
            eq(keywordTargets.campaignId, campaign.id),
            eq(keywordTargets.contentStatus, "not_started")
          )
        );

      const totalVolume = allNotStarted.reduce((sum, k) => sum + (k.searchVolume || 0), 0);
      totalOpportunities += allNotStarted.length;

      if (!topKeywords.length) {
        sections.push(
          `**${campaign.name}** (${campaign.pillarKeyword})\n` +
          `  All keywords are in progress or published. Great work!`
        );
        continue;
      }

      const rows = topKeywords
        .map((kw, i) => {
          const vol = kw.searchVolume ? `${kw.searchVolume.toLocaleString()}/mo` : "vol unknown";
          const funnel = FUNNEL_LABEL[kw.funnelStage] || kw.funnelStage;
          const mono = MONO_LABEL[kw.monetizationTag] || kw.monetizationTag;
          const type = kw.keywordType.charAt(0).toUpperCase() + kw.keywordType.slice(1);
          return `  ${i + 1}. **"${kw.keyword}"** — ${vol} | ${type} | ${funnel} → ${mono}`;
        })
        .join("\n");

      sections.push(
        `**${campaign.name}** (${allNotStarted.length} keywords remaining, ~${totalVolume.toLocaleString()} total monthly searches)\n` +
        `Top 3 this week:\n${rows}`
      );
    }

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const title = `📊 Weekly Keyword Priorities — ${today}`;
    const content = [
      `You have **${totalOpportunities} keyword opportunities** across ${campaigns.length} active campaign${campaigns.length > 1 ? "s" : ""} waiting for content.\n`,
      ...sections,
      `\n---\nCreate content for these keywords at https://content.theurbanmonk.com/keyword-strategy`,
    ].join("\n\n");

    const sent = await notifyOwner({ title, content });
    return res.json({ ok: true, sent, campaigns: campaigns.length, opportunities: totalOpportunities });
  } catch (err) {
    console.error("[keywordPriorityDigest] error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
