import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected draft email identity refinement", () => {
  it("targets only the separate draft review flow and retains every message in Draft", () => {
    const source = readFileSync(
      new URL("../scripts/refine-interconnected-draft-email-identity.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const DRAFT_FLOW_ID = "YyFZPu"');
    expect(source).toContain('flow?.attributes?.status !== "draft"');
    expect(source).toContain('definition.data.status = "draft"');
    expect(source).toContain('return request(`/flow-messages/${messageId}/template`)');
    expect(source).toContain('const refinedTemplate = await request("/templates", {');
    expect(source).toContain('definition.data.message.template_id = templateId');
    expect(source).toContain('liveFlowChanged: false');
  });

  it("uses the approved sender and signature while removing visible body-footer boilerplate but preserving unsubscribe", () => {
    const source = readFileSync(
      new URL("../scripts/refine-interconnected-draft-email-identity.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const SENDER_NAME = "Interconnected Series by The Urban Monk"');
    expect(source).toContain('const SIGNATURE_TITLE = "Host of the Interconnected Series"');
    expect(source).toContain("You are receiving this because you requested the Interconnected series");
    expect(source).toContain('unsubscribePreserved: html.includes("{% unsubscribe %}")');
  });
});
