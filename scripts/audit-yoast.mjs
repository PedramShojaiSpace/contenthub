import { readFileSync } from 'fs';

const text = readFileSync('/home/ubuntu/page_texts/theurbanmonk.com_heal-your-gut-for-good-beyond-elimination-diets-0nxd_.md', 'utf8');

// 1. Keyphrase density
const kw = 'heal your gut for good';
const kwRegex = new RegExp(kw, 'gi');
const kwMatches = text.match(kwRegex) || [];
console.log('=== KEYPHRASE DENSITY ===');
console.log(`Occurrences of "${kw}": ${kwMatches.length}`);
console.log('Yoast minimum for this length: 6');
// Show where each occurrence is
let idx = 0;
let count = 0;
const lowerText = text.toLowerCase();
while ((idx = lowerText.indexOf(kw, idx)) !== -1) {
  count++;
  const snippet = text.substring(Math.max(0, idx - 30), idx + kw.length + 30).replace(/\n/g, ' ');
  console.log(`  #${count} at char ${idx}: ...${snippet}...`);
  idx += kw.length;
}

// 2. All headings in the article
console.log('\n=== ALL HEADINGS ===');
const lines = text.split('\n');
lines.forEach((line, i) => {
  // Markdown headings
  if (line.startsWith('#')) {
    console.log(`Line ${i+1} [MD]: ${line}`);
  }
  // Standalone heading-like lines (short, no punctuation at end except ?)
  if (line.length > 10 && line.length < 100 && !line.startsWith(' ') && 
      !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('http') &&
      /^[A-Z]/.test(line) && !/[,.]$/.test(line) && i > 5 && i < 120) {
    console.log(`Line ${i+1} [H?]: ${line}`);
  }
});

// 3. SEO title analysis
const title = 'Heal Your Gut for Good: Beyond Elimination Diets';
const fullTitle = title + ' | The Urban Monk';
console.log('\n=== SEO TITLE ===');
console.log(`Title only: "${title}" (${title.length} chars)`);
console.log(`Full with site: "${fullTitle}" (${fullTitle.length} chars)`);
console.log('Yoast pixel limit ~580px ≈ 60 chars for average chars');
// Estimate pixel width (average char width ~8px for Arial 14px)
console.log(`Estimated pixels: ~${Math.round(fullTitle.length * 8)} px (limit: 580px)`);

// 4. Meta description
const metadesc = 'Discover why traditional elimination diets fail to heal your gut for good. Learn how to rebuild your gut ecosystem for lasting relief from bloating, fatigue, and brain fog.';
console.log('\n=== META DESCRIPTION ===');
console.log(`Length: ${metadesc.length} chars (limit: 156)`);
console.log(`Content: ${metadesc}`);

// 5. Check if keyphrase appears in subheadings
console.log('\n=== KEYPHRASE IN SUBHEADINGS CHECK ===');
const headingLines = lines.filter(l => l.startsWith('#') || (l.length > 10 && l.length < 100 && /^[A-Z]/.test(l) && !/[,.]$/.test(l)));
const kwInHeadings = headingLines.filter(h => h.toLowerCase().includes(kw));
console.log(`Headings containing "${kw}":`, kwInHeadings.length);
kwInHeadings.forEach(h => console.log('  -', h));
