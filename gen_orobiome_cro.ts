import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

import { renderAdvertorialHtml } from './server/advertorialRouter';

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  const [rows] = await conn.execute('SELECT * FROM advertorial_pages WHERE slug LIKE "%orobiome%" LIMIT 1') as any;
  const r = rows[0];
  await conn.end();

  const page = {
    id: r.id,
    slug: r.slug,
    topic: r.topic,
    campaign: r.campaign,
    status: r.adv_status as any,
    publicationName: r.publication_name,
    authorName: r.author_name,
    readTime: r.read_time,
    headline: r.headline,
    subheadline: r.subheadline,
    mechanismAngle: r.mechanism_angle,
    bodyHtml: r.body_html,
    ctaText: r.cta_text,
    ctaSubtext: r.cta_subtext,
    ctaUrl: r.cta_url,
    heroImageUrl: r.hero_image_url,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    metaPixelId: r.meta_pixel_id,
    ga4Id: r.ga4_id,
    generationPrompt: r.generation_prompt,
    generationModel: r.generation_model,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
  };

  console.log('Page:', page.headline);
  console.log('CTA URL:', page.ctaUrl);

  const fullHtml = renderAdvertorialHtml(page);
  console.log('Full HTML length:', fullHtml.length);

  // Extract body content (strip html/head/body wrapper)
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1].trim();
    console.log('Body content length:', bodyContent.length);
    fs.writeFileSync('/tmp/orobiome_shopify_cro.html', bodyContent, 'utf8');
    console.log('Written to /tmp/orobiome_shopify_cro.html');
    console.log('First 300 chars:', bodyContent.substring(0, 300));
  } else {
    console.log('No body tag found');
  }
}

main().catch(console.error);
