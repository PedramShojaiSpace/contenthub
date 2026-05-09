/**
 * Tests for the browser-direct upload flow.
 *
 * New flow:
 *   1. Browser sends 4 MB chunks to Cloud Run → /api/upload/video-chunk
 *   2. Browser calls /finalize → server reassembles, returns { s3Key, uploadUrl, forgeApiKey }
 *   3. Browser uploads directly to forge storage proxy
 *   4. Browser calls /confirm → server writes CDN URL to DB
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

function mockReq(overrides: Record<string, any> = {}) {
  return {
    body: {},
    query: {},
    headers: {},
    ...overrides,
  } as any;
}

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

// ── Tests: finalize endpoint ──────────────────────────────────────────────────

describe("handleVideoChunkFinalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
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
    const req = mockReq({ body: { jobId: "1", totalChunks: "2" } });
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/uploadId/);
  });

  it("returns 400 if jobId is missing", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = mockReq({ body: { uploadId: "abc", totalChunks: "2" } });
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/jobId/);
  });

  it("returns 400 if totalChunks is missing", async () => {
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = mockReq({ body: { uploadId: "abc", jobId: "1" } });
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/totalChunks/);
  });

  it("returns 401 if user is not authenticated", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("Unauthorized"));
    const { handleVideoChunkFinalize } = await import("./videoUploadHandler");
    const req = mockReq({ body: { uploadId: "abc", jobId: "1", totalChunks: "1" } });
    const res = mockRes();
    await handleVideoChunkFinalize(req, res);
    expect(res._status).toBe(401);
  });
});

// ── Tests: confirm endpoint ───────────────────────────────────────────────────

describe("handleVideoChunkConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([{ id: 1, userId: "user-1" }]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
  });

  it("returns 400 if s3Key is missing", async () => {
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = mockReq({ body: { jobId: "1", s3Url: "https://cdn.example.com/clip.mp4" } });
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/s3Key/);
  });

  it("returns 400 if s3Url is missing", async () => {
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = mockReq({ body: { jobId: "1", s3Key: "video-clips/1/hook-1.mp4" } });
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/s3Url/);
  });

  it("returns 400 if jobId is missing", async () => {
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = mockReq({ body: { s3Key: "video-clips/1/hook-1.mp4", s3Url: "https://cdn.example.com/clip.mp4" } });
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/jobId/);
  });

  it("returns 401 if user is not authenticated", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("Unauthorized"));
    const { handleVideoChunkConfirm } = await import("./videoUploadHandler");
    const req = mockReq({ body: { jobId: "1", s3Key: "video-clips/1/hook-1.mp4", s3Url: "https://cdn.example.com/clip.mp4" } });
    const res = mockRes();
    await handleVideoChunkConfirm(req, res);
    expect(res._status).toBe(401);
  });
});

// ── Tests: chunk upload endpoint ──────────────────────────────────────────────

describe("handleVideoChunkUpload", () => {
  it("returns 400 if no chunk data is received", async () => {
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    const req = mockReq({
      body: Buffer.alloc(0),
      query: { uploadId: "abc", chunkIndex: "0" },
    });
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/No chunk data/);
  });

  it("returns 400 if uploadId is missing", async () => {
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    const req = mockReq({
      body: Buffer.from("test-data"),
      query: { chunkIndex: "0" },
    });
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(400);
    expect(res._json?.error).toMatch(/uploadId/);
  });

  it("returns 401 if user is not authenticated", async () => {
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("Unauthorized"));
    const { handleVideoChunkUpload } = await import("./videoUploadHandler");
    const req = mockReq({
      body: Buffer.from("test-data"),
      query: { uploadId: "abc", chunkIndex: "0" },
    });
    const res = mockRes();
    await handleVideoChunkUpload(req, res);
    expect(res._status).toBe(401);
  });
});
