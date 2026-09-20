/**
 * Attribution Router — First-Party Ad Attribution System
 *
 * Architecture:
 * 1. Bridge page JS captures UTM params + fbclid → POST /api/attribution/click → stores in ad_clicks
 * 2. Shopify sends orders/paid webhook → POST /api/shopify/order-paid → matches click token → stores in attributed_sales
 * 3. Shopify's Facebook & Instagram integration is the sole Meta Purchase authority
 * 4. tRPC procedures expose attribution data to the dashboard
 */

import { z } from "zod";
import crypto from "crypto";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { adClicks, attributedSales, interconnectedEmailCheckoutTouches, leadPurchaseAttributions } from "../drizzle/schema";
import { eq, desc, gte, sql, and, isNotNull } from "drizzle-orm";
import { ENV } from "./_core/env";
import { isAuthorizedShopifyWebhook } from "./shopifyWebhookAuth";
import { getShopifyWebhookRawBody, parseShopifyWebhookPayload } from "./shopifyWebhookPayload";
import { buildTrackedCheckoutDestination } from "./emailCheckoutTracking";
import { isIsolatedEmailAttribution } from "./interconnectedEmailAttributionHygiene";
import { recordOrobiomePaidPurchase } from "./orobiomeFunnelTracking";
import { buildShopifyCartAttributionHandoff } from "./shopifyCartAttributionHandoff";
import {
  calculateShopifyOrderRevenueIncrease,
  extractShopifyClickToken,
  snapshotShopifyOrderRevenue,
} from "./shopifyOrderAttribution";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateClickToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + "urban-monk-salt").digest("hex").slice(0, 32);
}

/**
 * Shopify's Facebook & Instagram customer-event integration is the single Meta
 * Purchase authority for all Shopify orders. It emits the native Web + Server
 * pair and owns their event-ID contract. The Content Hub retains Shopify order
 * attribution for financial reporting but must never send a second Purchase
 * CAPI event, because a generated server-only ID cannot deduplicate with
 * Shopify's browser event.
 */
export const SHOPIFY_META_PURCHASE_AUTHORITY = "shopify_facebook_instagram";

export function shouldSendContentHubShopifyPurchaseCapi(): false {
  return false;
}

// ── tRPC Attribution Router ───────────────────────────────────────────────────

