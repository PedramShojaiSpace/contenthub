import { describe, expect, it } from "vitest";
import { createSendyDraft } from "./sendy";

describe("Sendy draft-only integration", () => {
  it.skipIf(process.env.RUN_SENDY_MUTATION_TESTS !== "true")("creates one unsent validation draft without recipients or scheduling", async () => {
    const response = await createSendyDraft({
      brandId: "1",
      fromName: "The Urban Monk",
      fromEmail: "support@theurbanmonk.com",
      replyTo: "support@theurbanmonk.com",
      title: "TEST — Content Hub Sendy Draft Validation — Do Not Send",
      subject: "TEST ONLY — Do Not Send",
      plainText: "This is a validation draft created by the Urban Monk Content Hub. Do not send.",
      html: "<p>This is a validation draft created by the Urban Monk Content Hub. <strong>Do not send.</strong></p>",
      trackOpens: false,
      trackClicks: false,
    });

    expect(response.message).toMatch(/draft created in sendy/i);
  }, 30_000);
});
