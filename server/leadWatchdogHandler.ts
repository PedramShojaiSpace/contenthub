/**
 * leadWatchdogHandler.ts
 * Hourly Heartbeat cron — fires every 60 minutes.
 *
 * Does two things:
 * 1. Lead flow watchdog — alerts if no new opt-ins in the window
 *    - Peak hours (6am–10pm CT): 65-min window
 *    - Overnight (10pm–6am CT): 3-hour window
 *
 * 2. Kajabi spot-check — queries Kajabi for contacts with the
 *    "Interconnected Opt In" tag and compares against our DB count.
 *    Alerts if Kajabi count is significantly behind our DB (tagging broken).
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { getKajabiContactsByTag } from "./kajabiApi";

const KAJABI_TAG = "Interconnected Opt In";

// CT = UTC-5 (CDT). Safe approximation.
const CT_OFFSET_HOURS = -5;

function getCurrentHourCT(): number {
  const nowUtc = new Date();
  return (nowUtc.getUTCHours() + 24 + CT_OFFSET_HOURS) % 24;
}

export async function leadWatchdogHandler(req: Request, res: Response) {
  try {
    // Authenticate — only the cron platform may call this
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "DB unavailable" });
    }

    const hourCT = getCurrentHourCT();
    const isPeakHour = hourCT >= 6 && hourCT < 22;
    const windowMs = isPeakHour ? 65 * 60 * 1000 : 3 * 60 * 60 * 1000;
    const windowLabel = isPeakHour ? "65 minutes" : "3 hours (overnight)";
    const since = Date.now() - windowMs;
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

    // ── 1. Count leads in the window ─────────────────────────────────────────
    const rows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${since}`
    ) as any;
    const rowData = Array.isArray(rows) ? rows[0] : rows;
    const firstRow = Array.isArray(rowData) ? rowData[0] : rowData;
    const leadsInWindow = Number(firstRow?.cnt ?? 0);

    // Today's total (midnight CT = 05:00 UTC during CDT)
    const midnightCT = new Date();
    midnightCT.setUTCHours(5, 0, 0, 0);
    if (Date.now() < midnightCT.getTime()) {
      midnightCT.setUTCDate(midnightCT.getUTCDate() - 1);
    }
    const todayRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${midnightCT.getTime()}`
    ) as any;
    const todayRowData = Array.isArray(todayRows) ? todayRows[0] : todayRows;
    const todayFirstRow = Array.isArray(todayRowData) ? todayRowData[0] : todayRowData;
    const todayTotal = Number(todayFirstRow?.cnt ?? 0);

    // All-time DB total
    const totalRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads`
    ) as any;
    const totalRowData = Array.isArray(totalRows) ? totalRows[0] : totalRows;
    const totalFirstRow = Array.isArray(totalRowData) ? totalRowData[0] : totalRowData;
    const dbTotal = Number(totalFirstRow?.cnt ?? 0);

    // ── 2. Kajabi spot-check ──────────────────────────────────────────────────
    let kajabiCount = 0;
    let kajabiCheckError: string | null = null;
    let kajabiGap = 0;
    let kajabiAlertNeeded = false;

    try {
      const kajabiContacts = await getKajabiContactsByTag(KAJABI_TAG);
      kajabiCount = kajabiContacts.length;
      // Gap = DB total minus Kajabi count (DB should be ≤ Kajabi + small retry buffer)
      // Alert if Kajabi is more than 10 behind our DB (indicates tagging is broken)
      kajabiGap = dbTotal - kajabiCount;
      kajabiAlertNeeded = kajabiGap > 10;
    } catch (kajabiErr: any) {
      kajabiCheckError = kajabiErr?.message ?? "Unknown Kajabi error";
      console.warn("[leadWatchdog] Kajabi spot-check failed:", kajabiCheckError);
    }

    const alerts: string[] = [];

    // ── Alert: no leads in window ─────────────────────────────────────────────
    if (leadsInWindow === 0) {
      const timeContext = isPeakHour
        ? `during peak hours (${hourCT}:00 CT)`
        : `overnight (${hourCT}:00 CT — low-traffic window)`;

      alerts.push("no_leads_in_window");
      await notifyOwner({
        title: `⚠️ Lead Flow Alert — No Leads in ${windowLabel}`,
        content:
          `No new Interconnected opt-ins in the last ${windowLabel} ${timeContext}.\n` +
          `Today's total: ${todayTotal} leads | All-time DB: ${dbTotal}\n` +
          `Kajabi "${KAJABI_TAG}" tag count: ${kajabiCount}${kajabiCheckError ? ` (check failed: ${kajabiCheckError})` : ""}\n\n` +
          `Check: (1) Meta Ads Manager — campaigns active? ` +
          `(2) content.theurbanmonk.com/interconnected — form loading? ` +
          `(3) Server logs for errors.\n` +
          `Checked at ${nowStr} CT.`,
      });
    }

    // ── Alert: Kajabi tagging gap ─────────────────────────────────────────────
    if (kajabiAlertNeeded) {
      alerts.push("kajabi_tag_gap");
      await notifyOwner({
        title: `⚠️ Kajabi Tagging Gap Detected — ${kajabiGap} Leads Not Tagged`,
        content:
          `Our DB has ${dbTotal} total Interconnected leads, but Kajabi only shows ${kajabiCount} contacts with the "${KAJABI_TAG}" tag.\n\n` +
          `Gap: ${kajabiGap} leads are in our system but NOT tagged in Kajabi.\n\n` +
          `This may mean:\n` +
          `• Kajabi API is intermittently failing (check retry queue)\n` +
          `• The tag name changed in Kajabi\n` +
          `• Kajabi API credentials expired\n\n` +
          `Action: Check the retry queue in the admin dashboard and verify Kajabi API is responding.\n` +
          `Checked at ${nowStr} CT.`,
      });
    }

    // ── Hourly status notification (always send during peak hours) ────────────
    // Sends a clean hourly status so you can see leads flowing without needing to check manually
    if (isPeakHour && leadsInWindow > 0) {
      await notifyOwner({
        title: `📊 Hourly Lead Report — ${leadsInWindow} new opt-ins`,
        content:
          `${leadsInWindow} new Interconnected opt-ins in the last ${windowLabel}.\n` +
          `Today's total: ${todayTotal} leads\n` +
          `Kajabi "${KAJABI_TAG}" tag: ${kajabiCount} contacts${kajabiGap > 0 ? ` (${kajabiGap} gap ⚠️)` : " ✅"}\n` +
          `Checked at ${nowStr} CT.`,
      });
    }

    return res.json({
      ok: true,
      alerts,
      leadsInWindow,
      todayTotal,
      dbTotal,
      kajabiCount,
      kajabiGap,
      kajabiCheckError,
      windowLabel,
      hourCT,
      isPeakHour,
      message: alerts.length === 0
        ? `${leadsInWindow} leads in last ${windowLabel} — Kajabi: ${kajabiCount} (gap: ${kajabiGap})`
        : `Alerts sent: ${alerts.join(", ")}`,
    });
  } catch (err: any) {
    console.error("[leadWatchdog] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
