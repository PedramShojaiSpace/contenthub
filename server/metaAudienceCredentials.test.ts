import { describe, expect, it } from "vitest";

const accountId = "10207858653523297";

describe("Meta Custom Audience credential", () => {
  it("can read Custom Audience metadata for the approved ad account without uploading contacts", async () => {
    const accessToken = process.env.META_AD_ACCESS_TOKEN;
    expect(accessToken, "META_AD_ACCESS_TOKEN must be present for the approved audience sync").toBeTruthy();

    const url = new URL(`https://graph.facebook.com/v21.0/act_${accountId}/customaudiences`);
    url.searchParams.set("fields", "id,name,subtype");
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", accessToken!);

    const response = await fetch(url);
    const body = await response.text();
    expect(response.ok, `Meta Custom Audience read failed: ${body.slice(0, 300)}`).toBe(true);

    const parsed = JSON.parse(body) as { data?: unknown[] };
    expect(Array.isArray(parsed.data)).toBe(true);
  }, 30_000);
});
