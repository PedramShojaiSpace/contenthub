import 'dotenv/config';

const token = process.env.META_AD_ACCESS_TOKEN;
const accountId = process.env.META_AD_ACCOUNT_ID;

console.log('Token present:', !!token, token ? `(length: ${token.length})` : '');
console.log('Account ID:', accountId);

if (!token || !accountId) {
  console.error('Missing META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
  process.exit(1);
}

// Normalize account ID — Meta API requires act_XXXXXXX format
const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

// Fetch last 7 days of campaign insights: spend, impressions, clicks, leads
const fields = 'campaign_name,spend,impressions,clicks,actions,cost_per_action_type';
const params = new URLSearchParams({
  fields,
  date_preset: 'last_7d',
  level: 'campaign',
  access_token: token,
});

const url = `https://graph.facebook.com/v20.0/${actId}/insights?${params}`;
console.log('\nFetching:', url.replace(token, '[TOKEN]'));

const res = await fetch(url);
const data = await res.json();

if (data.error) {
  console.error('Meta API error:', JSON.stringify(data.error, null, 2));
  process.exit(1);
}

console.log('\n=== Campaigns (last 7 days) ===');
if (!data.data || data.data.length === 0) {
  console.log('No campaign data returned.');
} else {
  for (const row of data.data) {
    const leads = row.actions?.find(a => a.action_type === 'lead')?.value || 0;
    const cpl = leads > 0 ? (parseFloat(row.spend) / parseInt(leads)).toFixed(2) : 'N/A';
    console.log(`\n  Campaign: ${row.campaign_name}`);
    console.log(`  Spend:    $${row.spend}`);
    console.log(`  Leads:    ${leads}`);
    console.log(`  CPL:      $${cpl}`);
    console.log(`  Clicks:   ${row.clicks}`);
  }
}

// Also fetch account-level totals
const acctParams = new URLSearchParams({
  fields: 'spend,impressions,clicks,actions',
  date_preset: 'last_7d',
  access_token: token,
});
const acctUrl = `https://graph.facebook.com/v20.0/${actId}/insights?${acctParams}`;
const acctRes = await fetch(acctUrl);
const acctData = await acctRes.json();

if (acctData.data && acctData.data[0]) {
  const row = acctData.data[0];
  const leads = row.actions?.find(a => a.action_type === 'lead')?.value || 0;
  const cpl = leads > 0 ? (parseFloat(row.spend) / parseInt(leads)).toFixed(2) : 'N/A';
  console.log('\n=== Account Totals (last 7 days) ===');
  console.log(`  Total Spend: $${row.spend}`);
  console.log(`  Total Leads: ${leads}`);
  console.log(`  Avg CPL:     $${cpl}`);
}
