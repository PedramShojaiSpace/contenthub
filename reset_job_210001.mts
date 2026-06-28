import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc } from "drizzle-orm";
import { videoJobs } from "./drizzle/schema.js";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(conn);

// First, list recent jobs to find the right one
const recent = await db
  .select({
    id: videoJobs.id,
    status: videoJobs.status,
    productionPath: videoJobs.productionPath,
    heygenVideoId: videoJobs.heygenVideoId,
    youtubeVideoId: videoJobs.youtubeVideoId,
    createdAt: videoJobs.createdAt,
  })
  .from(videoJobs)
  .orderBy(desc(videoJobs.id))
  .limit(5);

console.log("Recent video jobs:");
recent.forEach(j => console.log(`  ID ${j.id}: status=${j.status}, path=${j.productionPath}, heygenId=${j.heygenVideoId ?? "none"}, ytId=${j.youtubeVideoId ?? "none"}, created=${j.createdAt}`));

// Find the most recent job that has a heygenVideoId (the broken one)
const brokenJob = recent.find(j => j.heygenVideoId || j.youtubeVideoId || j.status === "ready_for_review" || j.status === "completed");

if (!brokenJob) {
  console.log("\nNo broken job found in recent 5. Resetting the most recent job instead.");
  const target = recent[0];
  if (!target) { console.log("No jobs found at all."); await conn.end(); process.exit(0); }
  
  await db.update(videoJobs).set({
    status: "pending",
    heygenVideoId: null,
    youtubeVideoId: null,
    descriptProjectId: null,
    descriptImportJobId: null,
    descriptAgentJobId: null,
    descriptPublishJobId: null,
    descriptShareUrl: null,
    descriptDownloadUrl: null,
    s3VideoKey: null,
    s3VideoUrl: null,
    errorMessage: null,
    productionPath: "heygen_then_descript",
    retryCount: 0,
    vaApprovedAt: null,
    publishedAt: null,
  }).where(eq(videoJobs.id, target.id));
  console.log(`\n✅ Job ${target.id} reset to pending with productionPath: heygen_then_descript`);
} else {
  await db.update(videoJobs).set({
    status: "pending",
    heygenVideoId: null,
    youtubeVideoId: null,
    descriptProjectId: null,
    descriptImportJobId: null,
    descriptAgentJobId: null,
    descriptPublishJobId: null,
    descriptShareUrl: null,
    descriptDownloadUrl: null,
    s3VideoKey: null,
    s3VideoUrl: null,
    errorMessage: null,
    productionPath: "heygen_then_descript",
    retryCount: 0,
    vaApprovedAt: null,
    publishedAt: null,
  }).where(eq(videoJobs.id, brokenJob.id));
  console.log(`\n✅ Job ${brokenJob.id} reset to pending with productionPath: heygen_then_descript`);
}

console.log("\nNext step: Go to ch.theurbanmonk.com/va");
console.log("Find the job → confirm 'HeyGen + Descript (B-roll)' is selected → click Generate Avatar Video");

await conn.end();
