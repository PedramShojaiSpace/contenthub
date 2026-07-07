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

  const fullHtml = renderAdvertorialHtml(page);

  // Extract the <style> block and Google Fonts <link> tags from <head>
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);

  if (!headMatch || !bodyMatch) {
    throw new Error('Could not find head or body tags');
  }

  const headContent = headMatch[1];
  const bodyContent = bodyMatch[1].trim();

  // Extract Google Fonts link tags
  const fontLinks = (headContent.match(/<link[^>]+fonts\.googleapis[^>]*>/g) || []).join('\n');
  const fontPreconnects = (headContent.match(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g) || []).join('\n');

  // Extract the <style> block
  const styleMatch = headContent.match(/<style>([\s\S]*?)<\/style>/i);
  const styleBlock = styleMatch ? `<style>${styleMatch[1]}</style>` : '';

  // Build the Shopify page body: font links + style block + body content
  const shopifyBody = [
    '<!-- Urban Monk Advertorial: orobiome — Full CRO Version -->',
    '<!-- Pushed via Admin API — style block preserved -->',
    fontPreconnects,
    fontLinks,
    styleBlock,
    bodyContent
  ].filter(Boolean).join('\n');

  console.log('Shopify body length:', shopifyBody.length);
  console.log('Has style block:', shopifyBody.includes('<style>'));
  console.log('Has Cormorant font:', shopifyBody.includes('Cormorant'));
  console.log('Has sticky bar:', shopifyBody.includes('sticky-bar'));
  console.log('Has testimonials:', shopifyBody.includes('testimonial-card'));
  console.log('Has FAQ:', shopifyBody.includes('faq-section'));

  fs.writeFileSync('/tmp/orobiome_shopify_cro_v2.html', shopifyBody, 'utf8');
  console.log('\nWritten to /tmp/orobiome_shopify_cro_v2.html');
  console.log('First 400 chars:');
  console.log(shopifyBody.substring(0, 400));
}

main().catch(console.error);
