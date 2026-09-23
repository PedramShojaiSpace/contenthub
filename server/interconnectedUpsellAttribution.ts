export const KAJABI_INTERCONNECTED_199_UPSELL_ID = "NHCArjLDhTMbteTJAeSQmHgt";
export const KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID = "2151104453";
export const KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID = "2151333044";

const OFFER_PRICE_MAP: Record<string, number> = {
  "2150211911": 39900, // Gut Permeability Test ($399) — Interconnected upsell
  "2151031660": 29700, // Upstream: Complete Microbiome Solution ($297)
  "57E3XFtT": 6700, // Interconnected All-Access Bundle ($67)
  [KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID]: 9900, // $99 Upstream Course OCU
  [KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID]: 19900, // $199 Gut Test + Coach OCU
  [KAJABI_INTERCONNECTED_199_UPSELL_ID]: 19900, // Legacy Kajabi $199 upsell identifier
};

export function isKnownInterconnectedKajabiOcu(input: {
  offerId?: string;
  upsellId?: string;
}): boolean {
  const offerId = input.offerId?.trim() ?? "";
  const upsellId = input.upsellId?.trim() ?? "";
  return [
    KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID,
    KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID,
    KAJABI_INTERCONNECTED_199_UPSELL_ID,
  ].includes(offerId) || [
    KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID,
    KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID,
    KAJABI_INTERCONNECTED_199_UPSELL_ID,
  ].includes(upsellId);
}

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
  // A generic offer name is not enough to distinguish the current $99 Upstream
  // OCU from the legacy $297/$599 Upstream offers. The raw paid amount or an
  // exact identifier is required for that classification.
  return 0;
}

export function resolveGenericKajabiUpsellCents(input: {
  rawAmountCents: number;
  knownPriceCents: number;
  hasPriorInterconnectedPurchase: boolean;
}): number {
  if (input.rawAmountCents > 0 || input.knownPriceCents > 0) return input.knownPriceCents;
  // Kajabi can omit both the offer and amount. With two live post-purchase
  // offers ($99 Upstream and $199 testing), that payload is now inherently
  // ambiguous after an entry purchase. Do not assign false revenue; report it
  // as unknown until Kajabi supplies a raw amount or exact offer/upsell ID.
  return input.hasPriorInterconnectedPurchase ? 0 : 6700;
}

export function isInterconnectedKajabiAmount(amountCents: number): boolean {
  return [6700, 9900, 19900, 29900, 39900, 49900, 145000, 165000].includes(amountCents);
}
