/**
 * interconnectedRouter.ts
 * Handles opt-in registration for the Interconnected documentary series.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { sendGmailOutreach } from "./gmail";
import { notifyOwner } from "./_core/notification";

const KAJABI_TAG = "Interconnected Opt In";

function buildWelcomeEmail(name: string): string {
  const firstName = name.split(" ")[0] || name;
  return [
    "<!DOCTYPE html>",
    "<html><head><meta charset='UTF-8' /></head>",
    "<body style='margin:0;padding:0;background:#0a0a0a;font-family:Georgia,serif;'>",
    "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0a0a0a;padding:40px 20px;'>",
    "<tr><td align='center'>",
    "<table width='600' cellpadding='0' cellspacing='0' style='background:#111;border-radius:8px;border:1px solid #222;'>",
    "<tr><td style='background:#0d2a2a;padding:32px 40px;text-align:center;'>",
    "<p style='color:#4dd9ac;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;'>The Urban Monk Productions</p>",
    "<h1 style='color:#ffffff;font-size:28px;margin:0;font-weight:900;text-transform:uppercase;'>INTERCONNECTED</h1>",
    "<p style='color:#9ca3af;font-size:14px;margin:8px 0 0;font-style:italic;'>The Power to Heal From Within</p>",
    "</td></tr>",
    "<tr><td style='padding:40px;'>",
    `<p style='color:#e5e7eb;font-size:18px;margin:0 0 20px;'>Hi ${firstName},</p>`,
    "<p style='color:#d1d5db;font-size:16px;line-height:1.7;margin:0 0 20px;'>",
    "You are registered. Your free access to all 9 episodes of ",
    "<strong style='color:#4dd9ac;'>Interconnected: The Power to Heal From Within</strong> is confirmed.",
    "</p>",
    "<p style='color:#d1d5db;font-size:16px;line-height:1.7;margin:0 0 24px;'>",
    "This series features 70 of the world's leading doctors, researchers, and scientists revealing ",
    "the hidden root of chronic disease - and the breakthrough science that can heal it.",
    "</p>",
    "<table cellpadding='0' cellspacing='0' style='margin:0 auto 32px;'>",
    "<tr><td style='background:#14b8a6;border-radius:6px;padding:16px 40px;text-align:center;'>",
    "<a href='https://content.theurbanmonk.com/interconnected/watch' style='color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:1px;'>",
    "Watch Episode 1 Now</a></td></tr></table>",
    "<p style='color:#9ca3af;font-size:14px;margin:0 0 8px;'><strong style='color:#e5e7eb;'>What to expect:</strong></p>",
    "<ul style='color:#d1d5db;font-size:14px;line-height:1.9;margin:0 0 24px;padding-left:20px;'>",
    "<li>Episode 1 is available immediately</li>",
    "<li>New episodes release daily during the free viewing period</li>",
    "<li>You will receive an email reminder as each episode goes live</li>",
    "<li>Watch at your own pace before the free window closes</li>",
    "</ul>",
    "<p style='color:#d1d5db;font-size:16px;margin:0 0 4px;'>To your health,</p>",
    "<p style='color:#4dd9ac;font-size:16px;font-weight:700;margin:0;'>Dr. Pedram Shojai, OMD</p>",
    "<p style='color:#9ca3af;font-size:13px;margin:4px 0 0;'>Doctor of Oriental Medicine - Former Taoist Monk - NYT Bestselling Author</p>",
    "</td></tr>",
    "<tr><td style='background:#0a0a0a;padding:24px 40px;border-top:1px solid #222;'>",
    "<p style='color:#6b7280;font-size:11px;text-align:center;margin:0;line-height:1.6;'>",
    "The Urban Monk Productions - All Rights Reserved<br/>",
    "The information in this series is for educational purposes only and should not be construed as medical advice.<br/><br/>",
    "<a href='https://content.theurbanmonk.com/unsubscribe' style='color:#4dd9ac;'>Unsubscribe</a>",
    "</p></td></tr>",
    "</table></td></tr></table>",
    "</body></html>",
  ].join("");
}

export const interconnectedRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { name, email } = input;

      // 1. Kajabi — create contact and apply tag
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

      return { success: true, kajabiTagged, emailSent };
    }),
});
