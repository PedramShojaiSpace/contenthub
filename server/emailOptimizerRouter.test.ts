import { describe, expect, it } from "vitest";
import { optimizeEmailHtmlPublic } from "./emailOptimizerRouter";

describe("email optimizer", () => {
  it("removes the legacy hidden boost-data payload without removing the visible email", async () => {
    const result = await optimizeEmailHtmlPublic(`
      <p>Visible email copy.</p>
      <div id="boostData" data-id="boostData" style="display:none">Hidden delivery filler</div>
    `);

    expect(result.optimizedHtml).toContain("Visible email copy.");
    expect(result.optimizedHtml).not.toContain("boostData");
    expect(result.optimizedHtml).not.toContain("Hidden delivery filler");
    expect(result.changes).toContain("Removed 1 legacy hidden boost-data block(s)");
  });
});
