import type { Express, Request, Response } from "express";

const legacyHubAliases: Record<string, string> = {
  "/hub/youtube-to-blog": "/hub/content/video-to-blog",
};

export function getLegacyHubAliasHref(pathname: string, search = ""): string | null {
  const canonicalPath = legacyHubAliases[pathname];
  return canonicalPath ? `${canonicalPath}${search}` : null;
}

export function registerLegacyHubAliases(app: Express) {
  app.use((req: Request, res: Response, next) => {
    const href = getLegacyHubAliasHref(req.path, req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "");
    if (!href) return next();
    return res.redirect(302, href);
  });
}
