import { Supadata } from "@supadata/js";
const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY });

console.log("Supadata instance keys:", Object.keys(supadata));
console.log("supadata.youtube:", typeof supadata.youtube, supadata.youtube ? Object.keys(supadata.youtube) : "undefined");

// Try the correct YouTube video metadata endpoint
const videoId = "dQw4w9WgXcQ";
const url = `https://www.youtube.com/watch?v=${videoId}`;

// Try different approaches
console.log("\n--- Trying supadata.youtube.getVideo ---");
try {
  const r = await supadata.youtube.getVideo({ videoId });
  console.log("getVideo result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("getVideo error:", e.message); }

console.log("\n--- Trying supadata.youtube.video with url ---");
try {
  const r = await supadata.youtube.video({ url });
  console.log("video(url) result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("video(url) error:", e.message); }

console.log("\n--- Trying supadata.youtube.channel ---");
try {
  const r = await supadata.youtube.channel({ channelId: "UCVcfMqBiXCiXHBe5CtEjHhA" });
  console.log("channel result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("channel error:", e.message); }

// Try the search endpoint to understand what's available
console.log("\n--- Trying supadata.youtube.search ---");
try {
  const r = await supadata.youtube.search({ query: "urban monk pedram", type: "video" });
  console.log("search result:", JSON.stringify(r).slice(0, 300));
} catch(e) { console.error("search error:", e.message); }
