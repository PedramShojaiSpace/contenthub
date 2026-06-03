import { Supadata } from "@supadata/js";
const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY });

const videoId = "dQw4w9WgXcQ";
const url = `https://www.youtube.com/watch?v=${videoId}`;

// Try different parameter formats for supadata.youtube.video
console.log("--- Trying { id: videoId } ---");
try {
  const r = await supadata.youtube.video({ id: videoId });
  console.log("id result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("id error:", e.message, e?.response?.data ? JSON.stringify(e.response.data) : ""); }

console.log("\n--- Trying { videoId: videoId } ---");
try {
  const r = await supadata.youtube.video({ videoId });
  console.log("videoId result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("videoId error:", e.message, e?.response?.data ? JSON.stringify(e.response.data) : ""); }

console.log("\n--- Trying just the url string ---");
try {
  const r = await supadata.youtube.video(url);
  console.log("string url result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("string url error:", e.message); }

// Check what the Supadata SDK's youtube.video method signature looks like
console.log("\n--- Checking SDK source ---");
console.log("youtube.video type:", typeof supadata.youtube.video);
console.log("youtube.video.toString():", supadata.youtube.video.toString().slice(0, 500));
