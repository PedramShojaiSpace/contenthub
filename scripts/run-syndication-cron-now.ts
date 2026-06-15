/**
 * Manually trigger the syndication cron to process all pending due jobs.
 * Use this when jobs are stuck or you want to process them before the 08:00 UTC daily run.
 */
import { handleSyndicationCron } from "../server/syndicationRouter";

async function run() {
  console.log("[Manual Cron] Running syndication cron...");
  const result = await handleSyndicationCron({ headers: {} });
  console.log(`\n[Manual Cron] Done. Processed ${result.processed} job(s):`);
  for (const r of result.results) {
    const icon = r.status === "published" ? "✅" : r.status === "failed" ? "❌" : "⏳";
    console.log(`  ${icon} [${r.jobId}] ${r.platform}: ${r.status}${r.url ? ` → ${r.url}` : ""}${r.error ? ` — ${r.error}` : ""}`);
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
