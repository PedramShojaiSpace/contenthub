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
  `${baseUrl}/wp-json/wp/v2/posts/${postId}?context=edit&_fields=id,slug,link,featured_media,meta`,
  { headers: { Authorization: authorization }, signal: AbortSignal.timeout(20_000) },
);
if (!response.ok) throw new Error(`WordPress Yoast audit failed: ${response.status}`);

const post = await response.json();
if (post.slug !== expectedSlug) throw new Error("Refusing audit: post ID does not match the approved post slug.");

const meta = post.meta ?? {};
console.log(JSON.stringify({
  postId: post.id,
  slug: post.slug,
  featuredMediaId: post.featured_media,
  focusKeywordConfigured: Boolean(meta._yoast_wpseo_focuskw),
  seoTitleConfigured: Boolean(meta._yoast_wpseo_title),
  metaDescriptionConfigured: Boolean(meta._yoast_wpseo_metadesc),
  canonicalConfigured: Boolean(meta._yoast_wpseo_canonical),
  seoScore: meta._yoast_wpseo_linkdex || null,
  readabilityScore: meta._yoast_wpseo_content_score || null,
  noContentRetrieved: true,
}));
