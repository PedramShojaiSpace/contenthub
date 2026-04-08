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
  const res = await fetch(BUFFER_GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
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
}): Promise<BufferUpdateResult> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }
  if (!params.profileIds.length) {
    return { success: false, error: "No channel IDs provided" };
  }

  // Push to each channel and collect results
  const results: BufferUpdateResult[] = [];

  for (const channelId of params.profileIds) {
    try {
      const mode = params.scheduledAt ? "customScheduled" : "addToQueue";
      const dueAt = params.scheduledAt
        ? new Date(params.scheduledAt).toISOString()
        : undefined;

      // Build assets array if image is provided
      const assetsFragment = params.imageUrl
        ? `, assets: [{ url: "${params.imageUrl}", type: image }]`
        : "";

      const dueAtFragment = dueAt ? `, dueAt: "${dueAt}"` : "";

      const mutation = `
        mutation CreatePost {
          createPost(input: {
            text: ${JSON.stringify(params.text)},
            channelId: "${channelId}",
            schedulingType: automatic,
            mode: ${mode}${dueAtFragment}${assetsFragment}
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
