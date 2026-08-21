import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const oralPagePath = "/home/ubuntu/oral_page_draft.html";

describe("approved Orobiome hero-offer clarity experiment", () => {
  it("keeps the $399 package and BixGrow attribution while exposing both approved variants", async () => {
    const html = await readFile(oralPagePath, "utf8");
    expect(html).toContain("data-orobiome-variant");
    expect(html).toContain("offer_clarity");
    expect(html).toContain("Orobiome Oral Microbiome Test");
    expect(html).toContain("$399 partner price");
    expect(html).toContain("Get the $399 Community Package");
    expect(html).toContain("bg_ref=109Nl4h0Ds");
    expect(html).toContain("46719608946842:1");
  });

  it("records only approved anonymous funnel events and passes visit metadata through the native cart permalink", async () => {
    const html = await readFile(oralPagePath, "utf8");
    expect(html).toContain("https://content.theurbanmonk.com/api/orobiome/funnel-event");
    expect(html).toContain("track('page_view')");
    expect(html).toContain("scroll_25");
    expect(html).toContain("scroll_50");
    expect(html).toContain("scroll_75");
    expect(html).toContain("attributes[orobiome_visit_id]");
    expect(html).toContain("attributes[orobiome_variant]");
    expect(html).toContain("attributes[orobiome_cta]");
  });
});
