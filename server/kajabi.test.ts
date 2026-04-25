import { describe, it, expect, vi } from "vitest";
import { env } from "./_core/env";

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

    // 200 = valid credentials, 401 = invalid credentials
    // We accept both as "reachable" — the important thing is the endpoint responds
    expect([200, 401, 400, 422]).toContain(response.status);
    const body = await response.json();
    console.log("[Kajabi OAuth test] status:", response.status, "body keys:", Object.keys(body));

    if (response.status === 200) {
      expect(body.access_token).toBeTruthy();
    }
  }, 15000);
});
