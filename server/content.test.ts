import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@theurbanmonk.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const user: AuthenticatedUser = {
      id: 1,
      openId: "sample-user",
      email: "sample@example.com",
      name: "Sample User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const ctx: TrpcContext = {
      user,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      httpOnly: true,
      path: "/",
    });
  });
});

describe("content router", () => {
  it("router is defined and has expected procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Verify the content router procedures exist
    expect(typeof caller.content.list).toBe("function");
    expect(typeof caller.content.create).toBe("function");
    expect(typeof caller.content.update).toBe("function");
    expect(typeof caller.content.delete).toBe("function");
    expect(typeof caller.content.changeStatus).toBe("function");
  });

  it("strategy router is defined and has expected procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.strategy.list).toBe("function");
    expect(typeof caller.strategy.get).toBe("function");
    expect(typeof caller.strategy.upsert).toBe("function");
  });

  it("ai router is defined and has expected procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.ai.generateContent).toBe("function");
    expect(typeof caller.ai.generateImagePrompt).toBe("function");
    expect(typeof caller.ai.generateImage).toBe("function");
  });

  it("assets router is defined and has expected procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.assets.listImages).toBe("function");
  });
});
