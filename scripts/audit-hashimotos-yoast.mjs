const postId = 11442;
const expectedSlug = "hashimotos-thyroid-and-gut-health";
const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const username = process.env.WORDPRESS_USERNAME ?? "";
const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";

if (!baseUrl.startsWith("https://") || !username || !appPassword) {
  throw new Error("WordPress HTTPS credentials are required through the configured environment.");
}

const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
const response = await fetch(
  `${baseUrl}/wp-json/wp/v2/posts/${postId}?context=edit&_fields=id,slug,link,featured_media,meta,content`,
  { headers: { Authorization: authorization }, signal: AbortSignal.timeout(20_000) },
);
if (!response.ok) throw new Error(`WordPress Yoast audit failed: ${response.status}`);

const schemaResponse = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
  method: "OPTIONS",
  headers: { Authorization: authorization },
  signal: AbortSignal.timeout(20_000),
});
if (!schemaResponse.ok) throw new Error(`WordPress post schema audit failed: ${schemaResponse.status}`);

const post = await response.json();
const schema = await schemaResponse.json();
if (post.slug !== expectedSlug) throw new Error("Refusing audit: post ID does not match the approved post slug.");

const meta = post.meta ?? {};
const articleHtml = post.content?.raw ?? "";
const articleText = articleHtml
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const focusKeyword = String(meta._yoast_wpseo_focuskw ?? "").trim();
const bodyLinks = Array.from(articleHtml.matchAll(/href=["']([^"']+)["']/gi), ([, href]) => href);
const sameDomainContextLinks = bodyLinks.filter((href) => href.startsWith("https://theurbanmonk.com/") && href !== post.link);
const externalContextLinks = bodyLinks.filter((href) => /^https?:\/\//.test(href) && !href.startsWith("https://theurbanmonk.com/"));
const seoMetaKeys = Object.keys(meta)
  .filter((key) => /yoast|wds|smartcrawl|sitemap|robots|canonical|opengraph|twitter/i.test(key))
  .sort();
const registeredMetaKeys = Object.keys(schema?.schema?.properties?.meta?.properties ?? {})
  .filter((key) => /yoast|wds|smartcrawl|sitemap|robots|canonical|opengraph|twitter/i.test(key))
  .sort();
console.log(JSON.stringify({
  postId: post.id,
  slug: post.slug,
  featuredMediaId: post.featured_media,
  focusKeywordConfigured: Boolean(meta._yoast_wpseo_focuskw),
  seoTitleConfigured: Boolean(meta._yoast_wpseo_title),
  metaDescriptionConfigured: Boolean(meta._yoast_wpseo_metadesc),
  canonicalConfigured: Boolean(meta._yoast_wpseo_canonical),
  seoScore: meta._yoast_wpseo_linkdex ?? null,
  readabilityScore: meta._yoast_wpseo_content_score ?? null,
  seoMetaKeys,
  registeredMetaKeys,
  articleWordCount: articleText ? articleText.split(" ").length : 0,
  articleH2Count: (articleHtml.match(/<h2[\s>]/gi) ?? []).length,
  articleH3Count: (articleHtml.match(/<h3[\s>]/gi) ?? []).length,
  focusKeywordOccurrencesInBody: focusKeyword
    ? (articleText.toLocaleLowerCase().match(new RegExp(focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLocaleLowerCase(), "g")) ?? []).length
    : 0,
  sameDomainContextLinkCount: sameDomainContextLinks.length,
  externalContextLinkCount: externalContextLinks.length,
  noContentRetrieved: true,
}));
