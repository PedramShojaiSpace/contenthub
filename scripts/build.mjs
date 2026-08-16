import { spawn } from "node:child_process";
import { access, readFile, readdir, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const esbuildCli = path.join(projectRoot, "node_modules", ".bin", "esbuild");
// Keep each staged Vite process below the sandbox memory ceiling. Bundles build
// sequentially, so a conservative per-process cap is safer than a larger heap
// that can trigger an external SIGTERM before later Hub bundles are emitted.
const nodeOptions = process.env.NODE_OPTIONS || "--max-old-space-size=1800";

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

async function cleanBundleOutput(bundle) {
  if (bundle.mode === "public") return;
  const outputDir = path.dirname(path.join(projectRoot, bundle.to));
  await rm(outputDir, { recursive: true, force: true });
  console.log(`[build] Cleared stale ${bundle.label} output: ${outputDir}`);
}

async function validateBundleOutput(bundle) {
  const entryPath = path.join(projectRoot, bundle.to);
  const entryHtml = await readFile(entryPath, "utf-8");
  const segment = bundle.mode === "public" ? "" : `/hub/${bundle.mode.replace("hub-", "")}`;
  const expectedAssetPath = `${segment}/assets/`;
  if (!entryHtml.includes(expectedAssetPath)) {
    throw new Error(`${bundle.label} entry is missing expected asset base ${expectedAssetPath}`);
  }

  if (bundle.mode === "hub-analytics") {
    const assetsDir = path.join(path.dirname(entryPath), "assets");
    const commandCenterChunks = (await readdir(assetsDir)).filter((file) =>
      /^InterconnectedCommandCenter-.*\.js$/.test(file)
    );
    const hasRepairedCommandCenter = (await Promise.all(
      commandCenterChunks.map((file) => readFile(path.join(assetsDir, file), "utf-8"))
    )).some((source) =>
      source.includes("Direct Kajabi source") && source.includes("getLiveInterconnectedPurchases")
    );
    if (!hasRepairedCommandCenter) {
      throw new Error("Hub Analytics build is missing the repaired Interconnected Command Center chunk");
    }
  }

  console.log(`[build] Verified ${bundle.label} output: ${entryPath}`);
}

try {
  for (const bundle of bundles) {
    await cleanBundleOutput(bundle);
    await run(process.execPath, [viteCli, "build", "--mode", bundle.mode], bundle.label);
    await renameIndex(bundle);
    await validateBundleOutput(bundle);
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
