import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, gte, sql } from "drizzle-orm";
import { sendCapiEvent } from "./capiHelper";
import { getDb } from "./db";
import { interconnectedLeads } from "../drizzle/schema";

export const UNBOUNCE_INTERCONNECTED_ORIGIN = "https://try.theurbanmonk.com";
export const UNBOUNCE_INTERCONNECTED_FORM_ID = "SJAKDW";
export const UNBOUNCE_LEAD_BRIDGE_PATH = "/api/interconnected/unbounce-lead";

const bridgePayload = z.object({
  eventId: z.string().regex(/^ub_ic_[A-Za-z0-9_-]{12,96}$/),
  formId: z.literal(UNBOUNCE_INTERCONNECTED_FORM_ID),
  email: z.string().email().max(255).optional(),
  pageUrl: z.string().url().max(1024),
  fbp: z.string().max(256).optional(),
  fbc: z.string().max(256).optional(),
  fbclid: z.string().max(256).optional(),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
});

type ExistingLeadAttributionInput = {
  pageUrl: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  clientIp: string | null;
  userAgent: string | null;
};

export function buildExistingLeadAttributionUpdate(input: ExistingLeadAttributionInput) {
  return {
    ...(input.utmSource ? { utmSource: input.utmSource } : {}),
    ...(input.utmMedium ? { utmMedium: input.utmMedium } : {}),
    ...(input.utmCampaign ? { utmCampaign: input.utmCampaign } : {}),
    ...(input.utmContent ? { utmContent: input.utmContent } : {}),
    ...(input.fbclid ? { fbclid: input.fbclid } : {}),
    ...(input.fbp ? { fbp: input.fbp } : {}),
    ...(input.fbc ? { fbc: input.fbc } : {}),
    ...(input.clientIp ? { clientIp: input.clientIp } : {}),
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    referrer: input.pageUrl,
  };
}

export function shouldSuppressBridgeCapiForExistingLead(capiLeadSent: boolean): boolean {
  return Boolean(capiLeadSent);
}

export function isAllowedUnbounceOrigin(origin: string | undefined): boolean {
  return origin === UNBOUNCE_INTERCONNECTED_ORIGIN;
}

export function isAllowedUnbouncePageUrl(pageUrl: string): boolean {
  try {
    const url = new URL(pageUrl);
    return url.origin === UNBOUNCE_INTERCONNECTED_ORIGIN && url.pathname === "/interconnected-lp/";
  } catch {
    return false;
  }
}

/**
 * The bridge accepts normal JSON fetches and redirect-safe text/plain beacons.
 * Text payloads avoid a CORS preflight when Klaviyo immediately redirects a
 * successful form submit to the post-registration page.
 */
export function parseUnbounceBridgeBody(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return undefined;
    }
  }

  if (Buffer.isBuffer(body)) {
    return parseUnbounceBridgeBody(body.toString("utf8"));
  }

  return body;
}

