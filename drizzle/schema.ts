import { bigint, boolean, double, float, int, longtext, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  // SEO fields — persisted so CommandCenter publish can auto-push them to WordPress
  focusKeyword: varchar("focusKeyword", { length: 255 }),
  seoKeywords: text("seoKeywords"),  // JSON array of semantic keyword strings
  yoastSeoTitle: varchar("yoastSeoTitle", { length: 255 }),  // Yoast SEO title (shown in SERPs)
  yoastMetaDescription: text("yoastMetaDescription"),  // Yoast meta description (150-160 chars)
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
