/**
 * adsOptimizationEngine.ts — Daily optimization engine using per-SKU CPA targets.
 * CPA = Cost Per Acquisition (buyer), not CPL (lead).
 * SKU detection: campaign name must contain the SKU keyword.
 */
import { getDb } from "./db";
import { adsGuardrails, adsOptimizationLogs, skuCpaTargets } from "../drizzle/schema";
import {
  getMetaAdsConfig,
  getCampaigns,
  getAdSets,
  updateCampaignStatus,
  updateAdSetBudget,
  getCampaignInsights,
} from "./metaAdsClient";
import { notifyOwner } from "./_core/notification";
import { getSkuConfig } from "../shared/skuConfig";

export interface OptimizationResult {
  campaignsChecked: number;
  actionsToken: OptimizationAction[];
  errors: string[];
  timestamp: string;
}

export interface OptimizationAction {
  campaignId: string;
  campaignName: string;
  skuId: string;
  action: "scaled" | "paused" | "warned" | "held" | "skipped";
  reason: string;
  previousBudget?: number;
  newBudget?: number;
  metrics: {
    spend: number;
    cpa: number;
    cpl: number;
    ctr: number;
    frequency: number;
    purchases: number;
    leads: number;
  };
}

function detectSkuFromCampaignName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("kbmo") || n.includes("food sensitivity")) return "kbmoTesting";
  if (n.includes("orobiome") || n.includes("oral microbiome")) return "orobiomeTestKit";
  if (n.includes("sleep test") || n.includes("sleeptest")) return "sleepTestKit";
  if (n.includes("lights on course") || n.includes("lightson course")) return "lightsOnCourse";
  if (n.includes("lights on") || n.includes("lightson")) return "lightsOn";
  if (n.includes("academy") || n.includes("urban monk academy")) return "academy";
  if (n.includes("upstream")) return "upstream";
  return "general";
}

