/**
 * Buffer API integration for Urban Monk Productions Content Hub.
 * Uses the new Buffer GraphQL API (https://api.buffer.com).
 *
 * Buffer GraphQL API docs: https://developers.buffer.com
 * Authentication: Bearer token via Authorization header.
 */

const BUFFER_GQL_ENDPOINT = "https://api.buffer.com";

// Urban Monk Productions organization ID (discovered via account query)
const UMP_ORG_ID = "6577bd3c147566efe2fa9201";

export type BufferProfile = {
  id: string;
  platform: "linkedin" | "meta" | "x" | "youtube" | "tiktok" | "other";
  name: string;
  service: string;
};

export type BufferUpdateResult = {
  success: boolean;
  bufferId?: string;
  error?: string;
};

function getAccessToken(): string {
  return process.env.BUFFER_ACCESS_TOKEN ?? "";
}

/**
 * Execute a GraphQL query/mutation against the Buffer API.
 */
async function bufferGql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const token = getAccessToken();
  // DEBUG: log the exact mutation being sent so we can diagnose link preview issues
  console.log("[Buffer GQL] Sending mutation:", query.trim());
  const res = await fetch(BUFFER_GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
  // DEBUG: log the raw response so we can see errors or unexpected shapes
  console.log("[Buffer GQL] Response:", JSON.stringify(json, null, 2));
  return json;
}

/**
 * Fetch all connected Buffer channels (social accounts) for Urban Monk Productions.
 */
export async function getBufferProfiles(): Promise<BufferProfile[]> {
  const token = getAccessToken();
  if (!token) return [];

  try {
    const result = await bufferGql<{
      channels: Array<{ id: string; service: string; name: string }>;
    }>(`
      query GetChannels($orgId: OrganizationId!) {
        channels(input: { organizationId: $orgId }) {
          id
          service
          name
        }
      }
    `, { orgId: UMP_ORG_ID });

    if (result.errors?.length) {
      console.warn("[Buffer] GraphQL errors:", result.errors.map((e) => e.message).join(", "));
      return [];
    }

    const channels = result.data?.channels ?? [];
    return channels.map((ch) => ({
      id: ch.id,
      platform: mapBufferService(ch.service),
      name: ch.name,
      service: ch.service,
    }));
  } catch (err) {
    console.warn("[Buffer] Error fetching channels:", err);
    return [];
  }
}

/**
 * Diagnostic: returns raw Buffer API response for debugging.
 */
