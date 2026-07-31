/**
 * interconnectedRouter.ts
 * Handles opt-in registration for the Interconnected documentary series.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { notifyOwner } from "./_core/notification";

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
      const { name, email } = input;

      // 1. Kajabi — create contact and apply tag (Kajabi handles all email sequences)
      let kajabiTagged = false;
      try {
        const contact = await kajabiCreateContact({ email, name });
        await kajabiAddTagByName({ contactId: contact.id, tagName: KAJABI_TAG });
        kajabiTagged = true;
      } catch (err) {
        console.error("[interconnectedRouter] Kajabi error:", err);
      }

      // 2. Notify owner
      try {
        await notifyOwner({
          title: "New Interconnected Opt-In",
          content: `${name} (${email}) just registered for the Interconnected series.`,
        });
      } catch (_) {
        // Non-critical
      }

      return { success: true, kajabiTagged };
    }),
});
