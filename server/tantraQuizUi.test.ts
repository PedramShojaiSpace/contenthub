import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tantra quiz public interface", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/TantraQuiz.tsx"), "utf8");

  it("uses the approved whole-system desire framing and retains both exact product destinations", () => {
    expect(source).toContain("Your desire is part of the whole system.");
    expect(source).toContain("functional-medicine perspective");
    expect(source).toContain("https://shop.theurbanmonk.com/products/tantra-him");
    expect(source).toContain("https://shop.theurbanmonk.com/products/tantra-her");
  });

  it("keeps results available before optional email capture and makes the clinical-review boundary explicit", () => {
    expect(source).toContain("Results appear immediately. No purchase. No automatic email enrollment.");
    expect(source).toContain("This does not determine eligibility or provide medical advice.");
    expect(source).toContain("Product suitability is determined by a qualified clinician—not this quiz.");
  });

  it("removes legacy Taoist copy and client-side advertising tracking from the public quiz", () => {
    expect(source.toLowerCase()).not.toContain("taoist");
    expect(source).not.toContain("trackTantraPixel");
    expect(source).not.toContain("fbq(");
  });
});
