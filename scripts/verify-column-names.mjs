#!/usr/bin/env node
/**
 * COLUMN NAME VERIFICATION TABLE  (TypeScript AST based, cross-checked against the SQL)
 *
 * Prints every SQL column name the production migration creates, beside the exact
 * declaration in drizzle/schema.ts that produces it, AND asserts that the set of
 * column names in docs/deploy/v24-production-migration.sql matches the set derived
 * from schema.ts, per table, in both directions.
 *
 * The artifact's only job is reviewer trust. It earns that by being checked against
 * something other than its own author's reading of it.
 *
 * ── FIVE PARSERS FAILED BEFORE THIS ONE. ALL THE SAME WAY. ───────────────────────
 * Each was patched at the symptom, and each then failed somewhere new:
 *
 *   1. Enum MEMBERS read as column names.
 *      `mysqlEnum("status", ["todo", ...])` -> emitted a column named `todo`.
 *      Would have generated `ADD COLUMN none` against production.
 *
 *   2. Shared enum helper `.default()` literal read as the column name.
 *      `vaTaskStatusEnum.default("todo")` -> emitted `todo` again.
 *
 *   3. Shared enum helper property KEY used as the column name.
 *      `productionStatus: scriptStatusEnum...` -> invented `production_status`.
 *      The real SQL name is "scriptStatus", declared 16 lines away in the helper.
 *      This produced a phantom missing column AND a phantom drift pair, and was
 *      only caught because the reviewer knew the codebase.
 *
 *   4. Multi-line generics lost to quote/comment precedence.
 *      An apostrophe inside a block comment inside `longtextJson<{...}>` opened a
 *      string literal that never closed; `generation_params` and `section_history`
 *      silently vanished from this very table.
 *
 *   5. THE AST WALKER'S OWN VERSION OF #2, which shipped to the reviewer.
 *      `rootCall()` walked the chain OUTSIDE-IN and returned the first call that had
 *      any string argument. For
 *          mysqlEnum("research_status", [...]).notNull().default("pending")
 *      the outermost `.default("pending")` matched first, so the row printed
 *      `pending` as the SQL name and never reached `mysqlEnum`. Six rows were wrong:
 *      pending, manual_generate, suggested, manual, active, and `path` — whose
 *      `.default("")` resolved to the EMPTY STRING, which the UNRESOLVED detector
 *      did not catch, so the summary read "UNRESOLVED: 0" while six rows lied.
 *
 * THE PRINCIPLE I KEPT MISSING, now enforced structurally:
 *   A column's SQL name comes from the FIRST ARGUMENT of the COLUMN-CONSTRUCTOR call.
 *   Not from the outermost call. Not from the first string found anywhere in the
 *   chain. Not from the TypeScript property key. If the constructor is not one we
 *   recognise, the answer is UNRESOLVED — never a guess.
 *
 * INVARIANTS (each exits non-zero when violated):
 *   - every name resolves from a recognised column constructor's first argument
 *   - an empty or whitespace-only resolved name is UNRESOLVED, not a name
 *   - the SQL and schema.ts agree on the column set of every table, both directions
 *
 * Requires the `typescript` package. In a clone without node_modules:
 *   mkdir -p /tmp/tsonly && cd /tmp/tsonly && npm install --no-save typescript@5.9.3
 *   NODE_PATH=/tmp/tsonly/node_modules node scripts/verify-column-names.mjs
 * Use `pnpm install` for the repo proper; `npm install` fails on a pre-existing
 * peer conflict (@builder.io/vite-plugin-jsx-loc wants vite ^4||^5, project is on 7).
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

const SCHEMA_FILE = "drizzle/schema.ts";
const SQL_FILE = "docs/deploy/v24-production-migration.sql";

const src = readFileSync(SCHEMA_FILE, "utf8");
const sf = ts.createSourceFile(SCHEMA_FILE, src, ts.ScriptTarget.Latest, true);
const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/**
 * Drizzle column constructors. A name is only ever taken from the first argument
 * of one of these. `longtextJson` is this repo's custom builder (FINDING #10:
 * returns dataType "longtext"), included because it declares real columns.
 */
const COLUMN_CONSTRUCTORS = new Set([
  "varchar", "text", "mediumtext", "longtext", "char",
  "int", "tinyint", "smallint", "mediumint", "bigint", "serial",
  "float", "double", "decimal", "real",
  "boolean", "binary", "varbinary",
  "date", "datetime", "time", "timestamp", "year",
  "json", "mysqlEnum", "vector",
  "longtextJson",
]);

