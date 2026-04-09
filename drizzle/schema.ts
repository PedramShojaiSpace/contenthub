import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Content status workflow: idea -> drafting -> review -> approved -> scheduled -> published
export const contentStatusEnum = mysqlEnum("status", [
  "idea",
  "drafting",
  "review",
  "approved",
  "scheduled",
  "published",
]);

export const platformEnum = mysqlEnum("platform", [
  "meta",
  "linkedin",
  "x",
  "youtube",
  "tiktok",
  "blog",
  "all",
]);

export const contentGoalEnum = mysqlEnum("contentGoal", [
  "audience_growth",
  "llm_seo",
  "community_engagement",
]);

export const contentItems = mysqlTable("content_items", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  rawIdea: text("rawIdea"),
  platform: platformEnum.notNull().default("all"),
  status: contentStatusEnum.notNull().default("idea"),
  textContent: text("textContent"),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  imagePrompt: text("imagePrompt"),
  scheduledAt: bigint("scheduledAt", { mode: "number" }),
  publishedAt: bigint("publishedAt", { mode: "number" }),
  publishUrl: text("publishUrl"),
  wpPostId: int("wpPostId"),          // WordPress post ID for dedup on re-publish
  notes: text("notes"),
  // Analytics stub fields (manually updated or future API sync)
  analyticsViews: int("analyticsViews").default(0),
  analyticsLikes: int("analyticsLikes").default(0),
  analyticsComments: int("analyticsComments").default(0),
  analyticsShares: int("analyticsShares").default(0),
  // Research Intelligence: link to the Gumshoe gap query this content addresses
  gapQueryId: int("gapQueryId"),
  // Persona targeting
  personaId: int("personaId"),
  // Content strategy goal
  contentGoal: contentGoalEnum.default("audience_growth"),
  // Script Library: link to the script this content item was auto-created from
  linkedScriptId: int("linkedScriptId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = typeof contentItems.$inferInsert;

export const platformStrategies = mysqlTable("platform_strategies", {
  id: int("id").autoincrement().primaryKey(),
  platform: mysqlEnum("platform", ["meta", "linkedin", "x", "youtube"]).notNull().unique(),
  voiceGuidelines: text("voiceGuidelines"),
  promptTemplate: text("promptTemplate"),
  documentUrl: text("documentUrl"),
  documentKey: text("documentKey"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformStrategy = typeof platformStrategies.$inferSelect;
export type InsertPlatformStrategy = typeof platformStrategies.$inferInsert;

export const generatedImages = mysqlTable("generated_images", {
  id: int("id").autoincrement().primaryKey(),
  contentItemId: int("contentItemId"),
  platform: platformEnum.default("all"),
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey"),
  prompt: text("prompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = typeof generatedImages.$inferInsert;

// ─── Research Intelligence (Gumshoe AI) ──────────────────────────────────────

/**
 * One uploaded Gumshoe report run (JSON + CSV pair).
 * weekLabel is a human-readable label like "2026-W15" or "April 8 2026".
 */
export const researchReports = mysqlTable("research_reports", {
  id: int("id").autoincrement().primaryKey(),
  gumshoeReportId: int("gumshoeReportId"),
  reportName: varchar("reportName", { length: 255 }),
  reportFocus: varchar("reportFocus", { length: 255 }),
  reportDescription: text("reportDescription"),
  weekLabel: varchar("weekLabel", { length: 64 }),
  totalQueries: int("totalQueries").default(0),
  totalPersonas: int("totalPersonas").default(0),
  totalCompetitorMentions: int("totalCompetitorMentions").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResearchReport = typeof researchReports.$inferSelect;
export type InsertResearchReport = typeof researchReports.$inferInsert;

/**
 * Each unique query from the Gumshoe report, enriched with topic tags from the CSV.
 * gapScore: how many LLM models answered without mentioning Urban Monk (0-10).
 */
export const researchQueries = mysqlTable("research_queries", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  gumshoeQueryId: int("gumshoeQueryId"),
  personaName: varchar("personaName", { length: 128 }),
  query: text("query").notNull(),
  topicTags: text("topicTags"),           // JSON array of tag strings
  gapScore: int("gapScore").default(0),   // 0-10: higher = bigger opportunity
  urbanMonkMentioned: int("urbanMonkMentioned").default(0), // 0 or 1
  contentItemId: int("contentItemId"),    // linked when content is created from this gap
  status: mysqlEnum("queryStatus", ["unused", "in_progress", "published"]).default("unused"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResearchQuery = typeof researchQueries.$inferSelect;
export type InsertResearchQuery = typeof researchQueries.$inferInsert;

/**
 * Each competitor brand mention from a Gumshoe query answer.
 * Stores which model mentioned which brand, at what rank, and why.
 */
export const researchCompetitorMentions = mysqlTable("research_competitor_mentions", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  queryId: int("queryId").notNull(),
  brand: varchar("brand", { length: 255 }).notNull(),
  model: varchar("model", { length: 128 }),
  rank: int("rank"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResearchCompetitorMention = typeof researchCompetitorMentions.$inferSelect;
export type InsertResearchCompetitorMention = typeof researchCompetitorMentions.$inferInsert;

/**
 * Weekly coverage snapshot — taken automatically on each Gumshoe report upload.
 * Tracks how many gap queries Urban Monk has closed over time.
 */
export const coverageSnapshots = mysqlTable("coverage_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  weekLabel: varchar("weekLabel", { length: 64 }).notNull(),
  totalQueries: int("totalQueries").default(0).notNull(),
  mentionedCount: int("mentionedCount").default(0).notNull(),  // queries where Urban Monk IS mentioned
  gapCount: int("gapCount").default(0).notNull(),              // queries where Urban Monk is NOT mentioned
  addressedCount: int("addressedCount").default(0).notNull(),  // gap queries with published content
  snapshotAt: timestamp("snapshotAt").defaultNow().notNull(),
});

export type CoverageSnapshot = typeof coverageSnapshots.$inferSelect;
export type InsertCoverageSnapshot = typeof coverageSnapshots.$inferInsert;

// ─── Audience Personas ────────────────────────────────────────────────────────

/**
 * The 8 Urban Monk audience personas identified by Gumshoe.
 * Each persona has deep intelligence data, CTA copy, and a landing page URL.
 */
export const personas = mysqlTable("personas", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  description: text("description"),
  // Core pain points (JSON array of strings)
  painPoints: text("painPoints"),
  // Core aspirations (JSON array of strings)
  aspirations: text("aspirations"),
  // Top 8-10 intelligence questions that drive traction with this persona (JSON array)
  topQuestions: text("topQuestions"),
  // Deep intelligence report: what this persona searches for, fears, desires
  intelligenceReport: text("intelligenceReport"),
  // CTA copy tailored to this persona for Urban Monk Academy
  ctaCopy: text("ctaCopy"),
  // Primary offer landing page URL for this persona
  landingPageUrl: varchar("landingPageUrl", { length: 512 }),
  // Primary content goal for this persona
  primaryGoal: mysqlEnum("primaryGoal", ["audience_growth", "llm_seo", "community_engagement"]).default("audience_growth"),
  // Emoji icon for UI display
  icon: varchar("icon", { length: 8 }),
  // Display color for UI (hex)
  color: varchar("color", { length: 16 }),
  // Last time this persona was enriched with real survey data
  enrichedAt: timestamp("enrichedAt"),
  // Source of enrichment (e.g. "Typeform: Gut Microbiome Survey")
  surveySource: varchar("surveySource", { length: 512 }),
  // Number of survey responses that contributed to this persona
  surveyResponseCount: int("surveyResponseCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = typeof personas.$inferInsert;

// ─── Script Library ───────────────────────────────────────────────────────────

/**
 * Master library of all scripts: video scripts, carousel outlines, blog posts, emails.
 * Production status tracks the asset through the full production pipeline.
 */
export const scriptTypeEnum = mysqlEnum("scriptType", [
  "video",
  "carousel",
  "blog",
  "email",
  "reel",
]);

export const scriptStatusEnum = mysqlEnum("scriptStatus", [
  "idea",
  "scripted",
  "in_production",
  "in_edit",
  "ready_to_post",
  "published",
]);

export const scripts = mysqlTable("scripts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  scriptType: scriptTypeEnum.notNull().default("video"),
  platform: platformEnum.default("all"),
  personaId: int("personaId"),
  contentGoal: contentGoalEnum.default("audience_growth"),
  productionStatus: scriptStatusEnum.notNull().default("idea"),
  // The full script / outline body
  scriptBody: text("scriptBody"),
  // Production notes (director notes, voice model instructions, etc.)
  notes: text("notes"),
  // Thumbnail or cover image URL
  thumbnailUrl: text("thumbnailUrl"),
  // Link to a content item in the Kanban (if this script was derived from one)
  linkedContentItemId: int("linkedContentItemId"),
  // Priority order (1 = highest)
  priority: int("priority"),
  // Duration estimate in minutes (for videos)
  estimatedDurationMin: int("estimatedDurationMin"),
  // Competitor weakness this script exploits
  competitorAngle: text("competitorAngle"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Script = typeof scripts.$inferSelect;
export type InsertScript = typeof scripts.$inferInsert;

// ─── Landing Page Generator ───────────────────────────────────────────────────

/**
 * A generated landing page: avatar + offer → AI copy → Gamma.app page.
 * status tracks: draft (copy generated, not yet sent) | generating (Gamma job in progress)
 *               | published (Gamma URL available) | failed
 */
export const landingPageStatusEnum = mysqlEnum("landingPageStatus", [
  "draft",
  "generating",
  "published",
  "failed",
]);

export const offerEnum = mysqlEnum("offer", [
  "upstream_bundle",
  "upstream_course",
  "explorer_tier",
  "lights_on_webinar",
  "deep_sleep_webinar",
  "homesick_screening",
  "interconnected_screening",
  "kbmo_testing",
  "gateway_health",
  "custom",
]);

export const landingPages = mysqlTable("landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  // Avatar (persona) this page targets
  personaId: int("personaId"),
  personaName: varchar("personaName", { length: 128 }),
  // The offer being promoted
  offer: offerEnum.notNull().default("upstream_bundle"),
  offerCustomLabel: varchar("offerCustomLabel", { length: 255 }),
  // The content angle / key message (user-entered)
  contentAngle: text("contentAngle"),
  // AI-generated copy (full landing page copy in Markdown)
  copyBody: text("copyBody"),
  // Gamma generation tracking
  gammaGenerationId: varchar("gammaGenerationId", { length: 128 }),
  gammaUrl: text("gammaUrl"),
  // Status
  status: landingPageStatusEnum.notNull().default("draft"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = typeof landingPages.$inferInsert;

// ─── Competitor Channel Watchlist ─────────────────────────────────────────────

export const competitorChannels = mysqlTable("competitor_channels", {
  id: int("id").autoincrement().primaryKey(),
  channelId: varchar("channelId", { length: 64 }).notNull().unique(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  channelUrl: text("channelUrl"),
  thumbnail: text("thumbnail"),
  subscriberCount: int("subscriberCount"),
  // Notes about why we're tracking this channel
  notes: text("notes"),
  // Last time we checked for new uploads
  lastCheckedAt: bigint("lastCheckedAt", { mode: "number" }),
  trackedAt: timestamp("trackedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompetitorChannel = typeof competitorChannels.$inferSelect;
export type InsertCompetitorChannel = typeof competitorChannels.$inferInsert;

// ─── Press Coverage & Authority Signals ──────────────────────────────────────

/**
 * Every press hit from Pedram's historical coverage.
 * authorityTier: S = NYT/CNN/NBC/Good Housekeeping/Inc/Cosmopolitan
 *                A = mindbodygreen/Well+Good/Thrive Global/Bulletproof/Dr. Hyman
 *                B = niche/podcast/regional
 * impressions: raw number parsed from the CSV (UMV or readership)
 * topicTags: JSON array of topic strings (e.g. ["focus","meditation","time management"])
 */
export const pressHits = mysqlTable("press_hits", {
  id: int("id").autoincrement().primaryKey(),
  outlet: varchar("outlet", { length: 255 }).notNull(),
  medium: mysqlEnum("medium", ["online", "print", "podcast", "broadcast", "social", "radio"]).notNull().default("online"),
  description: text("description"),
  impressions: bigint("impressions", { mode: "number" }),
  impressionsLabel: varchar("impressionsLabel", { length: 128 }),
  coverageDate: varchar("coverageDate", { length: 64 }),
  url: text("url"),
  topicTags: text("topicTags"),   // JSON string array
  authorityTier: mysqlEnum("authorityTier", ["S", "A", "B"]).notNull().default("B"),
  book: varchar("book", { length: 128 }),  // which book campaign this was tied to
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PressHit = typeof pressHits.$inferSelect;
export type InsertPressHit = typeof pressHits.$inferInsert;
