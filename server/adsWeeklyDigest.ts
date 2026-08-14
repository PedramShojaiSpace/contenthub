/**
 * adsWeeklyDigest.ts
 *
 * Phase 3 — Weekly performance digest generator.
 * Runs every Monday at 08:00 UTC via heartbeat cron.
 * Claude analyzes the past week's ad performance and writes a
 * plain-English digest with strategic recommendations.
 */

import { getDb } from "./db";
import { adsWeeklyDigests, adsOptimizationLogs } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { desc, sql } from "drizzle-orm";

export interface WeeklyDigestResult {
  success: boolean;
  digestId?: number;
  weekStart: string;
  weekEnd: string;
  error?: string;
}

export async function generateWeeklyDigest(): Promise<WeeklyDigestResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, weekStart: "", weekEnd: "", error: "DB unavailable" };
  }

  // Calculate week range (last 7 days)
  const now = new Date();
  const weekEnd = now.toISOString().split("T")[0];
  const weekStartDate = new Date(now);
  weekStartDate.setDate(weekStartDate.getDate() - 7);
  const weekStart = weekStartDate.toISOString().split("T")[0];

  // Gather saved daily snapshots only. The weekly digest must never call Meta
  // directly because the morning batch is the single reporting data source.
  let campaignData: any[] = [];
  let optimizationActions: any[] = [];

  try {
    const [rows] = await db.execute(sql`
      SELECT campaign_name AS name,
             MAX(status) AS status,
             SUM(spend_cents) / 100 AS spend,
             SUM(impressions) AS impressions,
             SUM(clicks) AS clicks,
             AVG(ctr) AS ctr,
             AVG(frequency) AS frequency
      FROM campaign_snapshots
      WHERE snapshot_date >= ${weekStart} AND snapshot_date < ${weekEnd}
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
    `) as any[];
    campaignData = (rows ?? []).map((row: any) => ({
      name: row.name,
      status: row.status,
      spend: Number(row.spend ?? 0),
      leads: 0,
      cpl: 0,
      ctr: Number(row.ctr ?? 0),
      frequency: Number(row.frequency ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
    }));
  } catch (e: any) {
    console.error("[Digest] Failed to read saved campaign data:", e.message);
  }

  try {
    // Get optimization actions from the past week
    const logs = await db
      .select()
      .from(adsOptimizationLogs)
      .orderBy(desc(adsOptimizationLogs.createdAt))
      .limit(50);
    optimizationActions = logs.filter((l) => {
      const logDate = new Date(l.createdAt);
      return logDate >= weekStartDate && logDate <= now;
    });
  } catch (e: any) {
    console.error("[Digest] Failed to fetch optimization logs:", e.message);
  }

  // Compute summary stats
  const totalSpend = campaignData.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaignData.reduce((s, c) => s + c.leads, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const activeCampaigns = campaignData.filter((c) => c.status === "ACTIVE");
  const pausedThisWeek = optimizationActions.filter((a) => a.action === "paused").length;
  const scaledThisWeek = optimizationActions.filter((a) => a.action === "scaled").length;

  // Build data context for Claude
  const topCampaigns = [...campaignData]
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5)
    .map((c) => `- ${c.name}: $${c.spend.toFixed(0)} spend, ${c.leads} leads, CPL $${c.cpl.toFixed(2)}, CTR ${c.ctr.toFixed(2)}%, freq ${c.frequency.toFixed(1)}x`)
    .join("\n");

  const actionsSummary = optimizationActions.length > 0
    ? optimizationActions
        .slice(0, 10)
        .map((a) => `- ${a.campaignName}: ${a.action.toUpperCase()} — ${a.reason}`)
        .join("\n")
    : "No automated actions taken this week.";

  // Generate digest with Claude
  let digestMarkdown = "";
  try {
    const prompt = `You are the AI Ads Manager for Dr. Pedram Shojai's Urban Monk brand. 
Write a concise, strategic weekly ads performance digest for Dr. Pedram.

Tone: Direct, data-driven, no fluff. Write like a CMO briefing the CEO. Use plain English, no jargon.
Format: Markdown with clear sections. Keep it under 600 words.

WEEK: ${weekStart} to ${weekEnd}

ACCOUNT SUMMARY:
- Total spend: $${totalSpend.toFixed(2)}
- Total leads: ${totalLeads}
- Average CPL: $${avgCpl.toFixed(2)}
- Active campaigns: ${activeCampaigns.length}
- Campaigns paused by optimizer: ${pausedThisWeek}
- Campaigns scaled by optimizer: ${scaledThisWeek}

TOP CAMPAIGNS BY LEADS:
${topCampaigns || "No campaign data available."}

AUTOMATED ACTIONS TAKEN:
${actionsSummary}

Write the digest with these sections:
1. **This Week at a Glance** (3-4 bullet points, key numbers)
2. **What's Working** (specific campaigns or patterns that are performing)
3. **What Needs Attention** (campaigns flagged, creative fatigue, elevated CPL)
4. **Recommended Actions for Next Week** (2-3 specific, actionable items)
5. **Trend Watch** (one observation about where the account is heading)

Do not fabricate data. Only use the numbers provided above.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a senior performance marketing analyst. Write clear, actionable weekly ad performance digests." },
        { role: "user", content: prompt },
      ],
    });

    digestMarkdown = (response.choices?.[0]?.message?.content as string) ?? "";
  } catch (e: any) {
    console.error("[Digest] Claude generation failed:", e.message);
    // Fallback: generate a basic digest without Claude
    digestMarkdown = `## Weekly Ads Digest: ${weekStart} to ${weekEnd}

### This Week at a Glance
- Total spend: $${totalSpend.toFixed(2)}
- Total leads: ${totalLeads}
- Average CPL: $${avgCpl.toFixed(2)}
- Active campaigns: ${activeCampaigns.length}

### Automated Actions
${actionsSummary}

*Full AI analysis unavailable this week — check Ads Manager for details.*`;
  }

  // Save to DB
  let digestId: number | undefined;
  try {
    const inserted = await db.insert(adsWeeklyDigests).values({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      digestMarkdown,
      totalSpend: totalSpend.toFixed(2),
      totalLeads,
      avgCpl: avgCpl.toFixed(2),
      campaignCount: campaignData.length,
      actionsCount: optimizationActions.length,
      createdAt: new Date(),
    });
    digestId = (inserted as any).insertId;
  } catch (e: any) {
    console.error("[Digest] Failed to save digest:", e.message);
  }

  // Notify owner
  try {
    await notifyOwner({
      title: `📊 Weekly Ads Digest — ${weekStart}`,
      content: `Your weekly ads performance digest is ready.\n\nTotal spend: $${totalSpend.toFixed(2)} | Leads: ${totalLeads} | CPL: $${avgCpl.toFixed(2)}\n\nView the full digest in Ads Manager → Weekly Digest tab.`,
    });
  } catch (_) {}

  console.log(`[Digest] Generated weekly digest for ${weekStart} to ${weekEnd} — $${totalSpend.toFixed(2)} spend, ${totalLeads} leads`);

  return {
    success: true,
    digestId,
    weekStart,
    weekEnd,
  };
}
