export type TantraTrackableOffer = {
  name: string;
  price: string;
};

export function parseDisplayedPrice(price: string): number | null {
  const match = price.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function buildTantraCheckoutParams(offer: TantraTrackableOffer) {
  const value = parseDisplayedPrice(offer.price);
  return {
    content_name: offer.name,
    content_category: "tantra_quiz",
    content_ids: [offer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")],
    currency: "USD",
    ...(value === null ? {} : { value }),
  };
}
