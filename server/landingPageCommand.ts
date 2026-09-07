export type LandingPageReleaseReadiness = {
  campaignId: string;
  title: string;
  ctaDestinationKey: string | null;
  pageKey: string | null;
  utmCampaign: string | null;
  framerProjectName: string | null;
  framerTemplateKey: string | null;
  qaClaimsApproved: boolean;
  qaAssetsApproved: boolean;
  qaSeoApproved: boolean;
  qaCtaApproved: boolean;
  qaTrackingApproved: boolean;
};

/**
 * This is intentionally an internal readiness check, not a publish gate.
 * A clean result permits only a release request; it never contacts Framer.
 */
export function getLandingPageReleaseBlockers(page: LandingPageReleaseReadiness): string[] {
  const blockers: string[] = [];
  if (!page.campaignId.trim()) blockers.push("Campaign ID is required.");
  if (!page.title.trim()) blockers.push("Internal page title is required.");
  if (!page.ctaDestinationKey?.trim()) blockers.push("An approved CTA destination key is required.");
  if (!page.pageKey?.trim()) blockers.push("A page key is required for attribution.");
  if (!page.utmCampaign?.trim()) blockers.push("A UTM campaign value is required for attribution.");
  if (!page.framerProjectName?.trim()) blockers.push("A planned Framer project name is required.");
  if (!page.framerTemplateKey?.trim()) blockers.push("A planned Framer template key is required.");
  if (!page.qaClaimsApproved) blockers.push("Claims and required disclosures have not been approved.");
  if (!page.qaAssetsApproved) blockers.push("Assets have not been approved.");
  if (!page.qaSeoApproved) blockers.push("SEO policy and canonical posture have not been approved.");
  if (!page.qaCtaApproved) blockers.push("CTA destination mapping has not been approved.");
  if (!page.qaTrackingApproved) blockers.push("Tracking and attribution mapping has not been approved.");
  return blockers;
}

export function isQaComplete(page: Pick<LandingPageReleaseReadiness, "qaClaimsApproved" | "qaAssetsApproved" | "qaSeoApproved" | "qaCtaApproved" | "qaTrackingApproved">) {
  return page.qaClaimsApproved && page.qaAssetsApproved && page.qaSeoApproved && page.qaCtaApproved && page.qaTrackingApproved;
}
