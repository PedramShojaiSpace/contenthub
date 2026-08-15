import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Interconnected Lead event deduplication", () => {
  it("passes the server CAPI Lead event ID from both opt-in paths to the thank-you page", () => {
    const controlSource = readFileSync(new URL("./interconnectedStaticPage.ts", import.meta.url), "utf8");
    const variantBSource = readFileSync(new URL("./interconnectedBStaticPage.ts", import.meta.url), "utf8");

    for (const source of [controlSource, variantBSource]) {
      expect(source).toContain("__capi_lead_event_id");
      expect(source).toContain("capiLeadEventId");
    }
  });

  it("does not fire an unpaired browser Lead event on the active thank-you page", () => {
    const pageSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );

    expect(pageSource).toContain("if (leadEventId) firePixel(\"Lead\", {}, leadEventId);");
  });

  it("does not let the legacy static thank-you fallback count a Lead without an event ID", () => {
    const staticThankYouSource = readFileSync(
      new URL("./interconnectedThankYouStaticPage.ts", import.meta.url),
      "utf8"
    );

    expect(staticThankYouSource).toContain("if (leadEventId) fbq('track','Lead',{}, {eventID: leadEventId});");
    expect(staticThankYouSource).not.toContain("fbq('track','Lead');");
  });
});
