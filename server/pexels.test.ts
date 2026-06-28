/**
 * Pexels API key validation test
 * Verifies the PEXELS_API_KEY env var is set and returns valid results
 */
import { describe, it, expect } from "vitest";

describe("Pexels API key", () => {
  it("should be set in environment", () => {
    expect(process.env.PEXELS_API_KEY).toBeTruthy();
  });

  it("should return valid video results for a simple query", async () => {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.warn("PEXELS_API_KEY not set — skipping live API test");
      return;
    }

    const res = await fetch(
      "https://api.pexels.com/videos/search?query=nature&per_page=2&orientation=landscape",
      { headers: { Authorization: apiKey } }
    );

    expect(res.ok).toBe(true);
    const data = (await res.json()) as { total_results: number; videos: unknown[] };
    expect(data.total_results).toBeGreaterThan(0);
    expect(data.videos.length).toBeGreaterThan(0);
  }, 15_000);
});
