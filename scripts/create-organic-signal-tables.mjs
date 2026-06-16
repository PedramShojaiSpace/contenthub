import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS video_engagement_snapshots (
      ves_id INT AUTO_INCREMENT PRIMARY KEY,
      ves_video_job_id INT NOT NULL,
      ves_yt_video_id VARCHAR(64) NOT NULL,
      ves_snapshot_hour INT NOT NULL,
      ves_view_count INT NOT NULL DEFAULT 0,
      ves_like_count INT NOT NULL DEFAULT 0,
      ves_comment_count INT NOT NULL DEFAULT 0,
      ves_view_velocity INT NOT NULL DEFAULT 0,
      ves_engagement_rate VARCHAR(16),
      ves_outlier_score VARCHAR(16),
      ves_captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ video_engagement_snapshots created");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS paid_promo_candidates (
      ppc_id INT AUTO_INCREMENT PRIMARY KEY,
      ppc_video_job_id INT NOT NULL,
      ppc_yt_video_id VARCHAR(64) NOT NULL,
      ppc_yt_title VARCHAR(512),
      ppc_yt_thumbnail_url TEXT,
      ppc_view_count INT NOT NULL DEFAULT 0,
      ppc_like_count INT NOT NULL DEFAULT 0,
      ppc_comment_count INT NOT NULL DEFAULT 0,
      ppc_view_velocity INT NOT NULL DEFAULT 0,
      ppc_engagement_rate VARCHAR(16),
      ppc_outlier_score VARCHAR(16),
      ppc_signal_strength ENUM('strong','exceptional') NOT NULL,
      ppc_flagged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ppc_claude_recommendation TEXT,
      ppc_rec_generated_at TIMESTAMP NULL,
      ppc_status ENUM('flagged','recommended','approved','launched','dismissed') NOT NULL DEFAULT 'flagged',
      ppc_meta_campaign_id VARCHAR(64),
      ppc_meta_adset_id VARCHAR(64),
      ppc_meta_ad_id VARCHAR(64),
      ppc_launched_at TIMESTAMP NULL,
      ppc_launched_by VARCHAR(128),
      ppc_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ppc_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ paid_promo_candidates created");

  // Verify
  const [rows] = await conn.execute("SHOW TABLES LIKE 'video_engagement_snapshots'");
  const [rows2] = await conn.execute("SHOW TABLES LIKE 'paid_promo_candidates'");
  console.log("Tables verified:", rows.length > 0 && rows2.length > 0 ? "OK" : "MISSING");
} finally {
  await conn.end();
}
