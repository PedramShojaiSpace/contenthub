/**
 * Pull last 7 days of Meta spend + Kajabi sales for ROAS calculation.
 * Uses the same logic as the dashboard but runs standalone for quick reporting.
 */
import 'dotenv/config';

const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const META_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const SITE_ID = '2148432935';

// Date helpers
function getDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    since: start.toISOString().split('T')[0],
    until: end.toISOString().split('T')[0],
  };
}

// ── META ──────────────────────────────────────────────────────────────────────

async function fetchMetaSpend(days) {
  const { since, until } = getDateRange(days);
  const accountId = META_AD_ACCOUNT?.startsWith('act_') ? META_AD_ACCOUNT : `act_${META_AD_ACCOUNT}`;
  
  // Get all campaigns
  const campaignsUrl = `https://graph.facebook.com/v19.0/${accountId}/campaigns?fields=id,name,status&limit=100&access_token=${META_TOKEN}`;
  const campaignsRes = await fetch(campaignsUrl);
  const campaignsData = await campaignsRes.json();
  
  if (campaignsData.error) {
    console.error('Meta campaigns error:', campaignsData.error.message);
    return null;
  }
  
  // Filter to Interconnected campaigns
  const interconnectedCampaigns = (campaignsData.data || []).filter(c => 
    /interconnected|agora|IC/i.test(c.name)
  );
  
  console.log(`Found ${interconnectedCampaigns.length} Interconnected campaigns:`);
  for (const c of interconnectedCampaigns) {
    console.log(`  [${c.status}] ${c.name} (${c.id})`);
  }
  
  if (interconnectedCampaigns.length === 0) {
    // Try all active campaigns
    console.log('\nNo Interconnected campaigns found. Checking all active campaigns...');
    const activeCampaigns = (campaignsData.data || []).filter(c => c.status === 'ACTIVE');
    console.log(`Active campaigns: ${activeCampaigns.length}`);
    for (const c of activeCampaigns.slice(0, 10)) {
      console.log(`  ${c.name} (${c.id})`);
    }
  }
  
  // Get insights for the Interconnected campaigns
  let totalSpend = 0;
  let totalLeads = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  const campaignBreakdown = [];
  
  for (const campaign of interconnectedCampaigns) {
    const insightsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/insights?fields=spend,actions,impressions,clicks&time_range={"since":"${since}","until":"${until}"}&access_token=${META_TOKEN}`;
    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();
    
    if (insightsData.data?.[0]) {
      const d = insightsData.data[0];
      const spend = parseFloat(d.spend || '0');
      const leads = (d.actions || []).find(a => a.action_type === 'lead')?.value || 0;
      const impressions = parseInt(d.impressions || '0');
      const clicks = parseInt(d.clicks || '0');
      
      totalSpend += spend;
      totalLeads += parseInt(leads);
      totalImpressions += impressions;
      totalClicks += clicks;
      
      campaignBreakdown.push({
        name: campaign.name,
        spend,
        leads: parseInt(leads),
        impressions,
        clicks,
        cpl: leads > 0 ? (spend / parseInt(leads)).toFixed(2) : 'N/A',
      });
    }
  }
  
  // Also try account-level insights if no campaigns found
  if (interconnectedCampaigns.length === 0) {
    const accountInsightsUrl = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend,actions,impressions,clicks&time_range={"since":"${since}","until":"${until}"}&access_token=${META_TOKEN}`;
    const accountRes = await fetch(accountInsightsUrl);
    const accountData = await accountRes.json();
    
    if (accountData.data?.[0]) {
      const d = accountData.data[0];
      totalSpend = parseFloat(d.spend || '0');
      totalLeads = parseInt((d.actions || []).find(a => a.action_type === 'lead')?.value || '0');
      totalImpressions = parseInt(d.impressions || '0');
      totalClicks = parseInt(d.clicks || '0');
      console.log('\nUsing account-level insights (all campaigns combined)');
    }
  }
  
  return { totalSpend, totalLeads, totalImpressions, totalClicks, campaignBreakdown, since, until };
}

// ── KAJABI ────────────────────────────────────────────────────────────────────

