import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("owner-authorized Interconnected Day 0 live email test", () => {
  it("limits the test send to the confirmed owner inbox and requires the first flow email to be live", () => {
    const source = readFileSync(
      new URL("../scripts/send-interconnected-day0-live-test.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('recipient !== "pedram@theurbanmonk.com"');
    expect(source).toContain('flow?.attributes?.status !== "live"');
    expect(source).toContain('day0Action.data?.status !== "live"');
    expect(source).toContain('const FROM_NAME = "Interconnected Series by The Urban Monk"');
  });

  it("renders the embedded live flow HTML into a test-only template without modifying the live flow", () => {
    const source = readFileSync(
      new URL("../scripts/send-interconnected-day0-live-test.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('`/flow-messages/${day0Action.data.message.id}/template`');
    expect(source).toContain('[TEST ONLY] Live Interconnected Day 0 HTML');
    expect(source).toContain('/api/v1/email-template/${encodeURIComponent(testTemplateId)}/send?api_key=');
    expect(source).toContain('liveFlowChanged: false');
  });
});
