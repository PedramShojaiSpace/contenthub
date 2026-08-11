export const KAJABI_INTERCONNECTED_199_UPSELL_ID = "NHCArjLDhTMbteTJAeSQmHgt";

const OFFER_PRICE_MAP: Record<string, number> = {
  "2150211911": 39900, // Gut Permeability Test ($399) — Interconnected upsell
  "2151031660": 29700, // Upstream: Complete Microbiome Solution ($297)
  "57E3XFtT": 6700, // Interconnected All-Access Bundle ($67)
  [KAJABI_INTERCONNECTED_199_UPSELL_ID]: 19900, // $199 Gut Test + Coach OCU
};

export function resolveKajabiKnownPriceCents(input: {
  offerId?: string;
  upsellId?: string;
  offerName?: string;
}): number {
  const offerId = input.offerId?.trim() ?? "";
  const upsellId = input.upsellId?.trim() ?? "";
  const name = (input.offerName ?? "").toLowerCase();

  if (OFFER_PRICE_MAP[offerId]) return OFFER_PRICE_MAP[offerId];
  if (OFFER_PRICE_MAP[upsellId]) return OFFER_PRICE_MAP[upsellId];
  if (name.includes("199") && (name.includes("gut") || name.includes("food sensitivity") || name.includes("ocus"))) return 19900;
  if (name.includes("interconnected") || name.includes("all-access") || name.includes("all access")) return 6700;
  if (name.includes("gut permeability") || name.includes("food sensitivity")) return 39900;
  if (name.includes("upstream") || name.includes("microbiome solution")) return 29700;
  if (name.includes("ocus") || name.includes("online course")) return 29900;
  return 0;
}

export function resolveGenericKajabiUpsellCents(input: {
  rawAmountCents: number;
  knownPriceCents: number;
  hasPriorInterconnectedPurchase: boolean;
}): number {
  if (input.rawAmountCents > 0 || input.knownPriceCents > 0) return input.knownPriceCents;
  // Kajabi's OCU webhook can omit both its offer and amount. The active
  // Interconnected path is the $199 Gut Test + Coach OCU; retain $67 for a first
  // purchase and record the inference so it can be audited.
  return input.hasPriorInterconnectedPurchase ? 19900 : 6700;
}

export function isInterconnectedKajabiAmount(amountCents: number): boolean {
  return [6700, 19900, 29900, 39900, 49900, 145000, 165000].includes(amountCents);
}
