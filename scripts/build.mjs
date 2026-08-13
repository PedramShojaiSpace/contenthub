import { spawn } from "node:child_process";
import { access, rename } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const esbuildCli = path.join(projectRoot, "node_modules", ".bin", "esbuild");
const nodeOptions = process.env.NODE_OPTIONS || "--max-old-space-size=2200";

const bundles = [
  { label: "public funnel", mode: "public", from: "dist/public/public-index.html", to: "dist/public/index.html" },
  { label: "Hub core", mode: "hub-core", from: "dist/public/hub/core/hub-core-index.html", to: "dist/public/hub/core/index.html" },
  { label: "Hub content", mode: "hub-content", from: "dist/public/hub/content/hub-content-index.html", to: "dist/public/hub/content/index.html" },
  { label: "Hub growth", mode: "hub-growth", from: "dist/public/hub/growth/hub-growth-index.html", to: "dist/public/hub/growth/index.html" },
  { label: "Hub analytics", mode: "hub-analytics", from: "dist/public/hub/analytics/hub-analytics-index.html", to: "dist/public/hub/analytics/index.html" },
];

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n[build] Starting ${label}`);
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, NODE_OPTIONS: nodeOptions },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        console.log(`[build] Completed ${label}`);
        resolve();
        return;
      }
      reject(new Error(`${label} failed (exit=${code ?? "none"}, signal=${signal ?? "none"})`));
    });
  });
}

async function renameIndex(bundle) {
  const from = path.join(projectRoot, bundle.from);
  const to = path.join(projectRoot, bundle.to);
  await access(from, constants.F_OK);
  await rename(from, to);
  console.log(`[build] Finalized ${bundle.label} entry: ${bundle.to}`);
}

try {
  for (const bundle of bundles) {
    await run(process.execPath, [viteCli, "build", "--mode", bundle.mode], bundle.label);
    await renameIndex(bundle);
  }

  await run(
    esbuildCli,
    ["server/_core/index.ts", "--platform=node", "--packages=external", "--bundle", "--format=esm", "--outdir=dist"],
    "server bundle",
  );
} catch (error) {
  console.error("\n[build] Deployment build failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
