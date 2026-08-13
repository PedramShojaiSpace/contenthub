const accessToken = process.env.META_AD_ACCESS_TOKEN;
const adAccountId = process.env.META_AD_ACCOUNT_ID;

if (!accessToken || !adAccountId) {
  throw new Error("Meta ad-account credentials are unavailable");
}

const accountResponse = await fetch(
  `https://graph.facebook.com/v19.0/act_${adAccountId}?fields=timezone_name,timezone_offset_hours_utc&access_token=${accessToken}`
);
const accountPayload = await accountResponse.json();
if (!accountResponse.ok || accountPayload.error) {
  throw new Error(`Meta ad-account timezone query failed: ${accountPayload.error?.message || accountResponse.status}`);
}

const timeRange = JSON.stringify({ since: "2026-08-01", until: "2026-08-12" });
const fields = "campaign_name,adset_name,spend,impressions,actions";
const url = new URL(`https://graph.facebook.com/v19.0/act_${adAccountId}/insights`);
url.searchParams.set("fields", fields);
url.searchParams.set("time_range", timeRange);
url.searchParams.set("level", "adset");
url.searchParams.set("breakdowns", "hourly_stats_aggregated_by_advertiser_time_zone");
url.searchParams.set("limit", "500");
url.searchParams.set("access_token", accessToken);

const response = await fetch(url);
const payload = await response.json();
if (!response.ok || payload.error) {
  throw new Error(`Meta hourly insights failed: ${payload.error?.message || response.status}`);
}

const hours = Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, { spend: 0, impressions: 0, leads: 0 }]));
const relevantRows = (payload.data || []).filter((row) => {
  const name = `${row.campaign_name || ""} ${row.adset_name || ""}`.toLowerCase();
  return name.includes("agora");
});

for (const row of relevantRows) {
  const hourLabel = String(row.hourly_stats_aggregated_by_advertiser_time_zone || "");
  const match = hourLabel.match(/(\d{1,2}):00/);
  if (!match) continue;
  const hour = Number(match[1]);
  if (!(hour in hours)) continue;
  hours[hour].spend += Number(row.spend || 0);
  hours[hour].impressions += Number(row.impressions || 0);
  const lead = (row.actions || []).find((action) => action.action_type === "lead");
  hours[hour].leads += Number(lead?.value || 0);
}

const totalSpend = Object.values(hours).reduce((sum, value) => sum + value.spend, 0);
const eveningSpend = [17, 18, 19, 20, 21, 22].reduce((sum, hour) => sum + hours[hour].spend, 0);
console.log(JSON.stringify({
  period: "2026-08-01 through 2026-08-12",
  scope: "Agora campaign/ad set names only",
  accountTimezone: accountPayload.timezone_name,
  accountTimezoneOffsetHoursUtc: accountPayload.timezone_offset_hours_utc,
  totalSpend: Number(totalSpend.toFixed(2)),
  eveningSpend17to22: Number(eveningSpend.toFixed(2)),
  eveningSpendShare: totalSpend ? Number((eveningSpend / totalSpend).toFixed(4)) : null,
  rawHourLabels: [...new Set(relevantRows.map((row) => row.hourly_stats_aggregated_by_advertiser_time_zone || "unknown"))],
  hours,
  relevantRows: relevantRows.length,
}, null, 2));
