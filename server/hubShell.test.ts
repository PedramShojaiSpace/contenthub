import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("HubShell loading state", () => {
  it("shows a visible Content Hub loading state while lazy route modules resolve", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/HubShell.tsx"),
      "utf8"
    );
    expect(source).toContain("Loading Content Hub…");
    expect(source).toContain("Loader2");
  });
});
