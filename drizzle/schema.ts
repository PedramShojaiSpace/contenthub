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
  "all",
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
  notes: text("notes"),
  // Analytics stub fields (manually updated or future API sync)
  analyticsViews: int("analyticsViews").default(0),
  analyticsLikes: int("analyticsLikes").default(0),
  analyticsComments: int("analyticsComments").default(0),
  analyticsShares: int("analyticsShares").default(0),
  // Research Intelligence: link to the Gumshoe gap query this content addresses
  gapQueryId: int("gapQueryId"),
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
