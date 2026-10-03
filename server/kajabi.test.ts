import { describe, it, expect } from "vitest";

describe("Kajabi credentials", () => {
  it("should have KAJABI_CLIENT_ID set", () => {
    expect(process.env.KAJABI_CLIENT_ID).toBeTruthy();
  });

  it("should have KAJABI_CLIENT_SECRET set", () => {
    expect(process.env.KAJABI_CLIENT_SECRET).toBeTruthy();
  });

  it("should be able to reach Kajabi OAuth token endpoint", async () => {
    const clientId = process.env.KAJABI_CLIENT_ID!;
    const clientSecret = process.env.KAJABI_CLIENT_SECRET!;

    const response = await fetch("https://api.kajabi.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(12000),
    });

    // A rotated credential is accepted only when Kajabi issues an access token.
    // Do not log the response body: it contains the access token on success.
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.access_token).toBe("string");
    expect(body.access_token.length).toBeGreaterThan(20);
  }, 15000);
});
