const token = process.env.META_AD_ACCESS_TOKEN;
const accountId = process.env.META_AD_ACCOUNT_ID;

if (!token || !accountId) {
  console.log('Missing META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
  process.exit(1);
}

// Get campaigns
const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
const campRes = await fetch(`https://graph.facebook.com/v19.0/${actId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=20&access_token=${token}`);
const campData = await campRes.json();
console.log('=== CAMPAIGNS ===');
if (campData.data) {
  for (const c of campData.data) {
    console.log(`  [${c.status}] ${c.name} (id: ${c.id})`);
    if (c.daily_budget) console.log(`    Daily budget: $${(parseInt(c.daily_budget)/100).toFixed(2)}`);
    if (c.lifetime_budget) console.log(`    Lifetime budget: $${(parseInt(c.lifetime_budget)/100).toFixed(2)}`);
  }
} else {
  console.log(JSON.stringify(campData, null, 2));
}

// Get ad sets
const adsetRes = await fetch(`https://graph.facebook.com/v19.0/${actId}/adsets?fields=id,name,status,daily_budget,lifetime_budget,campaign_id,billing_event,optimization_goal&limit=30&access_token=${token}`);
const adsetData = await adsetRes.json();
console.log('\n=== AD SETS ===');
if (adsetData.data) {
  for (const s of adsetData.data) {
    console.log(`  [${s.status}] ${s.name} (id: ${s.id}, campaign: ${s.campaign_id})`);
    if (s.daily_budget) console.log(`    Daily budget: $${(parseInt(s.daily_budget)/100).toFixed(2)}`);
    if (s.lifetime_budget) console.log(`    Lifetime budget: $${(parseInt(s.lifetime_budget)/100).toFixed(2)}`);
    if (!s.daily_budget && !s.lifetime_budget) console.log(`    Budget: set at campaign level`);
  }
} else {
  console.log(JSON.stringify(adsetData, null, 2));
}
