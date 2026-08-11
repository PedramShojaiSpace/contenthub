export function calculateShopifySkuRoas(shopifyRevenue: number, metaSpend: number): number | null {
  if (metaSpend <= 0) return null;
  return shopifyRevenue / metaSpend;
}

export function calculateCostPerPurchase(metaSpend: number, paidUnits: number): number | null {
  if (paidUnits <= 0) return null;
  return metaSpend / paidUnits;
}

export function calculatePurchaseRate(paidUnits: number, emailCaptured: number): number | null {
  if (emailCaptured <= 0) return null;
  return (paidUnits / emailCaptured) * 100;
}
