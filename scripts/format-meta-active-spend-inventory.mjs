import { readFile, writeFile } from "node:fs/promises";

const inputPath = "/tmp/meta-active-spend-across-accounts.json";
const outputPath = "/home/ubuntu/meta-active-spend-ads-2026-09-03.md";

const report = JSON.parse(await readFile(inputPath, "utf8"));
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");
const clean = value => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ").trim();

const rows = [...report.activeSpendingAds].sort((left, right) => {
  const account = String(left.accountName).localeCompare(String(right.accountName));
  return account !== 0 ? account : right.currentDaySpend - left.currentDaySpend;
});
const byAccount = Object.values(Object.groupBy(rows, row => row.accountName));

const lines = [
  "# Active Meta Ads With Current-Day Spend",
  "",
  `**As of:** ${report.generatedAt}  `,
  `**Day boundary:** ${report.currentDay}, America/Chicago  `,
  `**Scope:** ${report.accountsDiscovered} accessible ad accounts discovered under the authorized Urban Monk business. Only ads that both recorded spend today and return \`ACTIVE\` as their effective delivery status are listed.`,
  "",
  "## Snapshot",
  "",
  "| Measure | Value |",
  "|---|---:|",
  `| Accessible accounts checked | ${number.format(report.accountsDiscovered)} |`,
  `| Active ads with spend today | ${number.format(rows.length)} |`,
  `| Total current-day spend | ${money.format(report.activeSpendingTotal)} |`,
  "",
  "## Currently Spending Ads",
  "",
  "| Account | Campaign | Ad set | Ad | Today’s spend | Impressions | Link clicks | Delivery |",
  "|---|---|---|---|---:|---:|---:|---|",
  ...rows.map(row => [
    clean(row.accountName),
    clean(row.campaignName),
    clean(row.adSetName),
    clean(row.adName),
    money.format(row.currentDaySpend),
    number.format(row.currentDayImpressions),
    number.format(row.currentDayLinkClicks),
    clean(row.adEffectiveStatus),
  ].join(" | ").replace(/^/, "| ").concat(" |")),
  "",
  "## Account Coverage",
  "",
  "| Account | Active ads spending today | Today’s spend | Coverage note |",
  "|---|---:|---:|---|",
  ...byAccount.map(accountRows => {
    const account = accountRows[0];
    return `| ${clean(account.accountName)} | ${number.format(accountRows.length)} | ${money.format(accountRows.reduce((sum, row) => sum + row.currentDaySpend, 0))} | All current-day insight rows were returned in one page. |`;
  }),
  ...report.accounts
    .filter(account => !rows.some(row => row.accountId === account.accountId))
    .map(account => `| ${clean(account.accountName)} | 0 | ${money.format(0)} | ${account.error ? "Read unavailable: " + clean(account.error) : "No active ad with current-day spend returned."} |`),
  "",
  "> **Interpretation boundary:** This is a delivery-and-spend inventory only. It does not assess purchase attribution or recommend budget changes. Meta’s insight endpoint reports today using the specified Central-time date; the live total can change as delivery continues. Destination URLs were not included because this inventory deliberately avoided a broader creative-detail sweep after the prior rate-limit response.",
];

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ outputPath, rows: rows.length, totalSpend: report.activeSpendingTotal }, null, 2));
