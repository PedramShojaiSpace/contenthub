import { Supadata } from "@supadata/js";
const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY });

// Test with a known Urban Monk video
const videoId = "dQw4w9WgXcQ";
const url = `https://www.youtube.com/watch?v=${videoId}`;

console.log("Testing transcript fetch for:", videoId);
try {
  const result = await supadata.transcript({ url, text: true, lang: "en", mode: "native" });
  console.log("Result keys:", Object.keys(result));
  console.log("Has jobId:", "jobId" in result);
  console.log("Has content:", "content" in result);
  const content = result.content;
  console.log("Content type:", typeof content);
  console.log("Content length:", content ? String(content).length : 0);
  console.log("First 300 chars:", content ? String(content).slice(0, 300) : "(empty)");
} catch(e) {
  console.error("Error:", e.message);
  if (e.response) {
    console.error("Response status:", e.response.status);
    console.error("Response data:", JSON.stringify(e.response.data));
  }
}

// Also test with mode: "auto" as fallback
console.log("\n--- Testing with mode: auto ---");
try {
  const result2 = await supadata.transcript({ url, text: true, lang: "en", mode: "auto" });
  console.log("Auto mode result keys:", Object.keys(result2));
  const content2 = result2.content;
  console.log("Auto content length:", content2 ? String(content2).length : 0);
  console.log("First 300 chars:", content2 ? String(content2).slice(0, 300) : "(empty)");
} catch(e) {
  console.error("Auto mode error:", e.message);
}
