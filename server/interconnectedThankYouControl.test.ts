import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected Thank You control routing", () => {
  it("uses Version B directly for the Kajabi control and removes its redundant final CTA", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const pageSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );

    expect(appSource).toContain('<Route path={"/interconnected/thank-you"} component={InterconnectedThankYouB} />');
    expect(appSource).not.toContain("InterconnectedThankYouSplitter");
    expect(pageSource).not.toContain("Don't Miss Your Chance to Own the Entire Series");
  });

  it("explains that free daily episode access arrives through Urban Monk email and SMS", () => {
    const pageSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );

    expect(pageSource).toContain("Day 1 begins tomorrow");
    expect(pageSource).toContain("an email and an SMS from The Urban Monk");
    expect(pageSource).toContain("access link to that day's episode");
    expect(pageSource).not.toContain("You'll receive login credentials immediately after purchase");
  });

  it("uses the owner-supplied Wistia video on the Version B thank-you page", () => {
    const pageSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );

    expect(pageSource).toContain("89xb1oskij");
    expect(pageSource).not.toContain("10cdtpm3il");
  });

  it("keeps the registration-first headline on the isolated Klaviyo treatment while the Kajabi control can test it", () => {
    const controlSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );
    const klaviyoSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouKlaviyo.tsx", import.meta.url),
      "utf8"
    );
    const approvedHeadline = "You are registered. Listen to this important message first.";

    expect(controlSource).toContain("const REGISTRATION_FIRST_HEADLINE");
    expect(controlSource).toContain(approvedHeadline);
    expect(klaviyoSource).toContain(approvedHeadline);
    expect(controlSource).toContain("Wait, one more thing!");
    expect(klaviyoSource).not.toContain("Wait, one more thing!");
  });

  it("runs the headline split test only on the Kajabi control while preserving both approved variants", () => {
    const controlSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );
    const klaviyoSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouKlaviyo.tsx", import.meta.url),
      "utf8"
    );

    expect(controlSource).toContain("const HEADLINE_AB_TEST_ID = 30001");
    expect(controlSource).toContain("Wait, one more thing!");
    expect(controlSource).toContain("You are registered. Listen to this important message first.");
    expect(controlSource).toContain('conversionType: "checkout_start"');
    expect(klaviyoSource).not.toContain("HEADLINE_AB_TEST_ID");
    expect(klaviyoSource).not.toContain("interconnected_ty_headline_variant_id");
  });

  it("removes unsupported ratings and customer-review content from both live Kajabi control variants", () => {
    const versionASource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYou.tsx", import.meta.url),
      "utf8"
    );
    const versionBSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );

    expect(versionASource).not.toContain("const REVIEWS");
    expect(versionBSource).not.toContain("const REVIEWS");
    expect(versionASource).not.toContain("4.9 out of 5 Stars");
    expect(versionBSource).not.toContain("4.9 out of 5 Stars");
  });

  it("keeps the $49 and $99 pages unlinked and checkout-inactive until verified Kajabi mappings are supplied", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const publicSource = readFileSync(new URL("../client/src/PublicApp.tsx", import.meta.url), "utf8");
    const controlSource = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouB.tsx", import.meta.url),
      "utf8"
    );
    const p49Source = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouPrice49.tsx", import.meta.url),
      "utf8"
    );
    const p99Source = readFileSync(
      new URL("../client/src/pages/InterconnectedThankYouPrice99.tsx", import.meta.url),
      "utf8"
    );

    expect(appSource).toContain('path={"/interconnected/thank-you-p49-draft"}');
    expect(appSource).toContain('path={"/interconnected/thank-you-p99-draft"}');
    expect(publicSource).toContain('path="/interconnected/thank-you-p49-draft"');
    expect(publicSource).toContain('path="/interconnected/thank-you-p99-draft"');
    expect(p49Source).toContain('armId: "p49", entryPriceCents: 4900');
    expect(p99Source).toContain('armId: "p99", entryPriceCents: 9900');
    expect(p49Source).not.toContain("checkoutUrl:");
    expect(p99Source).not.toContain("checkoutUrl:");
    expect(controlSource).toContain("if (!checkoutUrl) return;");
    expect(controlSource).toContain('priceConfig.armId !== "p67"');
    expect(controlSource).toContain('data-price-test-arm={priceConfig.armId}');
  });
});
