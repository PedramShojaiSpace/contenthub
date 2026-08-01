/**
 * `longtextJson("x")` returns a drizzle column BUILDER, not a built column, so
 * `getSQLType()` / `mapFromDriverValue` are not on it directly. Print the real
 * shape instead of guessing at the API — the guess is what made the first test
 * run fail with "mapper is not a function".
 */
import { longtextJson } from "../../../drizzle/longtextJson";
import { mysqlTable, int } from "drizzle-orm/mysql-core";

const builder = longtextJson<string[]>("transcript_video_ids");
console.log("=== builder ===");
console.log("constructor:", builder?.constructor?.name);
console.log("own keys   :", Object.keys(builder as object));
console.log("proto keys :", Object.getOwnPropertyNames(Object.getPrototypeOf(builder as object)));

// Build it through a table, which is how the app uses it.
const t = mysqlTable("probe_t", {
  id: int("id"),
  ids: longtextJson<string[]>("transcript_video_ids"),
});
const col = t.ids as unknown as Record<string, unknown>;
console.log();
console.log("=== built column (via mysqlTable) ===");
console.log("constructor:", (t.ids as object)?.constructor?.name);
console.log(
  "proto keys :",
  Object.getOwnPropertyNames(Object.getPrototypeOf(t.ids as object)).slice(0, 40)
);
console.log("getSQLType :", typeof col.getSQLType === "function" ? (col.getSQLType as () => string)() : "(absent)");
console.log("mapFromDriverValue:", typeof col.mapFromDriverValue);
console.log("mapToDriverValue  :", typeof col.mapToDriverValue);

if (typeof col.mapFromDriverValue === "function") {
  const f = col.mapFromDriverValue as (v: unknown) => unknown;
  const out = f('["lHEg6dNHTBk","-orMGt5tzuY"]');
  console.log();
  console.log("mapFromDriverValue(real driver string) ->", JSON.stringify(out));
  console.log("Array.isArray:", Array.isArray(out));
}
process.exit(0);
