import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../scripts/build.mjs", import.meta.url)),
  "utf8"
);

describe("staged Hub Content build pipeline", () => {
  it("verifies the verified Webinar Studio chunk before a deployment build succeeds", () => {
    expect(source).toContain('bundle.mode === "hub-content"');
    expect(source).toContain("WebinarBuilder-");
    expect(source).toContain("repeat the deck, refresh the room");
    expect(source).toContain("The Deep Sleep Solution");
    expect(source).toContain("Hub Content build is missing the verified Webinar Studio chunk");
  });
});
