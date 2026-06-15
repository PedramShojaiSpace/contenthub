import "dotenv/config";
import { ENV } from "../server/_core/env";

async function main() {
  const apiKey = ENV.heygenApiKey;
  console.log("=== HeyGen 404 Diagnosis ===\n");

  // 1. Check the specific video_id that 404'd
  const videoId = "1526e8bc313b451c855d8391ecdeee97";
  console.log(`1. Polling video_id: ${videoId}`);
  const statusRes = await fetch(`https://api.heygen.com/v1/video.status.get?video_id=${videoId}`, {
    headers: { "X-Api-Key": apiKey },
  });
  console.log(`   HTTP ${statusRes.status}: ${await statusRes.text()}\n`);

  // 2. List all recent videos to see what's actually there
  console.log("2. Listing recent HeyGen videos...");
  const listRes = await fetch("https://api.heygen.com/v1/video.list?limit=10", {
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
  });
  console.log(`   HTTP ${listRes.status}`);
  if (listRes.ok) {
    const json = await listRes.json() as any;
    const videos = json.data?.videos ?? [];
    console.log(`   Found ${videos.length} videos:`);
    for (const v of videos) {
      console.log(`   - ${v.video_id} | status=${v.status} | created=${new Date(v.created_at * 1000).toISOString()}`);
      if (v.error) console.log(`     error: ${JSON.stringify(v.error)}`);
    }
  } else {
    console.log("   Error:", await listRes.text());
  }

  // 3. Check account quota/remaining credits
  console.log("\n3. Checking account remaining quota...");
  const quotaRes = await fetch("https://api.heygen.com/v2/user/remaining_quota", {
    headers: { "X-Api-Key": apiKey },
  });
  console.log(`   HTTP ${quotaRes.status}: ${await quotaRes.text()}`);

  // 4. Try a minimal single-clip test (very short text)
  console.log("\n4. Testing minimal single-clip generate (test=true)...");
  const testBody = {
    video_inputs: [{
      character: { type: "avatar", avatar_id: ENV.heygenAvatarId, avatar_style: "normal" },
      voice: { type: "text", input_text: "Hello. This is a test.", voice_id: ENV.heygenVoiceId, speed: 1.0 },
      background: { type: "color", value: "#f5f0e8" },
    }],
    dimension: { width: 1920, height: 1080 },
    aspect_ratio: null,
    test: true,
  };
  const testRes = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(testBody),
  });
  const testJson = await testRes.json() as any;
  console.log(`   HTTP ${testRes.status}:`, JSON.stringify(testJson, null, 2));

  // 5. Try a 3-clip generate with test=true to check if multi-clip is supported
  console.log("\n5. Testing 3-clip multi-clip generate (test=true)...");
  const multiBody = {
    video_inputs: [
      {
        character: { type: "avatar", avatar_id: ENV.heygenAvatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: "This is clip one. It contains the first part of the script.", voice_id: ENV.heygenVoiceId, speed: 1.0 },
        background: { type: "color", value: "#f5f0e8" },
      },
      {
        character: { type: "avatar", avatar_id: ENV.heygenAvatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: "This is clip two. It contains the second part.", voice_id: ENV.heygenVoiceId, speed: 1.0 },
        background: { type: "color", value: "#f5f0e8" },
      },
      {
        character: { type: "avatar", avatar_id: ENV.heygenAvatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: "This is clip three. The final part of the script.", voice_id: ENV.heygenVoiceId, speed: 1.0 },
        background: { type: "color", value: "#f5f0e8" },
      },
    ],
    dimension: { width: 1920, height: 1080 },
    aspect_ratio: null,
    test: true,
  };
  const multiRes = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(multiBody),
  });
  const multiJson = await multiRes.json() as any;
  console.log(`   HTTP ${multiRes.status}:`, JSON.stringify(multiJson, null, 2));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
