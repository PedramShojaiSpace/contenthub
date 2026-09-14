import { describe, expect, it } from "vitest";
import {
  getInitialVAView,
  isVideoJobProcessing,
  matchesVAVideoFilter,
} from "../client/src/lib/vaVideoJobFilters";

describe("VA dashboard video visibility", () => {
  it("treats active Descript editing jobs as processing", () => {
    expect(isVideoJobProcessing("importing")).toBe(true);
    expect(isVideoJobProcessing("editing")).toBe(true);
    expect(isVideoJobProcessing("rendering")).toBe(true);
    expect(isVideoJobProcessing("ready_for_review")).toBe(false);
  });

  it("shows an unarchived editing job in the In Progress filter", () => {
    expect(matchesVAVideoFilter({ status: "editing", archivedAt: null }, "processing")).toBe(true);
    expect(matchesVAVideoFilter({ status: "editing", archivedAt: 123 }, "processing")).toBe(false);
  });

  it("opens direct video-processing links in the intended dashboard view", () => {
    expect(getInitialVAView("?tab=video&filter=processing")).toEqual({
      activeTab: "video",
      videoFilter: "processing",
    });
  });

  it("preserves the existing default VA dashboard view", () => {
    expect(getInitialVAView("")).toEqual({
      activeTab: "syndication",
      videoFilter: "review",
    });
  });
});
