import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared test context ──────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "pedram@theurbanmonk.com",
    name: "Pedram Shojai",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Buffer module mock ───────────────────────────────────────────────────────

vi.mock("./buffer", () => ({
  getBufferProfiles: vi.fn().mockResolvedValue([
    { id: "profile-li-1", platform: "linkedin", name: "@urbanmonk" },
    { id: "profile-meta-1", platform: "meta", name: "@theurbanmonk" },
  ]),
  pushToBuffer: vi.fn().mockResolvedValue({ success: true, bufferId: "buf-abc123" }),
}));

// ─── DB module mock ───────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listContentItems: vi.fn().mockResolvedValue([
      {
        id: 1,
        title: "Mouthwash destroys gut microbiome",
        platform: "linkedin",
        status: "review",
        textContent: "Did you know...",
        imageUrl: null,
        scheduledAt: null,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago (stuck)
        rawIdea: null,
        imageKey: null,
        imagePrompt: null,
        publishedAt: null,
        notes: null,
      },
      {
        id: 2,
        title: "Sleep and cortisol connection",
        platform: "meta",
        status: "idea",
        textContent: null,
        imageUrl: null,
        scheduledAt: Date.now() + 2 * 24 * 60 * 60 * 1000, // 2 days from now
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (aging)
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        rawIdea: null,
        imageKey: null,
        imagePrompt: null,
        publishedAt: null,
        notes: null,
      },
    ]),
    updateContentItem: vi.fn().mockResolvedValue(undefined),
    createContentItem: vi.fn().mockResolvedValue({ id: 99 }),
    getContentItem: vi.fn().mockResolvedValue(null),
    deleteContentItem: vi.fn().mockResolvedValue(undefined),
    listGeneratedImages: vi.fn().mockResolvedValue([]),
    listPlatformStrategies: vi.fn().mockResolvedValue([]),
    getPlatformStrategy: vi.fn().mockResolvedValue(null),
    upsertPlatformStrategy: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Notification mock ────────────────────────────────────────────────────────

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("syndication.getProfiles", () => {
  it("returns connected Buffer profiles", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const profiles = await caller.syndication.getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({ platform: "linkedin" });
  });
});

describe("syndication.push", () => {
  it("pushes content to Buffer and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.syndication.push({
      contentItemId: 1,
      text: "Did you know mouthwash destroys the gut microbiome?",
      profileIds: ["profile-li-1"],
      imageUrl: "https://cdn.example.com/image.jpg",
    });
    expect(result.success).toBe(true);
    expect(result.bufferId).toBe("buf-abc123");
  });
});

describe("digest.sendNow", () => {
  it("sends the weekly digest without throwing", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.digest.sendNow();
    expect(result.success).toBe(true);
  });
});

describe("content.update (image attachment)", () => {
  it("updates a content item with an image URL", async () => {
    const { updateContentItem } = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.content.update({
      id: 1,
      imageUrl: "https://cdn.example.com/nano-banana-image.jpg",
      imagePrompt: "A cinematic dark background with amber light",
    });
    expect(updateContentItem).toHaveBeenCalledWith(1, expect.objectContaining({
      imageUrl: "https://cdn.example.com/nano-banana-image.jpg",
    }));
  });
});
