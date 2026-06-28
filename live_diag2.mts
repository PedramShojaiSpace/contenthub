import * as mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL!);

  // Discover actual column names first
  const tables = ['reddit_subreddits','reddit_posts','lead_prospects','apollo_sync_runs','meta_custom_audiences','youtube_tracked_channels'];
  console.log("=== TABLE SCHEMAS ===");
  for (const t of tables) {
    try {
      const [rows] = await db.query("DESCRIBE " + t) as any;
      console.log(t + ": " + rows.map((r: any) => r.Field).join(", "));
    } catch(e: any) {
      console.log(t + ": TABLE NOT FOUND - " + e.message.slice(0, 60));
    }
  }

  console.log("\n=== REDDIT SUBREDDITS ===");
  try {
    const [rows] = await db.query("SELECT * FROM reddit_subreddits LIMIT 5") as any;
    if (rows.length > 0) {
      console.log("Sample row keys: " + Object.keys(rows[0]).join(", "));
      rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 120)));
    } else {
      console.log("  Table is empty");
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== REDDIT POSTS COUNT ===");
  try {
    const [rows] = await db.query("SELECT COUNT(*) as cnt FROM reddit_posts") as any;
    console.log("Total: " + rows[0].cnt);
    if (rows[0].cnt > 0) {
      const [recent] = await db.query("SELECT * FROM reddit_posts ORDER BY id DESC LIMIT 3") as any;
      recent.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 150)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== LEAD PROSPECTS BY SOURCE ===");
  try {
    const [rows] = await db.query("SELECT source, COUNT(*) as cnt FROM lead_prospects GROUP BY source") as any;
    rows.forEach((r: any) => console.log("  " + r.source + ": " + r.cnt));
    
    // Show sample youtube lead
    const [ytLeads] = await db.query("SELECT * FROM lead_prospects WHERE source = 'youtube' LIMIT 3") as any;
    if (ytLeads.length > 0) {
      console.log("\n  Sample YouTube lead columns: " + Object.keys(ytLeads[0]).join(", "));
      ytLeads.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 150)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== APOLLO SYNC RUNS ===");
  try {
    const [rows] = await db.query("SELECT COUNT(*) as cnt FROM apollo_sync_runs") as any;
    console.log("Total runs: " + rows[0].cnt);
    if (rows[0].cnt > 0) {
      const [recent] = await db.query("SELECT * FROM apollo_sync_runs ORDER BY id DESC LIMIT 3") as any;
      recent.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 150)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== META CUSTOM AUDIENCES ===");
  try {
    const [rows] = await db.query("SELECT * FROM meta_custom_audiences") as any;
    console.log("Total: " + rows.length);
    rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 150)));
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== YOUTUBE TRACKED CHANNELS ===");
  try {
    const [rows] = await db.query("SELECT * FROM youtube_tracked_channels") as any;
    console.log("Total: " + rows.length);
    rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 150)));
  } catch(e: any) { console.log("  Error: " + e.message); }

  await db.end();
}

main().catch(console.error);
