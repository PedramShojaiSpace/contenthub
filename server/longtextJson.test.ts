/**
 * Tests for the finding #10 structural fix.
 *
 * The critical fixtures are the REAL values the mysql2 driver returned from the
 * live scratch database, captured by docs/build-reports/v22r/probe_inarray_app.ts:
 *   typeof = string, Array.isArray = false, length = 29
 *   value  = ["lHEg6dNHTBk","-orMGt5tzuY"]
 * Hand-written fixtures are what let this class of bug survive Part 1, so the
 * driver's own output is used here rather than invented data.
 */
import { describe, expect, it, vi } from "vitest";
import { int, mysqlTable } from "drizzle-orm/mysql-core";
import { asArray, hasItems, longtextJson } from "../drizzle/longtextJson";

// The captured driver value, verbatim.
const REAL_DRIVER_VALUE = '["lHEg6dNHTBk","-orMGt5tzuY"]';

/*
 * `longtextJson("x")` returns a MySqlCustomColumnBuilder, NOT a column. The
 * mappers only exist after `mysqlTable()` builds it, and they must stay BOUND to
 * the column instance — an unbound reference throws "Cannot read properties of
 * undefined (reading 'mapFrom')". Confirmed with
 * docs/build-reports/v22r/probe_customtype_shape.ts rather than assumed; the
 * first version of this file guessed the API and all 10 tests errored.
 */
type Mapped<T> = {
  read: (v: unknown) => T;
  write: (v: T) => string;
  sqlType: () => string;
};
function buildColumn<T>(name: string): Mapped<T> {
  const table = mysqlTable(`probe_${name}`, {
    id: int("id"),
    value: longtextJson<T>(name),
  });
  const col = table.value as unknown as {
    getSQLType: () => string;
    mapFromDriverValue: (v: unknown) => T;
    mapToDriverValue: (v: T) => string;
  };
  return {
    read: (v) => col.mapFromDriverValue(v),
    write: (v) => col.mapToDriverValue(v),
    sqlType: () => col.getSQLType(),
  };
}

describe("longtextJson — the finding #10 fix", () => {
  const { read, write, sqlType } = buildColumn<string[]>("transcript_video_ids");

  it("declares longtext, matching the physical column", () => {
    expect(sqlType()).toBe("longtext");
  });

  it("THE BUG: parses the exact string the driver returned for job #3", () => {
    const out = read(REAL_DRIVER_VALUE);
    expect(Array.isArray(out)).toBe(true);
    expect(out).toEqual(["lHEg6dNHTBk", "-orMGt5tzuY"]);
    // Before the fix this was a 29-char string, which is what broke inArray.
    expect(out).toHaveLength(2);
    expect(REAL_DRIVER_VALUE).toHaveLength(29);
  });

  it("passes through an already-parsed array (real JSON column / future migration)", () => {
    const parsed = ["a", "b"];
    expect(read(parsed)).toBe(parsed);
  });

  it("treats SQL NULL, the empty string, and 'null' as absent", () => {
    expect(read(null)).toBeNull();
    expect(read(undefined)).toBeNull();
    expect(read("")).toBeNull();
    expect(read("   ")).toBeNull();
    expect(read("null")).toBeNull();
  });

  it("never throws on corrupt JSON — returns null and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => read('["truncated…')).not.toThrow();
    expect(read('["truncated…')).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain("transcript_video_ids");
    warn.mockRestore();
  });

  it("round-trips through toDriver/fromDriver", () => {
    const value = ["x1", "y2", "z3"];
    expect(read(write(value))).toEqual(value);
  });

  it("writes JSON text, not [object Object]", () => {
    expect(write(["a", "b"])).toBe('["a","b"]');
    expect(write(null as unknown as string[])).toBe("null");
  });

  it("handles nested objects, e.g. research_jobs.outlier_videos", () => {
    const { read: r } = buildColumn<{ videoId: string; views: number }[]>("outlier_videos");
    const raw = JSON.stringify([{ videoId: "abc", views: 1200 }]);
    expect(r(raw)).toEqual([{ videoId: "abc", views: 1200 }]);
  });

  it("does NOT wrap scalars into arrays — coercion must be explicit", () => {
    const { read: r } = buildColumn<number>("n");
    expect(r("42")).toBe(42);
  });
});

describe("asArray — the safe replacement for `as T[]` casts", () => {
  it("parses the real driver string", () => {
    expect(asArray<string>(REAL_DRIVER_VALUE)).toEqual(["lHEg6dNHTBk", "-orMGt5tzuY"]);
  });

  it("passes arrays through", () => {
    expect(asArray<number>([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("returns [] for every absent form", () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray("")).toEqual([]);
    expect(asArray("null")).toEqual([]);
  });

  it("returns [] rather than throwing on corrupt or non-array JSON", () => {
    expect(asArray('{"not":"an array"}')).toEqual([]);
    expect(asArray("[1,2")).toEqual([]);
    expect(asArray(42)).toEqual([]);
  });

  /*
   * Deliberately NOT unwrapping double-stringified values.
   *
   * The first version of this test asserted that `asArray` should recover a
   * value stringified twice. Making that pass requires parsing repeatedly until
   * the result stops being a string, which would also "helpfully" parse a
   * legitimate string element that merely looks like JSON. Silently reshaping
   * data on a guess is the failure mode this whole fix exists to remove, so a
   * double-stringified value is treated as absent and the caller sees [].
   */
  it("treats a double-stringified value as absent rather than guessing", () => {
    expect(asArray<string>(JSON.stringify(REAL_DRIVER_VALUE))).toEqual([]);
  });
});

describe("hasItems — the inArray guard", () => {
  it("is true only for non-empty arrays, in any representation", () => {
    expect(hasItems(REAL_DRIVER_VALUE)).toBe(true);
    expect(hasItems(["a"])).toBe(true);
    expect(hasItems([])).toBe(false);
    expect(hasItems("[]")).toBe(false);
    expect(hasItems(null)).toBe(false);
    expect(hasItems("")).toBe(false);
  });
});
