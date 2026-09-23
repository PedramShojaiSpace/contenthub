import {
  fetchKajabiTransactionsForExactOfferTracking,
  summarizeCurrentInterconnectedTransactions,
} from "../server/kajabiSalesRouter";

const startDate = process.env.START_DATE ?? "2026-09-20";
const endDate = process.env.END_DATE ?? new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const read = await fetchKajabiTransactionsForExactOfferTracking(startDate, endDate);
const summary = summarizeCurrentInterconnectedTransactions(read.rows, startDate, endDate);

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  source: "Direct Kajabi transaction API, exact offer IDs only",
  ...summary,
  pagesScanned: read.pagesScanned,
}, null, 2));
