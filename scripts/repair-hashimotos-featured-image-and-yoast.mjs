const postId = 11442;
const expectedSlug = "hashimotos-thyroid-and-gut-health";
const imageUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/UnBvonglLbkErVTK.png";
const filename = "hashimotos-thyroid-and-gut-health-gut-thyroid-axis.png";
const altText = "Conceptual illustration of the gut-thyroid axis for Hashimoto's thyroid and gut health";
const metaDescription = "Explore the bidirectional gut-thyroid axis in Hashimoto's and factors clinicians may consider when evaluating both systems.";
const focusKeyword = "Hashimoto's thyroid and gut health";

const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const username = process.env.WORDPRESS_USERNAME ?? "";
const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";

if (!baseUrl.startsWith("https://") || !username || !appPassword) {
  throw new Error("WordPress HTTPS credentials are required through the configured environment.");
}

const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;

async function wpFetch(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: authorization, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WordPress ${options.method ?? "GET"} ${path} failed: ${response.status} ${errorText.slice(0, 300)}`);
  }
  return response;
}

const postResponse = await wpFetch(`/wp-json/wp/v2/posts/${postId}?context=edit`);
const post = await postResponse.json();
if (post.slug !== expectedSlug) {
  throw new Error("Refusing repair: post ID does not match the approved Hashimoto's article slug.");
}
if (post.featured_media && post.featured_media !== 0) {
  throw new Error("Refusing repair: the approved post already has featured media assigned.");
}

const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(45_000) });
if (!imageResponse.ok) throw new Error(`Approved image fetch failed: ${imageResponse.status}`);
const imageBytes = await imageResponse.arrayBuffer();
const imageType = imageResponse.headers.get("content-type") ?? "image/png";

const mediaResponse = await wpFetch("/wp-json/wp/v2/media", {
  method: "POST",
  headers: {
    "Content-Type": imageType,
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
  body: imageBytes,
});
const media = await mediaResponse.json();

await wpFetch(`/wp-json/wp/v2/media/${media.id}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ alt_text: altText, caption: altText, description: altText }),
});

await wpFetch(`/wp-json/wp/v2/posts/${postId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ featured_media: media.id }),
});

await wpFetch(`/wp-json/wp/v2/posts/${postId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    yoast_meta: {
      yoast_wpseo_metadesc: metaDescription,
      yoast_wpseo_focuskw: focusKeyword,
      yoast_wpseo_title: post.title?.raw ?? "Hashimoto's Thyroid and Gut Health: Which to Treat First?",
      yoast_wpseo_canonical: post.link,
    },
    meta: {
      _yoast_wpseo_metadesc: metaDescription,
      _yoast_wpseo_focuskw: focusKeyword,
      _yoast_wpseo_title: post.title?.raw ?? "Hashimoto's Thyroid and Gut Health: Which to Treat First?",
      _yoast_wpseo_canonical: post.link,
    },
  }),
});

const verificationResponse = await wpFetch(`/wp-json/wp/v2/posts/${postId}?_fields=id,slug,link,featured_media,yoast_head_json`);
const verification = await verificationResponse.json();
if (verification.featured_media !== media.id) {
  throw new Error("WordPress did not confirm the approved featured-media assignment.");
}

console.log(JSON.stringify({
  status: "repaired",
  postId: verification.id,
  slug: verification.slug,
  featuredMediaId: verification.featured_media,
  publicUrl: verification.link,
  imageUrl: media.source_url,
  yoastDescriptionUpdated: verification.yoast_head_json?.description === metaDescription,
  noContentChange: true,
}));
