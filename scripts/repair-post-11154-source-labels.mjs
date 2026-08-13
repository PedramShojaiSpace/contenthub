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
if (!original.includes("data-um-post-11154-sources")) throw new Error("Expected guarded Sources section was not found.");
if (original.includes("<ul class=\"um-post-sources\"")) throw new Error("Visible source labels already appear to be present; refusing duplicate repair.");

let revised = original.replace("<ol>", "<ul class=\"um-post-sources\">").replace("</ol></section>", "</ul></section>");
for (const id of [2, 4, 9, 14, 18]) {
  const listItem = `<li id="source-${id}">`;
  if (!revised.includes(listItem)) throw new Error(`Expected bibliography entry source-${id} was not found.`);
  revised = revised.replace(listItem, `${listItem}<strong>[${id}]</strong> `);
}

if (!shouldApply) {
  console.log(JSON.stringify({ mode: "preview", visibleLabels: [2, 4, 9, 14, 18].every(id => revised.includes(`<strong>[${id}]</strong>`)) }, null, 2));
  process.exit(0);
}

const saved = await request(`${baseUrl}/wp-json/wp/v2/posts/11154`, {
  method: "POST",
  body: JSON.stringify({ content: revised, status: "publish" }),
});
console.log(JSON.stringify({ mode: "published", status: saved.status, visibleLabels: [2, 4, 9, 14, 18].every(id => saved.content?.raw?.includes(`<strong>[${id}]</strong>`)) }, null, 2));
