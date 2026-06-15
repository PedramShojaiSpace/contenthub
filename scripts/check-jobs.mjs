import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

// Load env
try {
  const envContent = readFileSync("/home/ubuntu/lights-on-optin/.env", "utf8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const conn = await createConnection(url);

const [rows] = await conn.execute(
  `SELECT id, video_job_status, vj_youtube_video_id, vj_error_message,
   LEFT(vj_descript_download_url, 200) as dl_url,
   LEFT(vj_s3_video_url, 200) as s3_url,
   LEFT(vj_descript_share_url, 200) as share_url,
   vj_descript_project_id
   FROM video_jobs ORDER BY id DESC LIMIT 8`
);

for (const row of rows) {
  console.log("─".repeat(80));
  console.log(`Job #${row.id} | status: ${row.video_job_status} | yt_id: ${row.vj_youtube_video_id ?? "none"}`);
  console.log(`  dl_url:    ${row.dl_url ?? "(null)"}`);
  console.log(`  s3_url:    ${row.s3_url ?? "(null)"}`);
  console.log(`  share_url: ${row.share_url ?? "(null)"}`);
  console.log(`  project:   ${row.vj_descript_project_id ?? "(null)"}`);
  if (row.vj_error_message) console.log(`  ERROR:     ${row.vj_error_message}`);
}

await conn.end();
