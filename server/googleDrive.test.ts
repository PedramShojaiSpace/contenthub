/**
 * Validates that GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET are
 * correctly set by attempting to generate a Drive OAuth authorization URL.
 * This does NOT make any network calls — it only verifies the credentials
 * are present and the OAuth2 client can be constructed.
 */
import { describe, it, expect } from "vitest";
import { getDriveAuthUrl } from "./googleDrive";

describe("Google Drive credentials", () => {
  it("should generate a valid Drive OAuth URL when credentials are set", () => {
    // getDriveAuthUrl() will throw if GOOGLE_DRIVE_CLIENT_ID or
    // GOOGLE_DRIVE_CLIENT_SECRET are missing or malformed
    const url = getDriveAuthUrl();
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("drive");
    expect(url).toContain("877945805124"); // partial client ID check
  });
});
