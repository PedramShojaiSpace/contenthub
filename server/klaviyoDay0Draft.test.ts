import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected Day 0 deliverability draft", () => {
  it("keeps the draft-only confirmation to one approved, tracked $67 redemption link", () => {
    const source = readFileSync(
      new URL("../scripts/update-klaviyo-day0-draft-layout.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const TEMPLATE_NAME = "[DRAFT] Interconnected Day 0 — Plain Confirmation Deliverability Test"');
    expect(source).toContain('liveFlowChanged: false');
    expect(source).toContain('liveEmailChanged: false');
    expect(source).toContain("utm_content=day0_one_time_67_offer");
    expect(source).toContain("Redeem your one-time $67 offer");
    expect(source.match(/href="\$\{CHECKOUT_URL\}"/g)).toHaveLength(1);
    expect(source).toContain("This is the only time this price is available.");
    expect(source).not.toContain("2 hours");
    expect(source).not.toContain("P.S.");
    expect(source).not.toContain("P.P.S.");
  });

  it("uses the readable shared email frame for direct email delivery", () => {
    const source = readFileSync(
      new URL("./emailBoost.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("background-color:#ffffff");
    expect(source).toContain("max-width:640px");
    expect(source).toContain("@media only screen and (max-width: 620px)");
  });
});
