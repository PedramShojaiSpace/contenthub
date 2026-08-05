#!/usr/bin/env node
/**
 * COLUMN NAME VERIFICATION TABLE  (TypeScript AST based)
 *
 * Prints every SQL column name the production migration creates, beside the
 * exact declaration in drizzle/schema.ts that produces it, so a reviewer can
 * check the whole set in one pass rather than trusting a tool.
 *
 * ── WHY THIS IS AN AST WALK AND NOT A REGEX ──────────────────────────────────
 * Four hand-rolled parsers were written before this one. Each was patched at the
 * symptom and each then failed somewhere new:
 *
 *   1. Enum MEMBERS read as column names.
 *      `mysqlEnum("status", ["todo", ...])` -> emitted a column named `todo`.
 *      Would have generated `ADD COLUMN none` against production.
 *
 *   2. Shared enum helper `.default()` literals read as column names.
 *      `vaTaskStatusEnum.default("todo")` -> emitted `todo` again.
 *
 *   3. Shared enum helper property KEY used as the column name.
 *      `productionStatus: scriptStatusEnum...` -> invented `production_status`.
 *      The real SQL name is "scriptStatus", declared 16 lines away in the helper.
 *      This produced a phantom "missing column" AND a phantom drift pair, and
 *      was only caught because the reviewer knew the codebase.
 *
 *   4. Multi-line generics lost to quote/comment precedence.
 *      `longtextJson<{ ...1482 chars of type and prose comments... }>("generation_params")`
 *      An apostrophe inside a /* *\/ comment opened a string literal that never
 *      closed, the scan lost its place, and `generation_params` and
 *      `section_history` silently vanished from this very table — under-reporting
 *      the thing the table exists to confirm.
 *
 * The common cause is a tokeniser that guesses when it loses its place. The fix
 * is to stop guessing: TypeScript's own parser produces the real syntax tree, so
 * comments, string escapes, nested generics and helper references are all handled
 * by the same code that compiles the project.
 *
 * INVARIANT: a column name is only ever read from a real StringLiteral in the
 * initialiser's argument list, or from the resolved declaration of a referenced
 * helper. If neither is available the row prints UNRESOLVED and the script exits
 * non-zero. A visible gap gets checked by a human; a plausible wrong name does not.
 *
 * Requires the `typescript` package. In a clone without node_modules:
 *   mkdir -p /tmp/tsonly && cd /tmp/tsonly && npm install --no-save typescript@5.9.3
 *   NODE_PATH=/tmp/tsonly/node_modules node scripts/verify-column-names.mjs
 * (a plain `npm install typescript` inside the repo fails on an unrelated
 *  pre-existing peer conflict: @builder.io/vite-plugin-jsx-loc wants vite ^4||^5)
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  try {
    ts = require("/tmp/tsonly/node_modules/typescript");
  } catch {
    console.error("typescript not found. See the header of this file for the one-line install.");
    process.exit(2);
  }
}

const FILE = "drizzle/schema.ts";
const src = readFileSync(FILE, "utf8");
const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.Latest, true);

const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/** First string-literal argument of a call expression, else null. */
function firstStringArg(node) {
  if (!ts.isCallExpression(node)) return null;
  for (const arg of node.arguments) {
    if (ts.isStringLiteral(arg)) return arg.text;
  }
  return null;
}

/** Walk down a chained expression (a.b().c()) to the innermost call. */
function rootCall(node) {
  let cur = node;
  while (cur) {
    if (ts.isCallExpression(cur)) {
      const s = firstStringArg(cur);
      if (s !== null) return { call: cur, sqlName: s };
      cur = cur.expression;
    } else if (ts.isPropertyAccessExpression(cur)) {
      cur = cur.expression;
    } else break;
  }
  return null;
}

/** Identifier at the base of a chain, e.g. scriptStatusEnum in x.notNull(). */
function baseIdentifier(node) {
  let cur = node;
  while (cur) {
    if (ts.isIdentifier(cur)) return cur.text;
    if (ts.isCallExpression(cur) || ts.isPropertyAccessExpression(cur)) cur = cur.expression;
    else return null;
  }
  return null;
}

// ── Pass 1: every top-level `export const X = <columnBuilder>("sql_name", ...)`
const helpers = new Map();   // identifier -> { sqlName, line }
for (const stmt of sf.statements) {
  if (!ts.isVariableStatement(stmt)) continue;
  for (const decl of stmt.declarationList.declarations) {
    if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
    const r = rootCall(decl.initializer);
    if (r) helpers.set(decl.name.text, { sqlName: r.sqlName, line: lineOf(decl) });
  }
}