/** The callee name of a call expression, unwrapping generics: longtextJson<T>(...) -> "longtextJson". */
function calleeName(call) {
  let expr = call.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

/**
 * Resolve the SQL name from an initialiser expression.
 *
 * Descends the chain to collect EVERY call expression, then picks the innermost one
 * whose callee is a recognised column constructor and reads its FIRST argument.
 * Deliberately ignores every other call in the chain -- .notNull(), .default(),
 * .autoincrement(), .primaryKey(), .references() -- because a string inside any of
 * those is a default value or a target, never the column name. That confusion is
 * failure modes #2 and #5 above.
 *
 * Returns { sqlName, ctor } or null.
 */
function resolveFromConstructor(node) {
  const calls = [];
  let cur = node;
  while (cur) {
    if (ts.isCallExpression(cur)) {
      calls.push(cur);
      cur = cur.expression;
    } else if (ts.isPropertyAccessExpression(cur)) {
      cur = cur.expression;
    } else if (ts.isNonNullExpression(cur) || ts.isParenthesizedExpression(cur) || ts.isAsExpression(cur)) {
      cur = cur.expression;
    } else break;
  }
  // calls[] is outermost-first; iterate in reverse so the INNERMOST wins.
  for (let i = calls.length - 1; i >= 0; i--) {
    const call = calls[i];
    const name = calleeName(call);
    if (!name || !COLUMN_CONSTRUCTORS.has(name)) continue;
    const first = call.arguments[0];
    // POSITIONALLY first, and it must actually be a string literal.
    if (first && ts.isStringLiteral(first)) return { sqlName: first.text, ctor: name };
    return null; // recognised constructor, non-literal name -> refuse to guess
  }
  return null;
}

/** Identifier at the base of a chain, e.g. scriptStatusEnum in scriptStatusEnum.notNull(). */
function baseIdentifier(node) {
  let cur = node;
  while (cur) {
    if (ts.isIdentifier(cur)) return cur.text;
    if (ts.isCallExpression(cur) || ts.isPropertyAccessExpression(cur)) cur = cur.expression;
    else return null;
  }
  return null;
}

const isBlank = (s) => typeof s !== "string" || s.trim() === "";

// ── Pass 1: top-level `export const X = <columnConstructor>("sql_name", ...)` helpers
const helpers = new Map();
for (const stmt of sf.statements) {
  if (!ts.isVariableStatement(stmt)) continue;
  for (const decl of stmt.declarationList.declarations) {
    if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
    const r = resolveFromConstructor(decl.initializer);
    if (r && !isBlank(r.sqlName)) helpers.set(decl.name.text, { sqlName: r.sqlName, line: lineOf(decl), ctor: r.ctor });
  }
}

// ── Pass 2: mysqlTable("name", { ...columns })
const tables = new Map();
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
        const declText = init.getText(sf)
          .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
          .replace(/\s+/g, " ").trim();

        const inline = resolveFromConstructor(init);
        if (inline && !isBlank(inline.sqlName)) {
          cols.push({ property, sqlName: inline.sqlName, line, decl: declText, source: `ctor ${inline.ctor}` });
          continue;
        }
        const base = baseIdentifier(init);
        if (base && helpers.has(base)) {
          const h = helpers.get(base);
          cols.push({ property, sqlName: h.sqlName, line, decl: declText, source: `helper ${base} @:${h.line}` });
          continue;
        }
        // Includes the empty-string case: a blank name is a gap, not a name.
        const why = inline && isBlank(inline.sqlName) ? "UNRESOLVED (blank name)" : "UNRESOLVED";
        cols.push({ property, sqlName: "UNRESOLVED", line, decl: declText, source: why });
      }
      tables.set(nameArg.text, cols);
    }
  }
  ts.forEachChild(node, visit);
}
visit(sf);

// ── Pass 3: parse the migration SQL for the column names it actually writes.
// Comment-stripped first, so commented-out sections (e.g. the deferred Section 4)
// are correctly excluded rather than counted.
function parseMigrationSql(text) {
  const noComments = text
    .split("\n")
    .map((l) => (l.trimStart().startsWith("--") ? "" : l.replace(/--.*$/, "")))
    .join("\n");

  const out = new Map();
  const add = (t, c) => {
    if (!out.has(t)) out.set(t, new Set());
    out.get(t).add(c);
  };

  // ALTER TABLE `t` ... ADD COLUMN `c`
  const alterRe = /ALTER\s+TABLE\s+`?(\w+)`?([\s\S]*?);/gi;
  let m;
  while ((m = alterRe.exec(noComments))) {
    const table = m[1];
    const body = m[2];
    const colRe = /ADD\s+COLUMN\s+`?(\w+)`?/gi;
    let c;
    while ((c = colRe.exec(body))) add(table, c[1]);
  }

  // CREATE TABLE `t` ( ... )
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\n\)/gi;
  while ((m = createRe.exec(noComments))) {
    const table = m[1];
    for (const raw of m[2].split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|KEY|INDEX|FOREIGN\s+KEY)\b/i.test(line)) continue;
      const cm = line.match(/^`(\w+)`/);
      if (cm) add(table, cm[1]);
    }
  }
  return out;
}

