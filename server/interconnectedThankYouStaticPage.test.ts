import { describe, expect, it } from "vitest";
import { renderInterconnectedThankYouPage } from "./interconnectedThankYouStaticPage";

describe("live Interconnected Kajabi thank-you headline experiment", () => {
  const page = renderInterconnectedThankYouPage();

  it("keeps the original headline as the static control before sticky assignment", () => {
    expect(page).toContain('id="headline-ab-test"');
    expect(page).toContain('>Wait, one more thing!</h1>');
  });

  it("assigns the two approved variants through an independent Kajabi-only test", () => {
    expect(page).toContain("var HEADLINE_AB_TEST_ID = 30001;");
    expect(page).toContain("var HEADLINE_A = 'Wait, one more thing!';");
    expect(page).toContain("var HEADLINE_B = 'You are registered. Listen to this important message first.';");
    expect(page).toContain("ic_ty_headline_ab_variant_30001");
  });

  it("records checkout starts for the headline test without replacing the video-test attribution", () => {
    expect(page).toContain("testId: TY_AB_TEST_ID");
    expect(page).toContain("testId: HEADLINE_AB_TEST_ID");
    expect(page).toContain("conversionType: 'checkout_start'");
  });
});
