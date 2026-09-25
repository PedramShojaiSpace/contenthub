import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected Klaviyo treatment exit-intent recovery", () => {
  it("keeps the recovery one-time, desktop-only, and separate from the removed final CTA", () => {
    const source = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouKlaviyo.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const DISPLAY_KEY = "__ic_klaviyo_exit_intent_shown"');
    expect(source).toContain('window.matchMedia("(hover: hover) and (pointer: fine)")');
    expect(source).toContain("hidden items-center justify-center");
    expect(source).toContain("No thanks, I’ll watch one episode at a time");
    expect(source).not.toContain("Don't Miss Your Chance to Own the Entire Series");
  });

  it("uses the owner-approved Wistia media while retaining the isolated treatment checkout path", () => {
    const source = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouKlaviyo.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("89xb1oskij");
    expect(source).not.toContain("10cdtpm3il");
    expect(source).toContain("buildInterconnectedKlaviyoCheckoutUrl(window.location.search)");
    expect(source).toContain("Secure Kajabi checkout");
    expect(source).not.toContain("Secure Shopify checkout");
  });

  it("presents the $99 ten-episode offer that the live checkout handoff now sells", () => {
    const source = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouKlaviyo.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('value: 99');
    expect(source).toContain("All 10 Episodes");
    expect(source).toContain("BONUS EPISODE 10");
    expect(source).not.toContain("Get All-Access for $67 Now");
  });
});
