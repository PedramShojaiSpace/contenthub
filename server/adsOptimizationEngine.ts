/**
 * adsOptimizationEngine.ts
 *
 * Phase 3 — Automated daily optimization engine.
 * Runs within budget guardrails set by the owner.
 * All changes are logged to adsOptimizationLogs table.
 *
 * Strategy (aligned with project ad spend philosophy):
 *  - SCALE winners: CPL < target * 0.8 AND spend < maxDailyBudget → increase budget 20%
 *  - HOLD steady: CPL within 0.8–1.2x target → no change
 *  - WARN: CPL 1.2–1.5x target → flag for review, no auto-change
 *  - PAUSE: CPL > 1.5x target AND frequency > 4 → pause campaign
 *  - PAUSE: CTR < 0.3% AND frequency > 3 → creative fatigue, pause
 *  - NEVER reduce budget below minDailyBudget guardrail
 *  - NEVER increase budget above maxDailyBudget guardrail
 *  - NEVER pause if spend < $5/day (not enough data)
 */

import { getDb } from "./db";
import { adsGuardrails, adsOptimizationLogs } from "../drizzle/schema";
import {
  getMetaAdsConfig,
  getCampaigns,
  getAdSets,
  updateCampaignStatus,
  updateAdSetBudget,
  getCampaignInsights,
} from "./metaAdsClient";
import { notifyOwner } from "./_core/notification";

export interface OptimizationResult {
  campaignsChecked: number;
  actionsToken: OptimizationAction[];
  errors: string[];
  timestamp: string;
}

export interface OptimizationAction {
  campaignId: string;
  campaignName: string;
  action: "scaled" | "paused" | "warned" | "held" | "skipped";
  reason: string;
  previousBudget?: number;
  newBudget?: number;
  metrics: {
    spend: number;
    cpl: number;
    ctr: number;
    frequency: number;
    leads: number;
  };
}

