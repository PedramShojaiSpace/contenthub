/**
 * Kajabi API helper — creates contacts and applies tags via OAuth 2.0 client_credentials flow.
 * Tags are resolved by name automatically; if the tag doesn't exist it is created on first use.
 * Credentials are injected from environment variables (KAJABI_CLIENT_ID, KAJABI_CLIENT_SECRET).
 */

import { safeParseJson } from "./fetchUtils";

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

  const data = await safeParseJson<{
    access_token: string;
    expires_in: number;
  }>(res, "Kajabi token request");
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
  const searchData = await safeParseJson<{ data: KajabiTagItem[] }>(searchRes, "Kajabi listContactTags");

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

  const createData = await safeParseJson<{ data: { id: string } }>(createRes, "Kajabi createContactTag");
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

  const attributes: Record<string, string> = { email: params.email };
  if (firstName) attributes.first_name = firstName;
  if (lastName) attributes.last_name = lastName;

  // Site ID for "The Urban Monk Academy" — required by Kajabi API for contact creation
  const URBAN_MONK_SITE_ID = "2148432935";

  const res = await fetch(`${KAJABI_API_BASE}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: {
        type: "contacts",
        attributes,
        relationships: {
          site: {
            data: {
              type: "sites",
              id: URBAN_MONK_SITE_ID,
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();

    // ── Duplicate-email handling ─────────────────────────────────────────────
    // Kajabi returns 422 with "Email has already been taken" when the contact
    // already exists. Rather than failing, look up the existing contact by
    // email and return it so the caller can proceed to tag them.
    if (res.status === 422) {
      let isDuplicate = false;
      try {
        const errBody = JSON.parse(text);
        const detail: string = errBody?.errors?.[0]?.detail ?? "";
        if (detail.toLowerCase().includes("already been taken") || detail.toLowerCase().includes("already taken")) {
          isDuplicate = true;
        }
      } catch { /* not JSON — fall through */ }

      if (isDuplicate) {
        // Find the existing contact by email
        const existing = await kajabiFindContactByEmail(params.email);
        if (existing) return existing;
        // If lookup also fails, surface a clear error
        throw new Error(`Kajabi contact already exists for ${params.email} but could not be retrieved. Try again.`);
      }
    }

    // Surface undeliverable address as a clear, actionable error
    try {
      const errBody = JSON.parse(text);
      const detail = errBody?.errors?.[0]?.detail ?? "";
      if (detail.toLowerCase().includes("undeliverable")) {
        throw new Error(`Kajabi rejected this email as undeliverable — the address may be invalid or inactive. Archive this lead.`);
      }
    } catch (parseErr: any) {
      if (parseErr.message.includes("undeliverable")) throw parseErr;
    }
    throw new Error(`Kajabi createContact failed (${res.status}): ${text}`);
  }

  const data = await safeParseJson<{ data: { id: string; attributes: { email: string } } }>(res, "Kajabi createContact");
  return { id: data.data.id, email: data.data.attributes.email };
}

/**
 * Look up a Kajabi contact by exact email address.
 * Returns null if not found or on API error.
 */
export async function kajabiFindContactByEmail(
  email: string
): Promise<{ id: string; email: string } | null> {
  const token = await getAccessToken();
  const res = await fetch(
    `${KAJABI_API_BASE}/contacts?filter[email_eq]=${encodeURIComponent(email)}&page[size]=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json",
      },
    }
  );
  if (!res.ok) return null;
  const data = await safeParseJson<{
    data: Array<{ id: string; attributes: { email: string } }>;
  }>(res, "Kajabi findContactByEmail");
  const contact = data.data?.[0];
  if (!contact) return null;
  return { id: contact.id, email: contact.attributes.email };
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

// ─── Attribution helpers ──────────────────────────────────────────────────────

/**
 * Fetch contacts from Kajabi filtered by a given tag name.
 * Returns a lightweight list: id, email, first_name, last_name, created_at.
 */
export async function getKajabiContactsByTag(tagName: string): Promise<Array<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}>> {
  const token = await getAccessToken();
  let tagId: string;
  try {
    tagId = await resolveTagId(tagName);
  } catch {
    return [];
  }
  const res = await fetch(
    `${KAJABI_API_BASE}/contacts?filter[tag_id]=${tagId}&page[size]=200`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" } }
  );
  if (!res.ok) return [];
  const data = await safeParseJson<{
    data: Array<{ id: string; attributes: { email: string; first_name: string; last_name: string; created_at: string } }>;
  }>(res, "getKajabiContactsByTag");
  return (data.data ?? []).map((c) => ({
    id: c.id,
    email: c.attributes.email,
    firstName: c.attributes.first_name ?? "",
    lastName: c.attributes.last_name ?? "",
    createdAt: c.attributes.created_at ?? "",
  }));
}

/**
 * Fetch all Kajabi tags with contact counts.
 */
export async function getKajabiTags(): Promise<Array<{ id: string; name: string; contactCount: number }>> {
  const token = await getAccessToken();
  const res = await fetch(`${KAJABI_API_BASE}/contact_tags?page[size]=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
  });
  if (!res.ok) return [];
  const data = await safeParseJson<{
    data: Array<{ id: string; attributes: { name: string; contacts_count?: number } }>;
  }>(res, "getKajabiTags");
  return (data.data ?? []).map((t) => ({
    id: t.id,
    name: t.attributes.name,
    contactCount: t.attributes.contacts_count ?? 0,
  }));
}
