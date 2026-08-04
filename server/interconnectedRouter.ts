/**
 * interconnectedRouter.ts
 * Handles opt-in registration for the Interconnected documentary series.
 *
 * Flow:
 * 1. Validate email (reject disposable/throwaway domains)
 * 2. Save lead to local DB immediately (safety backup — never lose a lead)
 * 3. Tag in Kajabi (create contact + apply "Interconnected Opt In" tag)
 *    - Up to 3 retries with 2s backoff
 *    - On all-retry failure: write to kajabi_retry_queue dead letter queue + notify owner
 * 4. Sync to Klaviyo (profile + optional SMS subscription)
 * 5. CAPI — fire Lead event server-side
 * 6. Update DB row with Kajabi/Klaviyo success flags
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { kajabiCreateContact, kajabiAddTagByName, kajabiSubmitForm } from "./kajabiApi";
import { pushInterconnectedOptIn } from "./klaviyo";
import { validateEmail } from "./emailScrubber";
import { getDb } from "./db";
import { interconnectedLeads, kajabiRetryQueue } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { eq, sql, gte, lte, and } from "drizzle-orm";
import { sendCapiEvent, generateEventId } from "./capiHelper";

const KAJABI_TAG = "Interconnected Opt In";
// Form ID for "IC META LEADS - SP 26 Test" — submitting this form is the
// ONLY reliable way to trigger the Interconnected sequence from Day 0.
// Kajabi does NOT fire sequence triggers when a tag is applied to existing contacts.
const KAJABI_SEQUENCE_FORM_ID = "2149563926";
const KAJABI_MAX_RETRIES = 3;
const KAJABI_RETRY_DELAY_MS = 2000;

/** Sleep helper for retry backoff */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to enroll a contact in Kajabi with linear backoff.
 *
 * Strategy (two-step for reliability):
 * 1. Submit the sequence trigger form — this ALWAYS fires Day 0 for both new
 *    and existing contacts (form submission is the only reliable sequence trigger).
 * 2. Also apply the tag directly — belt-and-suspenders for other automations.
 *
 * Returns { success, contactId?, error? }
 */
async function kajabiTagWithRetry(
  email: string,
  name: string
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= KAJABI_MAX_RETRIES; attempt++) {
    try {
      // Step 1: Submit the form — triggers the sequence from Day 0 reliably
      await kajabiSubmitForm({
        formId: KAJABI_SEQUENCE_FORM_ID,
        email,
        name,
      });

      // Step 2: Also create/update the contact and apply the tag
      // (non-fatal if this fails — the form submission already enrolled them)
      let contactId: string | undefined;
      try {
        const contact = await kajabiCreateContact({ email, name });
        await kajabiAddTagByName({ contactId: contact.id, tagName: KAJABI_TAG });
        contactId = contact.id;
      } catch (tagErr: any) {
        console.warn(
          `[interconnectedRouter] Tag step failed for ${email} (form submit succeeded): ${tagErr?.message}`
        );
      }

      return { success: true, contactId };
    } catch (err: any) {
      lastError = err?.message ?? String(err);
      console.warn(
        `[interconnectedRouter] Kajabi attempt ${attempt}/${KAJABI_MAX_RETRIES} failed for ${email}: ${lastError}`
      );
      if (attempt < KAJABI_MAX_RETRIES) {
        await sleep(KAJABI_RETRY_DELAY_MS * attempt); // 2s, 4s
      }
    }
  }
  return { success: false, error: lastError };
}

