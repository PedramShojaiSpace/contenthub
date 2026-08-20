import { describe, expect, it } from "vitest";
import {
  buildInterconnectedLeadInsertValues,
  interconnectedRegistrationInput,
} from "./interconnectedRouter";
import { renderInterconnectedPage } from "./interconnectedStaticPage";

describe("Interconnected first-party Meta campaign identity capture", () => {
  const campaignIdentity = {
    metaCampaignId: "120999000111222",
    metaAdsetId: "120999000333444",
    metaAdId: "120999000555666",
    metaCampaignKey: "agora_interconnected_us_2026_08",
  };

  it("accepts and prepares all approved invisible URL identity values for local lead storage", () => {
    const input = interconnectedRegistrationInput.parse({
      name: "Campaign Test",
      email: "campaign-test@example.com",
      ...campaignIdentity,
    });

    expect(buildInterconnectedLeadInsertValues(input, "203.0.113.11", "Campaign test agent"))
      .toMatchObject({
        email: "campaign-test@example.com",
        ...campaignIdentity,
      });
  });

  it("forwards the four approved URL parameters invisibly from the static opt-in page", () => {
    const page = renderInterconnectedPage();

    expect(page).toContain("metaCampaignId: params.get('meta_campaign_id') || undefined");
    expect(page).toContain("metaAdsetId: params.get('meta_adset_id') || undefined");
    expect(page).toContain("metaAdId: params.get('meta_ad_id') || undefined");
    expect(page).toContain("metaCampaignKey: params.get('meta_campaign_key') || undefined");
  });
});