export async function runDailyOptimization(): Promise<OptimizationResult> {
  const db = await getDb();
  if (!db) {
    return { campaignsChecked: 0, actionsToken: [], errors: ["DB unavailable"], timestamp: new Date().toISOString() };
  }

  const result: OptimizationResult = {
    campaignsChecked: 0,
    actionsToken: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const guardrailRows = await db.select().from(adsGuardrails).limit(1);
  const guardrails = guardrailRows[0] ?? {
    autoScaleEnabled: true,
    autoPauseEnabled: true,
    maxFrequencyBeforePause: "4.0",
    minCtrBeforePause: "0.3",
    scaleUpMultiplier: "1.20",
    minSpendForAction: "5.00",
  };

  // Load per-SKU CPA targets from DB (editable in-app); fall back to static config
  const dbSkuRows = await db.select().from(skuCpaTargets);
  const dbSkuMap: Record<string, { targetCpa: number; minDailyBudget: number; maxDailyBudget: number }> =
    Object.fromEntries(dbSkuRows.map((r) => [
      r.skuId,
      {
        targetCpa: parseFloat(r.targetCpa),
        minDailyBudget: parseFloat(r.minDailyBudget),
        maxDailyBudget: parseFloat(r.maxDailyBudget),
      },
    ]));

  function getSkuTargets(skuId: string) {
    if (dbSkuMap[skuId]) return dbSkuMap[skuId];
    const staticSku = getSkuConfig(skuId);
    return { targetCpa: staticSku.targetCpa, minDailyBudget: staticSku.minDailyBudget, maxDailyBudget: staticSku.maxDailyBudget };
  }

  const maxFreq = parseFloat(guardrails.maxFrequencyBeforePause ?? "4");
  const minCtr = parseFloat(guardrails.minCtrBeforePause ?? "0.3");
  const scaleMultiplier = parseFloat(guardrails.scaleUpMultiplier ?? "1.20");
  const minSpend = parseFloat(guardrails.minSpendForAction ?? "5");

  const config = getMetaAdsConfig();
  let campaigns: any[] = [];
  try {
    const rawCampaigns = await getCampaigns(config);
    const enriched = await Promise.all(
      rawCampaigns.map(async (c) => {
        try {
          const insights = await getCampaignInsights(config, c.id, "last_7d");
          const ins = insights[0];
          const spend = parseFloat(ins?.spend ?? "0");
          const purchases = parseInt(ins?.actions?.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase")?.value ?? "0");
          const leads = parseInt(ins?.actions?.find((a: any) => a.action_type === "lead")?.value ?? "0");
          const clicks = parseInt(ins?.clicks ?? "0");
          const impressions = parseInt(ins?.impressions ?? "0");
          const cpa = purchases > 0 ? spend / purchases : 0;
          const cpl = leads > 0 ? spend / leads : 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const frequency = parseFloat(ins?.frequency ?? "0");
          return { ...c, spend, purchases, leads, cpa, cpl, ctr, frequency };
        } catch {
          return { ...c, spend: 0, purchases: 0, leads: 0, cpa: 0, cpl: 0, ctr: 0, frequency: 0 };
        }
      })
    );
    campaigns = enriched;
  } catch (e: any) {
    result.errors.push(`Failed to fetch campaigns: ${e.message}`);
    return result;
  }

  result.campaignsChecked = campaigns.length;

  for (const campaign of campaigns) {
    const skuId = detectSkuFromCampaignName(campaign.name);
    const sku = getSkuConfig(skuId); // for label/shortLabel
    const skuTargets = getSkuTargets(skuId); // DB-backed CPA targets (editable in-app)

    const action: OptimizationAction = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      skuId,
      action: "held",
      reason: "Within target range",
      metrics: {
        spend: campaign.spend ?? 0,
        cpa: campaign.cpa ?? 0,
        cpl: campaign.cpl ?? 0,
        ctr: campaign.ctr ?? 0,
        frequency: campaign.frequency ?? 0,
        purchases: campaign.purchases ?? 0,
        leads: campaign.leads ?? 0,
      },
    };

    try {
      if (action.metrics.spend < minSpend) {
        action.action = "skipped";
        action.reason = `Insufficient spend ($${action.metrics.spend.toFixed(2)}) for reliable optimization`;
        result.actionsToken.push(action);
        continue;
      }
      if (campaign.status === "PAUSED") {
        action.action = "skipped";
        action.reason = "Campaign already paused";
        result.actionsToken.push(action);
        continue;
      }

      const effectiveCost = action.metrics.purchases > 0 ? action.metrics.cpa : action.metrics.cpl;
      const targetCpa = skuTargets.targetCpa;
      const minBudget = skuTargets.minDailyBudget;
      const maxBudget = skuTargets.maxDailyBudget;
      const cpaRatio = effectiveCost > 0 ? effectiveCost / targetCpa : 0;
      const metricLabel = action.metrics.purchases > 0 ? "CPA" : "CPL";

      if (guardrails.autoPauseEnabled && action.metrics.ctr < minCtr && action.metrics.frequency > maxFreq) {
        await updateCampaignStatus(config, campaign.id, "PAUSED");
        action.action = "paused";
        action.reason = `Creative fatigue: CTR ${action.metrics.ctr.toFixed(2)}% < ${minCtr}%, freq ${action.metrics.frequency.toFixed(1)}x [${sku.shortLabel}]`;
      } else if (guardrails.autoPauseEnabled && cpaRatio > 1.5 && action.metrics.frequency > maxFreq) {
        await updateCampaignStatus(config, campaign.id, "PAUSED");
        action.action = "paused";
        action.reason = `${metricLabel} $${effectiveCost.toFixed(2)} is ${(cpaRatio * 100).toFixed(0)}% of $${targetCpa} target, freq ${action.metrics.frequency.toFixed(1)}x [${sku.shortLabel}]`;
      } else if (cpaRatio > 1.2 && cpaRatio <= 1.5) {
        action.action = "warned";
        action.reason = `${metricLabel} $${effectiveCost.toFixed(2)} is ${(cpaRatio * 100).toFixed(0)}% of $${targetCpa} target — monitor [${sku.shortLabel}]`;
      } else if (guardrails.autoScaleEnabled && cpaRatio < 0.8 && (action.metrics.purchases >= 1 || action.metrics.leads >= 3)) {
        const adSets = await getAdSets(config, campaign.id);
        for (const adSet of adSets) {
          const currentBudget = parseInt(adSet.daily_budget ?? "0", 10);
          if (currentBudget <= 0) continue;
          const newBudget = Math.min(Math.round(currentBudget * scaleMultiplier), maxBudget * 100);
          const newBudgetDollars = newBudget / 100;
          const currentBudgetDollars = currentBudget / 100;
          if (newBudgetDollars > maxBudget) {
            action.action = "held";
            action.reason = `At max budget cap ($${maxBudget}/day) — ${metricLabel} excellent at $${effectiveCost.toFixed(2)} [${sku.shortLabel}]`;
          } else if (newBudgetDollars >= minBudget) {
            await updateAdSetBudget(config, adSet.id, newBudget);
            action.action = "scaled";
            action.previousBudget = currentBudgetDollars;
            action.newBudget = newBudgetDollars;
            action.reason = `${metricLabel} $${effectiveCost.toFixed(2)} is ${((1 - cpaRatio) * 100).toFixed(0)}% below $${targetCpa} target — scaled $${currentBudgetDollars.toFixed(0)} → $${newBudgetDollars.toFixed(0)}/day [${sku.shortLabel}]`;
          }
        }
      } else {
        action.action = "held";
        action.reason = `${metricLabel} $${effectiveCost.toFixed(2)} within target range (${(cpaRatio * 100).toFixed(0)}% of $${targetCpa}) [${sku.shortLabel}]`;
      }
    } catch (e: any) {
      action.action = "skipped";
      action.reason = `Error: ${e.message}`;
      result.errors.push(`Campaign ${campaign.id}: ${e.message}`);
    }

    result.actionsToken.push(action);
    try {
      await db.insert(adsOptimizationLogs).values({
        campaignId: action.campaignId,
        campaignName: action.campaignName,
        action: action.action,
        reason: action.reason,
        previousBudget: action.previousBudget?.toString() ?? null,
        newBudget: action.newBudget?.toString() ?? null,
        metricsSnapshot: JSON.stringify(action.metrics),
        createdAt: new Date(),
      });
    } catch (_) {}
  }

  const actionsTaken = result.actionsToken.filter((a) => a.action === "scaled" || a.action === "paused" || a.action === "warned");
  if (actionsTaken.length > 0) {
    const summary = actionsTaken.map((a) => `• ${a.campaignName} [${a.skuId}]: ${a.action.toUpperCase()} — ${a.reason}`).join("\n");
    await notifyOwner({
      title: `Ads Optimizer: ${actionsTaken.length} action(s) taken`,
      content: `Daily optimization run completed.\n\n${summary}\n\nView full details in Ads Manager → Optimization Log.`,
    }).catch(() => {});
  }

  return result;
}
