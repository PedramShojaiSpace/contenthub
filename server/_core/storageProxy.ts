import type { Express } from "express";
import { ENV } from "./env";

// In-memory cache for signed URLs — avoids a Forge API round-trip on every image request
// Signed URLs are valid for 1 hour; we cache for 55 minutes to be safe
const URL_CACHE = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req: any, res: any) => {
    const key = req.params[0] as string | undefined;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    // Check cache first
    const cached = URL_CACHE.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.set("Cache-Control", "public, max-age=3300, stale-while-revalidate=600");
      res.redirect(307, cached.url);
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      // Cache the signed URL
      URL_CACHE.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });

      // Tell the browser it can cache this redirect for 55 minutes too
      res.set("Cache-Control", "public, max-age=3300, stale-while-revalidate=600");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