export const attributionRouter = router({
  /** Get attribution summary stats for the dashboard */
  getSummary: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const since = Date.now() - input.days * 24 * 60 * 60 * 1000;

      const [totals] = await db
        .select({
          totalSales: sql<number>`COUNT(*)`,
          totalRevenue: sql<number>`SUM(order_total)`,
          directCount: sql<number>`SUM(CASE WHEN attribution_type = 'direct' THEN 1 ELSE 0 END)`,
          probCount: sql<number>`SUM(CASE WHEN attribution_type = 'probabilistic' THEN 1 ELSE 0 END)`,
          unattributed: sql<number>`SUM(CASE WHEN attribution_type = 'unattributed' THEN 1 ELSE 0 END)`,
        })
        .from(attributedSales)
        .where(gte(attributedSales.receivedAt, since));

      const byCampaign = await db
        .select({
          campaign: attributedSales.utmCampaign,
          sales: sql<number>`COUNT(*)`,
          revenue: sql<number>`SUM(order_total)`,
        })
        .from(attributedSales)
        .where(and(gte(attributedSales.receivedAt, since), isNotNull(attributedSales.utmCampaign)))
        .groupBy(attributedSales.utmCampaign)
        .orderBy(desc(sql`SUM(order_total)`))
        .limit(10);

      const byAdvertorial = await db
        .select({
          slug: attributedSales.advertorialSlug,
          sales: sql<number>`COUNT(*)`,
          revenue: sql<number>`SUM(order_total)`,
        })
        .from(attributedSales)
        .where(and(gte(attributedSales.receivedAt, since), isNotNull(attributedSales.advertorialSlug)))
        .groupBy(attributedSales.advertorialSlug)
        .orderBy(desc(sql`SUM(order_total)`))
        .limit(10);

      const bySource = await db
        .select({
          source: attributedSales.utmSource,
          medium: attributedSales.utmMedium,
          sales: sql<number>`COUNT(*)`,
          revenue: sql<number>`SUM(order_total)`,
        })
        .from(attributedSales)
        .where(gte(attributedSales.receivedAt, since))
        .groupBy(attributedSales.utmSource, attributedSales.utmMedium)
        .orderBy(desc(sql`SUM(order_total)`))
        .limit(10);

      const recentSales = await db
        .select()
        .from(attributedSales)
        .orderBy(desc(attributedSales.receivedAt))
        .limit(25);

      const dailyTrend = await db
        .select({
          day: sql<string>`DATE(FROM_UNIXTIME(received_at / 1000))`,
          sales: sql<number>`COUNT(*)`,
          revenue: sql<number>`SUM(order_total)`,
        })
        .from(attributedSales)
        .where(gte(attributedSales.receivedAt, since))
        .groupBy(sql`DATE(FROM_UNIXTIME(received_at / 1000))`)
        .orderBy(sql`DATE(FROM_UNIXTIME(received_at / 1000))`);

      return {
        summary: {
          totalSales: Number(totals?.totalSales ?? 0),
          totalRevenue: Number(totals?.totalRevenue ?? 0),
          directCount: Number(totals?.directCount ?? 0),
          probCount: Number(totals?.probCount ?? 0),
          unattributed: Number(totals?.unattributed ?? 0),
        },
        byCampaign: byCampaign.map(r => ({
          campaign: r.campaign || "(none)",
          sales: Number(r.sales),
          revenue: Number(r.revenue),
        })),
        byAdvertorial: byAdvertorial.map(r => ({
          slug: r.slug || "(direct)",
          sales: Number(r.sales),
          revenue: Number(r.revenue),
        })),
        bySource: bySource.map(r => ({
          source: r.source || "(none)",
          medium: r.medium || "(none)",
          sales: Number(r.sales),
          revenue: Number(r.revenue),
        })),
        recentSales: recentSales.map(s => ({
          ...s,
          lineItems: s.lineItems ? JSON.parse(s.lineItems) : [],
        })),
        dailyTrend: dailyTrend.map(r => ({
          day: r.day,
          sales: Number(r.sales),
          revenue: Number(r.revenue),
        })),
      };
    }),

  listSales: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(365).default(30),
      attributionType: z.enum(["direct", "probabilistic", "unattributed", "all"]).default("all"),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const since = Date.now() - input.days * 24 * 60 * 60 * 1000;
      const conditions: any[] = [gte(attributedSales.receivedAt, since)];
      if (input.attributionType !== "all") {
        conditions.push(eq(attributedSales.attributionType, input.attributionType));
      }

      const rows = await db
        .select()
        .from(attributedSales)
        .where(and(...conditions))
        .orderBy(desc(attributedSales.receivedAt))
        .limit(input.limit);

      return rows.map(s => ({
        ...s,
        lineItems: s.lineItems ? JSON.parse(s.lineItems) : [],
      }));
    }),

  /**
   * EV-aware ROAS (Rec 7, Grok 3 Audit v2)
   *
   * The audit identified that the existing ROAS calculation uses only the
   * immediate order total. This procedure adds an Expected Value (EV) layer:
   *
   *   EV per buyer = orderTotal + (academyUpgradeRate × academyLTV)
   *
   * Where:
   *   - academyUpgradeRate: % of buyers who go on to purchase the Academy ($297/yr)
   *   - academyLTV: lifetime value of an Academy member (default: $2,399 per audit)
   *
   * This gives a more accurate ROAS that accounts for the downstream Academy
   * conversion that paid ads are actually funding.
   *
   * The academyUpgradeRate and academyLTV are configurable so they can be
   * updated as real data accumulates.
   */
  getEvRoas: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      /** % of supplement/test buyers who upgrade to Academy. Default 0.12 (12%) */
      academyUpgradeRate: z.number().min(0).max(1).default(0.12),
      /** Academy member LTV in cents. Default $2,399 = 239900 cents */
      academyLtv: z.number().min(0).default(239900),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const since = Date.now() - input.days * 24 * 60 * 60 * 1000;

      // Pull per-campaign ad spend from adSnapshots (if available)
      // and revenue from attributedSales
      const salesByCampaign = await db
        .select({
          campaign: attributedSales.utmCampaign,
          sales: sql<number>`COUNT(*)`,
          revenueRaw: sql<number>`SUM(order_total)`,
        })
        .from(attributedSales)
        .where(and(gte(attributedSales.receivedAt, since), isNotNull(attributedSales.utmCampaign)))
        .groupBy(attributedSales.utmCampaign)
        .orderBy(desc(sql`SUM(order_total)`));

      // EV calculation per campaign
      const evByCampaign = salesByCampaign.map((row) => {
        const revenueRaw = Number(row.revenueRaw ?? 0); // in cents
        const sales = Number(row.sales ?? 0);
        // EV uplift: each buyer has a academyUpgradeRate chance of becoming an Academy member
        const evUplift = sales * input.academyUpgradeRate * input.academyLtv;
        const evRevenue = revenueRaw + evUplift;
        return {
          campaign: row.campaign || "(none)",
          sales,
          revenueRaw: Math.round(revenueRaw),
          evRevenue: Math.round(evRevenue),
          evUpliftCents: Math.round(evUplift),
        };
      });

      // Totals
      const totalRevenueRaw = evByCampaign.reduce((s, r) => s + r.revenueRaw, 0);
      const totalEvRevenue = evByCampaign.reduce((s, r) => s + r.evRevenue, 0);
      const totalSales = evByCampaign.reduce((s, r) => s + r.sales, 0);

      return {
        days: input.days,
        academyUpgradeRate: input.academyUpgradeRate,
        academyLtv: input.academyLtv,
        totalSales,
        totalRevenueRaw,
        totalEvRevenue,
        evUpliftTotal: totalEvRevenue - totalRevenueRaw,
        byCampaign: evByCampaign,
        note: "EV = immediate revenue + (sales × upgradeRate × academyLTV). Upgrade rate is an assumption until Academy data is available.",
      };
    }),

  retryCapi: protectedProcedure
    .input(z.object({ saleId: z.number() }))
    .mutation(async () => {
      return {
        success: false,
        disabled: true,
        reason: "Shopify Facebook & Instagram is the sole Meta Purchase authority for Shopify orders.",
      };
    }),
});

