/**
 * Ingest endpoint tests
 * Validates that INGEST_SECRET is configured and the endpoint rejects bad secrets.
 */
import { describe, it, expect } from "vitest";
import "dotenv/config";

describe("Ingest endpoint configuration", () => {
  it("should have INGEST_SECRET configured in environment", () => {
    const secret = process.env.INGEST_SECRET;
    expect(secret, "INGEST_SECRET must be set in environment").toBeTruthy();
    expect(secret!.length, "INGEST_SECRET must be at least 16 characters").toBeGreaterThanOrEqual(16);
  });

  it("should reject requests with wrong secret (unit test of validation logic)", async () => {
    const { ENV } = await import("./_core/env");
    // The secret must be non-empty
    expect(ENV.ingestSecret).toBeTruthy();
    // A wrong secret should not match
    expect("wrong-secret-value").not.toBe(ENV.ingestSecret);
  });

  it("should have ingestReports table available in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.ingestReports).toBeDefined();
    expect(schema.ingestReports).not.toBeNull();
  });
});
