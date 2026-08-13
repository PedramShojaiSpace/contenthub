import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected draft sequence standardization", () => {
  it("limits the workflow to the separate review flow and leaves all message actions as drafts", () => {
    const source = readFileSync(
      new URL("../scripts/standardize-interconnected-draft-sequence.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const DRAFT_FLOW_ID = "YyFZPu"');
    expect(source).toContain('flow?.attributes?.status !== "draft"');
    expect(source).toContain('definition.data.status = "draft"');
    expect(source).toContain('const DAY0_EMAIL_NAME = "Day 0 opt in EG sp26"');
    expect(source).toContain('liveFlowChanged: false');
  });

  it("requires the clean Day 0 visual frame, one actionable link per standardized email, and the concise SMS offer link", () => {
    const source = readFileSync(
      new URL("../scripts/standardize-interconnected-draft-sequence.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('background:#f3f0e9');
    expect(source).toContain('data-um-standardized-draft="true"');
    expect(source).toContain('result.linkCount === 1');
    expect(source).toContain('const SMS_OFFER_URL = "https://content.theurbanmonk.com/r/ic67"');
    expect(source).toContain('const FALLBACK_DESTINATION = "https://theurbanmonk.com/"');
    expect(source).toContain("One-time $67 all-access offer");
  });
});
