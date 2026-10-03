import { describe, expect, it } from "vitest";

/**
 * Validates only that the protected Resend credential can authenticate against
 * a read-only endpoint. It does not create, modify, or send anything.
 */
describe("Resend credential", () => {
  it("authenticates with the configured protected API key", async () => {
    const apiKey = process.env.RESEND_API_KEY;

    expect(apiKey, "RESEND_API_KEY must be configured in protected project secrets").toBeTruthy();
    expect(
      apiKey?.trim(),
      "RESEND_API_KEY must not contain leading or trailing whitespace",
    ).toBe(apiKey);

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    expect(
      response.status,
      `Resend read-only domains request failed with HTTP ${response.status}`,
    ).toBe(200);

    const payload = (await response.json()) as {
      data?: Array<{ name?: string; status?: string }>;
    };
    const verifiedDomains = (payload.data ?? [])
      .filter((domain) => domain.status === "verified")
      .map((domain) => domain.name)
      .filter((name): name is string => Boolean(name));

    expect(verifiedDomains, "At least one verified Resend sender domain is required").not.toHaveLength(0);
    console.info(`Verified Resend sender domains: ${verifiedDomains.join(", ")}`);
  }, 20_000);
});
