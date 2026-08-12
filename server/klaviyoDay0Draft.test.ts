import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected Day 0 deliverability draft", () => {
  it("keeps the draft-only confirmation free of checkout and promotional calls to action", () => {
    const source = readFileSync(
      new URL("../scripts/create-klaviyo-day0-confirmation-draft.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const TEMPLATE_NAME = "[DRAFT] Interconnected Day 0 — Plain Confirmation Deliverability Test"');
    expect(source).toContain('liveFlowChanged: false');
    expect(source).toContain('liveEmailChanged: false');
    expect(source).not.toContain("checkout");
    expect(source).not.toContain("$67");
    expect(source).not.toContain("2 hours");
  });

  it("uses the readable shared email frame for direct email delivery", () => {
    const source = readFileSync(
      new URL("./emailBoost.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("background-color:#f3f0e9");
    expect(source).toContain("The Urban Monk");
    expect(source).toContain("@media only screen and (max-width: 620px)");
  });
});
