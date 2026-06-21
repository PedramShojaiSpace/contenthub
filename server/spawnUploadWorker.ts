/**
 * spawnUploadWorker.ts — Spawn a detached upload worker process
 *
 * The worker runs as a completely separate Node.js process, detached from the
 * main server. This means server hot-reloads and restarts do NOT kill it.
 *
 * The worker logs to /tmp/upload-worker-<jobId>.log
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to the Node.js binary that is currently running the server.
const NODE_BIN = process.execPath;

// tsx loader — dynamically resolve whichever tsx version is installed
// (avoids breakage when pnpm installs a different patch version)
function findTsxLoader(): string {
  // server/ is one level deep inside the project root, so ../node_modules is correct
  // (../../node_modules would resolve to the parent of the project root — wrong)
  const projectRoot = path.resolve(__dirname, "..");
  const directPath = path.join(projectRoot, "node_modules", "tsx", "dist", "loader.mjs");
  if (fs.existsSync(directPath)) return directPath;
  // Also try process.cwd() as a fallback (reliable in both dev and prod)
  const cwdPath = path.join(process.cwd(), "node_modules", "tsx", "dist", "loader.mjs");
  if (fs.existsSync(cwdPath)) return cwdPath;
  // pnpm virtual store fallback
  const pnpmDir = path.join(projectRoot, "node_modules", ".pnpm");
  try {
    const entries = fs.readdirSync(pnpmDir);
    const tsxEntry = entries
      .filter(e => e.startsWith("tsx@"))
      .map(e => path.join(pnpmDir, e, "node_modules", "tsx", "dist", "loader.mjs"))
      .find(p => fs.existsSync(p));
    if (tsxEntry) return tsxEntry;
  } catch (_) { /* pnpm dir not found */ }
  // Last resort: require.resolve from project root
  try {
    return require.resolve("tsx/dist/loader.mjs", { paths: [projectRoot] });
  } catch (_) { /* not resolvable */ }
  return "";
}
const TSX_LOADER = findTsxLoader();

export function spawnUploadWorker(jobId: number): void {
  const workerScript = path.resolve(__dirname, "uploadWorker.ts");
  const logFile = `/tmp/upload-worker-${jobId}.log`;

  const loaderExists = fs.existsSync(TSX_LOADER);
  const workerExists = fs.existsSync(workerScript);

  console.log(`[spawnUploadWorker] Spawning worker for Job #${jobId}`);
  console.log(`[spawnUploadWorker] node=${NODE_BIN}`);
  console.log(`[spawnUploadWorker] loader=${TSX_LOADER} exists=${loaderExists}`);
  console.log(`[spawnUploadWorker] script=${workerScript} exists=${workerExists}`);

  if (!loaderExists) {
    console.error(`[spawnUploadWorker] tsx loader not found at ${TSX_LOADER} — cannot spawn worker`);
    return;
  }
  if (!workerExists) {
    console.error(`[spawnUploadWorker] worker script not found at ${workerScript} — cannot spawn worker`);
    return;
  }

  // Open log file for stdout/stderr of the child process
  const logFd = fs.openSync(logFile, "a");
  const loaderUrl = `file://${TSX_LOADER}`;
  const spawnArgs = ["--import", loaderUrl, workerScript];

  const child = spawn(NODE_BIN, spawnArgs, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      JOB_ID: String(jobId),
    },
  });

  child.on("error", (err) => {
    console.error(`[spawnUploadWorker] Failed to spawn worker for Job #${jobId}: ${err.message}`);
    fs.appendFileSync(logFile, `[spawn error] ${err.message}\n`);
  });

  child.unref(); // Allow parent process to exit without waiting for child

  // Write PID to a file so the watchdog can check if the worker is still running
  if (child.pid) {
    try {
      fs.writeFileSync(`/tmp/upload-worker-${jobId}.pid`, String(child.pid));
      console.log(`[spawnUploadWorker] Worker spawned. PID: ${child.pid}. Log: ${logFile}`);
    } catch (_) { /* non-fatal */ }
  } else {
    console.error(`[spawnUploadWorker] Worker spawn returned no PID for Job #${jobId}`);
  }
}

export function isUploadWorkerRunning(jobId: number): boolean {
  const pidFile = `/tmp/upload-worker-${jobId}.pid`;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getWorkerLog(jobId: number): string {
  const logFile = `/tmp/upload-worker-${jobId}.log`;
  try {
    return fs.readFileSync(logFile, "utf8");
  } catch {
    return "";
  }
}
