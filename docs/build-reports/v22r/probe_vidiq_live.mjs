/**
 * Part 1 live proof — calls mcp.vidiq.com directly and prints raw output.
 *
 * Deliberately hits the real endpoint with no mocking, and prints the untouched
 * JSON-RPC envelope for each call. Reproduce with:
 *   node docs/build-reports/v22r/probe_vidiq_live.mjs
 *
 * Proves, in order:
 *   1. the live enum for vidiq_outliers.contentType (from tools/list)
 *   2. the live enum for vidiq_trending_videos.videoFormat
 *   3. the OLD value "video" is rejected — the -32602 that was invisible
 *   4. the NEW value succeeds and returns real videos
 *   5. the real vidiq_balance payload has totalCredits and no `credits`
 */
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(import.meta.dirname, "../../../.env");
const MCP_URL = "https://mcp.vidiq.com/mcp";

function readKey() {
  if (process.env.VIDIQ_API_KEY) return process.env.VIDIQ_API_KEY;
  const txt = fs.readFileSync(ENV_PATH, "utf8");
  const m = txt.match(/^VIDIQ_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  if (!m) throw new Error("VIDIQ_API_KEY not found in env");
  return m[1].trim();
}

const API_KEY = readKey();
let rpcId = 0;

/** Raw MCP call — returns the parsed JSON-RPC envelope, unmodified. */
async function rpc(method, params) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  return { httpStatus: res.status, envelope: line ? JSON.parse(line.slice(5)) : text };
}

const call = (name, args) => rpc("tools/call", { name, arguments: args });

function hr(title) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

function show(label, out) {
  console.log(`\n--- ${label} ---`);
  console.log(`HTTP ${out.httpStatus}`);
  console.log(`jsonrpc.error present: ${out.envelope?.error !== undefined}`);
  console.log(`result.isError: ${JSON.stringify(out.envelope?.result?.isError)}`);
  const txt = out.envelope?.result?.content?.[0]?.text;
  if (typeof txt === "string") {
    console.log(`content[0].text (first 400 chars):\n${txt.slice(0, 400)}`);
  }
  const sc = out.envelope?.result?.structuredContent;
  console.log(`structuredContent present: ${sc !== undefined && sc !== null}`);
  return out;
}

console.log(`Part 1 live vidIQ proof — ${new Date().toISOString()}`);
console.log(`endpoint: ${MCP_URL}`);
console.log(`api key: ...${API_KEY.slice(-6)} (last 6 shown only)`);

// ── 1/2. The live enums, straight from the server's own tool schemas ─────────
hr("1+2. LIVE ENUMS from tools/list (the source of truth for fixes 3 and 4)");
const list = await rpc("tools/list", {});
const tools = list.envelope?.result?.tools ?? [];
console.log(`tools advertised: ${tools.length}`);
for (const name of ["vidiq_outliers", "vidiq_trending_videos"]) {
  const t = tools.find((x) => x.name === name);
  const props = t?.inputSchema?.properties ?? {};
  for (const field of ["contentType", "videoFormat"]) {
    if (props[field]) {
      console.log(`${name}.${field} enum = ${JSON.stringify(props[field].enum ?? props[field])}`);
    }
  }
}

// ── 3. The old value, rejected ────────────────────────────────────────────────
hr('3. OLD VALUE contentType:"video" — the failure that was invisible pre-fix');
show('vidiq_outliers contentType:"video" (v2.1 behaviour)', await call("vidiq_outliers", {
  keyword: "leaky gut fatigue",
  limit: 5,
  contentType: "video",
}));
console.log(
  "\nNOTE: HTTP is 200 and jsonrpc.error is absent. Only result.isError reveals\n" +
    "the failure — which v2.1 never checked, then fed this prose to JSON.parse."
);

hr('3b. OLD VALUE videoFormat:"video" on the fallback path');
show('vidiq_trending_videos videoFormat:"video" (v2.1 behaviour)', await call("vidiq_trending_videos", {
  videoFormat: "video",
  titleQuery: "leaky gut fatigue",
  limit: 5,
}));

