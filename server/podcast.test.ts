/**
 * podcast.test.ts
 *
 * Unit tests for the podcastRouter procedures.
 * Uses router createCaller with a mock DB and LLM so no real I/O occurs.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ─── Shared mock episode ──────────────────────────────────────────────────────

const mockEpisode = {
  id: 1,
  userId: 1,
  guestName: "Dr. Mark Hyman",
  guestRole: "Author",
  guestCompany: "Cleveland Clinic",
  whyNow: "New book launch",
  backgroundUrls: "https://example.com",
  backgroundText: "Some bio text",
  episodeLengthMin: 45,
  showName: "The Urban Monk Podcast",
  showDescription: null,
  audienceDescription: null,
  reportMarkdown: null,
  sectionDossier: null,
  sectionBigPain: null,
  sectionThroughLine: null,
  sectionOutline: null,
  sectionQuestionBank: null,
  sectionSoundbites: null,
  status: "pending" as const,
  errorMessage: null,
  episodeNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Build a fully-chained mock DB ───────────────────────────────────────────

/**
 * Creates a mock DB object that supports the Drizzle ORM chaining patterns
 * used in podcastRouter:
 *   db.select().from().where()
 *   db.select().from().where().orderBy()
 *   db.insert().values()
 *   db.update().set().where()
 *   db.delete().where()
 */
function buildMockDb(episodes: typeof mockEpisode[]) {
  const whereChain = {
    // Supports .where() → returns array directly OR supports further .orderBy()
    where: vi.fn().mockImplementation(() => ({
      // When called as a terminal (await db.select().from().where())
      then: (resolve: (v: typeof episodes) => void) => resolve(episodes),
      // When chained further (.orderBy())
      orderBy: vi.fn().mockResolvedValue(episodes),
      // Make it thenable so Drizzle's await works
      [Symbol.toStringTag]: "Promise",
    })),
    orderBy: vi.fn().mockResolvedValue(episodes),
  };

  // Make whereChain itself awaitable (for .where() used as terminal)
  Object.assign(whereChain.where, {
    then: undefined, // will be set per-call
  });

  const fromChain = {
    from: vi.fn().mockReturnValue(whereChain),
  };

  return {
    select: vi.fn().mockReturnValue(fromChain),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── Mock modules ─────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: [
            "## 1. GUEST DOSSIER",
            "Dossier content here.",
            "",
            "## 2. THE BIG PAIN",
            "Big pain content.",
            "",
            "## 3. THE THROUGH-LINE",
            "Through-line content.",
            "",
            "## 4. INTERVIEW OUTLINE — mapped to BINGE",
            "Outline content.",
            "",
            "## 5. QUESTION BANK (ranked best to worst), tagged by BINGE stage",
            "Question bank content.",
            "",
            "## 6. SOUNDBITE SETUPS",
            "Soundbite content.",
          ].join("\n"),
        },
      },
    ],
  }),
}));

// ─── Context helper ───────────────────────────────────────────────────────────

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("podcastRouter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("./db");
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(buildMockDb([mockEpisode]));
  });

  describe("podcast.createEpisode", () => {
    it("creates an episode and returns it", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      const result = await caller.podcast.createEpisode({
        guestName: "Dr. Mark Hyman",
        guestRole: "Author",
        guestCompany: "Cleveland Clinic",
        whyNow: "New book launch",
        episodeLengthMin: 45,
      });

      expect(result).toBeDefined();
      expect(result.guestName).toBe("Dr. Mark Hyman");
    });

    it("rejects an empty guestName", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      await expect(
        caller.podcast.createEpisode({ guestName: "" })
      ).rejects.toThrow();
    });

    it("defaults episodeLengthMin to 45", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      const result = await caller.podcast.createEpisode({ guestName: "Test Guest" });
      expect(result.episodeLengthMin).toBe(45);
    });
  });

  describe("podcast.getEpisodes", () => {
    it("returns an array", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      const result = await caller.podcast.getEpisodes();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("podcast.getEpisode", () => {
    it("returns a single episode by ID", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      const result = await caller.podcast.getEpisode({ id: 1 });
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it("throws NOT_FOUND when the episode list is empty", async () => {
      const { getDb } = await import("./db");
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(buildMockDb([]));

      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      await expect(caller.podcast.getEpisode({ id: 9999 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("podcast.deleteEpisode", () => {
    it("returns { success: true }", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      const result = await caller.podcast.deleteEpisode({ id: 1 });
      expect(result).toEqual({ success: true });
    });
  });

  describe("podcast.generateReport", () => {
    it("calls invokeLLM with a prompt containing BINGE section headers", async () => {
      const { invokeLLM } = await import("./_core/llm");
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      await caller.podcast.generateReport({ episodeId: 1 });

      expect(invokeLLM).toHaveBeenCalledOnce();
      const callArgs = (invokeLLM as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const userMsg = callArgs.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toContain("BINGE");
      expect(userMsg.content).toContain("GUEST DOSSIER");
      expect(userMsg.content).toContain("QUESTION BANK");
      expect(userMsg.content).toContain("SOUNDBITE SETUPS");
    });

    it("throws NOT_FOUND when episode does not exist", async () => {
      const { getDb } = await import("./db");
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(buildMockDb([]));

      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      await expect(
        caller.podcast.generateReport({ episodeId: 9999 })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("podcast.updateEpisode", () => {
    it("completes without throwing", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());

      // updateEpisode returns the result of the second select() call
      // Our mock always returns [mockEpisode], so result will be mockEpisode
      const result = await caller.podcast.updateEpisode({
        id: 1,
        guestName: "Updated Name",
      });

      expect(result).toBeDefined();
    });
  });
});
