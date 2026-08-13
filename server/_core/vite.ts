import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // The production configuration is mode-aware because it emits separate
  // public and Hub bundles. Resolve that config function explicitly here;
  // spreading the function itself loses `root` and makes dev look for
  // `/src/main.tsx` outside the client directory.
  const resolvedViteConfig =
    typeof viteConfig === "function"
      ? await viteConfig({
          command: "serve",
          mode: "development",
          isSsrBuild: false,
          isPreview: false,
        })
      : viteConfig;

  const vite = await createViteServer({
    ...resolvedViteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // The internal Content Hub is compiled as four operator bundles under /hub
  // so public landing-page builds do not carry every internal tool.
  const hubRoutes: Array<[string, string]> = [
    ["/hub/content", "content"],
    ["/hub/growth", "growth"],
    ["/hub/analytics", "analytics"],
    ["/hub", "core"],
  ];
  for (const [routePrefix, bundleName] of hubRoutes) {
    app.use(routePrefix, (_req, res) => {
      res.sendFile(path.resolve(distPath, "hub", bundleName, "index.html"));
    });
  }

  app.use("/hub", (_req, res) => {
    res.sendFile(path.resolve(distPath, "hub", "core", "index.html"));
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