function setBridgeCors(req: Request, res: Response) {
  if (!isAllowedUnbounceOrigin(req.headers.origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", UNBOUNCE_INTERCONNECTED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
  return true;
}

/**
 * Records one Klaviyo embedded-form conversion with the exact browser event ID
 * supplied by the Unbounce page, then forwards the same ID to Meta CAPI. The
 * companion browser pixel call therefore deduplicates on event name + event ID.
 */
export function registerUnbounceKlaviyoLeadBridge(app: Express) {
  app.options(UNBOUNCE_LEAD_BRIDGE_PATH, (req, res) => {
    if (!setBridgeCors(req, res)) return res.status(403).end();
    return res.status(204).end();
  });

  app.post(UNBOUNCE_LEAD_BRIDGE_PATH, express.text({ type: "text/plain", limit: "16kb" }), async (req, res) => {
    if (!setBridgeCors(req, res)) return res.status(403).json({ error: "Origin not allowed" });

    const parsed = bridgePayload.safeParse(parseUnbounceBridgeBody(req.body));
    if (!parsed.success || !isAllowedUnbouncePageUrl(parsed.data?.pageUrl ?? "")) {
      return res.status(400).json({ error: "Invalid Interconnected form event" });
    }

    const input = parsed.data;
    const email = input.email?.trim().toLowerCase();
    const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      || req.socket.remoteAddress
      || null;
    const userAgent = req.headers["user-agent"]?.slice(0, 512) || null;

    let leadId: number | null = null;
    let eventAlreadySent = false;

    try {
      const db = await getDb();
      if (db) {
        const [existingEvent] = await db
          .select({ id: interconnectedLeads.id, capiLeadSent: interconnectedLeads.capiLeadSent })
          .from(interconnectedLeads)
          .where(eq(interconnectedLeads.capiLeadEventId, input.eventId))
          .limit(1);

        if (existingEvent) {
          leadId = existingEvent.id;
          eventAlreadySent = Boolean(existingEvent.capiLeadSent);
        } else if (email) {
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const [existingEmail] = await db
            .select({
              id: interconnectedLeads.id,
              capiLeadSent: interconnectedLeads.capiLeadSent,
            })
            .from(interconnectedLeads)
            .where(and(eq(interconnectedLeads.email, email), gte(interconnectedLeads.createdAt, oneDayAgo)))
            .limit(1);

          if (existingEmail) {
            leadId = existingEmail.id;
            eventAlreadySent = shouldSuppressBridgeCapiForExistingLead(Boolean(existingEmail.capiLeadSent));
            await db
              .update(interconnectedLeads)
              .set(buildExistingLeadAttributionUpdate({
                pageUrl: input.pageUrl,
                fbp: input.fbp,
                fbc: input.fbc,
                fbclid: input.fbclid,
                utmSource: input.utmSource,
                utmMedium: input.utmMedium,
                utmCampaign: input.utmCampaign,
                utmContent: input.utmContent,
                clientIp,
                userAgent,
              }))
              .where(eq(interconnectedLeads.id, existingEmail.id));
          } else {
            const result = await db.insert(interconnectedLeads).values({
              email,
              name: "Unbounce Klaviyo lead",
              utmSource: input.utmSource ?? "unbounce",
              utmMedium: input.utmMedium ?? "embedded_form",
              utmCampaign: input.utmCampaign ?? "interconnected_unbounce",
              utmContent: input.utmContent ?? null,
              // This entry point is permanently owned by the KO/Klaviyo
              // experiment. Existing leads are intentionally never relabeled.
              funnelPath: "ko_klaviyo",
              referrer: input.pageUrl,
              pageVariant: "unbounce",
              fbclid: input.fbclid ?? null,
              fbp: input.fbp ?? null,
              fbc: input.fbc ?? null,
              clientIp,
              userAgent,
              klaviyoSynced: true,
              capiLeadEventId: input.eventId,
              createdAt: Date.now(),
            });
            leadId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId ?? null;
          }
        }
      }
    } catch (error) {
      console.error("[unbounce-lead] Local lead record error:", error);
    }

    if (eventAlreadySent) {
      return res.json({ ok: true, deduplicated: true, eventId: input.eventId });
    }

    const capiSent = await sendCapiEvent({
      eventName: "Lead",
      eventId: input.eventId,
      eventSourceUrl: input.pageUrl,
      email: email ?? null,
      fbp: input.fbp ?? null,
      fbc: input.fbc ?? null,
      fbclid: input.fbclid ?? null,
      clientIpAddress: clientIp,
      clientUserAgent: userAgent,
      utmSource: input.utmSource ?? "unbounce",
      utmCampaign: input.utmCampaign ?? "interconnected_unbounce",
    });

    if (capiSent && leadId) {
      try {
        const db = await getDb();
        if (db) {
          await db
            .update(interconnectedLeads)
            .set({ capiLeadSent: true, capiLeadSentAt: Date.now(), capiLeadEventId: input.eventId })
            .where(eq(interconnectedLeads.id, leadId));
        }
      } catch (error) {
        console.error("[unbounce-lead] CAPI status write error:", error);
      }
    }

    return res.json({ ok: true, capiSent, eventId: input.eventId });
  });
}
