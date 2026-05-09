/**
 * Tests for Video Variant Factory v2 features:
 * 1. bulkSendToPendingApproval procedure structure
 * 2. handleVideoChunkConfirm validates required fields
 * 3. auto-retry backoff logic (unit test of the retry wrapper concept)
 */

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// ─── 1. bulkSendToPendingApproval procedure exists in router ─────────────────
describe("videoVariantRouter.bulkSendToPendingApproval", () => {
  it("is exported from videoVariantRouter as a protectedProcedure mutation", async () => {
    const mod = await import("./videoVariantRouter");
    const router = mod.videoVariantRouter;
    expect(router).toBeDefined();
    // The router object has a _def.record with procedure keys
    const record = (router as any)._def?.record ?? {};
    expect(record).toHaveProperty("bulkSendToPendingApproval");
  });

  it("bulkSendToPendingApproval has a mutation type", async () => {
    const mod = await import("./videoVariantRouter");
    const router = mod.videoVariantRouter;
    const record = (router as any)._def?.record ?? {};
    const proc = record["bulkSendToPendingApproval"];
    expect(proc).toBeDefined();
    // tRPC procedure type is accessible via _def.type
    expect(proc._def?.type).toBe("mutation");
  });
});

// ─── 2. handleVideoChunkConfirm validates required fields ────────────────────
describe("handleVideoChunkConfirm", () => {
  it("is exported from videoUploadHandler", async () => {
    const mod = await import("./videoUploadHandler");
    expect(typeof mod.handleVideoChunkConfirm).toBe("function");
  });

  it("returns 400 when s3Url is missing", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValueOnce({ id: "user-1" } as any);
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = { body: { jobId: "1", s3Key: "video-clips/1/hook.mp4" }, headers: {} } as any;
    let statusCode = 200;
    let responseData: any = null;
    const res = {
      status: (code: number) => { statusCode = code; return res; },
      json: (data: any) => { responseData = data; return res; },
      headersSent: false,
    } as any;
    await handleVideoChunkConfirm(req, res);
    expect(statusCode).toBe(400);
    expect(responseData?.error).toMatch(/s3Url/);
  });

  it("returns 400 when s3Key is missing", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValueOnce({ id: "user-1" } as any);
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = { body: { jobId: "1", s3Url: "https://cdn.example.com/clip.mp4" }, headers: {} } as any;
    let statusCode = 200;
    let responseData: any = null;
    const res = {
      status: (code: number) => { statusCode = code; return res; },
      json: (data: any) => { responseData = data; return res; },
      headersSent: false,
    } as any;
    await handleVideoChunkConfirm(req, res);
    expect(statusCode).toBe(400);
    expect(responseData?.error).toMatch(/s3Key/);
  });

  it("returns 400 when jobId is missing", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValueOnce({ id: "user-1" } as any);
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = {
      body: { s3Key: "video-clips/1/hook.mp4", s3Url: "https://cdn.example.com/clip.mp4" },
      headers: {},
    } as any;
    let statusCode = 200;
    let responseData: any = null;
    const res = {
      status: (code: number) => { statusCode = code; return res; },
      json: (data: any) => { responseData = data; return res; },
      headersSent: false,
    } as any;
    await handleVideoChunkConfirm(req, res);
    expect(statusCode).toBe(400);
    expect(responseData?.error).toMatch(/jobId/);
  });
});

// ─── 3. Auto-retry backoff logic ─────────────────────────────────────────────
describe("auto-retry backoff logic", () => {
  it("retries a failing operation up to MAX_ATTEMPTS times", async () => {
    const MAX_ATTEMPTS = 2;
    let callCount = 0;

    const sendChunkOnce = async () => {
      callCount++;
      if (callCount < MAX_ATTEMPTS) throw new Error("transient error");
      // succeeds on final attempt
    };

    const sendChunk = async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await sendChunkOnce();
          return;
        } catch (err) {
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 1)); // tiny delay for test speed
          } else {
            throw err;
          }
        }
      }
    };

    await expect(sendChunk()).resolves.toBeUndefined();
    expect(callCount).toBe(MAX_ATTEMPTS);
  });

  it("surfaces the error after all attempts are exhausted", async () => {
    const MAX_ATTEMPTS = 2;
    let callCount = 0;

    const sendChunkOnce = async () => {
      callCount++;
      throw new Error("permanent error");
    };

    const sendChunk = async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await sendChunkOnce();
          return;
        } catch (err) {
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 1));
          } else {
            throw err;
          }
        }
      }
    };

    await expect(sendChunk()).rejects.toThrow("permanent error");
    expect(callCount).toBe(MAX_ATTEMPTS);
  });
});
