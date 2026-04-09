/**
 * WordPress REST API integration for The Urban Monk (theurbanmonk.com)
 * Uses Application Password authentication (Basic Auth over HTTPS)
 */

function getWpAuth(): { baseUrl: string; authHeader: string } {
  const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
  const username = process.env.WORDPRESS_USERNAME ?? "";
  const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
  const authHeader =
    "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
  return { baseUrl, authHeader };
}

/**
 * Upload an image from a URL to the WordPress media library.
 * Returns the WordPress media attachment ID and the hosted URL.
 */
export async function uploadMediaFromUrl(
  imageUrl: string,
  filename: string,
  altText?: string
): Promise<{ id: number; url: string }> {
  const { baseUrl, authHeader } = getWpAuth();

  // Fetch the image bytes
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image from URL: ${imgRes.statusText}`);
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

  // Upload to WordPress media endpoint
  const uploadRes = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": contentType,
    },
    body: imgBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`WordPress media upload failed: ${errText}`);
  }

  const media = (await uploadRes.json()) as {
    id: number;
    source_url: string;
  };

  // Optionally set alt text
  if (altText && media.id) {
    await fetch(`${baseUrl}/wp-json/wp/v2/media/${media.id}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ alt_text: altText }),
    }).catch(() => {
      // Non-fatal — alt text update failure doesn't block publish
    });
  }

  return { id: media.id, url: media.source_url };
}

export interface WpPostInput {
  title: string;
  slug: string;
  content: string; // HTML or Markdown — WP stores as-is
  excerpt?: string;
  status?: "draft" | "publish" | "pending" | "future";
  featuredMediaId?: number;
  categories?: number[];
  tags?: number[];
  metaDescription?: string; // Stored in Yoast SEO meta if available
  date?: string; // ISO 8601 UTC date string for scheduled posts (status: "future")
}

export interface WpPostResult {
  id: number;
  link: string;
  status: string;
  editLink: string;
}

/**
 * Create a new WordPress post.
 * Returns the post ID, public link, and admin edit link.
 */
export async function createWpPost(input: WpPostInput): Promise<WpPostResult> {
  const { baseUrl, authHeader } = getWpAuth();

  const body: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    content: input.content,
    status: input.status ?? "draft",
  };

  if (input.excerpt) body.excerpt = input.excerpt;
  if (input.featuredMediaId) body.featured_media = input.featuredMediaId;
  if (input.categories?.length) body.categories = input.categories;
  if (input.tags?.length) body.tags = input.tags;
  if (input.date) body.date_gmt = input.date; // Schedule in UTC

  // Yoast SEO meta description (stored as post meta)
  if (input.metaDescription) {
    body.meta = { _yoast_wpseo_metadesc: input.metaDescription };
  }

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress post creation failed: ${errText}`);
  }

  const post = (await res.json()) as {
    id: number;
    link: string;
    status: string;
  };

  return {
    id: post.id,
    link: post.link,
    status: post.status,
    editLink: `${baseUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
  };
}
