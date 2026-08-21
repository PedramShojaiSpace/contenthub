import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = path.resolve(process.cwd(), "drizzle", "migrations");

describe("Orobiome migration replay contract", () => {
  it("creates the checkout token exactly once across the sequential migrations", async () => {
    const [createTable, addCheckoutToken] = await Promise.all([
      readFile(path.join(migrationDirectory, "0123_add_orobiome_funnel_events.sql"), "utf8"),
      readFile(path.join(migrationDirectory, "0124_add_orobiome_checkout_token.sql"), "utf8"),
    ]);

    expect(createTable).not.toContain("shopify_checkout_token");
    expect(addCheckoutToken).toMatch(
      /ALTER TABLE\s+`orobiome_funnel_events`\s+ADD COLUMN\s+`shopify_checkout_token`/,
    );
  });
});
