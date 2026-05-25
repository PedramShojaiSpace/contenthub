import * as dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '/home/ubuntu/lights-on-optin/.env' });

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Get all published blog posts
const [rows] = await db.execute(
  `SELECT id, title, wpPostId, publishUrl, textContent, yoastSeoTitle, focusKeyword, yoastMetaDescription
   FROM content_items 
   WHERE platform = 'blog' AND status = 'published'
   ORDER BY updatedAt DESC`
);

console.log(`\n=== Auditing ${rows.length} published blog posts ===\n`);

const issues = [];

for (const row of rows) {
  const body = row.textContent || '';
  const rowIssues = [];

  // Check for raw HTML tags (other than the hidden schema div which is intentional)
  const htmlTagsExcludingSchema = body
    .replace(/<div class="schema-faq-data"[^>]*>[\s\S]*?<\/div>/g, '')
    .replace(/<div class="um-cta-banner"[^>]*>[\s\S]*?<\/div>/g, '');
  
  const rawHtmlMatch = htmlTagsExcludingSchema.match(/<[a-z][^>]*>/i);
  if (rawHtmlMatch) {
    rowIssues.push(`RAW HTML: ${rawHtmlMatch[0].substring(0, 80)}`);
  }

  // Check for JSON blob (starts with { and has @type or "article" key)
  const trimmed = body.trim();
  if (trimmed.startsWith('{') && (trimmed.includes('"@type"') || trimmed.includes('"article"') || trimmed.includes('"title"'))) {
    rowIssues.push(`JSON BLOB: starts with { — likely raw LLM response`);
  }

  // Check for markdown code fences (```) that shouldn't be in final content
  if (body.includes('```json') || body.includes('```markdown')) {
    rowIssues.push(`CODE FENCE: contains \`\`\`json or \`\`\`markdown`);
  }

  // Check for duplicate keyphrase in SEO title
  if (row.focusKeyword && row.yoastSeoTitle) {
    const kw = row.focusKeyword.toLowerCase();
    const title = row.yoastSeoTitle.toLowerCase();
    const firstIdx = title.indexOf(kw);
    const secondIdx = title.indexOf(kw, firstIdx + 1);
    if (firstIdx !== -1 && secondIdx !== -1) {
      rowIssues.push(`DUPLICATE KW in SEO title: "${row.yoastSeoTitle}"`);
    }
  }

  // Check SEO title length
  if (row.yoastSeoTitle && row.yoastSeoTitle.length > 70) {
    rowIssues.push(`SEO TITLE TOO LONG: ${row.yoastSeoTitle.length} chars — "${row.yoastSeoTitle.substring(0, 70)}..."`);
  }

  // Check meta description length
  if (row.yoastMetaDescription && row.yoastMetaDescription.length > 160) {
    rowIssues.push(`META DESC TOO LONG: ${row.yoastMetaDescription.length} chars`);
  }

  if (rowIssues.length > 0) {
    issues.push({ id: row.id, title: row.title, wpPostId: row.wpPostId, issues: rowIssues });
  }
}

if (issues.length === 0) {
  console.log('✅ ALL CLEAR — No issues found in any published post.\n');
} else {
  console.log(`⚠️  Found issues in ${issues.length} posts:\n`);
  for (const item of issues) {
    console.log(`  [ID ${item.id}] "${item.title}" (WP: ${item.wpPostId})`);
    for (const issue of item.issues) {
      console.log(`    ❌ ${issue}`);
    }
    console.log('');
  }
}

// Also check a sample of live WordPress posts via API
console.log('\n=== Checking 5 most recent live WP posts via REST API ===\n');
const recentWithWP = rows.filter(r => r.wpPostId).slice(0, 5);

for (const row of recentWithWP) {
  try {
    const wpUrl = process.env.WORDPRESS_URL?.replace(/\/$/, '');
    const auth = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64');
    const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${row.wpPostId}?context=edit`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) {
      console.log(`  [WP ${row.wpPostId}] "${row.title}" — HTTP ${res.status}`);
      continue;
    }
    const post = await res.json();
    const wpContent = post.content?.raw || '';
    
    // Check for visible raw HTML in WP content (excluding intentional hidden divs)
    const wpContentClean = wpContent
      .replace(/<div class="schema-faq-data"[^>]*>[\s\S]*?<\/div>/g, '[FAQ-SCHEMA-OK]')
      .replace(/<div class="um-cta-banner"[^>]*>[\s\S]*?<\/div>/g, '[CTA-BANNER-OK]');
    
    // Check if content has unrendered HTML-like strings (e.g. &lt;div&gt;)
    const hasEscapedHtml = wpContentClean.includes('&lt;div') || wpContentClean.includes('&lt;a ');
    const hasCTAVisible = wpContent.includes('<div class="um-cta-banner"');
    const hasFaqSchema = wpContent.includes('schema-faq-data');
    
    const status = [];
    if (hasEscapedHtml) status.push('⚠️ ESCAPED HTML visible');
    if (hasCTAVisible) status.push('✅ CTA banner present');
    if (hasFaqSchema) status.push('✅ FAQ schema present');
    if (!hasCTAVisible) status.push('ℹ️ No CTA banner');
    if (!hasFaqSchema) status.push('ℹ️ No FAQ schema');
    
    console.log(`  [WP ${row.wpPostId}] "${row.title.substring(0, 50)}"`);
    console.log(`    ${status.join(' | ')}`);
    console.log(`    Content length: ${wpContent.length} chars`);
  } catch (e) {
    console.log(`  [WP ${row.wpPostId}] Error: ${e.message}`);
  }
}

await db.end();
console.log('\n=== Audit complete ===\n');
