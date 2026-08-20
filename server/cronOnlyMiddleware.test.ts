import { describe, expect, it, vi } from "vitest";
import { createCronOnlyMiddleware } from "./cronOnlyMiddleware";

function createResponse() {
  const response = {
    locals: {} as Record<string, unknown>,
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("shared scheduled callback guard", () => {
  it("allows only a Manus cron identity with a task UID", async () => {
    const middleware = createCronOnlyMiddleware(async () => ({ isCron: true, taskUid: "T_valid" }));
    const response = createResponse();
    const next = vi.fn();

    await middleware({} as any, response as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.locals.scheduledTaskUid).toBe("T_valid");
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects non-cron and failed authentication callers before handlers run", async () => {
    const nonCron = createCronOnlyMiddleware(async () => ({ isCron: false }));
    const rejected = createCronOnlyMiddleware(async () => {
      throw new Error("invalid session");
    });

    for (const middleware of [nonCron, rejected]) {
      const response = createResponse();
      const next = vi.fn();
      await middleware({} as any, response as any, next);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
      expect(next).not.toHaveBeenCalled();
    }
  });
});
