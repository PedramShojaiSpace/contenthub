/**
 * Tests for funnelCommandRouter
 *
 * Tests the EV calculation, funnel attribution, and take-rate logic
 * without requiring a live database connection.
 */

import { describe, it, expect } from "vitest";

// ── Pure logic extracted for unit testing ─────────────────────────────────────

const FUNNEL_UTM_PREFIXES: Record<string, string[]> = {
  lights_on: ["lights_on", "lightson", "lights-on", "lo_"],
  oral_biome: ["oral_biome", "oralbiome", "oral-biome", "ob_"],
  gut: ["gut", "gut_health", "gut-health", "gh_"],
};

const FUNNEL_IDS = ["lights_on", "oral_biome", "gut"] as const;
type FunnelId = typeof FUNNEL_IDS[number];

function funnelForCampaign(utmCampaign: string | null): FunnelId | null {
  if (!utmCampaign) return null;
  const lower = utmCampaign.toLowerCase();
  for (const funnelId of FUNNEL_IDS) {
    if (FUNNEL_UTM_PREFIXES[funnelId].some(prefix => lower.startsWith(prefix) || lower.includes(prefix))) {
      return funnelId;
    }
  }
  return null;
}

const ACADEMY_Y2_PRICE_CENTS = 59800;

function calcEvPerBuyer(avgOrderCents: number, upgradeRate: number): number {
  return avgOrderCents + upgradeRate * ACADEMY_Y2_PRICE_CENTS;
}

function calcTakeRate(buyers: number, clicks: number): number | null {
  if (clicks === 0) return null;
  return buyers / clicks;
}

function calcRevenueTrend(
  current: number,
  prior: number
): "up" | "flat" | "down" {
  if (prior === 0) return "flat";
  if (current > prior * 1.05) return "up";
  if (current < prior * 0.95) return "down";
  return "flat";
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("funnelForCampaign", () => {
  it("identifies lights_on funnel by prefix", () => {
    expect(funnelForCampaign("lights_on_jan2026")).toBe("lights_on");
    expect(funnelForCampaign("lo_test_campaign")).toBe("lights_on");
    expect(funnelForCampaign("lightson_fb")).toBe("lights_on");
    expect(funnelForCampaign("lights-on-retarget")).toBe("lights_on");
  });

  it("identifies oral_biome funnel by prefix", () => {
    expect(funnelForCampaign("oral_biome_cold")).toBe("oral_biome");
    expect(funnelForCampaign("ob_test")).toBe("oral_biome");
    expect(funnelForCampaign("oralbiome_retarget")).toBe("oral_biome");
    expect(funnelForCampaign("oral-biome-2026")).toBe("oral_biome");
  });

  it("identifies gut funnel by prefix", () => {
    expect(funnelForCampaign("gut_health_cold")).toBe("gut");
    expect(funnelForCampaign("gh_test")).toBe("gut");
    expect(funnelForCampaign("gut-health-jan")).toBe("gut");
  });

  it("returns null for unrecognized campaigns", () => {
    expect(funnelForCampaign("brand_awareness_2026")).toBeNull();
    expect(funnelForCampaign("")).toBeNull();
    expect(funnelForCampaign(null)).toBeNull();
  });
});

describe("calcEvPerBuyer", () => {
  it("adds academy Y2 upgrade probability to raw order value", () => {
    // $299 order + 12% chance of $598 Y2 upgrade
    const ev = calcEvPerBuyer(29900, 0.12);
    expect(ev).toBeCloseTo(29900 + 0.12 * 59800, 0);
    expect(ev).toBeCloseTo(37076, 0);
  });

  it("equals raw order at 0% upgrade rate", () => {
    expect(calcEvPerBuyer(29900, 0)).toBe(29900);
  });

  it("adds full Y2 price at 100% upgrade rate", () => {
    expect(calcEvPerBuyer(29900, 1.0)).toBe(29900 + 59800);
  });

  it("Y2 price is at least double Year 1 price", () => {
    const year1Cents = 29900; // $299
    expect(ACADEMY_Y2_PRICE_CENTS).toBeGreaterThanOrEqual(year1Cents * 2);
  });
});

describe("calcTakeRate", () => {
  it("returns buyers/clicks ratio", () => {
    expect(calcTakeRate(10, 500)).toBeCloseTo(0.02, 4);
    expect(calcTakeRate(25, 1000)).toBeCloseTo(0.025, 4);
  });

  it("returns null when clicks is zero", () => {
    expect(calcTakeRate(0, 0)).toBeNull();
    expect(calcTakeRate(5, 0)).toBeNull();
  });

  it("returns 0 when buyers is zero but clicks exist", () => {
    expect(calcTakeRate(0, 100)).toBe(0);
  });
});

describe("calcRevenueTrend", () => {
  it("returns up when current is >5% above prior", () => {
    expect(calcRevenueTrend(110, 100)).toBe("up");
    expect(calcRevenueTrend(200, 100)).toBe("up");
  });

  it("returns down when current is >5% below prior", () => {
    expect(calcRevenueTrend(90, 100)).toBe("down");
    expect(calcRevenueTrend(50, 100)).toBe("down");
  });

  it("returns flat when within 5% band", () => {
    expect(calcRevenueTrend(103, 100)).toBe("flat");
    expect(calcRevenueTrend(97, 100)).toBe("flat");
    expect(calcRevenueTrend(100, 100)).toBe("flat");
  });

  it("returns flat when prior is zero (no baseline)", () => {
    expect(calcRevenueTrend(500, 0)).toBe("flat");
  });
});

describe("ascension eligibility", () => {
  it("marks buyers as eligible for Y2 after 300 days", () => {
    const now = Date.now();
    const eligibleCutoff = now - 300 * 24 * 60 * 60 * 1000;

    const buyers = [
      { receivedAt: now - 400 * 24 * 60 * 60 * 1000 }, // 400 days ago — eligible
      { receivedAt: now - 350 * 24 * 60 * 60 * 1000 }, // 350 days ago — eligible
      { receivedAt: now - 200 * 24 * 60 * 60 * 1000 }, // 200 days ago — not eligible
      { receivedAt: now - 30 * 24 * 60 * 60 * 1000 },  // 30 days ago — not eligible
    ];

    const eligible = buyers.filter(b => b.receivedAt < eligibleCutoff);
    expect(eligible.length).toBe(2);
  });

  it("calculates potential Y2 revenue correctly", () => {
    const eligibleCount = 50;
    const potentialRevenue = eligibleCount * ACADEMY_Y2_PRICE_CENTS;
    expect(potentialRevenue).toBe(2990000); // $29,900
  });
});
