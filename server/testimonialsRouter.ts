/**
 * Testimonials Router
 *
 * Manages testimonials for CH Landing Pages.
 * Supports:
 *   - CRUD (list, create, update, delete, toggle active)
 *   - Bulk import from a PPTX file (server-side python-pptx parsing)
 *   - Pre-seeded Lights On testimonials from the master PPTX
 *   - Filtering by campaign and category
 */

import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { testimonials } from "../drizzle/schema";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Pre-seeded Lights On testimonials from the master PPTX ──────────────────

const LO_TESTIMONIALS_SEED = [
  {
    category: "PRESENCE",
    quote: "I signed up because my wife told me I had stopped being present. She wasn't wrong. I was physically in the room but nobody was home. Ten weeks in and she told me last week that she feels like she got her husband back. That's the only testimonial that matters to me.",
    authorName: "Paul Nguyen",
    dateLabel: "Week 10 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "I've been doing the morning practice for 11 weeks now. I didn't think I was a 'routine person' — I've failed at habits my whole life. But this one stuck because it's not about discipline, it's about desire. I actually want to show up for it. The day feels different when I do. I feel different.",
    authorName: "Carla Mendez",
    dateLabel: "Week 11 · Lights On",
  },
  {
    category: "ENERGY",
    quote: "I'm 58 years old and I have more energy now than I did at 40. I don't say that lightly. I've tried every supplement, every diet, every biohack. What Lights On gave me wasn't a hack — it was a foundation. The difference is everything.",
    authorName: "David Harrington",
    dateLabel: "Week 22 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "I've tried so many programs over the years, but I always fall off after a few weeks. Lights On is the first one where I'm still going at month six. I think it's because Pedram doesn't make you feel guilty when you miss a day. He just says come back. That's the whole teaching.",
    authorName: "Lisa Fontaine",
    dateLabel: "Week 26 · Lights On",
  },
  {
    category: "SLEEP & RECOVERY",
    quote: "I've struggled with insomnia for 15 years. I've tried everything — melatonin, sleep hygiene, CBT-I, prescription meds. Nothing worked long-term. After the sleep module in Lights On, I'm averaging 7.5 hours and waking up before my alarm. I don't know how to explain it except that something fundamental shifted.",
    authorName: "Thomas Reyes",
    dateLabel: "Week 8 · Lights On",
  },
  {
    category: "PRESENCE",
    quote: "My teenage daughter said to me last month, 'Dad, you've been different lately. Like, actually here.' I almost cried. That's what Lights On did for me.",
    authorName: "James Calloway",
    dateLabel: "Week 16 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "I was skeptical about the morning practice. I'm a scientist — I don't do 'woo.' But Pedram grounds everything in neuroscience and physiology, so I could actually engage with it intellectually while experiencing it physically. Six months later, I'm a convert. The data in my own body doesn't lie.",
    authorName: "Dr. Sarah Chen",
    dateLabel: "Week 24 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "What I didn't expect was the grief. About three months in, I started crying in my morning practice — not from sadness, but from relief. Like I had been holding something for so long and finally got permission to put it down. Pedram warned us this might happen. He was right.",
    authorName: "Angela Morrison",
    dateLabel: "Week 13 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "I've been in therapy for years, and my therapist actually noticed the change before I did. She asked what I was doing differently. When I told her about Lights On, she said, 'Keep doing that.' That's the endorsement I didn't know I needed.",
    authorName: "Michael Torres",
    dateLabel: "Week 18 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "I used to think 'personal development' was for people who had time for it. I'm a single mom with two jobs. But the morning practice is 20 minutes. I wake up 20 minutes earlier. And those 20 minutes have changed everything about the other 23 hours and 40 minutes.",
    authorName: "Denise Okafor",
    dateLabel: "Week 7 · Lights On",
  },
  {
    category: "DAILY PRACTICE",
    quote: "I am not a quitter. I have been in this program since Day 1. I have not always succeeded, but I have not regarded as failures. All along the way, I've cleaned up my life garden, pulling some overgrown weeds, making room for more important work to do.",
    authorName: "Nancy Gaudette",
    dateLabel: "November 14, 2016",
  },
  {
    category: "ALL 9 CHANNELS",
    quote: "The nine channels concept cracked everything open for me. I had heard 'get out of your head and into your body' a thousand times and it never landed. But when Pedram walked through each channel specifically — what it is, why it's been hijacked, how to bring it back online — suddenly I had a map. I wasn't broken. I was just operating on two channels instead of nine. That reframe alone was worth the entire investment.",
    authorName: "Simone Ashworth",
    dateLabel: "Week 14 · Lights On",
  },
  {
    category: "HEALING",
    quote: "I am very thankful for finding Urban Monk Academy. Growing up I have always been an athlete — college tennis, avid snowboarder, boater, and golfer. I felt invincible. Now coming up on my 28th birthday I can barely walk due to my hip which was injured during a charity event. This community has given me hope.",
    authorName: "Kaylee Andersen",
    dateLabel: "April 30, 2016",
  },
  {
    category: "NEUROCEPTION",
    quote: "The Neuroception work in the early modules changed my relationship with anxiety overnight. Not gone — but understood. My nervous system had been scanning for threats 24/7 and I didn't even know it. Learning to work with that system instead of fighting it was the most practical thing I've ever done for my mental health.",
    authorName: "Janet Wu",
    dateLabel: "Week 6 · Lights On",
  },
  {
    category: "CHRONOCEPTION",
    quote: "I'm on Day 28 of Art of Stopping Time. This one is HUGE for me. I have a condition that will lay me flat for days if I get too ahead of myself. What do you do to remind yourself to slow down? I take a lot of breathing breaks throughout the day, and schedule down time.",
    authorName: "Genevieve White",
    dateLabel: "May 7, 2018",
  },
  {
    category: "NEUROCEPTION",
    quote: "I didn't realize my nervous system was stuck in a state of chronic alarm until we hit the Neuroception training. I was living in a body that constantly thought it was under attack. Recalibrating my safety scan has changed how I walk into a room, how I respond to my kids, and how I sleep. The 'Lights' are finally staying on, and I feel safe in my own skin again.",
    authorName: "Marcus Thorne",
    dateLabel: "Week 24 · Lights On",
  },
  {
    category: "SLEEP & RECOVERY",
    quote: "Could it be true? All of these restless daytime meditations may in fact be improving my sleep. I think I awoke briefly once last night then naturally woke up at 5:15. Maybe my meditations ARE in fact good and effective. I have it as a shadow gong item.",
    authorName: "Maureen MK Hahn",
    dateLabel: "September 16, 2016",
  },
  {
    category: "INTEROCEPTION",
    quote: "I spent years ignoring my 'gut feelings' because I thought they were just anxiety. Lights On helped me realize my Interoception channel was just drowned out by noise. Now I can actually feel my body's honest signals again. It's like I've been given a compass I didn't know I had. My decisions are clearer, and that 'quiet knowing' is finally back online.",
    authorName: "Julianna Vance",
    dateLabel: "Week 12 · Lights On",
  },
  {
    category: "COMMUNITY",
    quote: "Finished the first Gong day! This will be quite a challenge I can tell already. I am so excited about doing this with this community. This is what I have longed for for a long time. Thank you all and thank you Pedram!",
    authorName: "Heidi Steenstrup",
    dateLabel: "April 18, 2016",
  },
  {
    category: "PROPRIOCEPTION",
    quote: "I used to feel like a floating head, totally disconnected from my physical self. The Proprioception and Equilibrioception modules have literally grounded me. I'm no longer clumsy or 'spaced out.' I feel my map of self in space, and that physical stability has translated into emotional stability. I'm not just surviving the attention economy; I'm standing my ground in it.",
    authorName: "Rachel Kim",
    dateLabel: "Week 19 · Lights On",
  },
  {
    category: "COMMUNITY",
    quote: "I've noticed so much improvement with this group. I have been so positive. My friends have noticed and ask for suggestions. I'm feeling better with chronic health issues and have more energy.",
    authorName: "Shari Taylor",
    dateLabel: "July 11, 2016",
  },
];

