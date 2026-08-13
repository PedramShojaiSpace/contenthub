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

  it("reduces social navigation and decorated CTA chrome while preserving a functional unsubscribe link", async () => {
    const result = await optimizeEmailHtmlPublic(`
      <p>A personal note before the next step.</p>
      <p><a href="https://example.com/watch" style="background-color:#b00;border-radius:8px;display:inline-block;color:#fff">Watch the video</a></p>
      <p><a href="https://instagram.com/urbanmonk">Instagram</a> <a href="https://facebook.com/urbanmonk">Facebook</a></p>
      <p><a href="{% unsubscribe %}">Unsubscribe</a></p>
    `);

    expect(result.optimizedHtml).not.toContain("instagram.com");
    expect(result.optimizedHtml).not.toContain("facebook.com");
    expect(result.optimizedHtml).toContain("{% unsubscribe %}");
    expect(result.optimizedHtml).toContain("text-decoration:underline");
    expect(result.changes.some((change) => change.includes("social-navigation"))).toBe(true);
  });
});