// ── 4. The new values, working ────────────────────────────────────────────────
hr('4. NEW VALUE contentType:"long" — top 5 outliers, printed');
const ok = show('vidiq_outliers contentType:"long" (v2.2)', await call("vidiq_outliers", {
  keyword: "leaky gut fatigue",
  limit: 5,
  contentType: "long",
}));
const outVideos =
  ok.envelope?.result?.structuredContent?.videos ??
  (() => {
    try {
      return JSON.parse(ok.envelope?.result?.content?.[0]?.text ?? "{}").videos ?? [];
    } catch {
      return [];
    }
  })();
console.log(`\nTOP ${Math.min(5, outVideos.length)} OUTLIERS RETURNED:`);
outVideos.slice(0, 5).forEach((v, i) => {
  console.log(
    // NOTE: this probe prints the RAW wire fields deliberately (videoTitle,
    // breakoutScore) — it is proving what the API sends, not what our wrappers
    // return. probe_vidiq_wrappers.ts proves the mapped output separately.
    `${i + 1}. "${v.videoTitle}" — ${v.channelTitle} — ` +
      `${v.viewCount} views — breakoutScore ${v.breakoutScore}`
  );
});

hr('4b. NEW VALUE videoFormat:"long" on the fallback path');
const tr = show('vidiq_trending_videos videoFormat:"long" (v2.2)', await call("vidiq_trending_videos", {
  videoFormat: "long",
  titleQuery: "leaky gut fatigue",
  limit: 5,
}));
const trVideos =
  tr.envelope?.result?.structuredContent?.videos ??
  (() => {
    try {
      return JSON.parse(tr.envelope?.result?.content?.[0]?.text ?? "{}").videos ?? [];
    } catch {
      return [];
    }
  })();
console.log(`\nTRENDING RETURNED: ${trVideos.length} video(s)`);
trVideos.slice(0, 5).forEach((v, i) => {
  console.log(`${i + 1}. "${v.videoTitle}" — ${v.viewCount} views — vph ${v.vph}`);
});

// ── 5. Keyword research structured metrics ────────────────────────────────────
hr("5. vidiq_keyword_research — structured metrics for a real keyword");
const kw = show('vidiq_keyword_research "gut health fatigue"', await call("vidiq_keyword_research", {
  keyword: "gut health fatigue",
  includeRelated: true,
}));
const kwData =
  kw.envelope?.result?.structuredContent ??
  (() => {
    try {
      return JSON.parse(kw.envelope?.result?.content?.[0]?.text ?? "{}");
    } catch {
      return {};
    }
  })();
console.log("\nseedKeyword:", JSON.stringify(kwData.seedKeyword ?? null, null, 2));
console.log(`relatedKeywords returned: ${(kwData.relatedKeywords ?? kwData.related ?? []).length}`);

// ── 6. Balance shape ─────────────────────────────────────────────────────────
hr("6. vidiq_balance — proving `credits` does not exist and totalCredits does");
const bal = show("vidiq_balance", await call("vidiq_balance", {}));
const balData =
  bal.envelope?.result?.structuredContent ??
  (() => {
    try {
      return JSON.parse(bal.envelope?.result?.content?.[0]?.text ?? "{}");
    } catch {
      return {};
    }
  })();
console.log("\nFULL BALANCE PAYLOAD:");
console.log(JSON.stringify(balData, null, 2));
console.log(`\nkeys present: ${JSON.stringify(Object.keys(balData))}`);
console.log(`balData.credits       => ${JSON.stringify(balData.credits)}   <-- what v2.1 read`);
console.log(`balData.totalCredits  => ${JSON.stringify(balData.totalCredits)}   <-- what v2.2 reads`);
console.log(
  `\nv2.1 guard simulation: (undefined < 30) === ${JSON.stringify(balData.credits < 30)} ` +
    "→ a doomed batch fired every time."
);
console.log(
  `v2.2 guard simulation: (${balData.totalCredits} < 30) === ${JSON.stringify(balData.totalCredits < 30)} → guard is now real.`
);

console.log("\nDONE.");
