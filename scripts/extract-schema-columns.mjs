#!/usr/bin/env node
/**
 * Extract the authoritative table -> column map from drizzle/schema.ts.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A REGEX
 * ------------------------------------------
 * A first attempt scraped "the first quoted string after `name:`" out of each
 * mysqlTable body. It produced columns named `none`, `todo`, `pending`, `draft`,
 * `medium`, `instagram`, `youtube` — which are ENUM MEMBER STRINGS, not columns:
 *
 *     status: mysqlEnum("status", ["todo", "in_progress", "done"])
 *                                   ^^^^^^ scraped as a column name
 *
 * It also MISSED real columns whose declaration spans lines, because it was
 * line-anchored:
 *
 *     patternComposition: longtextJson<{
 *       total: number; ...
 *     }>("pattern_composition"),        <-- name is lines below the property
 *
 * Both failure directions are dangerous for the job this feeds: the false
 * positives would become `ADD COLUMN none` in production DDL, and the false
 * negatives would silently omit columns the app writes to, so writes would
 * typecheck and then not persist.
 *
 * APPROACH
 * Walk each `mysqlTable("name", { ... })` body with brace/paren/string-aware
 * scanning, split it into top-level `property: expression,` entries, and for
 * each entry take the FIRST string literal that sits at parenthesis depth 1 of
 * the column constructor — i.e. the constructor's own first argument — while
 * refusing to descend into array literals (where enum members live) or into
 * nested option objects (`{ length: 500 }`).
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(process.argv[2] ?? "drizzle/schema.ts", "utf8");

/** Scan forward from an opening delimiter to its match, respecting strings/comments. */
function matchDelim(text, start, open, close) {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++;
        i++;
      }
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else if (c === open) {
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Strip comments so doc-comment prose can never be mistaken for code. */
function stripComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") {
          out += text[i];
          i++;
        }
        out += text[i];
        i++;
      }
      out += text[i] ?? "";
      i++;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Split an object-literal body into top-level `key: value` entries.
 * Depth-aware so nested objects/arrays/generics do not split the entry.
 */
function topLevelEntries(body) {
  const entries = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++;
      while (i < body.length && body[i] !== q) {
        if (body[i] === "\\") i++;
        i++;
      }
    } else if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) {
      entries.push(body.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  entries.push(body.slice(start));
  return entries.map((e) => e.trim()).filter(Boolean);
}

/**
 * Given `propName: someType<...>("col_name", { ... })`, return "col_name".
 *
 * Rule: the column name is the first string literal appearing at paren depth 1
 * that is NOT inside an array literal (enum members) and NOT inside a nested
 * object literal (column options). Returns null for non-column entries such as
 * `(table) => ({ ... })` index definitions.
 *
 * SECOND FALSE-POSITIVE CLASS, found by this script's own self-check:
 * shared enum helpers declared elsewhere in the file are used WITHOUT a column
 * name argument, because the column name comes from the property key:
 *
 *     priority: vaTaskPriorityEnum.default("medium").notNull(),
 *     status:   vaTaskStatusEnum.default("todo").notNull(),
 *
 * Here `"medium"` and `"todo"` sit at paren depth 1 of `.default(...)`, so the
 * depth rule alone accepts them and yields columns named `medium` / `todo`.
 * The fix: only accept a literal whose opening paren belongs to the FIRST call
 * in the expression (the constructor), and reject any literal whose call is a
 * chained method — `.default(`, `.notNull(`, `.references(`, `.$type(` etc.
 * When no constructor-argument literal exists, fall back to the property key
 * converted from camelCase, which is what drizzle itself does for helper enums.
 */
function columnNameOf(entry) {
  const colon = entry.indexOf(":");
  if (colon === -1) return null;
  const propKey = entry.slice(0, colon).trim();
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propKey)) return null;
  const expr = entry.slice(colon + 1);
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      let lit = "";
      while (j < expr.length && expr[j] !== q) {
        if (expr[j] === "\\") j++;
        lit += expr[j];
        j++;
      }
      // Accept only a first-argument literal of the CONSTRUCTOR call: inside
      // exactly one paren, not in an options object, not in an enum array, and
      // not the argument of a chained builder method such as .default(...).
      const beforeParen = expr.slice(0, i).replace(/\s+$/, "");
      const isChainedCall = /\.\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\($/.test(beforeParen);
      if (parenDepth === 1 && braceDepth === 0 && bracketDepth === 0 && !isChainedCall) {
        if (/^[a-z0-9_]+$/i.test(lit)) return lit;
      }
      i = j + 1;
      continue;
    }
    if (c === "(") parenDepth++;
    else if (c === ")") parenDepth--;
    else if (c === "{") braceDepth++;
    else if (c === "}") braceDepth--;
    else if (c === "[") bracketDepth++;
    else if (c === "]") bracketDepth--;
    i++;
  }
  // Helper-enum / helper-column case: no constructor literal. Drizzle derives
  // the DB column from the property key, so mirror that (camelCase -> snake).
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(Enum|Column)?\s*\.?/.test(expr.trim()) && /\(/.test(expr)) {
    return propKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  }
  return null;
}

const clean = stripComments(src);
const tables = {};
const re = /mysqlTable\(\s*"([a-z0-9_]+)"\s*,\s*\{/g;
let m;
while ((m = re.exec(clean)) !== null) {
  const tableName = m.group ?? m[1];
  const braceStart = clean.indexOf("{", m.index + m[0].length - 1);
  const braceEnd = matchDelim(clean, braceStart, "{", "}");
  if (braceEnd === -1) continue;
  const body = clean.slice(braceStart + 1, braceEnd);
  const cols = [];
  for (const entry of topLevelEntries(body)) {
    const name = columnNameOf(entry);
    if (name) cols.push(name);
  }
  tables[tableName] = cols;
}

const out = process.argv[3] ?? "/tmp/schema_columns.json";
writeFileSync(out, JSON.stringify(tables, null, 2));
console.log(`tables parsed: ${Object.keys(tables).length}`);
console.log(`wrote: ${out}`);

// Self-check on the table this deployment cares most about, plus a guard that
// no obvious enum-member string slipped through as a column name.
const sf = tables["script_factory_outputs"] ?? [];
console.log(`\nscript_factory_outputs: ${sf.length} columns`);
console.log(sf.join(", "));

const suspicious = ["none", "todo", "pending", "draft", "medium", "instagram", "youtube", "linkedin", "discovered"];
const hits = [];
for (const [t, cols] of Object.entries(tables)) {
  for (const c of cols) if (suspicious.includes(c)) hits.push(`${t}.${c}`);
}
console.log(`\nenum-member false positives: ${hits.length === 0 ? "NONE (good)" : hits.join(", ")}`);
