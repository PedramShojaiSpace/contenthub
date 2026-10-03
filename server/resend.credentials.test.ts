/**
 * Read-only credential validation for the protected Resend API key.
 * This makes no email, contact, audience, domain, or billing change.
 */
import { describe, expect, it } from "vitest";

describe("Resend credentials", () => {
  it("authenticates the configured API key against the read-only domains endpoint", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey, "RESEND_API_KEY must be present in protected project secrets").toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(
      response.ok,
      `Resend read-only credential check returned HTTP ${response.status}`,
    ).toBe(true);
  }, 20_000);
});
