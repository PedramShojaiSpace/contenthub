/**
 * metaPublisher.ts
 * Direct Meta Content Publishing API integration.
 *
 * Supports:
 *   - Instagram Carousel (multiple images → carousel post)
 *   - Facebook Page multi-photo post
 *
 * Requirements:
 *   META_PAGE_ACCESS_TOKEN  — long-lived Page access token (from Meta Business Manager)
 *   META_IG_ACCOUNT_ID      — Instagram Business Account ID (numeric)
 *   META_FB_PAGE_ID         — Facebook Page ID (numeric)
 *
 * Meta Graph API version: v21.0
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN is not set. Add it in project secrets.");
  return token;
}

function getIgAccountId(): string {
  const id = process.env.META_IG_ACCOUNT_ID;
  if (!id) throw new Error("META_IG_ACCOUNT_ID is not set. Add it in project secrets.");
  return id;
}

function getFbPageId(): string {
  const id = process.env.META_FB_PAGE_ID;
  if (!id) throw new Error("META_FB_PAGE_ID is not set. Add it in project secrets.");
  return id;
}

async function graphPost(path: string, body: Record<string, string>): Promise<any> {
  const token = getToken();
  const url = `${GRAPH_BASE}/${path}`;
  const params = new URLSearchParams({ ...body, access_token: token });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Meta API error ${res.status}`;
    throw new Error(`[Meta API] ${msg}`);
  }
  return json;
}

// ── Instagram Carousel ────────────────────────────────────────────────────────

/**
 * Step 1: Create a single media container for one image (child item).
 * Returns the container ID.
 */
async function createIgImageContainer(imageUrl: string, isCarouselItem = true): Promise<string> {
  const igId = getIgAccountId();
  const body: Record<string, string> = {
    image_url: imageUrl,
  };
  if (isCarouselItem) {
    body.is_carousel_item = "true";
  }
  const res = await graphPost(`${igId}/media`, body);
  return res.id as string;
}

/**
 * Step 2: Create the carousel container referencing all child container IDs.
 */
async function createIgCarouselContainer(
  childIds: string[],
  caption: string
): Promise<string> {
  const igId = getIgAccountId();
  const res = await graphPost(`${igId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });
  return res.id as string;
}

/**
 * Step 3: Publish the carousel container.
 */
async function publishIgContainer(containerId: string): Promise<string> {
  const igId = getIgAccountId();
  const res = await graphPost(`${igId}/media_publish`, {
    creation_id: containerId,
  });
  return res.id as string;
}

/**
 * Full Instagram carousel publish flow.
 * imageUrls must be publicly accessible HTTPS URLs (S3 CDN works).
 * Returns the published post ID.
 */
export async function publishInstagramCarousel(
  imageUrls: string[],
  caption: string
): Promise<{ postId: string; platform: "instagram" }> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error("Instagram carousel requires 2–10 images.");
  }

  // Step 1: Create child containers in parallel
  const childIds = await Promise.all(
    imageUrls.map((url) => createIgImageContainer(url, true))
  );

  // Step 2: Create carousel container
  const carouselId = await createIgCarouselContainer(childIds, caption);

  // Step 3: Publish (Meta recommends a short delay after container creation)
  await new Promise((r) => setTimeout(r, 2000));
  const postId = await publishIgContainer(carouselId);

  return { postId, platform: "instagram" };
}

// ── Facebook Page Multi-Photo Post ────────────────────────────────────────────

/**
 * Upload a photo to a Facebook Page's photo library (unpublished).
 * Returns the photo ID.
 */
async function uploadFbPhoto(imageUrl: string): Promise<string> {
  const pageId = getFbPageId();
  const res = await graphPost(`${pageId}/photos`, {
    url: imageUrl,
    published: "false",
  });
  return res.id as string;
}

/**
 * Create a Facebook Page post with multiple attached photos.
 * Returns the post ID.
 */
export async function publishFacebookCarousel(
  imageUrls: string[],
  caption: string
): Promise<{ postId: string; platform: "facebook" }> {
  if (imageUrls.length === 0) throw new Error("No images provided for Facebook post.");

  // Upload all photos as unpublished
  const photoIds = await Promise.all(imageUrls.map((url) => uploadFbPhoto(url)));

  // Build attached_media array
  const pageId = getFbPageId();
  const attachedMedia = photoIds.map((id) => `{"media_fbid":"${id}"}`).join(",");

  const res = await graphPost(`${pageId}/feed`, {
    message: caption,
    attached_media: `[${attachedMedia}]`,
  });

  return { postId: res.id as string, platform: "facebook" };
}

// ── Combined publish ──────────────────────────────────────────────────────────

export interface MetaCarouselPublishResult {
  instagram?: { postId: string; success: boolean; error?: string };
  facebook?: { postId: string; success: boolean; error?: string };
}

/**
 * Publish carousel to both Instagram and Facebook.
 * Failures on one platform don't block the other.
 */
export async function publishCarouselToMeta(
  imageUrls: string[],
  caption: string,
  targets: { instagram: boolean; facebook: boolean }
): Promise<MetaCarouselPublishResult> {
  const result: MetaCarouselPublishResult = {};

  if (targets.instagram) {
    try {
      const { postId } = await publishInstagramCarousel(imageUrls, caption);
      result.instagram = { postId, success: true };
    } catch (err: any) {
      result.instagram = { postId: "", success: false, error: err.message };
    }
  }

  if (targets.facebook) {
    try {
      const { postId } = await publishFacebookCarousel(imageUrls, caption);
      result.facebook = { postId, success: true };
    } catch (err: any) {
      result.facebook = { postId: "", success: false, error: err.message };
    }
  }

  return result;
}
