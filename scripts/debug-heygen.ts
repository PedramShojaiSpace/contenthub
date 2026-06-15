import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import { ENV } from "../server/_core/env";

async function main() {
  console.log("=== HeyGen Debug ===\n");

  // 1. Check recent video jobs
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const jobs = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    videoType: videoJobs.videoType,
    heygenVideoId: videoJobs.heygenVideoId,
    descriptProjectId: videoJobs.descriptProjectId,
    descriptImportJobId: videoJobs.descriptImportJobId,
    youtubeTitle: videoJobs.youtubeTitle,
    errorMessage: videoJobs.errorMessage,
    createdAt: videoJobs.createdAt,
    updatedAt: videoJobs.updatedAt,
  }).from(videoJobs).orderBy(desc(videoJobs.id)).limit(10);

  console.log("--- Recent Video Jobs ---");
  for (const j of jobs) {
    console.log(`Job #${j.id}: status=${j.status} videoType=${j.videoType ?? "standard"}`);
    console.log(`  title: ${(j.youtubeTitle ?? "").substring(0, 70)}`);
    console.log(`  heygenVideoId: ${j.heygenVideoId ?? "none"}`);
    console.log(`  descriptProjectId: ${j.descriptProjectId ?? "none"}`);
    if (j.errorMessage) console.log(`  ❌ error: ${j.errorMessage}`);
    console.log(`  created: ${j.createdAt} | updated: ${j.updatedAt}`);
    console.log();
  }

  // 2. Test HeyGen API directly — list recent videos
  console.log("--- HeyGen API: List Recent Videos ---");
  const apiKey = ENV.heygenApiKey;
  if (!apiKey) { console.error("HEYGEN_API_KEY not set"); process.exit(1); }

  const listRes = await fetch("https://api.heygen.com/v1/video.list?limit=5", {
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
  });
  console.log(`GET /v1/video.list → ${listRes.status}`);
  if (listRes.ok) {
    const json = await listRes.json() as { data?: { videos?: Array<{ video_id: string; status: string; created_at: number }> } };
    const videos = json.data?.videos ?? [];
    console.log(`Found ${videos.length} recent videos:`);
    for (const v of videos) {
      console.log(`  video_id=${v.video_id} status=${v.status} created=${new Date(v.created_at * 1000).toISOString()}`);
    }
  } else {
    console.log("Error:", await listRes.text());
  }

  // 3. Check if any avatar jobs have a heygenVideoId — poll their status
  const avatarJobs = jobs.filter(j => j.heygenVideoId);
  if (avatarJobs.length > 0) {
    console.log("\n--- Polling HeyGen Status for Jobs with heygenVideoId ---");
    for (const j of avatarJobs) {
      const statusRes = await fetch(`https://api.heygen.com/v1/video.status.get?video_id=${j.heygenVideoId}`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (statusRes.ok) {
        const json = await statusRes.json() as { data?: { status: string; video_url?: string; error?: { code: string; detail: string } } };
        const data = json.data;
        console.log(`Job #${j.id} → HeyGen ${j.heygenVideoId}: status=${data?.status}`);
        if (data?.error) console.log(`  error: ${data.error.code} — ${data.error.detail}`);
        if (data?.video_url) console.log(`  video_url: ${data.video_url}`);
      } else {
        console.log(`Job #${j.id} → HeyGen status check failed: ${statusRes.status}`);
      }
    }
  } else {
    console.log("\n⚠️  No jobs have a heygenVideoId set — HeyGen render was never started for any job.");
    console.log("This means processVideoJob() is not being called, OR it's failing silently before startHeyGenRender().");
  }

  // 4. Try a minimal HeyGen generate call to test the API
  console.log("\n--- Testing HeyGen Generate API (dry-run with test=true) ---");
  const avatarId = ENV.heygenAvatarId;
  const voiceId = ENV.heygenVoiceId;
  console.log(`Avatar ID: ${avatarId}`);
  console.log(`Voice ID: ${voiceId}`);

  const testBody = {
    video_inputs: [
      {
        character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: "This is a test. Hello from Urban Monk.", voice_id: voiceId, speed: 1.0 },
        background: { type: "color", value: "#f5f0e8" },
      },
    ],
    dimension: { width: 1920, height: 1080 },
    aspect_ratio: null,
    test: true, // test mode — no quota used
  };

  const genRes = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(testBody),
  });

  console.log(`POST /v2/video/generate (test=true) → ${genRes.status}`);
  const genJson = await genRes.json() as { error?: string | null; data?: { video_id: string } };
  if (genRes.ok && !genJson.error) {
    console.log(`✅ HeyGen generate API works! test video_id=${genJson.data?.video_id}`);
  } else {
    console.log(`❌ HeyGen generate failed:`, JSON.stringify(genJson, null, 2));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Debug script failed:", err);
  process.exit(1);
});
