import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const DRAFT_PATH = "/home/ubuntu/oral_page_draft.html";
const ADVERTORIAL_TEMPLATE_ASSIGNMENT_PATH =
  "/home/ubuntu/shopify_oral_assign_advertorial_template.json";
const PAGE_UPDATE_PAYLOAD_PATH = "/home/ubuntu/oral_page_update.json";
const NATIVE_CART_CTA =
  "https://shop.theurbanmonk.com/cart/46719608946842:1?bg_ref=109Nl4h0Ds";

describe("Orobiome oral Shopify landing-page draft", () => {
  it("uses native Shopify cart CTAs with Natalie Jill attribution", async () => {
    const draft = await readFile(DRAFT_PATH, "utf8");

    expect(draft.match(new RegExp(NATIVE_CART_CTA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(3);
    expect(draft).not.toContain("products/orobiome-testing-package");
  });

  it("does not contain synthetic purchase tracking or fabricated review content", async () => {
    const draft = await readFile(DRAFT_PATH, "utf8");

    expect(draft).not.toMatch(/\b(fbq|gtag|ViewContent|InitiateCheckout|Purchase)\b/);
    expect(draft).not.toMatch(/verified\s+customer|testimonial|real shifts|★★★★★/i);
  });

  it("preserves the educational disclaimer and page-specific preview isolation", async () => {
    const draft = await readFile(DRAFT_PATH, "utf8");

    expect(draft).toContain("does not diagnose, treat, cure, or prevent any disease");
    expect(draft).toContain("body:has(#oral-natalie-jill)");
    expect(draft).toContain("body:has(#oral-natalie-jill) .adv-pub-header { display:none !important; }");
    expect(draft).toContain("id=\"oral-natalie-jill\"");
  });

  it("assigns the hidden oral page to the active theme's native headerless advertorial template", async () => {
    const assignment = await readFile(ADVERTORIAL_TEMPLATE_ASSIGNMENT_PATH, "utf8");

    expect(assignment).toContain('templateSuffix: \\"advertorial\\"');
    expect(assignment).toContain('gid://shopify/Page/129449328794');
  });

  it("contains the approved page-scoped visual repair without altering conversion elements", async () => {
    const draft = await readFile(DRAFT_PATH, "utf8");

    expect(draft).toContain("Page-scoped Mediva reset");
    expect(draft).toContain("grid-template-rows:auto !important");
    expect(draft).toContain(".content-for-layout");
    expect(draft).toContain("#MainContent > .shopify-section");
    expect(draft).toContain("#MainContent > .section");
    expect(draft).toContain("font-size:1.25rem");
    expect(draft).toContain("Global readability pass");
    expect(draft).toContain("font-size:1.25rem; line-height:1.35");
    expect(draft).toContain("font-size:1.3rem; line-height:1.38");
    expect(draft.match(new RegExp(NATIVE_CART_CTA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(3);
  });

  it("preserves the approved public page status in the visual-repair payload", async () => {
    const payload = await readFile(PAGE_UPDATE_PAYLOAD_PATH, "utf8");

    expect(payload).toContain('"isPublished":true');
    expect(payload).toContain("gid://shopify/Page/129449328794");
  });
});
