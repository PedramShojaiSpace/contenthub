import { describe, expect, it } from "vitest";
import { completedTrailingWindow } from "./interconnectedEmailRevenueRouter";

describe("Interconnected email reporting window", () => {
  it("uses fourteen completed UTC days and excludes the partial current day", () => {
    const now = Date.UTC(2026, 7, 15, 21, 45, 0);
    expect(completedTrailingWindow(now)).toEqual({
      startAt: Date.UTC(2026, 7, 1, 0, 0, 0),
      endAt: Date.UTC(2026, 7, 15, 0, 0, 0),
    });
  });
});
