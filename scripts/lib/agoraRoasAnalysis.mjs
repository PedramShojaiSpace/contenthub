export function sumAgoraRows(rows) {
  const totals = rows.reduce((total, row) => {
    total.spend += Number(row.spend ?? 0);
    total.impressions += Number(row.impressions ?? 0);
    total.inlineLinkClicks += Number(row.inlineLinkClicks ?? 0);
    total.leads += Number(row.leads ?? 0);
    total.checkouts += Number(row.checkouts ?? 0);
    total.purchases += Number(row.purchases ?? 0);
    total.purchaseValue += Number(row.purchaseValue ?? 0);
    return total;
  }, { spend: 0, impressions: 0, inlineLinkClicks: 0, leads: 0, checkouts: 0, purchases: 0, purchaseValue: 0 });

  return {
    ...totals,
    roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : null,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
    costPerPurchase: totals.purchases > 0 ? totals.spend / totals.purchases : null,
    ctr: totals.impressions > 0 ? (totals.inlineLinkClicks / totals.impressions) * 100 : null,
    checkoutRate: totals.leads > 0 ? totals.checkouts / totals.leads : null,
    purchaseRate: totals.leads > 0 ? totals.purchases / totals.leads : null,
  };
}

export function summarizeDateWindow(rows, startDate, endDate) {
  return sumAgoraRows(rows.filter(row => row.date >= startDate && row.date <= endDate));
}

export function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / previous;
}
