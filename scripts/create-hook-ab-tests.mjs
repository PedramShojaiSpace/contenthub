import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

await conn.execute(`
  CREATE TABLE IF NOT EXISTS hook_ab_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hookGenerationId INT NOT NULL,
    campaignId VARCHAR(64) NOT NULL,
    adSetIds TEXT NOT NULL,
    adIds TEXT NOT NULL,
    topic TEXT NOT NULL,
    targetProduct VARCHAR(32) NOT NULL,
    dailyBudgetPerVariant DECIMAL(10,2) NOT NULL,
    testDurationDays INT NOT NULL DEFAULT 5,
    variantCount INT NOT NULL DEFAULT 5,
    hat_status ENUM('paused','active','completed','winner_selected') NOT NULL DEFAULT 'paused',
    winnerAdId VARCHAR(64),
    winnerFramework VARCHAR(64),
    winnerCtr DECIMAL(10,4),
    winnerCpl DECIMAL(10,2),
    promotedCampaignId VARCHAR(64),
    hat_createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hat_updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("✅ hook_ab_tests table created");
await conn.end();
