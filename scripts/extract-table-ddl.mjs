#!/usr/bin/env node
/**
 * Emit exact SQL types for every column of a given table, read from
 * drizzle/schema.ts — which is the authority for what the RUNNING CODE expects.
 *
 * WHY NOT REUSE THE REPO'S MIGRATIONS
 * -----------------------------------
 * drizzle/0124 does contain hand-written, previously-applied CREATE TABLE bodies
 * for these tables, and lifting them looked like the safe move. On inspection it
 * is not: 0124 declares `analog_data_entry_ids`, `recommended_patterns`,
 * `vidiq_data` and `outlier_videos` as `JSON`, while today's schema.ts declares
 * them through `longtextJson()`, whose dataType() returns "longtext".
 *
 * That is a real behavioural difference, not a cosmetic one: a JSON column
 * validates and rejects malformed input, longtext accepts anything and the app
 * parses it (see drizzle/longtextJson.ts, "FINDING #10 STRUCTURAL FIX" — the
 * move away from JSON was a deliberate later correction). Creating JSON columns
 * that the current code treats as longtext would typecheck perfectly and then
 * misbehave at the database boundary.
 *
 * 0124 and schema.ts also disagree on more than types: 0124's
 * `suggested_ideas.idea_source` enum has 2 members where schema.ts has 3, and
 * schema.ts carries a `topic_node_id` column 0124 never creates.
 *
 * So: schema.ts is the authority here, and every JSON->LONGTEXT substitution is
 * deliberate and annotated in the emitted SQL.
 *
 * WHY NOT THE QUICK PARSER FROM EARLIER
 * A first pass at this produced `outlier_videos LONGTEXT NOT NULL DEFAULT 0` and
 * attached a status column's DEFAULT 'active' to vidiq_data, because it matched
 * `.notNull()` / `.default()` anywhere in a multi-line entry rather than binding
 * them to the column being declared. This version isolates each top-level
 * property with brace-aware scanning FIRST, strips comments, then reads
 * modifiers only from that property's own text.
 */
import { readFileSync } from "node:fs";

const src = readFileSync("drizzle/schema.ts", "utf8");

function stripComments(text) {
  let out = "", i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c; out += c; i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === "\\") { out += text[i]; i++; }
        out += text[i]; i++;
      }
      out += text[i] ?? ""; i++;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else { out += c; i++; }
  }
  return out;
}

function tableBody(text, table) {
  const i = text.indexOf(`mysqlTable("${table}"`);
  if (i === -1) return null;
  const open = text.indexOf("{", i);
  let d = 0, j = open;
  for (; j < text.length; j++) {
    const c = text[j];
    if (c === '"' || c === "'" || c === "`") {
      const q = c; j++;
      while (j < text.length && text[j] !== q) { if (text[j] === "\\") j++; j++; }
      continue;
    }
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) break; }
  }
  return text.slice(open + 1, j);
}

function topLevelEntries(body) {
  const out = []; let depth = 0, start = 0, i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < body.length && body[i] !== q) { if (body[i] === "\\") i++; i++; }
    } else if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
    i++;
  }
  out.push(body.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The column name is the constructor's first string arg, not a .default() arg. */
function columnName(entry) {
  const colon = entry.indexOf(":");
  if (colon === -1) return null;
  const expr = entry.slice(colon + 1);
  let paren = 0, brace = 0, bracket = 0, i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1, lit = "";
      while (j < expr.length && expr[j] !== q) { if (expr[j] === "\\") j++; lit += expr[j]; j++; }
      const before = expr.slice(0, i).replace(/\s+$/, "");
      const chained = /\.\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\($/.test(before);
      if (paren === 1 && brace === 0 && bracket === 0 && !chained && /^[a-z0-9_]+$/i.test(lit)) return lit;
      i = j + 1; continue;
    }
    if (c === "(") paren++; else if (c === ")") paren--;
    else if (c === "{") brace++; else if (c === "}") brace--;
    else if (c === "[") bracket++; else if (c === "]") bracket--;
    i++;
  }
  return null;
}