export const interconnectedRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
        smsConsent: z.boolean().optional(),
        utmSource: z.string().max(128).optional(),
        utmMedium: z.string().max(128).optional(),
        utmCampaign: z.string().max(128).optional(),
        utmContent: z.string().max(128).optional(),
        referrer: z.string().max(512).optional(),
        pageVariant: z.enum(['A', 'B']).optional().default('A'),
        // Client-side signals for CAPI matching
        fbclid: z.string().max(256).optional(),
        fbp: z.string().max(256).optional(),
        fbc: z.string().max(256).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name, email, phone, smsConsent, utmSource, utmMedium, utmCampaign, utmContent, referrer, pageVariant, fbclid, fbp, fbc } = input;
      const clientIp = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.socket?.remoteAddress || null;
      const userAgent = ctx.req.headers["user-agent"] || null;

      // ── Step 1: Validate email — reject disposable/throwaway domains ──────────
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: emailCheck.reason ?? "Invalid email address",
        });
      }

      // ── Step 2: Save to local DB immediately (safety backup) ──────────────────
      let localLeadId: number | null = null;
      try {
        const db = await getDb();
        if (db) {
          const result = await db.insert(interconnectedLeads).values({
            email: email.toLowerCase().trim(),
            name: name.trim(),
            phone: phone ?? null,
            smsConsent: smsConsent ?? false,
            utmSource: utmSource ?? null,
            utmMedium: utmMedium ?? null,
            utmCampaign: utmCampaign ?? null,
            utmContent: utmContent ?? null,
            referrer: referrer ?? null,
            pageVariant: pageVariant ?? 'A',
            fbclid: fbclid ?? null,
            fbp: fbp ?? null,
            fbc: fbc ?? null,
            clientIp: clientIp ?? null,
            userAgent: userAgent ? userAgent.substring(0, 512) : null,
            kajabiTagged: false,
            klaviyoSynced: false,
            createdAt: Date.now(),
          });
          localLeadId = (result as any).insertId ?? null;
          console.log(`[interconnectedRouter] Lead saved to DB: ${email} (id: ${localLeadId})`);
        }
      } catch (err) {
        // Non-fatal — log but don't block the registration
        // The lead will still go to Kajabi/Klaviyo even if DB is temporarily unavailable
        console.error("[interconnectedRouter] DB save error:", err);
      }

      // ── Step 3: Kajabi — create contact and apply tag (with retry + DLQ) ──────
      let kajabiTagged = false;
      const kajabiResult = await kajabiTagWithRetry(
        email.toLowerCase().trim(),
        name.trim()
      );

      if (kajabiResult.success) {
        kajabiTagged = true;
        // Update DB row with Kajabi success
        if (localLeadId) {
          try {
            const db = await getDb();
            if (db) {
              await db
                .update(interconnectedLeads)
                .set({ kajabiTagged: true, kajabiTaggedAt: Date.now() })
                .where(eq(interconnectedLeads.id, localLeadId));
            }
          } catch (_) {}
        }
      } else {
        // All retries exhausted — write to dead letter queue
        console.error(
          `[interconnectedRouter] Kajabi all retries failed for ${email}: ${kajabiResult.error}. Writing to retry queue.`
        );
        try {
          const db = await getDb();
          if (db) {
            await db.insert(kajabiRetryQueue).values({
              email: email.toLowerCase().trim(),
              name: name.trim(),
              leadId: localLeadId ?? undefined,
              tagName: KAJABI_TAG,
              attempts: KAJABI_MAX_RETRIES,
              lastAttemptAt: Date.now(),
              status: "pending",
              errorMessage: kajabiResult.error?.substring(0, 500) ?? "Unknown error",
              createdAt: Date.now(),
            } as any);
            console.log(`[interconnectedRouter] Written to kajabi_retry_queue: ${email}`);
          }
        } catch (dlqErr) {
          console.error("[interconnectedRouter] Failed to write to retry queue:", dlqErr);
        }

        // Notify owner of persistent failure
        try {
          await notifyOwner({
            title: "⚠️ Kajabi Tag Failed — Lead in Retry Queue",
            content: `Lead ${email} (${name}) failed Kajabi tagging after ${KAJABI_MAX_RETRIES} attempts.\n\nError: ${kajabiResult.error}\n\nLead saved in DB (id: ${localLeadId ?? "unknown"}). Background worker will retry every 15 min.`,
          });
        } catch (_) {}
      }

      // ── Step 4: Klaviyo — push profile + subscribe to SMS list if consent given ─
      let smsSubscribed = false;
      try {
        const result = await pushInterconnectedOptIn({
          email,
          firstName: name.split(" ")[0],
          phone: phone ?? undefined,
          smsConsent: smsConsent ?? false,
        });
        smsSubscribed = result.smsSubscribed;
        if (smsSubscribed) {
          console.log(`[interconnectedRouter] Klaviyo SMS subscribed: ${email} (${phone})`);
        }

        // Update DB row with Klaviyo success
        if (localLeadId) {
          try {
            const db = await getDb();
            if (db) {
              await db
                .update(interconnectedLeads)
                .set({ klaviyoSynced: true, klaviyoSyncedAt: Date.now() })
                .where(eq(interconnectedLeads.id, localLeadId));
            }
          } catch (_) {}
        }
      } catch (err) {
        // Non-fatal — log but don't fail the registration
        console.error("[interconnectedRouter] Klaviyo error:", err);
      }

      // ── Step 5: CAPI — fire Lead event server-side ────────────────────────────
      const capiLeadEventId = generateEventId(email, "Lead");
      try {
        const capiSent = await sendCapiEvent({
          eventName: "Lead",
          eventId: capiLeadEventId,
          eventSourceUrl: "https://content.theurbanmonk.com/interconnected",
          email,
          phone: phone ?? null,
          fbclid: fbclid ?? null,
          fbp: fbp ?? null,
          fbc: fbc ?? null,
          clientIpAddress: clientIp,
          clientUserAgent: userAgent,
          utmCampaign: utmCampaign ?? null,
          utmSource: utmSource ?? null,
        });
        if (capiSent && localLeadId) {
          try {
            const db = await getDb();
            if (db) {
              await db
                .update(interconnectedLeads)
                .set({ capiLeadSent: true, capiLeadEventId, capiLeadSentAt: Date.now() })
                .where(eq(interconnectedLeads.id, localLeadId));
            }
          } catch (_) {}
        }
      } catch (err) {
        console.error("[interconnectedRouter] CAPI Lead error:", err);
      }

      return { success: true, kajabiTagged, smsSubscribed, capiLeadEventId };
    }),
  getVariantStats: publicProcedure
    .input(z.object({
      startTs: z.number().optional(),
      endTs: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { A: 0, B: 0, total: 0 };
      const conditions: any[] = [];
      if (input.startTs) conditions.push(gte(interconnectedLeads.createdAt, input.startTs));
      if (input.endTs) conditions.push(lte(interconnectedLeads.createdAt, input.endTs));
      const rows = await db
        .select({ variant: interconnectedLeads.pageVariant, count: sql`count(*)` })
        .from(interconnectedLeads)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(interconnectedLeads.pageVariant);
      const A = rows.find(r => r.variant === 'A')?.count ?? 0;
      const B = rows.find(r => r.variant === 'B')?.count ?? 0;
      return { A: Number(A), B: Number(B), total: Number(A) + Number(B) };
    }),
});
