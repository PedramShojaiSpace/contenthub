/**
 * Test that the upload worker can be spawned as a detached process.
 * Run: node scripts/test-spawn-worker.mjs
 */
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_BIN = process.execPath;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const TSX_LOADER = path.resolve(PROJECT_ROOT, "node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/loader.mjs");
const WORKER_SCRIPT = path.resolve(PROJECT_ROOT, "server/uploadWorker.ts");

console.log("=== Worker Spawn Test ===");
console.log("NODE_BIN:", NODE_BIN);
console.log("TSX_LOADER:", TSX_LOADER, "exists:", fs.existsSync(TSX_LOADER));
console.log("WORKER_SCRIPT:", WORKER_SCRIPT, "exists:", fs.existsSync(WORKER_SCRIPT));

const logFile = "/tmp/upload-worker-test.log";
const logFd = fs.openSync(logFile, "w");
const loaderUrl = `file://${TSX_LOADER}`;

const child = spawn(NODE_BIN, ["--import", loaderUrl, WORKER_SCRIPT], {
  detached: true,
  stdio: ["ignore", logFd, logFd],
  env: {
    ...process.env,
    JOB_ID: "99999", // test job ID
  },
});

child.on("error", (err) => {
  console.error("SPAWN ERROR:", err.message);
  process.exit(1);
});

child.unref();

// Wait a moment then check if it started
setTimeout(() => {
  if (child.pid) {
    console.log("✅ Worker spawned successfully. PID:", child.pid);
    console.log("Log file:", logFile);
    // Read the first few lines of the log
    setTimeout(() => {
      try {
        const log = fs.readFileSync(logFile, "utf8");
        console.log("--- Worker log (first 500 chars) ---");
        console.log(log.slice(0, 500));
      } catch (e) {
        console.log("Log not readable yet:", e.message);
      }
      process.exit(0);
    }, 3000);
  } else {
    console.error("❌ Worker spawn returned no PID — failed to start");
    process.exit(1);
  }
}, 500);
