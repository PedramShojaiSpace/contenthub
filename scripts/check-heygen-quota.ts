import "dotenv/config";
import { ENV } from "../server/_core/env";

async function main() {
  const apiKey = ENV.heygenApiKey;

  // Full quota breakdown
  const res = await fetch("https://api.heygen.com/v2/user/remaining_quota", {
    headers: { "X-Api-Key": apiKey },
  });
  const json = await res.json() as any;
  console.log("=== Quota ===");
  console.log(JSON.stringify(json, null, 2));

  // User info / subscription
  const res2 = await fetch("https://api.heygen.com/v1/user.info", {
    headers: { "X-Api-Key": apiKey },
  });
  const json2 = await res2.json() as any;
  console.log("\n=== User Info ===");
  console.log(JSON.stringify(json2, null, 2));

  // Try generating a real (non-test) short video to see if it works
  console.log("\n=== Attempting real short render (non-test) ===");
  const body = {
    video_inputs: [{
      character: { type: "avatar", avatar_id: ENV.heygenAvatarId, avatar_style: "normal" },
      voice: { type: "text", input_text: "Hello. This is a test render to verify credits are working.", voice_id: ENV.heygenVoiceId, speed: 1.0 },
      background: { type: "color", value: "#f5f0e8" },
    }],
    dimension: { width: 1920, height: 1080 },
    aspect_ratio: null,
    test: false,
  };
  const res3 = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json3 = await res3.json() as any;
  console.log(`HTTP ${res3.status}:`, JSON.stringify(json3, null, 2));

  if (json3.data?.video_id) {
    // Poll once to see initial status
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.heygen.com/v1/video.status.get?video_id=${json3.data.video_id}`, {
      headers: { "X-Api-Key": apiKey },
    });
    const pollJson = await pollRes.json() as any;
    console.log(`\nStatus poll (3s later): HTTP ${pollRes.status}:`, JSON.stringify(pollJson, null, 2));
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
