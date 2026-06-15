/**
 * One-time script: Reset job #30003 from 'uploading' back to 'ready_for_review'
 * and clear the stale Descript download URL so the next approval triggers a fresh export.
 */
import { createConnection } from "mysql2/promise";
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

// Reset job 30003: clear stale download URL, set back to ready_for_review
const [result] = await conn.execute(
  `UPDATE video_jobs 
   SET video_job_status = 'ready_for_review',
       vj_descript_download_url = NULL,
       vj_error_message = NULL
   WHERE id = 30003 AND video_job_status = 'uploading'`
);

console.log(`Updated rows: ${result.affectedRows}`);

// Verify
const [rows] = await conn.execute(
  `SELECT id, video_job_status, vj_descript_download_url, vj_error_message FROM video_jobs WHERE id = 30003`
);
console.log("Job #30003 state after reset:", rows[0]);

await conn.end();
console.log("Done. Job #30003 is now ready_for_review — approve it in the VA Dashboard to trigger a fresh Descript export + YouTube upload.");
