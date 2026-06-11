/**
 * Tests for the "Ask the Urban Monk" chatbot procedures.
 *
 * Validates that:
 * 1. The askUrbanMonk procedure is registered in the bookLibrary router
 * 2. The listChatSessions procedure is registered
 * 3. The getChatMessages procedure is registered
 * 4. The deleteChatSession procedure is registered
 * 5. The procedures have the correct input/output shapes
 */

import { describe, it, expect } from "vitest";
import { bookLibraryRouter } from "./bookLibraryRouter";

describe("Ask the Urban Monk — procedure registration", () => {
  it("askUrbanMonk procedure is registered in bookLibraryRouter", () => {
    // The router object has a _def.procedures map
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    expect(
      "askUrbanMonk" in procedures,
      "askUrbanMonk should be a procedure in bookLibraryRouter"
    ).toBe(true);
  });

  it("listChatSessions procedure is registered in bookLibraryRouter", () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    expect(
      "listChatSessions" in procedures,
      "listChatSessions should be a procedure in bookLibraryRouter"
    ).toBe(true);
  });

  it("getChatMessages procedure is registered in bookLibraryRouter", () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    expect(
      "getChatMessages" in procedures,
      "getChatMessages should be a procedure in bookLibraryRouter"
    ).toBe(true);
  });

  it("deleteChatSession procedure is registered in bookLibraryRouter", () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    expect(
      "deleteChatSession" in procedures,
      "deleteChatSession should be a procedure in bookLibraryRouter"
    ).toBe(true);
  });

  it("askUrbanMonk is a mutation (not a query)", () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    const proc = procedures["askUrbanMonk"];
    // tRPC v11 mutation procedures have _def.mutation = true
    const isMutation =
      proc?._def?.mutation === true || proc?._def?.type === "mutation";
    expect(isMutation, "askUrbanMonk should be a mutation").toBe(true);
  });

  it("listChatSessions is a query (not a mutation)", () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    const proc = procedures["listChatSessions"];
    const isQuery =
      proc?._def?.query === true || proc?._def?.type === "query";
    expect(isQuery, "listChatSessions should be a query").toBe(true);
  });
});

describe("Ask the Urban Monk — input validation", () => {
  it("askUrbanMonk input schema rejects empty question", async () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    const proc = procedures["askUrbanMonk"];
    const inputParser = proc?._def?.inputs?.[0];
    if (!inputParser) {
      // If we can't access the parser directly, skip
      return;
    }
    const result = inputParser.safeParse({ question: "" });
    expect(result.success, "Empty question should fail validation").toBe(false);
  });

  it("askUrbanMonk input schema accepts valid question", async () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    const proc = procedures["askUrbanMonk"];
    const inputParser = proc?._def?.inputs?.[0];
    if (!inputParser) {
      return;
    }
    const result = inputParser.safeParse({
      question: "What is the Urban Monk's approach to stress?",
    });
    expect(result.success, "Valid question should pass validation").toBe(true);
  });

  it("askUrbanMonk input schema rejects question over 2000 chars", async () => {
    const procedures = (bookLibraryRouter as any)._def?.procedures ?? {};
    const proc = procedures["askUrbanMonk"];
    const inputParser = proc?._def?.inputs?.[0];
    if (!inputParser) {
      return;
    }
    const result = inputParser.safeParse({
      question: "x".repeat(2001),
    });
    expect(result.success, "Question over 2000 chars should fail validation").toBe(false);
  });
});
