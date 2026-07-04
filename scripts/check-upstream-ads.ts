import { getDb } from "../server/db";
import { metaAdPushes } from "../drizzle/schema";
import { desc } from "drizzle-orm";

const token = process.env.META_AD_ACCESS_TOKEN!;
const BASE = "https://graph.facebook.com/v19.0";

async function apiGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json() as any;
  if (json.error) throw new Error(`Meta API: ${json.error.message}`);
  return json;
}

const db = await getDb();
if (!db) throw new Error("Could not connect to database");

// Get the most recent ad pushes from our DB
const pushes = await db
  .select()
  .from(metaAdPushes)
  .orderBy(desc(metaAdPushes.pushedAt))
  .limit(30);

console.log(`\n📋 Most recent ${pushes.length} ad pushes from Content Hub:\n`);
console.log("=".repeat(80));

const TARGET = "ch.theurbanmonk.com/upstream/program";
let allGood = true;
let checkedCount = 0;

for (const push of pushes) {
  const adId = push.adId;
  const storedUrl = push.landingUrl || "(none stored)";
  const dbOk = storedUrl.includes("upstream") && storedUrl.includes("program");
  if (!dbOk) allGood = false;

  console.log(`\nAd: ${push.adName}`);
  console.log(`  Batch:     ${push.batchName}`);
  console.log(`  DB URL:    ${storedUrl} ${dbOk ? "✅" : "⚠️  WRONG"}`);
  console.log(`  Meta Ad ID: ${adId || "(not yet pushed)"}`);
  console.log(`  Status:    ${push.status}`);

  // If we have a Meta ad ID, verify the live URL via API
  if (adId) {
    checkedCount++;
    try {
      const adData = await apiGet(`/${adId}`, {
        fields: "id,name,effective_status,creative{object_story_spec,link_url}"
      });
      const spec = adData.creative?.object_story_spec || {};
      const linkData = spec.link_data || spec.video_data || {};
      const liveUrl = linkData.link || linkData.call_to_action?.value?.link || adData.creative?.link_url || "";
      const liveOk = liveUrl.includes("upstream") && liveUrl.includes("program");
      if (!liveOk) allGood = false;
      console.log(`  Live URL:  ${liveUrl || "(not in creative spec — may be set at ad set level)"} ${liveOk ? "✅" : liveUrl ? "⚠️  WRONG URL" : "❓"}`);
      console.log(`  Live Status: ${adData.effective_status}`);
    } catch (e: any) {
      console.log(`  Live check: ❌ ${e.message}`);
    }
  }
}

// Check the live landing page
console.log(`\n${"=".repeat(80)}`);
console.log(`\n🌐 Live page check: https://${TARGET}`);
try {
  const pageRes = await fetch(`https://${TARGET}`, { redirect: "follow" });
  const html = await pageRes.text();
  const hasWistia = html.includes("1k158cy6yt");
  const hasPixel = html.includes("1498608757116877");
  const hasCTA = html.includes("3zvkMvds");
  console.log(`   HTTP Status:    ${pageRes.status} ${pageRes.status === 200 ? "✅" : "❌"}`);
  console.log(`   Wistia video:   ${hasWistia ? "✅ 1k158cy6yt present" : "❌ NOT FOUND"}`);
  console.log(`   Meta Pixel:     ${hasPixel ? "✅ 1498608757116877 present" : "❌ NOT FOUND"}`);
  console.log(`   Checkout CTA:   ${hasCTA ? "✅ Kajabi offer link present" : "❌ NOT FOUND"}`);
} catch (e: any) {
  console.log(`   ❌ Could not reach page: ${e.message}`);
}

console.log(`\n${"=".repeat(80)}`);
if (allGood) {
  console.log(`✅ All ${pushes.length} Upstream ads point to the correct page. Safe to activate.`);
} else {
  console.log(`⚠️  One or more ads have URL issues — review above before activating.`);
}
process.exit(0);
