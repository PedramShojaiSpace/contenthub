/**
 * Buffer API integration for Urban Monk Productions Content Hub.
 * Handles pushing approved content to Buffer for scheduling/publishing.
 *
 * Buffer API docs: https://buffer.com/developers/api
 * We use the v1 API with an access token.
 */

export type BufferProfile = {
  id: string;
  platform: "linkedin" | "meta" | "x" | "youtube";
  name: string;
};

export type BufferUpdateResult = {
  success: boolean;
  bufferId?: string;
  error?: string;
};

const BUFFER_API_BASE = "https://api.bufferapp.com/1";

function getAccessToken(): string {
  return process.env.BUFFER_ACCESS_TOKEN ?? "";
}

/**
 * Fetch all connected Buffer profiles (social accounts).
 */
export async function getBufferProfiles(): Promise<BufferProfile[]> {
  const token = getAccessToken();
  if (!token) return [];

  try {
    const res = await fetch(`${BUFFER_API_BASE}/profiles.json?access_token=${token}`);
    if (!res.ok) {
      console.warn("[Buffer] Failed to fetch profiles:", res.status);
      return [];
    }
    const data = (await res.json()) as Array<{
      id: string;
      service: string;
      service_username: string;
    }>;

    return data
      .map((p) => {
        const platform = mapBufferService(p.service);
        if (!platform) return null;
        return {
          id: p.id,
          platform,
          name: p.service_username,
        };
      })
      .filter(Boolean) as BufferProfile[];
  } catch (err) {
    console.warn("[Buffer] Error fetching profiles:", err);
    return [];
  }
}

/**
 * Push a content item to Buffer for the specified profile IDs.
 * Optionally schedule it at a specific UTC timestamp.
 */
export async function pushToBuffer(params: {
  text: string;
  profileIds: string[];
  imageUrl?: string;
  scheduledAt?: number; // UTC ms timestamp
}): Promise<BufferUpdateResult> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, error: "BUFFER_ACCESS_TOKEN not configured" };
  }
  if (!params.profileIds.length) {
    return { success: false, error: "No profile IDs provided" };
  }

  try {
    const body = new URLSearchParams();
    body.append("text", params.text);
    body.append("access_token", token);
    params.profileIds.forEach((id) => body.append("profile_ids[]", id));

    if (params.imageUrl) {
      body.append("media[photo]", params.imageUrl);
    }

    if (params.scheduledAt) {
      // Buffer expects scheduled_at as a Unix timestamp in seconds
      body.append("scheduled_at", Math.floor(params.scheduledAt / 1000).toString());
    }

    const res = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { success: false, error: `Buffer API error ${res.status}: ${detail}` };
    }

    const data = (await res.json()) as { success?: boolean; updates?: Array<{ id: string }> };
    const bufferId = data.updates?.[0]?.id;
    return { success: true, bufferId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

function mapBufferService(service: string): BufferProfile["platform"] | null {
  const map: Record<string, BufferProfile["platform"]> = {
    linkedin: "linkedin",
    facebook: "meta",
    instagram: "meta",
    twitter: "x",
    youtube: "youtube",
  };
  return map[service.toLowerCase()] ?? null;
}
