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

  it("uses the approved Wistia video for every visitor and closes the older video split", () => {
    expect(page).toContain("https://fast.wistia.net/embed/iframe/223ond81ki");
    expect(page).toContain("https://fast.wistia.net/assets/external/E-v1.js");
    expect(page).toContain('title="IC TY 99 - Descript Video"');
    expect(page).not.toContain("hobj7srg3q");
    expect(page).not.toContain("10cdtpm3il");
    expect(page).not.toContain("TY_AB_TEST_ID");
  });

  it("records checkout starts only for the retained headline test", () => {
    expect(page).not.toContain("testId: TY_AB_TEST_ID");
    expect(page).toContain("testId: HEADLINE_AB_TEST_ID");
    expect(page).toContain("conversionType: 'checkout_start'");
  });

  it("renders the isolated Klaviyo treatment with the $99 Kajabi checkout bridge", () => {
    const klaviyoPage = renderInterconnectedThankYouPage({
      treatment: "klaviyo99",
      medium: "sms",
      fbclid: "test.click-123",
    });

    expect(klaviyoPage).toContain("All 10 Episodes of Interconnected");
    expect(klaviyoPage).toContain("BONUS: Interconnected Director’s Cut");
    expect(klaviyoPage).toContain("BONUS EPISODE 10");
    expect(klaviyoPage).toContain("The Soil Inside You");
    expect(klaviyoPage).toContain("value: 99");
    expect(klaviyoPage).toContain("destination=https%3A%2F%2Ftheacademy.theurbanmonk.com%2Foffers%2FofRhsQvo%2Fcheckout");
    expect(klaviyoPage).toContain("utm_source=klaviyo");
    expect(klaviyoPage).toContain("utm_medium=sms");
    expect(klaviyoPage).toContain("utm_content=ty_b_klaviyo_v2_99_checkout");
    expect(klaviyoPage).toContain("funnel_path=ko_klaviyo");
    expect(klaviyoPage).toContain("email_key=ty_b_klaviyo_v2_99_checkout");
    expect(klaviyoPage).toContain("fbclid=test.click-123");
    expect(klaviyoPage).not.toContain("offers/57E3XFtT/checkout");
  });
});
