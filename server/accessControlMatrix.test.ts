import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("remaining intentional public procedure surface", () => {
  it("keeps the stateless health probe public", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.system.health({ timestamp: Date.now() })).resolves.toEqual({ ok: true });
  });

  it("blocks anonymous callers from sending owner notifications", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(
      caller.system.notifyOwner({ title: "Unauthorized probe", content: "This must not send." })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
