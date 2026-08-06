/**
 * day0VerificationHandler.ts
 * One-time (and optionally recurring) Heartbeat cron handler.
 * Fires 60 minutes after the form-submission fix was deployed.
 *
 * Checks:
 * 1. How many new leads came in since the fix was deployed (timestamp stored in env or hardcoded)
 * 2. How many of those have kajabi_tagged = 1 (form submission succeeded)
 * 3. How many are still pending (kajabi_tagged = 0) — these need investigation
 * 4. Sends a detailed report to the owner via notifyOwner
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

// Timestamp of when the form-submission fix was deployed (Aug 4 2026, ~21:40 UTC)
const FIX_DEPLOYED_AT = 1754344800000; // 2026-08-04 21:40:00 UTC in ms

export async function day0VerificationHandler(req: Request, res: Response) {
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

    // Count leads since the fix was deployed
    const totalRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${FIX_DEPLOYED_AT}`
    ) as any;
    const totalData = Array.isArray(totalRows) ? totalRows[0] : totalRows;
    const totalNew = Number((Array.isArray(totalData) ? totalData[0] : totalData)?.cnt ?? 0);

    // Count leads with kajabi_tagged = 1 (form submission succeeded)
    const taggedRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${FIX_DEPLOYED_AT} AND kajabi_tagged = 1`
    ) as any;
    const taggedData = Array.isArray(taggedRows) ? taggedRows[0] : taggedRows;
    const taggedCount = Number((Array.isArray(taggedData) ? taggedData[0] : taggedData)?.cnt ?? 0);

    // Count leads with kajabi_tagged = 0 (pending or failed)
    const pendingCount = totalNew - taggedCount;

    // Get the last 10 new leads for detail
    const recentRows = await db.execute(
      sql`SELECT email, name, kajabi_tagged, kajabi_tagged_at, created_at 
          FROM interconnected_leads 
          WHERE created_at >= ${FIX_DEPLOYED_AT} 
          ORDER BY created_at DESC 
          LIMIT 10`
    ) as any;
    const recentData = Array.isArray(recentRows) ? recentRows[0] : recentRows;
    const recentLeads: any[] = Array.isArray(recentData) ? recentData : [];

    // Check retry queue for any pending items
    const retryRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM kajabi_retry_queue WHERE status = 'pending'`
    ) as any;
    const retryData = Array.isArray(retryRows) ? retryRows[0] : retryRows;
    const retryPending = Number((Array.isArray(retryData) ? retryData[0] : retryData)?.cnt ?? 0);

    const now = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
    const fixDeployedStr = new Date(FIX_DEPLOYED_AT).toLocaleString("en-US", { timeZone: "America/Chicago" });

    let status: string;
    let emoji: string;
    if (totalNew === 0) {
      status = "No new leads since fix deployment — ads may not be running or it's a slow period.";
      emoji = "⚠️";
    } else if (pendingCount === 0) {
      status = "ALL new leads successfully enrolled in Kajabi sequence from Day 0. Fix is working perfectly.";
      emoji = "✅";
    } else {
      status = `${pendingCount} leads have kajabi_tagged=0. Check the retry queue (${retryPending} pending retries).`;
      emoji = "⚠️";
    }

    const recentSummary = recentLeads.map((l: any) => {
      const enrolled = l.kajabi_tagged ? "✅ enrolled" : "❌ pending";
      const time = new Date(Number(l.created_at)).toLocaleTimeString("en-US", { timeZone: "America/Chicago" });
      return `  ${time} — ${l.name} (${l.email}) — Kajabi: ${enrolled}`;
    }).join("\n");

    await notifyOwner({
      title: `${emoji} Day 0 Verification Report — ${now} CT`,
      content: [
        `Fix deployed at: ${fixDeployedStr} CT`,
        `New leads since fix: ${totalNew}`,
        `Kajabi Day 0 enrolled: ${taggedCount}`,
        `Pending/failed: ${pendingCount}`,
        `Retry queue pending: ${retryPending}`,
        ``,
        `Status: ${status}`,
        ``,
        `Recent leads (newest first):`,
        recentSummary || "  (none yet)",
      ].join("\n"),
    });

    return res.json({
      ok: true,
      totalNew,
      taggedCount,
      pendingCount,
      retryPending,
      status,
    });
  } catch (err: any) {
    console.error("[day0Verification] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
