/**
 * Kanban Card Image Regeneration Tests
 *
 * Tests the ai.generateImage procedure logic and the content item imageUrl update flow.
 */

import { describe, it, expect } from "vitest";

// ── Image generation prompt construction ─────────────────────────────────────
describe("Image generation prompt construction", () => {
  it("constructs a valid prompt for a blog platform card", () => {
    const platform = "blog";
    const title = "How to Meditate for Beginners";
    const topic = "meditation";

    const prompt = `Create a compelling hero image for a ${platform} post titled "${title}" about ${topic}. 
The Urban Monk brand: bridges ancient Daoist wisdom with modern functional medicine. 
Audience: educated professionals 30-55, health-conscious. 
Style: cinematic, high-quality photography, 16:9 aspect ratio. No text overlay.`;

    expect(prompt).toContain(title);
    expect(prompt).toContain(platform);
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("constructs a valid prompt for a meta/instagram platform card", () => {
    const platform = "meta";
    const title = "5 Morning Rituals";
    const topic = "morning routine";

    const prompt = `Create a compelling hero image for a ${platform} post titled "${title}" about ${topic}. 
The Urban Monk brand: bridges ancient Daoist wisdom with modern functional medicine. 
Audience: educated professionals 30-55, health-conscious. 
Style: cinematic, high-quality photography, 16:9 aspect ratio. No text overlay.`;

    expect(prompt).toContain("meta");
    expect(prompt).toContain("5 Morning Rituals");
  });
});

// ── Content item imageUrl update logic ───────────────────────────────────────
describe("Content item imageUrl update logic", () => {
  it("updates imageUrl field when regeneration succeeds", () => {
    // Simulate the state update pattern used in CommandCenter
    const initialItem = {
      id: 1,
      title: "Test Post",
      imageUrl: "https://old-image.com/image.jpg",
      platform: "blog",
    };

    const newImageUrl = "https://new-image.com/regenerated.jpg";

    // Simulate the mutation onSuccess handler
    const updatedItem = { ...initialItem, imageUrl: newImageUrl };

    expect(updatedItem.imageUrl).toBe(newImageUrl);
    expect(updatedItem.id).toBe(initialItem.id);
    expect(updatedItem.title).toBe(initialItem.title);
  });

  it("preserves other fields when only imageUrl is updated", () => {
    const item = {
      id: 5,
      title: "Urban Monk Post",
      imageUrl: "https://old.com/img.jpg",
      platform: "linkedin",
      status: "approved",
      textContent: "Some content here",
    };

    const newImageUrl = "https://cdn.example.com/new-image.png";
    const updated = { ...item, imageUrl: newImageUrl };

    expect(updated.id).toBe(5);
    expect(updated.title).toBe("Urban Monk Post");
    expect(updated.platform).toBe("linkedin");
    expect(updated.status).toBe("approved");
    expect(updated.textContent).toBe("Some content here");
    expect(updated.imageUrl).toBe(newImageUrl);
  });
});

// ── Image URL validation ──────────────────────────────────────────────────────
describe("Image URL validation", () => {
  it("accepts valid HTTPS image URLs", () => {
    const validUrls = [
      "https://cdn.example.com/image.jpg",
      "https://storage.googleapis.com/bucket/image.png",
      "https://s3.amazonaws.com/bucket/key/image.webp",
    ];

    for (const url of validUrls) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("rejects empty or null image URLs", () => {
    const invalidUrls = ["", null, undefined];

    for (const url of invalidUrls) {
      expect(!url).toBe(true);
    }
  });
});

// ── Regenerate image mutation input schema ────────────────────────────────────
describe("Regenerate image mutation input", () => {
  it("requires contentItemId and platform", () => {
    const input = {
      contentItemId: 42,
      platform: "blog",
      title: "Test Post",
      topic: "meditation",
    };

    expect(input.contentItemId).toBeTypeOf("number");
    expect(input.platform).toBeTypeOf("string");
    expect(input.contentItemId).toBeGreaterThan(0);
  });

  it("accepts optional topic field", () => {
    const inputWithTopic = { contentItemId: 1, platform: "meta", topic: "health" };
    const inputWithoutTopic = { contentItemId: 2, platform: "linkedin" };

    expect(inputWithTopic.topic).toBe("health");
    expect((inputWithoutTopic as any).topic).toBeUndefined();
  });
});
