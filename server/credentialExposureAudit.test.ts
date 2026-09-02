import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("credential exposure audit utility", () => {
  it("is redacting and does not print matched credential values", async () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/security/audit-credential-exposure.mjs");
    const source = await readFile(scriptPath, "utf8");

    expect(source).toContain("sha256");
    expect(source).toContain("Credential values are never written to this report");
    expect(source).toContain('"rev-list", "--all"');
    expect(source).toContain('"show", "--format=", "--no-ext-diff"');
    expect(source).not.toContain("console.log(match");
    expect(source).toContain('mode: 0o600');
  });

  it("covers the Google, Meta, Shopify, and Soro credential patterns relevant to this incident", async () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/security/audit-credential-exposure.mjs");
    const source = await readFile(scriptPath, "utf8");

    expect(source).toContain("Soro API key");
    expect(source).toContain("Meta access token");
    expect(source).toContain("Shopify Admin access token");
    expect(source).toContain("Google OAuth client secret");
  });
});
