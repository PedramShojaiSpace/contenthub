import dotenv from 'dotenv';
dotenv.config();

const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const SITE_ID = '2148432935';

const CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing KAJABI_CLIENT_ID or KAJABI_CLIENT_SECRET');
  process.exit(1);
}

// Get OAuth token
const tokenRes = await fetch(KAJABI_TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET })
});
const tokenData = await tokenRes.json();
if (!tokenData.access_token) {
  console.error('Token error:', tokenData);
  process.exit(1);
}
const token = tokenData.access_token;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

// Today's window (CDT = UTC-5)
const now = new Date();
const todayStartCDT = new Date(now);
todayStartCDT.setHours(0, 0, 0, 0); // midnight local
// Convert to UTC for comparison
const todayStartUTC = new Date(todayStartCDT.getTime());

console.log(`\nPulling Kajabi transactions for today (${todayStartCDT.toDateString()})...`);
console.log(`Window: midnight CDT (${todayStartUTC.toISOString()}) → now (${now.toISOString()})\n`);

// Amount → tier map
const AMOUNT_TO_TIER = {
  6700:   '$67 — Interconnected Bundle OTO',
  10000:  '$100 — Upstream Microbiome',
  29700:  '$297 — Academy Annual',
  29900:  '$299 — Mid-Tier Program',
  36900:  '$369 — Lights On Annual',
  39900:  '$399 — Testing Package',
  49900:  '$499 — Supported Package',
};

const todayTxns = [];
let page = 1;
let keepGoing = true;

while (keepGoing && page <= 30) {
  const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&page[number]=${page}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    console.error(`API error page ${page}: ${res.status} ${await res.text()}`);
    break;
  }

  const data = await res.json();
  const txns = data.transactions || data.data || [];
  if (txns.length === 0) break;

  let foundOld = false;
  for (const t of txns) {
    const createdAt = new Date(t.created_at);
    if (createdAt >= todayStartUTC) {
      todayTxns.push(t);
    } else {
      foundOld = true;
    }
  }

  process.stdout.write(`Page ${page}: ${txns.length} records, ${todayTxns.length} today so far\n`);

  if (foundOld && todayTxns.length > 0) {
    keepGoing = false; // hit yesterday's data, stop
  }

  page++;
}

console.log(`\n=== TODAY'S KAJABI TRANSACTIONS (${todayTxns.length} total) ===\n`);

const tiers = {};
let totalRevenue = 0;

// Sort by time
todayTxns.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

for (const t of todayTxns) {
  const amountCents = t.amount_in_cents || 0;
  const amount = amountCents / 100;
  const status = t.status || 'unknown';
  const createdAt = new Date(t.created_at);
  const timeStr = createdAt.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit' });
  const label = AMOUNT_TO_TIER[amountCents] || `$${amount} — Unknown Offer`;
  const email = t.email || t.purchaser_email || '';

  if (status === 'refunded') {
    console.log(`  ${timeStr} CT | REFUNDED | $${amount.toFixed(2)} | ${label} | ${email}`);
    continue;
  }

  console.log(`  ${timeStr} CT | $${amount.toFixed(2)} | ${label} | ${email}`);

  if (!tiers[label]) tiers[label] = { count: 0, revenue: 0 };
  tiers[label].count++;
  tiers[label].revenue += amount;
  totalRevenue += amount;
}

console.log('\n=== SUMMARY BY TIER ===\n');
const sortedTiers = Object.entries(tiers).sort((a, b) => b[1].revenue - a[1].revenue);
for (const [label, val] of sortedTiers) {
  console.log(`  ${label}`);
  console.log(`    Sales: ${val.count} | Revenue: $${val.revenue.toFixed(2)}\n`);
}

const salesCount = Object.values(tiers).reduce((s, v) => s + v.count, 0);
console.log(`TOTAL TODAY: ${salesCount} sales | $${totalRevenue.toFixed(2)} revenue`);

console.log('\n=== RECONCILIATION vs AD BUYER REPORT ===');
console.log('Ad buyer: $177 spend | 86 leads | 22 checkouts | "0 sales" (pixel blind to Kajabi)');
console.log(`Kajabi:   ${salesCount} sales | $${totalRevenue.toFixed(2)} revenue`);
if (salesCount > 0) {
  const roas = (totalRevenue / 177).toFixed(2);
  console.log(`Today ROAS (if all sales from today\'s campaign): ${roas}x`);
  console.log('\nNote: Kajabi sales are NOT tracked by Meta pixel (off-platform checkout).');
  console.log('The ad buyer\'s "0 sales" is expected — it means 0 Meta-attributed conversions,');
  console.log('not 0 actual sales. These Kajabi sales are real revenue from today\'s traffic.');
}
