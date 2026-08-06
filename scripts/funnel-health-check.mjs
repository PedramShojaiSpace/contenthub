/**
 * Interconnected Funnel Health Check
 * Checks: Meta pixel events, today's leads, Kajabi tagging, Klaviyo sync, Kajabi sales
 */
import * as dotenv from 'dotenv';
import { createConnection } from 'mysql2/promise';
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
const META_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const META_PIXEL_ID = '1498608757116877';
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const KLAVIYO_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KAJABI_CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const KAJABI_CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const sevenDaysAgo = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

async function getKajabiToken() {
  const res = await fetch('https://app.kajabi.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: KAJABI_CLIENT_ID,
      client_secret: KAJABI_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`INTERCONNECTED FUNNEL HEALTH CHECK — ${todayStr}`);
  console.log(`${'='.repeat(60)}\n`);

  // ── 1. DATABASE: Today's leads ──────────────────────────────
  console.log('📋 LEAD FLOW (Database)');
  console.log('-'.repeat(40));
  let db;
  try {
    db = await createConnection(DB_URL);
    
    // Today's leads
    const [todayLeads] = await db.execute(
      `SELECT COUNT(*) as count FROM interconnected_leads WHERE DATE(created_at) = ?`,
      [todayStr]
    );
    
    // Last 7 days
    const [weekLeads] = await db.execute(
      `SELECT COUNT(*) as count FROM interconnected_leads WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    
    // Total all time
    const [totalLeads] = await db.execute(
      `SELECT COUNT(*) as count FROM interconnected_leads`
    );
    
    // Untagged in Kajabi
    const [untagged] = await db.execute(
      `SELECT COUNT(*) as count FROM interconnected_leads WHERE kajabi_tagged = 0`
    );
    
    // Klaviyo unsynced
    const [unsynced] = await db.execute(
      `SELECT COUNT(*) as count FROM interconnected_leads WHERE klaviyo_synced = 0`
    );
    
    // SMS consent
    const [smsLeads] = await db.execute(
      `SELECT COUNT(*) as count FROM interconnected_leads WHERE sms_consent = 1`
    );
    
    // Recent 5 leads
    const [recentLeads] = await db.execute(
      `SELECT first_name, last_name, email, phone, sms_consent, kajabi_tagged, klaviyo_synced, created_at 
       FROM interconnected_leads ORDER BY created_at DESC LIMIT 5`
    );
    
    console.log(`  Today's leads:        ${todayLeads[0].count}`);
    console.log(`  Last 7 days:          ${weekLeads[0].count}`);
    console.log(`  All time total:       ${totalLeads[0].count}`);
    console.log(`  SMS consent given:    ${smsLeads[0].count} (${Math.round(smsLeads[0].count/totalLeads[0].count*100)}%)`);
    console.log(`  ⚠️  Kajabi untagged:  ${untagged[0].count}`);
    console.log(`  ⚠️  Klaviyo unsynced: ${unsynced[0].count}`);
    
    console.log(`\n  Recent leads:`);
    for (const lead of recentLeads) {
      const time = new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      const flags = [
        lead.kajabi_tagged ? '✅KJ' : '❌KJ',
        lead.klaviyo_synced ? '✅KL' : '❌KL',
        lead.sms_consent ? '📱SMS' : '',
      ].filter(Boolean).join(' ');
      console.log(`    ${lead.first_name} ${lead.last_name} — ${time} ${flags}`);
    }
    
    await db.end();
  } catch (err) {
    console.log(`  ❌ DB error: ${err.message}`);
    if (db) await db.end().catch(() => {});
  }

  // ── 2. META: Pixel events & ad performance ─────────────────
  console.log(`\n📊 META PIXEL & ADS`);
  console.log('-'.repeat(40));
  try {
    // Pixel diagnostics — recent events
    const pixelRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_PIXEL_ID}?fields=name,last_fired_time,is_unavailable&access_token=${META_TOKEN}`
    );
    const pixelData = await pixelRes.json();
    
    if (pixelData.error) {
      console.log(`  ❌ Pixel API error: ${pixelData.error.message}`);
    } else {
      const lastFired = pixelData.last_fired_time 
        ? new Date(pixelData.last_fired_time * 1000).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
        : 'Never';
      console.log(`  Pixel: ${pixelData.name} (${META_PIXEL_ID})`);
      console.log(`  Last fired: ${lastFired}`);
      console.log(`  Status: ${pixelData.is_unavailable ? '❌ Unavailable' : '✅ Active'}`);
    }

    // Ad account spend & leads today
    const adsRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_AD_ACCOUNT}/insights?` +
      `fields=spend,actions,cost_per_action_type,impressions,clicks&` +
      `time_range={"since":"${todayStr}","until":"${todayStr}"}` +
      `&access_token=${META_TOKEN}`
    );
    const adsData = await adsRes.json();
    
    if (adsData.data && adsData.data.length > 0) {
      const d = adsData.data[0];
      const spend = parseFloat(d.spend || 0).toFixed(2);
      const leads = d.actions?.find(a => a.action_type === 'lead')?.value || 0;
      const clicks = d.clicks || 0;
      const cpl = leads > 0 ? (parseFloat(spend) / leads).toFixed(2) : 'N/A';
      console.log(`\n  Today's ad performance:`);
      console.log(`    Spend:    $${spend}`);
      console.log(`    Leads:    ${leads}`);
      console.log(`    Clicks:   ${clicks}`);
      console.log(`    CPL:      $${cpl}`);
    } else {
      console.log(`  No ad data for today yet (may be too early in the day)`);
    }

    // 7-day Interconnected campaign performance
    const campaignRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_AD_ACCOUNT}/campaigns?` +
      `fields=name,status,insights.date_preset(last_7d){spend,actions,cost_per_action_type}&` +
      `filtering=[{"field":"name","operator":"CONTAIN","value":"Interconnected"}]&` +
      `limit=10&access_token=${META_TOKEN}`
    );
    const campaignData = await campaignRes.json();
    
    if (campaignData.data && campaignData.data.length > 0) {
      console.log(`\n  Interconnected campaigns (last 7 days):`);
      let totalSpend = 0, totalLeads = 0;
      for (const c of campaignData.data) {
        if (c.insights?.data?.[0]) {
          const ins = c.insights.data[0];
          const spend = parseFloat(ins.spend || 0);
          const leads = parseInt(ins.actions?.find(a => a.action_type === 'lead')?.value || 0);
          const cpl = leads > 0 ? (spend / leads).toFixed(2) : 'N/A';
          totalSpend += spend;
          totalLeads += leads;
          const status = c.status === 'ACTIVE' ? '🟢' : '🔴';
          console.log(`    ${status} ${c.name.substring(0, 45).padEnd(45)} $${spend.toFixed(0)} spend | ${leads} leads | $${cpl} CPL`);
        }
      }
      const avgCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 'N/A';
      console.log(`\n  TOTAL (7d): $${totalSpend.toFixed(2)} spend | ${totalLeads} leads | $${avgCpl} avg CPL`);
    }
  } catch (err) {
    console.log(`  ❌ Meta API error: ${err.message}`);
  }

  // ── 3. KAJABI: Sales tracking ───────────────────────────────
  console.log(`\n💰 KAJABI SALES`);
  console.log('-'.repeat(40));
  try {
    const token = await getKajabiToken();
    const URBAN_MONK_SITE_ID = '1769906';
    
    // Funnel offer IDs
    const offers = [
      { id: '2151314475', name: '$67 OTO — Interconnected Complete Protocol', price: 67 },
      { id: '2151019899', name: '$299 — UPSTREAM Complete Microbiome', price: 299 },
      { id: '2150211911', name: '$399 — Gut Test + Coach Consult (A)', price: 399 },
      { id: '2151178828', name: '$399 — Gut Test + Coach Consult (B)', price: 399 },
      { id: '2151031660', name: '$499 — Upstream Bundle w/ Testing', price: 499 },
    ];
    
    let totalRevenue = 0;
    let totalSales = 0;
    
    for (const offer of offers) {
      const res = await fetch(
        `https://app.kajabi.com/api/v1/sites/${URBAN_MONK_SITE_ID}/offers/${offer.id}/purchases?per_page=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      
      if (data.purchases) {
        // Filter to last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recent = data.purchases.filter(p => {
          const created = new Date(p.created_at);
          return created >= thirtyDaysAgo && p.amount_in_cents > 0;
        });
        
        // Today's sales
        const todaySales = data.purchases.filter(p => {
          const created = new Date(p.created_at);
          return created.toISOString().split('T')[0] === todayStr && p.amount_in_cents > 0;
        });
        
        const revenue30d = recent.reduce((sum, p) => sum + p.amount_in_cents / 100, 0);
        totalRevenue += revenue30d;
        totalSales += recent.length;
        
        const todayStr2 = todaySales.length > 0 ? ` | TODAY: ${todaySales.length} sale(s)` : '';
        console.log(`  ${offer.name}`);
        console.log(`    30d: ${recent.length} sales · $${revenue30d.toFixed(0)}${todayStr2}`);
      }
    }
    
    console.log(`\n  TOTAL (30d): ${totalSales} sales · $${totalRevenue.toFixed(0)}`);
    
  } catch (err) {
    console.log(`  ❌ Kajabi error: ${err.message}`);
  }

  // ── 4. KLAVIYO: SMS list status ─────────────────────────────
  console.log(`\n📱 KLAVIYO SMS`);
  console.log('-'.repeat(40));
  try {
    const SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID || 'Xer7ua';
    
    const listRes = await fetch(
      `https://a.klaviyo.com/api/lists/${SMS_LIST_ID}/?additional-fields[list]=profile_count`,
      {
        headers: {
          Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
          revision: '2024-10-15',
        },
      }
    );
    const listData = await listRes.json();
    
    if (listData.data) {
      const count = listData.data.attributes?.profile_count ?? 'unknown';
      console.log(`  SMS list (${SMS_LIST_ID}): ${count} subscribers`);
    } else {
      console.log(`  ⚠️  Could not fetch SMS list: ${JSON.stringify(listData).substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`  ❌ Klaviyo error: ${err.message}`);
  }

  // ── 5. SUMMARY ──────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('Run the Funnel Advisor page in the Content Hub for live ROAS.');
  console.log(`Check completed at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT\n`);
}

main().catch(console.error);