async function getKajabiToken() {
  const res = await fetch(KAJABI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KAJABI_CLIENT_ID,
      client_secret: process.env.KAJABI_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

const AMOUNT_TO_TIER = {
  6700:   { tier: '67',   label: 'Interconnected $67 Bundle OTO' },
  10000:  { tier: '100',  label: 'Upstream: Complete Microbiome $100' },
  29700:  { tier: '297',  label: 'Academy Annual $297' },
  29900:  { tier: '299',  label: 'Mid-Tier $299' },
  36900:  { tier: '369',  label: 'Lights On Annual $369' },
  39900:  { tier: '399',  label: 'Testing Package $399' },
  49900:  { tier: '499',  label: 'Supported Package $499' },
  165000: { tier: '1650', label: 'Explore Testing Tier DSS $1650' },
  585000: { tier: '5850', label: 'Catalyst Coaching $5850' },
};

async function fetchKajabiSales(days) {
  const token = await getKajabiToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  const tierMap = {};
  let hitOld = false;
  
  for (let page = 1; page <= 10 && !hitOld; page++) {
    const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&page[number]=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const data = await res.json();
    
    for (const row of (data.data || [])) {
      const dateStr = row.attributes?.created_at?.substring(0, 10) || '';
      if (dateStr < sinceStr) { hitOld = true; break; }
      const amount = row.attributes?.amount_in_cents || 0;
      const state = row.attributes?.state || '';
      const action = row.attributes?.action || '';
      if (amount <= 0 || state === 'failed' || state === 'refunded' || action === 'refund') continue;
      
      const tierDef = AMOUNT_TO_TIER[amount];
      if (!tierDef) continue;
      
      if (!tierMap[tierDef.tier]) {
        tierMap[tierDef.tier] = { ...tierDef, count: 0, revenueCents: 0 };
      }
      tierMap[tierDef.tier].count++;
      tierMap[tierDef.tier].revenueCents += amount;
    }
    if (!data.links?.next) break;
  }
  
  return { tiers: Object.values(tierMap).sort((a,b) => a.revenueCents - b.revenueCents), sinceStr };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const DAYS = 7;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  INTERCONNECTED FUNNEL ROAS — LAST ${DAYS} DAYS`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Fetch in parallel
  const [meta, kajabi] = await Promise.all([
    fetchMetaSpend(DAYS),
    fetchKajabiSales(DAYS),
  ]);
  
  // META RESULTS
  console.log('── META ADS ──────────────────────────────────────────────');
  if (meta) {
    console.log(`Date range: ${meta.since} → ${meta.until}`);
    console.log(`Total Spend:       $${meta.totalSpend.toFixed(2)}`);
    console.log(`Total Leads:       ${meta.totalLeads}`);
    console.log(`CPL:               $${meta.totalLeads > 0 ? (meta.totalSpend / meta.totalLeads).toFixed(2) : 'N/A'}`);
    console.log(`Impressions:       ${meta.totalImpressions.toLocaleString()}`);
    console.log(`Clicks:            ${meta.totalClicks.toLocaleString()}`);
    if (meta.campaignBreakdown.length > 0) {
      console.log('\nCampaign Breakdown:');
      for (const c of meta.campaignBreakdown) {
        console.log(`  ${c.name}`);
        console.log(`    Spend: $${c.spend.toFixed(2)} | Leads: ${c.leads} | CPL: $${c.cpl}`);
      }
    }
  } else {
    console.log('Meta data unavailable');
  }
  
  // KAJABI RESULTS
  console.log('\n── KAJABI SALES ──────────────────────────────────────────');
  console.log(`Date range: ${kajabi.sinceStr} → today`);
  let totalKajabiRev = 0;
  let totalKajabiCount = 0;
  for (const t of kajabi.tiers) {
    console.log(`${t.label}: ${t.count} sales · $${(t.revenueCents/100).toFixed(2)}`);
    totalKajabiRev += t.revenueCents;
    totalKajabiCount += t.count;
  }
  console.log(`\nTotal Kajabi Revenue: $${(totalKajabiRev/100).toFixed(2)} (${totalKajabiCount} sales)`);
  
  // ROAS
  console.log('\n── ROAS BREAKDOWN ────────────────────────────────────────');
  if (meta && meta.totalSpend > 0) {
    const spend = meta.totalSpend;
    const totalRev = totalKajabiRev / 100;
    const roas = totalRev / spend;
    
    // Find $67 OTO tier specifically
    const otoTier = kajabi.tiers.find(t => t.tier === '67');
    const otoRev = (otoTier?.revenueCents || 0) / 100;
    const otoRoas = otoRev / spend;
    
    // Blended (all Kajabi tiers)
    console.log(`Ad Spend:           $${spend.toFixed(2)}`);
    console.log(`$67 OTO Revenue:    $${otoRev.toFixed(2)} → ROAS: ${otoRoas.toFixed(2)}x`);
    console.log(`All Kajabi Revenue: $${totalRev.toFixed(2)} → ROAS: ${roas.toFixed(2)}x`);
    console.log(`Revenue per Lead:   $${meta.totalLeads > 0 ? (totalRev / meta.totalLeads).toFixed(2) : 'N/A'}`);
    
    // Break-even analysis
    const breakEvenCR = (spend / 67) / (meta.totalLeads || 1) * 100;
    console.log(`\nBreak-even CR on $67 OTO: ${breakEvenCR.toFixed(1)}% of leads must buy`);
    const actualCR = meta.totalLeads > 0 ? ((otoTier?.count || 0) / meta.totalLeads * 100) : 0;
    console.log(`Actual $67 OTO CR:        ${actualCR.toFixed(1)}%`);
    
    // Status
    if (roas >= 2) console.log('\n✅ STATUS: PROFITABLE (ROAS ≥ 2x)');
    else if (roas >= 1) console.log('\n⚠️  STATUS: BREAK-EVEN ZONE (ROAS 1-2x)');
    else console.log('\n🔴 STATUS: BELOW BREAK-EVEN (ROAS < 1x on Kajabi alone)');
    console.log('   Note: Shopify high-ticket sales (5-8 week lag) not included above.');
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
}

main().catch(console.error);
