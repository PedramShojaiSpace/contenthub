import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("active Day 0 mobile layout repair", () => {
  it("guards the intended code template and applies readable mobile spacing", () => {
    const source = readFileSync(
      new URL("../scripts/repair-klaviyo-active-day0-layout.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const TEMPLATE_ID = "XTHuPY"');
    expect(source).toContain('const EXPECTED_NAME = "Day 0 opt in EG sp26"');
    expect(source).toContain("padding-left:38px");
    expect(source).toContain("background:#f3f0e9");
    expect(source).toContain("flowLinkageChanged: false");
  });
});
