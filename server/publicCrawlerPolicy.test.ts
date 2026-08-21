import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public crawler policy", () => {
  it("keeps crawler guidance separate from the SPA fallback", async () => {
    const robots = await readFile(path.resolve(process.cwd(), "client/public/robots.txt"), "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /hub/");
    expect(robots).not.toContain("<!doctype html>");
  });
});
