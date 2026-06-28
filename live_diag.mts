import * as mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL!);

console.log("\n=== REDDIT SCAN CONFIG ===");
const [subreddits] = await db.query(`SELECT name, keywords, is_active FROM reddit_subreddits ORDER BY name`) as any;
console.log(`Configured subreddits: ${subreddits.length}`);
subreddits.forEach((s: any) => console.log(`  ${s.is_active ? '✓' : '✗'} r/${s.name} | keywords: ${String(s.keywords || '').slice(0,80)}`));

console.log("\n=== REDDIT POSTS IN DB ===");
const [redditCount] = await db.query(`SELECT COUNT(*) as cnt FROM reddit_posts`) as any;
console.log(`Total Reddit posts stored: ${redditCount[0].cnt}`);
const [recentReddit] = await db.query(`SELECT subreddit, title, author, score, created_at FROM reddit_posts ORDER BY created_at DESC LIMIT 5`) as any;
if (recentReddit.length > 0) {
  console.log("Most recent 5:");
  recentReddit.forEach((r: any) => console.log(`  [${r.subreddit}] "${String(r.title || '').slice(0,60)}" by u/${r.author} (score:${r.score})`));
} else {
  console.log("  WARNING: NO REDDIT POSTS IN DB");
}

console.log("\n=== YOUTUBE LEADS (INTENT SIGNALS) ===");
const [ytCount] = await db.query(`SELECT COUNT(*) as cnt FROM lead_prospects WHERE source = 'youtube'`) as any;
console.log(`Total YouTube leads: ${ytCount[0].cnt}`);
const [recentYT] = await db.query(`SELECT name, keyword_matched, channel_name, email, created_at FROM lead_prospects WHERE source = 'youtube' ORDER BY created_at DESC LIMIT 5`) as any;
if (recentYT.length > 0) {
  console.log("Most recent 5:");
  recentYT.forEach((r: any) => console.log(`  "${r.name}" | keyword: ${r.keyword_matched} | channel: ${r.channel_name} | email: ${r.email || 'none'}`));
} else {
  console.log("  WARNING: NO YOUTUBE LEADS IN DB");
}

console.log("\n=== REDDIT LEADS (INTENT SIGNALS) ===");
const [rdCount] = await db.query(`SELECT COUNT(*) as cnt FROM lead_prospects WHERE source = 'reddit'`) as any;
console.log(`Total Reddit leads: ${rdCount[0].cnt}`);
const [recentRD] = await db.query(`SELECT name, keyword_matched, subreddit, email, created_at FROM lead_prospects WHERE source = 'reddit' ORDER BY created_at DESC LIMIT 5`) as any;
if (recentRD.length > 0) {
  console.log("Most recent 5:");
  recentRD.forEach((r: any) => console.log(`  "${r.name}" | keyword: ${r.keyword_matched} | r/${r.subreddit} | email: ${r.email || 'none'}`));
} else {
  console.log("  WARNING: NO REDDIT LEADS IN DB");
}

console.log("\n=== APOLLO LEADS ===");
const [apolloCount] = await db.query(`SELECT COUNT(*) as cnt FROM lead_prospects WHERE source = 'apollo'`) as any;
const [apolloWithEmail] = await db.query(`SELECT COUNT(*) as cnt FROM lead_prospects WHERE source = 'apollo' AND email IS NOT NULL AND email NOT LIKE '%email_not_unlocked%'`) as any;
console.log(`Apollo leads total: ${apolloCount[0].cnt}`);
console.log(`Apollo leads with real email: ${apolloWithEmail[0].cnt}`);
const [recentApollo] = await db.query(`SELECT name, email, job_title, company, created_at FROM lead_prospects WHERE source = 'apollo' ORDER BY created_at DESC LIMIT 5`) as any;
if (recentApollo.length > 0) {
  recentApollo.forEach((r: any) => console.log(`  "${r.name}" | ${r.email || 'no email'} | ${r.job_title || ''} @ ${r.company || ''}`));
}

console.log("\n=== APOLLO SYNC RUNS ===");
const [syncRuns] = await db.query(`SELECT COUNT(*) as cnt FROM apollo_sync_runs`) as any;
console.log(`Total sync run records: ${syncRuns[0].cnt}`);
if (syncRuns[0].cnt > 0) {
  const [lastRun] = await db.query(`SELECT status, leads_found, leads_saved, error_message, created_at FROM apollo_sync_runs ORDER BY created_at DESC LIMIT 3`) as any;
  lastRun.forEach((r: any) => console.log(`  ${r.status} | found:${r.leads_found} saved:${r.leads_saved} | ${r.created_at} | ${r.error_message || ''}`));
}

console.log("\n=== META CUSTOM AUDIENCES ===");
const [audiences] = await db.query(`SELECT name, audience_id, lead_count, last_synced FROM meta_custom_audiences ORDER BY last_synced DESC`) as any;
if (audiences.length > 0) {
  audiences.forEach((a: any) => console.log(`  "${a.name}" (ID:${a.audience_id}) | leads: ${a.lead_count} | last sync: ${a.last_synced}`));
} else {
  console.log("  No Meta custom audiences in DB");
}

console.log("\n=== YOUTUBE TRACKED CHANNELS ===");
const [channels] = await db.query(`SELECT channel_name, channel_id, is_active FROM youtube_tracked_channels`) as any;
console.log(`Tracked channels: ${channels.length}`);
channels.forEach((c: any) => console.log(`  ${c.is_active ? 'ACTIVE' : 'INACTIVE'} ${c.channel_name} (${c.channel_id})`));

console.log("\n=== REDDIT SCAN HISTORY ===");
try {
  const [scanHistory] = await db.query(`SELECT subreddit, posts_found, leads_created, status, created_at FROM reddit_scan_history ORDER BY created_at DESC LIMIT 5`) as any;
  if (scanHistory.length > 0) {
    scanHistory.forEach((r: any) => console.log(`  ${r.status} | r/${r.subreddit} | posts:${r.posts_found} leads:${r.leads_created} | ${r.created_at}`));
  } else {
    console.log("  No scan history records");
  }
} catch(e: any) {
  console.log(`  Table may not exist: ${e.message}`);
}

await db.end();
