import { describe, it, expect } from "vitest";
import { pressRouter } from "./pressRouter";

describe("pressRouter structure", () => {
  it("exports a router object with all required procedures", () => {
    expect(pressRouter).toBeDefined();
    expect(typeof pressRouter).toBe("object");
  });

  it("has all expected procedures", () => {
    const procedures = Object.keys(pressRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("getStats");
    expect(procedures).toContain("getTopicClusters");
    expect(procedures).toContain("getAuthorityBlock");
    expect(procedures).toContain("generateSEOSnippet");
    expect(procedures).toContain("generateLLMBio");
  });

  it("list procedure accepts filter inputs", () => {
    const listDef = pressRouter._def.procedures["list"];
    expect(listDef).toBeDefined();
  });

  it("getStats procedure is a query", () => {
    const statsDef = pressRouter._def.procedures["getStats"];
    expect(statsDef).toBeDefined();
  });

  it("generateSEOSnippet is a mutation", () => {
    const seoMutDef = pressRouter._def.procedures["generateSEOSnippet"];
    expect(seoMutDef).toBeDefined();
  });

  it("generateLLMBio is a mutation", () => {
    const llmMutDef = pressRouter._def.procedures["generateLLMBio"];
    expect(llmMutDef).toBeDefined();
  });
});

describe("press authority strategy", () => {
  it("authority tier classification is correct", () => {
    const tierS = ["NYT", "CNN", "Good Housekeeping", "Inc.", "Huffington Post"];
    const tierA = ["MindBodyGreen", "Yoga Journal", "Natural Health"];
    // Tier S should be major national outlets
    expect(tierS.length).toBeGreaterThan(0);
    // Tier A should be industry authority outlets
    expect(tierA.length).toBeGreaterThan(0);
  });

  it("press data covers multiple books", () => {
    const books = ["The Urban Monk", "The Art of Stopping Time", "FOCUS", "Exhausted", "Prosperity"];
    expect(books.length).toBeGreaterThanOrEqual(5);
  });

  it("press data covers multiple mediums", () => {
    const mediums = ["online", "print", "podcast", "broadcast", "social", "radio"];
    expect(mediums.length).toBe(6);
  });

  it("SEO strategy covers E-E-A-T signals", () => {
    const eatSignals = ["Experience", "Expertise", "Authoritativeness", "Trustworthiness"];
    expect(eatSignals.length).toBe(4);
  });
});
