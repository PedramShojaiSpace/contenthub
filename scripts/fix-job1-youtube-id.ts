import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  await db.update(videoJobs).set({
    youtubeVideoId: "3Q-jg4FIpEI",
    status: "uploaded_unlisted",
    errorMessage: null,
  }).where(eq(videoJobs.id, 1));

  console.log("✅ Job #1 updated: youtubeVideoId=3Q-jg4FIpEI, status=uploaded_unlisted");
  console.log("   YouTube URL: https://www.youtube.com/watch?v=3Q-jg4FIpEI");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
