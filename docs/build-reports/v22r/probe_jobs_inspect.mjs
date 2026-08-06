/** Diagnostic: print the most recent research_jobs rows from the SCRATCH db. */
import mysql from "mysql2/promise";
import fs from "node:fs";

const envText = fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const u = new URL(env.DATABASE_URL);
const c = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: "contenthub_v22_sandbox",
});
const [rows] = await c.query(
  "SELECT id, LEFT(seed_keyword,60) seed, research_status, LEFT(notes,200) notes, LEFT(error_message,200) err, created_at FROM research_jobs ORDER BY id DESC LIMIT 8"
);
console.log(JSON.stringify(rows, null, 1));
await c.end();
