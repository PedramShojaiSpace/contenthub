import { describe, expect, it } from "vitest";
import { appendPost11154References, POST_11154_REFERENCE_MARKER } from "./post11154References";

describe("appendPost11154References", () => {
  const source = "<p>Microbiome context [2], metabolic framing [9], nutrition [14], and dysbiosis [18].</p><ul><li>Replace plastic food containers with glass</li></ul>";

  it("links every referenced source and appends the guarded bibliography", () => {
    const result = appendPost11154References(source);

    for (const id of [2, 4, 9, 14, 18]) {
      expect(result).toContain(`href=\"#source-${id}\"`);
      expect(result).toContain(`id=\"source-${id}\"`);
      expect(result).toContain(`<strong>[${id}]</strong>`);
    }
    expect(result).toContain(POST_11154_REFERENCE_MARKER);
    expect(result).toContain("https://pubmed.ncbi.nlm.nih.gov/41601564/");
    expect(result).toContain("https://pubmed.ncbi.nlm.nih.gov/41160105/");
  });

  it("refuses a partial citation map or duplicate append", () => {
    expect(() => appendPost11154References("<p>Only [2] is present.</p>")).toThrow("Expected plastic-container guidance");
    expect(() => appendPost11154References(`${source}<section ${POST_11154_REFERENCE_MARKER}></section>`)).toThrow(
      "already contains the guarded source marker"
    );
  });
});
