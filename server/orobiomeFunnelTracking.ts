import type { Request, Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { orobiomeFunnelEvents } from "../drizzle/schema";
import { isAuthorizedShopifyWebhook } from "./shopifyWebhookAuth";
import { getShopifyWebhookRawBody, parseShopifyWebhookPayload } from "./shopifyWebhookPayload";
import { ENV } from "./_core/env";

const EVENT_TYPES = [
  "page_view",
  "scroll_25",
  "scroll_50",
  "scroll_75",
  "cta_click",
  "cart_intent",
] as const;

const eventPayloadSchema = z.object({
  visitorId: z.string().regex(/^[a-z0-9_-]{16,64}$/i),
  variant: z.enum(["control", "offer_clarity"]),
  eventType: z.enum(EVENT_TYPES),
  pagePath: z.literal("/pages/oral"),
  ctaPosition: z.enum(["hero", "package", "final"]).optional(),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(256).optional(),
  utmContent: z.string().max(256).optional(),
  fbclid: z.string().max(256).optional(),
});

const allowedOrigins = new Set([
  "https://shop.theurbanmonk.com",
  "https://content.theurbanmonk.com",
  "https://ch.theurbanmonk.com",
]);

function setCorsHeaders(req: Request, res: Response): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

/**
 * Accepts anonymous browser events from the published Orobiome page. This endpoint
 * deliberately stores only funnel metadata, never customer identity or raw IP data.
 */
export async function handleOrobiomeFunnelEvent(req: Request, res: Response) {
  if (!setCorsHeaders(req, res)) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method === "OPTIONS") return res.status(204).end();

  const parsed = eventPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid funnel event" });

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Tracking store unavailable" });

  const input = parsed.data;
  await db.insert(orobiomeFunnelEvents).values({
    visitorId: input.visitorId,
    variant: input.variant,
    eventType: input.eventType,
    pagePath: input.pagePath,
    ctaPosition: input.ctaPosition ?? null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    utmContent: input.utmContent ?? null,
    fbclid: input.fbclid ?? null,
    eventAt: Date.now(),
  });

  return res.status(204).end();
}

/**
 * Shopify officially supports cart-permalink `attributes[...]` parameters for
 * conversion tracking. This keeps an anonymous visit identifier available on the
 * paid-order webhook without changing the product, price, cart path, or BixGrow ref.
 */
export function buildOrobiomeTrackedCartUrl(rawHref: string, input: {
  visitorId: string;
  variant: "control" | "offer_clarity";
  ctaPosition: "hero" | "package" | "final";
}): string {
  const url = new URL(rawHref);
  url.searchParams.set("attributes[orobiome_visit_id]", input.visitorId);
  url.searchParams.set("attributes[orobiome_variant]", input.variant);
  url.searchParams.set("attributes[orobiome_cta]", input.ctaPosition);
  return url.toString();
}

/**
 * Called only after the existing verified Shopify ORDERS_PAID handler has accepted
 * the payload. No purchase event is sent to Meta from this function.
 */
export async function recordOrobiomePaidPurchase(input: {
  orderId: string;
  orderTotalCents: number;
  currency: string;
  noteAttributes: Array<{ name?: string; value?: string }>;
}): Promise<boolean> {
  const attrs = new Map(
    input.noteAttributes
      .filter((attr) => typeof attr?.name === "string" && typeof attr?.value === "string")
      .map((attr) => [String(attr.name), String(attr.value)])
  );
  const visitorId = attrs.get("orobiome_visit_id");
  const variant = attrs.get("orobiome_variant");
  if (!visitorId || !/^[a-z0-9_-]{16,64}$/i.test(visitorId)) return false;
  if (variant !== "control" && variant !== "offer_clarity") return false;

  const db = await getDb();
  if (!db) return false;
  const [existing] = await db
    .select({ id: orobiomeFunnelEvents.id })
    .from(orobiomeFunnelEvents)
    .where(and(
      eq(orobiomeFunnelEvents.shopifyOrderId, input.orderId),
      eq(orobiomeFunnelEvents.eventType, "purchase")
    ))
    .limit(1);
  if (existing) return true;

  await db.insert(orobiomeFunnelEvents).values({
    visitorId,
    variant,
    eventType: "purchase",
    pagePath: "/pages/oral",
    ctaPosition: attrs.get("orobiome_cta") ?? null,
    shopifyOrderId: input.orderId,
    orderTotalCents: input.orderTotalCents,
    currency: input.currency.slice(0, 3).toUpperCase(),
    eventAt: Date.now(),
  });
  return true;
}

/**
 * Receives Shopify CHECKOUTS_CREATE only after the native cart permalink has
 * provided the anonymous Orobiome attributes. The endpoint uses the same HMAC
 * authentication standard as the paid-order receiver and never stores identity.
 */
export async function handleOrobiomeCheckoutStarted(req: Request, res: Response) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;
  const ingestKey = typeof req.query.ingest_key === "string" ? req.query.ingest_key : undefined;
  const rawBody = getShopifyWebhookRawBody(req.body);
  if (!isAuthorizedShopifyWebhook({
    hmacHeader,
    rawBody,
    shopifyAppSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
    ingestKey,
    ingestSecret: ENV.ingestSecret,
  })) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let checkout: Record<string, unknown>;
  try {
    ({ order: checkout } = parseShopifyWebhookPayload(req.body));
  } catch {
    return res.status(400).json({ error: "Invalid Shopify checkout payload" });
  }
  const noteAttributes = Array.isArray(checkout.note_attributes) ? checkout.note_attributes : [];
  const attrs = new Map(
    noteAttributes
      .filter((attr: any) => typeof attr?.name === "string" && typeof attr?.value === "string")
      .map((attr: any) => [String(attr.name), String(attr.value)])
  );
  const visitorId = attrs.get("orobiome_visit_id");
  const variant = attrs.get("orobiome_variant");
  const checkoutToken = String(checkout.token ?? checkout.id ?? "");
  if (!visitorId || !/^[a-z0-9_-]{16,64}$/i.test(visitorId)) return res.status(204).end();
  if (variant !== "control" && variant !== "offer_clarity") return res.status(204).end();
  if (!checkoutToken || checkoutToken.length > 128) return res.status(204).end();

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Tracking store unavailable" });
  const [existing] = await db
    .select({ id: orobiomeFunnelEvents.id })
    .from(orobiomeFunnelEvents)
    .where(and(
      eq(orobiomeFunnelEvents.shopifyCheckoutToken, checkoutToken),
      eq(orobiomeFunnelEvents.eventType, "checkout_start")
    ))
    .limit(1);
  if (!existing) {
    await db.insert(orobiomeFunnelEvents).values({
      visitorId,
      variant,
      eventType: "checkout_start",
      pagePath: "/pages/oral",
      ctaPosition: attrs.get("orobiome_cta") ?? null,
      shopifyCheckoutToken: checkoutToken,
      eventAt: Date.now(),
    });
  }
  return res.status(204).end();
}
