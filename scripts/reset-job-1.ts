/**
 * One-time script: reset video job #1 back to ready_for_review
 * so the VA can click "Approve & Upload to YouTube" again.
 *
 * The descriptDownloadUrl (real GCS signed MP4) is still valid today.
 * The fixed approveVideoJob will use that directly — no Descript re-export needed.
 */
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("DB unavailable"); return; }

  await db.update(videoJobs).set({
    status: "ready_for_review",
    errorMessage: null,
  }).where(eq(videoJobs.id, 1));

  const rows = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    errorMessage: videoJobs.errorMessage,
    descriptDownloadUrl: videoJobs.descriptDownloadUrl,
  }).from(videoJobs).where(eq(videoJobs.id, 1)).limit(1);

  console.log("Job #1 reset:", JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
