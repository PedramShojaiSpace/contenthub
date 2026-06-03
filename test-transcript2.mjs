import { Supadata } from "@supadata/js";
const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY });

// Test with Urban Monk channel videos - try a few different ones
const testVideos = [
  { id: "dQw4w9WgXcQ", label: "Rick Astley (known to have captions)" },
  { id: "jNQXAC9IVRw", label: "First YouTube video ever" },
];

for (const video of testVideos) {
  const url = `https://www.youtube.com/watch?v=${video.id}`;
  console.log(`\nTesting: ${video.label} (${video.id})`);
  try {
    const result = await supadata.transcript({ url, text: true, lang: "en", mode: "native" });
    const content = result.content;
    const length = content ? String(content).length : 0;
    console.log(`  ✓ Transcript length: ${length} chars`);
    if (length > 0) {
      console.log(`  First 100 chars: ${String(content).slice(0, 100)}`);
    }
  } catch(e) {
    console.error(`  ✗ Error: ${e.message}`);
    if (e.response?.data) console.error(`  Response: ${JSON.stringify(e.response.data)}`);
  }
}

// Also test the fetchVideoMetadata path via Supadata youtube.video
console.log("\n--- Testing video metadata fetch ---");
try {
  const result = await supadata.youtube.video({ videoId: "dQw4w9WgXcQ" });
  console.log("Metadata keys:", Object.keys(result || {}));
  console.log("Title:", result?.title);
  console.log("Channel:", result?.channel?.name);
} catch(e) {
  console.error("Metadata error:", e.message);
  // Try alternative approach
  console.log("Trying alternative metadata approach...");
  try {
    const r2 = await supadata.youtube.video({ videoId: "dQw4w9WgXcQ" });
    console.log("Alt result:", JSON.stringify(r2).slice(0, 200));
  } catch(e2) {
    console.error("Alt error:", e2.message);
  }
}
