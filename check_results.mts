import "dotenv/config";
import { createConnection } from "mysql2/promise";

const db = await createConnection(process.env.DATABASE_URL || "");

// Get actual column names for lead_prospects
const [cols] = await db.execute("DESCRIBE lead_prospects") as any[];
console.log("lead_prospects columns:", (cols as any[]).map((c: any) => c.Field).join(", "));

// Find the email column name
const emailCol = (cols as any[]).find((c: any) => c.Field.toLowerCase().includes("email"))?.Field;
const sourceCol = (cols as any[]).find((c: any) => c.Field.toLowerCase().includes("source"))?.Field;
const nameCol = (cols as any[]).find((c: any) => c.Field.toLowerCase().includes("name"))?.Field;
const titleCol = (cols as any[]).find((c: any) => c.Field.toLowerCase().includes("title"))?.Field;
const companyCol = (cols as any[]).find((c: any) => c.Field.toLowerCase().includes("company"))?.Field;
console.log("email col:", emailCol, "| source col:", sourceCol);

// Count by source
const [cnt] = await db.execute(`SELECT ${sourceCol}, COUNT(*) as cnt, SUM(CASE WHEN ${emailCol} IS NOT NULL AND ${emailCol} NOT LIKE '%not_unlocked%' THEN 1 ELSE 0 END) as real_emails FROM lead_prospects GROUP BY ${sourceCol}`) as any[];
console.log("\nlead_prospects by source:", JSON.stringify(cnt));

// Sample 10 real emails saved recently
const [samples] = await db.execute(`SELECT ${nameCol}, ${emailCol}, ${titleCol}, ${companyCol} FROM lead_prospects WHERE ${emailCol} IS NOT NULL AND ${emailCol} NOT LIKE '%not_unlocked%' ORDER BY id DESC LIMIT 10`) as any[];
console.log("\nSample real emails (most recent 10):");
(samples as any[]).forEach((r: any) => {
  const vals = Object.values(r);
  console.log(" ", vals.join(" | "));
});

// Check meta audiences
const [aud] = await db.execute("SELECT id, name, category, meta_audience_id FROM meta_custom_audiences LIMIT 5") as any[];
console.log("\nmeta_custom_audiences:", JSON.stringify(aud));

// Check apollo_sync_runs
const [runs] = await db.execute("SELECT * FROM apollo_sync_runs ORDER BY id DESC LIMIT 3") as any[];
console.log("\napollo_sync_runs (last 3):", JSON.stringify(runs));

await db.end();
