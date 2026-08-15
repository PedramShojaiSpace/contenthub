import { describe, expect, it } from "vitest";
import {
  renderInterconnectedDayZeroKajabiOfferPage,
  renderInterconnectedDayZeroKoOfferPage,
} from "./interconnectedDayZeroOfferStaticPage";

describe("Interconnected Day 0 offer page", () => {
  const koHtml = renderInterconnectedDayZeroKoOfferPage();
  const kajabiHtml = renderInterconnectedDayZeroKajabiOfferPage();

  it("explains the optional all-access offer before asking readers to check out", () => {
    expect(koHtml).toContain("Get the complete Interconnected series on your own schedule.");
    expect(koHtml).toContain("This is not required to participate in the free series.");
    expect(koHtml).toContain("Permanent, on-demand access to all 9 Interconnected episodes.");
    expect(koHtml).toContain("One payment. No recurring charge.");
  });

  it("keeps KO/Klaviyo traffic on the tracked Shopify $67 checkout stack", () => {
    expect(koHtml).toContain("/r/checkout?");
    expect(koHtml).toContain("destination=https%3A%2F%2Fshop.theurbanmonk.com%2Fcart%2F48959577653402%3A1");
    expect(koHtml).toContain("utm_source=klaviyo");
    expect(koHtml).toContain("utm_content=day0_67_offer_page_ko");
    expect(koHtml).toContain("Secure Shopify checkout");
    expect(koHtml).not.toContain("theacademy.theurbanmonk.com/offers/57E3XFtT/checkout");
  });

  it("keeps Kajabi-origin traffic on the $67 Kajabi checkout stack", () => {
    expect(kajabiHtml).toContain("https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout?");
    expect(kajabiHtml).toContain("utm_source=kajabi");
    expect(kajabiHtml).toContain("utm_content=day0_67_offer_page_kajabi");
    expect(kajabiHtml).toContain("Secure Kajabi checkout");
    expect(kajabiHtml).not.toContain("shop.theurbanmonk.com/cart/48959577653402:1");
    expect(kajabiHtml).toContain("InitiateCheckout");
  });

  it("does not present fabricated customer reviews or a thank-you-page countdown", () => {
    expect(koHtml).not.toContain("4.9 out of 5");
    expect(koHtml).not.toContain("customer reviews");
    expect(koHtml).not.toContain("Discount Expires In");
    expect(kajabiHtml).not.toContain("Discount Expires In");
  });
});
