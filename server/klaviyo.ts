/**
 * Klaviyo API helper
 * Handles profile creation/update and SMS list subscription for the Interconnected opt-in funnel.
 * Docs: https://developers.klaviyo.com/en/reference/api-overview
 */

import { ENV } from "./_core/env";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15"; // Latest stable Klaviyo API revision

// The Klaviyo list ID for Interconnected SMS subscribers.
// Create a list in Klaviyo named "Interconnected SMS Subscribers" and paste its ID here.
// Found at: Klaviyo → Lists & Segments → [list name] → Settings → List ID
export const INTERCONNECTED_SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID ?? "";
// The email list is the authoritative trigger for the KO Interconnected flow.
// Keep this distinct from the optional SMS-consent list above.
export const INTERCONNECTED_EMAIL_LIST_ID = "Rrx44Q";

interface KlaviyoProfile {
  email: string;
  firstName?: string;
  phone?: string;
  smsConsent?: boolean;
  source?: string;
  properties?: Record<string, string | boolean | number | string[]>;
}

/**
 * Upsert a Klaviyo profile and return the profile ID.
 */
async function upsertProfile(profile: KlaviyoProfile): Promise<string> {
  const body = {
    data: {
      type: "profile",
      attributes: {
        email: profile.email,
        first_name: profile.firstName ?? "",
        phone_number: profile.phone ? normalizePhone(profile.phone) : undefined,
        properties: {
          sms_consent: profile.smsConsent ?? false,
          sms_consent_source: profile.source ?? "interconnected-optin",
          sms_consent_timestamp: new Date().toISOString(),
          ...(profile.properties ?? {}),
        },
      },
    },
  };

  const res = await fetch(`${KLAVIYO_BASE}/profiles/`, {
    method: "POST",
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json() as any;

  // 409 = profile already exists — extract the existing ID from the error
  if (res.status === 409) {
    const existingId = json?.errors?.[0]?.meta?.duplicate_profile_id;
    if (existingId) {
      // Patch the existing profile with the phone number
      await patchProfile(existingId, profile);
      return existingId;
    }
    throw new Error(`Klaviyo 409 but no duplicate_profile_id: ${JSON.stringify(json)}`);
  }

  if (!res.ok) {
    throw new Error(`Klaviyo upsertProfile failed (${res.status}): ${JSON.stringify(json)}`);
  }

  return json.data.id as string;
}

/**
 * Patch an existing profile with updated phone and consent data.
 */
async function patchProfile(profileId: string, profile: Partial<KlaviyoProfile>): Promise<void> {
  const body = {
    data: {
      type: "profile",
      id: profileId,
      attributes: {
        ...(profile.phone ? { phone_number: normalizePhone(profile.phone) } : {}),
        properties: {
          ...(profile.smsConsent !== undefined ? {
            sms_consent: profile.smsConsent,
            sms_consent_source: profile.source ?? "interconnected-optin",
            sms_consent_timestamp: new Date().toISOString(),
          } : {}),
          ...(profile.properties ?? {}),
        },
      },
    },
  };

  const res = await fetch(`${KLAVIYO_BASE}/profiles/${profileId}/`, {
    method: "PATCH",
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const json = await res.json();
    throw new Error(`Klaviyo patchProfile failed (${res.status}): ${JSON.stringify(json)}`);
  }
}

/**
 * Subscribe a profile to SMS on a specific list.
 * This records explicit SMS consent in Klaviyo (TCPA-compliant).
 */
async function subscribeToSmsList(profileId: string, listId: string, phone?: string): Promise<void> {
  const body = {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        profiles: {
          data: [
            {
              type: "profile",
              id: profileId,
              attributes: {
                // Klaviyo requires phone_number in the subscription payload itself
                ...(phone ? { phone_number: normalizePhone(phone) } : {}),
                subscriptions: {
                  sms: {
                    marketing: {
                      consent: "SUBSCRIBED",
                    },
                  },
                },
              },
            },
          ],
        },
      },
      relationships: {
        list: {
          data: {
            type: "list",
            id: listId,
          },
        },
      },
    },
  };

  const res = await fetch(`${KLAVIYO_BASE}/profile-subscription-bulk-create-jobs/`, {
    method: "POST",
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 202) {
    const json = await res.json();
    throw new Error(`Klaviyo subscribeToSmsList failed (${res.status}): ${JSON.stringify(json)}`);
  }
}

/**
 * Add a profile to a list (without subscription — for email lists).
 */
async function addProfileToList(profileId: string, listId: string): Promise<void> {
  const body = {
    data: [{ type: "profile", id: profileId }],
  };

  const res = await fetch(`${KLAVIYO_BASE}/lists/${listId}/relationships/profiles/`, {
    method: "POST",
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });

  // 204 = success (no content), 400 = already in list (ok)
  if (!res.ok && res.status !== 204 && res.status !== 400) {
    const text = await res.text();
    throw new Error(`Klaviyo addProfileToList failed (${res.status}): ${text}`);
  }
}

/**
 * Main entry point: push an Interconnected opt-in to Klaviyo.
 * - Always upserts the profile
 * - If smsConsent is true AND phone is provided, subscribes to SMS list
 */
/**
 * Push a Tantra quiz lead to Klaviyo.
 * Upserts the profile with quiz result metadata and adds to the Tantra email list
 * so the autoresponder sequence fires automatically.
 */
export interface TantraQuizLeadProfileInput {
  email: string;
  firstName?: string;
  result: "tantra_him" | "tantra_her" | "tantra_bundle" | "pending" | null;
  gutFlag?: boolean;
  sleepFlag?: boolean;
  oralFlag?: boolean;
  hormoneFlag?: boolean;
  primaryPath?: string;
  carePaths?: string[];
  clinicianFollowUp?: boolean;
}

export function buildTantraQuizProfileProperties(opts: TantraQuizLeadProfileInput) {
  return {
    tantra_quiz_result: opts.result ?? "unknown",
    tantra_gut_flag: opts.gutFlag ?? false,
    tantra_sleep_flag: opts.sleepFlag ?? false,
    tantra_oral_flag: opts.oralFlag ?? false,
    tantra_hormone_flag: opts.hormoneFlag ?? false,
    tantra_primary_care_path: opts.primaryPath ?? "intimacy",
    tantra_care_paths: opts.carePaths ?? ["intimacy"],
    tantra_clinician_followup_needed: opts.clinicianFollowUp ?? false,
    tantra_quiz_completed_at: new Date().toISOString(),
  };
}

export async function pushTantraQuizLead(opts: TantraQuizLeadProfileInput): Promise<{ profileId: string }> {
  if (!ENV.klaviyoPrivateKey) {
    console.warn("[Klaviyo] KLAVIYO_PRIVATE_KEY not set — skipping Tantra push");
    return { profileId: "" };
  }

  const profileId = await upsertProfile({
    email: opts.email,
    firstName: opts.firstName,
    source: "tantra-quiz",
  });

  // Patch additional quiz-specific properties onto the profile
  await patchProfile(profileId, {
    properties: buildTantraQuizProfileProperties(opts),
  });

  // Add to Tantra email list if configured
  const tantraListId = process.env.KLAVIYO_TANTRA_LIST_ID ?? "";
  if (tantraListId) {
    await addProfileToList(profileId, tantraListId);
  }

  return { profileId };
}

export async function pushInterconnectedOptIn(opts: {
  email: string;
  firstName?: string;
  phone?: string;
  smsConsent?: boolean;
}): Promise<{ profileId: string; smsSubscribed: boolean }> {
  return pushInterconnectedEmailLead(opts);
}

/**
 * Adds an Interconnected lead to the email list that triggers the KO automation.
 * Phone may be collected for later contact context, but SMS marketing consent is
 * never inferred and must be explicitly true before the SMS list is subscribed.
 */
export async function pushInterconnectedEmailLead(opts: {
  email: string;
  firstName?: string;
  phone?: string;
  smsConsent?: boolean;
}): Promise<{ profileId: string; smsSubscribed: boolean }> {
  if (!ENV.klaviyoPrivateKey) {
    console.warn("[Klaviyo] KLAVIYO_PRIVATE_KEY not set — skipping push");
    return { profileId: "", smsSubscribed: false };
  }

  const profileId = await upsertProfile({
    email: opts.email,
    firstName: opts.firstName,
    phone: opts.phone,
    smsConsent: opts.smsConsent,
    source: "interconnected-optin",
  });

  await addProfileToList(profileId, INTERCONNECTED_EMAIL_LIST_ID);

  let smsSubscribed = false;

  if (opts.smsConsent && opts.phone && INTERCONNECTED_SMS_LIST_ID) {
    await subscribeToSmsList(profileId, INTERCONNECTED_SMS_LIST_ID, opts.phone);
    smsSubscribed = true;
  }

  return { profileId, smsSubscribed };
}

/**
 * Lightweight API test — verifies the key works by fetching account info.
 */
export async function testKlaviyoConnection(): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const res = await fetch(`${KLAVIYO_BASE}/accounts/`, {
      headers: klaviyoHeaders(),
    });
    const json = await res.json() as any;
    if (!res.ok) return { ok: false, error: JSON.stringify(json) };
    const name = json?.data?.[0]?.attributes?.contact_information?.organization_name ?? "unknown";
    return { ok: true, accountName: name };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function klaviyoHeaders() {
  return {
    "Authorization": `Klaviyo-API-Key ${ENV.klaviyoPrivateKey}`,
    "Content-Type": "application/json",
    "revision": REVISION,
  };
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US).
 * Klaviyo requires E.164.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already has country code or international
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
}
