/**
 * Today's Interconnected Funnel Performance
 * Pulls: Meta spend + leads (today), Kajabi revenue (today), DB leads (today)
 */
import * as dotenv from 'dotenv';
import { createConnection } from 'mysql2/promise';
dotenv.config();

const META_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID?.replace('act_', '');
const KAJABI_CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const KAJABI_CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const DB_URL = process.env.DATABASE_URL;

// Today in YYYY-MM-DD (UTC)
const today = new Date().toISOString().split('T')[0];

async function getMetaToken() {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${KAJABI_CLIENT_ID}&client_secret=${KAJABI_CLIENT_SECRET}&grant_type=client_credentials`,
  );
  // Use the stored token directly
  return META_TOKEN;
}

async function getMetaStats() {
  const url = `https://graph.facebook.com/v21.0/act_${META_ACCOUNT}/insights?` +
    `fields=spend,actions,action_values,campaign_name&` +
    `time_range={"since":"${today}","until":"${today}"}&` +
    `level=campaign&` +
    `filtering=[{"field":"campaign.name","operator":"CONTAIN","value":"Interconnected"}]&` +
    `access_token=${META_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('Meta API error:', data.error.message);
    return null;
  }

  let totalSpend = 0;
  let totalLeads = 0;
  const campaigns = [];

  for (const row of (data.data || [])) {
    const spend = parseFloat(row.spend || 0);
    const leads = (row.actions || []).find(a => a.action_type === 'lead')?.value || 0;
    totalSpend += spend;
    totalLeads += parseInt(leads);
    if (spend > 0) {
      campaigns.push({ name: row.campaign_name, spend, leads: parseInt(leads) });
    }
  }

  return { totalSpend, totalLeads, campaigns };
}

async function getKajabiToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: KAJABI_CLIENT_ID,
      client_secret: KAJABI_CLIENT_SECRET,
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error('Kajabi token failed: ' + t); }
  const data = await res.json();
  return data.access_token;
}

async function getKajabiRevenue(token) {
  // Offer IDs for funnel SKUs
  const OFFER_IDS = {
    '$67 OTO': '2151314475',
    '$299 Upstream': '2151019899',
    '$399 Gut Test': '2150211911',
    '$399 Alt': '2151178828',
    '$499 Bundle': '2151031660',
  };

  let totalRevenue = 0;
  const breakdown = [];

  // Get today's purchases — Kajabi API v1
  const res = await fetch(
    'https://api.kajabi.com/v1/purchases?per_page=100&page=1',
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  const data = await res.json();

  const todayStart = new Date(today + 'T00:00:00Z').getTime();
  const todayEnd = new Date(today + 'T23:59:59Z').getTime();

  for (const purchase of (data.purchases || [])) {
    const purchasedAt = new Date(purchase.created_at).getTime();
    if (purchasedAt < todayStart || purchasedAt > todayEnd) continue;
    if (purchase.amount_in_cents === 0) continue; // skip free

    const offerIdStr = String(purchase.offer_id);
    const offerName = Object.entries(OFFER_IDS).find(([, id]) => id === offerIdStr)?.[0] || 'Other';
    const amount = purchase.amount_in_cents / 100;
    totalRevenue += amount;
    breakdown.push({ offer: offerName, amount, email: purchase.email || 'N/A' });
  }

  return { totalRevenue, breakdown };
}

async function getDBLeads() {
  const db = await createConnection(DB_URL);
  const [rows] = await db.execute(
    `SELECT COUNT(*) as count FROM interconnected_leads WHERE DATE(created_at) = ?`,
    [today]
  );
  await db.end();
  return rows[0]?.count || 0;
}

async function main() {
  console.log(`\n=== INTERCONNECTED FUNNEL — TODAY (${today}) ===\n`);

  const [meta, kajabiToken, dbLeads] = await Promise.all([
    getMetaStats(),
    getKajabiToken(),
    getDBLeads(),
  ]);

  const kajabi = await getKajabiRevenue(kajabiToken);

  // ── META ──────────────────────────────────────────────────────────────────
  console.log('📊 META ADS (Interconnected campaigns only)');
  if (meta) {
    console.log(`   Spend today:    $${meta.totalSpend.toFixed(2)}`);
    console.log(`   Leads (Meta):   ${meta.totalLeads}`);
    const cpl = meta.totalLeads > 0 ? (meta.totalSpend / meta.totalLeads).toFixed(2) : 'N/A';
    console.log(`   Blended CPL:    $${cpl}`);
    if (meta.campaigns.length > 0) {
      console.log('\n   Campaign breakdown:');
      meta.campaigns.sort((a, b) => b.spend - a.spend).forEach(c => {
        const cpl = c.leads > 0 ? `$${(c.spend / c.leads).toFixed(2)} CPL` : 'no leads';
        console.log(`   • ${c.name.substring(0, 55).padEnd(55)} $${c.spend.toFixed(2)} · ${c.leads} leads · ${cpl}`);
      });
    }
  } else {
    console.log('   Could not fetch Meta data');
  }

  // ── DB LEADS ──────────────────────────────────────────────────────────────
  console.log(`\n💾 DATABASE LEADS TODAY: ${dbLeads}`);

  // ── KAJABI ────────────────────────────────────────────────────────────────
  console.log('\n💰 KAJABI REVENUE TODAY');
  if (kajabi.breakdown.length > 0) {
    kajabi.breakdown.forEach(p => {
      console.log(`   • ${p.offer.padEnd(20)} $${p.amount.toFixed(2)}  (${p.email})`);
    });
    console.log(`   Total revenue:  $${kajabi.totalRevenue.toFixed(2)}`);
  } else {
    console.log('   No paid purchases today yet');
  }

  // ── ROAS ──────────────────────────────────────────────────────────────────
  console.log('\n📈 ROAS SUMMARY');
  if (meta && meta.totalSpend > 0) {
    const roas = kajabi.totalRevenue / meta.totalSpend;
    const revenuePerLead = meta.totalLeads > 0 ? kajabi.totalRevenue / meta.totalLeads : 0;
    console.log(`   Ad spend:       $${meta.totalSpend.toFixed(2)}`);
    console.log(`   Revenue:        $${kajabi.totalRevenue.toFixed(2)}`);
    console.log(`   ROAS:           ${roas.toFixed(2)}x`);
    console.log(`   Revenue/lead:   $${revenuePerLead.toFixed(2)}`);
    if (roas >= 2) console.log('   Status:         ✅ PROFITABLE');
    else if (roas >= 1) console.log('   Status:         ⚠️  BREAK EVEN (back-end needed)');
    else console.log('   Status:         🔴 FRONT-END LOSS (back-end carries this)');
  } else {
    console.log('   Cannot calculate — no Meta spend data');
  }

  console.log('\n' + '='.repeat(55));
}

main().catch(console.error);
