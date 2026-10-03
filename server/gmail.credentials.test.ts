/**
 * Validates that GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are set and
 * that the Gmail OAuth client can generate a valid authorization URL.
 */
import { describe, it, expect } from "vitest";

describe("Gmail credentials", () => {
  it("GMAIL_CLIENT_ID is set and looks like a Google client ID", () => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    expect(clientId).toBeTruthy();
    // Google OAuth client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GMAIL_CLIENT_SECRET is set and looks like a Google client secret", () => {
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    expect(clientSecret).toBeTruthy();
    // Google client secrets start with GOCSPX- or are non-empty strings
    expect(clientSecret!.length).toBeGreaterThan(10);
  });

  it("getGmailAuthUrl generates a valid Google OAuth URL", async () => {
    const { getGmailAuthUrl } = await import("./gmail");
    const url = getGmailAuthUrl();
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("gmail");
    expect(url).toContain(process.env.GMAIL_CLIENT_ID!.split(".")[0]);
  });

  it("uses the current client secret to refresh and read the connected Gmail profile", async () => {
    const { getOwnerCredentials } = await import("./db");
    const { testGmailConnection } = await import("./gmail");
    const originalRefreshToken = process.env.GMAIL_REFRESH_TOKEN;

    try {
      const ownerCredentials = await getOwnerCredentials();
      if (!process.env.GMAIL_REFRESH_TOKEN && ownerCredentials?.gmailRefreshToken) {
        process.env.GMAIL_REFRESH_TOKEN = ownerCredentials.gmailRefreshToken;
      }

      expect(process.env.GMAIL_REFRESH_TOKEN).toBeTruthy();
      const result = await testGmailConnection();
      expect(result.ok, result.error ?? "Gmail profile request failed").toBe(true);
      expect(result.email).toContain("@");
    } finally {
      if (originalRefreshToken === undefined) {
        delete process.env.GMAIL_REFRESH_TOKEN;
      } else {
        process.env.GMAIL_REFRESH_TOKEN = originalRefreshToken;
      }
    }
  }, 20_000);
});
