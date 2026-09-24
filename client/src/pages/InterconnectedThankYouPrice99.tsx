import InterconnectedThankYouB from "./InterconnectedThankYouB";

/**
 * Staged $99 treatment. This page is not linked from a live allocation or ad.
 * Its checkout is intentionally the verified, exact Kajabi $99 Offer rather
 * than a generic page so the treatment can be previewed and later measured by
 * Offer ID. The $199 OCUS parity was verified separately in Kajabi.
 */
export default function InterconnectedThankYouPrice99() {
  return <InterconnectedThankYouB priceConfig={{
    armId: "p99",
    entryPriceCents: 9900,
    checkoutUrl: "https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout",
    countdownStorageKey: "interconnected_p99_offer_end_time_v1",
    episodeCount: 10,
    includeBonusEpisodeTen: true,
    checkoutGraphicSrc: "/manus-storage/Interconnected-Checkout-10-Episodes-Price-99-under-1MB_4f497a90.jpg",
  }} />;
}
