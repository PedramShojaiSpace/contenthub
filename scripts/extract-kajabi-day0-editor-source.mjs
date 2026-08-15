import { readFile } from "node:fs/promises";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: node scripts/extract-kajabi-day0-editor-source.mjs <captured-browser-html>");
}

const html = await readFile(inputPath, "utf8");
const textareaMatch = html.match(/<textarea[^>]+id=["']mceu_40["'][^>]*>([\s\S]*?)<\/textarea>/i);

if (!textareaMatch) {
  console.log(JSON.stringify({ found: false, reason: "Source textarea was not serialized into the browser capture." }, null, 2));
  process.exit(0);
}

const decode = (value) => value
  .replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&amp;", "&");

const source = decode(textareaMatch[1]);
const hrefs = [...source.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
console.log(JSON.stringify({
  found: true,
  hrefs,
  sourceLength: source.length,
  source,
}, null, 2));
