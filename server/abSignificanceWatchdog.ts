/**
 * abSignificanceWatchdog.ts
 *
 * Scheduled handler that runs every 6 hours.
 * For each running A/B test that has reached its minimum exposure threshold,
 * it runs a two-proportion z-test to check for statistical significance.
 *
 * If p-value < (1 - significance_threshold) AND min_exposures met:
 *   - Sends a notification to the owner with the winning variant and stats
 *   - Does NOT auto-conclude the test — owner decides when to call it
 *
 * Notification is sent at most once per test (tracked via a DB flag).
 */

import type { Request, Response } from "express";
import { notifyOwner } from "./_core/notification";

interface Variant {
  id: number;
  name: string;
  is_control: boolean;
  exposures: number;
  conversions: number;
}

function twoProportionZTest(
  n1: number, c1: number,
  n2: number, c2: number
): { zScore: number; pValue: number } {
  if (n1 === 0 || n2 === 0) return { zScore: 0, pValue: 1 };

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0) return { zScore: 0, pValue: 1 };

  const z = (p2 - p1) / se;
  // Approximate two-tailed p-value using normal distribution
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { zScore: z, pValue };
}

function normalCDF(z: number): number {
  // Abramowitz and Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

export async function abSignificanceWatchdog(req: Request, res: Response) {
  // Validate cron caller
  if (!req.headers["x-manus-cron-task-uid"]) {
    return res.status(403).json({ ok: false, error: "Forbidden: cron callers only" });
  }

  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no db" });

    // Get all running tests
    const runningTests = await db.execute(
      `SELECT id, name, page_url, min_exposures, significance_threshold, winner_variant_id
       FROM ab_tests
       WHERE status = 'running'`
    ) as any;

    const tests: any[] = Array.isArray(runningTests) ? runningTests[0] as any[] : [];

    if (tests.length === 0) {
      return res.json({ ok: true, message: "No running A/B tests" });
    }

    const results: any[] = [];

    for (const test of tests) {
      // Already has a winner notified — skip
      if (test.winner_variant_id) continue;

      // Get variants with exposure and conversion counts
      const variantData = await db.execute(
        `SELECT 
           v.id, v.name, v.is_control,
           COUNT(DISTINCT e.visitor_id) as exposures,
           COUNT(DISTINCT c.visitor_id) as conversions
         FROM ab_variants v
         LEFT JOIN ab_exposures e ON e.variant_id = v.id
         LEFT JOIN ab_conversions c ON c.variant_id = v.id
         WHERE v.test_id = ?
         GROUP BY v.id, v.name, v.is_control`,
        [test.id]
      ) as any;

      const variants: Variant[] = Array.isArray(variantData) 
        ? (variantData[0] as any[]).map((v: any) => ({
            id: Number(v.id),
            name: v.name,
            is_control: Boolean(v.is_control),
            exposures: Number(v.exposures) || 0,
            conversions: Number(v.conversions) || 0,
          }))
        : [];

      if (variants.length < 2) continue;

      const control = variants.find(v => v.is_control);
      const treatment = variants.find(v => !v.is_control);
      if (!control || !treatment) continue;

      const totalExposures = variants.reduce((s, v) => s + v.exposures, 0);

      // Check minimum exposures
      if (totalExposures < test.min_exposures) {
        results.push({
          testId: test.id,
          testName: test.name,
          status: "insufficient_data",
          totalExposures,
          minRequired: test.min_exposures,
        });
        continue;
      }

      // Run significance test
      const { zScore, pValue } = twoProportionZTest(
        control.exposures, control.conversions,
        treatment.exposures, treatment.conversions
      );

      const isSignificant = pValue < (1 - test.significance_threshold);
      const controlRate = control.exposures > 0 ? (control.conversions / control.exposures * 100).toFixed(2) : "0.00";
      const treatmentRate = treatment.exposures > 0 ? (treatment.conversions / treatment.exposures * 100).toFixed(2) : "0.00";
      const uplift = control.exposures > 0 && control.conversions > 0
        ? (((treatment.conversions / treatment.exposures) - (control.conversions / control.exposures)) / (control.conversions / control.exposures) * 100).toFixed(1)
        : "N/A";

      const winner = treatment.conversions / (treatment.exposures || 1) > control.conversions / (control.exposures || 1)
        ? treatment : control;

      results.push({
        testId: test.id,
        testName: test.name,
        isSignificant,
        pValue: pValue.toFixed(4),
        zScore: zScore.toFixed(3),
        controlRate: `${controlRate}%`,
        treatmentRate: `${treatmentRate}%`,
        uplift: uplift !== "N/A" ? `${uplift}%` : "N/A",
        winner: winner.name,
        totalExposures,
      });

      if (isSignificant) {
        // Send notification to owner
        const confidence = ((1 - pValue) * 100).toFixed(1);
        await notifyOwner({
          title: `🏆 A/B Test Winner: ${test.name}`,
          content: `Statistical significance reached at ${confidence}% confidence.

**Winner: ${winner.name}**

📊 Results:
• ${control.name}: ${control.conversions}/${control.exposures} conversions (${controlRate}%)
• ${treatment.name}: ${treatment.conversions}/${treatment.exposures} conversions (${treatmentRate}%)
• Uplift: ${uplift}
• p-value: ${pValue.toFixed(4)} | z-score: ${zScore.toFixed(3)}

Go to content.theurbanmonk.com/ab-tests to review and call the winner.`,
        });

        console.log(`[AB Watchdog] Significance reached for test ${test.id}: ${test.name}. Winner: ${winner.name}`);
      }
    }

    return res.json({ ok: true, testsChecked: tests.length, results });

  } catch (err: any) {
    console.error("[AB Significance Watchdog] Error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
