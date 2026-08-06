/**
 * metaFunnelMetricsRouter.ts
 *
 * Fetches live Meta Ads data for the Interconnected funnel and returns
 * aggregated CPL, spend, leads, and per-campaign breakdown.
 *
 * Filters to campaigns whose name contains "Interconnected" to avoid
 * blending KBMO/purchase-optimised campaigns into the CPL figure.
 *
 * Results are cached in-memory for 5 minutes to avoid hammering the API.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetaCampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: Array<{ action_type: string; value: string }>;
}

interface MetaInsightsResponse {
  data: MetaCampaignRow[];
  paging?: { cursors: { before: string; after: string }; next?: string };
  error?: { message: string; type: string; code: number };
}

interface CampaignMetric {
  id: string;
  name: string;
  spend: number;
  leads: number;
  clicks: number;
  cpl: number | null;
}

interface FunnelMetrics {
  totalSpend: number;
  totalLeads: number;
  avgCpl: number | null;
  dailySpend: number;
  dailyLeads: number;
  campaigns: CampaignMetric[];
  fetchedAt: number;
  datePreset: string;
  flags: FlagItem[];
}

interface FlagItem {
  level: "ok" | "warn" | "alert";
  message: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, { data: FunnelMetrics; ts: number }> = {};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLeads(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  // Meta reports lead form submissions as "lead" or "onsite_conversion.lead_grouped"
  const leadAction = actions.find(
    (a) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
  );
  return leadAction ? parseInt(leadAction.value, 10) : 0;
}

async function fetchMetaInsights(
  token: string,
  actId: string,
  datePreset: string
): Promise<MetaInsightsResponse> {
  const fields = "campaign_id,campaign_name,spend,impressions,clicks,actions";
  const params = new URLSearchParams({
    fields,
    date_preset: datePreset,
    level: "campaign",
    limit: "200",
    access_token: token,
  });
  const url = `https://graph.facebook.com/v20.0/${actId}/insights?${params}`;
  const res = await fetch(url);
  return res.json() as Promise<MetaInsightsResponse>;
}

function buildFlags(metrics: Omit<FunnelMetrics, "flags">): FlagItem[] {
  const flags: FlagItem[] = [];

  if (metrics.totalLeads === 0 && metrics.totalSpend > 0) {
    flags.push({ level: "alert", message: "⚠️ Spend detected but ZERO leads tracked — check pixel / lead form connection" });
  }

  if (metrics.avgCpl !== null) {
    if (metrics.avgCpl > 8) {
      flags.push({ level: "alert", message: `🔴 CPL $${metrics.avgCpl.toFixed(2)} is above $8 target — review creative & audiences` });
    } else if (metrics.avgCpl > 5) {
      flags.push({ level: "warn", message: `🟡 CPL $${metrics.avgCpl.toFixed(2)} is above $5 — monitor closely` });
    } else {
      flags.push({ level: "ok", message: `✅ CPL $${metrics.avgCpl.toFixed(2)} is within target range` });
    }
  }

  if (metrics.dailySpend > 0 && metrics.dailyLeads === 0) {
    flags.push({ level: "warn", message: "🟡 No leads today — could be early in the day or a tracking gap" });
  }

  if (metrics.dailySpend > 500) {
    flags.push({ level: "ok", message: `💰 Daily spend $${metrics.dailySpend.toFixed(0)} — funnel is active` });
  }

  // Check for any campaign with CPL > $15
  const hotCampaigns = metrics.campaigns.filter((c) => c.cpl !== null && c.cpl > 15);
  if (hotCampaigns.length > 0) {
    flags.push({
      level: "warn",
      message: `🟡 ${hotCampaigns.length} campaign(s) with CPL > $15 — consider pausing or refreshing creative`,
    });
  }

  return flags;
}

async function fetchFunnelMetrics(datePreset: string): Promise<FunnelMetrics> {
  const cacheKey = datePreset;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const token = process.env.META_AD_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    throw new Error("META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID not configured");
  }

  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  const [mainData, todayData] = await Promise.all([
    fetchMetaInsights(token, actId, datePreset),
    fetchMetaInsights(token, actId, "today"),
  ]);

  if (mainData.error) {
    throw new Error(`Meta API error: ${mainData.error.message}`);
  }

  // Filter to Interconnected funnel campaigns only
  const interconnectedRows = (mainData.data || []).filter((row) =>
    row.campaign_name.toLowerCase().includes("interconnected")
  );

  const campaigns: CampaignMetric[] = interconnectedRows.map((row) => {
    const leads = getLeads(row.actions);
    const spend = parseFloat(row.spend) || 0;
    return {
      id: row.campaign_id,
      name: row.campaign_name,
      spend,
      leads,
      clicks: parseInt(row.clicks, 10) || 0,
      cpl: leads > 0 ? spend / leads : null,
    };
  });

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null;

  // Today's totals
  const todayRows = (todayData.data || []).filter((row) =>
    row.campaign_name.toLowerCase().includes("interconnected")
  );
  const dailySpend = todayRows.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);
  const dailyLeads = todayRows.reduce((s, r) => s + getLeads(r.actions), 0);

  const partial: Omit<FunnelMetrics, "flags"> = {
    totalSpend,
    totalLeads,
    avgCpl,
    dailySpend,
    dailyLeads,
    campaigns,
    fetchedAt: Date.now(),
    datePreset,
  };

  const flags = buildFlags(partial);
  const result: FunnelMetrics = { ...partial, flags };

  cache[cacheKey] = { data: result, ts: Date.now() };
  return result;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const metaFunnelMetricsRouter = router({
  getLiveMetrics: protectedProcedure
    .input(
      z.object({
        datePreset: z
          .enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month"])
          .default("last_7d"),
      })
    )
    .query(async ({ input }) => {
      return fetchFunnelMetrics(input.datePreset);
    }),
});
