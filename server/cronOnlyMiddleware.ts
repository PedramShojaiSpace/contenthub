import type { NextFunction, Request, RequestHandler, Response } from "express";

type CronIdentity = {
  isCron?: boolean;
  taskUid?: string;
};

type AuthenticateRequest = (req: Request) => Promise<CronIdentity>;

/**
 * Scheduled callback paths are externally reachable, but must execute only
 * under a Manus-issued cron identity. Individual handlers can retain stricter
 * task ownership checks after this shared boundary has rejected all other
 * callers.
 */
export function createCronOnlyMiddleware(authenticateRequest: AuthenticateRequest): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        return res.status(403).json({ error: "cron-only" });
      }
      res.locals.scheduledTaskUid = user.taskUid;
      return next();
    } catch {
      return res.status(403).json({ error: "cron-only" });
    }
  };
}
