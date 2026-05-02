import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Get column names first
const [cols] = await conn.execute("DESCRIBE newsfeed_articles");
console.log("COLUMNS:", cols.map(c => c.Field).join(", "));

// Get a few rows
const [rows] = await conn.execute("SELECT * FROM newsfeed_articles ORDER BY id DESC LIMIT 3");
for (const row of rows) {
  console.log("\n--- Row id:", row.id, "---");
  console.log("url:", row.url);
  console.log("url length:", row.url?.length);
  console.log("commentary snippet:", row.commentary?.slice(0, 100));
}
await conn.end();
