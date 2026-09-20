const CLICK_TOKEN_PATTERN = /^[a-f0-9]{48}$/i;

export type ShopifyOrderRevenueSnapshot = {
  totalCents: number;
  lineItems: string;
};

export function extractShopifyClickToken(order: Record<string, any>): string | null {
  const noteAttributes = Array.isArray(order.note_attributes) ? order.note_attributes : [];
  for (const attribute of noteAttributes) {
    if (attribute?.name !== "_um_click_token") continue;
    const value = typeof attribute.value === "string" ? attribute.value.trim() : "";
    if (CLICK_TOKEN_PATTERN.test(value)) return value.toLowerCase();
  }

  const tagMatch = String(order.tags ?? "").match(/(?:^|,\s*)um_ct_([a-f0-9]{48})(?:,|$)/i);
  return tagMatch?.[1]?.toLowerCase() ?? null;
}

/**
 * Keeps the Shopify order representation used by our first-party attribution
 * ledger consistent between the initial orders/paid webhook and later
 * orders/updated deliveries (for example, a Zipify post-purchase acceptance).
 */
export function snapshotShopifyOrderRevenue(order: Record<string, any>): ShopifyOrderRevenueSnapshot {
  const parsedTotal = Number.parseFloat(String(order.total_price ?? "0"));
  const totalCents = Number.isFinite(parsedTotal) ? Math.round(parsedTotal * 100) : 0;
  const lineItems = JSON.stringify(
    (Array.isArray(order.line_items) ? order.line_items : []).map((lineItem: any) => ({
      title: lineItem?.title,
      quantity: lineItem?.quantity,
      price: lineItem?.price,
      sku: lineItem?.sku,
    })),
  );
  return { totalCents, lineItems };
}

/**
 * Post-purchase providers amend an existing Shopify order. Only an increase is
 * considered an upsell update here; refunds and non-revenue edits remain out
 * of this path and require their own reconciliation treatment.
 */
export function calculateShopifyOrderRevenueIncrease(params: {
  priorTotalCents: number;
  updatedTotalCents: number;
}) {
  const incrementalRevenueCents = params.updatedTotalCents - params.priorTotalCents;
  return {
    incrementalRevenueCents: Math.max(0, incrementalRevenueCents),
    hasRevenueIncrease: incrementalRevenueCents > 0,
  };
}
