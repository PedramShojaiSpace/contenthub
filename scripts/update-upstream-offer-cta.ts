import { getDb } from '../server/db';
import { hostedLandingPages } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('no db'); return; }

  // Get current body copy
  const [page] = await db.select({ id: hostedLandingPages.id, bodyCopy: hostedLandingPages.bodyCopy, ctaUrl: hostedLandingPages.ctaUrl })
    .from(hostedLandingPages)
    .where(eq(hostedLandingPages.id, 30001));

  if (!page) { console.log('page not found'); return; }

  const ctaUrl = page.ctaUrl || 'https://theacademy.theurbanmonk.com/offers/3zvkMvds/checkout';
  let bodyCopy = page.bodyCopy || '';

  // Replace the offer-price div (static price display) with price + CTA button
  const oldPriceBlock = `<div class="offer-price"><div class="offer-price-amount">$399</div><div class="offer-price-label">One-time. Ships to your door. No subscription.</div></div>`;
  const newPriceBlock = `<div class="offer-price"><div class="offer-price-amount">$399</div><div class="offer-price-label">One-time. Ships to your door. No subscription.</div><a href="${ctaUrl}" class="offer-cta-btn" onclick="if(typeof fbq!=='undefined')fbq('track','InitiateCheckout')">Get Your Diagnostic Kit &rsaquo;</a></div>`;

  if (bodyCopy.includes(oldPriceBlock)) {
    bodyCopy = bodyCopy.replace(oldPriceBlock, newPriceBlock);
    await db.update(hostedLandingPages).set({ bodyCopy }).where(eq(hostedLandingPages.id, 30001));
    console.log('✅ Updated offer box with CTA button');
  } else {
    console.log('⚠️  Could not find offer-price block in body copy. Current body copy snippet:');
    const idx = bodyCopy.indexOf('offer-price');
    console.log(bodyCopy.substring(Math.max(0, idx - 50), idx + 200));
  }
}

main().catch(console.error);
