/**
 * Immediately re-submit the four SEO-updated pages to Google Indexing API.
 * Runs directly against the DB + Google API (bypasses the HTTP webhook endpoint
 * to avoid any network timeout issues in the sandbox).
 */
import * as dotenv from "dotenv";
dotenv.config();

const pages = [
  "https://theurbanmonk.com/migrating-motor-complex/",
  "https://theurbanmonk.com/living-a-non-toxic-lifestyle-with-warren-phillips/",
  "https://theurbanmonk.com/exploring-sensuality-sexuality-and-spirituality-with-jaiya/",
  "https://theurbanmonk.com/improve-gut-health-naturally-b3tp/",
];

async function main() {
  const { createConnection } = await import("mysql2/promise");
  const conn = await createConnection(process.env.DATABASE_URL);

  // Get GSC refresh token
  const [rows] = await conn.execute(
    "SELECT gscRefreshToken FROM user_credentials WHERE userId = 1 LIMIT 1"
  );
  const refreshToken = rows[0]?.gscRefreshToken;
  if (!refreshToken) {
    console.error("❌ No GSC refresh token found. Connect Google Search Console first.");
    await conn.end();
    return;
  }

  // Get a fresh access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error("❌ Failed to get access token:", tokenData);
    await conn.end();
    return;
  }
  const accessToken = tokenData.access_token;
  console.log("✅ Got access token\n");

  // Submit each page
  for (const url of pages) {
    try {
      const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, type: "URL_UPDATED" }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ Submitted: ${url}`);
        // Log to DB
        await conn.execute(
          `INSERT INTO gsc_indexing_log (url, submitted_at, success, error_message)
           VALUES (?, NOW(), 1, NULL)
           ON DUPLICATE KEY UPDATE submitted_at = NOW(), success = 1, error_message = NULL`,
          [url]
        );
      } else {
        console.log(`⚠️  ${url}: ${data.error?.message || JSON.stringify(data)}`);
        await conn.execute(
          `INSERT INTO gsc_indexing_log (url, submitted_at, success, error_message)
           VALUES (?, NOW(), 0, ?)
           ON DUPLICATE KEY UPDATE submitted_at = NOW(), success = 0, error_message = ?`,
          [url, data.error?.message || "Unknown error", data.error?.message || "Unknown error"]
        );
      }
    } catch (e) {
      console.log(`❌ Error for ${url}: ${e.message}`);
    }
  }

  await conn.end();
  console.log("\n✅ Done. Google will re-crawl these pages within 1-7 days.");
}

main().catch(console.error);
