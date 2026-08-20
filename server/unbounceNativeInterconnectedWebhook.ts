import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { interconnectedLeads } from "../drizzle/schema";
import { sendCapiEvent } from "./capiHelper";
import { getDb } from "./db";
import { pushInterconnectedEmailLead } from "./klaviyo";

export const UNBOUNCE_NATIVE_INTERCONNECTED_PATH = "/api/interconnected/unbounce-native-lead";
export const UNBOUNCE_NATIVE_INTERCONNECTED_TEST_PATH = "/interconnected-lp-3";
export const UNBOUNCE_NATIVE_SECRET_HEADER = "x-urban-monk-webhook-secret";

const unbounceWebhookPayload = z.object({
  email: z.unknown(),
  phone: z.unknown().optional(),
  sms_consent: z.unknown().optional(),
  // Classic Builder renders the single Checkbox Select choice as
  // `sms_consent_yes`, even when its parent field is mapped as
  // `sms_consent`. Accept both explicit field names; neither can create
  // consent without an affirmative value and a supplied phone number.
  sms_consent_yes: z.unknown().optional(),
  ip_address: z.unknown().optional(),
  page_uuid: z.unknown().optional(),
  variant: z.unknown().optional(),
  date_submitted: z.unknown().optional(),
  time_submitted: z.unknown().optional(),
  page_url: z.unknown(),
  page_name: z.unknown().optional(),
});

function firstValue(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed || null;
}

export function isExplicitSmsConsent(value: unknown): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === true) return true;
  if (typeof candidate !== "string") return false;

  return ["1", "true", "yes", "on", "checked"].includes(candidate.trim().toLowerCase());
}

export function resolveNativeSmsConsent(input: {
  phone?: unknown;
  sms_consent?: unknown;
  sms_consent_yes?: unknown;
}): boolean {
  const phone = firstValue(input.phone);
  return Boolean(phone) && (
    isExplicitSmsConsent(input.sms_consent)
    || isExplicitSmsConsent(input.sms_consent_yes)
  );
}

function parseUnbouncePayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const embedded = source["data.json"] ?? source.data_json;

  if (typeof embedded === "string") {
    try {
      const parsed = JSON.parse(embedded);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  return source;
}

function hasMatchingSecret(req: Request): boolean {
  const configuredSecret = process.env.UNBOUNCE_INTERCONNECTED_WEBHOOK_SECRET?.trim();
  const suppliedSecret = req.header(UNBOUNCE_NATIVE_SECRET_HEADER)?.trim();
  if (!configuredSecret || !suppliedSecret) return false;

  const expected = Buffer.from(configuredSecret);
  const actual = Buffer.from(suppliedSecret);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function isAllowedNativeInterconnectedPageUrl(pageUrl: string): boolean {
  try {
    const url = new URL(pageUrl);
    return url.origin === "https://try.theurbanmonk.com"
      && url.pathname.replace(/\/$/, "") === UNBOUNCE_NATIVE_INTERCONNECTED_TEST_PATH;
  } catch {
    return false;
  }
}

function buildEventId(input: { email: string; pageUuid: string | null; submittedAt: string }): string {
  const digest = crypto
    .createHash("sha256")
    .update([input.email, input.pageUuid ?? "unknown-page", input.submittedAt].join("|"))
    .digest("hex")
    .slice(0, 48);
  return `ubn_ic_${digest}`;
}

function readTracking(pageUrl: string) {
  const url = new URL(pageUrl);
  return {
    fbclid: url.searchParams.get("fbclid"),
    utmSource: url.searchParams.get("utm_source") ?? "unbounce",
    utmMedium: url.searchParams.get("utm_medium") ?? "native_form",
    utmCampaign: url.searchParams.get("utm_campaign") ?? "interconnected_unbounce_native",
    utmContent: url.searchParams.get("utm_content"),
  };
}

/**
 * Server-to-server receiver for the unpublished native Unbounce Interconnected form.
 * It is intentionally page-scoped so the account-wide Unbounce -> Klaviyo integration
 * can keep routing unrelated Deep Sleep pages without interference.
 */
export function registerUnbounceNativeInterconnectedWebhook(app: Express) {
  app.post(UNBOUNCE_NATIVE_INTERCONNECTED_PATH, async (req: Request, res: Response) => {
    if (!hasMatchingSecret(req)) {
      return res.status(401).json({ error: "Invalid webhook secret" });
    }

    const rawPayload = parseUnbouncePayload(req.body);
    const parsed = unbounceWebhookPayload.safeParse(rawPayload);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid Unbounce native form payload" });
    }

    const email = firstValue(parsed.data.email)?.toLowerCase();
    const phone = firstValue(parsed.data.phone);
    // Phone collection alone never creates SMS marketing consent. The native
    // checkbox must be checked and a phone must be present before Klaviyo is
    // asked to subscribe the profile to the dedicated SMS list.
    const smsConsent = resolveNativeSmsConsent({
      phone,
      sms_consent: parsed.data.sms_consent,
      sms_consent_yes: parsed.data.sms_consent_yes,
    });
    const pageUrl = firstValue(parsed.data.page_url);
    const pageUuid = firstValue(parsed.data.page_uuid);
    const variant = firstValue(parsed.data.variant) ?? "E";
    const clientIp = firstValue(parsed.data.ip_address);
    const submittedAt = [firstValue(parsed.data.date_submitted), firstValue(parsed.data.time_submitted)]
      .filter(Boolean)
      .join(" ") || "unknown-submission-time";

    if (!email || !z.string().email().safeParse(email).success || !pageUrl || !isAllowedNativeInterconnectedPageUrl(pageUrl)) {
      return res.status(400).json({ error: "Invalid Interconnected native form submission" });
    }

    const tracking = readTracking(pageUrl);
    const eventId = buildEventId({ email, pageUuid, submittedAt });
    let leadId: number | null = null;
    let eventAlreadySent = false;
    let smsSubscribed = false;

    try {
      const db = await getDb();
      if (db) {
        const [existingEvent] = await db
          .select({ id: interconnectedLeads.id, capiLeadSent: interconnectedLeads.capiLeadSent })
          .from(interconnectedLeads)
          .where(eq(interconnectedLeads.capiLeadEventId, eventId))
          .limit(1);

        if (existingEvent) {
          leadId = existingEvent.id;
          eventAlreadySent = Boolean(existingEvent.capiLeadSent);
        } else {
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const [existingEmail] = await db
            .select({ id: interconnectedLeads.id })
            .from(interconnectedLeads)
            .where(and(eq(interconnectedLeads.email, email), gte(interconnectedLeads.createdAt, oneDayAgo)))
            .limit(1);

          if (existingEmail) {
            leadId = existingEmail.id;
          } else {
            const result = await db.insert(interconnectedLeads).values({
              email,
              name: "Unbounce native Interconnected lead",
              phone,
              smsConsent,
              utmSource: tracking.utmSource,
              utmMedium: tracking.utmMedium,
              utmCampaign: tracking.utmCampaign,
              utmContent: tracking.utmContent,
              funnelPath: "ko_klaviyo",
              referrer: pageUrl,
              pageVariant: variant.slice(0, 10),
              fbclid: tracking.fbclid,
              clientIp,
              klaviyoSynced: false,
              capiLeadEventId: eventId,
              createdAt: Date.now(),
            });
            leadId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId ?? null;
          }
        }
      }
    } catch (error) {
      console.error("[unbounce-native-interconnected] Local lead record error:", error);
      return res.status(502).json({ error: "First-party lead record unavailable" });
    }

    try {
      const klaviyoResult = await pushInterconnectedEmailLead({
        email,
        phone: phone ?? undefined,
        smsConsent,
      });
      smsSubscribed = klaviyoResult.smsSubscribed;
      if (leadId) {
        const db = await getDb();
        if (db) {
          await db
            .update(interconnectedLeads)
            .set({ smsConsent, klaviyoSynced: true, klaviyoSyncedAt: Date.now() })
            .where(eq(interconnectedLeads.id, leadId));
        }
      }

    } catch (error) {
      console.error("[unbounce-native-interconnected] Klaviyo delivery error:", error);
      return res.status(502).json({ error: "Klaviyo delivery unavailable" });
    }

    if (eventAlreadySent) {
      return res.json({ ok: true, deduplicated: true, eventId, smsSubscribed });
    }

    const capiSent = await sendCapiEvent({
      eventName: "Lead",
      eventId,
      eventSourceUrl: pageUrl,
      email,
      fbclid: tracking.fbclid,
      clientIpAddress: clientIp,
      utmSource: tracking.utmSource,
      utmCampaign: tracking.utmCampaign,
    });

    if (capiSent && leadId) {
      try {
        const db = await getDb();
        if (db) {
          await db
            .update(interconnectedLeads)
            .set({ capiLeadSent: true, capiLeadSentAt: Date.now(), capiLeadEventId: eventId })
            .where(eq(interconnectedLeads.id, leadId));
        }
      } catch (error) {
        console.error("[unbounce-native-interconnected] CAPI status write error:", error);
      }
    }

    return res.status(200).json({ ok: true, capiSent, eventId, smsSubscribed });
  });
}
