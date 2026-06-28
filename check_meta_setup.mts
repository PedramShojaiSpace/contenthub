/**
 * Check Meta Ads setup:
 * 1. Confirm Custom Audience ID 52568399217005 is active
 * 2. Check Meta Pixel installation on theurbanmonk.com
 * 3. List all custom audiences in the ad account
 */
import "dotenv/config";

const ACCESS_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
  console.error("Missing META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  process.exit(1);
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0${path}`);
  url.searchParams.set("access_token", ACCESS_TOKEN!);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const data = await res.json() as any;
  if (data.error) throw new Error(`Meta API error: ${data.error.message} (code ${data.error.code})`);
  return data;
}

async function main() {
  console.log("=== META ADS SETUP CHECK ===\n");

  // 1. Check the specific audience ID
  const AUDIENCE_ID = "52568399217005";
  console.log(`1. Checking Custom Audience ID: ${AUDIENCE_ID}`);
  try {
    const audience = await metaGet(`/${AUDIENCE_ID}`, {
      fields: "id,name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,subtype,data_source,time_created,time_updated",
    });
    console.log(`   ✅ Audience found:`);
    console.log(`      Name: ${audience.name}`);
    console.log(`      Type: ${audience.subtype}`);
    console.log(`      Count: ${audience.approximate_count_lower_bound ?? 0} – ${audience.approximate_count_upper_bound ?? 0}`);
    console.log(`      Delivery Status: ${audience.delivery_status?.description ?? "Unknown"} (code: ${audience.delivery_status?.code ?? "?"})`);
    console.log(`      Created: ${audience.time_created}`);
    console.log(`      Updated: ${audience.time_updated}`);
    const isActive = audience.delivery_status?.code === 200;
    console.log(`      Status: ${isActive ? "🟢 ACTIVE" : "🟡 " + (audience.delivery_status?.description ?? "Unknown")}`);
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // 2. List all custom audiences in the ad account
  console.log(`\n2. Listing all Custom Audiences in Ad Account ${AD_ACCOUNT_ID}:`);
  try {
    const audiences = await metaGet(`/act_${AD_ACCOUNT_ID}/customaudiences`, {
      fields: "id,name,approximate_count_lower_bound,subtype,delivery_status",
      limit: "20",
    });
    const list = audiences.data ?? [];
    if (list.length === 0) {
      console.log("   No custom audiences found");
    } else {
      list.forEach((a: any) => {
        const status = a.delivery_status?.code === 200 ? "🟢" : "🟡";
        console.log(`   ${status} [${a.id}] ${a.name} (${a.subtype}) — ~${a.approximate_count_lower_bound ?? 0} people`);
      });
    }
  } catch (err: any) {
    console.log(`   ❌ Error listing audiences: ${err.message}`);
  }

  // 3. Check Meta Pixels in the ad account
  console.log(`\n3. Checking Meta Pixels in Ad Account ${AD_ACCOUNT_ID}:`);
  try {
    const pixels = await metaGet(`/act_${AD_ACCOUNT_ID}/adspixels`, {
      fields: "id,name,last_fired_time,is_unavailable,code",
      limit: "10",
    });
    const pixelList = pixels.data ?? [];
    if (pixelList.length === 0) {
      console.log("   ❌ No Meta Pixels found in this ad account");
      console.log("   → Create a pixel at: https://business.facebook.com/events_manager");
    } else {
      pixelList.forEach((p: any) => {
        const lastFired = p.last_fired_time
          ? new Date(p.last_fired_time * 1000).toLocaleDateString()
          : "Never";
        const status = p.last_fired_time ? "🟢" : "🔴";
        console.log(`   ${status} [${p.id}] ${p.name}`);
        console.log(`         Last fired: ${lastFired}`);
        console.log(`         Unavailable: ${p.is_unavailable ? "Yes" : "No"}`);
      });
    }
  } catch (err: any) {
    console.log(`   ❌ Error checking pixels: ${err.message}`);
  }

  // 4. Check Website Custom Audiences (pixel-based)
  console.log(`\n4. Checking Website Custom Audiences (pixel-based):`);
  try {
    const audiences = await metaGet(`/act_${AD_ACCOUNT_ID}/customaudiences`, {
      fields: "id,name,subtype,rule,delivery_status",
      limit: "20",
    });
    const websiteAudiences = (audiences.data ?? []).filter((a: any) => a.subtype === "WEBSITE");
    if (websiteAudiences.length === 0) {
      console.log("   ❌ No Website Custom Audiences found");
      console.log("   → Create one at: https://business.facebook.com/adsmanager/audiences");
      console.log("   → Choose: Create Audience → Custom Audience → Website");
    } else {
      websiteAudiences.forEach((a: any) => {
        console.log(`   ✅ [${a.id}] ${a.name}`);
        console.log(`         Status: ${a.delivery_status?.description ?? "Unknown"}`);
      });
    }
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

main().catch(console.error);
