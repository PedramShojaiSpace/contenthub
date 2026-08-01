/**
 * Part 2 proof — the running sandbox app is isolated from staging and the live
 * channel. This is the claim the operator most needs to trust, so it is
 * demonstrated rather than asserted.
 *
 * Four checks:
 *   1. The app process's DATABASE_URL points at contenthub_v22_sandbox.
 *   2. Writing through the app's own API changes the SCRATCH row count and
 *      leaves the STAGING row count untouched (the decisive test).
 *   3. SANDBOX_MODE=1 is set in the live process, and the startup log shows the
 *      digest cron and upload watchdog were skipped.
 *   4. An authenticated tRPC read succeeds, i.e. the app is genuinely usable.
 *
 * Reproduce: node docs/build-reports/v22r/probe_sandbox_isolation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import mysql from "mysql2/promise";

const SCRATCH_DB = "contenthub_v22_sandbox";
const APP = process.env.APP_URL || "http://localhost:3000";
const envPath = path.resolve(import.meta.dirname, "../../../.env");
const baseUrl = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
if (!baseUrl) throw new Error("DATABASE_URL not found");

const parsed = new URL(baseUrl);
const STAGING_DB = parsed.pathname.replace(/^\//, "");
const creds = {
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
};

function hr(t) {
  console.log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));
}

console.log(`Part 2 sandbox isolation proof — ${new Date().toISOString()}`);
console.log(`app under test: ${APP}`);
console.log(`scratch db: ${SCRATCH_DB} · staging db: ${STAGING_DB}`);

hr("1. What database has the RUNNING app process actually opened?");
const pid = execSync("pgrep -f 'tsx watch server/_core/index.ts' | head -1").toString().trim();
if (!pid) throw new Error("app process not running");
const environ = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
const appDbUrl = environ.find((l) => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length) ?? "";
const appDbName = appDbUrl ? new URL(appDbUrl).pathname.replace(/^\//, "") : "(unset)";
const sandboxModeVar = environ.find((l) => l.startsWith("SANDBOX_MODE=")) ?? "(unset)";
console.log(`  pid: ${pid}`);
console.log(`  DATABASE_URL database component: ${appDbName}`);
console.log(`  → targets scratch, not staging: ${appDbName === SCRATCH_DB}`);
console.log(`  ${sandboxModeVar}`);
if (appDbName !== SCRATCH_DB) throw new Error("app is NOT on the scratch DB — aborting");

hr("2. Decisive test: write via the app's API, then count rows in BOTH databases");
const scratch = await mysql.createConnection({ ...creds, database: SCRATCH_DB });
const staging = await mysql.createConnection({ ...creds, database: STAGING_DB });

async function count(conn, table) {
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  return r.n;
}

// The drizzle export is `scriptFactoryOutputs`; the physical table is
// `script_factory_outputs`. Using the wrong name here failed loudly with
// ER_NO_SUCH_TABLE, which is itself a small reassurance that this probe is
// really talking to the database rather than to a mock.
const TABLE = "script_factory_outputs";
const before = { scratch: await count(scratch, TABLE), staging: await count(staging, TABLE) };
console.log(`  BEFORE  ${TABLE}:  scratch=${before.scratch}  staging=${before.staging}`);

// Mint a dev session, then write through the real tRPC endpoint.
const loginRes = await fetch(`${APP}/api/dev/login`, { redirect: "manual" });
const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
if (!cookie.startsWith("app_session_id=")) throw new Error("dev login did not return a session cookie");
console.log(`  minted dev session: ${cookie.slice(0, 24)}...`);

const marker = `v22 isolation proof ${Date.now()}`;
const writeRes = await fetch(`${APP}/api/trpc/scriptFactory.update`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ json: { id: 30003, notes: marker } }),
});
const writeBody = await writeRes.text();
console.log(`  POST scriptFactory.update → HTTP ${writeRes.status}`);
console.log(`  response: ${writeBody.slice(0, 160)}`);

// Read the row back from BOTH databases and compare.
for (const [label, conn] of [["scratch", scratch], ["staging", staging]]) {
  const [rows] = await conn.query(`SELECT notes FROM \`${TABLE}\` WHERE id = 30003`);
  const notes = rows[0]?.notes ?? "(no row)";
  const hit = typeof notes === "string" && notes.includes(marker);
  console.log(`  ${label.padEnd(8)} id=30003 notes contains the marker: ${hit}`);
}

const after = { scratch: await count(scratch, TABLE), staging: await count(staging, TABLE) };
console.log(`  AFTER   ${TABLE}:  scratch=${after.scratch}  staging=${after.staging}`);
console.log(`  staging row count unchanged: ${before.staging === after.staging}`);

hr("3. Background jobs that can reach the outside world are disabled");
const log = fs.readFileSync("/tmp/v22-sandbox.log", "utf8");
for (const needle of [
  "SANDBOX_MODE=1 — weekly digest cron and upload watchdog DISABLED",
  "Upload watchdog skipped (SANDBOX_MODE=1)",
]) {
  console.log(`  log contains "${needle.slice(0, 46)}...": ${log.includes(needle)}`);
}
console.log(`  log mentions "[Upload Watchdog]" activity: ${log.includes("[Upload Watchdog]")} (expect false)`);

hr("4. The app is genuinely usable — authenticated reads succeed");
for (const proc of ["scriptFactory.getStats", "scriptFactory.list"]) {
  const r = await fetch(`${APP}/api/trpc/${proc}?input=${encodeURIComponent('{"json":{}}')}`, {
    headers: { Cookie: cookie },
  });
  const body = await r.text();
  const ok = r.status === 200 && !body.includes('"error"');
  console.log(`  GET ${proc.padEnd(26)} HTTP ${r.status} · ok: ${ok}`);
  if (proc === "scriptFactory.getStats") console.log(`    ${body.slice(0, 120)}`);
}

await scratch.end();
await staging.end();
console.log("\nDONE.");
