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
});
