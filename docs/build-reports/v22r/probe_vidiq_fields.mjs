/**
 * Part 1 supporting probe — dumps the FULL first video object from both vidIQ
 * video tools so the wrapper interfaces can be mapped to real field names.
 *
 * Written because the live proof printed `undefined` for every title: the
 * declared interfaces used `title`/`publishedAt`, but vidIQ returns
 * `videoTitle`/`videoPublishedAt`. `callVidIQTool` casts to the declared
 * generic, so TypeScript could not catch the mismatch.
 *
 * Reproduce: node docs/build-reports/v22r/probe_vidiq_fields.mjs
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(import.meta.dirname, "../../../.env");
const key =
  process.env.VIDIQ_API_KEY ||
  fs.readFileSync(envPath, "utf8").match(/^VIDIQ_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
if (!key) throw new Error("VIDIQ_API_KEY unavailable");

let id = 0;
async function call(name, args) {
  const res = await fetch("https://mcp.vidiq.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  const env = JSON.parse(line.slice(5));
  if (env.result?.isError) throw new Error(env.result.content?.[0]?.text ?? "tool error");
  return (
    env.result?.structuredContent ?? JSON.parse(env.result?.content?.[0]?.text ?? "{}")
  );
}

const out = await call("vidiq_outliers", { keyword: "leaky gut fatigue", limit: 2, contentType: "long" });
console.log("=== vidiq_outliers: top-level keys ===");
console.log(JSON.stringify(Object.keys(out)));
console.log("=== vidiq_outliers: videos[0] FULL OBJECT ===");
console.log(JSON.stringify(out.videos?.[0], null, 2));
console.log("=== vidiq_outliers: videos[0] key list ===");
console.log(JSON.stringify(Object.keys(out.videos?.[0] ?? {})));

const tr = await call("vidiq_trending_videos", { videoFormat: "long", titleQuery: "leaky gut fatigue", limit: 2 });
console.log("\n=== vidiq_trending_videos: top-level keys ===");
console.log(JSON.stringify(Object.keys(tr)));
console.log("=== vidiq_trending_videos: videos[0] FULL OBJECT ===");
console.log(JSON.stringify(tr.videos?.[0], null, 2));
console.log("=== vidiq_trending_videos: videos[0] key list ===");
console.log(JSON.stringify(Object.keys(tr.videos?.[0] ?? {})));
