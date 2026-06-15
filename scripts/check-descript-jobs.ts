/**
 * Check the Descript agent job status for video jobs 30001 and 30002
 */
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq, or } from "drizzle-orm";
import { getJobStatus } from "../server/descriptClient";

async function main() {
  const db = await getDb();
  if (!db) { console.log("DB unavailable"); return; }

  const jobs = await db.select().from(videoJobs).where(or(eq(videoJobs.id, 30001), eq(videoJobs.id, 30002)));

  for (const job of jobs) {
    console.log(`\n=== Job #${job.id}: ${job.youtubeTitle} ===`);
    console.log(`  DB status: ${job.status}`);
    console.log(`  descriptProjectId: ${job.descriptProjectId}`);
    console.log(`  descriptImportJobId: ${job.descriptImportJobId}`);
    console.log(`  descriptAgentJobId: ${job.descriptAgentJobId}`);
    console.log(`  descriptPublishJobId: ${job.descriptPublishJobId}`);
    console.log(`  errorMessage: ${job.errorMessage}`);
    console.log(`  updatedAt: ${job.updatedAt}`);

    if (job.descriptImportJobId) {
      try {
        const importStatus = await getJobStatus(job.descriptImportJobId);
        console.log(`  Descript importJob state: ${importStatus.job_state}`);
        if (importStatus.result) {
          console.log(`  Descript importJob result: ${JSON.stringify(importStatus.result).substring(0, 200)}`);
        }
      } catch (e) {
        console.log(`  Error checking importJob: ${e}`);
      }
    }

    if (job.descriptAgentJobId) {
      try {
        const agentStatus = await getJobStatus(job.descriptAgentJobId);
        console.log(`  Descript agentJob state: ${agentStatus.job_state}`);
      } catch (e) {
        console.log(`  Error checking agentJob: ${e}`);
      }
    }
  }
}

main().catch(console.error);
