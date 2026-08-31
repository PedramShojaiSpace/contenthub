import fs from "node:fs/promises";
import { percentChange, summarizeDateWindow, sumAgoraRows } from "./lib/agoraRoasAnalysis.mjs";

const INPUT_PATH = "/tmp/agora-interconnected-meta-2026-08-01-to-2026-08-30.json";
const OUTPUT_PATH = "/tmp/agora-interconnected-analysis-2026-08-01-to-2026-08-30.json";

const source = JSON.parse(await fs.readFile(INPUT_PATH, "utf8"));
const daily = source.daily;

const windows = {
  aug1to16: summarizeDateWindow(daily, "2026-08-01", "2026-08-16"),
  aug16to19: summarizeDateWindow(daily, "2026-08-16", "2026-08-19"),
  aug17to22: summarizeDateWindow(daily, "2026-08-17", "2026-08-22"),
  aug20to23: summarizeDateWindow(daily, "2026-08-20", "2026-08-23"),
  aug23: summarizeDateWindow(daily, "2026-08-23", "2026-08-23"),
  aug24to30: summarizeDateWindow(daily, "2026-08-24", "2026-08-30"),
};

const confirmedFirstParty = {
  method: "Kajabi purchases tagged funnel_source=interconnected, is_meta_attributed=1, is_email_list_buyer=0",
  total: { purchases: 98, revenue: 8482 },
  aug1to16: { purchases: 15, revenue: 1469 },
  aug17to22: { purchases: 83, revenue: 7013 },
  aug23to30: { purchases: 0, revenue: 0 },
};

const output = {
  asOf: source.reportGeneratedAt,
  timeRange: source.timeRange,
  campaignSelectionRule: source.campaignSelectionRule,
  selectedCampaignCount: source.selectedCampaignCount,
  totalMeta: source.total,
  windows,
  changes: {
    lastFourActiveDaysVsPriorFourActiveDays: {
      roas: percentChange(windows.aug20to23.roas, windows.aug16to19.roas),
      cpl: percentChange(windows.aug20to23.cpl, windows.aug16to19.cpl),
      checkoutRate: percentChange(windows.aug20to23.checkoutRate, windows.aug16to19.checkoutRate),
      purchaseRate: percentChange(windows.aug20to23.purchaseRate, windows.aug16to19.purchaseRate),
      ctr: percentChange(windows.aug20to23.ctr, windows.aug16to19.ctr),
    },
    aug23VsAug17to22Baseline: {
      cpl: percentChange(windows.aug23.cpl, windows.aug17to22.cpl),
      checkoutRate: percentChange(windows.aug23.checkoutRate, windows.aug17to22.checkoutRate),
      purchaseRate: percentChange(windows.aug23.purchaseRate, windows.aug17to22.purchaseRate),
      ctr: percentChange(windows.aug23.ctr, windows.aug17to22.ctr),
    },
  },
  confirmedFirstParty,
  confirmedFirstPartyRoas: source.total.spend > 0 ? confirmedFirstParty.total.revenue / source.total.spend : null,
  noMetaMutationOccurred: true,
};

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  status: "complete",
  outputPath: OUTPUT_PATH,
  selectedCampaignCount: output.selectedCampaignCount,
  totalMeta: output.totalMeta,
  recentComparison: output.changes.lastFourActiveDaysVsPriorFourActiveDays,
  noMetaMutationOccurred: true,
}));
