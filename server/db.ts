import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import {
  ContentItem,
  InsertContentItem,
  InsertPlatformStrategy,
  InsertUser,
  PlatformStrategy,
  contentItems,
  generatedImages,
  platformStrategies,
  users,
} from "../drizzle/schema";
import {
  klaviyoFlowEmailBackups,
  type KlaviyoFlowEmailBackup,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Content Items ────────────────────────────────────────────────────────────

export async function listContentItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentItems).orderBy(desc(contentItems.createdAt));
}

export async function getContentItem(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContentItem(data: InsertContentItem): Promise<ContentItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(contentItems).values(data);
  const result = await db
    .select()
    .from(contentItems)
    .orderBy(desc(contentItems.id))
    .limit(1);
  return result[0];
}

export async function updateContentItem(
  id: number,
  data: Partial<InsertContentItem>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contentItems).set(data).where(eq(contentItems.id, id));
}

// ─── Klaviyo Flow Email Backups ──────────────────────────────────────────────

export type KlaviyoFlowEmailBackupInput = Omit<
  typeof klaviyoFlowEmailBackups.$inferInsert,
  "id" | "createdAt" | "appliedAt" | "errorMessage"
> & {
  appliedAt?: Date | null;
  errorMessage?: string | null;
};

export async function createKlaviyoFlowEmailBackup(
  data: KlaviyoFlowEmailBackupInput
): Promise<KlaviyoFlowEmailBackup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(klaviyoFlowEmailBackups).values(data);
  const insertedId = Number((result as unknown as { insertId?: number }).insertId ?? 0);
  const rows = await db
    .select()
    .from(klaviyoFlowEmailBackups)
    .where(eq(klaviyoFlowEmailBackups.id, insertedId))
    .limit(1);
  if (!rows[0]) throw new Error("Could not read created Klaviyo email backup");
  return rows[0];
}

export async function getKlaviyoFlowEmailBackup(id: number): Promise<KlaviyoFlowEmailBackup | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(klaviyoFlowEmailBackups)
    .where(eq(klaviyoFlowEmailBackups.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listKlaviyoFlowEmailBackups(limit = 50): Promise<KlaviyoFlowEmailBackup[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(klaviyoFlowEmailBackups)
    .orderBy(desc(klaviyoFlowEmailBackups.id))
    .limit(limit);
}

export async function updateKlaviyoFlowEmailBackup(
  id: number,
  data: Partial<Pick<KlaviyoFlowEmailBackup, "operation" | "status" | "errorMessage" | "appliedAt">>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(klaviyoFlowEmailBackups).set(data).where(eq(klaviyoFlowEmailBackups.id, id));
}

export async function deleteContentItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contentItems).where(eq(contentItems.id, id));
}

// ─── Platform Strategies ─────────────────────────────────────────────────────

export async function getPlatformStrategy(platform: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformStrategies)
    .where(eq(platformStrategies.platform, platform as PlatformStrategy["platform"]))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listPlatformStrategies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformStrategies);
}

export async function upsertPlatformStrategy(data: InsertPlatformStrategy): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(platformStrategies)
    .values(data)
    .onDuplicateKeyUpdate({ set: data });
}

// ─── Generated Images ─────────────────────────────────────────────────────────

export async function listGeneratedImages(contentItemId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (contentItemId !== undefined) {
    return db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.contentItemId, contentItemId))
      .orderBy(desc(generatedImages.createdAt));
  }
  return db.select().from(generatedImages).orderBy(desc(generatedImages.createdAt));
}

// ─── Owner Credentials ────────────────────────────────────────────────────────
// All OAuth integrations (GSC, YouTube, Gmail) are company accounts owned by
// Pedram. Non-owner admin users (e.g. Jim) should transparently use the owner's
// tokens rather than being asked to connect their own accounts.
// This helper always returns the credentials row for the platform owner.

export async function getOwnerCredentials() {
  const db = await getDb();
  if (!db) return null;
  const { userCredentials, users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  // Use ENV.ownerOpenId (resolved at startup with hardcoded fallback) so this
  // works in production even when process.env.OWNER_OPEN_ID is not injected at request time.
  const ownerOpenId = ENV.ownerOpenId || process.env.OWNER_OPEN_ID;
  if (!ownerOpenId) return null;
  // Look up the owner's numeric userId from the users table
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.openId, ownerOpenId));
  if (!owner) return null;
  const [creds] = await db.select().from(userCredentials).where(eq(userCredentials.userId, owner.id));
  return creds ?? null;
}
