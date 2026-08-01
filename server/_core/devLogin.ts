/**
 * DEV-ONLY local login helper.
 *
 * The hosted app authenticates via the Manus OAuth portal, which only permits
 * redirect URLs registered for this project (e.g. ch.theurbanmonk.com). When the
 * app runs on an ad-hoc sandbox/preview domain the portal correctly rejects the
 * callback with "invalid redirect URL".
 *
 * A session in this app is nothing more than an HS256 JWT signed with JWT_SECRET
 * and stored in the `app_session_id` cookie, so for local review we can mint that
 * cookie directly and bypass the OAuth round trip entirely.
 *
 * This route is registered ONLY when NODE_ENV === "development" AND
 * ALLOW_DEV_LOGIN === "true", so it can never be reachable in production.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerDevLoginRoute(app: Express) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ALLOW_DEV_LOGIN !== "true"
  ) {
    return;
  }

  app.get("/api/dev/login", async (req: Request, res: Response) => {
    const openId =
      (typeof req.query.openId === "string" && req.query.openId) ||
      process.env.OWNER_OPEN_ID ||
      "";
    const name = process.env.OWNER_NAME || "Local Dev";

    if (!openId) {
      res
        .status(500)
        .json({ error: "OWNER_OPEN_ID is not set; cannot mint a dev session." });
      return;
    }

    try {
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log(`[DevLogin] Minted local session for openId=${openId}`);
      res.redirect(302, "/");
    } catch (error) {
      console.error("[DevLogin] Failed to mint session", error);
      res.status(500).json({ error: "Failed to mint dev session" });
    }
  });

  console.log(
    "[DevLogin] Dev login route enabled at /api/dev/login (development only)."
  );
}
