/**
 * funnelAdvisorRouter.ts
 *
 * Watches live Meta + Kajabi data at each funnel step, compares against
 * benchmarks, scores each step's health, and surfaces the single
 * highest-leverage optimization action to take today.
 *
 * Funnel steps tracked:
 *   Step 1: Ad → Lead (Meta CPL)
 *   Step 2: Lead → $67 OTO (Kajabi CR)
 *   Step 3: $67 buyer → $299 Course (Kajabi CR)
 *   Step 4: $67 buyer → $399 Test+Consult (Kajabi CR)
 *   Step 5: $67 buyer → $499 Bundle (Kajabi CR)
 *   Step 6: Mid-tier → $9,850 High-Ticket (sales team close rate)
 *
 * Each step is scored Red / Yellow / Green against industry benchmarks.
 * The lowest-scoring bottleneck gets the #1 action recommendation.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { canonicalMetaLeadCount } from "./metaActionMetrics";

// ── Benchmarks ────────────────────────────────────────────────────────────────
// These are the target ranges for a healthy funnel at this price point.
// Red = below floor, Yellow = floor–target, Green = at or above target.

const BENCHMARKS = {
  cpl: {
    label: "Cost Per Lead",
    unit: "$",
    green: { max: 5 },
    yellow: { min: 5, max: 10 },
    red: { min: 10 },
    tip: {
      red: "CPL is too high. Test new creative angles, tighten audience targeting, or pause underperforming ad sets. Aim for <$5.",
      yellow: "CPL is acceptable but has room to improve. A/B test headline hooks and first-3-second video cuts.",
      green: "CPL is healthy. Scale winning ad sets by 20% every 48 hours while monitoring frequency.",
    },
  },
  cr67: {
    label: "$67 OTO Conversion Rate",
    unit: "%",
    green: { min: 5 },
    yellow: { min: 2, max: 5 },
    red: { max: 2 },
    tip: {
      red: "Less than 2% of leads are buying the $67 offer. The VSL or sales page needs work — test a shorter headline, add urgency, or rewrite the first 90 seconds of the video.",
      yellow: "CR is in range but not great. Test a different price anchor, add a stronger guarantee, or add social proof above the fold.",
      green: "Strong $67 CR. Focus on maximizing order bump and OTO attach rates next.",
    },
  },
  crBump: {
    label: "$27 Order Bump Rate",
    unit: "%",
    green: { min: 30 },
    yellow: { min: 15, max: 30 },
    red: { max: 15 },
    tip: {
      red: "Bump rate is low. Rewrite the bump copy to be a no-brainer add-on. Make it feel incomplete without it.",
      yellow: "Bump rate is decent. Test a different bump offer or reframe the value proposition.",
      green: "Bump rate is excellent. Keep the copy and test a slightly higher bump price.",
    },
  },
  crOto: {
    label: "$97 OTO Rate",
    unit: "%",
    green: { min: 15 },
    yellow: { min: 8, max: 15 },
    red: { max: 8 },
    tip: {
      red: "OTO rate is low. The OTO page likely doesn't feel like a natural next step. Tie it directly to what they just bought.",
      yellow: "OTO rate is in range. Test a video vs. text-only OTO page.",
      green: "OTO is converting well. Test a higher price point.",
    },
  },
  crMid: {
    label: "Mid-Tier ($299–$499) Rate",
    unit: "%",
    green: { min: 5 },
    yellow: { min: 2, max: 5 },
    red: { max: 2 },
    tip: {
      red: "Mid-tier CR is very low. This is your biggest revenue lever. The email sequence after the $67 purchase likely needs a stronger bridge to the test kit offer.",
      yellow: "Mid-tier CR is building. Add a dedicated email sequence specifically for $67 buyers — 5-email bridge to the test.",
      green: "Mid-tier is converting. Focus on which price point ($299/$399/$499) is performing best and double down.",
    },
  },
  crHighTicket: {
    label: "High-Ticket Close Rate",
    unit: "%",
    green: { min: 20 },
    yellow: { min: 10, max: 20 },
    red: { max: 10 },
    tip: {
      red: "Close rate is below 10%. The sales team needs better qualification criteria or a stronger pre-call nurture sequence.",
      yellow: "Close rate is in range. Add a pre-call video that primes prospects on the $9,850 program value.",
      green: "Close rate is strong. Focus on increasing the volume of qualified calls booked.",
    },
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "green" | "yellow" | "red" | "no_data";

interface FunnelStep {
  id: string;
  label: string;
  value: number | null;
  benchmark: { green: string; yellow: string; floor: string };
  status: StepStatus;
  tip: string;
  priority: number; // 1 = highest priority bottleneck
}

interface FunnelAdvisorResult {
  steps: FunnelStep[];
  topAction: {
    stepId: string;
    stepLabel: string;
    status: StepStatus;
    value: number | null;
    unit: string;
    recommendation: string;
    why: string;
  } | null;
  overallHealth: "critical" | "needs_work" | "on_track" | "scaling";
  fetchedAt: number;
  datePreset: string;
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function scoreStep(
  id: keyof typeof BENCHMARKS,
  value: number | null
): { status: StepStatus; tip: string } {
  if (value === null || value === 0) return { status: "no_data", tip: "No data yet for this step." };
  const b = BENCHMARKS[id];

  // Lower-is-better (CPL)
  if (id === "cpl") {
    if (value <= (b.green as { max: number }).max) return { status: "green", tip: b.tip.green };
    if (value <= (b.yellow as { min: number; max: number }).max) return { status: "yellow", tip: b.tip.yellow };
    return { status: "red", tip: b.tip.red };
  }

  // Higher-is-better (all CRs)
  const g = b.green as { min: number };
  const y = b.yellow as { min: number; max: number };
  if (value >= g.min) return { status: "green", tip: b.tip.green };
  if (value >= y.min) return { status: "yellow", tip: b.tip.yellow };
  return { status: "red", tip: b.tip.red };
}

function statusPriority(s: StepStatus): number {
  return s === "red" ? 0 : s === "yellow" ? 1 : s === "no_data" ? 2 : 3;
}

// ── Kajabi token cache ────────────────────────────────────────────────────────

let _kajabiToken: { token: string; expiresAt: number } | null = null;
async function getKajabiToken(): Promise<string> {
  const now = Date.now();
  if (_kajabiToken && _kajabiToken.expiresAt > now + 60_000) return _kajabiToken.token;
  const res = await fetch("https://api.kajabi.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.KAJABI_CLIENT_ID!,
      client_secret: process.env.KAJABI_CLIENT_SECRET!,
    }),
  });
  const data = await res.json() as { access_token: string; expires_in: number };
  _kajabiToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return _kajabiToken.token;
}

// ── Meta token helper ─────────────────────────────────────────────────────────

function getMetaHeaders() {
  return { Authorization: `Bearer ${process.env.META_AD_ACCESS_TOKEN}` };
}

function getDateSince(preset: string): string {
  const d = new Date();
  switch (preset) {
    case "today":      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
    case "yesterday":  { const x = new Date(d); x.setDate(x.getDate()-1); return new Date(x.getFullYear(),x.getMonth(),x.getDate()).toISOString().split("T")[0]; }
    case "last_7d":    { const x = new Date(d); x.setDate(x.getDate()-7); return x.toISOString().split("T")[0]; }
    case "last_14d":   { const x = new Date(d); x.setDate(x.getDate()-14); return x.toISOString().split("T")[0]; }
    case "this_month": return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    default:           { const x = new Date(d); x.setDate(x.getDate()-30); return x.toISOString().split("T")[0]; }
  }
}

// ── Data cache ────────────────────────────────────────────────────────────────
const CACHE_TTL = 10 * 60 * 1000;
const _cache: Record<string, { data: FunnelAdvisorResult; ts: number }> = {};

// ── Funnel offer IDs ──────────────────────────────────────────────────────────
const FUNNEL_OFFERS: Record<string, string> = {
  "2151314475": "67",
  "2151019899": "299",
  "2150211911": "399",
  "2151178828": "399",
  "2151031660": "499",
};

const KAJABI_SITE_ID = "2148432935";
const META_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "";

// ── Main analysis function ────────────────────────────────────────────────────

async function analyzeFunnel(datePreset: string): Promise<FunnelAdvisorResult> {
  const cacheKey = datePreset;
  const cached = _cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const since = getDateSince(datePreset);

  // ── 1. Pull Meta leads + spend ────────────────────────────────────────────
  let totalLeads = 0;
  let totalSpend = 0;
  try {
    const accountId = META_ACCOUNT_ID.replace("act_", "");
    const fields = "spend,actions,campaign_name";
    const url = `https://graph.facebook.com/v21.0/act_${accountId}/insights?fields=${fields}&time_range={"since":"${since}","until":"${new Date().toISOString().split("T")[0]}"}&level=campaign&limit=100`;
    const res = await fetch(url, { headers: getMetaHeaders() });
    const data = await res.json() as { data?: Array<{ spend: string; actions?: Array<{ action_type: string; value: string }>; campaign_name: string }> };
    for (const row of data.data || []) {
      const name = (row.campaign_name || "").toLowerCase();
      if (!name.includes("interconnected")) continue;
      totalSpend += parseFloat(row.spend || "0");
      totalLeads += canonicalMetaLeadCount(row.actions || []);
    }
  } catch { /* non-fatal */ }

  const cpl = totalLeads > 0 ? totalSpend / totalLeads : null;

  // ── 2. Pull Kajabi purchases ───────────────────────────────────────────────
  const tierCounts: Record<string, number> = {};
  try {
    const token = await getKajabiToken();
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" };
    let page = 1;
    while (true) {
      const res = await fetch(
        `https://api.kajabi.com/v1/purchases?filter[site_id]=${KAJABI_SITE_ID}&filter[created_at_gteq]=${since}&page[size]=100&page[number]=${page}`,
        { headers }
      );
      const data = await res.json() as { data?: Array<{ relationships: { offer: { data: { id: string } } }; attributes: { amount_in_cents: number } }>; links?: { next?: string } };
      for (const p of data.data || []) {
        const offerId = p.relationships?.offer?.data?.id;
        const tier = offerId ? FUNNEL_OFFERS[offerId] : null;
        if (tier) {
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        }
      }
      if (!data.links?.next || (data.data || []).length < 100) break;
      page++;
    }
  } catch { /* non-fatal */ }

  const buyers67 = tierCounts["67"] || 0;
  const buyers299 = tierCounts["299"] || 0;
  const buyers399 = tierCounts["399"] || 0;
  const buyers499 = tierCounts["499"] || 0;
  const totalMidBuyers = buyers299 + buyers399 + buyers499;

  // Compute CRs
  const cr67 = totalLeads > 0 ? (buyers67 / totalLeads) * 100 : null;
  // Mid-tier CR is vs $67 buyers (they're the warm audience for the next offer)
  const crMid = buyers67 > 0 ? (totalMidBuyers / buyers67) * 100 : null;
  // High-ticket: we don't have live data yet — use the known 20% default
  const crHighTicket = 20; // sales team close rate

  // ── 3. Score each step ────────────────────────────────────────────────────
  const steps: FunnelStep[] = [
    {
      id: "cpl",
      label: "Ad → Lead (CPL)",
      value: cpl,
      benchmark: { green: "≤$5", yellow: "$5–$10", floor: ">$10 = red" },
      ...scoreStep("cpl", cpl),
      priority: 0,
    },
    {
      id: "cr67",
      label: "Lead → $67 OTO",
      value: cr67,
      benchmark: { green: "≥5%", yellow: "2–5%", floor: "<2% = red" },
      ...scoreStep("cr67", cr67),
      priority: 0,
    },
    {
      id: "crMid",
      label: "$67 Buyer → Mid-Tier ($299–$499)",
      value: crMid,
      benchmark: { green: "≥5%", yellow: "2–5%", floor: "<2% = red" },
      ...scoreStep("crMid", crMid),
      priority: 0,
    },
    {
      id: "crHighTicket",
      label: "Mid-Tier → $9,850 Close",
      value: crHighTicket,
      benchmark: { green: "≥20%", yellow: "10–20%", floor: "<10% = red" },
      ...scoreStep("crHighTicket", crHighTicket),
      priority: 0,
    },
  ];

  // Assign priority ranks (red first, then yellow, then no_data, then green)
  const sorted = [...steps].sort((a, b) => statusPriority(a.status) - statusPriority(b.status));
  sorted.forEach((s, i) => {
    const step = steps.find(x => x.id === s.id);
    if (step) step.priority = i + 1;
  });

  // ── 4. Top action ─────────────────────────────────────────────────────────
  const topStep = sorted[0];
  const topAction = topStep
    ? {
        stepId: topStep.id,
        stepLabel: topStep.label,
        status: topStep.status,
        value: topStep.value,
        unit: BENCHMARKS[topStep.id as keyof typeof BENCHMARKS]?.unit || "",
        recommendation: topStep.tip,
        why: buildWhy(topStep, totalLeads, buyers67, totalMidBuyers, totalSpend),
      }
    : null;

  // ── 5. Overall health ─────────────────────────────────────────────────────
  const redCount = steps.filter(s => s.status === "red").length;
  const greenCount = steps.filter(s => s.status === "green").length;
  const overallHealth =
    redCount >= 2 ? "critical" :
    redCount === 1 ? "needs_work" :
    greenCount >= 3 ? "scaling" :
    "on_track";

  const result: FunnelAdvisorResult = {
    steps,
    topAction,
    overallHealth,
    fetchedAt: Date.now(),
    datePreset,
  };

  _cache[cacheKey] = { data: result, ts: Date.now() };
  return result;
}

