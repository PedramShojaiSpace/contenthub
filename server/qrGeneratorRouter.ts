/**
 * QR Generator Router
 * Runs the Urban Monk branded QR generator Python script server-side,
 * uploads the result to S3, and returns a download URL.
 */

import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

const execAsync = promisify(exec);

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirnameESM = path.dirname(__filename);

const ICON_PATH = path.resolve(__dirnameESM, "../assets/urban_monk_icon.png");
const SCRIPT_PATH = path.resolve(__dirnameESM, "../../skills/qr-generator/urban_monk_qr_generator.py");

export const qrGeneratorRouter = router({
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
      const tmpFile = path.join(os.tmpdir(), `qr_${safeLabel}_${timestamp}.png`);

      // Check if the Python script exists
      if (!fs.existsSync(SCRIPT_PATH)) {
        throw new Error(
          `QR generator script not found at ${SCRIPT_PATH}. Ensure the skills/qr-generator directory is present.`
        );
      }

      // Check if the icon exists
      if (!fs.existsSync(ICON_PATH)) {
        throw new Error(
          `Urban Monk icon not found at ${ICON_PATH}. Ensure server/assets/urban_monk_icon.png is present.`
        );
      }

      // Run the Python QR generator
      const cmd = `python3 "${SCRIPT_PATH}" --url "${url}" --output "${tmpFile}" --size ${size} --icon "${ICON_PATH}"`;
      try {
        await execAsync(cmd, { timeout: 60_000 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Try to install dependencies if missing
        if (msg.includes("ModuleNotFoundError") || msg.includes("No module named")) {
          try {
            await execAsync("pip3 install qrcode[pil] pillow --quiet", { timeout: 120_000 });
            await execAsync(cmd, { timeout: 60_000 });
          } catch (err2) {
            throw new Error(`QR generation failed: ${err2 instanceof Error ? err2.message : String(err2)}`);
          }
        } else {
          throw new Error(`QR generation failed: ${msg}`);
        }
      }

      // Read the generated file
      if (!fs.existsSync(tmpFile)) {
        throw new Error("QR generator ran but produced no output file.");
      }

      const fileBuffer = fs.readFileSync(tmpFile);
      fs.unlinkSync(tmpFile); // clean up temp file

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
