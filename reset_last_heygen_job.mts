import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function resetLastHeyGenJob() {
  const db = await createConnection(process.env.DATABASE_URL!);
  try {
    // Find the most recent HeyGen job
    const [rows] = await db.execute(
      "SELECT id, video_job_status, vj_heygen_video_id, vj_production_path, vj_youtube_title FROM video_jobs WHERE vj_heygen_video_id IS NOT NULL ORDER BY id DESC LIMIT 5"
    );
    const jobs = rows as any[];

    if (jobs.length === 0) {
      console.log("No HeyGen jobs found.");
      return;
    }

    console.log("\nRecent HeyGen jobs:");
    jobs.forEach((j, i) => {
      console.log(`  ${i + 1}. ID: ${j.id} | Status: ${j.video_job_status} | Path: ${j.vj_production_path ?? "legacy"} | Title: ${j.vj_youtube_title ?? "(no title)"} | HeyGen: ${j.vj_heygen_video_id}`);
    });

    const targetJob = jobs[0];
    console.log(`\nResetting job ID ${targetJob.id} ("${targetJob.vj_youtube_title ?? "untitled"}") from "${targetJob.video_job_status}" to "pending"...`);

    await db.execute(
      `UPDATE video_jobs SET
        video_job_status = 'pending',
        vj_production_path = 'heygen_then_descript',
        video_production_path = 'heygen_then_descript',
        vj_retry_count = 0,
        vj_error_message = NULL,
        vj_heygen_video_id = NULL,
        vj_descript_project_id = NULL,
        vj_descript_import_job_id = NULL,
        vj_descript_agent_job_id = NULL,
        vj_descript_publish_job_id = NULL,
        vj_descript_share_url = NULL,
        vj_descript_download_url = NULL,
        vj_s3_video_key = NULL,
        vj_s3_video_url = NULL,
        vj_youtube_video_id = NULL,
        vj_yt_upload_uri = NULL,
        vj_yt_upload_offset = NULL,
        vj_updated_at = NOW()
      WHERE id = ?`,
      [targetJob.id]
    );

    console.log(`\nSUCCESS: Job ${targetJob.id} reset to "pending" with production path = "heygen_then_descript"`);
    console.log(`\nNext step: Go to VA Dashboard -> find this job -> click "Generate Avatar Video"`);
    console.log(`Make sure "HeyGen + Descript (B-roll)" is selected in the dropdown.`);
  } finally {
    await db.end();
  }
}

resetLastHeyGenJob().catch(console.error);
