import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  landingPageCommandAudit,
  landingPageCommandPages,
} from "../drizzle/schema";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { getLandingPageReleaseBlockers, isQaComplete } from "./landingPageCommand";

const pageTypeSchema = z.enum([
  "lead_magnet",
  "webinar",
  "offer_page",
  "thank_you_offer",
  "product_bridge",
  "quiz",
  "evergreen_resource",
]);
const ledgerSchema = z.enum(["none", "kajabi", "shopify"]);
const seoPolicySchema = z.enum([
  "paid_test_noindex",
  "campaign_control_indexable",
  "resource_indexable",
  "redirect_migration",
]);

const briefSchema = z.object({
  campaignId: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens."),
  title: z.string().min(3).max(255),
  ownerName: z.string().max(255).optional().nullable(),
  pageType: pageTypeSchema,
  audienceSource: z.string().max(120).optional().nullable(),
  audienceDescription: z.string().max(12_000).optional().nullable(),
  messageBrief: z.string().max(20_000).optional().nullable(),
  claimReferences: z.string().max(20_000).optional().nullable(),
  assetReferences: z.string().max(20_000).optional().nullable(),
  disclosureText: z.string().max(12_000).optional().nullable(),
  checkoutLedger: ledgerSchema,
  offerName: z.string().max(255).optional().nullable(),
  exactOfferId: z.string().max(128).optional().nullable(),
  displayPriceCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
  upsellPolicy: z.string().max(12_000).optional().nullable(),
  ctaLabel: z.string().max(255).optional().nullable(),
  ctaDestinationKey: z.string().max(160).optional().nullable(),
  pageKey: z.string().max(160).optional().nullable(),
  utmSource: z.string().max(160).optional().nullable(),
  utmMedium: z.string().max(160).optional().nullable(),
  utmCampaign: z.string().max(160).optional().nullable(),
  utmContent: z.string().max(160).optional().nullable(),
  seoPolicy: seoPolicySchema,
  canonicalUrl: z.string().url().max(512).optional().nullable(),
  seoTitle: z.string().max(255).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
  framerProjectName: z.string().max(255).optional().nullable(),
  framerBranchName: z.string().max(255).optional().nullable(),
  framerTemplateKey: z.string().max(160).optional().nullable(),
  framerPreviewUrl: z.string().url().max(512).optional().nullable(),
  plannedPublicPath: z.string().max(512).optional().nullable(),
});

const qaSchema = z.object({
  qaClaimsApproved: z.boolean(),
  qaAssetsApproved: z.boolean(),
  qaSeoApproved: z.boolean(),
  qaCtaApproved: z.boolean(),
  qaTrackingApproved: z.boolean(),
  qaNotes: z.string().max(8_000).optional().nullable(),
});

function actor(ctx: { user: { openId: string; name?: string | null } }) {
  return { actorOpenId: ctx.user.openId, actorName: ctx.user.name ?? null };
}

async function appendAudit(
  pageId: number,
  action: string,
  note: string | null,
  ctx: { user: { openId: string; name?: string | null } },
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  await db.insert(landingPageCommandAudit).values({ pageId, action, note, ...actor(ctx) });
}

async function requirePage(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  const [page] = await db.select().from(landingPageCommandPages).where(eq(landingPageCommandPages.id, id)).limit(1);
  if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign page record not found." });
  return page;
}

export const landingPageCommandRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(landingPageCommandPages).orderBy(desc(landingPageCommandPages.updatedAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const page = await requirePage(input.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
    const audit = await db
      .select()
      .from(landingPageCommandAudit)
      .where(eq(landingPageCommandAudit.pageId, input.id))
      .orderBy(desc(landingPageCommandAudit.createdAt));
    return { page, audit, blockers: getLandingPageReleaseBlockers(page) };
  }),

  create: protectedProcedure.input(briefSchema).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
    const duplicate = await db
      .select({ id: landingPageCommandPages.id })
      .from(landingPageCommandPages)
      .where(eq(landingPageCommandPages.campaignId, input.campaignId))
      .limit(1);
    if (duplicate.length) throw new TRPCError({ code: "CONFLICT", message: "Campaign ID already exists. Use a new campaign ID or open the existing record." });
    const [result] = await db.insert(landingPageCommandPages).values({
      ...input,
      status: "brief_draft",
      createdByOpenId: ctx.user.openId,
      createdByName: ctx.user.name ?? null,
    });
    const id = Number((result as { insertId: number }).insertId);
    await appendAudit(id, "created", "Internal campaign-page brief created. No Framer or public page action was taken.", ctx);
    return { id };
  }),

  updateBrief: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(briefSchema.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...changes } = input;
      await requirePage(id);
      if (!Object.keys(changes).length) return { success: true };
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
      await db.update(landingPageCommandPages).set(changes).where(eq(landingPageCommandPages.id, id));
      await appendAudit(id, "brief_updated", "Campaign-page brief fields were updated.", ctx);
      return { success: true };
    }),

  saveQa: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(qaSchema))
    .mutation(async ({ input, ctx }) => {
      const { id, ...qa } = input;
      const page = await requirePage(id);
      if (page.status === "release_requested" || page.status === "live") {
        throw new TRPCError({ code: "CONFLICT", message: "QA cannot be changed while a release is requested or the page is live." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
      const status = isQaComplete(qa) ? "qa_passed" : "needs_revision";
      await db.update(landingPageCommandPages).set({ ...qa, status }).where(eq(landingPageCommandPages.id, id));
      await appendAudit(id, "qa_saved", isQaComplete(qa) ? "All Phase 1 QA checks are marked complete; this remains internal-only." : "QA was saved with unresolved checks.", ctx);
      return { success: true, status };
    }),

  requestRelease: adminProcedure
    .input(z.object({ id: z.number().int().positive(), note: z.string().max(4_000).optional().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const page = await requirePage(input.id);
      const blockers = getLandingPageReleaseBlockers(page);
      if (blockers.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: blockers.join(" ") });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
      await db.update(landingPageCommandPages).set({
        status: "release_requested",
        releaseRequestedAt: new Date(),
        releaseRequestedBy: ctx.user.name ?? ctx.user.openId,
      }).where(eq(landingPageCommandPages.id, input.id));
      await appendAudit(input.id, "release_requested", input.note ?? "Release requested. This is not a Framer publish action.", ctx);
      return { success: true };
    }),

  cancelReleaseRequest: adminProcedure
    .input(z.object({ id: z.number().int().positive(), note: z.string().max(4_000).optional().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const page = await requirePage(input.id);
      if (page.status !== "release_requested") throw new TRPCError({ code: "CONFLICT", message: "Only an active release request can be cancelled." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
      await db.update(landingPageCommandPages).set({
        status: "qa_passed",
        releaseRequestedAt: null,
        releaseRequestedBy: null,
      }).where(eq(landingPageCommandPages.id, input.id));
      await appendAudit(input.id, "release_request_cancelled", input.note ?? "Release request cancelled. No external system was contacted.", ctx);
      return { success: true };
    }),
});
