/**
 * Weekly Digest — Urban Monk Productions Content Hub
 *
 * Runs every Monday at 8:00 AM server time.
 * Compiles a summary of:
 *   - Content scheduled for the current week
 *   - Items stuck in Review for 3+ days
 *   - Ideas aging in the backlog for 7+ days
 *
 * Sends via the notifyOwner helper.
 */

import { notifyOwner } from "./_core/notification";
import { listContentItems } from "./db";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * ONE_DAY_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export async function sendWeeklyDigest(): Promise<void> {
  try {
    const items = await listContentItems();
    const now = Date.now();

    // Start/end of the current week (Mon–Sun)
    const weekStart = getWeekStart();
    const weekEnd = weekStart + 7 * ONE_DAY_MS;

    // Items scheduled this week
    const scheduledThisWeek = items.filter(
      (i) => i.scheduledAt && i.scheduledAt >= weekStart && i.scheduledAt < weekEnd
    );

    // Items stuck in Review for 3+ days
    const stuckInReview = items.filter((i) => {
      if (i.status !== "review") return false;
      const age = now - new Date(i.updatedAt).getTime();
      return age >= THREE_DAYS_MS;
    });

    // Ideas aging 7+ days in backlog
    const agingIdeas = items.filter((i) => {
      if (i.status !== "idea") return false;
      const age = now - new Date(i.createdAt).getTime();
      return age >= SEVEN_DAYS_MS;
    });

    const weekLabel = new Date(weekStart).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    let content = `Weekly Content Hub Summary — Week of ${weekLabel}\n\n`;

    // Scheduled this week
    content += `📅 SCHEDULED THIS WEEK (${scheduledThisWeek.length} items)\n`;
    if (scheduledThisWeek.length === 0) {
      content += "  Nothing scheduled yet — time to move some approved content to the calendar.\n";
    } else {
      scheduledThisWeek.forEach((i) => {
        const date = i.scheduledAt
          ? new Date(i.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          : "unscheduled";
        content += `  • [${i.platform.toUpperCase()}] ${i.title} — ${date}\n`;
      });
    }

    content += "\n";

    // Stuck in review
    content += `⚠️ STUCK IN REVIEW 3+ DAYS (${stuckInReview.length} items)\n`;
    if (stuckInReview.length === 0) {
      content += "  All clear — no items stuck in review.\n";
    } else {
      stuckInReview.forEach((i) => {
        const days = Math.floor((now - new Date(i.updatedAt).getTime()) / ONE_DAY_MS);
        content += `  • [${i.platform.toUpperCase()}] ${i.title} — ${days} days in review\n`;
      });
    }

    content += "\n";

    // Aging ideas
    content += `💡 AGING IDEAS 7+ DAYS (${agingIdeas.length} items)\n`;
    if (agingIdeas.length === 0) {
      content += "  No stale ideas — great backlog hygiene!\n";
    } else {
      agingIdeas.forEach((i) => {
        const days = Math.floor((now - new Date(i.createdAt).getTime()) / ONE_DAY_MS);
        content += `  • [${i.platform.toUpperCase()}] ${i.title} — ${days} days old\n`;
      });
    }

    content += "\n— Urban Monk Productions Content Hub";

    await notifyOwner({
      title: `📋 Weekly Content Digest — ${scheduledThisWeek.length} scheduled, ${stuckInReview.length} stuck, ${agingIdeas.length} aging`,
      content,
    });

    console.log("[Digest] Weekly digest sent successfully.");
  } catch (err) {
    console.error("[Digest] Failed to send weekly digest:", err);
  }
}

/**
 * Returns the UTC timestamp for the start of the current week (Monday 00:00 UTC).
 */
function getWeekStart(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? -6 : 1 - day); // days back to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Start the weekly digest cron — fires every Monday at 8:00 AM UTC.
 * Uses a simple setInterval-based approach compatible with any Node.js runtime.
 */
export function startWeeklyDigestCron(): void {
  console.log("[Digest] Weekly digest cron started — fires every Monday at 08:00 UTC.");

  function scheduleNext() {
    const msUntilNextMonday = getMsUntilNextMonday8AM();
    console.log(
      `[Digest] Next digest in ${Math.round(msUntilNextMonday / 1000 / 60)} minutes.`
    );
    setTimeout(async () => {
      await sendWeeklyDigest();
      // Schedule the next one a week later
      setTimeout(scheduleNext, 0);
    }, msUntilNextMonday);
  }

  scheduleNext();
}

/**
 * Returns milliseconds until next Monday at 08:00 UTC.
 */
function getMsUntilNextMonday8AM(): number {
  const now = new Date();
  const target = new Date(now);

  // Find next Monday
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  let daysUntilMonday = (8 - day) % 7; // days until next Monday
  if (daysUntilMonday === 0) {
    // It's Monday — check if 8AM has passed
    const currentHour = now.getUTCHours();
    if (currentHour >= 8) {
      daysUntilMonday = 7; // next Monday
    }
  }

  target.setUTCDate(now.getUTCDate() + daysUntilMonday);
  target.setUTCHours(8, 0, 0, 0);

  return target.getTime() - now.getTime();
}
