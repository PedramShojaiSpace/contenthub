import { bigint, boolean, date, double, float, int, longtext, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const hostedLpCampaignEnum = mysqlEnum("hlp_campaign", ["lo", "gut", "sleep", "webinar"]);
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
});

export type SyndicationJob = typeof syndicationJobs.$inferSelect;
export type InsertSyndicationJob = typeof syndicationJobs.$inferInsert;
