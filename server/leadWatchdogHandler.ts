/**
 * leadWatchdogHandler.ts
 * Hourly Heartbeat cron — fires every 60 minutes.
 * Checks if any Interconnected leads came in the last 65 minutes.
 * If ZERO leads found, sends an owner alert so the issue can be investigated.
 * If leads are flowing normally, stays silent.
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { interconnectedLeads } from "../drizzle/schema";
import { gte, count } from "drizzle-orm";

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

    // Look back 65 minutes (5 min buffer over the 60-min window)
    const windowMs = 65 * 60 * 1000;
    const since = Date.now() - windowMs;

    const [result] = await db
      .select({ cnt: count() })
      .from(interconnectedLeads)
      .where(gte(interconnectedLeads.createdAt, since));

    const leadsInWindow = result?.cnt ?? 0;

    if (leadsInWindow === 0) {
      // No leads in 65 minutes — alert the owner
      await notifyOwner({
        title: "⚠️ Lead Flow Alert — No Leads in 65 Minutes",
        content:
          `No new Interconnected opt-ins have been recorded in the last 65 minutes. ` +
          `This may indicate a problem with the opt-in form, ads delivery, or the registration pipeline. ` +
          `Check: (1) Meta Ads Manager for campaign status, (2) content.theurbanmonk.com/interconnected for form functionality, ` +
          `(3) Kajabi/Klaviyo for sync errors. ` +
          `Checked at ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT.`,
      });
      return res.json({ ok: true, alert: true, leadsInWindow, message: "Alert sent — no leads in 65 min" });
    }

    // Leads are flowing — stay silent
    return res.json({ ok: true, alert: false, leadsInWindow, message: `${leadsInWindow} leads in last 65 min — all good` });
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
