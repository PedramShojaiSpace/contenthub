import "dotenv/config";
import { getDb } from "../server/db";
import { hostedLandingPages } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB connection"); process.exit(1); }
  const pages = await db.select({
    id: hostedLandingPages.id,
    campaign: hostedLandingPages.campaign,
    slug: hostedLandingPages.slug,
    status: hostedLandingPages.status,
    title: hostedLandingPages.title,
  }).from(hostedLandingPages);
  console.log(JSON.stringify(pages, null, 2));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
