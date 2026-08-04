import { bigint, boolean, date, datetime, decimal, double, float, int, json, longtext, mediumtext, mysqlEnum, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

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

// Content status workflow: idea -> pending_approval -> drafting -> review -> approved -> scheduled -> published -> pending_review (human gate before WP publish)
// ─── Funnel ID — shared across content, keywords, pages, sequences ─────────────
export const funnelIdEnum = mysqlEnum("funnel_id", [
  "lights_on",
  "oral_biome",
  "gut",
  "none",
]);

export const contentStatusEnum = mysqlEnum("status", [
  "idea",
  "pending_approval",
  "drafting",
  "review",
  "approved",
  "scheduled",
  "published",
  "pending_review",
]);

export const platformEnum = mysqlEnum("platform", [
  "meta",
  "linkedin",
  "x",
  "youtube",
  "tiktok",
  "blog",
  "carousel",
  "email",
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
  platform: platformEnum.notNull().default("linkedin"),
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
  // CTA tracking: which CTA block label was used when this content was generated
  ctaBlockLabel: varchar("ctaBlockLabel", { length: 128 }),
  // Ingest pipeline: link to the ingest report this content was generated from
  ingestReportId: int("ingestReportId"),
  // Carousel: JSON array of slides [{headline, body, imagePrompt, imageUrl}]
  carouselData: text("carouselData"),
  // CTA banner: AI-generated image URL for the clickable CTA block embedded in blog posts
  ctaBannerUrl: text("ctaBannerUrl"),
  // Buffer syndication audit: JSON array of {id, name, service} objects for each channel this item was last pushed to
  pushedChannels: text("pushedChannels"),
  // Buffer post ID — stored on push success so we can poll Buffer API for sent status
  bufferPostId: varchar("bufferPostId", { length: 128 }),
  // Yoast SEO score fetched from WordPress REST API (_yoast_wpseo_linkdex meta field)
  // Values: "good" | "ok" | "bad" | null (null = not yet fetched)
  yoastScore: varchar("yoastScore", { length: 16 }),
  yoastScoreFetchedAt: bigint("yoastScoreFetchedAt", { mode: "number" }),
  // SEO fields — persisted so CommandCenter publish can auto-push them to WordPress
  focusKeyword: varchar("focusKeyword", { length: 255 }),
  seoKeywords: text("seoKeywords"),  // JSON array of semantic keyword strings
  yoastSeoTitle: varchar("yoastSeoTitle", { length: 255 }),  // Yoast SEO title (shown in SERPs)
  yoastMetaDescription: text("yoastMetaDescription"),  // Yoast meta description (150-160 chars)
  // Readability scores — persisted for instant Kanban badge loading
  // readabilityScore: "green" | "amber" | "red" | null (null = not yet analysed)
  readabilityScore: varchar("readabilityScore", { length: 8 }),
  readabilityTransitionPct: int("readabilityTransitionPct"),  // 0-100
  readabilityMaxRun: int("readabilityMaxRun"),                 // max consecutive same-start run
  readabilityUpdatedAt: bigint("readabilityUpdatedAt", { mode: "number" }),
  // Timestamp set when bulkFixYoastIssues successfully pushes meta/content to WordPress.
  // Used to show "fixed" status in the scoreboard even before Yoast recalculates linkdex.
  yoastFixedAt: bigint("yoastFixedAt", { mode: "number" }),
  // Video Delivery Hub: finished video uploaded by edit team
  videoUrl: text("videoUrl"),   // S3 public URL of the finished video file
  videoKey: text("videoKey"),   // S3 key for deletion/management
  // YouTube ↔ Blog closed-loop: YouTube video ID this blog post was generated from
  youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
  // YouTube ↔ Blog closed-loop: content_items.id of the blog post generated from a YouTube video
  linkedBlogItemId: int("linkedBlogItemId"),
  // Human review gate: reviewer notes when rejecting or approving a post
  reviewNotes: text("reviewNotes"),
  // YouTube embed: video ID embedded into the published WP post
  embeddedYoutubeVideoId: varchar("embeddedYoutubeVideoId", { length: 64 }),
  embeddedYoutubeEmbedStatus: mysqlEnum("embeddedYoutubeEmbedStatus", ["pending", "embedded", "skipped", "no_match"]),
  // Substack integration: toggle to publish this post to Substack in addition to WordPress
  sendToSubstack: boolean("sendToSubstack").default(false),
  // Substack post ID returned after successful publish (for dedup and link)
  substackPostId: varchar("substackPostId", { length: 128 }),
  // URL of the published Substack post
  substackPostUrl: text("substackPostUrl"),
  // Funnel tag — which revenue funnel this content serves
  funnelId: funnelIdEnum.default("none"),
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
  softRejected: boolean("softRejected").default(false),  // Hidden from grid but not deleted
  contentItemId: int("contentItemId"),
  platform: platformEnum.default("linkedin"),
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
  softRejected: boolean("softRejected").default(false),  // Hidden from grid but not deleted
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
  platform: platformEnum.default("youtube"),
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
  // Cross-module connection tracking — which item spawned this landing page
  sourceWebinarId: int("sourceWebinarId"),
  sourceEbookId: int("sourceEbookId"),
  sourceLandingPageId: int("sourceLandingPageId"),
  // AI-generated copy (full landing page copy in Markdown)
  copyBody: text("copyBody"),
  // Gamma generation tracking
  gammaGenerationId: varchar("gammaGenerationId", { length: 128 }),
  gammaUrl: text("gammaUrl"),
  // Status
  status: landingPageStatusEnum.notNull().default("draft"),
  errorMessage: text("errorMessage"),
  // Funnel tag — which revenue funnel this page serves
  funnelId: funnelIdEnum.default("none"),
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

// ─── Media Assets — Authority Catalog ────────────────────────────────────────
/**
 * Pedram's full media catalog: books, podcast episodes, documentary films,
 * YouTube videos, and notable interviews. Used to inject credibility references
 * into all AI-generated content so LLMs learn to associate Pedram with authoritative answers.
 *
 * mediaType: book | podcast | film | youtube | interview
 * topicTags: JSON array (e.g. ["gut health","meditation","stress"])
 * credibilitySignal: short phrase for injection (e.g. "NYT Bestseller", "500K+ views")
 * reachEstimate: estimated audience size (views, downloads, readers)
 */
export const mediaAssetTypeEnum = mysqlEnum("mediaAssetType", [
  "book",
  "podcast",
  "film",
  "youtube",
  "interview",
]);

export const mediaAssets = mysqlTable("media_assets", {
  id: int("id").autoincrement().primaryKey(),
  mediaAssetType: mediaAssetTypeEnum.notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  // Short description (1-2 sentences) for context injection
  description: text("description"),
  // URL to the asset (YouTube link, Amazon book page, podcast episode, etc.)
  url: text("url"),
  // Platform or publisher (e.g. "Well.org Podcast", "Hay House", "YouTube")
  platform: varchar("platform", { length: 128 }),
  // Episode number (for podcasts)
  episodeNumber: int("episodeNumber"),
  // Year published or released
  publishedYear: int("publishedYear"),
  // Duration in minutes (for video/audio)
  durationMin: int("durationMin"),
  // JSON array of topic tags for context matching
  topicTags: text("topicTags"),
  // Short credibility signal for injection (e.g. "NYT Bestseller", "500K+ views", "Hay House")
  credibilitySignal: varchar("credibilitySignal", { length: 255 }),
  // Estimated reach (readers, views, downloads)
  reachEstimate: bigint("reachEstimate", { mode: "number" }),
  // Whether to actively inject this asset into AI prompts
  activeInjection: boolean("activeInjection").default(true).notNull(),
  // Priority for injection (1 = highest — used when limiting to top N references)
  injectionPriority: int("injectionPriority").default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

// ─── Avatar Intelligence Tables ──────────────────────────────────────────────

// Pain point journey stages and categories extracted from discovery call analysis
export const avatarPainPoints = mysqlTable("avatar_pain_points", {
  id: int("id").autoincrement().primaryKey(),
  // Journey stage: surface | practitioner_maze | deep_pain | root_cause
  stage: varchar("stage", { length: 64 }).notNull(),
  // Category within stage
  category: varchar("category", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  emotionalHook: varchar("emotionalHook", { length: 255 }),
  contentTopics: text("contentTopics"),   // JSON array of content topic ideas
  headlineFormula: text("headlineFormula"),
  exampleHeadline: text("exampleHeadline"),
  keyQuote: text("keyQuote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvatarPainPoint = typeof avatarPainPoints.$inferSelect;

// Buyer personas derived from discovery call patterns
export const avatarPersonas = mysqlTable("avatar_personas", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  profile: text("profile"),
  communicationStyle: text("communicationStyle"),
  contentNeeds: text("contentNeeds"),
  salesApproach: text("salesApproach"),
  traits: text("traits"),   // JSON array
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvatarPersona = typeof avatarPersonas.$inferSelect;

// Proven messaging frameworks for converting this avatar
export const avatarMessagingFrameworks = mysqlTable("avatar_messaging_frameworks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  structure: text("structure"),
  example: text("example"),
  useCase: varchar("useCase", { length: 128 }),
  emotionalJob: varchar("emotionalJob", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvatarMessagingFramework = typeof avatarMessagingFrameworks.$inferSelect;

// Common objections and proven response frameworks
export const avatarObjections = mysqlTable("avatar_objections", {
  id: int("id").autoincrement().primaryKey(),
  objection: varchar("objection", { length: 255 }).notNull(),
  underlyingFear: text("underlyingFear"),
  responseFramework: text("responseFramework"),
  contentExample: text("contentExample"),
  keyInsight: text("keyInsight"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvatarObjection = typeof avatarObjections.$inferSelect;

// ─── Topical CTA Library ─────────────────────────────────────────────────────
// Each topic vertical has its own CTA block; Lights On is the default fallback
export const ctaBlocks = mysqlTable("cta_blocks", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  topic: varchar("topic", { length: 128 }).default(""),   // e.g. sleep, gut, detox
  ctaText: text("ctaText").notNull(),
  url: varchar("url", { length: 512 }),
  keywords: text("keywords"),   // comma-separated trigger keywords
  isDefault: boolean("isDefault").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CtaBlock = typeof ctaBlocks.$inferSelect;

// ─── Content Pillars ─────────────────────────────────────────────────────────
export const contentPillars = mysqlTable("content_pillars", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  dayOfWeek: int("dayOfWeek"),   // 0=Sun, 1=Mon, ..., 6=Sat
  description: text("description"),
  topicExamples: text("topicExamples"),   // JSON array
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContentPillar = typeof contentPillars.$inferSelect;

// ─── Enrollment Windows ───────────────────────────────────────────────────────
export const enrollmentWindows = mysqlTable("enrollment_windows", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  openDate: timestamp("openDate").notNull(),
  closeDate: timestamp("closeDate").notNull(),
  goal: varchar("goal", { length: 64 }),   // "Audience Growth" | "Conversion"
  targetSignups: int("targetSignups"),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EnrollmentWindow = typeof enrollmentWindows.$inferSelect;

// ─── App Settings ─────────────────────────────────────────────────────────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;

// ─── Webinar Builder ──────────────────────────────────────────────────────────
export const webinarStatusEnum = mysqlEnum("webinarStatus", [
  "draft",
  "ready",
  "live",
  "completed",
]);

export const webinarSessions = mysqlTable("webinar_sessions", {
  id: int("id").autoincrement().primaryKey(),
  topic: text("topic").notNull(),
  cta: text("cta"),                          // e.g. "Buy the Upstream Bundle at $399"
  personaIds: text("personaIds"),            // JSON array of persona IDs e.g. "[1,3,5]"
  targetLengthMinutes: int("targetLengthMinutes").default(60),
  registrationUrl: text("registrationUrl"),  // Zoom webinar registration link
  webinarDate: varchar("webinarDate", { length: 20 }),   // e.g. "2026-04-17"
  webinarTime: varchar("webinarTime", { length: 10 }),   // e.g. "19:00"
  webinarTimezone: varchar("webinarTimezone", { length: 64 }), // e.g. "America/New_York"
  // Step 2: AI-generated outline
  outline: text("outline"),                  // AI-generated markdown outline
  hookScript: text("hookScript"),            // AI-generated opening hook
  // Step 3: Landing page
  landingPageCopy: text("landingPageCopy"),  // AI-generated landing page copy (markdown)
  gammaUrl: text("gammaUrl"),                // Published Gamma landing page URL
  gammaGenerationId: varchar("gammaGenerationId", { length: 128 }),
  // Step 4: Thank you page
  thankYouWistiaId: varchar("thankYouWistiaId", { length: 64 }), // Wistia video ID (legacy)
  thankYouWistiaEmbed: text("thankYouWistiaEmbed"),            // Full Wistia embed code (script+div)
  thankYouTypeformUrl: text("thankYouTypeformUrl"),               // Typeform embed URL
  thankYouPageCopy: text("thankYouPageCopy"),                    // AI-generated thank you copy
  thankYouGammaUrl: text("thankYouGammaUrl"),                     // Published Gamma thank you page URL
  thankYouGammaGenerationId: varchar("thankYouGammaGenerationId", { length: 128 }), // Gamma generation ID for polling
  // Kajabi automation export
  kajabiExport: text("kajabiExport"),        // JSON blob of Kajabi automation plan
  status: webinarStatusEnum.default("draft").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WebinarSession = typeof webinarSessions.$inferSelect;
export type InsertWebinarSession = typeof webinarSessions.$inferInsert;

// ─── Webinar Intelligence ─────────────────────────────────────────────────────
// Stores attendee survey responses (pre-webinar registration + post-webinar)
// tagged to a specific webinar session. AI extracts themes, pain points,
// motivations, and exact language to enrich all content generation.
export const webinarIntelligenceSurveyTypeEnum = mysqlEnum("surveyType", [
  "pre_registration",   // Registration form responses (why are you coming?)
  "post_webinar",       // Post-event survey responses (what did you get out of it?)
]);

export const webinarIntelligence = mysqlTable("webinar_intelligence", {
  id: int("id").autoincrement().primaryKey(),
  webinarSessionId: int("webinarSessionId").notNull(), // FK → webinar_sessions.id
  surveyType: webinarIntelligenceSurveyTypeEnum.notNull().default("pre_registration"),
  // Raw import: paste Typeform JSON export or CSV text
  rawResponses: mediumtext("rawResponses"),    // Raw survey responses (MEDIUMTEXT for large datasets)
  responseCount: int("responseCount").default(0),
  // AI-extracted intelligence
  extractedThemes: text("extractedThemes"),       // JSON: string[] top themes
  extractedPainPoints: text("extractedPainPoints"), // JSON: string[] pain points
  extractedMotivations: text("extractedMotivations"), // JSON: string[] motivations (why they showed up)
  extractedQuestions: text("extractedQuestions"),   // JSON: string[] questions attendees asked/had
  extractedLanguage: text("extractedLanguage"),     // JSON: string[] exact phrases/words used by attendees
  aiSummary: text("aiSummary"),               // Narrative summary of what drove this audience
  // Link to avatar profile (set when intelligence is aggregated into a product profile)
  avatarProfileId: int("avatarProfileId"), // FK → avatar_profiles.id (nullable until aggregated)
  // Metadata
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  extractedAt: timestamp("extractedAt"),
  aggregatedAt: timestamp("aggregatedAt"), // When this record was merged into the avatar profile
  notes: text("notes"),
});
export type WebinarIntelligence = typeof webinarIntelligence.$inferSelect;
export type InsertWebinarIntelligence = typeof webinarIntelligence.$inferInsert;

// ─── LLM Projects ────────────────────────────────────────────────────────────
// Each project is a topic cluster (e.g. "Sleep & Recovery", "Gut Health")
// with a prioritized production queue of FAQ articles, YouTube videos, blogs, etc.

export const llmProjectStatusEnum = mysqlEnum("llm_project_status", ["active", "archived"]);
export const llmAssetTypeEnum = mysqlEnum("llm_asset_type", ["faq", "youtube", "blog", "social", "email"]);
export const llmAssetStatusEnum = mysqlEnum("llm_asset_status", ["queued", "in_progress", "produced", "published"]);
export const llmAssetPriorityEnum = mysqlEnum("llm_asset_priority", ["high", "medium", "low"]);

export const llmProjects = mysqlTable("llm_projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  topicCluster: varchar("topicCluster", { length: 255 }), // e.g. "Sleep & Recovery"
  targetKeywords: text("targetKeywords"),  // JSON: string[] — primary LLM anchor keywords
  weeklyTarget: int("weeklyTarget").default(3), // assets to produce per week
  status: llmProjectStatusEnum.notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LlmProject = typeof llmProjects.$inferSelect;
export type InsertLlmProject = typeof llmProjects.$inferInsert;

export const llmAssets = mysqlTable("llm_assets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(), // FK → llm_projects.id
  assetType: llmAssetTypeEnum.notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  question: text("question"),            // For FAQ type: the exact question to answer
  targetKeyword: varchar("targetKeyword", { length: 255 }), // Primary LLM/SEO keyword
  semanticKeywords: text("semanticKeywords"), // JSON: string[] related keywords
  priority: llmAssetPriorityEnum.notNull().default("medium"),
  status: llmAssetStatusEnum.notNull().default("queued"),
  softRejected: boolean("softRejected").default(false),  // Hidden from grid but not deleted
  contentItemId: int("contentItemId"),   // FK → content_items.id once produced
  notes: text("notes"),
  publishedUrl: varchar("publishedUrl", { length: 1024 }), // Live URL once published
  producedAt: timestamp("producedAt"),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LlmAsset = typeof llmAssets.$inferSelect;
export type InsertLlmAsset = typeof llmAssets.$inferInsert;

// ─── Avatar Intelligence Repository ─────────────────────────────────────────
// Persistent per-product audience profile that accumulates intelligence across
// every webinar run for that product. Each time a webinar's extracted intelligence
// is aggregated here, the AI synthesizes a richer, more accurate avatar profile.
export const avatarProfiles = mysqlTable("avatar_profiles", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 255 }).notNull(), // e.g. "Upstream Course"
  productSlug: varchar("productSlug", { length: 128 }).notNull().unique(), // e.g. "upstream-course"
  productDescription: text("productDescription"), // Brief description of what the product is
  // Cumulative synthesized intelligence (AI-merged across all webinars)
  cumulativePainPoints: text("cumulativePainPoints"),   // JSON: string[] — merged pain points
  cumulativeMotivations: text("cumulativeMotivations"), // JSON: string[] — merged motivations
  cumulativeLanguage: text("cumulativeLanguage"),       // JSON: string[] — exact phrases used
  cumulativeObjections: text("cumulativeObjections"),   // JSON: string[] — objections/hesitations
  cumulativeThemes: text("cumulativeThemes"),           // JSON: string[] — recurring themes
  demographicPatterns: text("demographicPatterns"),     // JSON: free-form demographic observations
  avatarNarrative: text("avatarNarrative"),             // AI-written avatar description paragraph
  webinarBriefContext: text("webinarBriefContext"),     // Pre-built context block for next webinar prompt
  // Stats
  totalRespondents: int("totalRespondents").default(0),
  webinarCount: int("webinarCount").default(0),
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AvatarProfile = typeof avatarProfiles.$inferSelect;
export type InsertAvatarProfile = typeof avatarProfiles.$inferInsert;

// ── WordPress Post Index ──────────────────────────────────────────────────────
// Stores a local index of published posts from theurbanmonk.com WordPress site.
// Synced via the WP REST API. Used to inject real internal link candidates into
// blog generation prompts so the AI can reference actual published content.
export const wpPostIndex = mysqlTable("wp_post_index", {
  id: int("id").autoincrement().primaryKey(),
  wpPostId: int("wpPostId").notNull().unique(),
  title: varchar("title", { length: 512 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  excerpt: text("excerpt"),
  categories: text("categories"),        // JSON: string[] category names
  tags: text("tags"),                    // JSON: string[] tag names
  publishedAt: timestamp("publishedAt"),
  topicCluster: varchar("topicCluster", { length: 128 }),  // e.g. "Gut Health & Digestion"
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  // Historical Post Rehabilitation: link to the contentItems row created for this post
  contentItemId: int("contentItemId"),
  // Yoast audit: last fetched score and when it was fetched
  yoastScore: varchar("yoastScore", { length: 16 }),      // "good" | "ok" | "bad" | null
  yoastAuditedAt: bigint("yoastAuditedAt", { mode: "number" }),
  // CTA injection: timestamp when a CTA was last injected into this post
  ctaInjectedAt: bigint("ctaInjectedAt", { mode: "number" }),
  // AI-generated Yoast suggestions (stored so we can preview before pushing)
  suggestedFocusKeyword: varchar("suggestedFocusKeyword", { length: 255 }),
  suggestedSeoTitle: varchar("suggestedSeoTitle", { length: 255 }),
  suggestedMetaDescription: text("suggestedMetaDescription"),
  // Rehabilitation status: null = not imported, "imported" = in hub, "yoast_fixed" = Yoast pushed, "cta_injected" = CTA pushed
  rehabStatus: varchar("rehabStatus", { length: 32 }),
});
export type WpPost = typeof wpPostIndex.$inferSelect;
export type InsertWpPost = typeof wpPostIndex.$inferInsert;

// ── UTM Links ─────────────────────────────────────────────────────────────────
// Persistent history of UTM-tagged links generated in the UTM Builder.
// Stored in DB so history survives page reloads and is accessible from any device.
export const utmLinks = mysqlTable("utm_links", {
  id: int("id").autoincrement().primaryKey(),
  url: text("url").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  medium: varchar("medium", { length: 64 }).notNull(),
  campaign: varchar("campaign", { length: 128 }).notNull(),
  content: varchar("content", { length: 128 }),
  term: varchar("term", { length: 128 }),
  destination: text("destination"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UtmLink = typeof utmLinks.$inferSelect;
export type InsertUtmLink = typeof utmLinks.$inferInsert;

// ── Ingest Reports ────────────────────────────────────────────────────────────
// Research reports pushed from external apps (e.g. Upstream Gut Health
// Curriculum at learn.theurbanmonk.com) via POST /api/ingest/research-report.
// Each report is also materialised as a ContentItem in the Command Center.
export const ingestReports = mysqlTable("ingest_reports", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),          // e.g. "upstream-gut-health"
  topic: varchar("topic", { length: 255 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  narrativeHtml: longtext("narrativeHtml").notNull(),
  wordCount: int("wordCount").default(0),
  citationCount: int("citationCount").default(0),
  format: varchar("format", { length: 64 }).notNull(),           // blog | social | email | summary | raw_report
  generatedContent: longtext("generatedContent"),
  pubmedCitations: text("pubmedCitations"),                      // JSON: PubmedCitation[]
  tags: text("tags"),                                            // JSON: string[]
  softRejected: boolean("softRejected").default(false),  // Hidden from grid but not deleted
  contentItemId: int("contentItemId"),                           // FK → contentItems.id (set after item created)
  pushedAt: timestamp("pushedAt").defaultNow().notNull(),
  originalCreatedAt: timestamp("originalCreatedAt"),             // createdAt from the payload
});
export type IngestReport = typeof ingestReports.$inferSelect;
export type InsertIngestReport = typeof ingestReports.$inferInsert;

// ── Verified Internal Links ───────────────────────────────────────────────────
// A curated whitelist of real, verified URLs that the AI is allowed to use as
// internal links in blog posts. The AI is strictly forbidden from inventing any
// theurbanmonk.com URL that is not in this list.
//
// Populated manually via the Strategy > Verified Links UI, and auto-seeded with
// known landing pages and key articles.
export const verifiedLinks = mysqlTable("verified_links", {
  id: int("id").autoincrement().primaryKey(),
  url: varchar("url", { length: 1024 }).notNull().unique(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),                 // 1-2 sentence description for prompt context
  topicTags: text("topicTags"),                     // JSON: string[] — topic keywords for relevance matching
  active: boolean("active").default(true).notNull(), // inactive links are excluded from prompts
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type VerifiedLink = typeof verifiedLinks.$inferSelect;
export type InsertVerifiedLink = typeof verifiedLinks.$inferInsert;

// ── LinkedIn Newsfeed (Doovo Replacement) ─────────────────────────────────────
// Stores articles discovered from Google News RSS and PubMed for Pedram's
// LinkedIn commentary workflow. Status: pending → approved | dismissed.
// Approved articles are pushed into content_items as LinkedIn posts.
export const newsfeedArticles = mysqlTable("newsfeed_articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  source: varchar("source", { length: 255 }),        // e.g. "PubMed", "The Guardian"
  url: varchar("url", { length: 1024 }).notNull().unique(),
  imageUrl: text("imageUrl"),                         // Article thumbnail (if available)
  description: text("description"),                   // Article excerpt / abstract
  commentary: text("commentary"),                     // AI-generated Pedram-voice LinkedIn post
  topic: varchar("topic", { length: 128 }),           // e.g. "longevity", "gut_health"
  // Status workflow: pending → approved | dismissed
  status: mysqlEnum("newsfeedStatus", ["pending", "approved", "dismissed"]).notNull().default("pending"),
  // FK → content_items.id — set when article is approved and a LinkedIn card is created
  softRejected: boolean("softRejected").default(false),  // Hidden from grid but not deleted
  contentItemId: int("contentItemId"),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  bufferSentAt: timestamp("bufferSentAt"),       // Set when commentary is pushed to Buffer
  xVersion: text("xVersion"),                      // AI-condensed ≤280-char X/Twitter version
  xSentAt: timestamp("xSentAt"),                   // Set when X version is pushed to Buffer
  includeX: boolean("includeX").default(false),     // User preference: also push to X when sending to Buffer
});
export type NewsfeedArticle = typeof newsfeedArticles.$inferSelect;
export type InsertNewsfeedArticle = typeof newsfeedArticles.$inferInsert;

// ── Viral Studio: Hook Generations ───────────────────────────────────────────
export const hookGenerations = mysqlTable("hook_generations", {
  id: int("id").autoincrement().primaryKey(),
  topic: text("topic").notNull(),
  platform: varchar("platform", { length: 32 }).notNull().default("tiktok"),
  targetPersona: text("targetPersona"),
  hooksJson: longtext("hooksJson").notNull(),
  topPick: varchar("topPick", { length: 64 }),
  topPickReason: text("topPickReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HookGeneration = typeof hookGenerations.$inferSelect;
export type InsertHookGeneration = typeof hookGenerations.$inferInsert;

// ── Viral Studio: Script Generations ─────────────────────────────────────────
export const scriptGenerations = mysqlTable("script_generations", {
  id: int("id").autoincrement().primaryKey(),
  topic: text("topic").notNull(),
  hook: text("hook").notNull(),
  platform: varchar("platform", { length: 32 }).notNull().default("tiktok"),
  targetLengthSeconds: int("targetLengthSeconds").default(60),
  cta: text("cta"),
  socialSeoKeywords: text("socialSeoKeywords"),  // JSON: string[]
  targetPersona: text("targetPersona"),
  fullScript: longtext("fullScript").notNull(),
  scriptJson: longtext("scriptJson").notNull(),  // JSON: {hook, problem, agitate, value, proof, cta}
  captionHook: text("captionHook"),
  suggestedHashtags: text("suggestedHashtags"),  // JSON: string[]
  wordCount: int("wordCount"),
  estimatedSeconds: int("estimatedSeconds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ScriptGeneration = typeof scriptGenerations.$inferSelect;
export type InsertScriptGeneration = typeof scriptGenerations.$inferInsert;

// ── Viral Studio: Repurpose Jobs ──────────────────────────────────────────────
export const repurposeJobs = mysqlTable("repurpose_jobs", {
  id: int("id").autoincrement().primaryKey(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceTitle: varchar("sourceTitle", { length: 255 }).notNull(),
  sourceTextSnippet: text("sourceTextSnippet"),
  targetPlatforms: text("targetPlatforms").notNull(),  // JSON: string[]
  postsPerPlatform: int("postsPerPlatform").default(3),
  resultJson: longtext("resultJson"),
  totalPieces: int("totalPieces").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RepurposeJob = typeof repurposeJobs.$inferSelect;
export type InsertRepurposeJob = typeof repurposeJobs.$inferInsert;

// ── Viral Studio: Viral Topics ────────────────────────────────────────────────
export const viralTopics = mysqlTable("viral_topics", {
  id: int("id").autoincrement().primaryKey(),
  niche: text("niche").notNull(),
  platform: varchar("platform", { length: 32 }).notNull().default("all"),
  topicsJson: longtext("topicsJson").notNull(),  // JSON: topic[]
  topPick: text("topPick"),
  weeklyTheme: text("weeklyTheme"),
  count: int("count").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ViralTopic = typeof viralTopics.$inferSelect;
export type InsertViralTopic = typeof viralTopics.$inferInsert;

// ── Viral Studio: DM Playbooks ────────────────────────────────────────────────
export const dmPlaybooks = mysqlTable("dm_playbooks", {
  id: int("id").autoincrement().primaryKey(),
  videoTopic: text("videoTopic").notNull(),
  triggerKeyword: varchar("triggerKeyword", { length: 64 }).notNull(),
  leadMagnet: text("leadMagnet").notNull(),
  leadMagnetUrl: text("leadMagnetUrl"),
  platform: varchar("platform", { length: 32 }).notNull().default("instagram"),
  videoCTALine: text("videoCTALine"),
  messagesJson: longtext("messagesJson"),  // JSON: DM message[]
  setupInstructions: text("setupInstructions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DmPlaybook = typeof dmPlaybooks.$inferSelect;
export type InsertDmPlaybook = typeof dmPlaybooks.$inferInsert;

// ── Viral Studio: A/B Test Variants ──────────────────────────────────────────
export const testVariants = mysqlTable("test_variants", {
  id: int("id").autoincrement().primaryKey(),
  testName: varchar("testName", { length: 255 }).notNull(),
  topic: text("topic").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  variantType: varchar("variantType", { length: 32 }).notNull(),  // hook|cta|format|length|angle
  variantA: text("variantA").notNull(),
  variantB: text("variantB").notNull(),
  variantC: text("variantC"),
  notes: text("notes"),
  status: varchar("status", { length: 32 }).notNull().default("active"),  // active|completed
  winner: varchar("winner", { length: 4 }),  // A|B|C
  winnerReason: text("winnerReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TestVariant = typeof testVariants.$inferSelect;
export type InsertTestVariant = typeof testVariants.$inferInsert;

// ── Viral Studio: A/B Test Results ───────────────────────────────────────────
export const testResults = mysqlTable("test_results", {
  id: int("id").autoincrement().primaryKey(),
  variantId: int("variantId").notNull(),
  variant: varchar("variant", { length: 4 }).notNull(),  // A|B|C
  views: int("views").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  follows: int("follows").default(0),
  dmTriggers: int("dmTriggers").default(0),
  engagementRate: float("engagementRate").default(0),
  accountHandle: varchar("accountHandle", { length: 128 }),
  notes: text("notes"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});
export type TestResult = typeof testResults.$inferSelect;
export type InsertTestResult = typeof testResults.$inferInsert;

// ── Video Variant Factory ─────────────────────────────────────────────────────
// A job groups one set of clips (hooks + body + optional CTA) and produces
// N variants (one per hook × body combination).
export const videoVariantJobs = mysqlTable("video_variant_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobName: varchar("jobName", { length: 255 }).notNull(),
  // pending | processing | done | error
  status: mysqlEnum("jobStatus", ["pending", "processing", "done", "error"])
    .default("pending")
    .notNull(),
  hookCount: int("hookCount").default(0),
  variantCount: int("variantCount").default(0),
  errorMessage: text("errorMessage"),
  // Hook scripts from the Hook Generator — JSON array of {hookText, frameworkLabel, estimatedCTRLift}
  hookScripts: text("hookScripts"),
  // Body script from the Hook Generator — JSON object
  bodyScript: text("bodyScript"),
  // CTA variants from the Hook Generator — JSON array
  ctaScripts: text("ctaScripts"),
  targetProduct: varchar("targetProduct", { length: 64 }),
  // Output aspect ratio: 9:16 vertical (Reels/TikTok), 16:9 horizontal (YouTube), 1:1 square (Instagram)
  aspectRatio: mysqlEnum("aspectRatio", ["9:16", "16:9", "1:1"]).default("9:16").notNull(),
  // Google Drive folder URL after export (null if not yet exported)
  driveExportUrl: text("driveExportUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type VideoVariantJob = typeof videoVariantJobs.$inferSelect;
export type InsertVideoVariantJob = typeof videoVariantJobs.$inferInsert;

// Individual uploaded clips belonging to a job
export const videoClips = mysqlTable("video_clips", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  // hook | body | cta
  clipType: mysqlEnum("clipType", ["hook", "body", "cta"]).notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  durationSeconds: float("durationSeconds"),
  clipOrder: int("clipOrder").default(0),  // ordering for hooks (1, 2, 3…)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type VideoClip = typeof videoClips.$inferSelect;
export type InsertVideoClip = typeof videoClips.$inferInsert;

// Stitched output variants (hook + body [+ cta])
export const videoVariants = mysqlTable("video_variants", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  hookClipId: int("hookClipId").notNull(),
  bodyClipId: int("bodyClipId").notNull(),
  ctaClipId: int("ctaClipId"),           // optional
  variantLabel: varchar("variantLabel", { length: 128 }).notNull(), // e.g. "Hook 1 + Body"
  s3Key: varchar("s3Key", { length: 512 }),
  s3Url: text("s3Url"),
  // pending | processing | done | error
  status: mysqlEnum("variantStatus", ["pending", "processing", "done", "error"])
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type VideoVariant = typeof videoVariants.$inferSelect;
export type InsertVideoVariant = typeof videoVariants.$inferInsert;

// ─── Video Production Sessions ────────────────────────────────────────────────
// A unified session: idea → scripts → teleprompter → record → splice
export const videoProductionSessions = mysqlTable("video_production_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 128 }).notNull(),
  sessionName: varchar("sessionName", { length: 255 }).notNull(),
  idea: text("idea").notNull(),
  platform: mysqlEnum("vps_platform", ["tiktok", "instagram", "youtube", "linkedin", "x", "meta"]).default("instagram").notNull(),
  // scripting | ready_to_record | uploading | stitching | done
  status: mysqlEnum("vps_status", ["scripting", "ready_to_record", "uploading", "stitching", "done"])
    .default("scripting")
    .notNull(),
  // ManyChat keyword for CTA (UPSTREAM, LIGHTSON, TEST, SLEEP)
  ctaKeyword: varchar("ctaKeyword", { length: 50 }),
  // ── Content Brief fields ──────────────────────────────────────────────────────
  // Content pillar: which of the 5 pillars this video belongs to
  contentPillar: mysqlEnum("vps_content_pillar", [
    "gut_health_metabolism",
    "nervous_system_stress",
    "consciousness_longevity",
    "web_of_life",
    "the_practice",
  ]),
  // Funnel destination: where the CTA sends the viewer
  funnelDestination: mysqlEnum("vps_funnel_destination", [
    "lights_on",
    "upstream",
    "web_of_life_lander",
    "elephant_lander",
    "gateway_test",
  ]),
  // Avatar pain cluster: which verified pain point cluster to address
  painCluster: varchar("vps_pain_cluster", { length: 128 }),
  // Named villain for this video (system, not person)
  villain: varchar("vps_villain", { length: 255 }),
  // Verified hook phrase from the Typeform language map
  briefHookPhrase: text("vps_brief_hook_phrase"),
  // optional link to a video_variant_jobs row created in the splice phase
  variantJobId: int("variantJobId"),
  createdAt: timestamp("vps_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("vps_updatedAt").defaultNow().notNull(),
});
export type VideoProductionSession = typeof videoProductionSessions.$inferSelect;
export type InsertVideoProductionSession = typeof videoProductionSessions.$inferInsert;

// Individual scripts within a session (hooks, body, cta)
export const sessionScripts = mysqlTable("session_scripts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  // hook | body | cta
  scriptType: mysqlEnum("ss_scriptType", ["hook", "body", "cta"]).notNull(),
  scriptOrder: int("scriptOrder").default(0).notNull(), // 1-5 for hooks, 0 for body/cta
  scriptText: text("scriptText").notNull(),
  approved: boolean("approved").default(false).notNull(),
  approvedAt: timestamp("approvedAt"),
  // optional: S3 URL of the uploaded recording for this script
  recordingUrl: text("recordingUrl"),
  recordingKey: varchar("recordingKey", { length: 512 }),
  createdAt: timestamp("ss_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("ss_updatedAt").defaultNow().notNull(),
});
export type SessionScript = typeof sessionScripts.$inferSelect;
export type InsertSessionScript = typeof sessionScripts.$inferInsert;

// ── Viral Studio: Framework Performance Feedback Loop ────────────────────────
// Tracks which hook frameworks win A/B tests per platform.
// Updated automatically when a winner is declared in the A/B Test Lab.
export const frameworkPerformance = mysqlTable("framework_performance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: varchar("fp_platform", { length: 32 }).notNull(),
  framework: varchar("fp_framework", { length: 64 }).notNull(),  // contradiction|curiosityGap|specificity|socialProof|transformation
  winCount: int("winCount").default(0).notNull(),
  totalTests: int("totalTests").default(0).notNull(),
  lastWonAt: timestamp("lastWonAt"),
  createdAt: timestamp("fp_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("fp_updatedAt").defaultNow().notNull(),
});
export type FrameworkPerformance = typeof frameworkPerformance.$inferSelect;
export type InsertFrameworkPerformance = typeof frameworkPerformance.$inferInsert;

// ── Viral Studio: User Preferences ───────────────────────────────────────────
// Persists per-user settings like last-used persona so they pre-fill on next visit.
export const viralUserPreferences = mysqlTable("viral_user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  lastPersona: varchar("lastPersona", { length: 512 }),
  topicHistory: text("topicHistory"), // JSON array of last 5 topics
  updatedAt: timestamp("vup_updatedAt").defaultNow().notNull(),
});
export type ViralUserPreferences = typeof viralUserPreferences.$inferSelect;
export type InsertViralUserPreferences = typeof viralUserPreferences.$inferInsert;

// Per-user saved credentials for external integrations (Meta Ads, etc.)
export const userCredentials = mysqlTable("user_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Meta Ads Manager
  metaAdAccountId: varchar("metaAdAccountId", { length: 128 }),
  metaPageId: varchar("metaPageId", { length: 128 }),
  metaAccessToken: text("metaAccessToken"), // long-lived token, stored as text
  // Google Search Console
  gscRefreshToken: text("gscRefreshToken"),
  gscSiteUrl: varchar("gscSiteUrl", { length: 256 }),
  // Gmail OAuth (Backlink Outreach Engine — Alyzza@theurbanmonk.com)
  gmailRefreshToken: text("gmailRefreshToken"),
  gmailEmail: varchar("gmailEmail", { length: 256 }),
  // YouTube Data API OAuth (for pushing blog URLs to YouTube descriptions)
  youtubeRefreshToken: text("youtubeRefreshToken"),
  youtubeChannelTitle: varchar("youtubeChannelTitle", { length: 256 }),
  youtubeChannelId: varchar("youtubeChannelId", { length: 64 }),
  // Google Analytics 4 (GA4 Data API)
  ga4RefreshToken: text("ga4RefreshToken"),
  updatedAt: timestamp("uc_updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserCredentials = typeof userCredentials.$inferSelect;
export type InsertUserCredentials = typeof userCredentials.$inferInsert;

// ─── Book Library ─────────────────────────────────────────────────────────────

export const uploadedBookStatusEnum = mysqlEnum("uploadedBookStatus", [
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export const uploadedBooks = mysqlTable("uploaded_books", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 255 }).default("Dr. Pedram Shojai"),
  s3Key: text("s3Key"),
  s3Url: text("s3Url"),
  // Full extracted text from the PDF (may be very large)
  extractedText: longtext("extractedText"),
  // JSON: tone, vocabulary, sentence patterns, themes, opening/closing patterns
  voiceProfileJson: longtext("voiceProfileJson"),
  pageCount: int("pageCount"),
  wordCount: int("wordCount"),
  status: uploadedBookStatusEnum.notNull().default("uploading"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UploadedBook = typeof uploadedBooks.$inferSelect;
export type InsertUploadedBook = typeof uploadedBooks.$inferInsert;

// ─── Book Snippets ────────────────────────────────────────────────────────────

export const snippetPlatformEnum = mysqlEnum("snippetPlatform", [
  "instagram",
  "linkedin",
  "twitter",
  "facebook",
  "all",
]);

export const titleCardStatusEnum = mysqlEnum("titleCardStatus", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const bookSnippets = mysqlTable("book_snippets", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  userId: int("userId").notNull(),
  passageText: text("passageText").notNull(),
  pageNumber: int("pageNumber"),
  chapter: varchar("chapter", { length: 255 }),
  theme: varchar("theme", { length: 128 }),
  platform: snippetPlatformEnum.default("instagram"),
  titleCardUrl: text("titleCardUrl"),
  titleCardStatus: titleCardStatusEnum.default("pending"),
  // Platform-specific title card variants
  titleCardLinkedinUrl: text("titleCardLinkedinUrl"),
  titleCardXUrl: text("titleCardXUrl"),
  titleCardMetaUrl: text("titleCardMetaUrl"),
  // Platform-specific title card variants (Instagram formats)
  titleCardInstagramFeedUrl: text("titleCardInstagramFeedUrl"),   // 1:1 1080x1080
  titleCardInstagramReelUrl: text("titleCardInstagramReelUrl"),   // 9:16 1080x1920
  titleCardInstagramStoryUrl: text("titleCardInstagramStoryUrl"), // 9:16 1080x1920
  // AI-generated social copy per platform
  linkedinCopy: text("linkedinCopy"),
  xCopy: text("xCopy"),
  metaCopy: text("metaCopy"),
  instagramCopy: text("instagramCopy"),    // Instagram feed caption
  instagramReelCopy: text("instagramReelCopy"),  // Reels caption (shorter, hook-first)
  hashtags: text("hashtags"),           // JSON array of hashtag strings
  ctaText: varchar("ctaText", { length: 512 }),
  // Buffer push tracking
  bufferSentAt: timestamp("bufferSentAt"),
  bufferLastResult: text("bufferLastResult"),  // JSON: { platform, success, bufferId, error }
  // Per-platform publish tracking (prevents redundant re-publishing)
  publishedLinkedinAt: timestamp("publishedLinkedinAt"),
  publishedXAt: timestamp("publishedXAt"),
  publishedMetaAt: timestamp("publishedMetaAt"),
  publishedInstagramFeedAt: timestamp("publishedInstagramFeedAt"),
  publishedInstagramReelAt: timestamp("publishedInstagramReelAt"),
  publishedInstagramStoryAt: timestamp("publishedInstagramStoryAt"),
  savedToKanban: boolean("savedToKanban").default(false),
  qualityScore: int("qualityScore"),          // 1-10 from editorial filter; only >=7 are kept
  shareabilityType: varchar("shareabilityType", { length: 64 }),  // "share-worthy" | "save-worthy" | "both"
  // Card style preferences (stored per-snippet, applied at generation time)
  cardMood: varchar("cardMood", { length: 32 }).default("forest_dark"),  // forest_dark | stone_gray | ink_black | warm_amber
  cardFontSize: varchar("cardFontSize", { length: 16 }).default("medium"),  // large | medium | small
  softRejected: boolean("softRejected").default(false),  // Hidden from grid but not deleted
  contentItemId: int("contentItemId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BookSnippet = typeof bookSnippets.$inferSelect;
export type InsertBookSnippet = typeof bookSnippets.$inferInsert;

// ─── E-Books ──────────────────────────────────────────────────────────────────

export const ebookStatusEnum = mysqlEnum("ebookStatus", [
  "outline",
  "drafting",
  "complete",
  "failed",
]);

export const ebookFunnelStageEnum = mysqlEnum("ebookFunnelStage", [
  "awareness",
  "consideration",
  "conversion",
]);

export const ebooks = mysqlTable("ebooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  topic: text("topic").notNull(),
  targetPersona: text("targetPersona"),
  chapterCount: int("chapterCount").default(8),
  wordCountTarget: int("wordCountTarget").default(5000),
  status: mysqlEnum("ebookStatus", ["outline", "drafting", "complete", "failed"]).notNull().default("outline"),
  // Global default style note — seeded into each chapter's styleNote on creation
  defaultStyleNote: text("defaultStyleNote"),
  // JSON array of {chapterNumber, title, summary}
  outlineJson: longtext("outlineJson"),
  // Full markdown content of the complete e-book
  fullContent: longtext("fullContent"),
  // Generated PDF
  pdfS3Key: text("pdfS3Key"),
  pdfS3Url: text("pdfS3Url"),
  // Cover image (AI-generated)
  coverImageUrl: text("coverImageUrl"),
  // Integration links
  ctaBlockId: int("ctaBlockId"),
  landingPageId: int("landingPageId"),
  webinarSessionId: int("webinarSessionId"),
  // Cross-module connection tracking — which item spawned this ebook
  sourceWebinarId: int("sourceWebinarId"),
  sourceEbookId: int("sourceEbookId"),
  sourceLandingPageId: int("sourceLandingPageId"),
  funnelStage: mysqlEnum("ebookFunnelStage", ["awareness", "consideration", "conversion"]).default("awareness"),
  errorMessage: text("errorMessage"),
  // Source document (webinar transcript, talk notes, outline)
  sourceDocumentName: varchar("sourceDocumentName", { length: 255 }),
  sourceDocumentS3Url: text("sourceDocumentS3Url"),
  sourceDocumentText: longtext("sourceDocumentText"),
  // User narrative / additional context on top of the source document
  sourceNarrative: text("sourceNarrative"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Ebook = typeof ebooks.$inferSelect;
export type InsertEbook = typeof ebooks.$inferInsert;

// ─── E-Book Chapters ──────────────────────────────────────────────────────────

export const ebookChapterStatusEnum = mysqlEnum("ebookChapterStatus", [
  "pending",
  "generating",
  "complete",
  "failed",
]);

export const ebookChapters = mysqlTable("ebook_chapters", {
  id: int("id").autoincrement().primaryKey(),
  ebookId: int("ebookId").notNull(),
  chapterNumber: int("chapterNumber").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  content: longtext("content"),
  wordCount: int("wordCount"),
  status: ebookChapterStatusEnum.notNull().default("pending"),
  // Per-chapter CTA (overrides ebook-level CTA if set)
  ctaText: text("ctaText"),
  ctaUrl: varchar("ctaUrl", { length: 512 }),
  ctaLabel: varchar("ctaLabel", { length: 128 }),
  // Persistent author style note — pre-fills the Rewrite dialog Style note field
  styleNote: text("styleNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EbookChapter = typeof ebookChapters.$inferSelect;
export type InsertEbookChapter = typeof ebookChapters.$inferInsert;

// ─── E-Book Chapter Versions ──────────────────────────────────────────────────

export const ebookChapterVersions = mysqlTable("ebook_chapter_versions", {
  id: int("id").autoincrement().primaryKey(),
  chapterId: int("chapterId").notNull(),
  ebookId: int("ebookId").notNull(),
  chapterNumber: int("chapterNumber").notNull(),
  versionNumber: int("versionNumber").notNull().default(1),
  title: varchar("title", { length: 255 }).notNull(),
  content: longtext("content").notNull(),
  wordCount: int("wordCount"),
  // What triggered this version (initial, regenerate, enhance)
  trigger: varchar("trigger", { length: 64 }).default("regenerate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EbookChapterVersion = typeof ebookChapterVersions.$inferSelect;
export type InsertEbookChapterVersion = typeof ebookChapterVersions.$inferInsert;

// ─── Reddit Intelligence ──────────────────────────────────────────────────────

// Tracked subreddits with their topic category
export const redditSubreddits = mysqlTable("reddit_subreddits", {
  id: int("id").autoincrement().primaryKey(),
  subreddit: varchar("subreddit", { length: 128 }).notNull().unique(),
  category: varchar("category", { length: 64 }).notNull().default("general"),
  // e.g. "meditation", "biohacking", "longevity", "stress", "supplements", "yoga"
  isActive: boolean("isActive").notNull().default(true),
  lastFetchedAt: timestamp("lastFetchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RedditSubreddit = typeof redditSubreddits.$inferSelect;

// Cached Reddit posts (refreshed on demand or on schedule)
export const redditPosts = mysqlTable("reddit_posts", {
  id: int("id").autoincrement().primaryKey(),
  redditId: varchar("redditId", { length: 32 }).notNull().unique(),
  subreddit: varchar("subreddit", { length: 128 }).notNull(),
  category: varchar("category", { length: 64 }).notNull().default("general"),
  title: varchar("title", { length: 512 }).notNull(),
  selftext: text("selftext"),
  score: int("score").notNull().default(0),
  numComments: int("numComments").notNull().default(0),
  upvoteRatio: float("upvoteRatio"),
  permalink: varchar("permalink", { length: 512 }).notNull(),
  author: varchar("author", { length: 128 }),
  createdUtc: bigint("createdUtc", { mode: "number" }),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  // AI analysis fields
  engagementScore: int("engagementScore"), // 1-10 relevance × velocity score
  aiSummary: text("aiSummary"),            // 1-sentence summary of the thread
  aiRecommendation: text("aiRecommendation"), // Dr. Shojai's suggested angle
  aiDraftComment: text("aiDraftComment"),  // Draft comment in his voice
  isAnalyzed: boolean("isAnalyzed").notNull().default(false),
  isDismissed: boolean("isDismissed").notNull().default(false),
  isFlagged: boolean("isFlagged").notNull().default(false), // flagged for engagement
  isCommented: boolean("isCommented").notNull().default(false), // marked as engaged/commented
  commentedAt: timestamp("commentedAt"), // when the user marked it as commented
});
export type RedditPost = typeof redditPosts.$inferSelect;

// Weekly Reddit trend digest — AI-generated briefing of trending topics
export const redditTrendDigests = mysqlTable("reddit_trend_digests", {
  id: int("id").autoincrement().primaryKey(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(), // Monday of the week (YYYY-MM-DD)
  briefing: text("briefing").notNull(),              // Full AI-generated markdown briefing
  topTopics: text("topTopics").notNull(),            // JSON array of { topic, count, subreddits[], sampleTitles[] }
  postsAnalyzed: int("postsAnalyzed").notNull().default(0),
  subredditsScanned: int("subredditsScanned").notNull().default(0),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});
export type RedditTrendDigest = typeof redditTrendDigests.$inferSelect;

// ─── Podcast Production ───────────────────────────────────────────────────────

/**
 * One podcast episode prep session.
 * The user enters guest details and any background context; Claude generates
 * a full BINGE-framework research report (dossier + outline + question bank).
 */
export const podcastEpisodeStatusEnum = mysqlEnum("podcastEpisodeStatus", [
  "pending",    // intake saved, report not yet generated
  "generating", // Claude is working
  "complete",   // report ready
  "failed",     // generation error
]);

export const podcastEpisodes = mysqlTable("podcast_episodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Guest intake fields
  guestName: varchar("guestName", { length: 255 }).notNull(),
  guestRole: varchar("guestRole", { length: 255 }),         // e.g. "Author & Longevity Coach"
  guestCompany: varchar("guestCompany", { length: 255 }),
  whyNow: text("whyNow"),                                    // "why this guest, why now"
  backgroundUrls: text("backgroundUrls"),                    // newline-separated list of URLs
  backgroundText: text("backgroundText"),                    // pasted bio / notes / transcripts
  episodeLengthMin: int("episodeLengthMin").default(45),

  // Show context (pre-filled defaults, overridable per episode)
  showName: varchar("showName", { length: 255 }).default("The Urban Monk Podcast"),
  showDescription: text("showDescription"),
  audienceDescription: text("audienceDescription"),

  // Generated BINGE report (full markdown)
  reportMarkdown: longtext("reportMarkdown"),

  // Parsed sections stored as JSON strings for fast tab rendering
  sectionDossier: longtext("sectionDossier"),
  sectionBigPain: text("sectionBigPain"),
  sectionThroughLine: text("sectionThroughLine"),
  sectionOutline: longtext("sectionOutline"),
  sectionQuestionBank: longtext("sectionQuestionBank"),
  sectionSoundbites: text("sectionSoundbites"),

  // Status & error tracking
  status: podcastEpisodeStatusEnum.notNull().default("pending"),
  errorMessage: text("errorMessage"),

  // Optional episode number for display
  episodeNumber: int("episodeNumber"),

  // Show notes — generated separately from the BINGE report
  showNotes: text("showNotes"),

  // Guest intake form — public shareable link
  intakeToken: varchar("intakeToken", { length: 64 }).unique(),   // UUID v4, used in the public URL
  intakeSubmittedAt: timestamp("intakeSubmittedAt"),               // set when guest submits the form
  intakeStatus: mysqlEnum("intakeStatus", ["not_sent", "sent", "submitted"]).default("not_sent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
export type InsertPodcastEpisode = typeof podcastEpisodes.$inferInsert;

// ─── SEO Content Tracker ──────────────────────────────────────────────────────
// Records each time a keyword is sent to Video Production or Blog Generator,
// so the SEO dashboard can show "content created" badges.

export const seoContentTypeEnum = mysqlEnum("seoContentType", ["video", "blog"]);

export const seoContentTracker = mysqlTable("seo_content_tracker", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  keyword: varchar("keyword", { length: 512 }).notNull(),
  contentType: seoContentTypeEnum.notNull(), // "video" | "blog"
  createdAt: timestamp("sct_createdAt").defaultNow().notNull(),
});
export type SeoContentTracker = typeof seoContentTracker.$inferSelect;
export type InsertSeoContentTracker = typeof seoContentTracker.$inferInsert;

// ─── Competitor Domains Tracking ─────────────────────────────────────────────
// Stores the curated list of competitor domains the owner wants to monitor
// in the Competitive Intelligence dashboard.
export const competitorDomains = mysqlTable("competitor_domains", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  domain: varchar("domain", { length: 253 }).notNull(),
  label: varchar("label", { length: 128 }),           // optional friendly name
  addedAt: timestamp("cd_addedAt").defaultNow().notNull(),
});
export type CompetitorDomain = typeof competitorDomains.$inferSelect;
export type InsertCompetitorDomain = typeof competitorDomains.$inferInsert;

// ─── Keyword Strategy: Campaigns & Targets ───────────────────────────────────

/**
 * keyword_campaigns — a topic cluster campaign (e.g. "Gut Health", "Sleep", "Stress")
 * Each campaign has one pillar keyword and many cluster/conversion keywords.
 */
export const keywordCampaigns = mysqlTable("keyword_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("kc_user_id").notNull(),
  name: varchar("kc_name", { length: 128 }).notNull(),
  pillarKeyword: varchar("kc_pillar_keyword", { length: 256 }).notNull(),
  description: text("kc_description"),
  monetizationGoal: varchar("kc_monetization_goal", { length: 64 }).notNull().default("academy"),
  // academy | supplements | testing | free_lead
  funnelId: funnelIdEnum.default("none"),
  status: varchar("kc_status", { length: 32 }).notNull().default("active"),
  // active | paused | completed
  createdAt: timestamp("kc_created_at").notNull().defaultNow(),
  updatedAt: timestamp("kc_updated_at").notNull().defaultNow().onUpdateNow(),
});

export type KeywordCampaign = typeof keywordCampaigns.$inferSelect;
export type InsertKeywordCampaign = typeof keywordCampaigns.$inferInsert;

/**
 * keyword_targets — individual keywords within a campaign
 * Each target has funnel stage, monetization tag, DataForSEO volume, and content status.
 */
export const keywordTargets = mysqlTable("keyword_targets", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("kt_campaign_id").notNull(),
  userId: int("kt_user_id").notNull(),
  keyword: varchar("kt_keyword", { length: 256 }).notNull(),
  keywordType: varchar("kt_keyword_type", { length: 32 }).notNull().default("cluster"),
  // pillar | cluster | conversion
  funnelStage: varchar("kt_funnel_stage", { length: 16 }).notNull().default("tofu"),
  // tofu | mofu | bofu
  monetizationTag: varchar("kt_monetization_tag", { length: 64 }).notNull().default("academy"),
  // academy | supplements | testing | free_lead | affiliate
  searchVolume: int("kt_search_volume"),
  difficulty: int("kt_difficulty"),
  cpc: varchar("kt_cpc", { length: 16 }),
  currentPosition: varchar("kt_current_position", { length: 16 }),
  contentStatus: varchar("kt_content_status", { length: 32 }).notNull().default("not_started"),
  // not_started | briefed | in_progress | published
  contentItemId: int("kt_content_item_id"),
  publishedUrl: varchar("kt_published_url", { length: 512 }),
  notes: text("kt_notes"),
  priority: int("kt_priority").notNull().default(50),
  createdAt: timestamp("kt_created_at").notNull().defaultNow(),
  updatedAt: timestamp("kt_updated_at").notNull().defaultNow().onUpdateNow(),
});

export type KeywordTarget = typeof keywordTargets.$inferSelect;
export type InsertKeywordTarget = typeof keywordTargets.$inferInsert;

/**
 * keyword_rank_history — weekly GSC rank snapshots per keyword target
 * Populated by the /api/scheduled/rank-snapshot heartbeat every Monday.
 */
export const keywordRankHistory = mysqlTable("keyword_rank_history", {
  id: int("id").autoincrement().primaryKey(),
  targetId: int("krh_target_id").notNull(),
  // FK → keyword_targets.id
  keyword: varchar("krh_keyword", { length: 256 }).notNull(),
  position: int("krh_position"),
  // null = not ranking in top 100
  clicks: int("krh_clicks").default(0),
  impressions: int("krh_impressions").default(0),
  ctr: varchar("krh_ctr", { length: 16 }),
  // e.g. "3.2" (percent)
  weekLabel: varchar("krh_week_label", { length: 16 }).notNull(),
  // ISO week string e.g. "2026-W21"
  snapshotAt: bigint("krh_snapshot_at", { mode: "number" }).notNull(),
  createdAt: timestamp("krh_created_at").notNull().defaultNow(),
});

export type KeywordRankHistory = typeof keywordRankHistory.$inferSelect;
export type InsertKeywordRankHistory = typeof keywordRankHistory.$inferInsert;

// ─── Buffer Channel Defaults ─────────────────────────────────────────────────
// Stores the owner's permanent default channel selection per platform.
// When the Buffer Channel Selector opens, these are pre-checked.
// If no row exists for a platform, all channels for that platform are pre-checked.
export const bufferChannelDefaults = mysqlTable("buffer_channel_defaults", {
  id: int("id").autoincrement().primaryKey(),
  // Platform key: instagram | facebook | tiktok | linkedin | twitter | youtube
  platform: varchar("bcd_platform", { length: 32 }).notNull().unique(),
  // JSON: string[] — array of Buffer profile IDs that should be pre-checked
  // varchar(2048) used instead of text because TiDB doesn't allow defaults on BLOB/TEXT columns
  defaultProfileIds: varchar("bcd_default_profile_ids", { length: 2048 }).notNull().default(""),
  updatedAt: timestamp("bcd_updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BufferChannelDefault = typeof bufferChannelDefaults.$inferSelect;
export type InsertBufferChannelDefault = typeof bufferChannelDefaults.$inferInsert;

// ─── GSC Position History ─────────────────────────────────────────────────────
// Stores a snapshot of each published post's GSC metrics every time the
// Scoreboard is refreshed. Used to compute position trend (up/down/flat).
export const gscPositionHistory = mysqlTable("gsc_position_history", {
  id: int("id").autoincrement().primaryKey(),
  // Link to the content item (nullable — we also store keyword-level history)
  contentItemId: int("gph_content_item_id"),
  // The canonical URL of the page (normalized: lowercase, no trailing slash)
  url: varchar("gph_url", { length: 512 }).notNull(),
  // GSC metrics at the time of this snapshot (28-day window)
  clicks: int("gph_clicks").default(0).notNull(),
  impressions: int("gph_impressions").default(0).notNull(),
  ctr: varchar("gph_ctr", { length: 16 }),           // e.g. "3.2" (percent)
  position: varchar("gph_position", { length: 16 }), // e.g. "7.4" (avg position)
  // When this snapshot was recorded (Unix ms)
  recordedAt: bigint("gph_recorded_at", { mode: "number" }).notNull(),
  createdAt: timestamp("gph_created_at").defaultNow().notNull(),
});

export type GscPositionHistory = typeof gscPositionHistory.$inferSelect;
export type InsertGscPositionHistory = typeof gscPositionHistory.$inferInsert;

// ─── Keyword Search History ───────────────────────────────────────────────────
// Stores every keyword the user researches in the Competitive Intelligence tool.
// Allows revisiting past lookups and flagging favorites for article planning.
export const keywordSearches = mysqlTable("keyword_searches", {
  id: int("id").autoincrement().primaryKey(),
  // The keyword that was researched
  keyword: varchar("ksh_keyword", { length: 512 }).notNull(),
  // DataForSEO metrics at the time of the lookup
  searchVolume: int("ksh_search_volume"),
  difficulty: int("ksh_difficulty"),
  cpc: varchar("ksh_cpc", { length: 32 }),           // e.g. "2.45"
  intent: varchar("ksh_intent", { length: 64 }),     // e.g. "informational"
  // Trend data: JSON array of monthly volumes [{year, month, search_volume}]
  trendData: text("ksh_trend_data"),
  // Flagged as a favorite for article planning
  isFavorite: boolean("ksh_is_favorite").default(false).notNull(),
  // Which user performed the search (nullable for backward compat)
  userId: int("ksh_user_id"),
  createdAt: timestamp("ksh_created_at").defaultNow().notNull(),
});

export type KeywordSearch = typeof keywordSearches.$inferSelect;
export type InsertKeywordSearch = typeof keywordSearches.$inferInsert;

// ─── Readability History ──────────────────────────────────────────────────────
// Daily snapshots of how many blog posts are green / amber / red.
// Used by the 30-day readability trend sparkline in the Readability Audit header.
export const readabilityHistory = mysqlTable("readability_history", {
  id: int("id").autoincrement().primaryKey(),
  // UTC date string e.g. "2026-05-27"
  dateLabel: varchar("dateLabel", { length: 16 }).notNull(),
  // Counts at snapshot time
  greenCount: int("greenCount").notNull().default(0),
  amberCount: int("amberCount").notNull().default(0),
  redCount: int("redCount").notNull().default(0),
  totalCount: int("totalCount").notNull().default(0),
  snapshotAt: bigint("snapshotAt", { mode: "number" }).notNull(),
});

export type ReadabilityHistory = typeof readabilityHistory.$inferSelect;
export type InsertReadabilityHistory = typeof readabilityHistory.$inferInsert;

// ─── Hosted Landing Pages (ch.theurbanmonk.com) ───────────────────────────────
// Self-hosted landing pages served at ch.theurbanmonk.com/{campaign}/{slug}.
// Replaces Gamma for all Urban Monk landing pages.
// Campaign: lo | gut | sleep
// Template: optin | vsl | sales
// status: draft | published | archived

export const hostedLpCampaignEnum = mysqlEnum("hlp_campaign", ["lo", "gut", "sleep", "webinar", "upstream"]);
export const hostedLpTemplateEnum = mysqlEnum("hlp_template", ["optin", "vsl", "sales"]);
export const hostedLpStatusEnum = mysqlEnum("hlp_status", ["draft", "published", "archived"]);

export const hostedLandingPages = mysqlTable("hosted_landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  // URL: ch.theurbanmonk.com/{campaign}/{slug}
  campaign: hostedLpCampaignEnum.notNull().default("lo"),
  slug: varchar("hlp_slug", { length: 128 }).notNull(),
  template: hostedLpTemplateEnum.notNull().default("optin"),
  status: hostedLpStatusEnum.notNull().default("draft"),

  // Page identity
  title: varchar("hlp_title", { length: 255 }).notNull(),
  // Internal label (not shown publicly)
  internalLabel: varchar("hlp_internal_label", { length: 255 }),

  // Hero section
  headline: text("hlp_headline"),
  subheadline: text("hlp_subheadline"),
  heroImageUrl: text("hlp_hero_image_url"),
  heroImageKey: text("hlp_hero_image_key"),

  // VSL section (vsl + sales templates)
  videoEmbedCode: text("hlp_video_embed_code"),   // full iframe/script embed (YouTube, Vimeo, etc.)
  wistiaEmbedCode: text("hlp_wistia_embed_code"), // Wistia-specific embed code (inline or popover)
  videoThumbnailUrl: text("hlp_video_thumbnail_url"),

  // Body copy (markdown — rendered to HTML at serve time)
  bodyCopy: longtext("hlp_body_copy"),

  // Opt-in form config
  optinHeadline: varchar("hlp_optin_headline", { length: 255 }),
  optinButtonText: varchar("hlp_optin_button_text", { length: 128 }).default("Yes, Send It To Me!"),
  optinLeadMagnet: varchar("hlp_optin_lead_magnet", { length: 255 }),
  // Kajabi form action URL (from Kajabi landing page embed code)
  kajabiFormUrl: text("hlp_kajabi_form_url"),
  // Redirect after opt-in
  thankYouUrl: text("hlp_thank_you_url"),

  // CTA button (vsl + sales templates)
  ctaText: varchar("hlp_cta_text", { length: 255 }),
  ctaUrl: text("hlp_cta_url"),
  ctaSubtext: varchar("hlp_cta_subtext", { length: 255 }),

  // Social proof
  testimonials: longtext("hlp_testimonials"),  // JSON: { name, title, quote, avatarUrl }[]

  // Tracking
  facebookPixelId: varchar("hlp_fb_pixel_id", { length: 64 }).default("1498608757116877"),
  ga4MeasurementId: varchar("hlp_ga4_id", { length: 32 }),  // e.g. G-XXXXXXXXXX
  customHeadScripts: text("hlp_custom_head_scripts"),  // any extra <script> tags

  // Design overrides (optional — leave null to use campaign defaults)
  accentColor: varchar("hlp_accent_color", { length: 16 }),  // hex e.g. #2D7D46
  logoUrl: text("hlp_logo_url"),
  designTheme: varchar("hlp_design_theme", { length: 32 }).default("default"),  // "default" | "blue"

  // Stats (lightweight, not a full analytics system)
  viewCount: int("hlp_view_count").default(0).notNull(),
  optinCount: int("hlp_optin_count").default(0).notNull(),

  // Cross-links to other modules
  personaId: int("hlp_persona_id"),
  ebookId: int("hlp_ebook_id"),
  webinarSessionId: int("hlp_webinar_session_id"),

  publishedAt: timestamp("hlp_published_at"),
  createdAt: timestamp("hlp_created_at").defaultNow().notNull(),
  updatedAt: timestamp("hlp_updated_at").defaultNow().onUpdateNow().notNull(),
});

export type HostedLandingPage = typeof hostedLandingPages.$inferSelect;
export type InsertHostedLandingPage = typeof hostedLandingPages.$inferInsert;

// Unique constraint: campaign + slug must be unique (enforced at app level too)

// ─── Testimonials ─────────────────────────────────────────────────────────────
// Stores testimonials imported from PPTX or entered manually.
// campaign: which product they belong to (lo, gut, sleep, webinar, general)
// category: the thematic tag from the slide (e.g. NEUROCEPTION, SLEEP & RECOVERY)
// source: where the testimonial came from (pptx, manual, etc.)

export const testimonialCampaignEnum = mysqlEnum("testimonial_campaign", [
  "lo",
  "gut",
  "sleep",
  "webinar",
  "general",
]);

export const testimonials = mysqlTable("testimonials", {
  id: int("id").autoincrement().primaryKey(),
  campaign: testimonialCampaignEnum.notNull().default("lo"),
  category: varchar("category", { length: 128 }),   // e.g. "NEUROCEPTION"
  quote: text("quote").notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  authorTitle: varchar("author_title", { length: 255 }),  // optional role/location
  dateLabel: varchar("date_label", { length: 128 }),      // e.g. "Week 6 · Lights On"
  source: varchar("source", { length: 64 }).default("manual"),  // "pptx" | "manual"
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

// ─── Video Push Logs ──────────────────────────────────────────────────────────
// Tracks each individual channel push for a video — one row per channel per push.
// Used to show per-channel push history and eventually pull performance metrics.
export const videoPushLogs = mysqlTable("video_push_logs", {
  id: int("id").autoincrement().primaryKey(),
  contentItemId: int("content_item_id").notNull(),
  channelId: varchar("channel_id", { length: 128 }).notNull(),
  channelName: varchar("channel_name", { length: 255 }).notNull(),
  service: varchar("service", { length: 64 }).notNull(),
  bufferPostId: varchar("buffer_post_id", { length: 255 }),
  caption: text("caption"),
  scheduledAt: bigint("scheduled_at", { mode: "number" }),
  pushedAt: timestamp("pushed_at").defaultNow().notNull(),
  // Performance metrics (populated later via Buffer analytics sync)
  views: int("views").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  lastSyncedAt: timestamp("last_synced_at"),
});
export type VideoPushLog = typeof videoPushLogs.$inferSelect;
export type InsertVideoPushLog = typeof videoPushLogs.$inferInsert;

// ─── Backlink Outreach Engine ─────────────────────────────────────────────────
// Tracks link-building prospects discovered via DataForSEO and the outreach
// email pipeline for each approved prospect.

export const backlinkProspectStatusEnum = mysqlEnum("backlink_prospect_status", [
  "discovered",   // Found by DataForSEO, awaiting owner review
  "approved",     // Owner approved — ready for email drafting
  "rejected",     // Owner rejected — skip
  "emailed",      // First outreach email sent
  "followed_up",  // Follow-up 1 sent
  "followed_up_2",// Follow-up 2 sent
  "responded",    // Prospect replied (positive or negative)
  "won",          // Backlink placed and confirmed
  "lost",         // Prospect declined or went cold
]);

export const backlinkProspects = mysqlTable("backlink_prospects", {
  id: int("id").autoincrement().primaryKey(),
  // Discovery metadata
  domain: varchar("domain", { length: 255 }).notNull(),
  pageUrl: text("pageUrl").notNull(),           // Specific page URL (for broken link / resource page)
  pageTitle: varchar("pageTitle", { length: 512 }),
  domainAuthority: int("domainAuthority"),       // DA score from DataForSEO
  organicTraffic: int("organicTraffic"),         // Estimated monthly organic traffic
  topicRelevance: varchar("topicRelevance", { length: 255 }), // e.g. "gut health", "stress"
  discoveryKeyword: varchar("discoveryKeyword", { length: 255 }), // Keyword used to find this site
  outreachType: mysqlEnum("outreach_type", ["guest_post", "resource_page", "broken_link"]).default("guest_post").notNull(),
  // Contact info
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPageUrl: text("contactPageUrl"),
  // Status workflow
  status: backlinkProspectStatusEnum.default("discovered").notNull(),
  // Notes from owner review
  ownerNotes: text("ownerNotes"),
  // Timestamps
  discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  firstEmailSentAt: timestamp("firstEmailSentAt"),
  lastFollowUpAt: timestamp("lastFollowUpAt"),
  respondedAt: timestamp("respondedAt"),
  wonAt: timestamp("wonAt"),
  // Link tracking (once won)
  placedLinkUrl: text("placedLinkUrl"),         // The URL of the page where the link was placed
  linkAnchorText: varchar("linkAnchorText", { length: 255 }),
  linkVerifiedAt: timestamp("linkVerifiedAt"),
  linkLiveAt: timestamp("linkLiveAt"),
  linkLastCheckedAt: timestamp("linkLastCheckedAt"),
  linkIsLive: boolean("linkIsLive"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BacklinkProspect = typeof backlinkProspects.$inferSelect;
export type InsertBacklinkProspect = typeof backlinkProspects.$inferInsert;

export const backlinkEmails = mysqlTable("backlink_emails", {
  id: int("id").autoincrement().primaryKey(),
  prospectId: int("prospectId").notNull(),      // FK → backlink_prospects.id
  emailType: mysqlEnum("email_type", ["initial", "follow_up_1", "follow_up_2", "custom"]).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("email_status", ["draft", "approved", "sent", "bounced"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  gmailThreadId: varchar("gmailThreadId", { length: 255 }),   // Gmail thread ID for reply tracking
  gmailMessageId: varchar("gmailMessageId", { length: 255 }), // Gmail message ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BacklinkEmail = typeof backlinkEmails.$inferSelect;
export type InsertBacklinkEmail = typeof backlinkEmails.$inferInsert;

// ─── Blog → YouTube Backlog ───────────────────────────────────────────────────
// Tracks the pipeline of converting existing blog posts into YouTube videos.
// Each row represents one blog post being turned into a video.

export const blogToYoutubeStatusEnum = mysqlEnum("blogToYoutubeStatus", [
  "backlog",        // Added to backlog, no script yet
  "scripted",       // Script generated and ready to review/edit
  "recorded",       // Script approved, video recorded (not yet uploaded)
  "uploaded",       // Video uploaded to YouTube
  "live",           // Video published and linked back to blog
]);

export const blogToYoutubeItems = mysqlTable("blog_to_youtube_items", {
  id: int("id").autoincrement().primaryKey(),

  // Source blog post (from wpPostIndex)
  wpPostId: int("wpPostId"),                              // FK → wp_post_index.wpPostId
  blogTitle: varchar("blogTitle", { length: 512 }).notNull(),
  blogUrl: varchar("blogUrl", { length: 1024 }).notNull(),
  blogExcerpt: text("blogExcerpt"),
  blogCategories: text("blogCategories"),                 // JSON: string[]

  // Generated video script
  script: longtext("script"),                             // Full spoken script for Pedram
  scriptWordCount: int("scriptWordCount"),
  scriptGeneratedAt: timestamp("scriptGeneratedAt"),

  // Video package (title, description, thumbnail options)
  videoTitle: varchar("videoTitle", { length: 255 }),
  ytDescription: longtext("ytDescription"),               // Full SEO description with UTM footer
  thumbnailTextOptions: text("thumbnailTextOptions"),     // JSON: string[] — 3 thumbnail text options
  vaInstructions: longtext("vaInstructions"),             // Step-by-step VA instructions for title cards

  // Production tracking
  status: blogToYoutubeStatusEnum.notNull().default("backlog"),
  productionNotes: text("productionNotes"),               // Free-form notes from Pedram
  recordedAt: timestamp("recordedAt"),

  // Upload tracking
  youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),  // Set after upload
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  uploadedAt: timestamp("uploadedAt"),

  // Generated blog post (SEO-optimized, separate from the source blog)
  generatedBlogContent: longtext("generatedBlogContent"),   // Full Yoast-optimized blog article (Markdown)
  generatedBlogTitle: varchar("generatedBlogTitle", { length: 255 }), // SEO title (≤48 chars)
  focusKeyword: varchar("focusKeyword", { length: 255 }),   // Yoast focus keyword
  metaDescription: varchar("metaDescription", { length: 512 }), // Yoast meta description (140-150 chars)
  seoTitle: varchar("seoTitle", { length: 255 }),           // Yoast SEO title override
  wpDraftPostId: int("wpDraftPostId"),                      // WP post ID after publishing as draft
  wpDraftPostUrl: varchar("wpDraftPostUrl", { length: 1024 }), // WP draft URL
  blogGeneratedAt: timestamp("blogGeneratedAt"),
  // Link-back confirmation
  descriptionUpdatedAt: timestamp("descriptionUpdatedAt"),  // When blog URL was pushed to YT description
  blogUpdatedWithVideoAt: timestamp("blogUpdatedWithVideoAt"), // When video embed was added to blog

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlogToYoutubeItem = typeof blogToYoutubeItems.$inferSelect;
export type InsertBlogToYoutubeItem = typeof blogToYoutubeItems.$inferInsert;

// ─── GSC Indexing Log ──────────────────────────────────────────────────────────
// Tracks every URL submitted to the Google Indexing API so we can:
//   1. Verify which posts have been submitted
//   2. Avoid re-submitting the same URL within 24 hours
//   3. Backfill any posts that were published before auto-indexing was wired up
export const gscIndexingLog = mysqlTable("gsc_indexing_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  wpPostId: int("wpPostId"),                                    // Optional — set when triggered by a WP publish
  success: boolean("success").notNull().default(false),
  message: text("message"),
  source: mysqlEnum("source", ["auto_publish", "backfill", "manual"]).notNull().default("auto_publish"),
  submittedAt: bigint("submittedAt", { mode: "number" }).notNull(), // Unix ms
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GscIndexingLog = typeof gscIndexingLog.$inferSelect;
export type InsertGscIndexingLog = typeof gscIndexingLog.$inferInsert;

// ─── Ask the Urban Monk — Chat Tables ────────────────────────────────────────
// Stores conversation sessions and messages for the AI chatbot that answers
// questions grounded in Dr. Pedram Shojai's uploaded books.

export const urbanMonkChatSessions = mysqlTable("urban_monk_chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("umcs_user_id").notNull(),
  // Auto-generated title from the first user message (truncated to 100 chars)
  title: varchar("umcs_title", { length: 255 }).notNull().default("New Conversation"),
  createdAt: timestamp("umcs_created_at").defaultNow().notNull(),
  updatedAt: timestamp("umcs_updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UrbanMonkChatSession = typeof urbanMonkChatSessions.$inferSelect;
export type InsertUrbanMonkChatSession = typeof urbanMonkChatSessions.$inferInsert;

export const urbanMonkChatMessageRoleEnum = mysqlEnum("umcm_role", ["user", "assistant"]);

export const urbanMonkChatMessages = mysqlTable("urban_monk_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("umcm_session_id").notNull(),
  role: urbanMonkChatMessageRoleEnum.notNull(),
  // Full message content — can be long for assistant responses with citations
  content: longtext("umcm_content").notNull(),
  createdAt: timestamp("umcm_created_at").defaultNow().notNull(),
});

export type UrbanMonkChatMessage = typeof urbanMonkChatMessages.$inferSelect;
export type InsertUrbanMonkChatMessage = typeof urbanMonkChatMessages.$inferInsert;

// ─── Presence Assessment Quiz ─────────────────────────────────────────────────
// 9-question quiz assessing which of the 9 "presence channels" are suppressed.
// Primary lead magnet for the Lights On campaign.
// Each channel is scored 1-5; channels scoring ≤2 are flagged as suppressed.

export const presenceAssessmentResults = mysqlTable("presence_assessment_results", {
  id: int("id").autoincrement().primaryKey(),
  // Nullable — allows anonymous quiz takers (future: capture email for lead gen)
  userId: int("par_user_id"),
  // JSON object: { sleep: 3, stress: 1, gut: 4, energy: 2, focus: 5, movement: 3, connection: 2, purpose: 4, environment: 1 }
  scores: text("par_scores").notNull(),
  // Comma-separated list of suppressed channels (score ≤ 2), e.g. "stress,energy,environment"
  suppressedChannels: varchar("par_suppressed_channels", { length: 512 }),
  // Primary result label: "Highly Suppressed" | "Partially Suppressed" | "Well-Resourced"
  primaryResult: varchar("par_primary_result", { length: 64 }).notNull(),
  // Overall score (average of all 9 channels × 20 to give 0-100)
  overallScore: int("par_overall_score").notNull().default(0),
  // Email captured for lead gen (optional)
  email: varchar("par_email", { length: 320 }),
  createdAt: timestamp("par_created_at").defaultNow().notNull(),
});

export type PresenceAssessmentResult = typeof presenceAssessmentResults.$inferSelect;
export type InsertPresenceAssessmentResult = typeof presenceAssessmentResults.$inferInsert;

// ─── Syndication Pipeline ────────────────────────────────────────────────────
// Tracks the staggered multi-platform syndication queue for each WordPress post.
// When a blog is published to WordPress, three jobs are automatically enqueued:
//   - substack: fires at Day 1 (24h after WP publish)
//   - medium:   fires at Day 2 (48h after WP publish)
//   - quora:    fires at Day 3 (72h after WP publish)
// The Heartbeat cron at /api/scheduled/syndication processes pending jobs daily.

export const syndicationPlatformEnum = mysqlEnum("syndication_platform", [
  "substack",
  "medium",
  "quora",
  "reddit",
]);

export const syndicationStatusEnum = mysqlEnum("syndication_status", [
  "pending",
  "adapting",
  "ready",
  "published",
  "failed",
  "skipped",
]);

export const syndicationJobs = mysqlTable("syndication_jobs", {
  id: int("id").autoincrement().primaryKey(),
  contentItemId: int("sj_content_item_id").notNull(),
  wordpressUrl: text("sj_wordpress_url").notNull(),
  wordpressTitle: varchar("sj_wordpress_title", { length: 512 }).notNull(),
  wordpressBodyHtml: text("sj_wordpress_body_html"),
  wordpressMetaDescription: text("sj_wordpress_meta_description"),
  wordpressFocusKeyword: varchar("sj_wordpress_focus_keyword", { length: 255 }),
  platform: syndicationPlatformEnum.notNull(),
  status: syndicationStatusEnum.notNull().default("pending"),
  scheduledAt: bigint("sj_scheduled_at", { mode: "number" }).notNull(),
  adaptedContent: text("sj_adapted_content"),
  publishedUrl: text("sj_published_url"),
  publishedPostId: varchar("sj_published_post_id", { length: 256 }),
  errorMessage: text("sj_error_message"),
  retryCount: int("sj_retry_count").default(0),
  createdAt: timestamp("sj_created_at").defaultNow().notNull(),
  updatedAt: timestamp("sj_updated_at").defaultNow().onUpdateNow().notNull(),
  archivedAt: bigint("sj_archived_at", { mode: "number" }),
});

export type SyndicationJob = typeof syndicationJobs.$inferSelect;
export type InsertSyndicationJob = typeof syndicationJobs.$inferInsert;

// ── Video Pipeline (Multi-path → Multi-channel) ─────────────────────────────
// productionPath controls which rendering engine is used:
//   descript_only  = AI voice narration + B-roll in Descript (original flow)
//   heygen_only    = HeyGen avatar render only (no Descript B-roll)
//   heygen_then_descript = HeyGen avatar → Descript B-roll overlay (full avatar flow)
// outputChannels is a JSON array of destination channels: ["youtube","tiktok","meta","instagram","x"]
export const videoProductionPathEnum = mysqlEnum("video_production_path", [
  "descript_only",
  "heygen_only",
  "heygen_then_descript",
]);

// Status enum matches actual DB: pending|importing|editing|rendering|ready_for_review|approved|uploading|published|failed|rejected
export const videoJobStatusEnum = mysqlEnum("video_job_status", [
  "pending",
  "importing",
  "editing",
  "rendering",
  "ready_for_review",
  "approved",
  "uploading",
  "uploaded_unlisted",
  "published",
  "failed",
  "rejected",
]);

export const videoJobs = mysqlTable("video_jobs", {
  id: int("id").primaryKey().autoincrement(),
  contentItemId: int("vj_content_item_id").notNull(),
  scriptText: text("vj_script_text").notNull(),
  brollPrompt: text("vj_broll_prompt"),
  descriptProjectId: varchar("vj_descript_project_id", { length: 256 }),
  descriptImportJobId: varchar("vj_descript_import_job_id", { length: 256 }),
  // Pexels stock footage import job — runs after avatar import, before Underlord
  pexelsMediaImportJobId: varchar("vj_pexels_media_import_job_id", { length: 256 }),
  descriptAgentJobId: varchar("vj_descript_agent_job_id", { length: 256 }),
  descriptPublishJobId: varchar("vj_descript_publish_job_id", { length: 256 }),
  descriptShareUrl: text("vj_descript_share_url"),
  descriptDownloadUrl: text("vj_descript_download_url"),
  s3VideoKey: varchar("vj_s3_video_key", { length: 512 }),
  s3VideoUrl: text("vj_s3_video_url"),
  youtubeVideoId: varchar("vj_youtube_video_id", { length: 64 }),
  youtubeTitle: varchar("vj_youtube_title", { length: 512 }),
  youtubeDescription: text("vj_youtube_description"),
  youtubeTags: text("vj_youtube_tags"),
  youtubeThumbnailUrl: text("vj_youtube_thumbnail_url"),
  ctaId: int("vj_cta_id"),
  ctaLabel: varchar("vj_cta_label", { length: 256 }),
  ctaText: text("vj_cta_text"),
  ctaUrl: text("vj_cta_url"),
  // Production path: which rendering engine(s) to use
  // descript_only = AI narration + Descript B-roll (original)
  // heygen_only = HeyGen avatar render only, no Descript
  // heygen_then_descript = HeyGen avatar → Descript B-roll overlay
  productionPath: videoProductionPathEnum.default("heygen_only").notNull(),
  // Output channels: JSON array e.g. ["youtube","tiktok","meta"]
  // Determines where the final video is distributed after VA approval
  outputChannels: text("vj_output_channels").default(JSON.stringify(["youtube"])).notNull(),
  // Legacy field kept for backwards compatibility (maps to productionPath)
  videoType: mysqlEnum("vj_video_type", ["standard", "avatar"]).default("standard").notNull(),
  // HeyGen avatar pipeline fields
  heygenVideoId: varchar("vj_heygen_video_id", { length: 128 }),
  // YouTube resumable upload URI — persisted so upload can resume after server restart
  // YouTube resumable URIs are valid for 7 days from creation
  ytUploadUri: text("vj_yt_upload_uri"),
  ytUploadOffset: bigint("vj_yt_upload_offset", { mode: "number" }),
  status: videoJobStatusEnum.notNull().default("pending"),
  errorMessage: text("vj_error_message"),
  retryCount: int("vj_retry_count").default(0),
  vaApprovedAt: bigint("vj_va_approved_at", { mode: "number" }),
  publishedAt: bigint("vj_published_at", { mode: "number" }),
  archivedAt: bigint("vj_archived_at", { mode: "number" }),
  createdAt: timestamp("vj_created_at").defaultNow().notNull(),
  updatedAt: timestamp("vj_updated_at").defaultNow().notNull(),
});

export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertVideoJob = typeof videoJobs.$inferInsert;

// ─── Organic Signal Monitor ───────────────────────────────────────────────────

/**
 * Tracks periodic YouTube engagement snapshots for videos produced via the
 * video pipeline. Snapshots are taken at 24h, 48h, 72h, 7d, and 14d post-publish.
 * Used to compute engagement score and flag paid promotion candidates.
 */
export const videoEngagementSnapshots = mysqlTable("video_engagement_snapshots", {
  id: int("ves_id").primaryKey().autoincrement(),
  videoJobId: int("ves_video_job_id").notNull(),           // FK → video_jobs.id
  youtubeVideoId: varchar("ves_yt_video_id", { length: 64 }).notNull(),
  snapshotHour: int("ves_snapshot_hour").notNull(),        // 24, 48, 72, 168 (7d), 336 (14d)
  viewCount: int("ves_view_count").default(0).notNull(),
  likeCount: int("ves_like_count").default(0).notNull(),
  commentCount: int("ves_comment_count").default(0).notNull(),
  viewVelocity: int("ves_view_velocity").default(0).notNull(), // views/day at this snapshot
  engagementRate: varchar("ves_engagement_rate", { length: 16 }), // (likes+comments)/views %
  outlierScore: varchar("ves_outlier_score", { length: 16 }),     // views / channel avg
  capturedAt: timestamp("ves_captured_at").defaultNow().notNull(),
});

export type VideoEngagementSnapshot = typeof videoEngagementSnapshots.$inferSelect;

/**
 * Paid promotion candidates — videos flagged by the organic signal engine
 * as strong performers worth promoting via Meta ads.
 * Claude generates a campaign recommendation for each candidate.
 */
export const paidPromoCandidates = mysqlTable("paid_promo_candidates", {
  id: int("ppc_id").primaryKey().autoincrement(),
  // Source platform — youtube, meta, linkedin, tiktok
  platform: varchar("ppc_platform", { length: 32 }).default("youtube").notNull(),
  // For non-YouTube sources: the native post ID
  sourcePostId: varchar("ppc_source_post_id", { length: 128 }),
  videoJobId: int("ppc_video_job_id"),
  youtubeVideoId: varchar("ppc_yt_video_id", { length: 64 }),
  youtubeTitle: varchar("ppc_yt_title", { length: 512 }),
  youtubeThumbnailUrl: text("ppc_yt_thumbnail_url"),
  // Signal metrics at time of flagging
  viewCount: int("ppc_view_count").default(0).notNull(),
  likeCount: int("ppc_like_count").default(0).notNull(),
  commentCount: int("ppc_comment_count").default(0).notNull(),
  viewVelocity: int("ppc_view_velocity").default(0).notNull(),
  engagementRate: varchar("ppc_engagement_rate", { length: 16 }),
  outlierScore: varchar("ppc_outlier_score", { length: 16 }),
  signalStrength: mysqlEnum("ppc_signal_strength", ["strong", "exceptional"]).notNull(),
  flaggedAt: timestamp("ppc_flagged_at").defaultNow().notNull(),
  // Claude recommendation
  claudeRecommendation: text("ppc_claude_recommendation"),  // JSON string: CampaignRecommendation object
  recommendationGeneratedAt: timestamp("ppc_rec_generated_at"),
  // Campaign launch status
  status: mysqlEnum("ppc_status", [
    "flagged",          // Just flagged, no recommendation yet
    "recommended",      // Claude has generated a recommendation
    "approved",         // User approved the recommendation
    "launched",         // Campaign created in Meta
    "dismissed",        // User dismissed this candidate
  ]).default("flagged").notNull(),
  metaCampaignId: varchar("ppc_meta_campaign_id", { length: 64 }),
  metaAdSetId: varchar("ppc_meta_adset_id", { length: 64 }),
  metaAdId: varchar("ppc_meta_ad_id", { length: 64 }),
  launchedAt: timestamp("ppc_launched_at"),
  launchedBy: varchar("ppc_launched_by", { length: 128 }),
  createdAt: timestamp("ppc_created_at").defaultNow().notNull(),
  updatedAt: timestamp("ppc_updated_at").defaultNow().notNull(),
});

export type PaidPromoCandidate = typeof paidPromoCandidates.$inferSelect;
export type InsertPaidPromoCandidate = typeof paidPromoCandidates.$inferInsert;

// ─── Ads Guardrails Config ────────────────────────────────────────────────────
// Single-row config table for Phase 3 automated optimization guardrails
export const adsGuardrails = mysqlTable("ads_guardrails", {
  id: int("id").primaryKey().autoincrement(),
  targetCpl: decimal("target_cpl", { precision: 10, scale: 2 }).default("25.00").notNull(),
  minDailyBudget: decimal("min_daily_budget", { precision: 10, scale: 2 }).default("20.00").notNull(),
  maxDailyBudget: decimal("max_daily_budget", { precision: 10, scale: 2 }).default("200.00").notNull(),
  autoScaleEnabled: boolean("auto_scale_enabled").default(true).notNull(),
  autoPauseEnabled: boolean("auto_pause_enabled").default(true).notNull(),
  maxFrequencyBeforePause: decimal("max_frequency_before_pause", { precision: 4, scale: 1 }).default("4.0").notNull(),
  minCtrBeforePause: decimal("min_ctr_before_pause", { precision: 5, scale: 2 }).default("0.30").notNull(),
  scaleUpMultiplier: decimal("scale_up_multiplier", { precision: 4, scale: 2 }).default("1.20").notNull(),
  minSpendForAction: decimal("min_spend_for_action", { precision: 10, scale: 2 }).default("5.00").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Per-SKU CPA Targets ─────────────────────────────────────────────────────
// One row per product SKU; editable in-app from the Optimizer tab
export const skuCpaTargets = mysqlTable("sku_cpa_targets", {
  id: int("id").primaryKey().autoincrement(),
  skuId: varchar("sku_id", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 128 }).notNull(),
  targetCpa: decimal("target_cpa", { precision: 10, scale: 2 }).notNull(),
  minDailyBudget: decimal("min_daily_budget", { precision: 10, scale: 2 }).notNull(),
  maxDailyBudget: decimal("max_daily_budget", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SkuCpaTarget = typeof skuCpaTargets.$inferSelect;
export type InsertSkuCpaTarget = typeof skuCpaTargets.$inferInsert;

// ─── Ads Optimization Logs ───────────────────────────────────────────────────
// Audit trail of every automated action taken by the optimization engine
export const adsOptimizationLogs = mysqlTable("ads_optimization_logs", {
  id: int("id").primaryKey().autoincrement(),
  campaignId: varchar("campaign_id", { length: 64 }).notNull(),
  campaignName: varchar("campaign_name", { length: 256 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(), // scaled | paused | warned | held | skipped
  reason: text("reason").notNull(),
  previousBudget: decimal("previous_budget", { precision: 10, scale: 2 }),
  newBudget: decimal("new_budget", { precision: 10, scale: 2 }),
  metricsSnapshot: text("metrics_snapshot"), // JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Weekly Digest History ───────────────────────────────────────────────────
export const adsWeeklyDigests = mysqlTable("ads_weekly_digests", {
  id: int("id").primaryKey().autoincrement(),
  weekStartDate: varchar("week_start_date", { length: 16 }).notNull(),
  weekEndDate: varchar("week_end_date", { length: 16 }).notNull(),
  digestMarkdown: text("digest_markdown").notNull(),
  totalSpend: decimal("total_spend", { precision: 12, scale: 2 }),
  totalLeads: int("total_leads"),
  avgCpl: decimal("avg_cpl", { precision: 10, scale: 2 }),
  campaignCount: int("campaign_count"),
  actionsCount: int("actions_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Hook A/B Tests ────────────────────────────────────────────────────────────
// Tracks Meta A/B test campaigns created from hook variants
export const hookAbTests = mysqlTable("hook_ab_tests", {
  id: int("id").autoincrement().primaryKey(),
  hookGenerationId: int("hookGenerationId").notNull(),
  campaignId: varchar("campaignId", { length: 64 }).notNull(),
  adSetIds: text("adSetIds").notNull(),       // JSON array of ad set IDs
  adIds: text("adIds").notNull(),             // JSON array of ad IDs
  topic: text("topic").notNull(),
  targetProduct: varchar("targetProduct", { length: 32 }).notNull(),
  dailyBudgetPerVariant: decimal("dailyBudgetPerVariant", { precision: 10, scale: 2 }).notNull(),
  testDurationDays: int("testDurationDays").notNull().default(5),
  variantCount: int("variantCount").notNull().default(5),
  // paused | active | completed | winner_selected
  status: mysqlEnum("hat_status", ["paused", "active", "completed", "winner_selected"])
    .default("paused")
    .notNull(),
  winnerAdId: varchar("winnerAdId", { length: 64 }),
  winnerFramework: varchar("winnerFramework", { length: 64 }),
  winnerCtr: decimal("winnerCtr", { precision: 10, scale: 4 }),
  winnerCpl: decimal("winnerCpl", { precision: 10, scale: 2 }),
  promotedCampaignId: varchar("promotedCampaignId", { length: 64 }),
  createdAt: timestamp("hat_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("hat_updatedAt").defaultNow().notNull(),
});
export type HookAbTest = typeof hookAbTests.$inferSelect;
export type InsertHookAbTest = typeof hookAbTests.$inferInsert;


// ─── Lead Scrubber — 3-Tier Cold Lead Prospecting ───────────────────────────

export const leadProspectSourceEnum = mysqlEnum("lp_source", ["reddit", "youtube", "apollo"]);
export const leadProspectStatusEnum = mysqlEnum("lp_status", [
  "new",
  "engaged",
  "email_found",
  "converted",
  "archived",
]);

/** Discovered cold leads from Reddit posts/comments or YouTube comments */
export const leadProspects = mysqlTable("lead_prospects", {
  id: int("id").autoincrement().primaryKey(),
  source: leadProspectSourceEnum.notNull(),
  sourceId: varchar("sourceId", { length: 128 }).notNull().unique(), // reddit post/comment id or youtube comment id
  title: text("title"),                        // post title (reddit) or video title (youtube)
  body: text("body").notNull(),                // post body or comment text
  url: text("url").notNull(),                  // direct link to the post/comment
  author: varchar("author", { length: 128 }),  // username/handle
  subredditOrChannel: varchar("subredditOrChannel", { length: 128 }), // subreddit name or YouTube channel name
  keywordsMatched: text("keywordsMatched"),    // JSON array of matched keywords
  category: varchar("category", { length: 64 }),  // derived from keyword category (e.g. gut_health, stress)
  status: leadProspectStatusEnum.notNull().default("new"),
  notes: text("notes"),
  engagedAt: bigint("engagedAt", { mode: "number" }),
  emailFound: varchar("emailFound", { length: 320 }),
  emailConfidence: varchar("emailConfidence", { length: 32 }), // "high" | "medium" | "low"
  archivedAt: bigint("archivedAt", { mode: "number" }),
  createdAt: timestamp("lp_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("lp_updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeadProspect = typeof leadProspects.$inferSelect;
export type InsertLeadProspect = typeof leadProspects.$inferInsert;

/** Keywords to monitor across Reddit and YouTube */
export const leadKeywords = mysqlTable("lead_keywords", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 128 }).notNull().unique(),
  category: varchar("category", { length: 64 }).notNull().default("general"), // e.g. "stress", "sleep", "supplements"
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("lk_createdAt").defaultNow().notNull(),
});
export type LeadKeyword = typeof leadKeywords.$inferSelect;
export type InsertLeadKeyword = typeof leadKeywords.$inferInsert;

/** Subreddits to monitor for intent signals */
export const leadSubreddits = mysqlTable("lead_subreddits", {
  id: int("id").autoincrement().primaryKey(),
  subreddit: varchar("subreddit", { length: 128 }).notNull().unique(), // without "r/"
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("ls_createdAt").defaultNow().notNull(),
});
export type LeadSubreddit = typeof leadSubreddits.$inferSelect;
export type InsertLeadSubreddit = typeof leadSubreddits.$inferInsert;

/** YouTube channels to monitor for intent comments */
export const leadYtChannels = mysqlTable("lead_yt_channels", {
  id: int("id").autoincrement().primaryKey(),
  channelId: varchar("channelId", { length: 64 }).notNull().unique(), // YouTube channel ID (UC...)
  channelName: varchar("channelName", { length: 128 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("lyc_createdAt").defaultNow().notNull(),
});
export type LeadYtChannel = typeof leadYtChannels.$inferSelect;
export type InsertLeadYtChannel = typeof leadYtChannels.$inferInsert;

// ─── Email Sequences ──────────────────────────────────────────────────────────

export const emailSequenceStatusEnum = mysqlEnum("es_status", ["draft", "approved", "sent", "replied"]);

export const emailSequences = mysqlTable("email_sequences", {
  id: int("es_id").autoincrement().primaryKey(),
  leadId: int("es_lead_id").notNull(),
  leadName: varchar("es_lead_name", { length: 255 }),
  leadEmail: varchar("es_lead_email", { length: 255 }),
  leadCompany: varchar("es_lead_company", { length: 255 }),
  leadTitle: varchar("es_lead_title", { length: 255 }),
  category: varchar("es_category", { length: 100 }),
  email1Subject: text("es_email1_subject"),
  email1Body: longtext("es_email1_body"),
  email2Subject: text("es_email2_subject"),
  email2Body: longtext("es_email2_body"),
  email3Subject: text("es_email3_subject"),
  email3Body: longtext("es_email3_body"),
  status: mysqlEnum("es_status", ["draft", "approved", "sent", "replied"]).default("draft"),
  notes: text("es_notes"),
  kajabiPushed: boolean("es_kajabi_pushed").default(false).notNull(),
  kajabiPushError: text("es_kajabi_push_error"),
  // Funnel tag — which revenue funnel this sequence serves
  funnelId: funnelIdEnum.default("none"),
  createdAt: bigint("es_created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("es_updated_at", { mode: "number" }).notNull(),
});

// ─── QR Designs ───────────────────────────────────────────────────────────────
// Each merchandise design that has a QR code embedded in it.
// The slug maps to the landing page route (e.g. "weboflife" → /weboflife).
export const qrDesigns = mysqlTable("qr_designs", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  label: varchar("label", { length: 256 }).notNull(),
  landingPageUrl: text("landing_page_url").notNull(),
  videoUrl: text("video_url"),          // assigned after video production completes
  videoJobId: int("video_job_id"),      // FK → video_jobs.id (nullable)
  scriptText: text("script_text"),      // the 2-min script used to produce the video
  scriptTitle: varchar("script_title", { length: 256 }),
  theme: text("theme"),                 // the theme input from the QR Generator
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type QrDesign = typeof qrDesigns.$inferSelect;
export type InsertQrDesign = typeof qrDesigns.$inferInsert;

// ─── Meta Ad Push History ─────────────────────────────────────────────────────
// Tracks every time a campaign batch is pushed to Meta from the Content Hub.
export const metaAdPushes = mysqlTable("meta_ad_pushes", {
  id: int("map_id").autoincrement().primaryKey(),
  batchName: varchar("map_batch_name", { length: 256 }).notNull(),
  variantSlug: varchar("map_variant_slug", { length: 64 }).notNull(),
  adName: varchar("map_ad_name", { length: 256 }).notNull(),
  imageFile: varchar("map_image_file", { length: 256 }).notNull(),
  imageHash: varchar("map_image_hash", { length: 64 }).notNull(),
  headline: text("map_headline").notNull(),
  primaryText: longtext("map_primary_text").notNull(),
  description: text("map_description"),
  cta: varchar("map_cta", { length: 64 }).notNull().default("LEARN_MORE"),
  landingUrl: text("map_landing_url").notNull(),
  metaCampaignId: varchar("map_campaign_id", { length: 64 }),
  metaAdSetId: varchar("map_adset_id", { length: 64 }),
  metaCreativeId: varchar("map_creative_id", { length: 64 }),
  metaAdId: varchar("map_ad_id", { length: 64 }),
  status: mysqlEnum("map_status", ["pending", "pushed", "failed"]).notNull().default("pending"),
  errorMessage: text("map_error"),
  pushedAt: bigint("map_pushed_at", { mode: "number" }),
  createdAt: timestamp("map_created_at").defaultNow().notNull(),
});
export type MetaAdPush = typeof metaAdPushes.$inferSelect;
export type InsertMetaAdPush = typeof metaAdPushes.$inferInsert;

// ── Meta Custom Audiences ─────────────────────────────────────────────────────
export const metaCustomAudiences = mysqlTable("meta_custom_audiences", {
  id: int("id").autoincrement().primaryKey(),
  metaAudienceId: varchar("meta_audience_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }), // e.g. "gut_health", "sleep", "all"
  emailCount: int("email_count").notNull().default(0),
  lookalikeSeedId: varchar("lookalike_seed_id", { length: 64 }), // Meta ID of the lookalike built from this
  createdAt: timestamp("mca_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("mca_updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaCustomAudience = typeof metaCustomAudiences.$inferSelect;

export const metaAudienceLeads = mysqlTable("meta_audience_leads", {
  id: int("id").autoincrement().primaryKey(),
  audienceId: int("audience_id").notNull(), // FK to metaCustomAudiences.id
  leadProspectId: int("lead_prospect_id"),  // FK to leadProspects.id (nullable for manual uploads)
  emailHash: varchar("email_hash", { length: 64 }).notNull(), // SHA256 of email
  emailRaw: varchar("email_raw", { length: 320 }),            // stored for dedup only
  addedAt: timestamp("mal_addedAt").defaultNow().notNull(),
});
export type MetaAudienceLead = typeof metaAudienceLeads.$inferSelect;

// ── Plain-Text Email Generator ────────────────────────────────────────────────
export const plainTextEmails = mysqlTable("plain_text_emails", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  episodeTitle: varchar("episode_title", { length: 255 }),
  episodeUrl: text("episode_url"),
  episodeNumber: int("episode_number"),
  seriesName: varchar("series_name", { length: 255 }),
  keyPoints: text("key_points"),       // user-entered bullet points
  callToAction: text("call_to_action"),
  generatedText: text("generated_text").notNull(),  // final plain-text email body
  subjectLineA: varchar("subject_line_a", { length: 255 }),
  subjectLineB: varchar("subject_line_b", { length: 255 }),
  subjectLineC: varchar("subject_line_c", { length: 255 }),
  createdAt: timestamp("pte_createdAt").defaultNow().notNull(),
});
export type PlainTextEmail = typeof plainTextEmails.$inferSelect;
export type InsertPlainTextEmail = typeof plainTextEmails.$inferInsert;

// ── Apollo Sync Run Log ───────────────────────────────────────────────────────
export const apolloSyncRuns = mysqlTable("apollo_sync_runs", {
  id: int("id").autoincrement().primaryKey(),
  ranAt: bigint("ran_at", { mode: "number" }).notNull(),
  status: mysqlEnum("asr_status", ["success", "error", "partial"]).notNull(),
  totalSearched: int("total_searched").notNull().default(0),
  totalReveals: int("total_reveals").notNull().default(0),
  totalEmails: int("total_emails").notNull().default(0),
  totalMetaPushed: int("total_meta_pushed").notNull().default(0),
  elapsedMs: int("elapsed_ms").notNull().default(0),
  errorMessage: text("error_message"),
  categorySummary: text("category_summary"),
  triggeredBy: varchar("triggered_by", { length: 32 }).default("cron"),
});
export type ApolloSyncRun = typeof apolloSyncRuns.$inferSelect;
export type InsertApolloSyncRun = typeof apolloSyncRuns.$inferInsert;

// ─── Shopify Collective Sourcing ────────────────────────────────────────────
export const collectiveSourcingCandidates = mysqlTable("collective_sourcing_candidates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  vendor: varchar("vendor", { length: 256 }),
  productType: varchar("product_type", { length: 256 }),
  description: text("description"),
  price: varchar("price", { length: 64 }),
  imageUrl: text("image_url"),
  tags: text("tags"),
  supplierName: varchar("supplier_name", { length: 256 }),
  supplierDomain: varchar("supplier_domain", { length: 256 }),
  brandFitScore: int("brand_fit_score"),
  brandFitReason: text("brand_fit_reason"),
  toxicFlags: text("toxic_flags"),
  status: varchar("status", { length: 32 }).default("candidate").notNull(),
  shopifyProductId: varchar("shopify_product_id", { length: 128 }),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type CollectiveSourcingCandidate = typeof collectiveSourcingCandidates.$inferSelect;
export type InsertCollectiveSourcingCandidate = typeof collectiveSourcingCandidates.$inferInsert;

// ─── Daily Book Pull Rotation ────────────────────────────────────────────────
// Tracks which book is next in the daily rotation and the daily pull queue.
// One row per user; the rotationIndex cycles through all books in order.
export const dailyBookRotation = mysqlTable("daily_book_rotation", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  // Index into the ordered list of books for this user (wraps around)
  rotationIndex: int("rotation_index").notNull().default(0),
  // Date of the last pull (YYYY-MM-DD string) to prevent duplicate pulls on same day
  lastPullDate: varchar("last_pull_date", { length: 10 }),
  // The snippet that was selected for today's pull (null if not yet prepared)
  todaySnippetId: int("today_snippet_id"),
  // Status of today's pull: pending | cards_generating | ready | approved | posted
  todayStatus: varchar("today_status", { length: 32 }).default("pending"),
  // Which platforms the VA approved for posting (JSON array of platform strings)
  approvedPlatforms: text("approved_platforms"),
  // Timestamp when the VA clicked approve
  approvedAt: bigint("approved_at", { mode: "number" }),
  // Timestamp when Buffer push completed
  postedAt: bigint("posted_at", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type DailyBookRotation = typeof dailyBookRotation.$inferSelect;
export type InsertDailyBookRotation = typeof dailyBookRotation.$inferInsert;

// ─── VA Task Hub ─────────────────────────────────────────────────────────────
export const vaTaskCategoryEnum = mysqlEnum("va_task_category", [
  "content_distribution",
  "seo_authority",
  "community_engagement",
  "influencer_outreach",
  "professional_outreach",
  "podcast_outreach",
  "reputation",
  "video_strategy",
]);

export const vaTaskChannelEnum = mysqlEnum("va_task_channel", [
  "medium", "quora", "youtube_comments", "youtube_channel",
  "seo_blog", "ai_video", "backlink", "reddit",
  "google_reviews", "amazon_reviews", "video_testimonial", "google_business",
  "substack", "title_card", "influencer_shopify", "influencer_youtube",
  "influencer_meta", "linkedin", "podcast_guest", "podcast_host",
  "doctor_burnout", "dentist", "executive", "other",
]);

export const vaTaskStatusEnum = mysqlEnum("va_task_status", [
  "todo", "in_progress", "needs_review", "done", "blocked",
]);

export const vaTaskPriorityEnum = mysqlEnum("va_task_priority", [
  "high", "medium", "low",
]);

export const vaTasks = mysqlTable("va_tasks", {
  id: int("id").autoincrement().primaryKey(),
  category: vaTaskCategoryEnum.notNull(),
  channel: vaTaskChannelEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: vaTaskPriorityEnum.default("medium").notNull(),
  status: vaTaskStatusEnum.default("todo").notNull(),
  assignee: varchar("assignee", { length: 100 }).default("Jim").notNull(),
  dueDate: bigint("due_date", { mode: "number" }),
  aiDraft: text("ai_draft"),
  notes: text("notes"),
  publishedUrl: varchar("published_url", { length: 2048 }),
  sourceContentId: int("source_content_id"),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrenceInterval: varchar("recurrence_interval", { length: 20 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  completedAt: bigint("completed_at", { mode: "number" }),
});

export type VaTask = typeof vaTasks.$inferSelect;
export type InsertVaTask = typeof vaTasks.$inferInsert;

// ─── Kajabi Live Sessions ─────────────────────────────────────────────────────
export const kajabiLiveSessions = mysqlTable("kajabi_live_sessions", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  sessionDate: bigint("session_date", { mode: "number" }).notNull(),
  // Descript integration
  descriptProjectId: varchar("descript_project_id", { length: 255 }),
  descriptProjectUrl: varchar("descript_project_url", { length: 2048 }),
  underlordJobId: varchar("underlord_job_id", { length: 255 }),
  underlordStatus: varchar("underlord_status", { length: 50 }),
  underlordAgentResponse: text("underlord_agent_response"),
  clipsApproved: boolean("clips_approved").default(false).notNull(),
  // Social content (generated by AI after clip approval)
  sharePostInstagram: text("share_post_instagram"),
  sharePostLinkedin: text("share_post_linkedin"),
  sharePostFacebook: text("share_post_facebook"),
  memberAskText: text("member_ask_text"),
  carouselSlides: text("carousel_slides"),
  // Workflow status
  status: varchar("status", { length: 50 }).default("uploaded").notNull(),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type KajabiLiveSession = typeof kajabiLiveSessions.$inferSelect;
export type InsertKajabiLiveSession = typeof kajabiLiveSessions.$inferInsert;

// ─── Advertorial Bridge Pages ─────────────────────────────────────────────────
export const advertorialPages = mysqlTable("advertorial_pages", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  topic: varchar("topic", { length: 128 }).notNull(),
  campaign: varchar("campaign", { length: 128 }),
  status: mysqlEnum("adv_status", ["draft", "published", "archived"]).default("draft").notNull(),
  publicationName: varchar("publication_name", { length: 128 }).default("The Urban Monk Insider").notNull(),
  authorName: varchar("author_name", { length: 128 }).default("Editorial Staff").notNull(),
  readTime: varchar("read_time", { length: 32 }).default("3 min read").notNull(),
  headline: text("headline"),
  subheadline: text("subheadline"),
  mechanismAngle: text("mechanism_angle"),
  bodyHtml: text("body_html"),
  ctaText: varchar("cta_text", { length: 255 }),
  ctaSubtext: varchar("cta_subtext", { length: 512 }),
  ctaUrl: text("cta_url"),
  heroImageUrl: text("hero_image_url"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaPixelId: varchar("meta_pixel_id", { length: 64 }).default("1498608757116877"),
  ga4Id: varchar("ga4_id", { length: 64 }).default("G-CXZK2Q275S"),
  generationPrompt: text("generation_prompt"),
  generationModel: varchar("generation_model", { length: 64 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  publishedAt: bigint("published_at", { mode: "number" }),
});
export type AdvertorialPage = typeof advertorialPages.$inferSelect;
export type InsertAdvertorialPage = typeof advertorialPages.$inferInsert;

// ─── Meta Ad Variants ─────────────────────────────────────────────────────────
export const metaAdVariants = mysqlTable("meta_ad_variants", {
  id: int("id").autoincrement().primaryKey(),
  advertorialId: int("advertorial_id").notNull(),
  variantNumber: int("variant_number").notNull(), // 1–5
  // Ad copy
  primaryText: text("primary_text").notNull(),
  headline: varchar("headline", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }),
  callToAction: varchar("call_to_action", { length: 64 }).default("Learn More").notNull(),
  // Image
  imagePrompt: text("image_prompt"),
  imageUrl: text("image_url"),
  // Targeting notes
  audienceNote: text("audience_note"),
  // Status
  status: mysqlEnum("status", ["draft", "approved", "running", "paused", "archived"]).default("draft").notNull(),
  // Meta push tracking
  imageHash: varchar("image_hash", { length: 64 }),
  metaCampaignId: varchar("meta_campaign_id", { length: 64 }),
  metaAdSetId: varchar("meta_ad_set_id", { length: 64 }),
  metaCreativeId: varchar("meta_creative_id", { length: 64 }),
  metaAdId: varchar("meta_ad_id", { length: 64 }),
  metaPushError: text("meta_push_error"),
  metaPushedAt: bigint("meta_pushed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type MetaAdVariant = typeof metaAdVariants.$inferSelect;
export type InsertMetaAdVariant = typeof metaAdVariants.$inferInsert;


// ── Ad Attribution Tables ─────────────────────────────────────────────────────
// Captures UTM + fbclid data when a visitor clicks through from an ad to a
// bridge page, then matches that click to a Shopify order via the order webhook.

export const adClicks = mysqlTable("ad_clicks", {
  id: int("id").autoincrement().primaryKey(),
  clickToken: varchar("click_token", { length: 64 }).notNull().unique(),
  utmSource: varchar("utm_source", { length: 128 }),
  utmMedium: varchar("utm_medium", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  utmContent: varchar("utm_content", { length: 255 }),
  utmTerm: varchar("utm_term", { length: 255 }),
  fbclid: varchar("fbclid", { length: 512 }),
  advertorialSlug: varchar("advertorial_slug", { length: 255 }),
  advertorialId: int("advertorial_id"),
  userAgent: text("user_agent"),
  ipHash: varchar("ip_hash", { length: 64 }),
  clickedAt: bigint("clicked_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});

export type AdClick = typeof adClicks.$inferSelect;
export type InsertAdClick = typeof adClicks.$inferInsert;

export const attributedSales = mysqlTable("attributed_sales", {
  id: int("id").autoincrement().primaryKey(),
  shopifyOrderId: varchar("shopify_order_id", { length: 64 }).notNull().unique(),
  shopifyOrderNumber: varchar("shopify_order_number", { length: 32 }),
  orderTotal: int("order_total").notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  customerEmail: varchar("customer_email", { length: 320 }),
  customerName: varchar("customer_name", { length: 255 }),
  lineItems: text("line_items"),
  clickToken: varchar("click_token", { length: 64 }),
  utmSource: varchar("utm_source", { length: 128 }),
  utmMedium: varchar("utm_medium", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  utmContent: varchar("utm_content", { length: 255 }),
  fbclid: varchar("fbclid", { length: 512 }),
  advertorialSlug: varchar("advertorial_slug", { length: 255 }),
  attributionType: mysqlEnum("attribution_type", ["direct", "probabilistic", "unattributed"]).default("unattributed").notNull(),
  capiEventSent: boolean("capi_event_sent").default(false).notNull(),
  capiEventId: varchar("capi_event_id", { length: 128 }),
  capiSentAt: bigint("capi_sent_at", { mode: "number" }),
  orderCreatedAt: bigint("order_created_at", { mode: "number" }),
  receivedAt: bigint("received_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

export type AttributedSale = typeof attributedSales.$inferSelect;
export type InsertAttributedSale = typeof attributedSales.$inferInsert;

// ─── YouTube Pipeline (Operations Bible) ─────────────────────────────────────
export const youtubePipelineVideos = mysqlTable("youtube_pipeline_videos", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  videoId: varchar("video_id", { length: 64 }),
  pillar: mysqlEnum("yt_pillar", [
    "gut_health_metabolism",
    "nervous_system_stress",
    "consciousness_longevity",
    "web_of_life",
    "the_practice",
  ]).notNull(),
  primaryKeyword: varchar("primary_keyword", { length: 256 }),
  status: mysqlEnum("yt_status", [
    "scripting",
    "qc_scoring",
    "scheduled",
    "live",
    "day7_review",
    "day30_review",
    "reviewed",
  ]).notNull().default("scripting"),
  publishDate: bigint("publish_date", { mode: "number" }),
  preTitleScore: int("pre_title_score"),
  preThumbnailScore: int("pre_thumbnail_score"),
  day7Ctr: float("day7_ctr"),
  day7Impressions: int("day7_impressions"),
  day7AvgViewPct: float("day7_avg_view_pct"),
  day7Diagnosis: mysqlEnum("day7_diagnosis", [
    "thumbnail_title_problem",
    "hook_retention_problem",
    "discoverability_problem",
    "marginal_underperformer",
    "outperforming",
    "on_track",
    "pending",
  ]).default("pending"),
  day30BreakoutScore: float("day30_breakout_score"),
  day30Ctr: float("day30_ctr"),
  day30AvgViewPct: float("day30_avg_view_pct"),
  day30Impressions: int("day30_impressions"),
  day30SearchPct: float("day30_search_pct"),
  day30Diagnosis: mysqlEnum("day30_diagnosis", [
    "thumbnail_title_problem",
    "hook_retention_problem",
    "discoverability_problem",
    "marginal_underperformer",
    "outperforming",
    "on_track",
    "pending",
  ]).default("pending"),
  prescribedAction: text("prescribed_action"),
  actionApplied: boolean("action_applied").default(false).notNull(),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type YoutubePipelineVideo = typeof youtubePipelineVideos.$inferSelect;
export type InsertYoutubePipelineVideo = typeof youtubePipelineVideos.$inferInsert;


// ─── Reddit Persona Manager ───────────────────────────────────────────────────

export const redditPersonaPhaseEnum = mysqlEnum("redditPersonaPhase", [
  "warmup",      // Days 1-30: building karma, no link posts
  "active",      // Day 31+: cleared to share Urban Monk content
  "paused",      // Temporarily paused
  "retired",     // Account retired / banned
]);

export const redditPersonas = mysqlTable("reddit_personas", {
  id: int("id").autoincrement().primaryKey(),
  vaName: varchar("va_name", { length: 100 }).notNull(),          // e.g. "Maria", "Jose", "Ana"
  accountSlot: int("account_slot").notNull().default(1),           // 1 or 2 (each VA has 2 accounts)
  username: varchar("username", { length: 100 }).notNull(),        // Reddit username
  personaEmail: varchar("persona_email", { length: 255 }),           // e.g. maria@mariawellness.com (owned by Pedram)
  personaDomain: varchar("persona_domain", { length: 255 }),         // e.g. mariawellness.com
  proxyIp: varchar("proxy_ip", { length: 100 }),                     // Residential proxy IP assigned to this persona
  credentialsHeldBy: mysqlEnum("credentials_held_by", ["owner", "va"]).notNull().default("owner"), // owner = Pedram holds email pw; va = VA holds it (insecure)
  backstory: text("backstory"),                                    // AI-generated persona backstory
  bio: text("bio"),                                                // Profile bio text for Reddit
  phase: redditPersonaPhaseEnum.notNull().default("warmup"),
  karma: int("karma").notNull().default(0),
  postKarma: int("post_karma").notNull().default(0),
  commentKarma: int("comment_karma").notNull().default(0),
  accountCreatedAt: bigint("account_created_at", { mode: "number" }), // When the Reddit account was created
  subreddits: text("subreddits"),                                  // JSON array of subscribed subreddits
  lastActivityAt: bigint("last_activity_at", { mode: "number" }),
  activatedAt: bigint("activated_at", { mode: "number" }),         // When phase moved to "active"
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type RedditPersona = typeof redditPersonas.$inferSelect;
export type InsertRedditPersona = typeof redditPersonas.$inferInsert;

export const redditWarmupTaskStatusEnum = mysqlEnum("redditWarmupTaskStatus", [
  "pending",
  "completed",
  "skipped",
]);

export const redditWarmupTaskTypeEnum = mysqlEnum("redditWarmupTaskType", [
  "upvote_session",    // Upvote 20-30 posts in target subreddits
  "comment",          // Post a genuine helpful comment
  "question_post",    // Post a question (no links)
  "non_um_share",     // Share a non-Urban Monk article
]);

export const redditWarmupTasks = mysqlTable("reddit_warmup_tasks", {
  id: int("id").autoincrement().primaryKey(),
  personaId: int("persona_id").notNull().references(() => redditPersonas.id),
  taskType: redditWarmupTaskTypeEnum.notNull(),
  subreddit: varchar("subreddit", { length: 100 }).notNull(),
  content: text("content"),                                        // AI-generated comment/post text
  instructions: text("instructions"),                              // Step-by-step instructions for VA
  scheduledFor: bigint("scheduled_for", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  status: redditWarmupTaskStatusEnum.notNull().default("pending"),
  dayNumber: int("day_number").notNull().default(1),               // Day 1-30 of warmup
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type RedditWarmupTask = typeof redditWarmupTasks.$inferSelect;
export type InsertRedditWarmupTask = typeof redditWarmupTasks.$inferInsert;

export const redditPostQueueStatusEnum = mysqlEnum("redditPostQueueStatus", [
  "queued",
  "ready",       // Cleared to post (karma threshold + cadence check passed)
  "posted",
  "failed",
  "skipped",
]);

export const redditPostQueue = mysqlTable("reddit_post_queue", {
  id: int("id").autoincrement().primaryKey(),
  personaId: int("persona_id").notNull().references(() => redditPersonas.id),
  contentItemId: int("content_item_id").references(() => contentItems.id),
  subreddit: varchar("subreddit", { length: 100 }).notNull(),
  postTitle: varchar("post_title", { length: 300 }).notNull(),
  postBody: text("post_body").notNull(),                           // Full post with personal framing + disclosure
  linkUrl: varchar("link_url", { length: 500 }),                  // Urban Monk article URL (if link post)
  disclosureText: text("disclosure_text"),                         // FTC disclosure appended to post
  personalFraming: text("personal_framing"),                       // AI-generated personal intro ("I've been following...")
  scheduledFor: bigint("scheduled_for", { mode: "number" }),
  postedAt: bigint("posted_at", { mode: "number" }),
  redditPostUrl: varchar("reddit_post_url", { length: 500 }),
  status: redditPostQueueStatusEnum.notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type RedditPostQueueItem = typeof redditPostQueue.$inferSelect;
export type InsertRedditPostQueueItem = typeof redditPostQueue.$inferInsert;

// ─── Reddit ROAS Attribution ──────────────────────────────────────────────────
// Tracks Reddit campaigns (RedRover or in-house VA), individual posts, and
// Shopify order conversions attributed to Reddit traffic via UTM parameters.

export const redditCampaignSourceEnum = mysqlEnum("redditCampaignSource", [
  "redrover",   // Managed by RedRover agency
  "va",         // In-house VA accounts
  "pedram",     // Pedram's own u/PedramShojai account
]);

export const redditCampaigns = mysqlTable("reddit_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  source: redditCampaignSourceEnum.notNull().default("va"),
  // Target SKU / product being promoted
  skuLabel: varchar("skuLabel", { length: 255 }),
  shopifyProductId: varchar("shopifyProductId", { length: 128 }),
  // Monthly spend for this campaign (in cents)
  monthlySpendCents: int("monthlySpendCents").default(0),
  // UTM campaign slug — used in all links for this campaign
  utmCampaign: varchar("utmCampaign", { length: 128 }).notNull(),
  // Date range
  startDate: bigint("startDate", { mode: "number" }),
  endDate: bigint("endDate", { mode: "number" }),
  active: boolean("active").default(true),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RedditCampaign = typeof redditCampaigns.$inferSelect;
export type InsertRedditCampaign = typeof redditCampaigns.$inferInsert;

export const redditLinks = mysqlTable("reddit_links", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  // The Reddit post URL
  redditPostUrl: text("redditPostUrl"),
  // Subreddit (e.g. "r/GutHealth")
  subreddit: varchar("subreddit", { length: 128 }),
  // The destination URL with UTM params embedded
  destinationUrl: text("destinationUrl").notNull(),
  // UTM breakdown
  utmSource: varchar("utmSource", { length: 128 }).default("reddit"),
  utmMedium: varchar("utmMedium", { length: 128 }).default("organic"),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  utmContent: varchar("utmContent", { length: 255 }),  // post ID / slug
  utmTerm: varchar("utmTerm", { length: 255 }),
  // Post type: question | comment | direct_post
  postType: mysqlEnum("postType", ["question", "comment", "direct_post"]).default("direct_post"),
  // Posted by which account
  postedBy: varchar("postedBy", { length: 128 }),
  // Post date
  postedAt: bigint("postedAt", { mode: "number" }),
  // Engagement metrics (manually updated or from RedRover report)
  upvotes: int("upvotes").default(0),
  comments: int("comments").default(0),
  // Computed: total revenue attributed to this link
  revenueAttributedCents: int("revenueAttributedCents").default(0),
  conversionCount: int("conversionCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RedditLink = typeof redditLinks.$inferSelect;
export type InsertRedditLink = typeof redditLinks.$inferInsert;

export const redditConversions = mysqlTable("reddit_conversions", {
  id: int("id").autoincrement().primaryKey(),
  linkId: int("linkId").notNull(),
  campaignId: int("campaignId").notNull(),
  // Shopify order details
  shopifyOrderId: varchar("shopifyOrderId", { length: 128 }).notNull().unique(),
  shopifyOrderNumber: varchar("shopifyOrderNumber", { length: 64 }),
  orderTotalCents: int("orderTotalCents").notNull(),
  currency: varchar("currency", { length: 8 }).default("USD"),
  customerEmail: varchar("customerEmail", { length: 320 }),
  lineItems: text("lineItems"),  // JSON
  // UTM params from the order's landing site
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  utmContent: varchar("utmContent", { length: 255 }),
  // Attribution confidence
  attributionType: mysqlEnum("redditAttributionType", ["direct", "probabilistic", "manual"]).default("direct"),
  orderCreatedAt: bigint("orderCreatedAt", { mode: "number" }),
  receivedAt: bigint("receivedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RedditConversion = typeof redditConversions.$inferSelect;
export type InsertRedditConversion = typeof redditConversions.$inferInsert;


// ─── Ascension Pipeline ───────────────────────────────────────────────────────
// Tracks Lights On members through the ascension ladder:
//   lights_on ($369/yr recurring) → retreat_eligible → retreat_registered → lapsed
//
// Pricing constants (authoritative source of truth):
//   LIGHTS_ON_ANNUAL_CENTS = 36900  ($369/yr)
//   RETREAT_EARLY_BIRD_CENTS = 85000  ($850 early bird)
//   RETREAT_STANDARD_CENTS = 125000  ($1,250 standard)
//   RETREATS_PER_YEAR = 2
//   RETREAT_MIN_CAPACITY = 100

export const ascensionMembers = mysqlTable("ascension_members", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  kajabiContactId: varchar("kajabi_contact_id", { length: 128 }),
  stage: mysqlEnum("ascension_stage", [
    "lights_on",
    "retreat_eligible",
    "retreat_registered",
    "lapsed",
  ]).notNull().default("lights_on"),
  avatarType: mysqlEnum("avatar_type", [
    "dismissed_patient",
    "high_performer_decline",
    "awakening_seeker",
    "supplement_graveyard",
  ]),
  lightsOnStartDate: bigint("lights_on_start_date", { mode: "number" }),
  renewalDueDate: bigint("renewal_due_date", { mode: "number" }),
  renewalReminderSentAt: bigint("renewal_reminder_sent_at", { mode: "number" }),
  totalPaidCents: int("total_paid_cents").notNull().default(0),
  renewalCount: int("renewal_count").notNull().default(0),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type AscensionMember = typeof ascensionMembers.$inferSelect;
export type InsertAscensionMember = typeof ascensionMembers.$inferInsert;

export const retreatEvents = mysqlTable("retreat_events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  location: varchar("location", { length: 512 }),
  eventDate: bigint("event_date", { mode: "number" }).notNull(),
  earlyBirdDeadline: bigint("early_bird_deadline", { mode: "number" }),
  earlyBirdPriceCents: int("early_bird_price_cents").notNull().default(85000),
  standardPriceCents: int("standard_price_cents").notNull().default(125000),
  capacityMax: int("capacity_max").notNull().default(100),
  registeredCount: int("registered_count").notNull().default(0),
  status: mysqlEnum("retreat_status", ["upcoming", "open", "early_bird", "closed", "completed"]).notNull().default("upcoming"),
  description: text("description"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type RetreatEvent = typeof retreatEvents.$inferSelect;
export type InsertRetreatEvent = typeof retreatEvents.$inferInsert;

export const retreatRegistrations = mysqlTable("retreat_registrations", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull(),
  retreatId: int("retreat_id").notNull(),
  pricePaidCents: int("price_paid_cents").notNull(),
  priceType: mysqlEnum("price_type", ["early_bird", "standard"]).notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "paid", "refunded"]).notNull().default("pending"),
  registeredAt: bigint("registered_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type RetreatRegistration = typeof retreatRegistrations.$inferSelect;
export type InsertRetreatRegistration = typeof retreatRegistrations.$inferInsert;

// ─── Diagnostic Quiz Funnel ───────────────────────────────────────────────────
// Five-question quiz that assigns visitors to one of four avatar types,
// gates results behind email capture, and fires a Kajabi tag.

export const quizResponses = mysqlTable("quiz_responses", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: varchar("name", { length: 255 }),
  avatarType: mysqlEnum("quiz_avatar_type", [
    "dismissed_patient",
    "high_performer_decline",
    "awakening_seeker",
    "supplement_graveyard",
  ]),
  answers: text("answers"), // JSON: { q1: 'a', q2: 'b', ... }
  scores: text("scores"),   // JSON: { dismissed_patient: 3, high_performer_decline: 1, ... }
  completedAt: bigint("completed_at", { mode: "number" }),
  emailCapturedAt: bigint("email_captured_at", { mode: "number" }),
  kajabiTagged: boolean("kajabi_tagged").default(false).notNull(),
  kajabiTaggedAt: bigint("kajabi_tagged_at", { mode: "number" }),
  downstreamPurchase: boolean("downstream_purchase").default(false).notNull(),
  utmSource: varchar("utm_source", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type QuizResponse = typeof quizResponses.$inferSelect;
export type InsertQuizResponse = typeof quizResponses.$inferInsert;

// ─── A/B Testing (Rec 8 — Fable Five Audit) ──────────────────────────────────

export const abTests = mysqlTable("ab_tests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pageUrl: varchar("page_url", { length: 500 }),
  status: mysqlEnum("status", ["draft", "running", "paused", "concluded"])
    .notNull()
    .default("draft"),
  minExposures: int("min_exposures").notNull().default(300),
  significanceThreshold: decimal("significance_threshold", { precision: 5, scale: 4 })
    .notNull()
    .default("0.9500"),
  winnerVariantId: int("winner_variant_id"),
  startedAt: bigint("started_at", { mode: "number" }),
  concludedAt: bigint("concluded_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type AbTest = typeof abTests.$inferSelect;
export type InsertAbTest = typeof abTests.$inferInsert;

export const abVariants = mysqlTable("ab_variants", {
  id: int("id").autoincrement().primaryKey(),
  testId: int("test_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isControl: boolean("is_control").notNull().default(false),
  weight: int("weight").notNull().default(50),
  headline: text("headline"),
  ctaText: varchar("cta_text", { length: 255 }),
  pageContent: text("page_content"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type AbVariant = typeof abVariants.$inferSelect;
export type InsertAbVariant = typeof abVariants.$inferInsert;

export const abExposures = mysqlTable("ab_exposures", {
  id: int("id").autoincrement().primaryKey(),
  testId: int("test_id").notNull(),
  variantId: int("variant_id").notNull(),
  visitorId: varchar("visitor_id", { length: 128 }).notNull(),
  sessionId: varchar("session_id", { length: 128 }),
  utmSource: varchar("utm_source", { length: 255 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  exposedAt: bigint("exposed_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type AbExposure = typeof abExposures.$inferSelect;
export type InsertAbExposure = typeof abExposures.$inferInsert;

export const abConversions = mysqlTable("ab_conversions", {
  id: int("id").autoincrement().primaryKey(),
  testId: int("test_id").notNull(),
  variantId: int("variant_id").notNull(),
  visitorId: varchar("visitor_id", { length: 128 }).notNull(),
  conversionType: mysqlEnum("conversion_type", [
    "purchase",
    "email_capture",
    "quiz_start",
    "checkout_start",
    "custom",
  ])
    .notNull()
    .default("purchase"),
  revenueCents: int("revenue_cents"),
  convertedAt: bigint("converted_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type AbConversion = typeof abConversions.$inferSelect;
export type InsertAbConversion = typeof abConversions.$inferInsert;


// ─── Claims Review Gate ───────────────────────────────────────────────────────
export const claimsReviews = mysqlTable("claims_reviews", {
  id: int("id").autoincrement().primaryKey(),
  contentType: mysqlEnum("cr_content_type", [
    "wordpress_post",
    "meta_ad",
    "advertorial",
    "email_sequence",
    "landing_page",
    "other",
  ]).notNull(),
  contentId: varchar("content_id", { length: 255 }),
  contentTitle: varchar("content_title", { length: 512 }),
  contentText: text("content_text").notNull(),
  verdicts: json("verdicts").notNull().$type<Array<{
    ruleId: string;
    ruleName: string;
    passed: boolean;
    flaggedText: string | null;
    explanation: string;
  }>>(),
  overallFlag: tinyint("overall_flag").notNull().default(0),
  flagCount: int("flag_count").notNull().default(0),
  status: mysqlEnum("cr_status", ["pending", "approved", "rejected", "auto_approved"])
    .notNull()
    .default("pending"),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  reviewerNote: text("reviewer_note"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type ClaimsReview = typeof claimsReviews.$inferSelect;
export type InsertClaimsReview = typeof claimsReviews.$inferInsert;


// ─── YouTube Analytics Snapshots ─────────────────────────────────────────────
// Stores daily/on-demand metric snapshots per video from the YouTube Analytics API.
// Separate from youtubePipelineVideos (which tracks production workflow).
export const ytVideoSnapshots = mysqlTable("yt_video_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("video_id", { length: 64 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  publishedAt: bigint("published_at", { mode: "number" }),
  thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
  // YouTube Analytics API metrics
  views: int("views").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  impressions: int("impressions").default(0),
  thumbnailCtr: float("thumbnail_ctr"),           // impressionClickThroughRate (%)
  avgViewDurationSec: int("avg_view_duration_sec"), // averageViewDuration (seconds)
  avgViewPct: float("avg_view_pct"),               // averageViewPercentage (%)
  estimatedMinutesWatched: int("estimated_minutes_watched"),
  // VidIQ score (fetched separately)
  vidiqScore: int("vidiq_score"),
  vidiqScoreUpdatedAt: bigint("vidiq_score_updated_at", { mode: "number" }),
  // Snapshot metadata
  snapshotDate: varchar("snapshot_date", { length: 10 }).notNull(), // YYYY-MM-DD
  snapshotAt: bigint("snapshot_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type YtVideoSnapshot = typeof ytVideoSnapshots.$inferSelect;
export type InsertYtVideoSnapshot = typeof ytVideoSnapshots.$inferInsert;

// ─── YouTube Comments ─────────────────────────────────────────────────────────
// Stores top-level comments pulled from the YouTube Data API for Pedram's videos.
export const ytComments = mysqlTable("yt_comments", {
  id: int("id").autoincrement().primaryKey(),
  commentId: varchar("comment_id", { length: 128 }).notNull().unique(),
  videoId: varchar("video_id", { length: 64 }).notNull(),
  videoTitle: varchar("video_title", { length: 512 }),
  authorName: varchar("author_name", { length: 256 }),
  authorProfileImageUrl: varchar("author_profile_image_url", { length: 1024 }),
  text: text("text").notNull(),
  likeCount: int("like_count").default(0),
  publishedAt: bigint("published_at", { mode: "number" }),
  // Reply tracking
  replyStatus: mysqlEnum("yt_comment_reply_status", ["unread", "read", "replied", "ignored"])
    .notNull()
    .default("unread"),
  replyText: text("reply_text"),
  repliedAt: bigint("replied_at", { mode: "number" }),
  // AI-suggested reply (stored for review before posting)
  aiSuggestedReply: text("ai_suggested_reply"),
  fetchedAt: bigint("fetched_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type YtComment = typeof ytComments.$inferSelect;
export type InsertYtComment = typeof ytComments.$inferInsert;

// ─── Headline Generations ─────────────────────────────────────────────────────
// Stores headline/title variant sets generated for YouTube videos.
export const ytHeadlineGenerations = mysqlTable("yt_headline_generations", {
  id: int("id").autoincrement().primaryKey(),
  topic: varchar("topic", { length: 512 }).notNull(),
  pillar: varchar("pillar", { length: 128 }),
  // JSON array of 5 headline objects: { title, hook, rationale }
  headlines: json("headlines").notNull().$type<Array<{
    title: string;
    hook: string;
    rationale: string;
    estimatedCtrTier: "high" | "medium" | "low";
  }>>(),
  // JSON array of 5 thumbnail concept objects (parallel to headlines)
  thumbnailConcepts: json("thumbnail_concepts").$type<Array<{
    layout: string;
    textOverlay: string;
    background: string;
    focalElement: string;
    colorMood: string;
    productionNotes: string;
  }>>()
    ,
  selectedTitle: varchar("selected_title", { length: 512 }),
  linkedScriptId: int("linked_script_id"),
  linkedPipelineVideoId: int("linked_pipeline_video_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type YtHeadlineGeneration = typeof ytHeadlineGenerations.$inferSelect;
export type InsertYtHeadlineGeneration = typeof ytHeadlineGenerations.$inferInsert;

// ─── Three-Funnel Command Dashboard ──────────────────────────────────────────
// Tracks manual stage-entry events for the three funnels:
//   lights_on, upstream, web_of_life
// Each row = one visitor/lead entering a funnel stage.
export const funnelEvents = mysqlTable("funnel_events", {
  id: int("id").autoincrement().primaryKey(),
  funnel: varchar("funnel", { length: 64 }).notNull(), // 'lights_on' | 'upstream' | 'web_of_life'
  stage: varchar("stage", { length: 64 }).notNull(),   // e.g. 'lead','optin','quiz','offer','purchase'
  count: int("count").notNull().default(1),
  revenueUsd: int("revenue_usd").notNull().default(0), // cents
  utmSource: varchar("utm_source", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 128 }),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  weekStart: bigint("week_start", { mode: "number" }),
  notes: text("notes"),
});
export type FunnelEvent = typeof funnelEvents.$inferSelect;
export type InsertFunnelEvent = typeof funnelEvents.$inferInsert;

// Monthly cohort take-rate tracking
export const funnelCohorts = mysqlTable("funnel_cohorts", {
  id: int("id").autoincrement().primaryKey(),
  funnel: varchar("funnel", { length: 64 }).notNull(),
  cohortMonth: varchar("cohort_month", { length: 7 }).notNull(), // 'YYYY-MM'
  leadsEntered: int("leads_entered").notNull().default(0),
  purchasedAt30d: int("purchased_at_30d").notNull().default(0),
  purchasedAt60d: int("purchased_at_60d").notNull().default(0),
  purchasedAt90d: int("purchased_at_90d").notNull().default(0),
  revenueUsd: int("revenue_usd").notNull().default(0), // cents
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type FunnelCohort = typeof funnelCohorts.$inferSelect;
export type InsertFunnelCohort = typeof funnelCohorts.$inferInsert;

// ─── Analog Data Library ──────────────────────────────────────────────────────
// Keith's "Analyze" section — corpus seed for the Transcript Intelligence Engine.
// CRITICAL QUALITY GATE: Only CONVERTING content goes in here.
// Winning ads, converting sales pages, real customer interview transcripts, survey data.
// NOT aspirational or untested content.

export const analogDataTypeEnum = mysqlEnum("analogDataType", [
  "sales_page",
  "facebook_ad",
  "customer_interview",
  "text_survey",
  "vsl_script",
  "email_sequence",
  "other",
]);

export const analogDataEntries = mysqlTable("analog_data_entries", {
  id: int("id").autoincrement().primaryKey(),
  // Title — nullable; AI auto-generates if left blank on input
  title: varchar("title", { length: 255 }),
  // Type of converting content — column name MUST be "type" to match DB
  type: mysqlEnum("type", [
    "sales_page",
    "facebook_ad",
    "customer_interview",
    "text_survey",
    "vsl_script",
    "email_sequence",
    "other",
  ]).notNull().default("other"),
  // Tags — JSON array of string labels (e.g. ["gut_health", "Q1_2026", "cold_traffic"])
  tags: text("tags"),
  // FK → personas.id (nullable — can be unassigned or assigned to multiple)
  personaId: int("personaId"),
  // The raw pasted content (sales page copy, ad copy, interview transcript, survey data, etc.)
  content: mediumtext("content").notNull(),
  // AI-extracted insights: patterns, hooks, objections, proof structures (JSON)
  extractedInsights: text("extractedInsights"),
  // Whether this entry has been added to the corpus for the Script Factory
  inCorpus: boolean("inCorpus").default(false).notNull(),
  createdAt: timestamp("ad_createdAt").defaultNow().notNull(),
  updatedAt: timestamp("ad_updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnalogDataEntry = typeof analogDataEntries.$inferSelect;
export type InsertAnalogDataEntry = typeof analogDataEntries.$inferInsert;

// ─── Transcript Intelligence Engine — Phase A ────────────────────────────────

/**
 * Daily quota ledger for Supadata API calls.
 * Enforces 25 calls/day cap before every fetch.
 */
export const ytQuotaLedger = mysqlTable("yt_quota_ledger", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  unitsUsed: int("units_used").notNull().default(0),
  dailyLimit: int("daily_limit").notNull().default(25),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type YtQuotaLedger = typeof ytQuotaLedger.$inferSelect;
export type InsertYtQuotaLedger = typeof ytQuotaLedger.$inferInsert;

/**
 * Stores fetched YouTube transcripts (via Supadata or manual paste).
 */
export const ytTranscripts = mysqlTable("yt_transcripts", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("video_id", { length: 64 }).notNull().unique(),
  channelId: varchar("channel_id", { length: 64 }).notNull(),
  videoTitle: varchar("video_title", { length: 512 }),
  publishedAt: datetime("published_at"),
  fetchedAt: datetime("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  provider: varchar("provider", { length: 32 }).notNull().default("supadata"),
  lang: varchar("lang", { length: 16 }).default("en"),
  rawText: mediumtext("raw_text"),
  wordCount: int("word_count").default(0),
  status: mysqlEnum("transcript_status", ["pending", "fetched", "no_transcript", "error"]).notNull().default("pending"),
  errorMessage: varchar("error_message", { length: 512 }),
  createdAt: datetime("tr_created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("tr_updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type YtTranscript = typeof ytTranscripts.$inferSelect;
export type InsertYtTranscript = typeof ytTranscripts.$inferInsert;

// ─── Transcript Intelligence Engine — Phase B: Outlier Detector ──────────────────

/**
 * Per-video outlier scores vs the channel's rolling 90-day baseline.
 * Populated by outlierRouter.scoreVideo / scoreAll.
 */
export const ytVideoOutliers = mysqlTable("yt_video_outliers", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("video_id", { length: 64 }).notNull().unique(),
  videoTitle: varchar("video_title", { length: 512 }),
  publishedAt: datetime("published_at"),
  ctrScore: float("ctr_score"),
  retentionScore: float("retention_score"),
  views: int("views").default(0),
  avgViewDurationSec: int("avg_view_duration_sec").default(0),
  videoDurationSec: int("video_duration_sec").default(0),
  impressions: int("impressions").default(0),
  outlierScore: float("outlier_score"),
  ctrZScore: float("ctr_z_score"),
  retentionZScore: float("retention_z_score"),
  isOutlier: tinyint("is_outlier").notNull().default(0),
  baselineCtr: float("baseline_ctr"),
  baselineRetention: float("baseline_retention"),
  baselineCtrStddev: float("baseline_ctr_stddev"),
  baselineRetentionStddev: float("baseline_retention_stddev"),
  scoredAt: datetime("scored_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: datetime("outlier_created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("outlier_updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type YtVideoOutlier = typeof ytVideoOutliers.$inferSelect;
export type InsertYtVideoOutlier = typeof ytVideoOutliers.$inferInsert;

// ─── Transcript Intelligence Engine — Phase C: Corpus Builder ─────────────────

export const corpusSourceTypeEnum = mysqlEnum("source_type", ["transcript", "analog_data", "manual"]);

/**
 * Corpus entries: verified, converting content used to ground the Script Factory.
 * Embeddings stored as VECTOR(1536) for TiDB cosine similarity search.
 */
export const corpusEntries = mysqlTable("corpus_entries", {
  id: int("id").autoincrement().primaryKey(),
  sourceType: mysqlEnum("source_type", ["transcript", "analog_data", "manual"]).notNull().default("manual"),
  sourceId: varchar("source_id", { length: 128 }),
  title: varchar("title", { length: 512 }),
  content: mediumtext("content").notNull(),
  contentChunk: mediumtext("content_chunk"),
  // embedding stored as JSON string (TiDB VECTOR type not in Drizzle ORM yet)
  embedding: text("embedding"),
  tags: json("tags").$type<string[]>(),
  personaId: int("persona_id"),
  wordCount: int("word_count").default(0),
  inCorpus: tinyint("in_corpus").notNull().default(1),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type CorpusEntry = typeof corpusEntries.$inferSelect;
export type InsertCorpusEntry = typeof corpusEntries.$inferInsert;

// ─── Transcript Intelligence Engine — Phase D: Pattern Extractor ───────────────

export const patternTypeEnum = mysqlEnum("pattern_type", [
  "hook", "pain_point", "proof_element", "objection_handler",
  "cta", "story_structure", "key_phrase", "transformation_arc",
  "authority_signal", "social_proof", "open_loop", "other",
]);

/**
 * Content patterns mined from outlier transcripts and analog data.
 * Used to ground the Script Factory with proven, converting language.
 */
export const contentPatterns = mysqlTable("content_patterns", {
  id: int("id").autoincrement().primaryKey(),
  sourceCorpusId: int("source_corpus_id"),
  sourceVideoId: varchar("source_video_id", { length: 128 }),
  patternType: mysqlEnum("pattern_type", [
    "hook", "pain_point", "proof_element", "objection_handler",
    "cta", "story_structure", "key_phrase", "transformation_arc",
    "authority_signal", "social_proof", "open_loop", "other",
  ]).notNull().default("other"),
  patternText: text("pattern_text").notNull(),
  patternContext: text("pattern_context"),
  effectivenessScore: float("effectiveness_score"),
  usageCount: int("usage_count").notNull().default(0),
  lastUsedAt: datetime("last_used_at"),
  tags: json("tags").$type<string[]>(),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ContentPattern = typeof contentPatterns.$inferSelect;
export type InsertContentPattern = typeof contentPatterns.$inferInsert;

// ─── Transcript Intelligence Engine — Phase E: Script Factory ───────────────

/**
 * Script Factory outputs — corpus-grounded scripts with [VERIFIED] tags.
 */
export const scriptFactoryOutputs = mysqlTable("script_factory_outputs", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  topic: text("topic").notNull(),
  format: mysqlEnum("format", [
    "youtube_script", "short_form", "email", "ad_copy", "sales_page_section", "podcast_outline",
  ]).notNull().default("youtube_script"),
  scriptBody: longtext("script_body").notNull(),
  verifiedPatternIds: json("verified_pattern_ids").$type<number[]>(),
  corpusEntryIds: json("corpus_entry_ids").$type<number[]>(),
  verifiedCount: int("verified_count").notNull().default(0),
  totalElements: int("total_elements").notNull().default(0),
  verificationPct: float("verification_pct"),
  status: mysqlEnum("status", ["draft", "approved", "archived"]).notNull().default("draft"),
  notes: text("notes"),
  approvedAt: datetime("approved_at"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ScriptFactoryOutput = typeof scriptFactoryOutputs.$inferSelect;
export type InsertScriptFactoryOutput = typeof scriptFactoryOutputs.$inferInsert;

// ─── Transcript Intelligence Engine — Phase F: Performance Loop ─────────────

/**
 * 90-day performance feedback for scripts — closes the loop.
 */
export const scriptPerformanceFeedback = mysqlTable("script_performance_feedback", {
  id: int("id").autoincrement().primaryKey(),
  scriptId: int("script_id").notNull(),
  videoId: varchar("video_id", { length: 50 }),
  feedbackDate: date("feedback_date").notNull(),
  ctrPct: float("ctr_pct"),
  avgViewDurationPct: float("avg_view_duration_pct"),
  views: int("views"),
  likes: int("likes"),
  comments: int("comments"),
  outlierScore: float("outlier_score"),
  notes: text("notes"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ScriptPerformanceFeedback = typeof scriptPerformanceFeedback.$inferSelect;
export type InsertScriptPerformanceFeedback = typeof scriptPerformanceFeedback.$inferInsert;

// ─── Substack Inbox ───────────────────────────────────────────────────────────
// Stores comments and replies polled from Substack posts so the VA team can
// respond without flooding Pedram's personal email inbox.
export const substackInboxItems = mysqlTable("substack_inbox_items", {
  id: int("id").autoincrement().primaryKey(),
  /** Substack internal comment ID — used for dedup */
  substackCommentId: varchar("substack_comment_id", { length: 128 }).notNull().unique(),
  /** The Substack post ID this comment belongs to */
  substackPostId: varchar("substack_post_id", { length: 128 }).notNull(),
  /** The Substack post URL for linking back */
  substackPostUrl: text("substack_post_url"),
  /** The Substack post title for display */
  postTitle: text("post_title"),
  /** Commenter's display name */
  authorName: varchar("author_name", { length: 255 }),
  /** Commenter's email (if available from API) */
  authorEmail: varchar("author_email", { length: 320 }),
  /** Commenter's Substack handle */
  authorHandle: varchar("author_handle", { length: 128 }),
  /** The comment body text */
  body: text("body").notNull(),
  /** Whether this is a reply to another comment */
  isReply: boolean("is_reply").default(false),
  /** Parent comment ID if this is a reply */
  parentCommentId: varchar("parent_comment_id", { length: 128 }),
  /** VA workflow status: new → in_progress → responded → archived */
  status: mysqlEnum("status", ["new", "in_progress", "responded", "archived"]).default("new").notNull(),
  /** VA notes or draft response */
  vaNote: text("va_note"),
  /** When the VA responded (for tracking) */
  respondedAt: bigint("responded_at", { mode: "number" }),
  /** When this comment was posted on Substack */
  postedAt: bigint("posted_at", { mode: "number" }),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type SubstackInboxItem = typeof substackInboxItems.$inferSelect;
export type InsertSubstackInboxItem = typeof substackInboxItems.$inferInsert;

// ─── Video Idea Engine Feedback ───────────────────────────────────────────────
/**
 * Stores user feedback on Video Idea Engine suggestions.
 * - "saved": user wants to revisit this idea later (boost similar ideas)
 * - "disliked": user doesn't want ideas like this (suppress similar angles)
 */
export const ideaFeedback = mysqlTable("idea_feedback", {
  id: int("id").autoincrement().primaryKey(),
  /** The idea topic text (60-80 chars) */
  topic: text("topic").notNull(),
  /** The rationale the LLM provided */
  rationale: text("rationale"),
  /** Audience alignment score 0-100 */
  audienceAlignment: int("audience_alignment"),
  /** Recommended format */
  recommendedFormat: varchar("recommended_format", { length: 64 }),
  /** Recommended pattern types as JSON array string */
  recommendedPatterns: text("recommended_patterns"),
  /** Which analog data entry inspired this idea */
  analogDataSource: text("analog_data_source"),
  /** User feedback: saved = keep for later, disliked = train away from this */
  feedback: mysqlEnum("idea_feedback_type", ["saved", "disliked"]).notNull(),
  /** Optional note from user explaining why they saved or disliked */
  note: text("note"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type IdeaFeedback = typeof ideaFeedback.$inferSelect;
export type InsertIdeaFeedback = typeof ideaFeedback.$inferInsert;

// ─── Paid Tier Weekly Deep Dive System ─────────────────────────────────────────
export const deepDiveStatusEnum = mysqlEnum("status", [
  "draft",
  "ready",
  "published",
  "archived",
]);

export const weeklyDeepDives = mysqlTable("weekly_deep_dives", {
  id: int("id").autoincrement().primaryKey(),
  /** The overarching theme / topic of this deep dive */
  theme: varchar("theme", { length: 255 }).notNull(),
  /** Which book(s) this content was mined from (comma-separated titles) */
  bookSources: text("book_sources"),
  /** The source book IDs used (JSON array of uploaded_books.id) */
  sourceBookIds: text("source_book_ids"),
  /** The generated title for the deep dive post */
  title: varchar("title", { length: 512 }).notNull(),
  /** Teaser / subtitle shown in preview */
  teaser: text("teaser"),
  /** The core practice section (markdown) */
  practiceBody: longtext("practice_body"),
  /** The insight / science section (markdown) */
  insightBody: longtext("insight_body"),
  /** The protocol / action steps section (markdown) */
  protocolBody: longtext("protocol_body"),
  /** Full assembled HTML/markdown ready to post */
  fullContent: longtext("full_content"),
  /** Status in the workflow */
  status: deepDiveStatusEnum.notNull().default("draft"),
  /** When this is scheduled to go out (UTC ms) */
  scheduledAt: bigint("scheduled_at", { mode: "number" }),
  /** When it was actually published (UTC ms) */
  publishedAt: bigint("published_at", { mode: "number" }),
  /** Substack post ID after publishing */
  substackPostId: varchar("substack_post_id", { length: 128 }),
  /** Substack post URL */
  substackPostUrl: text("substack_post_url"),
  /** Whether this was sent to paid subscribers only */
  paidOnly: boolean("paid_only").notNull().default(true),
  /** Optional editor notes */
  notes: text("notes"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type WeeklyDeepDive = typeof weeklyDeepDives.$inferSelect;
export type InsertWeeklyDeepDive = typeof weeklyDeepDives.$inferInsert;

// ─── Tantra Quiz Funnel ────────────────────────────────────────────────────────
// Captures leads from the /quiz/tantra funnel.
// Gender routing: male → Tantra Him ($185), female → Tantra Her ($185), both → Bundle ($369)
// Downstream flags: gut_flag, sleep_flag, oral_flag → conditional test kit upsells

export const tantraQuizLeads = mysqlTable("tantra_quiz_leads", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  gender: mysqlEnum("gender", ["male", "female", "couple", "unknown"]).notNull().default("unknown"),
  result: mysqlEnum("result", ["tantra_him", "tantra_her", "tantra_bundle", "pending"]).notNull().default("pending"),
  answers: text("answers"),
  gutFlag: boolean("gut_flag").notNull().default(false),
  sleepFlag: boolean("sleep_flag").notNull().default(false),
  oralFlag: boolean("oral_flag").notNull().default(false),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  emailCapturedAt: bigint("email_captured_at", { mode: "number" }),
  utmSource: varchar("utm_source", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 128 }),
  utmMedium: varchar("utm_medium", { length: 128 }),
  kajabiTagged: boolean("kajabi_tagged").notNull().default(false),
  kajabiTaggedAt: bigint("kajabi_tagged_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

export type TantraQuizLead = typeof tantraQuizLeads.$inferSelect;
export type InsertTantraQuizLead = typeof tantraQuizLeads.$inferInsert;

// ─── Interconnected Documentary Opt-In Leads ─────────────────────────────────
// Safety backup of every lead that submits the /interconnected opt-in form.
// Stored locally so leads are never lost even if Kajabi or Klaviyo is down.
export const interconnectedLeads = mysqlTable("interconnected_leads", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  smsConsent: boolean("sms_consent").notNull().default(false),
  utmSource: varchar("utm_source", { length: 128 }),
  utmMedium: varchar("utm_medium", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 128 }),
  utmContent: varchar("utm_content", { length: 128 }),
  referrer: varchar("referrer", { length: 512 }),
  pageVariant: varchar("page_variant", { length: 10 }).default("A"),
  kajabiTagged: boolean("kajabi_tagged").notNull().default(false),
  kajabiTaggedAt: bigint("kajabi_tagged_at", { mode: "number" }),
  klaviyoSynced: boolean("klaviyo_synced").notNull().default(false),
  klaviyoSyncedAt: bigint("klaviyo_synced_at", { mode: "number" }),
  // CAPI tracking — Lead event
  capiLeadEventId: varchar("capi_lead_event_id", { length: 64 }),
  capiLeadSent: boolean("capi_lead_sent").notNull().default(false),
  capiLeadSentAt: bigint("capi_lead_sent_at", { mode: "number" }),
  // Client-side signals for CAPI user matching
  fbclid: varchar("fbclid", { length: 256 }),
  fbp: varchar("fbp", { length: 256 }),
  fbc: varchar("fbc", { length: 256 }),
  clientIp: varchar("client_ip", { length: 64 }),
  userAgent: varchar("user_agent", { length: 512 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

export type InterconnectedLead = typeof interconnectedLeads.$inferSelect;
export type InsertInterconnectedLead = typeof interconnectedLeads.$inferInsert;

// ─── Funnel Economics Scenarios ───────────────────────────────────────────────
export const funnelEconomicsScenarios = mysqlTable("funnel_economics_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  leadsPerMonth: int("leads_per_month").notNull(),
  cpl: double("cpl").notNull(),
  cr67: double("cr_67").notNull(),
  crBump: double("cr_bump").notNull(),
  crOto: double("cr_oto").notNull(),
  crMid: double("cr_mid").notNull(),
  midPrice: int("mid_price").notNull(),
  crHighTicket: double("cr_high_ticket").notNull(),
  totalRevenue: double("total_revenue").notNull(),
  netProfit: double("net_profit").notNull(),
  roas: double("roas").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type FunnelEconomicsScenario = typeof funnelEconomicsScenarios.$inferSelect;
export type InsertFunnelEconomicsScenario = typeof funnelEconomicsScenarios.$inferInsert;

// ─── Kajabi Purchases (webhook-captured, funnel-attributed) ───────────────────
// Populated by the /api/kajabi/purchase webhook handler.
// funnel_source tags which funnel the purchase came from (e.g. 'interconnected').
// is_email_list_buyer flags purchases confirmed as pre-existing email subscribers
// (not Meta leads) so they can be excluded from Meta ROAS calculations.
// is_meta_attributed is set when the buyer's email matches an interconnected_leads record.
export const kajabiPurchases = mysqlTable("kajabi_purchases", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 256 }).notNull(),
  amountCents: int("amount_cents").notNull(),
  offerName: varchar("offer_name", { length: 256 }),
  funnelSource: varchar("funnel_source", { length: 64 }).default("interconnected"),
  kajabiOrderId: varchar("kajabi_order_id", { length: 128 }),
  isEmailListBuyer: tinyint("is_email_list_buyer").default(0),
  isMetaAttributed: tinyint("is_meta_attributed").default(0),
  notes: text("notes"),
  purchasedAt: bigint("purchased_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type KajabiPurchase = typeof kajabiPurchases.$inferSelect;
export type InsertKajabiPurchase = typeof kajabiPurchases.$inferInsert;
