import { getDb } from '../server/db';
import { hostedLandingPages } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const SHOPIFY_URL = 'https://shop.theurbanmonk.com/products/kbmo-fit-22-gut-permeability-test-kit-with-consultation';

async function main() {
  const db = await getDb();
  if (!db) { console.log('no db'); return; }

  const [page] = await db.select({ id: hostedLandingPages.id, bodyCopy: hostedLandingPages.bodyCopy, ctaUrl: hostedLandingPages.ctaUrl })
    .from(hostedLandingPages)
    .where(eq(hostedLandingPages.id, 30001));

  if (!page) { console.log('page not found'); return; }

  // Update ctaUrl to Shopify
  await db.update(hostedLandingPages)
    .set({ ctaUrl: SHOPIFY_URL })
    .where(eq(hostedLandingPages.id, 30001));

  // Also update the offer box CTA button URL in body_copy
  let bodyCopy = page.bodyCopy || '';
  const oldUrl = 'https://theacademy.theurbanmonk.com/offers/3zvkMvds/checkout';
  if (bodyCopy.includes(oldUrl)) {
    bodyCopy = bodyCopy.replaceAll(oldUrl, SHOPIFY_URL);
    await db.update(hostedLandingPages).set({ bodyCopy }).where(eq(hostedLandingPages.id, 30001));
    console.log('✅ Updated offer box CTA URL to Shopify');
  } else {
    console.log('ℹ️  Old Kajabi URL not found in body_copy (may already be updated)');
  }
  console.log('✅ Updated ctaUrl to Shopify');
}
main().catch(console.error);
