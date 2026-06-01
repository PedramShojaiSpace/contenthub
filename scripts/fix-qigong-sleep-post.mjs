/**
 * One-off: run the Internal Link Optimizer against WP#9876 (qigong-for-sleep)
 * which was published before the bug fix.
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const WP_BASE_URL = (process.env.WORDPRESS_URL ?? '').replace(/\/$/, '');
const WP_AUTH = Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString('base64');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','for','of','in','on','at','to','with','by','from',
  'is','are','was','were','be','been','your','my','our','their','its','how','what',
  'why','when','that','this','these','those','not','no','so','as','if',
]);

function buildAnchorCandidates(focusKeyword) {
  const kw = focusKeyword.toLowerCase().trim();
  const words = kw.split(/\s+/);
  const candidates = [kw];
  const contentWords = words.filter(w => !STOP_WORDS.has(w));
  if (contentWords.length >= 2) {
    candidates.push(contentWords.join(' '));
    if (contentWords.length > 2) candidates.push(contentWords.slice(0, 2).join(' '));
    if (contentWords.length > 2) candidates.push(contentWords.slice(-2).join(' '));
  }
  const longest = [...contentWords].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length > 5) candidates.push(longest);
  return Array.from(new Set(candidates));
}

function smartInjectLink(html, focusKeyword, targetUrl) {
  if (html.includes(targetUrl)) return { success: false, html, reason: 'url-exists' };
  const candidates = buildAnchorCandidates(focusKeyword);
  for (const candidate of candidates) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!<[^>]*)(${escaped})(?![^<]*>)`, 'i');
    const match = html.match(regex);
    if (match) {
      const newHtml = html.replace(regex, `<a href="${targetUrl}" title="${candidate}">${match[1]}</a>`);
      if (newHtml !== html) return { success: true, html: newHtml, usedAnchor: candidate };
    }
  }
  return { success: false, html, reason: 'phrase-not-found' };
}

function addRelatedReadingEntry(pillarHtml, title, url) {
  const newEntry = `<li><a href="${url}">${title}</a></li>`;
  const regex = /(<!-- related-reading -->[\s\S]*?<ul[^>]*>)([\s\S]*?)(<\/ul>)/i;
  if (regex.test(pillarHtml)) {
    return pillarHtml.replace(regex, (_, open, existing, close) => {
      if (existing.includes(url)) return _;
      return `${open}${existing}    ${newEntry}\n  ${close}`;
    });
  }
  const section = `\n<!-- related-reading -->\n<div class="related-reading" style="margin-top:2rem;padding:1.5rem;background:#f9f5f0;border-left:4px solid #c8a96e;border-radius:4px;">\n  <h3 style="margin:0 0 0.75rem;font-size:1.1rem;color:#2d2d2d;">Related Reading</h3>\n  <ul style="margin:0;padding-left:1.25rem;">\n    ${newEntry}\n  </ul>\n</div>`;
  return pillarHtml.includes('</article>') ? pillarHtml.replace('</article>', section + '\n</article>') : pillarHtml + section;
}

async function wpGet(path) {
  const res = await fetch(WP_BASE_URL + path, { headers: { Authorization: 'Basic ' + WP_AUTH } });
  return res.json();
}
async function wpPost(path, body) {
  const res = await fetch(WP_BASE_URL + path, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + WP_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function resolveSlug(url) {
  const pMatch = url.match(/[?&]p=(\d+)/);
  if (pMatch) return parseInt(pMatch[1]);
  const slug = new URL(url).pathname.replace(/^\/|\/$/g, '').split('/').pop();
  const posts = await wpGet(`/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&per_page=1&context=edit`);
  return posts[0]?.id ?? null;
}

async function main() {
  const NEW_WP_ID = 9876;
  const NEW_FOCUS_KW = 'qigong for sleep';
  const NEW_URL = 'https://theurbanmonk.com/qigong-for-sleep-deep-rest-energy-vsvk/';

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get campaign ID
  const [targets] = await conn.execute(
    'SELECT kt_campaign_id FROM keyword_targets WHERE kt_keyword = ? LIMIT 1',
    [NEW_FOCUS_KW]
  );
  if (!targets.length) { console.log('No campaign found'); await conn.end(); return; }
  const campaignId = targets[0].kt_campaign_id;
  console.log('Campaign ID:', campaignId);

  // Get all sibling targets
  const [siblings] = await conn.execute(
    `SELECT kt_keyword, kt_keyword_type, kt_published_url FROM keyword_targets
     WHERE kt_campaign_id = ? AND kt_content_status = 'published' AND kt_published_url IS NOT NULL AND kt_keyword != ?`,
    [campaignId, NEW_FOCUS_KW]
  );
  console.log('Siblings:', siblings.length);

  // Resolve WP IDs
  const resolved = [];
  for (const s of siblings) {
    await sleep(200);
    const wpId = await resolveSlug(s.kt_published_url);
    if (!wpId) { console.log('  ❌ No WP ID for', s.kt_keyword); continue; }
    const post = await wpGet(`/wp-json/wp/v2/posts/${wpId}?context=edit`);
    resolved.push({
      wpPostId: wpId,
      title: post.title?.rendered ?? s.kt_keyword,
      url: s.kt_published_url,
      focusKeyword: s.kt_keyword,
      keywordType: s.kt_keyword_type,
    });
    console.log(`  ✓ WP#${wpId} [${s.kt_keyword_type}] "${s.kt_keyword}"`);
  }

  await conn.end();

  // Identify pillar
  let pillar = resolved.find(p => p.keywordType === 'pillar');
  if (!pillar) pillar = resolved.reduce((a, b) => a.focusKeyword.length <= b.focusKeyword.length ? a : b);
  console.log('\nPillar:', pillar.focusKeyword, 'WP#' + pillar.wpPostId);

  // Fetch new post HTML
  const newPost = await wpGet(`/wp-json/wp/v2/posts/${NEW_WP_ID}?context=edit`);
  let html = newPost.content?.raw ?? '';
  const newTitle = newPost.title?.rendered ?? 'Qigong for Sleep';
  console.log('\nNew post content length:', html.length);

  // Inject links
  const others = resolved.filter(p => p.wpPostId !== pillar.wpPostId).slice(0, 2);
  const candidates = [pillar, ...others];
  let linksAdded = 0;

  for (const c of candidates) {
    const result = smartInjectLink(html, c.focusKeyword, c.url);
    if (result.success) {
      html = result.html;
      linksAdded++;
      console.log(`✅ Injected "${result.usedAnchor}" → ${c.url}`);
    } else {
      console.log(`⏭️  Skipped "${c.focusKeyword}" (${result.reason})`);
    }
  }

  if (linksAdded > 0) {
    await sleep(300);
    await wpPost(`/wp-json/wp/v2/posts/${NEW_WP_ID}`, { content: html });
    console.log(`💾 Saved ${linksAdded} links to WP#${NEW_WP_ID}`);
  }

  // Update pillar Related Reading
  console.log('\nUpdating pillar Related Reading...');
  await sleep(300);
  const pillarPost = await wpGet(`/wp-json/wp/v2/posts/${pillar.wpPostId}?context=edit`);
  const pillarHtml = pillarPost.content?.raw ?? '';
  const updatedPillar = addRelatedReadingEntry(pillarHtml, newTitle, NEW_URL);
  if (updatedPillar !== pillarHtml) {
    await sleep(300);
    await wpPost(`/wp-json/wp/v2/posts/${pillar.wpPostId}`, { content: updatedPillar });
    console.log('✅ Pillar Related Reading updated');
  } else {
    console.log('ℹ️  Pillar already up to date');
  }

  console.log('\n✅ Done');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
