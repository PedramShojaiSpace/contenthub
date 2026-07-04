// check-meta-ad-urls.mjs
// Checks all paused/draft Meta ads and verifies their destination URLs

const token = process.env.META_AD_ACCESS_TOKEN;
const accountId = (process.env.META_AD_ACCOUNT_ID || "").replace("act_", "");

if (!token || !accountId) {
  console.error("Missing META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  process.exit(1);
}

const BASE = "https://graph.facebook.com/v19.0";

async function apiGet(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : v);
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

// ── 1. Fetch paused campaigns ──────────────────────────────────────────────
console.log("\n🔍 Checking Meta Ads account:", accountId);
console.log("=".repeat(72));

const campaigns = await apiGet(`/act_${accountId}/campaigns`, {
  fields: "id,name,status,effective_status,objective",
  filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["PAUSED", "IN_PROCESS"] }]),
  limit: 30,
});

console.log(`\n📁 Paused Campaigns (${campaigns.data?.length || 0}):`);
for (const c of (campaigns.data || [])) {
  console.log(`   ${c.id}  ${c.name}  [${c.effective_status}]  ${c.objective}`);
}

// ── 2. Fetch paused ads with creative link data ────────────────────────────
const ads = await apiGet(`/act_${accountId}/ads`, {
  fields: "id,name,status,effective_status,adset_id,creative{id,object_story_spec,link_url}",
  filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"] }]),
  limit: 50,
});

console.log(`\n📣 Paused Ads (${ads.data?.length || 0}):`);
console.log("-".repeat(72));

let allGood = true;
const TARGET = "ch.theurbanmonk.com/upstream/program";

for (const ad of (ads.data || [])) {
  const creative = ad.creative || {};
  const spec = creative.object_story_spec || {};
  const linkData = spec.link_data || spec.video_data || {};
  const ctaLink = linkData.call_to_action?.value?.link || "";
  const link = linkData.link || ctaLink || creative.link_url || "";

  const pointsToTarget = link.includes("upstream") && link.includes("program");
  const status = pointsToTarget ? "✅" : link ? "⚠️ " : "❓";
  if (!pointsToTarget) allGood = false;

  console.log(`${status} ${ad.name}`);
  console.log(`   ID: ${ad.id}  |  Status: ${ad.effective_status}`);
  console.log(`   URL: ${link || "(no link found in creative)"}`);
  if (!pointsToTarget && link) {
    console.log(`   ↳ Expected: https://${TARGET}`);
  }
  console.log();
}

// ── 3. Also do a direct URL test on the landing page ──────────────────────
console.log("=".repeat(72));
console.log("\n🌐 Live page check: https://" + TARGET);
try {
  const pageRes = await fetch(`https://${TARGET}`, { redirect: "follow" });
  const finalUrl = pageRes.url;
  const status = pageRes.status;
  const html = await pageRes.text();
  const hasWistia = html.includes("1k158cy6yt");
  const hasPixel = html.includes("1498608757116877");
  const hasCTA = html.includes("3zvkMvds");

  console.log(`   HTTP Status:    ${status} ${status === 200 ? "✅" : "❌"}`);
  console.log(`   Final URL:      ${finalUrl}`);
  console.log(`   Wistia video:   ${hasWistia ? "✅ 1k158cy6yt present" : "❌ NOT FOUND"}`);
  console.log(`   Meta Pixel:     ${hasPixel ? "✅ 1498608757116877 present" : "❌ NOT FOUND"}`);
  console.log(`   Checkout CTA:   ${hasCTA ? "✅ Kajabi offer link present" : "❌ NOT FOUND"}`);
} catch (e) {
  console.log(`   ❌ Could not reach page: ${e.message}`);
}

console.log("\n" + "=".repeat(72));
if (allGood) {
  console.log("✅ All ads point to the correct upstream/program page. Safe to activate.");
} else {
  console.log("⚠️  One or more ads have incorrect or missing destination URLs. Review above.");
}
