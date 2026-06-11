/**
 * Substack session cookie validation test.
 *
 * Validates that:
 * 1. SUBSTACK_SESSION_COOKIE env var is set
 * 2. SUBSTACK_PUBLICATION_URL env var is set
 * 3. The session cookie is in the correct format
 * 4. The Substack API accepts the session (live check)
 */

import { describe, it, expect } from "vitest";

describe("Substack session cookie", () => {
  it("SUBSTACK_SESSION_COOKIE env var is set", () => {
    const cookie = process.env.SUBSTACK_SESSION_COOKIE;
    expect(cookie, "SUBSTACK_SESSION_COOKIE must be set").toBeTruthy();
    expect(cookie!.length, "Cookie must be non-empty").toBeGreaterThan(10);
  });

  it("SUBSTACK_PUBLICATION_URL env var is set", () => {
    const url = process.env.SUBSTACK_PUBLICATION_URL;
    expect(url, "SUBSTACK_PUBLICATION_URL must be set").toBeTruthy();
    expect(url, "Must contain substack.com").toContain("substack.com");
  });

  it("session cookie is in correct format", () => {
    const cookie = process.env.SUBSTACK_SESSION_COOKIE ?? "";
    // Should be either "s%3A..." or "substack.sid=s%3A..."
    const isValid =
      cookie.startsWith("s%3A") || cookie.startsWith("substack.sid=s%3A");
    expect(isValid, `Cookie format invalid: ${cookie.slice(0, 20)}...`).toBe(true);
  });

  it("Substack session is valid (live API check via drafts endpoint)", async () => {
    const cookie = process.env.SUBSTACK_SESSION_COOKIE ?? "";
    const pubUrl = process.env.SUBSTACK_PUBLICATION_URL ?? "https://drpedramshojai.substack.com";
    const pubHost = pubUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const cookieHeader = cookie.startsWith("substack.sid=")
      ? cookie
      : `substack.sid=${cookie}`;

    // Use the publication's drafts endpoint — returns 200 when authenticated
    const res = await fetch(`https://${pubHost}/api/v1/drafts`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Origin: `https://${pubHost}`,
        Referer: `https://${pubHost}/publish/home`,
      },
    });

    // 200 = valid session, 401/403 = expired/invalid
    expect(
      res.status,
      `Substack session invalid (HTTP ${res.status}). Refresh SUBSTACK_SESSION_COOKIE.`
    ).toBe(200);
  }, 15_000); // 15s timeout for network call
});
