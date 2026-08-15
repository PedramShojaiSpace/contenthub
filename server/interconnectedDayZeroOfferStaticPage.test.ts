import { describe, expect, it } from "vitest";
import { renderInterconnectedDayZeroOfferPage } from "./interconnectedDayZeroOfferStaticPage";

describe("Interconnected Day 0 offer page", () => {
  const html = renderInterconnectedDayZeroOfferPage();

  it("explains the optional all-access offer before asking readers to check out", () => {
    expect(html).toContain("Get the complete Interconnected series on your own schedule.");
    expect(html).toContain("This is not required to participate in the free series.");
    expect(html).toContain("Permanent, on-demand access to all 9 Interconnected episodes.");
    expect(html).toContain("One payment. No recurring charge.");
  });

  it("uses the tracked Shopify $67 checkout bridge with dedicated Day 0 attribution", () => {
    expect(html).toContain("/r/checkout?");
    expect(html).toContain("destination=https%3A%2F%2Fshop.theurbanmonk.com%2Fcart%2F48959577653402%3A1");
    expect(html).toContain("utm_source=klaviyo");
    expect(html).toContain("utm_medium=email");
    expect(html).toContain("utm_campaign=interconnected_14day");
    expect(html).toContain("utm_content=day0_67_offer_page");
    expect(html).toContain("InitiateCheckout");
  });

  it("does not present fabricated customer reviews or a thank-you-page countdown", () => {
    expect(html).not.toContain("4.9 out of 5");
    expect(html).not.toContain("customer reviews");
    expect(html).not.toContain("Discount Expires In");
  });
});
