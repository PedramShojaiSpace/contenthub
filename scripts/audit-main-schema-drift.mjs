#!/usr/bin/env node
/**
 * DRIFT AUDIT — does production have every COLUMN that the resolved schema.ts declares?
 *
 * Table-level presence was already confirmed (143 declared, all 143 exist live).
 * This goes a level deeper: for every declared table, compare the declared column
 * SQL names against the live column list.
 *
 * Reports two directions separately, because they mean different things:
 *   MISSING IN DB  — the app expects a column the database does not have. This is
 *                    the dangerous direction: queries referencing it will fail.
 *   EXTRA IN DB    — the database has a column the app does not declare. Harmless
 *                    (drizzle ignores it) but worth knowing, since it usually means
 *                    DDL was applied outside the schema file.
 *
 * Reads live column lists from /tmp/live_cols_<table>.txt (one name per line),
 * produced by the caller so this script needs no DB driver.
 */
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

const SCHEMA = "drizzle/schema.ts";
const src = ts.createSourceFile(SCHEMA, readFileSync(SCHEMA, "utf8"), ts.ScriptTarget.Latest, true);

const COLUMN_CTORS = new Set([
  "varchar", "int", "bigint", "boolean", "text", "longtext", "mediumtext",
  "datetime", "timestamp", "date", "time", "json", "longtextJson", "mysqlEnum",
  "double", "float", "decimal", "tinyint", "smallint", "serial", "binary", "char",
]);

/** Walk a call chain inside-out and return the innermost recognised column ctor. */
function innermostCtor(node) {
  const chain = [];
  let cur = node;
  while (ts.isCallExpression(cur)) {
    chain.push(cur);
    const e = cur.expression;
    if (ts.isPropertyAccessExpression(e)) cur = e.expression;
    else break;
  }
  for (const call of chain.reverse()) {
    let name = null;
    const e = call.expression;
    if (ts.isIdentifier(e)) name = e.text;
    else if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.name)) name = e.name.text;
    // longtextJson<T>("col") -> the callee is an identifier with type args
    if (name && COLUMN_CTORS.has(name)) return call;
  }
  return null;
}

const tables = new Map(); // sqlTableName -> [sqlColumnName...]

function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "mysqlTable" &&
    node.arguments.length >= 2 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    const tableName = node.arguments[0].text;
    const cols = [];
    const shape = node.arguments[1];
    if (ts.isObjectLiteralExpression(shape)) {
      for (const prop of shape.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const ctor = innermostCtor(prop.initializer);
        if (!ctor) continue;
        const first = ctor.arguments[0];
        if (first && ts.isStringLiteral(first)) cols.push(first.text);
      }
    }
    tables.set(tableName, cols);
  }
  ts.forEachChild(node, visit);
}
visit(src);

let missingTotal = 0;
let extraTotal = 0;
let checked = 0;
let skipped = [];

const rows = [];
for (const [table, declared] of [...tables].sort()) {
  const path = `/tmp/live_cols_${table}.txt`;
  if (!existsSync(path)) { skipped.push(table); continue; }
  const live = readFileSync(path, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
  const liveSet = new Set(live);
  const decSet = new Set(declared);
  const missing = declared.filter(c => !liveSet.has(c));   // app expects, DB lacks
  const extra = live.filter(c => !decSet.has(c));          // DB has, app ignores
  checked++;
  missingTotal += missing.length;
  extraTotal += extra.length;
  if (missing.length || extra.length) {
    rows.push({ table, declared: declared.length, live: live.length, missing, extra });
  }
}

console.log("=".repeat(96));
console.log("SCHEMA DRIFT AUDIT — resolved schema.ts vs live production");
console.log("=".repeat(96));
console.log(`tables declared in schema.ts : ${tables.size}`);
console.log(`tables checked against live  : ${checked}`);
if (skipped.length) console.log(`tables skipped (no live dump) : ${skipped.length}`);
console.log("");

if (!rows.length) {
  console.log("No drift. Every declared column exists live, and no live column is undeclared.");
} else {
  for (const r of rows) {
    console.log(`${r.table}  (declared ${r.declared} / live ${r.live})`);
    if (r.missing.length) console.log(`   MISSING IN DB (app expects, DB lacks): ${r.missing.join(", ")}`);
    if (r.extra.length)   console.log(`   EXTRA IN DB   (DB has, app ignores)  : ${r.extra.join(", ")}`);
  }
}

console.log("");
console.log("-".repeat(96));
console.log(`TOTAL MISSING IN DB : ${missingTotal}   <-- non-zero means the app would break on those columns`);
console.log(`TOTAL EXTRA IN DB   : ${extraTotal}   <-- informational; DDL applied outside the schema file`);

// Only "missing in DB" is a failure. Extra columns are harmless.
process.exit(missingTotal > 0 ? 1 : 0);
