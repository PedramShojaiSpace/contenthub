import { describe, expect, it } from "vitest";
import {
  canonicalMetaCheckoutCount,
  canonicalMetaLeadCount,
  canonicalMetaPurchaseCount,
  canonicalMetaPurchaseValue,
} from "./metaActionMetrics";

describe("canonical Meta action metrics", () => {
  it("does not add overlapping Lead representations together", () => {
    expect(canonicalMetaLeadCount([
      { action_type: "lead", value: "71" },
      { action_type: "onsite_conversion.lead_grouped", value: "71" },
      { action_type: "complete_registration", value: "71" },
    ])).toBe(71);
  });

  it("uses a fallback Lead action only when the canonical action is absent", () => {
    expect(canonicalMetaLeadCount([
      { action_type: "onsite_conversion.lead_grouped", value: "12" },
      { action_type: "complete_registration", value: "12" },
    ])).toBe(12);
  });

  it("does not add add-to-cart to initiate-checkout", () => {
    expect(canonicalMetaCheckoutCount([
      { action_type: "initiate_checkout", value: "9" },
      { action_type: "add_to_cart", value: "15" },
    ])).toBe(9);
  });

  it("uses one canonical Purchase representation rather than double-counting", () => {
    expect(canonicalMetaPurchaseCount([
      { action_type: "purchase", value: "4" },
      { action_type: "omni_purchase", value: "3" },
    ])).toBe(3);
  });

  it("reads Purchase revenue from action_values using the same canonical priority", () => {
    expect(canonicalMetaPurchaseValue([
      { action_type: "purchase", value: "268.00" },
      { action_type: "omni_purchase", value: "201.00" },
    ])).toBe(201);
  });
});
