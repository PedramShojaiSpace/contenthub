const baseUrl = String(process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const username = process.env.WORDPRESS_USERNAME ?? "";
const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";

if (!baseUrl || !username || !appPassword) {
  throw new Error("WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD are required");
}

const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
const postResponse = await fetch(`${baseUrl}/wp-json/wp/v2/posts/11154?context=edit`, {
  headers: { Authorization: authorization },
});
if (!postResponse.ok) throw new Error(`Post request failed: HTTP ${postResponse.status}`);

const post = await postResponse.json();
const autosavesResponse = await fetch(`${baseUrl}/wp-json/wp/v2/posts/11154/autosaves?context=edit&per_page=1`, {
  headers: { Authorization: authorization },
});
const autosaves = autosavesResponse.ok ? await autosavesResponse.json() : [];
const newestAutosave = autosaves[0]
  ? {
      id: autosaves[0].id,
      modified: autosaves[0].modified,
      title: autosaves[0].title?.raw ?? autosaves[0].title?.rendered ?? "",
      content: autosaves[0].content?.raw ?? "",
    }
  : null;
let featuredMedia = null;
if (post.featured_media) {
  const mediaResponse = await fetch(`${baseUrl}/wp-json/wp/v2/media/${post.featured_media}?context=edit`, {
    headers: { Authorization: authorization },
  });
  if (mediaResponse.ok) {
    const media = await mediaResponse.json();
    featuredMedia = {
      id: media.id,
      sourceUrl: media.source_url,
      altText: media.alt_text,
      caption: media.caption?.raw ?? "",
      title: media.title?.raw ?? "",
    };
  }
}

console.log(JSON.stringify({
  id: post.id,
  status: post.status,
  slug: post.slug,
  title: post.title?.raw ?? post.title?.rendered ?? "",
  content: post.content?.raw ?? "",
  newestAutosave,
  excerpt: post.excerpt?.raw ?? "",
  featuredMedia,
  meta: post.meta ?? {},
  yoastMeta: Object.fromEntries(Object.entries(post.meta ?? {}).filter(([key]) => key.includes("yoast"))),
}, null, 2));
