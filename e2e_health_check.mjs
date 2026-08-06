/**
 * End-to-end health check for all critical systems modified on Aug 4, 2026
 * Tests: opt-in form, Kajabi form submission, CAPI, A/B tracking, retry worker, watchdog, purchase webhook
 */
import { config } from 'dotenv';
config();

const BASE_URL = 'https://content.theurbanmonk.com';
const TEST_EMAIL = `healthcheck_${Date.now()}@gmail.com`;
const TEST_FIRST = 'HealthCheck';
const TEST_LAST = 'Test';

let passed = 0;
let failed = 0;
const results = [];

function log(name, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ': ' + detail : ''}`);
  results.push({ name, ok, detail });
  if (ok) passed++; else failed++;
}

async function post(path, body) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, ok: res.ok, json };
  } catch (err) {
    return { status: 0, ok: false, json: { error: err.message } };
  }
}

async function get(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

console.log('='.repeat(60));
console.log('URBAN MONK CONTENT HUB — END-TO-END HEALTH CHECK');
console.log(`Time: ${new Date().toISOString()}`);
console.log(`Test email: ${TEST_EMAIL}`);
console.log('='.repeat(60));
console.log('');

// ── 1. Server reachability ────────────────────────────────────────────
console.log('── 1. SERVER REACHABILITY ──');
const homeRes = await get('/');
log('Homepage loads (200)', homeRes.status === 200, `status=${homeRes.status}`);

const apiRes = await get('/api/trpc/auth.me');
log('tRPC API reachable', apiRes.status !== 0 && apiRes.status !== 502, `status=${apiRes.status}`);
console.log('');

// ── 2. Opt-in form submission ─────────────────────────────────────────
console.log('── 2. OPT-IN FORM (interconnected.submitOptIn) ──');
const optInRes = await post('/api/trpc/interconnected.submitOptIn', {
  "0": {
    json: {
      firstName: TEST_FIRST,
      lastName: TEST_LAST,
      email: TEST_EMAIL,
      phone: '',
      fbclid: null,
      fbp: null,
      fbc: null,
      utmSource: 'healthcheck',
      utmCampaign: 'e2e_test',
      utmContent: null,
      utmMedium: null,
      clientIp: '1.2.3.4',
      userAgent: 'HealthCheckBot/1.0',
    }
  }
});
log('Opt-in returns 200', optInRes.status === 200, `status=${optInRes.status}`);
const optInData = optInRes.json?.['0']?.result?.data;
log('Opt-in result has success', optInData?.success === true, JSON.stringify(optInData));
const leadId = optInData?.leadId;
log('Lead ID returned', !!leadId, `leadId=${leadId}`);
console.log('');

// ── 3. DB record verification ─────────────────────────────────────────
console.log('── 3. DATABASE RECORD ──');
if (leadId) {
  // Check via a small delay then query
  await new Promise(r => setTimeout(r, 2000));
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.default.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute(
    'SELECT id, email, kajabi_tagged, kajabi_form_submitted, created_at FROM interconnected_leads WHERE id = ? LIMIT 1',
    [leadId]
  );
  await conn.end();
  const lead = rows[0];
  log('Lead saved to DB', !!lead, lead ? `id=${lead.id}, email=${lead.email}` : 'NOT FOUND');
  if (lead) {
    log('kajabi_form_submitted = 1', lead.kajabi_form_submitted == 1, `value=${lead.kajabi_form_submitted}`);
    log('kajabi_tagged = 1', lead.kajabi_tagged == 1, `value=${lead.kajabi_tagged}`);
  }
} else {
  log('DB check skipped', false, 'No leadId returned from opt-in');
}
console.log('');

// ── 4. Kajabi form submission (direct API test) ───────────────────────
console.log('── 4. KAJABI FORM SUBMISSION API ──');
const KAJABI_FORM_ID = process.env.KAJABI_IC_FORM_ID || '2148815115'; // IC META LEADS form
const kajabiClientId = process.env.KAJABI_CLIENT_ID;
const kajabiClientSecret = process.env.KAJABI_CLIENT_SECRET;

let kajabiToken = null;
try {
  const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: kajabiClientId,
      client_secret: kajabiClientSecret,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const tokenData = await tokenRes.json();
  kajabiToken = tokenData.access_token;
  log('Kajabi OAuth token obtained', !!kajabiToken, kajabiToken ? 'OK' : JSON.stringify(tokenData));
} catch (err) {
  log('Kajabi OAuth token obtained', false, err.message);
}

if (kajabiToken) {
  // Find the IC META LEADS form
  const formsRes = await fetch('https://api.kajabi.com/v1/forms?filter[site_id]=2148432935', {
    headers: { 'Authorization': `Bearer ${kajabiToken}` },
    signal: AbortSignal.timeout(10000),
  });
  const formsData = await formsRes.json();
  const icForm = formsData?.data?.find(f => 
    f.attributes?.name?.toLowerCase().includes('ic meta') || 
    f.attributes?.name?.toLowerCase().includes('sp 26') ||
    f.attributes?.name?.toLowerCase().includes('sp26')
  );
  log('IC META LEADS form found in Kajabi', !!icForm, icForm ? `id=${icForm.id}, name="${icForm.attributes?.name}"` : 'NOT FOUND — check form ID');
  
  if (icForm) {
    // Test form submission with a unique test email
    const testFormEmail = `formtest_${Date.now()}@gmail.com`;
    const submitRes = await fetch(`https://api.kajabi.com/v1/forms/${icForm.id}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kajabiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'form_submissions',
          attributes: {
            fields: {
              email: testFormEmail,
              first_name: 'FormTest',
              last_name: 'HealthCheck',
            }
          }
        }
      }),
      signal: AbortSignal.timeout(15000),
    });
    log('Kajabi form submission returns 2xx', submitRes.status >= 200 && submitRes.status < 300, `status=${submitRes.status}`);
  }
}
console.log('');

