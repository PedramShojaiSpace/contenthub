import { describe, expect, it } from "vitest";
import { buildSendyDraftPayload } from "./sendy";

describe("Sendy draft payload", () => {
  const payload = buildSendyDraftPayload({
    brandId: "brand_1",
    fromName: "The Urban Monk",
    fromEmail: "hello@theurbanmonk.com",
    replyTo: "support@theurbanmonk.com",
    title: "Working professionals — day 1",
    subject: "A grounded next step",
    plainText: "Hello there.",
    html: "<p>Hello there.</p>",
    trackOpens: true,
    trackClicks: true,
  });

  it("always creates a Sendy draft rather than sending or scheduling a campaign", () => {
    expect(payload.send_campaign).toBe("0");
    expect(payload).not.toHaveProperty("schedule_date_time");
    expect(payload).not.toHaveProperty("schedule_timezone");
    expect(payload).not.toHaveProperty("list_ids");
    expect(payload).not.toHaveProperty("segment_ids");
  });

  it("includes the required content, sender, brand, and tracking fields", () => {
    expect(payload).toMatchObject({
      brand_id: "brand_1",
      from_name: "The Urban Monk",
      from_email: "hello@theurbanmonk.com",
      reply_to: "support@theurbanmonk.com",
      html_text: "<p>Hello there.</p>",
      plain_text: "Hello there.",
      track_opens: "1",
      track_clicks: "1",
    });
  });
});
