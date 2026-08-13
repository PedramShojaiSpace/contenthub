import { readFileSync } from "node:fs";

const servicePid = process.env.SERVICE_PID;
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

const authorization = `Basic ${Buffer.from(`${credentials.WORDPRESS_USERNAME}:${credentials.WORDPRESS_APP_PASSWORD}`).toString("base64")}`;
const response = await fetch(`${String(credentials.WORDPRESS_URL).replace(/\/$/, "")}/wp-json/wp/v2/posts/11154?context=edit`, {
  headers: { Authorization: authorization },
});
if (!response.ok) throw new Error(`WordPress read failed: HTTP ${response.status}`);

const post = await response.json();
const content = post.content?.raw ?? "";
const matches = [...content.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]));
const anchorIds = [...content.matchAll(/href="#source-(\d+)"/g)].map(match => Number(match[1]));
const bibliographyIds = [...content.matchAll(/id="source-(\d+)"/g)].map(match => Number(match[1]));
console.log(
  JSON.stringify(
    {
      status: post.status,
      citations: [...new Set(matches)],
      inlineAnchorIds: [...new Set(anchorIds)],
      bibliographyIds: [...new Set(bibliographyIds)],
      sourceSectionPresent: content.includes("data-um-post-11154-sources"),
    },
    null,
    2
  )
);
