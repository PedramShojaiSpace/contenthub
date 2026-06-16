import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ads_guardrails (
      id INT PRIMARY KEY AUTO_INCREMENT,
      target_cpl DECIMAL(10,2) NOT NULL DEFAULT 25.00,
      min_daily_budget DECIMAL(10,2) NOT NULL DEFAULT 20.00,
      max_daily_budget DECIMAL(10,2) NOT NULL DEFAULT 200.00,
      auto_scale_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      auto_pause_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      max_frequency_before_pause DECIMAL(4,1) NOT NULL DEFAULT 4.0,
      min_ctr_before_pause DECIMAL(5,2) NOT NULL DEFAULT 0.30,
      scale_up_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.20,
      min_spend_for_action DECIMAL(10,2) NOT NULL DEFAULT 5.00,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ ads_guardrails created");

  // Seed default row
  await conn.execute(`
    INSERT IGNORE INTO ads_guardrails (id, target_cpl, min_daily_budget, max_daily_budget)
    VALUES (1, 25.00, 20.00, 200.00)
  `);
  console.log("✅ ads_guardrails seeded with defaults");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ads_optimization_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      campaign_id VARCHAR(64) NOT NULL,
      campaign_name VARCHAR(256) NOT NULL,
      action VARCHAR(32) NOT NULL,
      reason TEXT NOT NULL,
      previous_budget DECIMAL(10,2),
      new_budget DECIMAL(10,2),
      metrics_snapshot TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_created_at (created_at)
    )
  `);
  console.log("✅ ads_optimization_logs created");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ads_weekly_digests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      week_start_date VARCHAR(16) NOT NULL,
      week_end_date VARCHAR(16) NOT NULL,
      digest_markdown TEXT NOT NULL,
      total_spend DECIMAL(12,2),
      total_leads INT,
      avg_cpl DECIMAL(10,2),
      campaign_count INT,
      actions_count INT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_week_start (week_start_date)
    )
  `);
  console.log("✅ ads_weekly_digests created");

  console.log("\n✅ All Phase 3 tables created successfully");
} catch (e) {
  console.error("❌ Error:", e.message);
  process.exit(1);
} finally {
  await conn.end();
}
