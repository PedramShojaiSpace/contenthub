/**
 * skuConfig.ts — Per-SKU CPA targets for Urban Monk product suite.
 * CPA = Cost Per Acquisition (buyer), not CPL (lead).
 */
export interface SkuConfig {
  id: string;
  label: string;
  shortLabel: string;
  targetCpa: number;
  minDailyBudget: number;
  maxDailyBudget: number;
  conversionEvent: string;
}
export const SKU_CONFIGS: SkuConfig[] = [
  { id: "kbmoTesting",    label: "KBMO Food Sensitivity Test",   shortLabel: "KBMO",       targetCpa: 200, minDailyBudget: 20, maxDailyBudget: 300, conversionEvent: "Purchase" },
  { id: "lightsOnCourse", label: "Lights On Course",             shortLabel: "Lights On",  targetCpa: 200, minDailyBudget: 20, maxDailyBudget: 300, conversionEvent: "Purchase" },
  { id: "lightsOn",       label: "Lights On (Lead Gen)",         shortLabel: "LO Lead",    targetCpa: 25,  minDailyBudget: 15, maxDailyBudget: 200, conversionEvent: "Lead" },
  { id: "sleepTestKit",   label: "Sleep Test Kit",               shortLabel: "Sleep Kit",  targetCpa: 200, minDailyBudget: 20, maxDailyBudget: 300, conversionEvent: "Purchase" },
  { id: "orobiomeTestKit",label: "Orobiome Test Kit",            shortLabel: "Orobiome",   targetCpa: 200, minDailyBudget: 20, maxDailyBudget: 300, conversionEvent: "Purchase" },
  { id: "academy",        label: "Urban Monk Academy ($297/yr)", shortLabel: "Academy",    targetCpa: 150, minDailyBudget: 20, maxDailyBudget: 500, conversionEvent: "Subscribe" },
  { id: "upstream",       label: "Upstream Program",             shortLabel: "Upstream",   targetCpa: 100, minDailyBudget: 15, maxDailyBudget: 200, conversionEvent: "Purchase" },
  { id: "general",        label: "General / Brand Awareness",    shortLabel: "General",    targetCpa: 50,  minDailyBudget: 10, maxDailyBudget: 100, conversionEvent: "Lead" },
];
export const SKU_MAP = Object.fromEntries(SKU_CONFIGS.map((s) => [s.id, s])) as Record<string, SkuConfig>;
export function getSkuConfig(skuId: string): SkuConfig {
  return SKU_MAP[skuId] ?? SKU_CONFIGS.find((s) => s.id === "general")!;
}
