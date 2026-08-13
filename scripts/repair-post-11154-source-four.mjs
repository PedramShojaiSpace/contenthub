import { readFileSync } from "node:fs";

const servicePid = process.env.SERVICE_PID;
const shouldApply = process.argv.includes("--apply");
if (!servicePid) throw new Error("SERVICE_PID is required");

const credentials = Object.fromEntries(
  readFileSync(`/proc/${servicePid}/environ`, "utf8")
    .split("\0")
    .filter(Boolean)
    .map(entry => {
      const separator = entry.indexOf("=");
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    })
    .filter(([key]) => ["WORDPRESS_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"].includes(key))
);

const baseUrl = String(credentials.WORDPRESS_URL ?? "").replace(/\/$/, "");
const authorization = `Basic ${Buffer.from(`${credentials.WORDPRESS_USERNAME}:${credentials.WORDPRESS_APP_PASSWORD}`).toString("base64")}`;
const request = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: authorization, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url} failed: HTTP ${response.status}`);
  return response.json();
};

const post = await request(`${baseUrl}/wp-json/wp/v2/posts/11154?context=edit`);
if (post.status !== "publish") throw new Error(`Expected a published post; found ${post.status}.`);
const original = post.content?.raw ?? "";
const bullet = "<li>Replace plastic food containers with glass</li>";
const sourceListEnd = "</ol></section>";
const sourceFour = `<li id="source-4"><a href="https://pubmed.ncbi.nlm.nih.gov/41684710/" target="_blank" rel="noopener noreferrer">From farm to fork: Microplastic contamination in the meat and dairy supply chain</a>. <em>Current Research in Food Science (2026)</em>.</li>`;

if (!original.includes("data-um-post-11154-sources")) throw new Error("Expected guarded Sources section was not found.");
if (original.includes('id="source-4"') || original.includes('href="#source-4"')) throw new Error("Source four already appears to be linked; refusing duplicate repair.");
if (!original.includes(bullet) || !original.includes(sourceListEnd)) throw new Error("Expected source-four insertion anchors were not found.");

const revised = original
  .replace(bullet, `${bullet}<span class="um-post-citation-context"> <a href="#source-4" class="um-post-citation" aria-label="View source 4">[4]</a></span>`)
  .replace(sourceListEnd, `${sourceFour}${sourceListEnd}`);

if (!shouldApply) {
  console.log(JSON.stringify({ mode: "preview", hasSourceFour: revised.includes('id="source-4"'), hasInlineFour: revised.includes('href="#source-4"') }, null, 2));
  process.exit(0);
}

const saved = await request(`${baseUrl}/wp-json/wp/v2/posts/11154`, {
  method: "POST",
  body: JSON.stringify({ content: revised, status: "publish" }),
});

console.log(JSON.stringify({ mode: "published", status: saved.status, sourceFourPresent: saved.content?.raw?.includes('id="source-4"'), inlineFourPresent: saved.content?.raw?.includes('href="#source-4"') }, null, 2));
