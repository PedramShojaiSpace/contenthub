import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const db = await createConnection(process.env.DATABASE_URL);

const subreddits = [
  { name: "taoism",       category: "tcm" },
  { name: "SIBO",         category: "gut-health" },
  { name: "GutHealth",    category: "gut-health" },
  { name: "sleephackers", category: "sleep" },
  { name: "Qigong",       category: "tcm" },
];

for (const sub of subreddits) {
  try {
    await db.execute(
      "INSERT IGNORE INTO reddit_subreddits (subreddit, category, isActive, createdAt) VALUES (?, ?, 1, NOW())",
      [sub.name, sub.category]
    );
    console.log(`✓ Added r/${sub.name} (${sub.category})`);
  } catch (e) {
    console.error(`✗ Failed r/${sub.name}:`, e.message);
  }
}

// Verify
const [rows] = await db.execute("SELECT subreddit, category FROM reddit_subreddits ORDER BY createdAt DESC LIMIT 10");
console.log("\nLatest subreddits:", rows);

await db.end();
