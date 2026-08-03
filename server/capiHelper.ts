/**
 * capiHelper.ts — Meta Conversions API (CAPI) Server-Side Event Sender
 *
 * Sends Lead, InitiateCheckout, and Purchase events to Meta CAPI.
 * Uses SHA-256 hashed email for user matching.
 * event_id must match the browser pixel event_id for deduplication.
 *
 * Pixel ID: 1498608757116877
 * API version: v19.0
 */

import { createHash, createHmac } from "crypto";

const PIXEL_ID = "1498608757116877";
const CAPI_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function hashPhone(phone: string): string {
  // Normalize: strip non-digits, ensure E.164-ish
  const normalized = phone.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export interface CapiEventParams {
  eventName: "Lead" | "InitiateCheckout" | "Purchase" | "CompleteRegistration";
  eventId: string;           // Must match browser pixel event_id for dedup
  eventSourceUrl: string;    // Full URL of the page where the event occurred
  email?: string | null;
  phone?: string | null;
  fbclid?: string | null;    // Raw fbclid from URL (not hashed)
  fbp?: string | null;       // _fbp cookie value
  fbc?: string | null;       // _fbc cookie value
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  // Purchase-specific
  value?: number;            // In dollars (not cents)
  currency?: string;
  contentName?: string;
  orderId?: string;
  // UTM
  utmCampaign?: string | null;
  utmSource?: string | null;
}

export async function sendCapiEvent(params: CapiEventParams): Promise<boolean> {
  const accessToken = process.env.META_AD_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[CAPI] META_AD_ACCESS_TOKEN not set — skipping CAPI event");
    return false;
  }

  // Build user_data
  const userData: Record<string, string> = {};
  if (params.email) userData.em = hashEmail(params.email);
  if (params.phone) userData.ph = hashPhone(params.phone);
  if (params.clientIpAddress) userData.client_ip_address = params.clientIpAddress;
  if (params.clientUserAgent) userData.client_user_agent = params.clientUserAgent;

  // fbc: prefer explicit cookie, fall back to constructing from fbclid
  if (params.fbc) {
    userData.fbc = params.fbc;
  } else if (params.fbclid) {
    userData.fbc = `fb.1.${Date.now()}.${params.fbclid}`;
  }
  if (params.fbp) userData.fbp = params.fbp;

  // Build custom_data
  const customData: Record<string, unknown> = {};
  if (params.value !== undefined) {
    customData.value = params.value.toFixed(2);
    customData.currency = params.currency || "USD";
  }
  if (params.contentName) customData.content_name = params.contentName;
  if (params.orderId) customData.order_id = params.orderId;
  if (params.utmCampaign) customData.campaign = params.utmCampaign;

  const eventPayload = {
    data: [
      {
        event_name: params.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: "website",
        event_source_url: params.eventSourceUrl,
        user_data: userData,
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
      },
    ],
  };

  try {
    const resp = await fetch(`${CAPI_URL}?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    });
    const body = (await resp.json()) as { events_received?: number; error?: unknown };
    if (!resp.ok) {
      console.error(`[CAPI] ${params.eventName} error:`, body);
      return false;
    }
    console.log(
      `[CAPI] ${params.eventName} sent — event_id: ${params.eventId}, events_received: ${body.events_received}`
    );
    return true;
  } catch (err) {
    console.error(`[CAPI] ${params.eventName} fetch failed:`, err);
    return false;
  }
}

/** Generate a stable, unique event_id for a given lead + event type.
 *  Using email + eventName + date ensures the same person re-opting in
 *  on the same day gets the same event_id → safe dedup with browser pixel.
 */
export function generateEventId(email: string, eventName: string, suffix?: string): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `${email.toLowerCase().trim()}:${eventName}:${day}${suffix ? `:${suffix}` : ""}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
