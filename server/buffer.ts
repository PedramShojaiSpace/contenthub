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
  dueAt?: string; // ISO 8601 UTC timestamp when Buffer will send the post
  error?: string;
};

function getAccessToken(): string {
  return process.env.BUFFER_ACCESS_TOKEN ?? "";
}

const BUFFER_GQL_MAX_RETRIES = 3;
const BUFFER_GQL_BASE_DELAY_MS = 2000; // 2s → 4s → 8s

/**
 * Execute a GraphQL query/mutation against the Buffer API.
 * Reads the response as text first to detect plain-text 5xx errors (e.g. "Service Unavailable")
 * before attempting JSON.parse. Retries automatically on transient 502/503/504 responses.
 */
async function bufferGql<T>(
  query: string,
  variables?: Record<string, unknown>,
  _retryCount = 0
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

  // Read raw body first so we can inspect it before parsing
  const rawBody = await res.text();

  // Detect transient server errors by HTTP status (502, 503, 504)
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    if (_retryCount < BUFFER_GQL_MAX_RETRIES) {
      const delay = BUFFER_GQL_BASE_DELAY_MS * Math.pow(2, _retryCount);
      console.warn(`[Buffer GQL] ${res.status} transient error — retrying in ${delay}ms (attempt ${_retryCount + 1}/${BUFFER_GQL_MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return bufferGql<T>(query, variables, _retryCount + 1);
    }
    throw new Error(`Buffer API is temporarily unavailable (${res.status}). Please try again in a moment.`);
  }

  // Detect plain-text service unavailable on HTTP 200 (some proxies do this)
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("service unavailable") ||
      lower.includes("bad gateway") ||
      lower.includes("gateway timeout") ||
      lower.includes("temporarily unavailable")
    ) {
      if (_retryCount < BUFFER_GQL_MAX_RETRIES) {
        const delay = BUFFER_GQL_BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(`[Buffer GQL] Plain-text service unavailable — retrying in ${delay}ms (attempt ${_retryCount + 1}/${BUFFER_GQL_MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return bufferGql<T>(query, variables, _retryCount + 1);
      }
      throw new Error(`Buffer API is temporarily unavailable. Please try again in a moment. (raw: ${trimmed.slice(0, 80)})`);
    }
    // Any other non-JSON response from Buffer
    throw new Error(`Buffer API returned unexpected response (${res.status}): ${trimmed.slice(0, 200)}`);
  }

  let json: { data?: T; errors?: Array<{ message: string }> };
  try {
    json = JSON.parse(trimmed) as { data?: T; errors?: Array<{ message: string }> };
  } catch {
    throw new Error(`Buffer API response JSON parse failed: ${trimmed.slice(0, 200)}`);
  }

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
  videoUrl?: string; // S3 URL of the video to attach (for video posts)
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

      // Build assets array — Buffer API v2 uses an ordered array format:
      //   assets: [{ image: { url: "..." } }]  or  assets: [{ video: { url: "..." } }]
      // NOTE: For LinkedIn, when linkAsset is provided, do NOT also send imageUrl as a separate
      // asset. LinkedIn only allows one attachment type — if both assets and
      // metadata.linkedin.linkAttachment are present, Buffer silently drops the linkAttachment.
      // The image should travel as thumbnailUrl inside the linkAsset instead.
      const isLinkedInWithLink = channelService === "linkedin" && !!params.linkAsset;
      let assetsFragment = "";
      if (params.videoUrl) {
        // Video post — use assets: [{ video: { url } }]
        assetsFragment = `, assets: [{ video: { url: ${JSON.stringify(params.videoUrl)} } }]`;
      } else if (params.imageUrl && !isLinkedInWithLink) {
        assetsFragment = `, assets: [{ image: { url: ${JSON.stringify(params.imageUrl)} } }]`;
      }

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
        // LinkedIn link preview: must use metadata.linkedin.linkAttachment with url field.
        // thumbnailUrl is included inside the linkAttachment so the image travels WITH the
        // link card rather than as a conflicting standalone asset (v142).
        // Buffer may auto-scrape thumbnail from OG tags if thumbnailUrl is not accepted by API.
        const thumbFragment = params.linkAsset.thumbnailUrl
          ? `, thumbnailUrl: ${JSON.stringify(params.linkAsset.thumbnailUrl)}`
          : "";
        metadataFragment = `, metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(params.linkAsset.url)}${thumbFragment} } } }`;
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
        results.push({ success: true, bufferId: createResult.post.id, dueAt: createResult.post.dueAt });
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
    return { success: true, bufferId: firstSuccess?.bufferId, dueAt: firstSuccess?.dueAt };
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

  // Buffer API v2: assets is an ordered array of { image: { url } } entries
  const images = params.imageUrls.slice(0, 10).map((url) => `{ image: { url: ${JSON.stringify(url)} } }`);
  const assetsFragment = `, assets: [${images.join(", ")}]`;

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
