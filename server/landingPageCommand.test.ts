import { describe, expect, it } from "vitest";
import { getLandingPageReleaseBlockers, isQaComplete } from "./landingPageCommand";

const readyBase = {
  campaignId: "agora-p1-entry-price",
  title: "Agora entry-price thank-you page",
  ctaDestinationKey: "kajabi_agora_p49",
  pageKey: "agora-p1-p49-ty",
  utmCampaign: "agora-p1",
  framerProjectName: "Urban Monk Growth",
  framerTemplateKey: "thank-you-offer-v1",
  qaClaimsApproved: true,
  qaAssetsApproved: true,
  qaSeoApproved: true,
  qaCtaApproved: true,
  qaTrackingApproved: true,
};

describe("Landing Pages Command Center release safeguards", () => {
  it("permits an internal release request only after every Phase 1 requirement is recorded", () => {
    expect(getLandingPageReleaseBlockers(readyBase)).toEqual([]);
    expect(isQaComplete(readyBase)).toBe(true);
  });

  it("blocks a release request when a CTA destination key is missing", () => {
    expect(getLandingPageReleaseBlockers({ ...readyBase, ctaDestinationKey: null })).toContain("An approved CTA destination key is required.");
  });

  it("blocks a release request when a required QA review has not passed", () => {
    const blockers = getLandingPageReleaseBlockers({ ...readyBase, qaTrackingApproved: false });
    expect(blockers).toContain("Tracking and attribution mapping has not been approved.");
    expect(isQaComplete({ ...readyBase, qaTrackingApproved: false })).toBe(false);
  });

  it("requires explicit Framer planning metadata without contacting Framer", () => {
    const blockers = getLandingPageReleaseBlockers({ ...readyBase, framerProjectName: "", framerTemplateKey: null });
    expect(blockers).toContain("A planned Framer project name is required.");
    expect(blockers).toContain("A planned Framer template key is required.");
  });
});
