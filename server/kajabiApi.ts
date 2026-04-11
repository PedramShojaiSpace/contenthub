/**
 * Kajabi API helper — creates contacts and applies tags via OAuth 2.0 client_credentials flow.
 * Tags are resolved by name automatically; if the tag doesn't exist it is created on first use.
 * Credentials are injected from environment variables (KAJABI_CLIENT_ID, KAJABI_CLIENT_SECRET).
 */

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const KAJABI_TOKEN_URL = "https://api.kajabi.com/v1/oauth/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Fetch (or return cached) Kajabi OAuth access token */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("KAJABI_CLIENT_ID and KAJABI_CLIENT_SECRET must be set");
  }

  const res = await fetch(KAJABI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kajabi token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cachedToken.token;
}

/** In-process cache: tag name → tag ID */
const tagIdCache: Record<string, string> = {};

/**
 * Resolve a Kajabi tag ID by name.
 * Searches existing tags; if not found, creates the tag and returns the new ID.
 */
async function resolveTagId(tagName: string): Promise<string> {
  if (tagIdCache[tagName]) return tagIdCache[tagName];

  const token = await getAccessToken();

  // Search for existing tag by name
  const searchRes = await fetch(
    `${KAJABI_API_BASE}/contact_tags?filter[name_cont]=${encodeURIComponent(tagName)}&page[size]=25`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json",
      },
    }
  );

  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`Kajabi listContactTags failed (${searchRes.status}): ${text}`);
  }

  type KajabiTagItem = { id: string; attributes: { name: string } };
  const searchData = (await searchRes.json()) as { data: KajabiTagItem[] };

  // Find exact match (filter[name_cont] is a contains filter, not exact)
  const exactMatch = searchData.data.find(
    (t) => t.attributes.name.toLowerCase() === tagName.toLowerCase()
  );

  if (exactMatch) {
    tagIdCache[tagName] = exactMatch.id;
    return exactMatch.id;
  }

  // Tag does not exist — create it
  const createRes = await fetch(`${KAJABI_API_BASE}/contact_tags`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "contact_tags",
        attributes: { name: tagName },
      },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Kajabi createContactTag failed (${createRes.status}): ${text}`);
  }

  const createData = (await createRes.json()) as { data: { id: string } };
  tagIdCache[tagName] = createData.data.id;
  return createData.data.id;
}

/** Create or update a Kajabi contact by email */
export async function kajabiCreateContact(params: {
  email: string;
  name?: string;
}): Promise<{ id: string; email: string }> {
  const token = await getAccessToken();

  // Split name into first/last if provided
  const nameParts = (params.name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") ?? "";

  const res = await fetch(`${KAJABI_API_BASE}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: params.email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kajabi createContact failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string; email: string };
  return data;
}

/**
 * Add a tag to a Kajabi contact by tag name.
 * Resolves (or creates) the tag ID automatically.
 */
export async function kajabiAddTagByName(params: {
  contactId: string;
  tagName: string;
}): Promise<void> {
  const token = await getAccessToken();
  const tagId = await resolveTagId(params.tagName);

  const res = await fetch(
    `${KAJABI_API_BASE}/contacts/${params.contactId}/relationships/tags`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: [{ id: tagId, type: "contact_tags" }],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kajabi addTag failed (${res.status}): ${text}`);
  }
}

/**
 * Full opt-in flow: create contact + add tag by name in one call.
 * The tag is created automatically in Kajabi if it doesn't exist yet.
 */
export async function kajabiOptIn(params: {
  email: string;
  name?: string;
  tagName: string;
}): Promise<{ contactId: string }> {
  const contact = await kajabiCreateContact({
    email: params.email,
    name: params.name,
  });
  await kajabiAddTagByName({
    contactId: contact.id,
    tagName: params.tagName,
  });
  return { contactId: contact.id };
}
