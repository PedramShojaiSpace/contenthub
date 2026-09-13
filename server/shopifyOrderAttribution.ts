const CLICK_TOKEN_PATTERN = /^[a-f0-9]{48}$/i;

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