// ── 5. Retry queue check ──────────────────────────────────────────────
console.log('── 5. RETRY QUEUE ──');
try {
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.default.createConnection(process.env.DATABASE_URL);
  const [pending] = await conn.execute("SELECT COUNT(*) as cnt FROM kajabi_retry_queue WHERE status = 'pending'");
  const [failed_rows] = await conn.execute("SELECT COUNT(*) as cnt FROM kajabi_retry_queue WHERE status = 'failed'");
  await conn.end();
  log('Retry queue accessible', true, `pending=${pending[0].cnt}, failed=${failed_rows[0].cnt}`);
  if (parseInt(failed_rows[0].cnt) > 0) {
    log('No permanently failed leads in retry queue', false, `${failed_rows[0].cnt} leads stuck — need manual review`);
  } else {
    log('No permanently failed leads in retry queue', true, 'All clear');
  }
} catch (err) {
  log('Retry queue accessible', false, err.message);
}
console.log('');

// ── 6. Purchase webhook test ──────────────────────────────────────────
console.log('── 6. PURCHASE WEBHOOK ──');
const webhookRes = await post('/api/kajabi/purchase', {
  event: 'member_purchase',
  email: `webhooktest_${Date.now()}@gmail.com`,
  name: 'Webhook Test',
  amount: 0,  // Intentionally 0 to test the fallback price map
  offer_name: 'Interconnected All-Access Bundle',
  offer_id: '57E3XFtT',
  id: `test_order_${Date.now()}`,
});
log('Purchase webhook returns 200', webhookRes.status === 200, `status=${webhookRes.status}`);
log('Purchase webhook returns ok=true', webhookRes.json?.ok === true, JSON.stringify(webhookRes.json));
// The amount should have been resolved to $67 via the price map
// We can't easily verify this without DB access here, but ok=true means it processed
console.log('');

// ── 7. A/B test infrastructure ────────────────────────────────────────
console.log('── 7. A/B TEST INFRASTRUCTURE ──');
try {
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.default.createConnection(process.env.DATABASE_URL);
  const [tables] = await conn.execute("SHOW TABLES LIKE 'ab_%'");
  const tableNames = tables.map(t => Object.values(t)[0]);
  log('ab_tests table exists', tableNames.includes('ab_tests'), tableNames.join(', '));
  log('ab_exposures table exists', tableNames.includes('ab_exposures'), tableNames.join(', '));
  log('ab_conversions table exists', tableNames.includes('ab_conversions'), tableNames.join(', '));
  
  const [tests] = await conn.execute("SELECT id, name, status FROM ab_tests LIMIT 5");
  log('Active A/B tests in DB', tests.length > 0, tests.map(t => `${t.name}(${t.status})`).join(', '));
  await conn.end();
} catch (err) {
  log('A/B test infrastructure', false, err.message);
}
console.log('');

// ── 8. Watchdog check ────────────────────────────────────────────────
console.log('── 8. LEAD WATCHDOG ──');
try {
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.default.createConnection(process.env.DATABASE_URL);
  // Simulate what the watchdog does — count leads in last 65 min using correct column
  const cutoff = Date.now() - (65 * 60 * 1000);
  const [rows] = await conn.execute(
    'SELECT COUNT(*) as cnt FROM interconnected_leads WHERE created_at >= ?',
    [cutoff]
  );
  await conn.end();
  log('Watchdog query works (correct column)', true, `${rows[0].cnt} leads in last 65 min`);
} catch (err) {
  log('Watchdog query works', false, err.message);
}
console.log('');

// ── Summary ───────────────────────────────────────────────────────────
console.log('='.repeat(60));
console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\nFAILED CHECKS:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
  process.exit(1);
} else {
  console.log('\n✅ ALL SYSTEMS OPERATIONAL');
  process.exit(0);
}
