/** Utility: print SHOW COLUMNS for the tables the Part 2b proof touches. */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const envPath = path.resolve(import.meta.dirname, "../../../.env");
const u = new URL(fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)[1].trim());
const db = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: process.argv[3] || "contenthub_v22_sandbox",
});
for (const t of (process.argv[2] || "research_jobs,content_patterns,yt_transcripts,suggested_ideas,claims_reviews").split(",")) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${t}\``);
  console.log(`${t}:\n  ${rows.map((r) => `${r.Field}(${r.Type})`).join(", ")}\n`);
}
await db.end();
