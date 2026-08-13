import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected Klaviyo draft flow clone", () => {
  it("creates a separate review flow while preserving the live source flow", () => {
    const source = readFileSync(
      new URL("../scripts/create-interconnected-klaviyo-draft-clone.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const SOURCE_FLOW_ID = "VMpbLV"');
    expect(source).toContain('const SOURCE_FLOW_NAME = "[EG] Interconnected Free Screening - KO"');
    expect(source).toContain("[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67");
    expect(source).toContain('sourceFlow?.attributes?.status !== "live"');
    expect(source).toContain('liveFlowChanged: false');
  });

  it("requires every cloned message to remain draft and assigns the approved Day 0 template", () => {
    const source = readFileSync(
      new URL("../scripts/create-interconnected-klaviyo-draft-clone.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const SOURCE_DAY0_TEMPLATE_ID = "XASdst"');
    expect(source).toContain('const APPROVED_DAY0_DRAFT_TEMPLATE_ID = "Smbiqi"');
    expect(source).toContain('cloned.data.status = "draft"');
    expect(source).toContain("delete cloned.data.message?.id");
    expect(source).toContain("equals(name");
    expect(source).toContain('verification.data?.attributes?.status !== "draft"');
    expect(source).toContain("allMessagesDraft");
    expect(source).toContain("day0UsesApprovedSingleLinkDraft");
  });

  it("only swaps the Day 0 template inside the separate draft review flow", () => {
    const source = readFileSync(
      new URL("../scripts/update-interconnected-draft-clone-day0-template.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const DRAFT_FLOW_ID = "YyFZPu"');
    expect(source).toContain('const APPROVED_DAY0_DRAFT_TEMPLATE_ID = "Smbiqi"');
    expect(source).toContain('updatedDefinition.data.status = "draft"');
    expect(source).toContain("/flow-actions/${day0Action.id}");
    expect(source).toContain("hasApprovedDay0Content");
    expect(source).toContain("day0TemplateContentApproved");
    expect(source).toContain('liveFlowChanged: false');
  });
});
