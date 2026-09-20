import { sql } from "drizzle-orm";
import { ENV } from "../server/_core/env";
import { getDb } from "../server/db";

const now = Date.now();
const sinceMinutes = Number(process.env.SINCE_MINUTES ?? "30");
const sinceMs = now - sinceMinutes * 60_000;
const headers = {
  Authorization: `Klaviyo-API-Key ${ENV.klaviyoPrivateKey}`,
  "Content-Type": "application/json",
  revision: "2026-07-15",
};

function unwrapRows(value: unknown): Array<Record<string, unknown>> {
  const outer = Array.isArray(value) ? value[0] : value;
  return Array.isArray(outer) ? outer as Array<Record<string, unknown>> : outer ? [outer as Record<string, unknown>] : [];
}

async function klaviyo(path: string) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = {}; }
  return { ok: response.ok, status: response.status, body };
}

async function metricName(metricId: string, cache: Map<string, string | null>) {
  if (cache.has(metricId)) return cache.get(metricId) ?? null;
  const metric = await klaviyo(`/metrics/${metricId}/`);
  const name = metric.ok ? metric.body?.data?.attributes?.name ?? null : null;
  cache.set(metricId, name);
  return name;
}

async function main() {
  if (!ENV.klaviyoPrivateKey) throw new Error("Klaviyo API key unavailable");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const raw = await db.execute(sql`
    SELECT email, created_at
    FROM interconnected_leads
    WHERE funnel_path = 'ko_klaviyo' AND created_at >= ${sinceMs}
    ORDER BY created_at ASC
    LIMIT 25
  `);
  const rows = unwrapRows(raw);
  const metricCache = new Map<string, string | null>();
  const summary = new Map<string, number>();
  let profileLookupOk = 0;
  let receivedEmailProfiles = 0;
  let eventReadErrors = 0;

  for (const row of rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const profile = await klaviyo(`/profiles/?filter=${encodeURIComponent(`equals(email,"${email}")`)}`);
    const profileId = profile.body?.data?.[0]?.id ?? null;
    if (!profile.ok || !profileId) { eventReadErrors += 1; continue; }
    profileLookupOk += 1;
    const events = await klaviyo(`/events/?filter=${encodeURIComponent(`equals(profile_id,"${profileId}")`)}&page%5Bsize%5D=30&sort=-datetime`);
    if (!events.ok) { eventReadErrors += 1; continue; }
    const names = new Set<string>();
    for (const event of events.body?.data ?? []) {
      const occurred = Date.parse(event?.attributes?.datetime ?? "");
      if (!Number.isFinite(occurred) || occurred < sinceMs) continue;
      const id = event?.relationships?.metric?.data?.id;
      if (!id) continue;
      const name = await metricName(id, metricCache);
      if (name) names.add(name);
    }
    if (names.has("Received Email")) receivedEmailProfiles += 1;
    for (const name of names) summary.set(name, (summary.get(name) ?? 0) + 1);
  }

  console.log(JSON.stringify({
    checkedAt: new Date(now).toISOString(),
    sinceMinutes,
    recentKoLeadCount: rows.length,
    profileLookupOk,
    receivedEmailProfiles,
    observedEventMetrics: Object.fromEntries([...summary.entries()].sort(([a], [b]) => a.localeCompare(b))),
    eventReadErrors,
  }, null, 2));
}

await main();
