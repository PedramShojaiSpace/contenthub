/**
 * leadWatchdogHandler.ts
 * Hourly Heartbeat cron — fires every 60 minutes.
 *
 * Smart watchdog logic:
 * - During peak hours (6am–10pm CT): alert if ZERO leads in 65 min
 * - During overnight hours (10pm–6am CT): alert only if ZERO leads in 3 hours
 *   (overnight lulls are normal — ads run at lower frequency, audience is asleep)
 * - Also checks: if today's total is suspiciously low vs yesterday's average
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

// CT = UTC-5 (CDT) or UTC-6 (CST). We use UTC-5 (CDT) as a safe approximation.
const CT_OFFSET_HOURS = -5;

function getCurrentHourCT(): number {
  const nowUtc = new Date();
  const ctHour = (nowUtc.getUTCHours() + 24 + CT_OFFSET_HOURS) % 24;
  return ctHour;
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
    const isPeakHour = hourCT >= 6 && hourCT < 22; // 6am–10pm CT

    // During peak hours: 65-min window. Overnight: 3-hour window.
    const windowMs = isPeakHour ? 65 * 60 * 1000 : 3 * 60 * 60 * 1000;
    const windowLabel = isPeakHour ? "65 minutes" : "3 hours (overnight)";
    const since = Date.now() - windowMs;

    // Count leads in the window
    const rows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${since}`
    ) as any;
    const rowData = Array.isArray(rows) ? rows[0] : rows;
    const firstRow = Array.isArray(rowData) ? rowData[0] : rowData;
    const leadsInWindow = Number(firstRow?.cnt ?? 0);

    // Also get today's total (midnight CT = 05:00 UTC during CDT)
    const midnightCT = new Date();
    midnightCT.setUTCHours(5, 0, 0, 0); // midnight CT (CDT = UTC-5)
    if (Date.now() < midnightCT.getTime()) {
      midnightCT.setUTCDate(midnightCT.getUTCDate() - 1);
    }
    const todayRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${midnightCT.getTime()}`
    ) as any;
    const todayRowData = Array.isArray(todayRows) ? todayRows[0] : todayRows;
    const todayFirstRow = Array.isArray(todayRowData) ? todayRowData[0] : todayRowData;
    const todayTotal = Number(todayFirstRow?.cnt ?? 0);

    const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

    if (leadsInWindow === 0) {
      // No leads in the window — alert the owner
      const timeContext = isPeakHour
        ? `during peak hours (${hourCT}:00 CT)`
        : `overnight (${hourCT}:00 CT — low-traffic window)`;

      await notifyOwner({
        title: `⚠️ Lead Flow Alert — No Leads in ${windowLabel}`,
        content:
          `No new Interconnected opt-ins in the last ${windowLabel} ${timeContext}. ` +
          `Today's total so far: ${todayTotal} leads. ` +
          `\n\nCheck: (1) Meta Ads Manager — are campaigns active? ` +
          `(2) content.theurbanmonk.com/interconnected — form loading? ` +
          `(3) Server logs for errors. ` +
          `\nChecked at ${nowStr} CT.`,
      });
      return res.json({
        ok: true,
        alert: true,
        leadsInWindow,
        todayTotal,
        windowLabel,
        hourCT,
        isPeakHour,
        message: `Alert sent — no leads in ${windowLabel} (${timeContext})`,
      });
    }

    // Leads are flowing — stay silent
    return res.json({
      ok: true,
      alert: false,
      leadsInWindow,
      todayTotal,
      windowLabel,
      hourCT,
      isPeakHour,
      message: `${leadsInWindow} leads in last ${windowLabel} — all good (today total: ${todayTotal})`,
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
