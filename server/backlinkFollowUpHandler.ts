/**
 * backlinkFollowUpHandler.ts
 *
 * Heartbeat handler for the backlink outreach auto-follow-up pipeline.
 * Triggered daily at 09:00 UTC via project-level Heartbeat cron.
 *
 * What it does:
 *  1. Finds prospects with status "emailed" where firstEmailSentAt was 7+ days ago
 *     and no follow_up_1 email exists → drafts follow-up #1
 *  2. Finds prospects with status "followed_up" where lastFollowUpAt was 7+ days ago
 *     and no follow_up_2 email exists → drafts follow-up #2
 *  3. Sends a summary notification to the owner
 *
 * Registered at: POST /api/scheduled/backlink-followup
 */
import type { Request, Response } from "express";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";

const FOLLOW_UP_DELAY_DAYS = 7;

export async function backlinkFollowUpHandler(req: Request, res: Response) {
  try {
    // Authenticate as cron — trust the /api/scheduled/* gateway
    const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!taskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const { backlinkProspects, backlinkEmails } = await import("../drizzle/schema");
    const { eq, and, isNull, lte, inArray } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - FOLLOW_UP_DELAY_DAYS * 24 * 60 * 60 * 1000);
    let drafted1 = 0;
    let drafted2 = 0;

    // ── Follow-up #1: status="emailed", firstEmailSentAt ≥ 7 days ago ─────────
    const needFollowUp1 = await db
      .select()
      .from(backlinkProspects)
      .where(
        and(
          eq(backlinkProspects.status, "emailed"),
          lte(backlinkProspects.firstEmailSentAt, cutoff)
        )
      )
      .limit(20);

    for (const prospect of needFollowUp1) {
      // Check if follow_up_1 already exists
      const existing = await db
        .select({ id: backlinkEmails.id })
        .from(backlinkEmails)
        .where(
          and(
            eq(backlinkEmails.prospectId, prospect.id),
            eq(backlinkEmails.emailType, "follow_up_1")
          )
        )
        .limit(1);
      if (existing.length > 0) continue;

      // Get original email for context
      const [originalEmail] = await db
        .select()
        .from(backlinkEmails)
        .where(
          and(
            eq(backlinkEmails.prospectId, prospect.id),
            eq(backlinkEmails.emailType, "initial")
          )
        )
        .limit(1);

      try {
        const prompt = `You are writing a brief, warm follow-up email for Dr. Pedram Shojai (The Urban Monk).
Context:
- Site we reached out to: ${prospect.domain}
- Page we referenced: ${prospect.pageTitle ?? prospect.pageUrl}
- Outreach type: ${prospect.outreachType === "guest_post" ? "Guest post offer" : "Resource page link request"}
- Original email subject: ${originalEmail?.subject ?? "our previous message"}

Write a gentle 3-sentence follow-up email.
- Friendly bump, assume they're busy, restate the value briefly
- NO structural labels (Hook:, CTA:, etc.)
- DO NOT use "I hope this email finds you well" or similar clichés
- Keep it under 80 words
- Sign off as Dr. Pedram Shojai
Return JSON: { "subject": "Re: [original subject]", "body": "..." }`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert email copywriter. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });
        const rawContent = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));

        await db.insert(backlinkEmails).values({
          prospectId: prospect.id,
          emailType: "follow_up_1",
          subject: parsed.subject ?? `Follow-up: ${originalEmail?.subject ?? "our collaboration"}`,
          body: parsed.body ?? "",
          status: "draft",
          gmailThreadId: originalEmail?.gmailThreadId ?? null,
          gmailMessageId: originalEmail?.gmailMessageId ?? null,
        });

        drafted1++;
        console.log(`[BacklinkFollowUp] Drafted follow-up #1 for prospect ${prospect.id} (${prospect.domain})`);
      } catch (e) {
        console.error(`[BacklinkFollowUp] Failed to draft follow-up #1 for ${prospect.domain}:`, e);
      }
    }

    // ── Follow-up #2: status="followed_up", lastFollowUpAt ≥ 7 days ago ───────
    const needFollowUp2 = await db
      .select()
      .from(backlinkProspects)
      .where(
        and(
          eq(backlinkProspects.status, "followed_up"),
          lte(backlinkProspects.lastFollowUpAt, cutoff)
        )
      )
      .limit(20);

    for (const prospect of needFollowUp2) {
      // Check if follow_up_2 already exists
      const existing = await db
        .select({ id: backlinkEmails.id })
        .from(backlinkEmails)
        .where(
          and(
            eq(backlinkEmails.prospectId, prospect.id),
            eq(backlinkEmails.emailType, "follow_up_2")
          )
        )
        .limit(1);
      if (existing.length > 0) continue;

      const [followUp1Email] = await db
        .select()
        .from(backlinkEmails)
        .where(
          and(
            eq(backlinkEmails.prospectId, prospect.id),
            eq(backlinkEmails.emailType, "follow_up_1")
          )
        )
        .limit(1);

      try {
        const prompt = `You are writing a final, brief check-in email for Dr. Pedram Shojai (The Urban Monk).
Context:
- Site we reached out to: ${prospect.domain}
- We've already sent 2 emails (initial + follow-up 1)
- This is our final follow-up

Write a 2-sentence final check-in email.
- Short, no pressure, leave the door open for future collaboration
- NO structural labels
- Keep it under 50 words
- Sign off as Dr. Pedram Shojai
Return JSON: { "subject": "Re: [previous subject]", "body": "..." }`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert email copywriter. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });
        const rawContent = response.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));

        await db.insert(backlinkEmails).values({
          prospectId: prospect.id,
          emailType: "follow_up_2",
          subject: parsed.subject ?? `Final follow-up: ${prospect.domain}`,
          body: parsed.body ?? "",
          status: "draft",
          gmailThreadId: followUp1Email?.gmailThreadId ?? null,
          gmailMessageId: followUp1Email?.gmailMessageId ?? null,
        });

        drafted2++;
        console.log(`[BacklinkFollowUp] Drafted follow-up #2 for prospect ${prospect.id} (${prospect.domain})`);
      } catch (e) {
        console.error(`[BacklinkFollowUp] Failed to draft follow-up #2 for ${prospect.domain}:`, e);
      }
    }

    // ── Notify owner if any follow-ups were drafted ───────────────────────────
    if (drafted1 > 0 || drafted2 > 0) {
      const lines: string[] = [
        `Backlink Follow-Up Auto-Draft — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        "═".repeat(50),
        "",
      ];
      if (drafted1 > 0) lines.push(`✉️ Follow-up #1 drafted for ${drafted1} prospect${drafted1 > 1 ? "s" : ""}`);
      if (drafted2 > 0) lines.push(`✉️ Follow-up #2 drafted for ${drafted2} prospect${drafted2 > 1 ? "s" : ""}`);
      lines.push("");
      lines.push("Review and approve these drafts in the Backlink Outreach dashboard.");
      lines.push("https://content.theurbanmonk.com/backlink-outreach");

      await notifyOwner({
        title: `🔗 Backlink Follow-Ups Ready — ${drafted1 + drafted2} draft${drafted1 + drafted2 > 1 ? "s" : ""}`,
        content: lines.join("\n"),
      });
    }

    return res.json({
      ok: true,
      drafted1,
      drafted2,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backlinkFollowUpHandler] Error:", msg);
    return res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}
