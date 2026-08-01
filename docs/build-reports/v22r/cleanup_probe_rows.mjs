/**
 * Removes rows left behind when a probe dies before its own cleanup runs.
 * Scoped to the scratch DB and to the `__probe_` title prefix, and refuses to
 * run anywhere else.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const TARGET_DB = "contenthub_v22_sandbox";
const env = Object.fromEntries(
  readFileSync("/home/ubuntu/contenthub/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const password = env.DATABASE_URL?.match(/mysql:\/\/chstaging:([^@]+)@/)?.[1];

const c = await mysql.createConnection({
  host: "127.0.0.1", port: 3306, user: "chstaging", password, database: TARGET_DB,
});
const [[{ db }]] = await c.query("SELECT DATABASE() AS db");
if (db !== TARGET_DB) { console.error(`REFUSING: db is ${db}`); process.exit(1); }
console.log("db:", db);

const [analog] = await c.query("SELECT id, title FROM analog_data_entries WHERE title LIKE '__probe\\_%'");
console.log("leftover analog probe rows:", JSON.stringify(analog));

const [outputs] = await c.query("SELECT id, topic FROM script_factory_outputs WHERE id >= 30000 ORDER BY id");
console.log("script_factory_outputs id>=30000:", JSON.stringify(outputs));

if (analog.length) {
  await c.query("DELETE FROM analog_data_entries WHERE title LIKE '__probe\\_%'");
  console.log(`deleted ${analog.length} probe analog row(s)`);
}
if (outputs.length) {
  await c.query(
    `DELETE FROM script_factory_outputs WHERE id IN (${outputs.map(() => "?").join(",")})`,
    outputs.map((o) => o.id)
  );
  console.log(`deleted ${outputs.length} probe script row(s)`);
}

const [[a]] = await c.query("SELECT COUNT(*) n FROM analog_data_entries");
const [[s]] = await c.query("SELECT COUNT(*) n FROM script_factory_outputs");
console.log(`analog_data_entries now: ${a.n} · script_factory_outputs now: ${s.n}`);
await c.end();
