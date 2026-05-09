/**
 * Tests for the stateless video upload handler.
 *
 * ARCHITECTURE: Each chunk is uploaded to forge storage immediately on receipt.
 * Finalize downloads all chunks from forge and concatenates them.
 * This eliminates the "Missing chunk X" bug caused by Cloud Run multi-instance
 * deployments where /tmp is not shared between instances.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  videoClips: "videoClips",
  videoVariantJobs: "videoVariantJobs",
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => args),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockResolvedValue({ id: "user-1" }),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.manus.ai",
    forgeApiKey: "test-server-key",
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRes() {
  const res: any = {
    _status: 200,
    _json: null,
    status(code: number) { this._status = code; return this; },
    json(data: any) { this._json = data; return this; },
    headersSent: false,
  };
  return res;
}

// ── Tests: chunk upload endpoint ──────────────────────────────────────────────

describe("handleVideoChunkUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 if no chunk data is received", async () => {
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    const req = { body: Buffer.alloc(0), query: { uploadId: "abc", chunkIndex: "0" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/No chunk data/);
  });

  it("returns 400 if uploadId is missing", async () => {
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    const req = { body: Buffer.from("test-data"), query: { chunkIndex: "0" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/uploadId/);
  });

  it("returns 401 if user is not authenticated", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("Unauthorized"));
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    const req = { body: Buffer.from("test-data"), query: { uploadId: "abc", chunkIndex: "0" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(401);
  });
});

// ── Tests: finalize endpoint ──────────────────────────────────────────────────

describe("handleVideoChunkFinalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([{ id: 1, userId: "user-1" }]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue([{ insertId: 42 }]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
  });

  it("returns 400 if uploadId is missing", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = { body: { jobId: "1", totalChunks: "2" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/uploadId/);
  });

  it("returns 400 if jobId is missing", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = { body: { uploadId: "abc", totalChunks: "2" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/jobId/);
  });

  it("returns 400 if totalChunks is missing", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = { body: { uploadId: "abc", jobId: "1" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/totalChunks/);
  });

  it("returns 400 if chunkUrls length does not match totalChunks", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = {
      body: {
        uploadId: "abc",
        jobId: "1",
        totalChunks: "3",
        chunkUrls: ["url0", "url1"], // only 2, expected 3
      },
      headers: {},
    } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/chunkUrls length mismatch/);
  });

  it("returns 400 if a chunkUrl is empty string", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = {
      body: {
        uploadId: "abc",
        jobId: "1",
        totalChunks: "2",
        chunkUrls: ["https://cdn.example.com/chunk-0", ""], // chunk 1 is empty
      },
      headers: {},
    } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/Missing chunk 1/);
  });

  it("returns 401 if user is not authenticated", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("Unauthorized"));
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = { body: { uploadId: "abc", jobId: "1", totalChunks: "1" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(401);
  });

  it("returns 404 if job does not belong to user", async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = { body: { uploadId: "abc", jobId: "999", totalChunks: "1" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(404);
    expect(res._json?.error).toMatch(/Job not found/);
  });
});

// ── Tests: confirm endpoint (backward compat) ─────────────────────────────────

describe("handleVideoChunkConfirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is exported from videoUploadHandler", async () => {
    const mod = await import("./videoUploadHandler");
    expect(typeof mod.handleVideoChunkConfirm).toBe("function");
  });

  it("returns 400 when s3Url is missing", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockResolvedValueOnce({ id: "user-1" } as any);
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = { body: { jobId: "1", s3Key: "video-clips/1/hook.mp4" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/s3Url/);
  });

  it("returns 400 when s3Key is missing", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockResolvedValueOnce({ id: "user-1" } as any);
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = { body: { jobId: "1", s3Url: "https://cdn.example.com/clip.mp4" }, headers: {} } as any;
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/s3Key/);
  });

  it("returns 400 when jobId is missing", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockResolvedValueOnce({ id: "user-1" } as any);
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = {
      body: { s3Key: "video-clips/1/hook.mp4", s3Url: "https://cdn.example.com/clip.mp4" },
      headers: {},
    } as any;
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/jobId/);
  });

  it("returns 401 if user is not authenticated", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("Unauthorized"));
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = {
      body: { jobId: "1", s3Key: "video-clips/1/hook.mp4", s3Url: "https://cdn.example.com/clip.mp4" },
      headers: {},
    } as any;
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(401);
  });
});

// ── Tests: stateless architecture invariants ──────────────────────────────────

describe("stateless chunk architecture", () => {
  it("videoUploadHandler exports all required handlers", async () => {
    const mod = await import("./videoUploadHandler");
    expect(typeof mod.handleVideoChunkUpload).toBe("function");
    expect(typeof mod.handleVideoChunkFinalize).toBe("function");
    expect(typeof mod.handleVideoChunkConfirm).toBe("function");
    expect(mod.videoChunkMiddleware).toBeDefined();
    expect(mod.videoUploadMiddleware).toBeDefined();
  });

  it("chunk upload returns 400 for non-Buffer body (JSON body parser ran first)", async () => {
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    // Simulate what happens when express.json() runs before express.raw()
    // and parses the body as an object instead of a Buffer
    const req = {
      body: { parsed: "by json" }, // object, not Buffer
      query: { uploadId: "abc", chunkIndex: "0" },
      headers: {},
    } as any;
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/No chunk data/);
  });
});