/** Read the SQL type from this property's own expression only. */
function sqlType(entry) {
  const expr = entry.slice(entry.indexOf(":") + 1).trim();
  // longtextJson<...>("col") -> LONGTEXT  (see header: NOT JSON)
  if (/^longtextJson\s*</.test(expr) || /^longtextJson\s*\(/.test(expr)) return { type: "LONGTEXT", wasJsonInMigration: true };
  if (/^mysqlEnum\s*\(/.test(expr)) {
    // Members are the array literal that is the constructor's 2nd argument.
    const open = expr.indexOf("[");
    let d = 0, j = open;
    for (; j < expr.length; j++) { if (expr[j] === "[") d++; else if (expr[j] === "]") { d--; if (d === 0) break; } }
    const arr = expr.slice(open + 1, j);
    const members = [...arr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    return { type: `ENUM(${members.map((m) => `'${m}'`).join(",")})` };
  }
  if (/^varchar\s*\(/.test(expr)) {
    const m = expr.match(/length:\s*(\d+)/);
    return { type: `VARCHAR(${m ? m[1] : 255})` };
  }
  if (/^int\s*\(/.test(expr)) return { type: "INT" };
  if (/^bigint\s*\(/.test(expr)) return { type: "BIGINT" };
  if (/^text\s*\(/.test(expr)) return { type: "TEXT" };
  if (/^datetime\s*\(/.test(expr)) return { type: "DATETIME" };
  if (/^boolean\s*\(/.test(expr)) return { type: "BOOLEAN" };
  if (/^float\s*\(/.test(expr)) return { type: "FLOAT" };
  if (/^decimal\s*\(/.test(expr)) return { type: "DECIMAL(10,2)" };
  return { type: "UNKNOWN" };
}

function modifiers(entry) {
  const expr = entry.slice(entry.indexOf(":") + 1);
  const notNull = /\.notNull\(\)/.test(expr);
  const pk = /\.primaryKey\(\)/.test(expr);
  const ai = /\.autoincrement\(\)/.test(expr);
  let def = null;
  // .default(<literal>) — take only a simple literal; sql`` and $defaultFn are app-side.
  const dm = expr.match(/\.default\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|true|false|-?\d+(?:\.\d+)?)\s*\)/);
  if (dm) def = dm[1].replace(/^"|"$/g, "'").replace(/^'|'$/g, "'");
  const sqlDefault = /\.default\(\s*sql`([^`]*)`\s*\)/.exec(expr);
  if (sqlDefault) def = sqlDefault[1];
  const hasDefaultFn = /\.\$defaultFn\(/.test(expr);
  return { notNull, pk, ai, def, hasDefaultFn };
}

const clean = stripComments(src);
const tables = process.argv.slice(2);
for (const t of tables.length ? tables : ["research_jobs", "suggested_ideas", "topic_nodes"]) {
  const body = tableBody(clean, t);
  if (!body) { console.log(`\n### ${t}: NOT FOUND in schema.ts`); continue; }
  console.log(`\n### ${t}`);
  for (const entry of topLevelEntries(body)) {
    const name = columnName(entry);
    if (!name) continue;
    const { type, wasJsonInMigration } = sqlType(entry);
    const m = modifiers(entry);
    let line = `  \`${name}\` ${type}`;
    if (m.ai) line += " AUTO_INCREMENT";
    line += m.notNull ? " NOT NULL" : " NULL";
    if (m.def !== null) line += ` DEFAULT ${/^[A-Z_]+\(?\)?$|CURRENT_TIMESTAMP/.test(m.def) ? m.def : m.def.startsWith("'") ? m.def : `'${m.def}'`}`;
    const notes = [];
    if (m.pk) notes.push("PRIMARY KEY");
    if (wasJsonInMigration) notes.push("was JSON in 0124 -> LONGTEXT per current schema.ts");
    if (m.hasDefaultFn) notes.push("app-side $defaultFn, no SQL default");
    console.log(line + (notes.length ? `   -- ${notes.join("; ")}` : ""));
  }
}
