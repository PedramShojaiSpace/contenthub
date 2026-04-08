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
    const res = await fetch(`${BUFFER_API_BASE}/profiles.json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const responseText = await res.text();
    console.log("[Buffer] profiles response status:", res.status);
    console.log("[Buffer] profiles response body:", responseText.slice(0, 500));

    if (!res.ok) {
      console.warn("[Buffer] Failed to fetch profiles:", res.status, responseText.slice(0, 200));
      return [];
    }

    let data: Array<{ id: string; service: string; service_username: string }>;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.warn("[Buffer] Could not parse profiles JSON:", responseText.slice(0, 200));
      return [];
    }

    if (!Array.isArray(data)) {
      console.warn("[Buffer] Profiles response is not an array:", typeof data);
      return [];
    }

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
 * Diagnostic: returns the raw Buffer API response for debugging.
 */
export async function getBufferProfilesRaw(): Promise<{ status: number; body: string; tokenPresent: boolean }> {
  const token = getAccessToken();
  if (!token) return { status: 0, body: "BUFFER_ACCESS_TOKEN is not set", tokenPresent: false };

  try {
    // Try Bearer header first
    const res = await fetch(`${BUFFER_API_BASE}/profiles.json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, 1000), tokenPresent: true };
  } catch (err) {
    return { status: -1, body: String(err), tokenPresent: true };
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
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
