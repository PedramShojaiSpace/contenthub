/**
 * kajabiRetryWorker.ts
 * Background worker that retries failed Kajabi tagging attempts from the dead letter queue.
 *
 * Runs every 15 minutes (started from server/_core/index.ts).
 * Picks up rows with status='pending' from kajabi_retry_queue,
 * retries up to 3 more times, then marks as 'success' or 'failed'.
 * Notifies owner on permanent failure.
 */

import { getDb } from "./db";
import { kajabiRetryQueue, interconnectedLeads } from "../drizzle/schema";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { notifyOwner } from "./_core/notification";
import { eq, and } from "drizzle-orm";

const WORKER_MAX_RETRIES = 3;
const WORKER_RETRY_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runKajabiRetryWorker(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[kajabiRetryWorker] No DB connection — skipping");
    return;
  }

  // Fetch all pending items
  let pendingItems: any[] = [];
  try {
    pendingItems = await db
      .select()
      .from(kajabiRetryQueue)
      .where(eq(kajabiRetryQueue.status, "pending"))
      .limit(50); // Process up to 50 at a time
  } catch (err) {
    console.error("[kajabiRetryWorker] Failed to fetch pending items:", err);
    return;
  }

  if (pendingItems.length === 0) {
    return; // Nothing to do
  }

  console.log(`[kajabiRetryWorker] Processing ${pendingItems.length} pending Kajabi retry items`);

  for (const item of pendingItems) {
    let success = false;
    let lastError = "";

    for (let attempt = 1; attempt <= WORKER_MAX_RETRIES; attempt++) {
      try {
        const contact = await kajabiCreateContact({ email: item.email, name: item.name });
        await kajabiAddTagByName({ contactId: contact.id, tagName: item.tag_name });
        success = true;
        break;
      } catch (err: any) {
        lastError = err?.message ?? String(err);
        console.warn(
          `[kajabiRetryWorker] Retry attempt ${attempt}/${WORKER_MAX_RETRIES} failed for ${item.email}: ${lastError}`
        );
        if (attempt < WORKER_MAX_RETRIES) {
          await sleep(WORKER_RETRY_DELAY_MS * attempt);
        }
      }
    }

    if (success) {
      // Mark as success in retry queue
      try {
        await db
          .update(kajabiRetryQueue)
          .set({ status: "success", lastAttemptAt: Date.now() })
          .where(eq(kajabiRetryQueue.id, item.id));
      } catch (_) {}

      // Update the lead record in interconnected_leads if we have a leadId
      if (item.lead_id) {
        try {
          await db
            .update(interconnectedLeads)
            .set({ kajabiTagged: true, kajabiTaggedAt: Date.now() })
            .where(eq(interconnectedLeads.id, item.lead_id));
        } catch (_) {}
      }

      console.log(`[kajabiRetryWorker] ✅ Successfully tagged ${item.email} in Kajabi`);
    } else {
      // Permanent failure — mark as failed and notify owner
      try {
        await db
          .update(kajabiRetryQueue)
          .set({
            status: "failed",
            lastAttemptAt: Date.now(),
            errorMessage: lastError.substring(0, 500),
          })
          .where(eq(kajabiRetryQueue.id, item.id));
      } catch (_) {}

      console.error(`[kajabiRetryWorker] ❌ Permanent failure for ${item.email}: ${lastError}`);

      try {
        await notifyOwner({
          title: "🚨 Kajabi Tag Permanently Failed",
          content: `Lead ${item.email} (${item.name}) could not be tagged in Kajabi after all retry attempts.\n\nTag: ${item.tag_name}\nLead DB ID: ${item.lead_id ?? "unknown"}\nLast error: ${lastError}\n\nManual intervention required — add this contact to the sequence manually in Kajabi.`,
        });
      } catch (_) {}
    }

    // Small delay between items to avoid hammering Kajabi API
    await sleep(500);
  }

  console.log(`[kajabiRetryWorker] Done processing ${pendingItems.length} items`);
}

/**
 * Start the retry worker on a 15-minute interval.
 * Call this once from server startup.
 */
export function startKajabiRetryWorker(): void {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  // Run once immediately on startup (catches any items that piled up during downtime)
  setTimeout(() => {
    runKajabiRetryWorker().catch((err) =>
      console.error("[kajabiRetryWorker] Uncaught error:", err)
    );
  }, 30_000); // 30s delay after startup to let DB connections settle

  // Then run every 15 minutes
  setInterval(() => {
    runKajabiRetryWorker().catch((err) =>
      console.error("[kajabiRetryWorker] Uncaught error:", err)
    );
  }, INTERVAL_MS);

  console.log("[kajabiRetryWorker] Started — will process pending Kajabi retries every 15 minutes");
}
