import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverEntry = readFileSync(path.resolve(process.cwd(), "server/_core/index.ts"), "utf-8");

describe("intentional public HTTP surface", () => {
  it("keeps public funnel and first-party checkout handoff routes mounted", () => {
    expect(serverEntry).toContain('app.get("/interconnected", async (_req, res) =>');
    expect(serverEntry).toContain('app.get("/r/checkout", async (req, res) =>');
    expect(serverEntry).toContain('app.get("/r/ic67", (req, res) =>');
    expect(serverEntry).toContain('app.get("/bridge/:slug", async (req, res) =>');
  });

  it("keeps representative inbound webhook routes behind their required integrity controls", () => {
    expect(serverEntry).toContain('app.post("/api/shopify/order-paid", express.raw({ type: "application/json" })');
    expect(serverEntry).toContain('app.post("/api/ingest/research-report", handleIngestResearchReport)');
    expect(serverEntry).toContain('if (secret !== process.env.INGEST_SECRET)');
    expect(serverEntry).toContain('app.post("/api/kajabi/purchase", async (req, res) =>');
  });

  it("keeps representative operator management routes authenticated", () => {
    const stitchStart = serverEntry.indexOf('app.post("/api/stitch-job/:jobId"');
    const stitchSection = serverEntry.slice(stitchStart, stitchStart + 900);
    expect(stitchStart).toBeGreaterThan(-1);
    expect(stitchSection).toContain("await sdk.authenticateRequest(req)");

    const driveStatusStart = serverEntry.indexOf('app.get("/api/drive/status"');
    const driveStatusSection = serverEntry.slice(driveStatusStart, driveStatusStart + 500);
    expect(driveStatusStart).toBeGreaterThan(-1);
    expect(driveStatusSection).toContain("await sdk.authenticateRequest(req)");
  });
});