export async function runDailyOptimization(): Promise<OptimizationResult> {
  const db = await getDb();
  if (!db) {
    return {
      campaignsChecked: 0,
      actionsToken: [],
      errors: ["DB unavailable"],
      timestamp: new Date().toISOString(),
    };
  }

  const result: OptimizationResult = {
    campaignsChecked: 0,
    actionsToken: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // Load guardrails config
  const guardrailRows = await db.select().from(adsGuardrails).limit(1);
  const guardrails = guardrailRows[0] ?? {
    targetCpl: "25.00",
    minDailyBudget: "20.00",
    maxDailyBudget: "200.00",
    autoScaleEnabled: true,
    autoPauseEnabled: true,
    maxFrequencyBeforePause: "4.0",
    minCtrBeforePause: "0.3",
    scaleUpMultiplier: "1.20",
    minSpendForAction: "5.00",
  };

  const targetCpl = parseFloat(guardrails.targetCpl ?? "25");
  const minBudget = parseFloat(guardrails.minDailyBudget ?? "20");
  const maxBudget = parseFloat(guardrails.maxDailyBudget ?? "200");
  const maxFreq = parseFloat(guardrails.maxFrequencyBeforePause ?? "4");
  const minCtr = parseFloat(guardrails.minCtrBeforePause ?? "0.3");
  const scaleMultiplier = parseFloat(guardrails.scaleUpMultiplier ?? "1.20");
  const minSpend = parseFloat(guardrails.minSpendForAction ?? "5");

  const config = getMetaAdsConfig();

  let campaigns: any[] = [];
  try {
    const rawCampaigns = await getCampaigns(config);
    // Enrich with 7-day insights
    const enriched = await Promise.all(
      rawCampaigns.map(async (c) => {
        try {
          const insights = await getCampaignInsights(config, c.id, "last_7d");
          const ins = insights[0];
          const spend = parseFloat(ins?.spend ?? "0");
          const leads = parseInt(
            ins?.actions?.find((a: any) => a.action_type === "lead")?.value ?? "0"
          );
          const clicks = parseInt(ins?.clicks ?? "0");
          const impressions = parseInt(ins?.impressions ?? "0");
          const cpl = leads > 0 ? spend / leads : 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const frequency = parseFloat(ins?.frequency ?? "0");
          return { ...c, spend, leads, cpl, ctr, frequency };
        } catch {
          return { ...c, spend: 0, leads: 0, cpl: 0, ctr: 0, frequency: 0 };
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
    const action: OptimizationAction = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      action: "held",
      reason: "Within target range",
      metrics: {
        spend: campaign.spend ?? 0,
        cpl: campaign.cpl ?? 0,
        ctr: campaign.ctr ?? 0,
        frequency: campaign.frequency ?? 0,
        leads: campaign.leads ?? 0,
      },
    };

    try {
      // Skip if not enough spend data
      if (action.metrics.spend < minSpend) {
        action.action = "skipped";
        action.reason = `Insufficient spend ($${action.metrics.spend.toFixed(2)}) for reliable optimization`;
        result.actionsToken.push(action);
        continue;
      }

      // Skip paused campaigns
      if (campaign.status === "PAUSED") {
        action.action = "skipped";
        action.reason = "Campaign already paused";
        result.actionsToken.push(action);
        continue;
      }

      const cplRatio = action.metrics.cpl > 0 ? action.metrics.cpl / targetCpl : 0;

      // --- PAUSE: Creative fatigue ---
      if (
        guardrails.autoPauseEnabled &&
        action.metrics.ctr < minCtr &&
        action.metrics.frequency > maxFreq
      ) {
        await updateCampaignStatus(config, campaign.id, "PAUSED");
        action.action = "paused";
        action.reason = `Creative fatigue: CTR ${action.metrics.ctr.toFixed(2)}% < ${minCtr}% minimum, frequency ${action.metrics.frequency.toFixed(1)}x`;
      }
      // --- PAUSE: CPL too high ---
      else if (
        guardrails.autoPauseEnabled &&
        cplRatio > 1.5 &&
        action.metrics.frequency > maxFreq
      ) {
        await updateCampaignStatus(config, campaign.id, "PAUSED");
        action.action = "paused";
        action.reason = `CPL $${action.metrics.cpl.toFixed(2)} is ${(cplRatio * 100).toFixed(0)}% of target ($${targetCpl}), frequency ${action.metrics.frequency.toFixed(1)}x`;
      }
      // --- WARN: CPL elevated but not pausing yet ---
      else if (cplRatio > 1.2 && cplRatio <= 1.5) {
        action.action = "warned";
        action.reason = `CPL $${action.metrics.cpl.toFixed(2)} is ${(cplRatio * 100).toFixed(0)}% of target — monitor closely`;
      }
      // --- SCALE: CPL well below target, room to grow ---
      else if (
        guardrails.autoScaleEnabled &&
        cplRatio < 0.8 &&
        action.metrics.leads >= 3
      ) {
        const adSets = await getAdSets(config, campaign.id);
        for (const adSet of adSets) {
          const currentBudget = parseInt(adSet.daily_budget ?? "0", 10); // Meta returns in cents as string
          if (currentBudget <= 0) continue;

          const newBudget = Math.min(
            Math.round(currentBudget * scaleMultiplier),
            maxBudget * 100
          );
          const newBudgetDollars = newBudget / 100;
          const currentBudgetDollars = currentBudget / 100;

          if (newBudgetDollars > maxBudget) {
            action.action = "held";
            action.reason = `At max budget cap ($${maxBudget}/day) — CPL excellent at $${action.metrics.cpl.toFixed(2)}`;
          } else if (newBudgetDollars >= minBudget) {
            await updateAdSetBudget(config, adSet.id, newBudget);
            action.action = "scaled";
            action.previousBudget = currentBudgetDollars;
            action.newBudget = newBudgetDollars;
            action.reason = `CPL $${action.metrics.cpl.toFixed(2)} is ${((1 - cplRatio) * 100).toFixed(0)}% below target — scaled budget $${currentBudgetDollars.toFixed(0)} → $${newBudgetDollars.toFixed(0)}/day`;
          }
        }
      }
      // --- HOLD: Within acceptable range ---
      else {
        action.action = "held";
        action.reason = `CPL $${action.metrics.cpl.toFixed(2)} within target range (${(cplRatio * 100).toFixed(0)}% of $${targetCpl} target)`;
      }
    } catch (e: any) {
      action.action = "skipped";
      action.reason = `Error: ${e.message}`;
      result.errors.push(`Campaign ${campaign.id}: ${e.message}`);
    }

    result.actionsToken.push(action);

    // Log to DB (non-fatal)
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
    } catch (_) {
      // Non-fatal
    }
  }

  // Notify owner if any meaningful actions were taken
  const actionsTaken = result.actionsToken.filter(
    (a) => a.action === "scaled" || a.action === "paused" || a.action === "warned"
  );
  if (actionsTaken.length > 0) {
    const summary = actionsTaken
      .map((a) => `• ${a.campaignName}: ${a.action.toUpperCase()} — ${a.reason}`)
      .join("\n");
    await notifyOwner({
      title: `Ads Optimizer: ${actionsTaken.length} action(s) taken`,
      content: `Daily optimization run completed.\n\n${summary}\n\nView full details in Ads Manager → Optimization Log.`,
    }).catch(() => {});
  }

  return result;
}
