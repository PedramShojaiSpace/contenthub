/**
 * QR Generator Router
 * Runs the Urban Monk branded QR generator Python script server-side,
 * uploads the result to S3, and returns a download URL.
 * Also provides video script generation and production pipeline integration.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import sharp from "sharp";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { qrDesigns } from "../drizzle/schema";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirnameESM = path.dirname(__filename);

const ICON_PATH = path.resolve(__dirnameESM, "./assets/urban_monk_icon.png");

export const qrGeneratorRouter = router({
  /**
   * Generate a 2-minute video script for a QR landing page.
   * Theme input → AI writes script in Dr. Pedram's voice.
   */
  generateVideoScript: protectedProcedure
    .input(
      z.object({
        theme: z.string().min(10).max(1000),
        designLabel: z.string().min(1).max(80),
        landingPageUrl: z.string().url(),
        durationSeconds: z.number().int().min(60).max(180).default(120),
      })
    )
    .mutation(async ({ input }) => {
      const { theme, designLabel, landingPageUrl, durationSeconds } = input;
      const wordCount = Math.round((durationSeconds / 60) * 150); // ~150 words/min

      const systemPrompt = `You are Dr. Pedram Shojai — OMD, filmmaker, author, and founder of The Urban Monk. Your voice is warm, grounded, and direct. You speak from lived experience, not theory. You bridge ancient wisdom and modern science without being preachy. You never use hype or filler phrases.

You are writing a video script for a short-form video (~${durationSeconds} seconds, ~${wordCount} words of spoken content) that will accompany a piece of Urban Monk merchandise. The video will be produced via HeyGen (avatar) and/or Descript (AI voice + B-roll).

Script format:
- HOOK (first 5-8 seconds): One punchy sentence that stops the scroll. No question hooks.
- BODY: 3-4 short paragraphs. Conversational. Each paragraph is one idea. No bullet points.
- CTA: One clear, low-pressure call to action directing viewers to the landing page.
- End with: [CTA URL: ${landingPageUrl}]

Do NOT include stage directions, camera notes, or B-roll suggestions — those are handled by Descript. Write only the spoken words.`;

      const userPrompt = `Design: ${designLabel}
Theme/message to convey: ${theme}

Write the video script now.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content ?? "";
      const scriptText = typeof rawContent === "string" ? rawContent : "";
      if (!scriptText) throw new Error("Script generation failed — no content returned");

      // Extract a clean title from the first non-empty line
      const firstLine = scriptText.split("\n").find((l: string) => l.trim().length > 0) ?? designLabel;
      const scriptTitle = firstLine.replace(/^[#*\-]+\s*/, "").substring(0, 80);

      return {
        scriptText,
        scriptTitle,
        wordCount: scriptText.split(/\s+/).length,
        estimatedDurationSeconds: Math.round((scriptText.split(/\s+/).length / 150) * 60),
        landingPageUrl,
        designLabel,
      };
    }),

  /**
   * Send a generated script to the video production pipeline.
   * Saves the script to qr_designs and creates a video job.
   */
  sendToProduction: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(128),
        designLabel: z.string().min(1).max(256),
        landingPageUrl: z.string().url(),
        scriptText: z.string().min(50),
        scriptTitle: z.string().min(1).max(256),
        theme: z.string().optional(),
        productionPath: z.enum(["heygen_only", "descript_only", "heygen_then_descript"]).default("heygen_then_descript"),
      })
    )
    .mutation(async ({ input }) => {
      const { slug, designLabel, landingPageUrl, scriptText, scriptTitle, theme, productionPath } = input;

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Upsert the qr_designs record
      const existing = await db.select().from(qrDesigns).where(eq(qrDesigns.slug, slug)).limit(1);
      if (existing.length > 0) {
        await db.update(qrDesigns)
          .set({ label: designLabel, landingPageUrl, scriptText, scriptTitle, theme: theme ?? null, updatedAt: new Date() })
          .where(eq(qrDesigns.slug, slug));
      } else {
        await db.insert(qrDesigns).values({ slug, label: designLabel, landingPageUrl, scriptText, scriptTitle, theme: theme ?? null });
      }

      // Create a video job directly in the DB
      const { videoJobs } = await import("../drizzle/schema");
      const [jobResult] = await db.insert(videoJobs).values({
        contentItemId: null as unknown as number, // nullable after schema change
        scriptText,
        youtubeTitle: scriptTitle.substring(0, 512),
        ctaUrl: landingPageUrl,
        ctaLabel: "Watch Now",
        ctaText: `Learn more at ${landingPageUrl}`,
        productionPath,
        outputChannels: JSON.stringify(["youtube"]),
        videoType: productionPath === "descript_only" ? "standard" : "avatar",
        status: "pending",
      });

      const jobId = (jobResult as any).insertId as number;

      // Link the job back to the design
      await db.update(qrDesigns)
        .set({ videoJobId: jobId, updatedAt: new Date() })
        .where(eq(qrDesigns.slug, slug));

      return { success: true, jobId, slug, productionPath };
    }),

  /**
   * List all QR designs with their video status.
   */
  listDesigns: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const designs = await db.select().from(qrDesigns).orderBy(qrDesigns.createdAt);
      return designs;
    }),

  /**
   * Assign a video URL to a QR design (called when video production completes).
   */
  assignVideo: protectedProcedure
    .input(z.object({ slug: z.string(), videoUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(qrDesigns)
        .set({ videoUrl: input.videoUrl, updatedAt: new Date() })
        .where(eq(qrDesigns.slug, input.slug));
      return { success: true };
    }),

  /**
   * Generate a branded Urban Monk QR code PNG and return a download URL.
   * Pure Node.js implementation using qrcode + sharp — works in production.
   */
  generate: protectedProcedure
    .input(
      z.object({
        url: z.string().url("Must be a valid URL"),
        label: z.string().min(1).max(80).default("qr"),
        size: z.number().int().min(400).max(4800).default(2400),
      })
    )
    .mutation(async ({ input }) => {
      const { url, label, size } = input;

      // Sanitize label for use as filename
      const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const timestamp = Date.now();

      // Generate QR code as PNG buffer (high error correction for icon overlay)
      const qrBuffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: "H",
        type: "png",
        width: size,
        margin: 2,
        color: { dark: "#1a1a18", light: "#ffffff" },
      });

      // Overlay Urban Monk icon in the center (if icon exists)
      let fileBuffer: Buffer;
      if (fs.existsSync(ICON_PATH)) {
        const iconSize = Math.round(size * 0.22); // 22% of QR size
        const iconResized = await sharp(fs.readFileSync(ICON_PATH))
          .resize(iconSize, iconSize, {
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .png()
          .toBuffer();

        fileBuffer = await sharp(qrBuffer)
          .composite([{ input: iconResized, gravity: "center" }])
          .png()
          .toBuffer();
      } else {
        fileBuffer = qrBuffer;
      }

      // Upload to S3
      const s3Key = `qr-codes/${safeLabel}_${timestamp}.png`;
      const { url: downloadUrl } = await storagePut(s3Key, fileBuffer, "image/png");

      const filename = `urban_monk_qr_${safeLabel}.png`;

      return {
        downloadUrl,
        filename,
        url,
        label,
        size,
        generatedAt: new Date().toISOString(),
      };
    }),
});
