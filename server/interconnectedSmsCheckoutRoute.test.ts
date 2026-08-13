import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected Day 0 SMS checkout route", () => {
  it("uses a short first-party path that preserves $67 SMS attribution through the tracked checkout bridge", () => {
    const source = readFileSync(
      new URL("./_core/index.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain('app.get("/r/ic67"');
    expect(source).toContain("https://shop.theurbanmonk.com/cart/48959577653402:1");
    expect(source).toContain('utm_medium: "sms"');
    expect(source).toContain('utm_content: "day0_sms_one_time_67_offer"');
    expect(source).toContain('`/r/checkout?${trackingQuery.toString()}`');
  });
});
