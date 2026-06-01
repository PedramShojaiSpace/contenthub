/**
 * Test script: simulate bulkFixYoastIssues to reproduce the "AI is not able to generate the fix" error
 */
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const WP_BASE_URL = (process.env.WORDPRESS_URL ?? '').replace(/\/$/, '');
const WP_AUTH = Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString('base64');

async function fetchSingleWpPost(wpPostId) {
  const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/posts/${wpPostId}?context=edit`, {
    headers: { Authorization: `Basic ${WP_AUTH}` }
  });
  if (!res.ok) throw new Error(`WP fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = data.content?.raw ?? data.content?.rendered ?? '';
  const meta = data.meta ?? {};
  return {
    content,
    focusKeyword: meta['_yoast_wpseo_focuskw'] ?? null,
    metaDescription: meta['_yoast_wpseo_metadesc'] ?? null,
    seoTitle: meta['_yoast_wpseo_title'] ?? null,
  };
}

async function updateWpPostYoast(params) {
  const yoastMeta = {};
  const yoastMetaUnderscore = {};
  if (params.seoTitle) {
    yoastMeta['yoast_wpseo_title'] = params.seoTitle;
    yoastMetaUnderscore['_yoast_wpseo_title'] = params.seoTitle;
  }
  if (params.metaDescription) {
    yoastMeta['yoast_wpseo_metadesc'] = params.metaDescription;
    yoastMetaUnderscore['_yoast_wpseo_metadesc'] = params.metaDescription;
  }
  if (params.focusKeyword) {
    yoastMeta['yoast_wpseo_focuskw'] = params.focusKeyword;
    yoastMetaUnderscore['_yoast_wpseo_focuskw'] = params.focusKeyword;
  }
  const body = { yoast_meta: yoastMeta, meta: yoastMetaUnderscore };
  const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/posts/${params.wpPostId}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WP Yoast update failed: ${res.status} ${await res.text()}`);
  return { success: true };
}

function trimToWordBoundary(s, maxLen) {
  if (s.length <= maxLen) return s;
  let t = s.slice(0, maxLen);
  const sp = t.lastIndexOf(' ');
  if (sp > 0) t = t.slice(0, sp);
  return t.trimEnd().replace(/[,;:\-\u2013\u2014]$/, '').trimEnd();
}

async function main() {
  // Test with 3 red posts
  const testPosts = [
    { id: 180005, wpPostId: 9577, focusKeyword: 'evidence-based wellness', yoastMetaDescription: 'Ambitious professionals, conquer burnout with evidence-based wellness. Bridge ancient wisdom & modern science to thrive. Reclaim your energy now!', title: 'Beyond the Hype' },
    { id: 270001, wpPostId: 9773, focusKeyword: 'sleep optimization', yoastMetaDescription: 'Unlock peak performance & well-being. This guide to sleep optimization recharges energy, boosts mental clarity, and enhances overall health. Start.', title: 'Sleep Optimization' },
    { id: 270007, wpPostId: 9716, focusKeyword: 'gut barrier permeability', yoastMetaDescription: 'Unmasking the root cause of gut barrier permeability and how it affects your overall health.', title: 'Gut Barrier Permeability' },
  ];

  for (const item of testPosts) {
    console.log(`\nProcessing: "${item.title}" WP#${item.wpPostId}`);
    try {
      const livePost = await fetchSingleWpPost(item.wpPostId);
      console.log(`  Fetched OK, content length: ${livePost.content.length}`);

      const focusKw = item.focusKeyword;
      let wpHtmlBody = livePost.content;
      let metaDesc = item.yoastMetaDescription ?? livePost.metaDescription ?? '';
      const seoTitle = item.title + ' | The Urban Monk';

      // H2 keyphrase injection
      const kw = focusKw.toLowerCase();
      const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const kwRegex = new RegExp(`(?:^|[^a-z0-9])${kwEscaped}(?:[^a-z0-9]|$)`, 'i');
      const htmlHeadingRegex = /<(h[23])(\s[^>]*)?>((?:[\s\S])*?)<\/h[23]>/gi;
      const htmlHeadings = Array.from(wpHtmlBody.matchAll(htmlHeadingRegex));
      const htmlH2s = htmlHeadings.filter(m => m[1].toLowerCase() === 'h2');
      const stripTags = s => s.replace(/<[^>]+>/g, '').trim();
      const keyphraseInSubheading = htmlHeadings.some(m => kwRegex.test(stripTags(m[3])));

      console.log(`  H2s: ${htmlH2s.length}, Keyphrase in H2: ${keyphraseInSubheading}`);

      const fixedFields = [];
      if (!keyphraseInSubheading && (htmlH2s.length > 0 || htmlHeadings.length > 0)) {
        const targetIndex = htmlH2s.length >= 3 ? 2 : htmlH2s.length >= 2 ? 1 : 0;
        const targetMatch = htmlH2s[targetIndex] ?? htmlHeadings[0];
        if (targetMatch) {
          const originalTag = targetMatch[0];
          const tagName = targetMatch[1];
          const tagAttrs = targetMatch[2] ?? '';
          const headingText = stripTags(targetMatch[3]);
          const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
          const candidateText = `${kwCapitalised}: ${headingText}`;
          const finalText = candidateText.length <= 80 ? candidateText : kwCapitalised;
          const finalTag = `<${tagName}${tagAttrs}>${finalText}</${tagName}>`;
          const escapedOriginal = originalTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          wpHtmlBody = wpHtmlBody.replace(new RegExp(escapedOriginal), finalTag);
          fixedFields.push('h2_keyphrase_injected');
          console.log(`  Injected keyphrase into H2: "${finalText}"`);
        }
      }

      // Meta desc enforcement
      if (focusKw && metaDesc) {
        const kwLower = focusKw.toLowerCase();
        const hasKw = metaDesc.toLowerCase().includes(kwLower);
        if (!hasKw) {
          const prefix = `${focusKw}: `;
          const maxBodyLen = 148 - prefix.length;
          const trimmedBody = trimToWordBoundary(metaDesc, maxBodyLen);
          metaDesc = (prefix + trimmedBody).trimEnd().replace(/[,;:\-\u2013\u2014]$/, '').trimEnd();
          fixedFields.push('meta_desc_keyphrase_prepended');
        } else {
          const trimmed = trimToWordBoundary(metaDesc, 148);
          if (trimmed !== metaDesc) { metaDesc = trimmed; fixedFields.push('meta_desc_trimmed'); }
        }
      }
      if (metaDesc.length > 155) {
        const sp = metaDesc.slice(0, 148).lastIndexOf(' ');
        metaDesc = (sp > 0 ? metaDesc.slice(0, sp) : metaDesc.slice(0, 148)).trimEnd().replace(/[,;:\-\u2013\u2014]$/, '').trimEnd();
        fixedFields.push('meta_desc_force_truncated');
      }

      console.log(`  Fixed fields: ${fixedFields.join(', ') || 'none'}`);
      console.log(`  Meta desc length: ${metaDesc.length}`);

      // Push to WordPress
      await updateWpPostYoast({ wpPostId: item.wpPostId, seoTitle, metaDescription: metaDesc, focusKeyword: focusKw });
      console.log(`  ✅ Yoast update pushed to WP`);

    } catch (e) {
      console.error(`  ❌ ERROR: ${e.message}`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
