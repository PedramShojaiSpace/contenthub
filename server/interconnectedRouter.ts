/**
 * interconnectedRouter.ts
 * Handles opt-in registration for the Interconnected documentary series.
 *
 * Flow:
 * 1. Validate email (reject disposable/throwaway domains)
 * 2. Save lead to local DB immediately (safety backup — never lose a lead)
 * 3. Tag in Kajabi (create contact + apply "Interconnected Opt In" tag)
 * 4. Sync to Klaviyo (profile + optional SMS subscription)
 * 5. Notify owner
 * 6. Update DB row with Kajabi/Klaviyo success flags
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { pushInterconnectedOptIn } from "./klaviyo";
import { validateEmail } from "./emailScrubber";
import { getDb } from "./db";
import { interconnectedLeads } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendCapiEvent, generateEventId } from "./capiHelper";

const KAJABI_TAG = "Interconnected Opt In";

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

      // ── Step 3: Kajabi — create contact and apply tag ─────────────────────────
      let kajabiTagged = false;
      try {
        const contact = await kajabiCreateContact({ email, name });
        await kajabiAddTagByName({ contactId: contact.id, tagName: KAJABI_TAG });
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
      } catch (err) {
        console.error("[interconnectedRouter] Kajabi error:", err);
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
});