// ── Express Route Handlers ────────────────────────────────────────────────────

export async function handleAttributionClick(req: any, res: any) {
  try {
    const body = req.body as {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmContent?: string;
      utmTerm?: string;
      fbclid?: string;
      advertorialSlug?: string;
      advertorialId?: number;
    };

    if (!body.utmSource && !body.fbclid && !body.utmCampaign) {
      return res.json({ clickToken: null, recorded: false });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });

    const clickToken = generateClickToken();
    const ip = ((req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || "").split(",")[0].trim();
    const ipHash = ip ? hashIp(ip) : null;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    await db.insert(adClicks).values({
      clickToken,
      utmSource: body.utmSource || null,
      utmMedium: body.utmMedium || null,
      utmCampaign: body.utmCampaign || null,
      utmContent: body.utmContent || null,
      utmTerm: body.utmTerm || null,
      fbclid: body.fbclid || null,
      advertorialSlug: body.advertorialSlug || null,
      advertorialId: body.advertorialId || null,
      userAgent: (req.headers["user-agent"] as string) || null,
      ipHash,
      clickedAt: now,
      expiresAt: now + thirtyDays,
    });

    return res.json({ clickToken, recorded: true });
  } catch (err) {
    console.error("[attribution/click] Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/**
 * Email-link bridge. It records a first-party click, then redirects to an
 * allowed checkout destination with the cohort UTMs preserved. Shopify links
 * also receive an order attribute for direct order-paid matching.
 */
export async function handleTrackedEmailCheckout(req: any, res: any) {
  try {
    const destination = typeof req.query.destination === "string" ? req.query.destination : "";
    const utmSource = typeof req.query.utm_source === "string" ? req.query.utm_source : "";
    const utmMedium = typeof req.query.utm_medium === "string" ? req.query.utm_medium : "";
    const utmCampaign = typeof req.query.utm_campaign === "string" ? req.query.utm_campaign : "";
    const utmContent = typeof req.query.utm_content === "string" ? req.query.utm_content : undefined;
    const fbclid = typeof req.query.fbclid === "string" ? req.query.fbclid : undefined;
    const funnelPath = typeof req.query.funnel_path === "string" ? req.query.funnel_path : undefined;
    const messageKey = typeof req.query.email_key === "string" ? req.query.email_key : undefined;
    if (!destination || !utmSource || !utmMedium || !utmCampaign) {
      return res.status(400).send("Missing checkout destination or required UTM parameters.");
    }
    if (!isIsolatedEmailAttribution({ funnelPath, messageKey, utmSource })) {
      return res.status(400).send("Invalid isolated email-attribution path.");
    }

    const db = await getDb();
    if (!db) return res.status(503).send("Attribution service unavailable.");
    const clickToken = generateClickToken();
    const ip = ((req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || "").split(",")[0].trim();
    const now = Date.now();
    await db.insert(adClicks).values({
      clickToken,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent: utmContent || null,
      fbclid: fbclid || null,
      userAgent: (req.headers["user-agent"] as string) || null,
      ipHash: ip ? hashIp(ip) : null,
      clickedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    });
    if (funnelPath && messageKey) {
      await db.insert(interconnectedEmailCheckoutTouches).values({
        clickToken,
        funnelPath,
        platform: funnelPath === "kajabi" ? "kajabi" : "klaviyo",
        messageKey,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent: utmContent || messageKey,
        checkoutDestination: destination,
        clickedAt: now,
      });
    }
    const trackedDestination = buildTrackedCheckoutDestination({
      destination,
      clickToken,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    });
    const destinationUrl = new URL(trackedDestination);
    if (funnelPath === "ko_klaviyo" && destinationUrl.hostname === "shop.theurbanmonk.com") {
      return res.status(200).type("html").send(buildShopifyCartAttributionHandoff({
        destination,
        clickToken,
        funnelPath,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
      }));
    }
    return res.redirect(302, trackedDestination);
  } catch (error) {
    console.error("[attribution/email-checkout] Error:", error);
    return res.status(400).send("Unable to create tracked checkout link.");
  }
}

export async function handleShopifyOrderPaid(req: any, res: any) {
  try {
    // Verify Shopify HMAC signature
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
      console.warn("[shopify/order-paid] Unauthorized webhook — rejecting");
      return res.status(401).json({ error: "Unauthorized" });
    }

    let order: Record<string, unknown>;
    try {
      ({ order } = parseShopifyWebhookPayload(req.body));
    } catch {
      return res.status(400).json({ error: "Invalid Shopify webhook payload" });
    }
    const shopifyOrder = order as any;
    const shopifyOrderId = String(shopifyOrder.id);
    const shopifyOrderNumber = String(shopifyOrder.order_number || shopifyOrder.name || "");
    const orderTotal = Math.round(parseFloat(shopifyOrder.total_price || "0") * 100);
    const currency = (shopifyOrder.currency as string) || "USD";
    const customerEmail: string | null = shopifyOrder.email || shopifyOrder.customer?.email || null;
    const customerName: string | null = [shopifyOrder.customer?.first_name, shopifyOrder.customer?.last_name].filter(Boolean).join(" ") || null;
    const lineItems = JSON.stringify(
      (shopifyOrder.line_items || []).map((li: any) => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
        sku: li.sku,
      }))
    );
    const orderCreatedAt = shopifyOrder.created_at ? new Date(shopifyOrder.created_at).getTime() : Date.now();

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });

    // Dedup check
    const existing = await db.select({ id: attributedSales.id }).from(attributedSales)
      .where(eq(attributedSales.shopifyOrderId, shopifyOrderId)).limit(1);
    if (existing.length > 0) {
      return res.json({ status: "duplicate", orderId: shopifyOrderId });
    }

    const noteAttrs: any[] = shopifyOrder.note_attributes || [];
    const clickToken = extractShopifyClickToken(shopifyOrder);

    let matchedClick: typeof adClicks.$inferSelect | null = null;
    let attributionType: "direct" | "probabilistic" | "unattributed" = "unattributed";

    // 1. Direct match via click token
    if (clickToken) {
      const [click] = await db.select().from(adClicks)
        .where(and(eq(adClicks.clickToken, clickToken), gte(adClicks.expiresAt, Date.now())))
        .limit(1);
      if (click) {
        matchedClick = click;
        attributionType = "direct";
      }
    }

    // 2. Probabilistic match via IP hash (last 24h)
    if (!matchedClick) {
      const ip = ((req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || "").split(",")[0].trim();
      if (ip) {
        const ipHash = hashIp(ip);
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const [click] = await db.select().from(adClicks)
          .where(and(
            eq(adClicks.ipHash, ipHash),
            gte(adClicks.clickedAt, oneDayAgo),
            gte(adClicks.expiresAt, Date.now())
          ))
          .orderBy(desc(adClicks.clickedAt))
          .limit(1);
        if (click) {
          matchedClick = click;
          attributionType = "probabilistic";
        }
      }
    }

    await db.insert(attributedSales).values({
      shopifyOrderId,
      shopifyOrderNumber,
      orderTotal,
      currency,
      customerEmail,
      customerName,
      lineItems,
      clickToken: matchedClick?.clickToken || null,
      utmSource: matchedClick?.utmSource || null,
      utmMedium: matchedClick?.utmMedium || null,
      utmCampaign: matchedClick?.utmCampaign || null,
      utmContent: matchedClick?.utmContent || null,
      fbclid: matchedClick?.fbclid || null,
      advertorialSlug: matchedClick?.advertorialSlug || null,
      attributionType,
      capiEventSent: false,
      capiEventId: null,
      capiSentAt: null,
      orderCreatedAt,
      receivedAt: Date.now(),
    });

    // ── Meta Purchase is emitted only by Shopify's Facebook & Instagram integration ──
    // Do not add a Content Hub CAPI Purchase here. Shopify's native Web + Server
    // implementation owns Purchase deduplication and is the single source for
    // all Shopify orders. This endpoint remains the order/revenue authority.
    const capiSent = shouldSendContentHubShopifyPurchaseCapi();

    // Record the approved Orobiome funnel purchase only when the cart permalink
    // supplied its anonymous visit/variant attributes. This does not alter the
    // existing order record, attribution logic, or Meta CAPI behavior.
    try {
      await recordOrobiomePaidPurchase({
        orderId: shopifyOrderId,
        orderTotalCents: orderTotal,
        currency,
        noteAttributes: noteAttrs,
      });
    } catch (error) {
      console.warn("[orobiome/purchase] Funnel correlation failed:", error);
    }

    // Credit an Interconnected lead cohort independently of the checkout touch.
    // A direct Kajabi/Klaviyo email click is exact; an untagged checkout remains
    // an honest “unknown” close while still retaining its original acquisition lead.
    if (matchedClick?.utmCampaign === "interconnected_14day") {
      try {
        const { recordLeadCohortPurchaseCredit } = await import("./leadCohortAttribution");
        const emailChannel = ["kajabi", "klaviyo"].includes((matchedClick.utmSource || "").toLowerCase())
          && ["email", "sms"].includes((matchedClick.utmMedium || "").toLowerCase());
        await recordLeadCohortPurchaseCredit({
          funnelId: "interconnected_agora",
          purchasePlatform: "shopify",
          externalPurchaseId: shopifyOrderId,
          purchaseEmail: customerEmail,
          purchaseAmountCents: orderTotal,
          purchasedAt: orderCreatedAt,
          closingTouch: emailChannel
            ? {
                source: matchedClick.utmSource,
                medium: matchedClick.utmMedium,
                campaign: matchedClick.utmCampaign,
                content: matchedClick.utmContent,
                method: "direct_email_click",
                confidence: "direct",
              }
            : {
                source: matchedClick.utmSource,
                medium: matchedClick.utmMedium,
                campaign: matchedClick.utmCampaign,
                content: matchedClick.utmContent,
                method: "checkout",
                confidence: "direct",
              },
        });
      } catch (creditErr: any) {
        console.warn("[shopify/order-paid] Lead-cohort credit failed:", creditErr?.message);
      }
    }

    // ── Klaviyo post-purchase tagging + "Placed Order" event ─────────────────────
    try {
      const { tagKlaviyoPurchaser, detectFunnelProduct } = await import("../shopify");
      const orderLineItems: any[] = shopifyOrder.line_items || [];
      const purchaseTags: string[] = ["shopify_buyer"];
      for (const li of orderLineItems) {
        const detected = detectFunnelProduct(li);
        if (detected) purchaseTags.push(detected.product.klaviyoTag);
      }
      let customerPhone: string | undefined;
      if (customerEmail) {
        const { interconnectedLeads } = await import("../../drizzle/schema");
        const [lead] = await db.select({ phone: interconnectedLeads.phone })
          .from(interconnectedLeads)
          .where(eq(interconnectedLeads.email, customerEmail.toLowerCase().trim()))
          .limit(1);
        if (lead?.phone) customerPhone = lead.phone;
      }
      if (customerEmail) {
        await tagKlaviyoPurchaser({
          email: customerEmail,
          firstName: shopifyOrder.customer?.first_name ?? undefined,
          phone: customerPhone,
          tags: purchaseTags,
          orderTotal,
          shopifyOrderId,
          lineItems: orderLineItems.map((li: any) => ({
            title: li.title ?? "",
            sku: li.sku ?? undefined,
            price: li.price ?? "0",
          })),
        });
      }
    } catch (klaviyoErr: any) {
      console.warn("[shopify/order-paid] Klaviyo tagging failed:", klaviyoErr?.message);
    }

    console.log(
      `[shopify/order-paid] Order ${shopifyOrderNumber} — attribution: ${attributionType} — Meta Purchase authority: ${SHOPIFY_META_PURCHASE_AUTHORITY}`,
    );
    return res.json({
      status: "ok",
      orderId: shopifyOrderId,
      attributionType,
      capiSent,
      metaPurchaseAuthority: SHOPIFY_META_PURCHASE_AUTHORITY,
    });
  } catch (err) {
    console.error("[shopify/order-paid] Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/**
 * Zipify and comparable post-purchase apps amend the original paid Shopify
 * order after the buyer accepts an offer. This route updates the already
 * attributed sale without firing a second Purchase CAPI event or creating a
 * second buyer. A decrease is intentionally ignored: refunds and adjustments
 * remain a separately reconciled source of truth.
 */
export async function handleShopifyOrderUpdated(req: any, res: any) {
  try {
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
      console.warn("[shopify/order-updated] Unauthorized webhook — rejecting");
      return res.status(401).json({ error: "Unauthorized" });
    }

    let order: Record<string, unknown>;
    try {
      ({ order } = parseShopifyWebhookPayload(req.body));
    } catch {
      return res.status(400).json({ error: "Invalid Shopify webhook payload" });
    }

    const shopifyOrder = order as any;
    if (String(shopifyOrder.financial_status ?? "").toLowerCase() !== "paid") {
      return res.json({ status: "ignored_non_paid_order" });
    }

    const shopifyOrderId = String(shopifyOrder.id ?? "").trim();
    if (!shopifyOrderId) return res.status(400).json({ error: "Missing Shopify order id" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });

    const [existingSale] = await db.select({
      id: attributedSales.id,
      orderTotal: attributedSales.orderTotal,
    }).from(attributedSales)
      .where(eq(attributedSales.shopifyOrderId, shopifyOrderId))
      .limit(1);

    if (!existingSale) {
      return res.json({ status: "ignored_untracked_order", orderId: shopifyOrderId });
    }

    const snapshot = snapshotShopifyOrderRevenue(shopifyOrder);
    const change = calculateShopifyOrderRevenueIncrease({
      priorTotalCents: existingSale.orderTotal,
      updatedTotalCents: snapshot.totalCents,
    });
    if (!change.hasRevenueIncrease) {
      return res.json({
        status: "ignored_no_revenue_increase",
        orderId: shopifyOrderId,
        priorTotalCents: existingSale.orderTotal,
        updatedTotalCents: snapshot.totalCents,
      });
    }

    await db.update(attributedSales).set({
      orderTotal: snapshot.totalCents,
      lineItems: snapshot.lineItems,
    }).where(eq(attributedSales.id, existingSale.id));

    // Preserve one cohort credit per Shopify order while raising it to the
    // final amended order value. This prevents a $67 buyer plus $199 acceptance
    // from being counted as two customers in cohort conversion reporting.
    await db.update(leadPurchaseAttributions).set({
      purchaseAmountCents: snapshot.totalCents,
    }).where(and(
      eq(leadPurchaseAttributions.purchasePlatform, "shopify"),
      eq(leadPurchaseAttributions.externalPurchaseId, shopifyOrderId),
    ));

    console.log(
      `[shopify/order-updated] Order ${shopifyOrderId} revenue updated by ${change.incrementalRevenueCents} cents without a duplicate purchase event`,
    );
    return res.json({
      status: "updated_post_purchase_revenue",
      orderId: shopifyOrderId,
      priorTotalCents: existingSale.orderTotal,
      updatedTotalCents: snapshot.totalCents,
      incrementalRevenueCents: change.incrementalRevenueCents,
    });
  } catch (error) {
    console.error("[shopify/order-updated] Error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