export async function getBufferProfilesRaw(): Promise<{
  status: number;
  body: string;
  tokenPresent: boolean;
}> {
  const token = getAccessToken();
  if (!token) {
    return { status: 0, body: "BUFFER_ACCESS_TOKEN is not set", tokenPresent: false };
  }

  try {
    const res = await fetch(BUFFER_GQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { channels(input: { organizationId: "${UMP_ORG_ID}" }) { id service name } }`,
      }),
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, 2000), tokenPresent: true };
  } catch (err) {
    return { status: -1, body: String(err), tokenPresent: true };
  }
}

/**
 * Push a content item to Buffer for the specified channel IDs.
 * Uses addToQueue scheduling (next available slot in the channel's schedule).
 */
export async function pushToBuffer(params: {
  text: string;
  profileIds: string[]; // these are channel IDs in the new API
  imageUrl?: string;
  scheduledAt?: number; // UTC ms timestamp (optional — if not set, addToQueue is used)
  platform?: string; // used to enforce platform-specific character limits before API call
  metaPostType?: "post" | "story" | "reel"; // required for facebook/instagram channels
  channelServiceMap?: Record<string, string>; // channelId → service (e.g. "facebook", "instagram")
  ctaUrl?: string; // UTM-tracked CTA URL — sent as Instagram first comment, not in caption
  linkAsset?: {
    url: string;
    title?: string;
    description?: string;
    thumbnailUrl?: string;
  }; // Link attachment for LinkedIn link preview card (Buffer AssetsInput.link)
}): Promise<BufferUpdateResult> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }
  if (!params.profileIds.length) {
    return { success: false, error: "No channel IDs provided" };
  }

  // X/Twitter character limit guard.
  // We do NOT truncate — truncation produces incoherent, incomplete posts.
  // The LLM is now prompted to write complete posts targeting 200-220 chars.
  // If a post still exceeds 280 chars, we reject it with a clear error so the
  // user can edit it manually rather than publishing broken content.
  let text = params.text;
  if (params.platform === "x" || params.platform === "twitter") {
    if (text.length > 280) {
      return {
        success: false,
        error: `X post is ${text.length} characters (limit: 280). Please edit the post to shorten it before publishing — the content has not been truncated to preserve its meaning.`,
      };
    }
  }

  // Push to each channel and collect results
  const results: BufferUpdateResult[] = [];

  for (const channelId of params.profileIds) {
    // Determine if this channel is Instagram
    const channelService = params.channelServiceMap?.[channelId]?.toLowerCase() ?? "";
    const isInstagram = channelService === "instagram";

    // For Instagram: scrub all URLs from caption and replace with "link in bio"
    // Instagram does not support clickable links in captions — users must use link in bio
    let channelText = text;
    if (isInstagram) {
      channelText = channelText.replace(/https?:\/\/[^\s)\]>"']+/g, "link in bio");
    }
    try {
      const mode = params.scheduledAt ? "customScheduled" : "addToQueue";
      const dueAt = params.scheduledAt
        ? new Date(params.scheduledAt).toISOString()
        : undefined;

      // Build assets object — supports image attachment
      // NOTE: For LinkedIn, when linkAsset is provided, do NOT also send imageUrl as a separate
      // asset. LinkedIn only allows one attachment type — if both assets.images and
      // metadata.linkedin.linkAttachment are present, Buffer silently drops the linkAttachment.
      // The image should travel as thumbnailUrl inside the linkAsset instead.
      const isLinkedInWithLink = channelService === "linkedin" && !!params.linkAsset;
      let assetsInner = "";
      if (params.imageUrl && !isLinkedInWithLink) {
        assetsInner += `images: [{ url: ${JSON.stringify(params.imageUrl)} }]`;
      }
      const assetsFragment = assetsInner ? `, assets: { ${assetsInner} }` : "";

      const dueAtFragment = dueAt ? `, dueAt: "${dueAt}"` : "";

      // Build metadata fragment
      // - Facebook/Instagram: requires type field
      // - LinkedIn: link preview MUST go in metadata.linkedin.linkAttachment (NOT assets.link)
      //   Buffer's assets.link does not generate a LinkedIn link preview card.
      //   Only metadata.linkedin.linkAttachment triggers the LinkedIn link preview.
      const metaType = params.metaPostType ?? "post";
      let metadataFragment = "";
      if (channelService === "facebook") {
        metadataFragment = `, metadata: { facebook: { type: ${metaType} } }`;
      } else if (channelService === "instagram") {
        // Include firstComment with UTM URL if available — Instagram links must go in first comment
        const firstCommentFragment = params.ctaUrl
          ? `, firstComment: ${JSON.stringify(params.ctaUrl)}`
          : "";
        metadataFragment = `, metadata: { instagram: { type: ${metaType}, shouldShareToFeed: true${firstCommentFragment} } }`;
      } else if (channelService === "linkedin" && params.linkAsset) {
        // LinkedIn link preview: must use metadata.linkedin.linkAttachment with url field
        // LinkAttachmentInput only accepts { url: String! } — title/description/thumbnail
        // are fetched automatically by Buffer from the URL's Open Graph tags.
        metadataFragment = `, metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(params.linkAsset.url)} } } }`;
      }

      const mutation = `
        mutation CreatePost {
          createPost(input: {
            text: ${JSON.stringify(channelText)},
            channelId: "${channelId}",
            schedulingType: automatic,
            mode: ${mode}${dueAtFragment}${assetsFragment}${metadataFragment}
          }) {
            ... on PostActionSuccess {
              post {
                id
                text
                dueAt
              }
            }
            ... on MutationError {
              message
            }
          }
        }
      `;

      const result = await bufferGql<{
        createPost:
          | { post: { id: string; text: string; dueAt: string } }
          | { message: string };
      }>(mutation);

      if (result.errors?.length) {
        results.push({
          success: false,
          error: result.errors.map((e) => e.message).join(", "),
        });
        continue;
      }

      const createResult = result.data?.createPost;
      if (!createResult) {
        results.push({ success: false, error: "No response from Buffer API" });
        continue;
      }

      // Check if it's a success or error response
      if ("post" in createResult) {
        results.push({ success: true, bufferId: createResult.post.id });
      } else {
        results.push({ success: false, error: createResult.message });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ success: false, error: msg });
    }
  }

  // Return combined result: success if at least one succeeded
  const anySuccess = results.some((r) => r.success);
  const firstSuccess = results.find((r) => r.success);
  const errors = results
    .filter((r) => !r.success)
    .map((r) => r.error)
    .filter(Boolean);

  if (anySuccess) {
    return { success: true, bufferId: firstSuccess?.bufferId };
  }
  return { success: false, error: errors.join("; ") };
}

/**
 * Push a multi-image carousel post to Buffer for Meta (Instagram/Facebook) channels.
 * Buffer's createPost supports multiple images via the assets.images array.
 * Note: LinkedIn carousel/document posts are NOT supported by Buffer API.
 */
export async function pushCarouselToBuffer(params: {
  caption: string;
  imageUrls: string[]; // ordered list of slide image URLs
  profileIds: string[]; // Meta channel IDs only
  channelServiceMap?: Record<string, string>; // channelId → service
  scheduledAt?: number; // UTC ms timestamp
}): Promise<BufferUpdateResult> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }
  if (!params.profileIds.length) {
    return { success: false, error: "No channel IDs provided" };
  }
  if (!params.imageUrls.length) {
    return { success: false, error: "No slide images provided" };
  }

  // Buffer supports up to 10 images per carousel post
  const images = params.imageUrls.slice(0, 10).map((url) => `{ url: ${JSON.stringify(url)} }`);
  const assetsFragment = `, assets: { images: [${images.join(", ")}] }`;

  const results: BufferUpdateResult[] = [];

  for (const channelId of params.profileIds) {
    try {
      const mode = params.scheduledAt ? "customScheduled" : "addToQueue";
      const dueAt = params.scheduledAt ? new Date(params.scheduledAt).toISOString() : undefined;
      const dueAtFragment = dueAt ? `, dueAt: "${dueAt}"` : "";

      const channelService = params.channelServiceMap?.[channelId]?.toLowerCase() ?? "";
      let metadataFragment = "";
      if (channelService === "facebook") {
        metadataFragment = `, metadata: { facebook: { type: post } }`;
      } else if (channelService === "instagram") {
        // Instagram carousel requires shouldShareToFeed: true
        metadataFragment = `, metadata: { instagram: { type: carousel, shouldShareToFeed: true } }`;
      }

      const mutation = `
        mutation CreateCarouselPost {
          createPost(input: {
            text: ${JSON.stringify(params.caption)},
            channelId: "${channelId}",
            schedulingType: automatic,
            mode: ${mode}${dueAtFragment}${assetsFragment}${metadataFragment}
          }) {
            ... on PostActionSuccess {
              post {
                id
                text
                dueAt
              }
            }
            ... on MutationError {
              message
            }
          }
        }
      `;

      const result = await bufferGql<{
        createPost:
          | { post: { id: string; text: string; dueAt: string } }
          | { message: string };
      }>(mutation);

      if (result.errors?.length) {
        results.push({ success: false, error: result.errors.map((e) => e.message).join(", ") });
        continue;
      }

      const createResult = result.data?.createPost;
      if (!createResult) {
        results.push({ success: false, error: "No response from Buffer API" });
        continue;
      }

      if ("post" in createResult) {
        results.push({ success: true, bufferId: createResult.post.id });
      } else {
        results.push({ success: false, error: createResult.message });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ success: false, error: msg });
    }
  }

  const anySuccess = results.some((r) => r.success);
  const firstSuccess = results.find((r) => r.success);
  const errors = results.filter((r) => !r.success).map((r) => r.error).filter(Boolean);

  if (anySuccess) return { success: true, bufferId: firstSuccess?.bufferId };
  return { success: false, error: errors.join("; ") };
}

function mapBufferService(service: string): BufferProfile["platform"] {
  const map: Record<string, BufferProfile["platform"]> = {
    linkedin: "linkedin",
    facebook: "meta",
    instagram: "meta",
    twitter: "x",
    youtube: "youtube",
    tiktok: "tiktok",
  };
  return map[service.toLowerCase()] ?? "other";
}
