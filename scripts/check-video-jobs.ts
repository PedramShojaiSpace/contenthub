import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("DB unavailable"); return; }

  const rows = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    videoType: videoJobs.videoType,
    youtubeTitle: videoJobs.youtubeTitle,
    descriptProjectId: videoJobs.descriptProjectId,
    descriptShareUrl: videoJobs.descriptShareUrl,
    descriptDownloadUrl: videoJobs.descriptDownloadUrl,
    s3VideoUrl: videoJobs.s3VideoUrl,
    s3VideoKey: videoJobs.s3VideoKey,
    youtubeVideoId: videoJobs.youtubeVideoId,
    errorMessage: videoJobs.errorMessage,
    heygenVideoId: videoJobs.heygenVideoId,
    retryCount: videoJobs.retryCount,
    vaApprovedAt: videoJobs.vaApprovedAt,
    createdAt: videoJobs.createdAt,
    updatedAt: videoJobs.updatedAt,
  }).from(videoJobs).orderBy(desc(videoJobs.createdAt)).limit(10);

  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
