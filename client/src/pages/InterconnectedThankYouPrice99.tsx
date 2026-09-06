import InterconnectedThankYouB from "./InterconnectedThankYouB";

/**
 * Draft-only $99 treatment. The missing checkout URL is intentional: the VA
 * must complete the manual Kajabi Offer setup and map it in Price-Test Tracker
 * before a separate activation decision can permit any traffic.
 */
export default function InterconnectedThankYouPrice99() {
  return <InterconnectedThankYouB priceConfig={{ armId: "p99", entryPriceCents: 9900 }} />;
}
