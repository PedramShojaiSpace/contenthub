/**
 * interconnectedRouter.ts
 * Handles opt-in registration for the Interconnected documentary series.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { notifyOwner } from "./_core/notification";
import { pushInterconnectedOptIn } from "./klaviyo";

const KAJABI_TAG = "Interconnected Opt In";

export const interconnectedRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
        smsConsent: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { name, email, phone, smsConsent } = input;

      // 1. Kajabi — create contact and apply tag (Kajabi handles all email sequences)
      let kajabiTagged = false;
      try {
        const contact = await kajabiCreateContact({ email, name });
        await kajabiAddTagByName({ contactId: contact.id, tagName: KAJABI_TAG });
        kajabiTagged = true;
      } catch (err) {
        console.error("[interconnectedRouter] Kajabi error:", err);
      }

      // 2. Klaviyo — push profile + subscribe to SMS list if consent given
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
      } catch (err) {
        // Non-fatal — log but don't fail the registration
        console.error("[interconnectedRouter] Klaviyo error:", err);
      }

      // 3. Notify owner
      try {
        const smsNote = smsConsent && phone ? ` | SMS: ${phone} ✓` : "";
        await notifyOwner({
          title: "New Interconnected Opt-In",
          content: `${name} (${email}) just registered for the Interconnected series.${smsNote}`,
        });
      } catch (_) {
        // Non-critical
      }

      return { success: true, kajabiTagged, smsSubscribed };
    }),
});
