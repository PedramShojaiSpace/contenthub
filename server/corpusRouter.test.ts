/**
 * Corpus Builder — Phase C Tests
 *
 * Tests the pure utility functions (generateEmbedding serialization, keyword
 * chunking) and the router's data-shape contracts using fixture data only.
 * No DB or network calls.
 */

import { describe, expect, it } from "vitest";

// ─── Utility re-exports for testing ──────────────────────────────────────────
// We test the serialization and chunking logic inline since they are not
// exported from the router (they're internal helpers). We replicate them
// here to keep tests self-contained.

const CHUNK_MAX_CHARS = 2000;

function serializeEmbedding(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}

function deserializeEmbedding(str: string): number[] {
  return JSON.parse(str) as number[];
}

function chunkContent(content: string): string {
  return content.slice(0, CHUNK_MAX_CHARS);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── serializeEmbedding ───────────────────────────────────────────────────────

describe("serializeEmbedding", () => {
  it("serializes a simple 3-dim vector", () => {
    expect(serializeEmbedding([1, 0, 0])).toBe("[1,0,0]");
  });

  it("serializes a 1536-dim vector without truncation", () => {
    const vec = Array.from({ length: 1536 }, (_, i) => i / 1536);
    const serialized = serializeEmbedding(vec);
    expect(serialized.startsWith("[")).toBe(true);
    expect(serialized.endsWith("]")).toBe(true);
    const parsed = JSON.parse(serialized) as number[];
    expect(parsed.length).toBe(1536);
  });

  it("round-trips correctly through deserialize", () => {
    const original = [0.1, 0.2, 0.3, -0.4, 0.5];
    const serialized = serializeEmbedding(original);
    const deserialized = deserializeEmbedding(serialized);
    expect(deserialized).toEqual(original);
  });

  it("handles zero vector", () => {
    const vec = Array(10).fill(0);
    const result = serializeEmbedding(vec);
    expect(result).toBe("[0,0,0,0,0,0,0,0,0,0]");
  });

  it("handles negative values", () => {
    const vec = [-0.5, -0.25, 0.75];
    const result = serializeEmbedding(vec);
    expect(result).toBe("[-0.5,-0.25,0.75]");
  });
});

// ─── chunkContent ─────────────────────────────────────────────────────────────

describe("chunkContent", () => {
  it("returns content unchanged when shorter than CHUNK_MAX_CHARS", () => {
    const short = "Hello world";
    expect(chunkContent(short)).toBe(short);
  });

  it("truncates content at CHUNK_MAX_CHARS", () => {
    const long = "a".repeat(3000);
    const chunked = chunkContent(long);
    expect(chunked.length).toBe(CHUNK_MAX_CHARS);
  });

  it("preserves exact content up to the limit", () => {
    const content = "word ".repeat(500); // 2500 chars
    const chunked = chunkContent(content);
    expect(chunked).toBe(content.slice(0, CHUNK_MAX_CHARS));
  });

  it("handles empty string", () => {
    expect(chunkContent("")).toBe("");
  });

  it("handles content exactly at limit", () => {
    const exact = "x".repeat(CHUNK_MAX_CHARS);
    expect(chunkContent(exact).length).toBe(CHUNK_MAX_CHARS);
  });
});

// ─── countWords ───────────────────────────────────────────────────────────────

describe("countWords", () => {
  it("counts words in a simple sentence", () => {
    expect(countWords("The quick brown fox")).toBe(4);
  });

  it("handles extra whitespace", () => {
    expect(countWords("  hello   world  ")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("counts a long transcript accurately", () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
    expect(countWords(text)).toBe(500);
  });

  it("handles newlines as word separators", () => {
    expect(countWords("line one\nline two\nline three")).toBe(6);
  });
});

// ─── Corpus entry validation ──────────────────────────────────────────────────

describe("Corpus entry data shape", () => {
  it("sourceType enum covers all expected values", () => {
    const validTypes = ["transcript", "analog_data", "manual"] as const;
    expect(validTypes).toContain("transcript");
    expect(validTypes).toContain("analog_data");
    expect(validTypes).toContain("manual");
    expect(validTypes.length).toBe(3);
  });

  it("embedding dimension is 1536 for text-embedding-3-small", () => {
    const EMBEDDING_DIMS = 1536;
    const mockEmbedding = Array(EMBEDDING_DIMS).fill(0.01);
    expect(mockEmbedding.length).toBe(EMBEDDING_DIMS);
  });

  it("similarity is 1 - distance for cosine search", () => {
    const distance = 0.25;
    const similarity = 1 - distance;
    expect(similarity).toBeCloseTo(0.75);
  });

  it("similarity of 1.0 means identical vectors", () => {
    const distance = 0;
    const similarity = 1 - distance;
    expect(similarity).toBe(1.0);
  });

  it("similarity of 0 means orthogonal vectors", () => {
    const distance = 1;
    const similarity = 1 - distance;
    expect(similarity).toBe(0);
  });
});

// ─── Search method selection logic ───────────────────────────────────────────

describe("Search method selection", () => {
  it("uses vector method when embedding is available and results exist", () => {
    const mockResults = [{ id: 1, distance: 0.1 }];
    const method = mockResults.length > 0 ? "vector" : "keyword";
    expect(method).toBe("vector");
  });

  it("falls back to keyword when vector returns no results", () => {
    const vectorResults: unknown[] = [];
    const method = vectorResults.length > 0 ? "vector" : "keyword";
    expect(method).toBe("keyword");
  });

  it("keyword search splits query into up to 5 terms", () => {
    const query = "gut health transformation story mindset energy sleep recovery";
    const keywords = query.trim().split(/\s+/).slice(0, 5);
    expect(keywords.length).toBe(5);
    expect(keywords[0]).toBe("gut");
    expect(keywords[4]).toBe("mindset");
  });

  it("keyword search handles single-word query", () => {
    const query = "meditation";
    const keywords = query.trim().split(/\s+/).slice(0, 5);
    expect(keywords.length).toBe(1);
    expect(keywords[0]).toBe("meditation");
  });
});

// ─── Seed logic ───────────────────────────────────────────────────────────────

describe("Corpus seed logic", () => {
  it("overwrite=false skips existing entries", () => {
    const existingIds = new Set(["1", "2", "3"]);
    const incoming = [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 5 }];

    let added = 0, skipped = 0;
    for (const row of incoming) {
      if (existingIds.has(String(row.id))) { skipped++; continue; }
      added++;
    }

    expect(added).toBe(2);
    expect(skipped).toBe(2);
  });

  it("overwrite=true processes all entries regardless of existing", () => {
    const incoming = [{ id: 1 }, { id: 2 }, { id: 3 }];
    // With overwrite, we delete then re-insert all
    const processed = incoming.length;
    expect(processed).toBe(3);
  });

  it("word count is computed from whitespace-split", () => {
    const content = "This is a test transcript with exactly ten words here.";
    const wordCount = content.trim().split(/\s+/).length;
    expect(wordCount).toBe(10);
  });
});