// ── Pass 2: mysqlTable("name", { ...columns })
const tables = new Map();    // tableName -> [{ property, sqlName, line, decl, source }]
function visit(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "mysqlTable") {
    const [nameArg, objArg] = node.arguments;
    if (nameArg && ts.isStringLiteral(nameArg) && objArg && ts.isObjectLiteralExpression(objArg)) {
      const cols = [];
      for (const prop of objArg.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const property = prop.name.getText(sf);
        const init = prop.initializer;
        const line = lineOf(prop);
        // one-line rendering of the declaration, comments removed
        let declText = init.getText(sf).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
                          .replace(/\s+/g, " ").trim();

        const inline = rootCall(init);
        if (inline) {
          cols.push({ property, sqlName: inline.sqlName, line, decl: declText, source: "inline" });
          continue;
        }
        const base = baseIdentifier(init);
        if (base && helpers.has(base)) {
          const h = helpers.get(base);
          cols.push({ property, sqlName: h.sqlName, line, decl: declText, source: `helper ${base} @:${h.line}` });
          continue;
        }
        cols.push({ property, sqlName: "UNRESOLVED", line, decl: declText, source: "UNRESOLVED" });
      }
      tables.set(nameArg.text, cols);
    }
  }
  ts.forEachChild(node, visit);
}
visit(sf);

// ── Scope: exactly what the production migration creates or adds.
const ADDED_COLUMNS = {
  script_factory_outputs: [
    "persona_id","analog_data_entry_ids","target_length_minutes","source_idea_id",
    "research_job_id","word_count","production_script_id","pattern_composition",
    "parent_script_id","variant_label","variant_of_root_id","generation_params",
    "section_history","metric_version",
  ],
  analog_data_entries: ["offer_profile"],
};
const NEW_TABLES = ["research_jobs", "suggested_ideas", "topic_nodes"];

const W = 24;
let printed = 0, unresolved = 0, missing = [];

console.log("Every SQL column name in the migration, against its declaration in drizzle/schema.ts");
console.log("Generated by: node scripts/verify-column-names.mjs   (TypeScript AST, not regex)");
console.log("");
console.log("SQL COLUMN NAME".padEnd(W) + " | LINE  | DECLARATION");
console.log("-".repeat(W) + "-+-------+" + "-".repeat(60));

for (const [table, wanted] of Object.entries(ADDED_COLUMNS)) {
  const cols = tables.get(table);
  console.log(`\nALTER TABLE ${table}`);
  if (!cols) { console.log("  !! table not found in schema.ts"); continue; }
  for (const name of wanted) {
    const hit = cols.find((c) => c.sqlName === name);
    if (!hit) { missing.push(`${table}.${name}`); console.log(`${name.padEnd(W)} | ????? | !! NOT FOUND in schema.ts`); continue; }
    printed++;
    if (hit.sqlName === "UNRESOLVED") unresolved++;
    const d = hit.decl.length > 58 ? hit.decl.slice(0, 55) + "..." : hit.decl;
    console.log(`${hit.sqlName.padEnd(W)} | :${String(hit.line).padEnd(5)}| ${hit.property}: ${d}`);
  }
}

for (const table of NEW_TABLES) {
  const cols = tables.get(table);
  console.log(`\nCREATE TABLE ${table}`);
  if (!cols) { console.log("  !! table not found in schema.ts"); continue; }
  for (const c of cols) {
    printed++;
    if (c.sqlName === "UNRESOLVED") unresolved++;
    const d = c.decl.length > 58 ? c.decl.slice(0, 55) + "..." : c.decl;
    const flag = c.source.startsWith("helper") ? "  [" + c.source + "]" : "";
    console.log(`${c.sqlName.padEnd(W)} | :${String(c.line).padEnd(5)}| ${c.property}: ${d}${flag}`);
  }
}

console.log("\n" + "=".repeat(96));
console.log(`columns printed: ${printed}   UNRESOLVED: ${unresolved}   NOT FOUND: ${missing.length}`);
if (missing.length) console.log("NOT FOUND: " + missing.join(", "));
if (unresolved || missing.length) {
  console.log("\n!! Do not infer any UNRESOLVED name from its property key. That is the mistake");
  console.log("!! that invented `scripts.production_status` (real SQL name: scriptStatus).");
  process.exitCode = 1;
} else {
  console.log("All names resolve to an explicit string literal in schema.ts, or to a named helper.");
}
