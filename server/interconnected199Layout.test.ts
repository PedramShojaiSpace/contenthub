import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected $199 post-purchase layout", () => {
  it("keeps the member-offer box in a centered desktop grid-spanning wrapper", () => {
    const source = readFileSync(
      new URL("../client/src/pages/Interconnected199PostPurchaseKlaviyo.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('className="mx-auto w-full max-w-2xl lg:col-span-2"');
    expect(source).toContain("Post-purchase member offer");
  });
});
