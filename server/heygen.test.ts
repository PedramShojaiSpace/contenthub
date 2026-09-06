import { describe, expect, it } from "vitest";
import {
  HEYGEN_OUTBOUND_DISABLED,
  HEYGEN_OUTBOUND_DISABLED_MESSAGE,
  assertHeyGenOutboundEnabled,
  isHeyGenOutboundDisabled,
} from "./heygenControl";

describe("HeyGen security containment", () => {
  it("uses a deny-by-default outbound switch without reading a credential", () => {
    expect(HEYGEN_OUTBOUND_DISABLED).toBe(true);
    expect(isHeyGenOutboundDisabled()).toBe(true);
    expect(() => assertHeyGenOutboundEnabled()).toThrow(HEYGEN_OUTBOUND_DISABLED_MESSAGE);
  });
});
