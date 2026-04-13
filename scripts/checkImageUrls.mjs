import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, platform, imageUrl FROM content_items WHERE platform = 'blog' LIMIT 5"
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