const sqlCols = parseMigrationSql(readFileSync(SQL_FILE, "utf8"));

// ── Scope: exactly what the production migration touches.
const ALTERED_TABLES = ["script_factory_outputs", "analog_data_entries"];
const NEW_TABLES = ["research_jobs", "suggested_ideas", "topic_nodes"];

const W = 24;
let printed = 0, unresolved = 0;
const missing = [];

console.log("Every SQL column name in the migration, against its declaration in drizzle/schema.ts");
console.log(`Generated by: node scripts/verify-column-names.mjs`);
console.log(`Sources: ${SCHEMA_FILE} (TypeScript AST)  x  ${SQL_FILE} (parsed)`);
console.log("Names are read from the column CONSTRUCTOR's first argument only -- never from");
console.log(".default(), .notNull(), or the TypeScript property key. See this script's header.");
console.log("");
console.log("SQL COLUMN NAME".padEnd(W) + " | LINE  | DECLARATION");
console.log("-".repeat(W) + "-+-------+" + "-".repeat(60));

function printRow(c) {
  printed++;
  if (c.sqlName === "UNRESOLVED") unresolved++;
  const d = c.decl.length > 58 ? c.decl.slice(0, 55) + "..." : c.decl;
  const flag = c.source.startsWith("helper") ? "  [" + c.source + "]" : "";
  console.log(`${c.sqlName.padEnd(W)} | :${String(c.line).padEnd(5)}| ${c.property}: ${d}${flag}`);
}

for (const table of ALTERED_TABLES) {
  const cols = tables.get(table);
  const wanted = [...(sqlCols.get(table) ?? [])];
  console.log(`\nALTER TABLE ${table}   (${wanted.length} columns added by the SQL)`);
  if (!cols) { console.log("  !! table not found in schema.ts"); continue; }
  for (const name of wanted) {
    const hit = cols.find((c) => c.sqlName === name);
    if (!hit) {
      missing.push(`${table}.${name}`);
      console.log(`${name.padEnd(W)} | ????? | !! IN SQL, NOT FOUND in schema.ts`);
      continue;
    }
    printRow(hit);
  }
}

for (const table of NEW_TABLES) {
  const cols = tables.get(table);
  console.log(`\nCREATE TABLE ${table}`);
  if (!cols) { console.log("  !! table not found in schema.ts"); continue; }
  for (const c of cols) printRow(c);
}

// ── Cross-check: SQL vs schema.ts, per table, BOTH directions.
console.log("\n" + "=".repeat(96));
console.log("CROSS-CHECK — column-name set equality between the migration SQL and schema.ts");
console.log("=".repeat(96));

let mismatches = 0;
for (const table of [...ALTERED_TABLES, ...NEW_TABLES]) {
  const inSql = sqlCols.get(table) ?? new Set();
  const schemaCols = tables.get(table) ?? [];
  const schemaNames = new Set(schemaCols.map((c) => c.sqlName));

  // For ALTERed tables the SQL is a strict subset of the table's full column list,
  // so only check SQL -> schema. For CREATEd tables the sets must be equal.
  const isCreate = NEW_TABLES.includes(table);
  const sqlOnly = [...inSql].filter((n) => !schemaNames.has(n));
  const schemaOnly = isCreate ? schemaCols.map((c) => c.sqlName).filter((n) => !inSql.has(n)) : [];

  const ok = sqlOnly.length === 0 && schemaOnly.length === 0;
  if (!ok) mismatches++;
  console.log(
    `${ok ? "OK  " : "FAIL"}  ${table.padEnd(28)} SQL:${String(inSql.size).padStart(3)}  ` +
      `schema:${String(isCreate ? schemaNames.size : inSql.size).padStart(3)}` +
      (ok ? "" : `\n        in SQL only    : ${sqlOnly.join(", ") || "(none)"}` +
                 `\n        in schema only : ${schemaOnly.join(", ") || "(none)"}`)
  );
}

console.log("\n" + "=".repeat(96));
console.log(`columns printed: ${printed}   UNRESOLVED: ${unresolved}   NOT FOUND: ${missing.length}   SET MISMATCHES: ${mismatches}`);
if (missing.length) console.log("NOT FOUND: " + missing.join(", "));

if (unresolved || missing.length || mismatches) {
  console.log("\n!! FAILED. Do not infer any UNRESOLVED name from its property key -- that is the");
  console.log("!! mistake that invented `scripts.production_status` (real SQL name: scriptStatus).");
  console.log("!! A set mismatch means the SQL and the schema have diverged. Fix the SQL, not this");
  console.log("!! script, unless the schema is what changed.");
  process.exitCode = 1;
} else {
  console.log("All names resolve from a column constructor's first argument, and the SQL and");
  console.log("schema.ts agree on every table's column set.");
}