function buildWhy(
  step: FunnelStep,
  leads: number,
  buyers67: number,
  midBuyers: number,
  spend: number
): string {
  if (step.id === "cpl" && step.value !== null) {
    const monthly = leads > 0 ? Math.round(leads * (30 / 7)) : 0;
    return `At $${step.value.toFixed(2)} CPL with ${leads} leads tracked, you're spending $${spend.toFixed(0)}. Cutting CPL to $5 would give you ${Math.round(spend / 5)} leads for the same budget — ${Math.round(spend / 5 - leads)} more per period.`;
  }
  if (step.id === "cr67" && step.value !== null) {
    const missed = leads > 0 ? Math.round(leads * 0.05) - buyers67 : 0;
    return `Only ${buyers67} of ${leads} leads bought the $67 offer (${step.value.toFixed(1)}% CR). At the 5% benchmark, you'd have ${missed > 0 ? missed + " more buyers" : "hit target"} — worth $${(missed * 67).toFixed(0)} in additional revenue.`;
  }
  if (step.id === "crMid" && step.value !== null) {
    const target = Math.round(buyers67 * 0.05);
    const gap = target - midBuyers;
    return `${midBuyers} of ${buyers67} $67 buyers upgraded to a mid-tier offer (${step.value.toFixed(1)}% CR). At 5% you'd have ${gap > 0 ? gap + " more" : "hit target"} — each worth $299–$499 and feeding the $9,850 pipeline.`;
  }
  if (step.id === "crHighTicket") {
    return `Your sales team's 20% close rate is the benchmark. Every additional qualified call booked from the mid-tier funnel adds $1,970 in expected revenue (20% × $9,850).`;
  }
  return "Improving this step will have the largest downstream impact on revenue.";
}

// ── Router ────────────────────────────────────────────────────────────────────

export const funnelAdvisorRouter = router({
  getAnalysis: protectedProcedure
    .input(z.object({
      datePreset: z
        .enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month"])
        .default("last_7d"),
    }))
    .query(async ({ input }) => {
      return analyzeFunnel(input.datePreset);
    }),
});
