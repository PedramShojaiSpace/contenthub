import { getDb } from '../server/db';
import { hostedLandingPages } from '../drizzle/schema';
import { like } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('no db'); return; }
  const rows = await db.select({ id: hostedLandingPages.id, slug: hostedLandingPages.slug, ctaUrl: hostedLandingPages.ctaUrl, ctaSubtext: hostedLandingPages.ctaSubtext }).from(hostedLandingPages).where(like(hostedLandingPages.slug, '%program%'));
  console.log(JSON.stringify(rows, null, 2));
}
main().catch(console.error);
