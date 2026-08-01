/**
 * FINDING #10 STRUCTURAL FIX — `longtextJson()`
 *
 * THE BUG THIS EXISTS TO KILL
 * ---------------------------
 * 15 columns in drizzle/schema.ts were declared `json("col").$type<T>()` but are
 * physically LONGTEXT in MySQL (proven: docs/build-reports/v22r/probe_json_column_drift.mjs
 * reports MISMATCHED 15/15). For a genuine JSON column mysql2 parses the value
 * into a JS value; for LONGTEXT it hands back the raw string. Application code
 * then wrote things like:
 *
 *     const videoIds = (job.transcriptVideoIds ?? []) as string[];
 *
 * which is a COMPILE-TIME cast and does nothing at runtime. `videoIds` was a
 * 29-character string, so `inArray(col, videoIds)` emitted a single `?` bound to
 * that string and MariaDB rejected the SQL. Consequence: every "Deep Research
 * Mode: On" generation spent vidIQ + Supadata quota, wrote patterns, then threw
 * on read-back and silently produced an UNGROUNDED script.
 *
 * WHY A CUSTOM TYPE RATHER THAN PATCHING READ SITES
 * -------------------------------------------------
 * Patching each `as T[]` cast fixes the symptom where it is noticed and leaves
 * the schema still lying about the other columns. This type makes the
 * declaration honest: parse on read, stringify on write, one place.
 *
 * SAFETY PROPERTIES (all covered by longtextJson.test.ts)
 * - Never throws on read. Malformed/truncated JSON yields `null`, because a
 *   corrupt row must not take down a request.
 * - Passes arrays/objects through untouched, so it is safe on any column that a
 *   future migration converts to a real JSON type.
 * - Distinguishes SQL NULL (-> null) from the JSON string "null" (-> null) from
 *   the empty string (-> null). An empty LONGTEXT is how these columns are
 *   initialised, and it is not valid JSON.
 * - Does NOT coerce scalars into arrays. Callers that need an array use
 *   `asArray()` so the intent is explicit at the call site.
 */
import { customType } from "drizzle-orm/mysql-core";

export const longtextJson = <TData>(name: string) =>
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return "longtext";
    },
    fromDriver(value: unknown): TData {
      // Already-parsed values (real JSON column, or a driver that parses for us).
      if (value === null || value === undefined) return null as TData;
      if (typeof value === "object") return value as TData;
      if (typeof value !== "string") return value as TData;

      const trimmed = value.trim();
      if (trimmed === "" || trimmed === "null") return null as TData;

      try {
        return JSON.parse(trimmed) as TData;
      } catch {
        // A corrupt row must not break the request. Log once, return null, and
        // let the caller's `?? []` / `asArray()` handle the absence.
        console.warn(
          `[longtextJson] column "${name}" holds unparseable JSON (${trimmed.length} chars, starts: ${JSON.stringify(trimmed.slice(0, 40))})`
        );
        return null as TData;
      }
    },
    toDriver(value: TData): string {
      return JSON.stringify(value ?? null);
    },
  })(name);

/**
 * Explicit array coercion for reads.
 *
 * Use this instead of `(row.col ?? []) as T[]` — that cast is exactly what
 * caused finding #10. This function guarantees a real array at runtime and
 * tolerates the legacy case of a still-stringified value (rows written before
 * this fix, or by another process that stringified twice).
 */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null") return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Guard for `inArray()`.
 *
 * `inArray(col, [])` produces invalid SQL in several drizzle versions, and
 * `inArray(col, "…")` produced the finding #10 syntax error. Call sites should
 * check this before building the condition.
 */
export function hasItems<T>(value: unknown): value is T[] {
  return asArray<T>(value).length > 0;
}
