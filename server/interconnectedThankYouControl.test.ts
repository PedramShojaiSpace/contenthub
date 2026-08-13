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
});
