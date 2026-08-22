/**
 * Hourly Heartbeat cron — sends one opt-in summary per hour.
 *
 * It preserves the original flow-health and Kajabi-tag checks but consolidates
 * them into a single owner notification. Individual form submissions never
 * trigger owner emails from this handler.
 */

import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { getKajabiContactsByTag } from "./kajabiApi";

const KAJABI_TAG = "Interconnected Opt In";
const HOUR_MS = 60 * 60 * 1000;

export type HourlyLeadSummaryInput = {
  leadsInWindow: number;
  todayTotal: number;
  dbTotal: number;
  kajabiCount: number;
  kajabiGap: number;
  kajabiCheckError: string | null;
  checkedAtCT: string;
};

export function buildHourlyLeadSummary(input: HourlyLeadSummaryInput) {
  const isQuiet = input.leadsInWindow === 0;
  const hasTagGap = input.kajabiGap > 10;
  const title = isQuiet
    ? "📊 Hourly Opt-In Summary — 0 new opt-ins"
    : `📊 Hourly Opt-In Summary — ${input.leadsInWindow} new opt-in${input.leadsInWindow === 1 ? "" : "s"}`;

  const kajabiStatus = input.kajabiCheckError
    ? `Kajabi tag check: unavailable (${input.kajabiCheckError})`
    : `Kajabi "${KAJABI_TAG}" tag: ${input.kajabiCount}${hasTagGap ? ` (${input.kajabiGap} recorded-lead gap — review)` : ""}`;

  const content = [
    `New Interconnected opt-ins recorded in the last hour: ${input.leadsInWindow}.`,
    `Today's recorded total: ${input.todayTotal}.`,
    kajabiStatus,
    isQuiet
      ? "No recorded opt-ins in this hour. This is an observation, not a customer-facing funnel change."
      : "Individual opt-in alerts are suppressed; this is the single hourly owner summary.",
    `Checked at ${input.checkedAtCT} CT.`,
  ].join("\n");

  return { title, content, isQuiet, hasTagGap };
}

function firstResultRow(rows: unknown): Record<string, unknown> {
  const outer = Array.isArray(rows) ? rows[0] : rows;
  const inner = Array.isArray(outer) ? outer[0] : outer;
  return (inner ?? {}) as Record<string, unknown>;
}

export async function leadWatchdogHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const now = Date.now();
    const hourAgo = now - HOUR_MS;
    const checkedAtCT = new Date(now).toLocaleString("en-US", { timeZone: "America/Chicago" });

    const leadRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${hourAgo}`,
    ) as unknown;
    const leadsInWindow = Number(firstResultRow(leadRows).cnt ?? 0);

    const midnightCT = new Date(now);
    midnightCT.setUTCHours(5, 0, 0, 0);
    if (now < midnightCT.getTime()) midnightCT.setUTCDate(midnightCT.getUTCDate() - 1);

    const todayRows = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ${midnightCT.getTime()}`,
    ) as unknown;
    const todayTotal = Number(firstResultRow(todayRows).cnt ?? 0);

    const totalRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM interconnected_leads`) as unknown;
    const dbTotal = Number(firstResultRow(totalRows).cnt ?? 0);

    let kajabiCount = 0;
    let kajabiCheckError: string | null = null;
    try {
      kajabiCount = (await getKajabiContactsByTag(KAJABI_TAG)).length;
    } catch (error: any) {
      kajabiCheckError = error?.message ?? "Unknown Kajabi error";
      console.warn("[leadWatchdog] Kajabi spot-check failed:", kajabiCheckError);
    }

    const kajabiGap = dbTotal - kajabiCount;
    const summary = buildHourlyLeadSummary({
      leadsInWindow,
      todayTotal,
      dbTotal,
      kajabiCount,
      kajabiGap,
      kajabiCheckError,
      checkedAtCT,
    });

    await notifyOwner({ title: summary.title, content: summary.content });

    return res.json({
      ok: true,
      notification: "hourly_summary_sent",
      leadsInWindow,
      todayTotal,
      dbTotal,
      kajabiCount,
      kajabiGap,
      kajabiCheckError,
      isQuiet: summary.isQuiet,
      hasTagGap: summary.hasTagGap,
    });
  } catch (error: any) {
    console.error("[leadWatchdog] Error:", error);
    return res.status(500).json({
      error: error?.message ?? "Unknown error",
      stack: error?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
