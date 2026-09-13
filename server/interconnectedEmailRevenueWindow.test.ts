import { describe, expect, it } from "vitest";
import { completedTrailingWindow, KO_KLAVIYO_LIVE_FLOW_ID } from "./interconnectedEmailRevenueRouter";

describe("Interconnected email reporting window", () => {
  it("uses fourteen completed UTC days and excludes the partial current day", () => {
    const now = Date.UTC(2026, 7, 15, 21, 45, 0);
    expect(completedTrailingWindow(now)).toEqual({
      startAt: Date.UTC(2026, 7, 1, 0, 0, 0),
      endAt: Date.UTC(2026, 7, 15, 0, 0, 0),
    });
  });

  it("collects KO/Klaviyo performance from the current live flow", () => {
    expect(KO_KLAVIYO_LIVE_FLOW_ID).toBe("YyFZPu");
  });
});
