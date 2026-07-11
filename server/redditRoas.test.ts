/**
 * Tests for redditRoasRouter
 *
 * Covers:
 * 1. UTM URL building (buildUtmUrl helper via generateLink)
 * 2. ROAS calculation logic in getDashboard
 * 3. Deduplication in recordManualConversion
 * 4. processShopifyOrder — only processes reddit-attributed orders
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// ── Shared mock state ─────────────────────────────────────────────────────────

const mockCampaigns: any[] = [];
const mockLinks: any[] = [];
const mockConversions: any[] = [];
let nextId = 1;

// Minimal Drizzle-like mock that covers the query patterns in redditRoasRouter
function makeDb() {
  return {
    select: () => ({
      from: (table: any) => {
        const data =
          table === "reddit_campaigns" || (table && table[Symbol.for("drizzle:Name")] === "reddit_campaigns")
            ? mockCampaigns
            : table === "reddit_links" || (table && table[Symbol.for("drizzle:Name")] === "reddit_links")
            ? mockLinks
            : mockConversions;
        return {
          where: (_: any) => ({
            limit: (_n: number) => Promise.resolve(data.slice(0, _n)),
            orderBy: (_: any) => Promise.resolve(data),
            then: (r: any) => r(data),
          }),
          orderBy: (_: any) => ({
            where: (_: any) => Promise.resolve(data),
            then: (r: any) => r(data),
          }),
          then: (r: any) => r(data),
        };
      },
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        const id = nextId++;
        const row = { id, ...vals };
        if (table === "reddit_campaigns" || (table && table[Symbol.for("drizzle:Name")] === "reddit_campaigns")) {
          mockCampaigns.push(row);
        } else if (table === "reddit_links" || (table && table[Symbol.for("drizzle:Name")] === "reddit_links")) {
          mockLinks.push(row);
        } else {
          mockConversions.push(row);
        }
        return Promise.resolve([{ insertId: id }]);
      },
    }),
    update: (_table: any) => ({
      set: (_vals: any) => ({
        where: (_: any) => Promise.resolve(),
      }),
    }),
    delete: (_table: any) => ({
      where: (_: any) => Promise.resolve(),
    }),
    execute: (_: any) => Promise.resolve(),
  };
}

vi.mock("./db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

function createAuthContext(): Context {
  return {
    user: { id: 1, openId: "test", name: "Test Owner", role: "admin" },
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Context;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("redditRoasRouter — UTM URL building", () => {
  beforeEach(() => {
    mockCampaigns.length = 0;
    mockLinks.length = 0;
    mockConversions.length = 0;
    nextId = 1;
  });

  it("generateLink builds a valid UTM URL with utm_source=reddit", async () => {
    // Seed a campaign so the router can look it up
    mockCampaigns.push({
      id: 1,
      name: "Orobiome Test",
      utmCampaign: "orobiome-reddit-q3",
      monthlySpendCents: 200000,
      source: "va",
      active: true,
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.generateLink({
      campaignId: 1,
      destinationBase: "https://shop.theurbanmonk.com/products/orobiome",
      subreddit: "r/guthealth",
      postType: "question",
      utmContent: "guthealth-post-001",
    });

    expect(result.destinationUrl).toContain("utm_source=reddit");
    expect(result.destinationUrl).toContain("utm_campaign=orobiome-reddit-q3");
    expect(result.destinationUrl).toContain("utm_content=guthealth-post-001");
    expect(result.utmContent).toBe("guthealth-post-001");
  });

  it("generateLink auto-generates utmContent from subreddit + timestamp when not provided", async () => {
    mockCampaigns.push({
      id: 1,
      name: "KBMO Test",
      utmCampaign: "kbmo-reddit-q3",
      monthlySpendCents: 100000,
      source: "redrover",
      active: true,
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.generateLink({
      campaignId: 1,
      destinationBase: "https://shop.theurbanmonk.com/products/kbmo",
      subreddit: "r/foodsensitivities",
      postType: "comment",
    });

    expect(result.utmContent).toMatch(/^foodsensitivities-\d+$/);
    expect(result.destinationUrl).toContain("utm_medium=organic");
  });
});

describe("redditRoasRouter — ROAS calculation", () => {
  beforeEach(() => {
    mockCampaigns.length = 0;
    mockLinks.length = 0;
    mockConversions.length = 0;
    nextId = 1;
  });

  it("getDashboard returns null ROAS when no spend is set", async () => {
    mockCampaigns.push({
      id: 1, name: "Test", utmCampaign: "test", monthlySpendCents: 0, source: "va", active: true, createdAt: Date.now(),
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.getDashboard({});

    expect(result.campaignStats[0].roas).toBeNull();
    expect(result.overallRoas).toBeNull();
  });

  it("getDashboard calculates ROAS correctly with spend and revenue", async () => {
    mockCampaigns.push({
      id: 1, name: "Orobiome", utmCampaign: "orobiome-q3", monthlySpendCents: 100000, // $1,000
      source: "redrover", active: true, createdAt: Date.now(),
    });
    mockLinks.push({
      id: 1, campaignId: 1, subreddit: "r/guthealth", revenueAttributedCents: 399000,
      conversionCount: 1, destinationUrl: "https://example.com", utmCampaign: "orobiome-q3",
      utmSource: "reddit", utmMedium: "organic", postType: "question", createdAt: Date.now(),
    });
    mockConversions.push({
      id: 1, campaignId: 1, linkId: 1, shopifyOrderId: "ORD-001",
      orderTotalCents: 399000, currency: "USD", attributionType: "utm",
      orderCreatedAt: Date.now(), receivedAt: Date.now(),
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.getDashboard({});

    // ROAS = $3,990 revenue / $1,000 spend = 3.99
    expect(result.campaignStats[0].roas).toBeCloseTo(3.99, 1);
    expect(result.totalRevenueCents).toBe(399000);
    expect(result.totalConversions).toBe(1);
  });

  it("getDashboard aggregates revenue across multiple campaigns", async () => {
    mockCampaigns.push(
      { id: 1, name: "C1", utmCampaign: "c1", monthlySpendCents: 50000, source: "va", active: true, createdAt: Date.now() },
      { id: 2, name: "C2", utmCampaign: "c2", monthlySpendCents: 50000, source: "redrover", active: true, createdAt: Date.now() },
    );
    mockConversions.push(
      { id: 1, campaignId: 1, linkId: 1, shopifyOrderId: "O1", orderTotalCents: 39900, currency: "USD", attributionType: "utm", orderCreatedAt: Date.now(), receivedAt: Date.now() },
      { id: 2, campaignId: 2, linkId: 2, shopifyOrderId: "O2", orderTotalCents: 39900, currency: "USD", attributionType: "utm", orderCreatedAt: Date.now(), receivedAt: Date.now() },
    );

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.getDashboard({});

    expect(result.totalRevenueCents).toBe(79800);
    expect(result.totalConversions).toBe(2);
    // Overall ROAS = $798 / $1,000 = 0.798
    expect(result.overallRoas).toBeCloseTo(0.798, 2);
  });
});

describe("redditRoasRouter — deduplication", () => {
  beforeEach(() => {
    mockCampaigns.length = 0;
    mockLinks.length = 0;
    mockConversions.length = 0;
    nextId = 1;
  });

  it("recordManualConversion returns duplicate status for the same shopifyOrderId", async () => {
    // Pre-seed an existing conversion
    mockConversions.push({
      id: 1, shopifyOrderId: "DUP-001", campaignId: 1, linkId: 1,
      orderTotalCents: 39900, currency: "USD", attributionType: "manual",
      orderCreatedAt: Date.now(), receivedAt: Date.now(),
    });
    mockLinks.push({
      id: 1, campaignId: 1, revenueAttributedCents: 39900, conversionCount: 1,
      destinationUrl: "https://example.com", utmCampaign: "test", utmSource: "reddit",
      utmMedium: "organic", postType: "question", createdAt: Date.now(),
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.recordManualConversion({
      linkId: 1,
      campaignId: 1,
      shopifyOrderId: "DUP-001",
      orderTotalCents: 39900,
    });

    expect(result.status).toBe("duplicate");
  });
});

describe("redditRoasRouter — Shopify webhook", () => {
  beforeEach(() => {
    mockCampaigns.length = 0;
    mockLinks.length = 0;
    mockConversions.length = 0;
    nextId = 1;
  });

  it("processShopifyOrder ignores orders not attributed to reddit", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.redditRoas.processShopifyOrder({
      shopifyOrderId: "NON-REDDIT-001",
      orderTotalCents: 39900,
      utmSource: "facebook",
      utmCampaign: "fb-orobiome",
    });

    expect(result.status).toBe("not_reddit");
    expect(mockConversions).toHaveLength(0);
  });
});
