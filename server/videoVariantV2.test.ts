/**
 * Tests for Video Variant Factory v2 features:
 * 1. bulkSendToPendingApproval procedure structure
 * 2. handleSegmentProgress handler structure
 * 3. auto-retry backoff logic (unit test of the retry wrapper concept)
 */

import { describe, it, expect } from "vitest";
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

// ─── 2. handleSegmentProgress reads from SEG_PROGRESS_DIR ────────────────────
describe("handleSegmentProgress", () => {
  const SEG_PROGRESS_DIR = path.join(os.tmpdir(), "vvf-seg-progress");

  it("returns { done: 0, total: 0 } when no progress file exists", async () => {
    const { handleSegmentProgress } = await import("./videoUploadHandler");
    const uploadId = `test-nonexistent-${Date.now()}`;
    const req = { query: { uploadId } } as any;
    let responseData: any = null;
    const res = {
      status: () => res,
      json: (data: any) => { responseData = data; return res; },
    } as any;
    await handleSegmentProgress(req, res);
    expect(responseData).toEqual({ done: 0, total: 0 });
  });

  it("returns the progress data when a progress file exists", async () => {
    const { handleSegmentProgress } = await import("./videoUploadHandler");
    const uploadId = `test-progress-${Date.now()}`;
    const progressFile = path.join(SEG_PROGRESS_DIR, uploadId);
    fs.mkdirSync(SEG_PROGRESS_DIR, { recursive: true });
    fs.writeFileSync(progressFile, JSON.stringify({ done: 3, total: 7 }));

    const req = { query: { uploadId } } as any;
    let responseData: any = null;
    const res = {
      status: () => res,
      json: (data: any) => { responseData = data; return res; },
    } as any;
    await handleSegmentProgress(req, res);
    expect(responseData).toEqual({ done: 3, total: 7 });

    // Cleanup
    try { fs.unlinkSync(progressFile); } catch {}
  });

  it("returns 400 when uploadId is missing", async () => {
    const { handleSegmentProgress } = await import("./videoUploadHandler");
    const req = { query: {} } as any;
    let statusCode = 200;
    let responseData: any = null;
    const res = {
      status: (code: number) => { statusCode = code; return res; },
      json: (data: any) => { responseData = data; return res; },
    } as any;
    await handleSegmentProgress(req, res);
    expect(statusCode).toBe(400);
    expect(responseData?.error).toBeTruthy();
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
