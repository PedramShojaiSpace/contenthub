import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log("\n=== 1. REDDIT SUBREDDITS (lead_subreddits) ===");
  try {
    const [rows] = await db.query("SELECT * FROM lead_subreddits LIMIT 10") as any;
    if (rows.length === 0) { console.log("  EMPTY TABLE"); }
    else {
      console.log("Columns: " + Object.keys(rows[0]).join(", "));
      rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 130)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 2. REDDIT POSTS (reddit_posts) ===");
  try {
    const [cnt] = await db.query("SELECT COUNT(*) as cnt FROM reddit_posts") as any;
    console.log("Total posts: " + cnt[0].cnt);
    const [recent] = await db.query("SELECT subreddit, title, author, score, fetchedAt FROM reddit_posts ORDER BY fetchedAt DESC LIMIT 5") as any;
    recent.forEach((r: any) => console.log(`  [r/${r.subreddit}] "${String(r.title).slice(0,60)}" (score:${r.score}) fetched:${r.fetchedAt}`));
    
    // Check when last fetched
    const [lastFetch] = await db.query("SELECT MAX(fetchedAt) as last FROM reddit_posts") as any;
    console.log("Last fetch time: " + lastFetch[0].last);
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 3. LEAD KEYWORDS ===");
  try {
    const [rows] = await db.query("SELECT * FROM lead_keywords LIMIT 10") as any;
    if (rows.length === 0) { console.log("  EMPTY TABLE"); }
    else {
      console.log("Columns: " + Object.keys(rows[0]).join(", "));
      rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 130)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 4. LEAD PROSPECTS (by source) ===");
  try {
    const [src] = await db.query("SELECT lp_source, COUNT(*) as cnt FROM lead_prospects GROUP BY lp_source") as any;
    src.forEach((r: any) => console.log(`  ${r.lp_source}: ${r.cnt} leads`));
    
    // Show YouTube leads
    const [ytLeads] = await db.query("SELECT id, author, subredditOrChannel, keywordsMatched, emailFound, lp_status, lp_createdAt FROM lead_prospects WHERE lp_source = 'youtube' ORDER BY lp_createdAt DESC LIMIT 5") as any;
    if (ytLeads.length > 0) {
      console.log("\n  Recent YouTube leads:");
      ytLeads.forEach((r: any) => console.log(`    u/${r.author} | channel:${r.subredditOrChannel} | keyword:${r.keywordsMatched} | email:${r.emailFound || 'none'} | status:${r.lp_status}`));
    }
    
    // Show Apollo leads
    const [apLeads] = await db.query("SELECT id, author, emailFound, lp_status, body, lp_createdAt FROM lead_prospects WHERE lp_source = 'apollo' ORDER BY lp_createdAt DESC LIMIT 5") as any;
    if (apLeads.length > 0) {
      console.log("\n  Recent Apollo leads:");
      apLeads.forEach((r: any) => {
        let parsed: any = {};
        try { parsed = JSON.parse(r.body || '{}'); } catch {}
        console.log(`    ${parsed.firstName || ''} ${parsed.lastName || ''} | ${r.emailFound || 'no email'} | ${parsed.title || ''} @ ${parsed.company || ''} | status:${r.lp_status}`);
      });
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 5. YOUTUBE CHANNELS (lead_yt_channels) ===");
  try {
    const [rows] = await db.query("SELECT * FROM lead_yt_channels") as any;
    if (rows.length === 0) { console.log("  EMPTY - No YouTube channels configured!"); }
    else {
      console.log("Columns: " + Object.keys(rows[0]).join(", "));
      rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 130)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 6. META AUDIENCE LEADS (meta_audience_leads) ===");
  try {
    const [cnt] = await db.query("SELECT COUNT(*) as cnt FROM meta_audience_leads") as any;
    console.log("Total pushed to Meta: " + cnt[0].cnt);
    const [recent] = await db.query("SELECT * FROM meta_audience_leads ORDER BY id DESC LIMIT 3") as any;
    recent.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 130)));
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 7. META CUSTOM AUDIENCES ===");
  try {
    const [rows] = await db.query("SELECT * FROM meta_custom_audiences") as any;
    rows.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 200)));
  } catch(e: any) { console.log("  Error: " + e.message); }

  console.log("\n=== 8. APOLLO SYNC RUNS ===");
  try {
    const [cnt] = await db.query("SELECT COUNT(*) as cnt FROM apollo_sync_runs") as any;
    console.log("Total runs: " + cnt[0].cnt);
    if (cnt[0].cnt > 0) {
      const [recent] = await db.query("SELECT * FROM apollo_sync_runs ORDER BY id DESC LIMIT 3") as any;
      recent.forEach((r: any) => console.log("  " + JSON.stringify(r).slice(0, 200)));
    }
  } catch(e: any) { console.log("  Error: " + e.message); }

  await db.end();
}

main().catch(console.error);
