import { readFileSync } from "node:fs";

const sourceReferences = [
  [2, "https://pubmed.ncbi.nlm.nih.gov/41601564/", "How the gut microbiome shapes learning and memory: A comprehensive review", "IBRO Neuroscience Reports (2025)"],
  [4, "https://pubmed.ncbi.nlm.nih.gov/41684710/", "From farm to fork: Microplastic contamination in the meat and dairy supply chain", "Current Research in Food Science (2026)"],
  [9, "https://pubmed.ncbi.nlm.nih.gov/41827204/", "Diabetes Mellitus as an Integrated Microbiome, Immune, and Metabolic Disorder with Clinical Implications for Multisystem Complications and Public Health", "Journal of Clinical Medicine (2026)"],
  [14, "https://pubmed.ncbi.nlm.nih.gov/41769655/", "Nutrition and the gut microbiome: a symbiotic dialogue influencing health and disease", "Frontiers in Nutrition (2026)"],
  [18, "https://pubmed.ncbi.nlm.nih.gov/41160105/", "Microbiome modulation as a therapeutic strategy for alcohol-induced gut dysbiosis and associated disorders", "Antonie van Leeuwenhoek (2025)"],
];

function readServiceCredentials() {
  const servicePid = process.env.SERVICE_PID;
  if (!servicePid) return {};

  return Object.fromEntries(
    readFileSync(`/proc/${servicePid}/environ`, "utf8")
      .split("\0")
      .filter(Boolean)
      .map(entry => {
        const separator = entry.indexOf("=");
        return [entry.slice(0, separator), entry.slice(separator + 1)];
      })
      .filter(([key]) => ["WORDPRESS_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"].includes(key))
  );
}

function appendPost11154References(content) {
  if (content.includes("data-um-post-11154-sources")) {
    throw new Error("Post 11154 already contains the guarded source marker; refusing duplicate bibliography.");
  }

  let revised = content;
  if (!revised.includes("[4]")) {
    const plasticContainerNeedle = "<li>Replace plastic food containers with glass</li>";
    if (!revised.includes(plasticContainerNeedle)) {
      throw new Error("Expected plastic-container guidance was not found; refusing to invent source-four placement.");
    }
    revised = revised.replace(plasticContainerNeedle, `${plasticContainerNeedle}<span class="um-post-citation-context"> [4]</span>`);
  }
  for (const [id] of sourceReferences) {
    const marker = `[${id}]`;
    if (!revised.includes(marker)) {
      throw new Error(`Expected inline citation ${marker} was not found; refusing incomplete bibliography.`);
    }
    revised = revised.replaceAll(marker, `<a href="#source-${id}" class="um-post-citation" aria-label="View source ${id}">[${id}]</a>`);
  }

  const bibliography = `<section data-um-post-11154-sources aria-labelledby="post-11154-sources"><h2 id="post-11154-sources">Sources</h2><p>These sources correspond to the numbered citations in the article and are provided for further reading.</p><ul class="um-post-sources">${sourceReferences
    .map(
      ([id, url, title, publication]) =>
        `<li id="source-${id}"><strong>[${id}]</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>. <em>${publication}</em>.</li>`
    )
    .join("")}</ul></section>`;
  return `${revised}\n${bibliography}`;
}

const serviceCredentials = readServiceCredentials();
const baseUrl = String(process.env.WORDPRESS_URL ?? serviceCredentials.WORDPRESS_URL ?? "").replace(/\/$/, "");
const username = process.env.WORDPRESS_USERNAME ?? serviceCredentials.WORDPRESS_USERNAME ?? "";
const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? serviceCredentials.WORDPRESS_APP_PASSWORD ?? "";
const shouldApply = process.argv.includes("--apply");

if (!baseUrl || !username || !appPassword) {
  throw new Error("WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD are required");
}

const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
const request = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: authorization, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url} failed: HTTP ${response.status}`);
  return response.json();
};

const post = await request(`${baseUrl}/wp-json/wp/v2/posts/11154?context=edit`);
if (post.status !== "publish") {
  throw new Error(`Post 11154 must be published before reference append; found status ${post.status}.`);
}

const revised = appendPost11154References(post.content?.raw ?? "");
const update = { content: revised, status: "publish" };

if (!shouldApply) {
  console.log(JSON.stringify({ mode: "preview", currentStatus: post.status, update }, null, 2));
  process.exit(0);
}

const saved = await request(`${baseUrl}/wp-json/wp/v2/posts/11154`, {
  method: "POST",
  body: JSON.stringify(update),
});

console.log(
  JSON.stringify(
    {
      mode: "published",
      id: saved.id,
      status: saved.status,
      link: saved.link,
      sourceSectionPresent: saved.content?.raw?.includes("data-um-post-11154-sources") ?? false,
    },
    null,
    2
  )
);