// ─── Python PPTX parser helper ────────────────────────────────────────────────

function parsePptxTestimonials(pptxBuffer: Buffer): Array<{
  quote: string;
  authorName: string;
  dateLabel: string;
  category: string;
}> {
  // Write buffer to temp file
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `testimonials_${Date.now()}.pptx`);
  fs.writeFileSync(tmpFile, pptxBuffer);

  try {
    const script = `
import sys, json
from pptx import Presentation

prs = Presentation('${tmpFile}')
testimonials = []
for i, slide in enumerate(prs.slides):
    texts = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                line = para.text.strip()
                if line and line not in ['\u201c', 'THE URBAN MONK ACADEMY\u2122']:
                    texts.append(line)
    if not texts:
        continue
    quote = None
    name = None
    date_str = None
    category = None
    for t in texts:
        if t.startswith('\u201c') or t.startswith('"'):
            quote = t.strip('\u201c\u201d').strip()
        elif (t.startswith('Week ') or any(str(y) in t for y in range(2015, 2026))):
            date_str = t
        elif t.isupper() and len(t) < 60 and not t.startswith('TURN') and not t.startswith('52'):
            category = t
        elif quote and not name and not t.isupper():
            name = t
    if quote and name:
        testimonials.append({'quote': quote, 'authorName': name, 'dateLabel': date_str or '', 'category': category or ''})

print(json.dumps(testimonials))
`;
    const scriptFile = path.join(tmpDir, `parse_pptx_${Date.now()}.py`);
    fs.writeFileSync(scriptFile, script);
    const output = execSync(`python3 ${scriptFile}`, { timeout: 30000 }).toString();
    fs.unlinkSync(scriptFile);
    return JSON.parse(output);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const testimonialsRouter = router({

  // List testimonials — optionally filtered by campaign and/or category
  list: protectedProcedure
    .input(z.object({
      campaign: z.enum(["lo", "gut", "sleep", "webinar", "general"]).optional(),
      category: z.string().optional(),
      activeOnly: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.id));
      if (input.campaign) rows = rows.filter(r => r.campaign === input.campaign);
      if (input.category) rows = rows.filter(r => r.category === input.category);
      if (input.activeOnly) rows = rows.filter(r => r.isActive);
      return rows;
    }),

  // Get categories for a campaign
  categories: protectedProcedure
    .input(z.object({ campaign: z.enum(["lo", "gut", "sleep", "webinar", "general"]) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select({ category: testimonials.category })
        .from(testimonials)
        .where(eq(testimonials.campaign, input.campaign));
      const cats = Array.from(new Set(rows.map(r => r.category).filter(Boolean)));
      return cats.sort();
    }),

  // Create a single testimonial
  create: protectedProcedure
    .input(z.object({
      campaign: z.enum(["lo", "gut", "sleep", "webinar", "general"]),
      category: z.string().optional(),
      quote: z.string().min(1),
      authorName: z.string().min(1),
      authorTitle: z.string().optional(),
      dateLabel: z.string().optional(),
      source: z.string().default("manual"),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [result] = await db.insert(testimonials).values({
        campaign: input.campaign,
        category: input.category ?? null,
        quote: input.quote,
        authorName: input.authorName,
        authorTitle: input.authorTitle ?? null,
        dateLabel: input.dateLabel ?? null,
        source: input.source,
        sortOrder: input.sortOrder,
        isActive: true,
      });
      return { id: (result as any).insertId };
    }),

  // Update a testimonial
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      quote: z.string().optional(),
      authorName: z.string().optional(),
      authorTitle: z.string().optional(),
      dateLabel: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...rest } = input;
      await db.update(testimonials).set(rest).where(eq(testimonials.id, id));
      return { success: true };
    }),

  // Delete a testimonial
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(testimonials).where(eq(testimonials.id, input.id));
      return { success: true };
    }),

  // Toggle active/inactive
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(testimonials).set({ isActive: input.isActive }).where(eq(testimonials.id, input.id));
      return { success: true };
    }),

  // Seed the pre-extracted Lights On testimonials from the master PPTX
  // Only inserts if none exist yet for the LO campaign
  seedLightsOn: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Check if already seeded
      const existing = await db.select({ id: testimonials.id })
        .from(testimonials)
        .where(eq(testimonials.campaign, "lo"));

      if (existing.length > 0) {
        return { seeded: 0, message: `Already have ${existing.length} LO testimonials. Use bulkImport to add more.` };
      }

      // Insert all 21 testimonials
      for (let i = 0; i < LO_TESTIMONIALS_SEED.length; i++) {
        const t = LO_TESTIMONIALS_SEED[i];
        await db.insert(testimonials).values({
          campaign: "lo",
          category: t.category,
          quote: t.quote,
          authorName: t.authorName,
          dateLabel: t.dateLabel,
          source: "pptx",
          sortOrder: i,
          isActive: true,
        });
      }

      return { seeded: LO_TESTIMONIALS_SEED.length, message: `Seeded ${LO_TESTIMONIALS_SEED.length} Lights On testimonials from master PPTX.` };
    }),

  // Bulk import from a base64-encoded PPTX file
  bulkImportFromPptx: protectedProcedure
    .input(z.object({
      campaign: z.enum(["lo", "gut", "sleep", "webinar", "general"]),
      pptxBase64: z.string(),  // base64-encoded PPTX file
      replaceExisting: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Decode and parse
      const buffer = Buffer.from(input.pptxBase64, "base64");
      let parsed: Array<{ quote: string; authorName: string; dateLabel: string; category: string }>;
      try {
        parsed = parsePptxTestimonials(buffer);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `PPTX parse error: ${err.message}` });
      }

      if (parsed.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No testimonials found in the PPTX file." });
      }

      // Optionally clear existing
      if (input.replaceExisting) {
        await db.delete(testimonials).where(eq(testimonials.campaign, input.campaign));
      }

      // Insert all parsed testimonials
      for (let i = 0; i < parsed.length; i++) {
        const t = parsed[i];
        await db.insert(testimonials).values({
          campaign: input.campaign,
          category: t.category || null,
          quote: t.quote,
          authorName: t.authorName,
          dateLabel: t.dateLabel || null,
          source: "pptx",
          sortOrder: i,
          isActive: true,
        });
      }

      return { imported: parsed.length, message: `Imported ${parsed.length} testimonials from PPTX.` };
    }),

  // Get testimonials formatted for landing page content JSON
  // Returns a subset of active testimonials for a campaign, ready to embed
  getForLandingPage: protectedProcedure
    .input(z.object({
      campaign: z.enum(["lo", "gut", "sleep", "webinar", "general"]),
      limit: z.number().default(6),
      categories: z.array(z.string()).optional(),  // filter to specific categories
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let rows = await db.select().from(testimonials)
        .where(and(eq(testimonials.campaign, input.campaign), eq(testimonials.isActive, true)))
        .orderBy(asc(testimonials.sortOrder), asc(testimonials.id));

      if (input.categories && input.categories.length > 0) {
        rows = rows.filter(r => r.category && input.categories!.includes(r.category));
      }

      return rows.slice(0, input.limit).map(r => ({
        id: r.id,
        quote: r.quote,
        authorName: r.authorName,
        authorTitle: r.authorTitle,
        dateLabel: r.dateLabel,
        category: r.category,
      }));
    }),
});
