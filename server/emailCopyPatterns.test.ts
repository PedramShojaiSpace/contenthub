import { describe, expect, it } from "vitest";
import { reviewWinningCopyPatterns } from "./emailCopyPatterns";

describe("reviewWinningCopyPatterns", () => {
  it("recognizes the core patterns in a scene-led, education-first email", () => {
    const reviews = reviewWinningCopyPatterns(`
      <p>You know the moment. You are at dinner with your family, but your mind is somewhere else.</p>
      <p>This does not mean you are broken. It may be a pattern worth understanding.</p>
      <p>Here is what changes in the nervous system when attention is stretched thin, and why it matters.</p>
      <p>Try this short explanation before you decide what comes next.</p>
      <p><a href="https://example.com/video">Watch the video</a></p>
      <p>P.S. Reply and tell me whether this feels familiar.</p>
    `);

    expect(reviews.every((review) => review.status === "present")).toBe(true);
  });

  it("flags a link-first email that lacks the observed editorial patterns", () => {
    const reviews = reviewWinningCopyPatterns('<p><a href="https://example.com">Buy now</a></p>');

    expect(reviews.find((review) => review.name === "Teach before the ask")?.status).toBe("consider");
    expect(reviews.find((review) => review.name === "Human close or P.S.")?.status).toBe("consider");
  });
});
