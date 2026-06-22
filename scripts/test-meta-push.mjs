/**
 * Test script: push a single ad creative to Meta to verify Live mode is working.
 * This creates a PAUSED ad with no budget — safe to run.
 */

const token = process.env.META_AD_ACCESS_TOKEN;
const accountId = process.env.META_AD_ACCOUNT_ID;
const pageId = process.env.META_PAGE_ID;

if (!token || !accountId || !pageId) {
  console.error('Missing required env vars: META_AD_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID');
  process.exit(1);
}

const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

console.log('=== Meta Live Mode Test ===');
console.log(`Account: ${actId}`);
console.log(`Page ID: ${pageId}`);
console.log('');

// Step 1: Create a test campaign (PAUSED)
console.log('Step 1: Creating test campaign...');
const campRes = await fetch(`https://graph.facebook.com/v19.0/${actId}/campaigns`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '[CONTENT HUB TEST] KBMO FIT-22 — Precision Health — DELETE AFTER TEST',
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
    access_token: token,
  }),
});
const campData = await campRes.json();
if (campData.error) {
  console.error('❌ Campaign creation failed:', JSON.stringify(campData.error, null, 2));
  if (campData.error.error_subcode === 1885183) {
    console.error('\n⚠️  App is still in Development Mode. Check developers.facebook.com.');
  }
  process.exit(1);
}
console.log(`✅ Campaign created: ${campData.id}`);

// Step 2: Create an ad set (PAUSED, no budget yet)
console.log('Step 2: Creating test ad set...');
const adsetRes = await fetch(`https://graph.facebook.com/v19.0/${actId}/adsets`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '[CONTENT HUB TEST] Precision Health — Variant 1 — DELETE AFTER TEST',
    campaign_id: campData.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'IMPRESSIONS',
    daily_budget: 500, // $5.00 in cents — will be PAUSED anyway
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: {
      geo_locations: { countries: ['US'] },
      age_min: 35,
      age_max: 65,
      targeting_automation: { advantage_audience: 0 },
    },
    status: 'PAUSED',
    access_token: token,
  }),
});
const adsetData = await adsetRes.json();
if (adsetData.error) {
  console.error('❌ Ad set creation failed:', JSON.stringify(adsetData.error, null, 2));
  process.exit(1);
}
console.log(`✅ Ad set created: ${adsetData.id}`);

// Step 3: Create an ad creative
console.log('Step 3: Creating ad creative...');
const creativeRes = await fetch(`https://graph.facebook.com/v19.0/${actId}/adcreatives`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '[CONTENT HUB TEST] Precision Health Ad 1',
    object_story_spec: {
      page_id: pageId,
      link_data: {
        message: "You've done the labs. Everything came back normal. But you still feel terrible.\n\nFatigue. Brain fog. Gut issues that won't resolve.\n\nNormal labs don't measure cellular inflammation — and that's exactly what the KBMO FIT-22 test is designed to find.",
        link: 'https://gth.theurbanmonk.com/',
        name: 'Your Labs Are Normal. Your Inflammation Isn\'t.',
        description: 'The KBMO FIT-22 Test + 1-Hour Health Coach Consultation — $399',
        call_to_action: {
          type: 'LEARN_MORE',
          value: { link: 'https://gth.theurbanmonk.com/' },
        },
      },
    },
    access_token: token,
  }),
});
const creativeData = await creativeRes.json();
if (creativeData.error) {
  console.error('❌ Creative creation failed:', JSON.stringify(creativeData.error, null, 2));
  process.exit(1);
}
console.log(`✅ Creative created: ${creativeData.id}`);

// Step 4: Create the ad
console.log('Step 4: Creating ad...');
const adRes = await fetch(`https://graph.facebook.com/v19.0/${actId}/ads`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '[CONTENT HUB TEST] Precision Health Ad 1 — DELETE AFTER TEST',
    adset_id: adsetData.id,
    creative: { creative_id: creativeData.id },
    status: 'PAUSED',
    access_token: token,
  }),
});
const adData = await adRes.json();
if (adData.error) {
  console.error('❌ Ad creation failed:', JSON.stringify(adData.error, null, 2));
  process.exit(1);
}
console.log(`✅ Ad created: ${adData.id}`);

console.log('');
console.log('=== TEST SUCCESSFUL ===');
console.log(`Campaign ID: ${campData.id}`);
console.log(`Ad Set ID:   ${adsetData.id}`);
console.log(`Creative ID: ${creativeData.id}`);
console.log(`Ad ID:       ${adData.id}`);
console.log('');
console.log('All objects are PAUSED with no spend. You can delete them in Ads Manager or leave them.');
console.log(`Ads Manager URL: https://www.facebook.com/adsmanager/manage/campaigns?act=${accountId}&campaign_ids=${campData.id}`);
