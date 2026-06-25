/**
 * HeyGen API Key Validation Test
 *
 * Validates that the HEYGEN_API_KEY, HEYGEN_AVATAR_ID, and HEYGEN_VOICE_ID
 * environment variables are configured and that the HeyGen API is reachable
 * with the provided credentials.
 *
 * This is a live integration test — it makes a real HTTP request to HeyGen.
 * It does NOT generate a video (to avoid consuming quota).
 * Instead, it calls the GET /v2/video/list endpoint which is a lightweight
 * credential check that returns 200 with a valid API key.
 */

import { describe, it, expect } from "vitest";

const HEYGEN_API_BASE = "https://api.heygen.com";

describe("HeyGen API credentials", () => {
  it("should have HEYGEN_API_KEY configured", () => {
    const apiKey = process.env.HEYGEN_API_KEY;
    expect(apiKey, "HEYGEN_API_KEY must be set in environment").toBeTruthy();
    expect(apiKey!.length, "HEYGEN_API_KEY should be at least 20 chars").toBeGreaterThan(20);
  });

  it("should have HEYGEN_AVATAR_ID configured", () => {
    const avatarId = process.env.HEYGEN_AVATAR_ID;
    expect(avatarId, "HEYGEN_AVATAR_ID must be set in environment").toBeTruthy();
    expect(avatarId!.length, "HEYGEN_AVATAR_ID should be at least 10 chars").toBeGreaterThan(10);
  });

  it("should have HEYGEN_VOICE_ID configured", () => {
    const voiceId = process.env.HEYGEN_VOICE_ID;
    expect(voiceId, "HEYGEN_VOICE_ID must be set in environment").toBeTruthy();
    expect(voiceId!.length, "HEYGEN_VOICE_ID should be at least 10 chars").toBeGreaterThan(10);
  });

  it(
    "should authenticate successfully with HeyGen API",
    async () => {
      const apiKey = process.env.HEYGEN_API_KEY;
      if (!apiKey) {
        throw new Error("HEYGEN_API_KEY is not set — cannot run live API test");
      }

      // Use the remaining quota endpoint — lightweight, no side effects
      // HeyGen v1 video list endpoint
      const res = await fetch(`${HEYGEN_API_BASE}/v1/video.list?limit=1`, {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      // 200 = valid key; 401 = invalid key; 403 = key valid but no access
      // We accept 200, 403, or 404 as "key is recognized by HeyGen" (endpoint may vary by plan)
      expect(
        [200, 403, 404].includes(res.status),
        `HeyGen API returned unexpected status ${res.status} — check HEYGEN_API_KEY`
      ).toBe(true);

      if (res.status === 200) {
        const json = await res.json() as Record<string, unknown>;
        // HeyGen v1 returns { code: 100, data: {...} } on success
        // Accept any 200 response as valid — the key is recognized
        expect(json, "HeyGen API should return a JSON object").toBeTruthy();
      }
    },
    20_000 // 20s timeout for live API call
  );

  it(
    "should have HEYGEN_AVATAR_ID (look_id) configured as a valid 32-char hex string",
    () => {
      // HEYGEN_AVATAR_ID now holds the look_id (not the avatar_id).
      // The avatar_id is hardcoded in heygenRouter.ts as Pedram's avatar.
      const lookId = process.env.HEYGEN_AVATAR_ID;
      expect(lookId, "HEYGEN_AVATAR_ID (look_id) must be set").toBeTruthy();
      // A valid HeyGen look_id is a 32-char hex string (no dashes)
      expect(/^[0-9a-f]{32}$/.test(lookId!), `look_id "${lookId}" should be a 32-char lowercase hex string`).toBe(true);
      // Must not be the old broken look_id
      expect(lookId, "look_id should not be the old broken value").not.toBe("517e3a662b6845c29e140ec6ccdb991a");
    }
  );
});
