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
    expect(koHtml).toContain("utm_content=ko_d00_offer");
    expect(koHtml).toContain("funnel_path=ko_klaviyo");
    expect(koHtml).toContain("email_key=ko_d00_offer");
    expect(koHtml).toContain("Secure Shopify checkout");
    expect(koHtml).not.toContain("theacademy.theurbanmonk.com/offers/57E3XFtT/checkout");
  });

  it("keeps Kajabi-origin traffic on the $67 Kajabi checkout stack", () => {
    expect(kajabiHtml).toContain("/r/checkout?");
    expect(kajabiHtml).toContain("destination=https%3A%2F%2Ftheacademy.theurbanmonk.com%2Foffers%2F57E3XFtT%2Fcheckout");
    expect(kajabiHtml).toContain("utm_source=kajabi");
    expect(kajabiHtml).toContain("utm_content=kajabi_d00_offer");
    expect(kajabiHtml).toContain("funnel_path=kajabi");
    expect(kajabiHtml).toContain("email_key=kajabi_d00_offer");
    expect(kajabiHtml).toContain("Secure Kajabi checkout");
    expect(kajabiHtml).not.toContain("shop.theurbanmonk.com/cart/48959577653402:1");
    expect(kajabiHtml).toContain("InitiateCheckout");
  });

  it("preserves a valid channel-specific message key without accepting unsafe values", () => {
    expect(renderInterconnectedDayZeroKoOfferPage({ email_key: "ko_d03_episode_3" }))
      .toContain("email_key=ko_d03_episode_3");
    expect(renderInterconnectedDayZeroKajabiOfferPage({ email_key: "../cross-path" }))
      .toContain("email_key=kajabi_d00_offer");
  });

  it("does not present fabricated customer reviews or a thank-you-page countdown", () => {
    expect(koHtml).not.toContain("4.9 out of 5");
    expect(koHtml).not.toContain("customer reviews");
    expect(koHtml).not.toContain("Discount Expires In");
    expect(kajabiHtml).not.toContain("Discount Expires In");
  });
});
