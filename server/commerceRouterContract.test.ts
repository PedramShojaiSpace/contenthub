import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("commerce router composition", () => {
  it("exposes the storefront product and cart procedures through the public app router", () => {
    const procedures = appRouter._def.procedures;

    expect(procedures["commerce.products.list"]).toBeDefined();
    expect(procedures["commerce.products.byHandle"]).toBeDefined();
    expect(procedures["commerce.collections.list"]).toBeDefined();
    expect(procedures["commerce.cart.create"]).toBeDefined();
    expect(procedures["commerce.cart.get"]).toBeDefined();
    expect(procedures["commerce.cart.addLines"]).toBeDefined();
  });
});
