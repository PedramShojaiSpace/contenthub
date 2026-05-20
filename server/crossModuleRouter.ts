/**
 * Cross-Module Feed Router
 *
 * Provides "feed payload" procedures that package data from one module
 * into a pre-populated form payload for another module.
 *
 * Flow:
 *   Webinar  → E-Book     (topic + persona + transcript as source doc)
 *   Webinar  → Landing Page (topic + persona + CTA)
 *   Landing Page → E-Book  (persona + content angle as topic)
 *   Landing Page → Webinar (offer + angle as CTA)
 *   E-Book   → Landing Page (topic + persona → lead magnet page)
 *   E-Book   → Webinar    (topic + audience)
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  webinarSessions,
  webinarIntelligence,
  landingPages,
  ebooks,
  avatarProfiles,
} from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve persona name from a webinar session's personaIds JSON */
function resolvePersonaName(personaIdsJson: string | null): string {
  if (!personaIdsJson) return "";
  try {
    const ids = JSON.parse(personaIdsJson);
    if (Array.isArray(ids) && ids.length > 0) {
      // Return first persona ID as a string hint; the UI will map it
      return String(ids[0]);
    }
  } catch { /* ignore */ }
  return "";
}

/** Build a compact intelligence summary from extracted webinar intelligence */
function buildIntelligenceSummary(records: Array<{
  extractedThemes: string | null;
  extractedPainPoints: string | null;
  extractedMotivations: string | null;
  extractedLanguage: string | null;
}>): string {
  const parts: string[] = [];
  for (const rec of records) {
    try {
      if (rec.extractedThemes) {
        const themes = JSON.parse(rec.extractedThemes) as string[];
        if (themes.length) parts.push(`Key themes: ${themes.slice(0, 5).join(", ")}`);
      }
      if (rec.extractedPainPoints) {
        const pts = JSON.parse(rec.extractedPainPoints) as string[];
        if (pts.length) parts.push(`Pain points: ${pts.slice(0, 5).join("; ")}`);
      }
      if (rec.extractedMotivations) {
        const mots = JSON.parse(rec.extractedMotivations) as string[];
        if (mots.length) parts.push(`Motivations: ${mots.slice(0, 4).join("; ")}`);
      }
      if (rec.extractedLanguage) {
        const quotes = JSON.parse(rec.extractedLanguage) as string[];
        if (quotes.length) parts.push(`Exact language: "${quotes.slice(0, 3).join('" / "')}"`);
      }
    } catch { /* ignore parse errors */ }
  }
  return parts.join("\n\n");
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const crossModuleRouter = router({

  // ── Webinar → E-Book ────────────────────────────────────────────────────────
  webinarToEbook: protectedProcedure
    .input(z.object({ webinarSessionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [session] = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.id, input.webinarSessionId));
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Webinar session not found" });

      // Pull any extracted intelligence records for this session
      const intelligence = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.webinarSessionId, input.webinarSessionId))
        .orderBy(desc(webinarIntelligence.importedAt));

      const intelligenceSummary = buildIntelligenceSummary(intelligence);

      // Build source narrative from outline + intelligence
      const sourceNarrative = [
        session.outline ? `## Webinar Outline\n${session.outline}` : null,
        intelligenceSummary ? `## Audience Intelligence\n${intelligenceSummary}` : null,
        session.hookScript ? `## Opening Hook\n${session.hookScript}` : null,
      ].filter(Boolean).join("\n\n");

      return {
        // Pre-fill fields for EBookGenerator
        title: `${session.topic} — The Complete Guide`,
        topic: session.topic,
        targetAudience: "health-conscious professionals seeking transformation",
        sourceNarrative: sourceNarrative || undefined,
        webinarSessionId: session.id,
        // Metadata for display
        webinarTopic: session.topic,
        webinarDate: session.webinarDate,
        hasIntelligence: intelligence.length > 0,
        intelligenceRecordCount: intelligence.length,
      };
    }),

  // ── Webinar → Landing Page ───────────────────────────────────────────────────
  webinarToLandingPage: protectedProcedure
    .input(z.object({ webinarSessionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [session] = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.id, input.webinarSessionId));
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Webinar session not found" });

      // Build content angle from webinar topic + CTA
      const contentAngle = [
        `Based on the webinar: "${session.topic}"`,
        session.cta ? `Primary CTA: ${session.cta}` : null,
        session.outline ? `Key points covered:\n${session.outline.slice(0, 500)}` : null,
      ].filter(Boolean).join("\n\n");

      return {
        // Pre-fill fields for LandingPageGenerator
        title: `${session.topic} — Landing Page`,
        contentAngle,
        offer: "lights_on_webinar" as const,
        webinarSessionId: session.id,
        // Metadata
        webinarTopic: session.topic,
        webinarDate: session.webinarDate,
        webinarRegistrationUrl: session.registrationUrl,
      };
    }),

  // ── Landing Page → E-Book ────────────────────────────────────────────────────
  landingPageToEbook: protectedProcedure
    .input(z.object({ landingPageId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [page] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, input.landingPageId));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });

      // Build topic from content angle or title
      const topic = page.contentAngle || page.title;

      // Build source narrative from the landing page copy
      const sourceNarrative = page.copyBody
        ? `## Landing Page Copy (source material)\n${page.copyBody.slice(0, 3000)}`
        : undefined;

      return {
        // Pre-fill fields for EBookGenerator
        title: `${page.title} — E-Book`,
        topic,
        targetAudience: page.personaName || "health-conscious professionals",
        sourceNarrative,
        landingPageId: page.id,
        // Metadata
        pageTitle: page.title,
        offer: page.offer,
        personaName: page.personaName,
      };
    }),

  // ── Landing Page → Webinar ───────────────────────────────────────────────────
  landingPageToWebinar: protectedProcedure
    .input(z.object({ landingPageId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [page] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, input.landingPageId));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });

      return {
        // Pre-fill fields for WebinarBuilder
        topic: page.contentAngle || page.title,
        cta: page.gammaUrl
          ? `Visit the landing page: ${page.gammaUrl}`
          : `Learn more at theurbanmonk.com`,
        landingPageId: page.id,
        // Metadata
        pageTitle: page.title,
        offer: page.offer,
        personaName: page.personaName,
      };
    }),

  // ── E-Book → Landing Page ────────────────────────────────────────────────────
  ebookToLandingPage: protectedProcedure
    .input(z.object({ ebookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [ebook] = await db
        .select()
        .from(ebooks)
        .where(eq(ebooks.id, input.ebookId));
      if (!ebook) throw new TRPCError({ code: "NOT_FOUND", message: "E-book not found" });
      if (ebook.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Build content angle: position the ebook as a lead magnet
      const contentAngle = [
        `Lead magnet: Free e-book "${ebook.title}"`,
        `Topic: ${ebook.topic}`,
        ebook.targetPersona ? `Target audience: ${ebook.targetPersona}` : null,
        ebook.pdfS3Url ? `Download URL: ${ebook.pdfS3Url}` : null,
      ].filter(Boolean).join("\n");

      return {
        // Pre-fill fields for LandingPageGenerator
        title: `Download: ${ebook.title}`,
        contentAngle,
        offer: "custom" as const,
        offerCustomLabel: `Free E-Book: ${ebook.title}`,
        ebookId: ebook.id,
        // Metadata
        ebookTitle: ebook.title,
        ebookTopic: ebook.topic,
        personaName: ebook.targetPersona,
        hasPdf: !!ebook.pdfS3Url,
        pdfUrl: ebook.pdfS3Url,
      };
    }),

  // ── E-Book → Webinar ─────────────────────────────────────────────────────────
  ebookToWebinar: protectedProcedure
    .input(z.object({ ebookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [ebook] = await db
        .select()
        .from(ebooks)
        .where(eq(ebooks.id, input.ebookId));
      if (!ebook) throw new TRPCError({ code: "NOT_FOUND", message: "E-book not found" });
      if (ebook.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Build a webinar topic from the ebook
      const webinarTopic = `${ebook.topic} — Live Deep Dive with Dr. Pedram Shojai`;

      return {
        // Pre-fill fields for WebinarBuilder
        topic: webinarTopic,
        cta: ebook.pdfS3Url
          ? `Download the free e-book: ${ebook.title}`
          : `Learn more: ${ebook.title}`,
        ebookId: ebook.id,
        // Metadata
        ebookTitle: ebook.title,
        ebookTopic: ebook.topic,
        targetAudience: ebook.targetPersona,
      };
    }),

  // ── Pipeline View — all three modules with cross-link counts ──────────────────
  getPipelineView: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { webinars: [], landingPages: [], ebooks: [] };

    const [webinarRows, landingPageRows, ebookRows] = await Promise.all([
      db
        .select({
          id: webinarSessions.id,
          topic: webinarSessions.topic,
          webinarDate: webinarSessions.webinarDate,
          status: webinarSessions.status,
          createdAt: webinarSessions.createdAt,
        })
        .from(webinarSessions)
        .orderBy(desc(webinarSessions.createdAt))
        .limit(20),

      db
        .select({
          id: landingPages.id,
          title: landingPages.title,
          offer: landingPages.offer,
          personaName: landingPages.personaName,
          status: landingPages.status,
          gammaUrl: landingPages.gammaUrl,
          createdAt: landingPages.createdAt,
        })
        .from(landingPages)
        .orderBy(desc(landingPages.createdAt))
        .limit(20),

      db
        .select({
          id: ebooks.id,
          title: ebooks.title,
          topic: ebooks.topic,
          status: ebooks.status,
          targetPersona: ebooks.targetPersona,
          pdfS3Url: ebooks.pdfS3Url,
          createdAt: ebooks.createdAt,
        })
        .from(ebooks)
        .where(eq(ebooks.userId, ctx.user.id))
        .orderBy(desc(ebooks.createdAt))
        .limit(20),
    ]);

    return {
      webinars: webinarRows,
      landingPages: landingPageRows,
      ebooks: ebookRows,
    };
  }),

  // ── List all sessions / pages / ebooks for picker dropdowns ─────────────────
  listWebinarSessions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: webinarSessions.id,
        topic: webinarSessions.topic,
        webinarDate: webinarSessions.webinarDate,
        status: webinarSessions.status,
      })
      .from(webinarSessions)
      .orderBy(desc(webinarSessions.createdAt))
      .limit(50);
  }),

  listLandingPages: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: landingPages.id,
        title: landingPages.title,
        offer: landingPages.offer,
        personaName: landingPages.personaName,
        status: landingPages.status,
        gammaUrl: landingPages.gammaUrl,
      })
      .from(landingPages)
      .orderBy(desc(landingPages.createdAt))
      .limit(50);
  }),

  listEbooks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: ebooks.id,
        title: ebooks.title,
        topic: ebooks.topic,
        status: ebooks.status,
        targetPersona: ebooks.targetPersona,
        pdfS3Url: ebooks.pdfS3Url,
      })
      .from(ebooks)
      .where(eq(ebooks.userId, ctx.user.id))
      .orderBy(desc(ebooks.createdAt))
      .limit(50);
  }),
});
