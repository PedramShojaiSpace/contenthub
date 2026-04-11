/**
 * llmProjectsRouter tests
 *
 * Tests the core CRUD operations and weekly cadence query for LLM Projects.
 * Uses the same test-caller pattern as auth.logout.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mock the database ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// ─── Mock the LLM so generateQueue doesn't call the real API ─────────────────
// Note: vi.mock is hoisted to the top of the file by Vitest, so we must inline
// the mock response directly (no references to variables defined outside the factory)
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            assets: [
              {
                assetType: "faq",
                title: "What causes poor sleep?",
                question: "What causes poor sleep?",
                targetKeyword: "causes of poor sleep",
                semanticKeywords: ["sleep disorders", "insomnia causes"],
                priority: "high",
                notes: "Target PubMed-backed answer",
              },
              {
                assetType: "blog",
                title: "The Sleep Reset Protocol",
                question: null,
                targetKeyword: "sleep reset protocol",
                semanticKeywords: ["sleep optimization", "circadian rhythm"],
                priority: "medium",
                notes: "Named framework article",
              },
            ],
          }),
        },
      },
    ],
  }),
}));

import { getDb } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeDb(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    $returningId: vi.fn().mockResolvedValue([{ id: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("llmProjectsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listProjects", () => {
    it("returns empty array when no projects exist", async () => {
      const db = makeDb({
        limit: vi.fn().mockResolvedValue([]),
      });
      // select().from().orderBy() resolves to []
      db.orderBy = vi.fn().mockResolvedValue([]);
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.listProjects();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("attaches totalAssets and producedAssets to each project", async () => {
      const fakeProject = {
        id: 1,
        name: "Sleep Authority",
        description: null,
        topicCluster: "sleep",
        status: "active",
        weeklyTarget: 3,
        createdAt: new Date(),
        targetKeywords: null,
      };

      const assetCounts = [
        { status: "queued", count: 5 },
        { status: "produced", count: 3 },
        { status: "published", count: 2 },
      ];

      let callCount = 0;
      (getDb as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        const db = makeDb();
        if (callCount === 1) {
          // First call: listProjects
          db.orderBy = vi.fn().mockResolvedValue([fakeProject]);
        } else {
          // Subsequent calls: asset counts
          db.groupBy = vi.fn().mockResolvedValue(assetCounts);
        }
        return db;
      });

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.listProjects();

      expect(result).toHaveLength(1);
      expect(result[0].totalAssets).toBe(10); // 5 + 3 + 2
      expect(result[0].producedAssets).toBe(5); // 3 + 2
    });
  });

  describe("createProject", () => {
    it("inserts a new project and returns its id", async () => {
      const db = makeDb();
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.createProject({
        name: "Gut Health Authority",
        topicCluster: "gut health, microbiome",
        weeklyTarget: 4,
      });

      expect(result).toHaveProperty("id");
      expect(db.insert).toHaveBeenCalled();
    });

    it("stores targetKeywords as JSON string", async () => {
      const db = makeDb();
      let insertedValues: Record<string, unknown> = {};
      db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        insertedValues = vals;
        return { $returningId: vi.fn().mockResolvedValue([{ id: 2 }]) };
      });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      await caller.createProject({
        name: "Sleep Project",
        targetKeywords: ["sleep hygiene", "circadian rhythm"],
        weeklyTarget: 3,
      });

      expect(typeof insertedValues.targetKeywords).toBe("string");
      const parsed = JSON.parse(insertedValues.targetKeywords as string);
      expect(parsed).toContain("sleep hygiene");
    });
  });

  describe("deleteProject", () => {
    it("deletes assets then the project", async () => {
      const db = makeDb();
      const deleteSpy = vi.fn().mockReturnThis();
      db.delete = deleteSpy;
      db.where = vi.fn().mockResolvedValue({ rowsAffected: 1 });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.deleteProject({ id: 1 });

      expect(result).toEqual({ success: true });
      // delete should be called twice: once for assets, once for the project
      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("addAsset", () => {
    it("inserts an asset with queued status", async () => {
      const db = makeDb();
      let insertedValues: Record<string, unknown> = {};
      db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        insertedValues = vals;
        return { $returningId: vi.fn().mockResolvedValue([{ id: 10 }]) };
      });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.addAsset({
        projectId: 1,
        assetType: "faq",
        title: "How to fix your sleep",
        targetKeyword: "fix sleep",
        priority: "high",
      });

      expect(result).toHaveProperty("id");
      expect(insertedValues.status).toBe("queued");
    });
  });

  describe("updateAssetStatus", () => {
    it("sets producedAt when status changes to produced", async () => {
      const db = makeDb();
      let updatedValues: Record<string, unknown> = {};
      db.set = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        updatedValues = vals;
        return { where: vi.fn().mockResolvedValue({ rowsAffected: 1 }) };
      });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      await caller.updateAssetStatus({ id: 5, status: "produced" });

      expect(updatedValues.status).toBe("produced");
      expect(updatedValues.producedAt).toBeInstanceOf(Date);
    });

    it("sets publishedAt when status changes to published", async () => {
      const db = makeDb();
      let updatedValues: Record<string, unknown> = {};
      db.set = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        updatedValues = vals;
        return { where: vi.fn().mockResolvedValue({ rowsAffected: 1 }) };
      });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      await caller.updateAssetStatus({ id: 5, status: "published" });

      expect(updatedValues.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe("getWeeklyCadence", () => {
    it("returns null when project does not exist", async () => {
      const db = makeDb({ limit: vi.fn().mockResolvedValue([]) });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.getWeeklyCadence({ projectId: 999 });
      expect(result).toBeNull();
    });

    it("returns cadence stats for an existing project", async () => {
      const fakeProject = {
        id: 1,
        name: "Sleep",
        weeklyTarget: 3,
        status: "active",
      };

      let callCount = 0;
      (getDb as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        const db = makeDb();
        if (callCount === 1) {
          db.limit = vi.fn().mockResolvedValue([fakeProject]);
        } else if (callCount === 2) {
          // thisWeek count
          db.where = vi.fn().mockResolvedValue([{ count: 2 }]);
        } else {
          // queued count
          db.where = vi.fn().mockResolvedValue([{ count: 6 }]);
        }
        return db;
      });

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.getWeeklyCadence({ projectId: 1 });

      expect(result).not.toBeNull();
      expect(result!.weeklyTarget).toBe(3);
      expect(result!.producedThisWeek).toBe(2);
      expect(result!.remainingInQueue).toBe(6);
      expect(result!.weeksToComplete).toBe(2); // ceil(6/3)
    });
  });

  describe("generateQueue", () => {
    it("calls invokeLLM and returns generated count", async () => {
      const db = makeDb();
      const insertSpy = vi.fn().mockReturnThis();
      db.insert = insertSpy;
      db.values = vi.fn().mockResolvedValue({ rowsAffected: 2 });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      // Import the llm module and spy on invokeLLM directly
      const llmModule = await import("./_core/llm");
      const invokeSpy = vi.spyOn(llmModule, "invokeLLM").mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assets: [
                  {
                    assetType: "faq",
                    title: "What causes poor sleep?",
                    question: "What causes poor sleep?",
                    targetKeyword: "causes of poor sleep",
                    semanticKeywords: ["sleep disorders"],
                    priority: "high",
                    notes: "PubMed-backed",
                  },
                  {
                    assetType: "blog",
                    title: "The Sleep Reset Protocol",
                    question: null,
                    targetKeyword: "sleep reset",
                    semanticKeywords: ["sleep optimization"],
                    priority: "medium",
                    notes: "Named framework",
                  },
                ],
              }),
            },
          },
        ],
      } as any);

      const { llmProjectsRouter } = await import("./llmProjectsRouter");
      const caller = llmProjectsRouter.createCaller({ user: { id: "test", name: "Test" } } as any);
      const result = await caller.generateQueue({
        projectId: 1,
        topicCluster: "sleep optimization",
        assetTypes: ["faq", "blog"],
        count: 5,
      });

      expect(invokeSpy).toHaveBeenCalled();
      expect(result.generated).toBe(2);
      expect(insertSpy).toHaveBeenCalled();
    });
  });
});
