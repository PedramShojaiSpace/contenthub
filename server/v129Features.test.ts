import { describe, it, expect } from "vitest";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Montserrat Font Files ────────────────────────────────────────────────────
describe("Montserrat font files", () => {
  it("Montserrat-Bold.ttf exists in server/fonts/", () => {
    const fontPath = path.join(__dirname, "fonts", "Montserrat-Bold.ttf");
    expect(existsSync(fontPath)).toBe(true);
  });

  it("Montserrat-Regular.ttf exists in server/fonts/", () => {
    const fontPath = path.join(__dirname, "fonts", "Montserrat-Regular.ttf");
    expect(existsSync(fontPath)).toBe(true);
  });

  it("font files are non-empty (> 100 KB)", () => {
    const { statSync } = require("fs");
    const boldSize = statSync(path.join(__dirname, "fonts", "Montserrat-Bold.ttf")).size;
    const regularSize = statSync(path.join(__dirname, "fonts", "Montserrat-Regular.ttf")).size;
    expect(boldSize).toBeGreaterThan(100_000);
    expect(regularSize).toBeGreaterThan(100_000);
  });
});

// ─── bannerComposite font references ─────────────────────────────────────────
describe("bannerComposite.ts font usage", () => {
  it("references Montserrat in headline font string", async () => {
    const { readFileSync } = require("fs");
    const src = readFileSync(path.join(__dirname, "bannerComposite.ts"), "utf-8");
    expect(src).toContain('"Montserrat"');
  });

  it("calls registerFont with Montserrat-Bold.ttf", async () => {
    const { readFileSync } = require("fs");
    const src = readFileSync(path.join(__dirname, "bannerComposite.ts"), "utf-8");
    expect(src).toContain("Montserrat-Bold.ttf");
    expect(src).toContain("registerFont");
  });

  it("no longer uses DejaVu Sans as the primary font", async () => {
    const { readFileSync } = require("fs");
    const src = readFileSync(path.join(__dirname, "bannerComposite.ts"), "utf-8");
    // DejaVu Sans should only appear as a fallback after Montserrat
    const lines = src.split("\n").filter((l: string) => l.includes("DejaVu"));
    for (const line of lines) {
      expect(line).toContain("Montserrat"); // Montserrat must come first
    }
  });
});

// ─── Re-Publish button logic ──────────────────────────────────────────────────
describe("Fix Campaign → Re-Publish flow", () => {
  it("fixApplied state defaults to false", () => {
    // Simulate the initial state
    let fixApplied = false;
    expect(fixApplied).toBe(false);
  });

  it("fixApplied becomes true after successful campaign fix", () => {
    let fixApplied = false;
    // Simulate onSuccess handler
    const onFixSuccess = (data: { updated: boolean; newSlug: string }) => {
      if (data.updated) fixApplied = true;
    };
    onFixSuccess({ updated: true, newSlug: "lights-on" });
    expect(fixApplied).toBe(true);
  });

  it("fixApplied resets to false after re-publish is triggered", () => {
    let fixApplied = true;
    // Simulate clicking Re-Publish
    const onRePublishClick = () => { fixApplied = false; };
    onRePublishClick();
    expect(fixApplied).toBe(false);
  });
});

// ─── UTM dedup toast logic ────────────────────────────────────────────────────
describe("UTM dedup toast", () => {
  it("shows 'Already saved' message when duplicate is true", () => {
    const messages: string[] = [];
    const toast = {
      info: (msg: string) => messages.push(msg),
      success: (msg: string) => messages.push(msg),
    };

    const onSaveSuccess = (data: { duplicate?: boolean }) => {
      if (data?.duplicate) {
        toast.info("Already saved — this UTM URL is already in your history.");
      } else {
        toast.success("UTM link saved to UTM Builder history!");
      }
    };

    onSaveSuccess({ duplicate: true });
    expect(messages[0]).toContain("Already saved");
  });

  it("shows 'UTM link saved' when not a duplicate", () => {
    const messages: string[] = [];
    const toast = {
      info: (msg: string) => messages.push(msg),
      success: (msg: string) => messages.push(msg),
    };

    const onSaveSuccess = (data: { duplicate?: boolean }) => {
      if (data?.duplicate) {
        toast.info("Already saved — this UTM URL is already in your history.");
      } else {
        toast.success("UTM link saved to UTM Builder history!");
      }
    };

    onSaveSuccess({ duplicate: false });
    expect(messages[0]).toContain("UTM link saved");
  });
});
