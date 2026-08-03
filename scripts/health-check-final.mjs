import * as dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.META_AD_ACCESS_TOKEN;
const ACCOUNT = 'act_' + process.env.META_AD_ACCOUNT_ID.replace('act_', '');
const PIXEL_ID = '1498608757116877';

async function main() {
  console.log('\n====================================================');
  console.log('INTERCONNECTED FUNNEL HEALTH CHECK — ' + new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));
  console.log('====================================================\n');

  // ── META PIXEL STATUS ──────────────────────────────────────
  console.log('📡 META PIXEL');
  console.log('----------------------------------------------------');
  const pRes = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}?fields=name,last_fired_time,is_unavailable,stats&access_token=${TOKEN}`
  );
  const p = await pRes.json();
  if (p.error) {
    console.log('  ❌ Error:', p.error.message);
  } else {
    const lastFired = p.last_fired_time
      ? new Date(p.last_fired_time * 1000).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
      : 'Never';
    console.log(`  Name: ${p.name} (${PIXEL_ID})`);
    console.log(`  Status: ${p.is_unavailable ? '❌ Unavailable' : '✅ Active'}`);
    console.log(`  Last fired: ${lastFired}`);

    // Recent hourly event counts
    if (p.stats && p.stats.data) {
      let totalPageViews = 0, totalLeads = 0, totalPurchases = 0;
      for (const hour of p.stats.data) {
        for (const ev of (hour.data || [])) {
          if (ev.value === 'PageView') totalPageViews += ev.count;
          if (ev.value === 'Lead') totalLeads += ev.count;
          if (ev.value === 'Purchase') totalPurchases += ev.count;
        }
      }
      console.log(`\n  Events (last ~24h from pixel stats):`);
      console.log(`    PageView:  ${totalPageViews}`);
      console.log(`    Lead:      ${totalLeads} ${totalLeads > 0 ? '✅' : '⚠️  No leads tracked'}`);
      console.log(`    Purchase:  ${totalPurchases}`);
    }
  }

  // ── META CAMPAIGNS ─────────────────────────────────────────
  console.log('\n📊 META AD CAMPAIGNS (last 7 days)');
  console.log('----------------------------------------------------');
  const cRes = await fetch(
    `https://graph.facebook.com/v19.0/${ACCOUNT}/campaigns?fields=name,status,insights.date_preset(last_7d){spend,actions}&limit=50&access_token=${TOKEN}`
  );
  const c = await cRes.json();
  if (c.error) {
    console.log('  ❌ Error:', c.error.message);
  } else {
    let totalSpend = 0, totalLeads = 0, totalPurchases = 0;
    const rows = [];

    for (const camp of (c.data || [])) {
      const insData = camp.insights && camp.insights.data && camp.insights.data[0];
      if (!insData) continue;
      const spend = parseFloat(insData.spend || 0);
      const actions = insData.actions || [];
      const leads = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
      const purchases = parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0);
      totalSpend += spend;
      totalLeads += leads;
      totalPurchases += purchases;
      if (spend > 0) {
        rows.push({
          name: camp.name,
          status: camp.status,
          spend,
          leads,
          purchases,
          cpl: leads > 0 ? (spend / leads).toFixed(2) : '-',
        });
      }
    }

    // Sort by spend desc
    rows.sort((a, b) => b.spend - a.spend);
    for (const r of rows) {
      const icon = r.status === 'ACTIVE' ? '🟢' : '🔴';
      const name = r.name.substring(0, 52).padEnd(52);
      console.log(`  ${icon} ${name} $${r.spend.toFixed(2)} | ${r.leads} leads | $${r.cpl} CPL`);
    }

    console.log(`\n  TOTALS: $${totalSpend.toFixed(2)} spend | ${totalLeads} leads | ${totalPurchases} purchases`);
    if (totalLeads > 0) console.log(`  Avg CPL: $${(totalSpend / totalLeads).toFixed(2)}`);
    if (totalPurchases > 0) console.log(`  Avg CPP: $${(totalSpend / totalPurchases).toFixed(2)}`);
  }

  // ── KLAVIYO SMS ────────────────────────────────────────────
  console.log('\n📱 KLAVIYO SMS LIST');
  console.log('----------------------------------------------------');
  const SMS_LIST = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID || 'Xer7ua';
  const klRes = await fetch(
    `https://a.klaviyo.com/api/lists/${SMS_LIST}/?additional-fields[list]=profile_count`,
    {
      headers: {
        Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
        revision: '2024-10-15',
      },
    }
  );
  const kl = await klRes.json();
  if (kl.data) {
    const count = kl.data.attributes?.profile_count ?? 'unknown';
    console.log(`  SMS subscribers: ${count}`);
    if (count === 0) {
      console.log(`  ⚠️  Zero SMS subscribers — Klaviyo SMS onboarding may not be complete`);
    }
  } else {
    console.log(`  ⚠️  Could not fetch: ${JSON.stringify(kl).substring(0, 120)}`);
  }

  console.log('\n====================================================');
  console.log('Check complete: ' + new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' PT');
  console.log('====================================================\n');
}

main().catch(console.error);
