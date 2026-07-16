/**
 * Ascension Pipeline Router
 *
 * Manages the Urban Monk ascension ladder:
 *   Lights On ($369/yr recurring)
 *     → Retreat Eligible (after 1 renewal or 300+ days)
 *     → Retreat Registered (paid for a retreat)
 *     → Lapsed (renewal overdue > 30 days)
 *
 * Retreat pricing:
 *   Early bird: $850  (before earlyBirdDeadline)
 *   Standard:  $1,250 (after earlyBirdDeadline)
 *   2 retreats/year, min 100 capacity each
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  ascensionMembers,
  retreatEvents,
  retreatRegistrations,
  type AscensionMember,
} from "../drizzle/schema";
import { eq, and, lt, lte, gte, desc, sql, isNull, isNotNull } from "drizzle-orm";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { TRPCError } from "@trpc/server";

// ─── Pricing Constants ────────────────────────────────────────────────────────
export const LIGHTS_ON_ANNUAL_CENTS = 36_900;       // $369/yr
export const RETREAT_EARLY_BIRD_CENTS = 85_000;     // $850
export const RETREAT_STANDARD_CENTS = 125_000;      // $1,250
export const RETREATS_PER_YEAR = 2;
export const RETREAT_MIN_CAPACITY = 100;

// Renewal reminder window: send 30 days before renewal_due_date
const RENEWAL_REMINDER_DAYS = 30;
const MS_PER_DAY = 86_400_000;

// ─── Avatar labels ────────────────────────────────────────────────────────────
export const AVATAR_LABELS: Record<string, string> = {
  dismissed_patient: "The Dismissed Patient",
  high_performer_decline: "The High-Performer in Decline",
  awakening_seeker: "The Awakening Seeker",
  supplement_graveyard: "The Supplement Graveyard",
};

// ─── Kajabi tag names per stage ───────────────────────────────────────────────
const KAJABI_TAGS: Record<string, string> = {
  lights_on: "lights-on-active",
  retreat_eligible: "retreat-eligible",
  retreat_registered: "retreat-registered",
  lapsed: "lights-on-lapsed",
  renewal_reminder: "renewal-reminder-30d",
};

// ─── Helper: compute retreat price based on current date ─────────────────────
export function computeRetreatPrice(event: {
  earlyBirdDeadline: number | null;
  earlyBirdPriceCents: number;
  standardPriceCents: number;
}): { priceCents: number; priceType: "early_bird" | "standard" } {
  const now = Date.now();
  if (event.earlyBirdDeadline && now < event.earlyBirdDeadline) {
    return { priceCents: event.earlyBirdPriceCents, priceType: "early_bird" };
  }
  return { priceCents: event.standardPriceCents, priceType: "standard" };
}

// ─── Helper: determine if a member is retreat-eligible ───────────────────────
export function isRetreatEligible(member: AscensionMember): boolean {
  if (member.stage === "lapsed") return false;
  // Eligible after 1 renewal OR 300+ days since start
  if (member.renewalCount >= 1) return true;
  if (member.lightsOnStartDate) {
    const daysSinceStart = (Date.now() - member.lightsOnStartDate) / MS_PER_DAY;
    if (daysSinceStart >= 300) return true;
  }
  return false;
}

// ─── Helper: compute LTV projection ──────────────────────────────────────────
export function computeMemberLtv(member: AscensionMember): {
  renewalRevenueCents: number;
  retreatRevenuePotentialCents: number;
  totalLtvCents: number;
} {
  const renewalRevenueCents = member.totalPaidCents;
  // Assume 30% of eligible members attend at least one retreat at standard price
  const retreatRevenuePotentialCents =
    isRetreatEligible(member) ? Math.round(RETREAT_STANDARD_CENTS * 0.3) : 0;
  return {
    renewalRevenueCents,
    retreatRevenuePotentialCents,
    totalLtvCents: renewalRevenueCents + retreatRevenuePotentialCents,
  };
}

export const ascensionRouter = router({
  // ─── Pipeline Stats ─────────────────────────────────────────────────────────
  getPipelineStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const now = Date.now();
    const thirtyDaysFromNow = now + RENEWAL_REMINDER_DAYS * MS_PER_DAY;

    const [members, events] = await Promise.all([
      db.select().from(ascensionMembers),
      db.select().from(retreatEvents).where(
        gte(retreatEvents.eventDate, now)
      ).orderBy(retreatEvents.eventDate),
    ]);

    const byStage = {
      lights_on: 0,
      retreat_eligible: 0,
      retreat_registered: 0,
      lapsed: 0,
    };
    let renewalDueSoon = 0;
    let totalPaidCents = 0;
    let totalRetreatRevenueCents = 0;

    for (const m of members) {
      byStage[m.stage as keyof typeof byStage]++;
      totalPaidCents += m.totalPaidCents;
      if (m.renewalDueDate && m.renewalDueDate <= thirtyDaysFromNow && m.stage !== "lapsed") {
        renewalDueSoon++;
      }
    }

    // Retreat revenue from paid registrations
    const regs = await db.select().from(retreatRegistrations).where(
      eq(retreatRegistrations.paymentStatus, "paid")
    );
    for (const r of regs) {
      totalRetreatRevenueCents += r.pricePaidCents;
    }

    // EV projection: retreat-eligible members × 30% take rate × standard price
    const retreatEligibleCount = byStage.retreat_eligible + byStage.retreat_registered;
    const retreatEvRevenueCents = Math.round(retreatEligibleCount * 0.3 * RETREAT_STANDARD_CENTS);

    return {
      totalMembers: members.length,
      byStage,
      renewalDueSoon,
      totalPaidCents,
      totalRetreatRevenueCents,
      retreatEvRevenueCents,
      annualRenewalRevenueCents: byStage.lights_on * LIGHTS_ON_ANNUAL_CENTS,
      upcomingRetreats: events.slice(0, 3),
      lightsOnAnnualCents: LIGHTS_ON_ANNUAL_CENTS,
      retreatEarlyBirdCents: RETREAT_EARLY_BIRD_CENTS,
      retreatStandardCents: RETREAT_STANDARD_CENTS,
    };
  }),

  // ─── Member List ─────────────────────────────────────────────────────────────
  listMembers: protectedProcedure
    .input(z.object({
      stage: z.enum(["lights_on", "retreat_eligible", "retreat_registered", "lapsed", "all"]).default("all"),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const query = db.select().from(ascensionMembers);
      if (input.stage !== "all") {
        const rows = await db.select().from(ascensionMembers)
          .where(eq(ascensionMembers.stage, input.stage as AscensionMember["stage"]))
          .orderBy(desc(ascensionMembers.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        return rows;
      }
      return query.orderBy(desc(ascensionMembers.createdAt)).limit(input.limit).offset(input.offset);
    }),

  // ─── Renewal Queue ───────────────────────────────────────────────────────────
  getRenewalQueue: protectedProcedure
    .input(z.object({ windowDays: z.number().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const now = Date.now();
      const windowEnd = now + input.windowDays * MS_PER_DAY;

      const due = await db.select().from(ascensionMembers).where(
        and(
          lte(ascensionMembers.renewalDueDate, windowEnd),
          gte(ascensionMembers.renewalDueDate, now),
        )
      ).orderBy(ascensionMembers.renewalDueDate);

      const overdue = await db.select().from(ascensionMembers).where(
        and(
          lt(ascensionMembers.renewalDueDate, now),
          eq(ascensionMembers.stage, "lights_on"),
        )
      ).orderBy(ascensionMembers.renewalDueDate);

      return {
        dueSoon: due,
        overdue,
        totalDueSoon: due.length,
        totalOverdue: overdue.length,
        potentialRenewalRevenueCents: due.length * LIGHTS_ON_ANNUAL_CENTS,
      };
    }),

  // ─── Add / Update Member ─────────────────────────────────────────────────────
  upsertMember: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      kajabiContactId: z.string().optional(),
      avatarType: z.enum(["dismissed_patient", "high_performer_decline", "awakening_seeker", "supplement_graveyard"]).optional(),
      lightsOnStartDate: z.number().optional(),
      renewalDueDate: z.number().optional(),
      totalPaidCents: z.number().optional(),
      renewalCount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const now = Date.now();

      const existing = await db.select().from(ascensionMembers)
        .where(eq(ascensionMembers.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        await db.update(ascensionMembers)
          .set({
            name: input.name ?? existing[0].name,
            kajabiContactId: input.kajabiContactId ?? existing[0].kajabiContactId,
            avatarType: input.avatarType ?? existing[0].avatarType,
            lightsOnStartDate: input.lightsOnStartDate ?? existing[0].lightsOnStartDate,
            renewalDueDate: input.renewalDueDate ?? existing[0].renewalDueDate,
            totalPaidCents: input.totalPaidCents ?? existing[0].totalPaidCents,
            renewalCount: input.renewalCount ?? existing[0].renewalCount,
            notes: input.notes ?? existing[0].notes,
            updatedAt: now,
          })
          .where(eq(ascensionMembers.email, input.email));
        return { action: "updated" as const };
      }

      // New member
      const startDate = input.lightsOnStartDate ?? now;
      const renewalDue = input.renewalDueDate ?? (startDate + 365 * MS_PER_DAY);

      await db.insert(ascensionMembers).values({
        email: input.email,
        name: input.name,
        kajabiContactId: input.kajabiContactId,
        avatarType: input.avatarType,
        stage: "lights_on",
        lightsOnStartDate: startDate,
        renewalDueDate: renewalDue,
        totalPaidCents: input.totalPaidCents ?? LIGHTS_ON_ANNUAL_CENTS,
        renewalCount: input.renewalCount ?? 0,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      });
      return { action: "created" as const };
    }),

  // ─── Promote Stage ───────────────────────────────────────────────────────────
  promoteStage: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      newStage: z.enum(["lights_on", "retreat_eligible", "retreat_registered", "lapsed"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(ascensionMembers)
        .set({ stage: input.newStage, updatedAt: Date.now() })
        .where(eq(ascensionMembers.id, input.memberId));

      // Fire Kajabi tag
      const [member] = await db.select().from(ascensionMembers)
        .where(eq(ascensionMembers.id, input.memberId)).limit(1);
      if (member?.kajabiContactId) {
        try {
          await kajabiAddTagByName({
            contactId: member.kajabiContactId,
            tagName: KAJABI_TAGS[input.newStage] ?? input.newStage,
          });
        } catch (e) {
          console.warn("[ascension] Kajabi tag failed (non-fatal):", e);
        }
      }
      return { success: true };
    }),

  // ─── Record Renewal ──────────────────────────────────────────────────────────
  recordRenewal: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [member] = await db.select().from(ascensionMembers)
        .where(eq(ascensionMembers.id, input.memberId)).limit(1);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

      const newRenewalCount = member.renewalCount + 1;
      const newRenewalDue = Date.now() + 365 * MS_PER_DAY;
      const newTotalPaid = member.totalPaidCents + LIGHTS_ON_ANNUAL_CENTS;
      const newStage = isRetreatEligible({ ...member, renewalCount: newRenewalCount })
        ? "retreat_eligible"
        : member.stage;

      await db.update(ascensionMembers)
        .set({
          renewalCount: newRenewalCount,
          renewalDueDate: newRenewalDue,
          totalPaidCents: newTotalPaid,
          stage: newStage,
          updatedAt: Date.now(),
        })
        .where(eq(ascensionMembers.id, input.memberId));

      return { newRenewalCount, newTotalPaid, newStage };
    }),

  // ─── Retreat Events ──────────────────────────────────────────────────────────
  listRetreats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return db.select().from(retreatEvents).orderBy(retreatEvents.eventDate);
  }),

  createRetreat: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      location: z.string().optional(),
      eventDate: z.number(),
      earlyBirdDeadline: z.number().optional(),
      earlyBirdPriceCents: z.number().default(RETREAT_EARLY_BIRD_CENTS),
      standardPriceCents: z.number().default(RETREAT_STANDARD_CENTS),
      capacityMax: z.number().default(RETREAT_MIN_CAPACITY),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(retreatEvents).values({
        ...input,
        status: "upcoming",
        registeredCount: 0,
        createdAt: Date.now(),
      });
      return { success: true };
    }),

  updateRetreatStatus: protectedProcedure
    .input(z.object({
      retreatId: z.number(),
      status: z.enum(["upcoming", "open", "early_bird", "closed", "completed"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(retreatEvents)
        .set({ status: input.status })
        .where(eq(retreatEvents.id, input.retreatId));
      return { success: true };
    }),

  // ─── Retreat Registration ────────────────────────────────────────────────────
  registerForRetreat: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      retreatId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [event] = await db.select().from(retreatEvents)
        .where(eq(retreatEvents.id, input.retreatId)).limit(1);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Retreat not found" });
      if (event.registeredCount >= event.capacityMax) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Retreat is at capacity" });
      }

      const { priceCents, priceType } = computeRetreatPrice(event);

      await db.insert(retreatRegistrations).values({
        memberId: input.memberId,
        retreatId: input.retreatId,
        pricePaidCents: priceCents,
        priceType,
        paymentStatus: "pending",
        registeredAt: Date.now(),
      });

      // Increment registered count
      await db.update(retreatEvents)
        .set({ registeredCount: event.registeredCount + 1 })
        .where(eq(retreatEvents.id, input.retreatId));

      // Promote member stage
      const db2 = await getDb();
      if (!db2) throw new Error("DB unavailable");
      await db2.update(ascensionMembers)
        .set({ stage: "retreat_registered", updatedAt: Date.now() })
        .where(eq(ascensionMembers.id, input.memberId));

      return { priceCents, priceType, success: true };
    }),

  // ─── Renewal Reminder Trigger ────────────────────────────────────────────────
  triggerRenewalReminders: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const now = Date.now();
    const windowEnd = now + RENEWAL_REMINDER_DAYS * MS_PER_DAY;

    const due = await db.select().from(ascensionMembers).where(
      and(
        lte(ascensionMembers.renewalDueDate, windowEnd),
        gte(ascensionMembers.renewalDueDate, now),
        isNull(ascensionMembers.renewalReminderSentAt),
      )
    );

    let sent = 0;
    for (const member of due) {
      if (member.kajabiContactId) {
        try {
          await kajabiAddTagByName({
            contactId: member.kajabiContactId,
            tagName: KAJABI_TAGS.renewal_reminder,
          });
          await db.update(ascensionMembers)
            .set({ renewalReminderSentAt: now, updatedAt: now })
            .where(eq(ascensionMembers.id, member.id));
          sent++;
        } catch (e) {
          console.warn(`[ascension] Renewal reminder failed for ${member.email}:`, e);
        }
      }
    }

    return { sent, total: due.length };
  }),

  // ─── LTV Calculator ──────────────────────────────────────────────────────────
  getLtvProjection: protectedProcedure
    .input(z.object({
      retreatTakeRatePct: z.number().min(0).max(100).default(30),
      yearsToProject: z.number().min(1).max(10).default(3),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const members = await db.select().from(ascensionMembers);

      const activeMembers = members.filter(m => m.stage !== "lapsed");
      const retreatEligible = members.filter(m =>
        m.stage === "retreat_eligible" || m.stage === "retreat_registered"
      );

      const annualRenewalRevenue = activeMembers.length * LIGHTS_ON_ANNUAL_CENTS;
      const retreatRevenuePerYear = Math.round(
        retreatEligible.length * (input.retreatTakeRatePct / 100) * RETREAT_STANDARD_CENTS * RETREATS_PER_YEAR
      );
      const projectedRevenue = (annualRenewalRevenue + retreatRevenuePerYear) * input.yearsToProject;

      return {
        activeMembers: activeMembers.length,
        retreatEligible: retreatEligible.length,
        annualRenewalRevenueCents: annualRenewalRevenue,
        retreatRevenuePerYearCents: retreatRevenuePerYear,
        projectedRevenueCents: projectedRevenue,
        lightsOnAnnualCents: LIGHTS_ON_ANNUAL_CENTS,
        retreatEarlyBirdCents: RETREAT_EARLY_BIRD_CENTS,
        retreatStandardCents: RETREAT_STANDARD_CENTS,
      };
    }),
});
