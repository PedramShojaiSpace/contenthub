import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMetaInsights } from "./adsMonitorRouter";

describe("fetchMetaInsights", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses one account-level insights request for the previous-day reporting batch", async () => {
    vi.stubEnv("META_AD_ACCESS_TOKEN", "test-token");
    vi.stubEnv("META_AD_ACCOUNT_ID", "12345");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          campaign_id: "campaign-1",
          campaign_name: "Agora — Test",
          adset_id: "adset-1",
          adset_name: "Prospecting",
          spend: "42.50",
          impressions: "1000",
          clicks: "25",
          ctr: "2.5",
          cpm: "42.5",
          frequency: "1.2",
          reach: "800",
          actions: [],
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const metrics = await fetchMetaInsights("yesterday");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("act_12345/insights");
    expect(metrics).toEqual([expect.objectContaining({
      campaignId: "campaign-1",
      spendCents: 4250,
      status: "BATCH_SNAPSHOT",
      dailyBudgetCents: 0,
    })]);
  });
});
