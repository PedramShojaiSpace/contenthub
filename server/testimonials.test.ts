/**
 * Tests for the Testimonials router — specifically the list procedure
 * and the seedLightsOn procedure (seeding from the built-in LO dataset).
 *
 * These tests run against an in-memory mock DB to avoid real DB connections.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock the DB layer ─────────────────────────────────────────────────────────
// We mock server/db.ts so the router never touches a real database.
const mockTestimonials: any[] = [];

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve(mockTestimonials),
        where: () => Promise.resolve(mockTestimonials),
      }),
    }),
    insert: () => ({
      values: (row: any) => {
        mockTestimonials.push({ id: mockTestimonials.length + 1, ...row });
        return Promise.resolve([{ insertId: mockTestimonials.length }]);
      },
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  })),
}));

// ── Helper: create a minimal authenticated context ────────────────────────────
function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("testimonialsRouter", () => {
  beforeEach(() => {
    mockTestimonials.length = 0; // reset between tests
  });

  it("list returns an empty array when no testimonials exist", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.testimonials.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("seedLightsOn inserts 21 testimonials and returns the correct count", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.testimonials.seedLightsOn();
    // The seed data has 21 entries
    expect(result.seeded).toBe(21);
    expect(mockTestimonials.length).toBe(21);
  });

  it("seedLightsOn is idempotent — skips if testimonials already exist", async () => {
    // Pre-populate with a fake LO testimonial
    mockTestimonials.push({ id: 1, campaign: "lo", quote: "test", authorName: "Test" });
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.testimonials.seedLightsOn();
    // Should report 0 seeded (already have data)
    expect(result.seeded).toBe(0);
    // Should not have added more rows
    expect(mockTestimonials.length).toBe(1);
  });
});
