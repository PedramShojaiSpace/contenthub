import 'dotenv/config';

const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';

const FUNNEL_OFFERS = {
  '2151314475': { label: 'Interconnected $67 OTO',             priceCents: 6700   },
  '2151104453': { label: 'Upstream Microbiome $100',           priceCents: 10000  },
  '2150918578': { label: 'Orobiome Testing $399',              priceCents: 39900  },
  '2150678415': { label: 'Gateway to Health $399',             priceCents: 39900  },
  '2150129988': { label: 'Gut Test Kit $399',                  priceCents: 39900  },
  '2150080605': { label: 'Supported Package $499 (a)',         priceCents: 49900  },
  '2150205374': { label: 'Supported Package $499 (b)',         priceCents: 49900  },
  '2151024712': { label: 'Explore Testing DSS $1650',          priceCents: 165000 },
  '2150311612': { label: 'Catalyst Coaching $5850 (a)',        priceCents: 585000 },
  '2150129918': { label: 'Catalyst Coaching $5850 (b)',        priceCents: 585000 },
  '2149856666': { label: 'Deep Sleep Solution $197',           priceCents: 19700  },
};

async function getToken() {
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

async function main() {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  
  console.log(`Fetching purchases since ${since}...\n`);

  const allPurchases = [];
  const seen = new Set();

  // Step 1: Global recent 30
  const globalRes = await fetch(`${KAJABI_API_BASE}/purchases`, { headers });
  const globalData = await globalRes.json();
  for (const row of globalData.data || []) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const createdAt = row.attributes?.created_at || '';
    if (createdAt >= since) {
      allPurchases.push({
        id: row.id,
        offerId: row.relationships?.offer?.data?.id || '',
        amountCents: row.attributes?.amount_in_cents || 0,
        createdAt,
        paymentType: row.attributes?.payment_type,
      });
    }
  }
  console.log(`Global fetch: ${globalData.data?.length} total, ${allPurchases.length} within date range`);

  // Step 2: Per offer ID
  const offerIds = Object.keys(FUNNEL_OFFERS);
  for (const offerId of offerIds) {
    const res = await fetch(`${KAJABI_API_BASE}/purchases?offer_id=${offerId}`, { headers });
    if (!res.ok) continue;
    const data = await res.json();
    let newCount = 0;
    for (const row of data.data || []) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const createdAt = row.attributes?.created_at || '';
      if (createdAt >= since) {
        allPurchases.push({
          id: row.id,
          offerId: row.relationships?.offer?.data?.id || offerId,
          amountCents: row.attributes?.amount_in_cents || 0,
          createdAt,
          paymentType: row.attributes?.payment_type,
        });
        newCount++;
      }
    }
    if (newCount > 0) {
      console.log(`  offer ${offerId} (${FUNNEL_OFFERS[offerId]?.label}): +${newCount} new`);
    }
  }

  // Summary
  const paid = allPurchases.filter(p => p.amountCents > 0);
  console.log(`\n=== RESULTS (last 30 days) ===`);
  console.log(`Total paid purchases: ${paid.length}`);
  
  const byOffer = {};
  for (const p of paid) {
    const name = FUNNEL_OFFERS[p.offerId]?.label || `unknown:${p.offerId}`;
    if (!byOffer[name]) byOffer[name] = { count: 0, revenue: 0 };
    byOffer[name].count++;
    byOffer[name].revenue += p.amountCents / 100;
  }
  
  let totalRevenue = 0;
  for (const [name, s] of Object.entries(byOffer)) {
    console.log(`  ${name}: ${s.count} sales · $${s.revenue.toFixed(0)}`);
    totalRevenue += s.revenue;
  }
  console.log(`  TOTAL REVENUE: $${totalRevenue.toFixed(0)}`);

  // Today
  const today = new Date().toISOString().split('T')[0];
  const todayPaid = paid.filter(p => p.createdAt.startsWith(today));
  console.log(`\n=== TODAY (${today}) ===`);
  console.log(`Paid: ${todayPaid.length}`);
  todayPaid.forEach(p => {
    const name = FUNNEL_OFFERS[p.offerId]?.label || `unknown:${p.offerId}`;
    console.log(`  $${(p.amountCents/100).toFixed(0)} | ${name} | ${p.createdAt}`);
  });
}

main().catch(console.error);
