#!/usr/bin/env node
// Compares LIVE production column names against drizzle/schema.ts for named tables.
// Reads live column lists from /tmp/live_<table>.txt (one name per line).
// Exits non-zero on any set mismatch.
import { execSync } from "node:child_process";
import fs from "node:fs";

const tables = process.argv.slice(2);
if (tables.length === 0) {
  console.error("usage: compare-live-vs-schema.mjs <table> [<table> ...]");
  process.exit(2);
}

execSync("node scripts/extract-schema-columns.mjs drizzle/schema.ts /tmp/schemacols.json", {
  stdio: "pipe",
});
const declared = JSON.parse(fs.readFileSync("/tmp/schemacols.json", "utf8"));

let failures = 0;
for (const t of tables) {
  const livePath = `/tmp/live_${t}.txt`;
  if (!fs.existsSync(livePath)) {
    console.log(`${t.padEnd(20)} MISSING live column file ${livePath}`);
    failures += 1;
    continue;
  }
  const live = fs
    .readFileSync(livePath, "utf8")
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  const decl = (declared[t] || []).slice().sort();
  const onlyLive = live.filter((c) => decl.indexOf(c) === -1);
  const onlyDecl = decl.filter((c) => live.indexOf(c) === -1);
  const ok = onlyLive.length === 0 && onlyDecl.length === 0;
  if (!ok) failures += 1;
  console.log(
    `${t.padEnd(20)} live=${String(live.length).padStart(3)}  schema.ts=${String(decl.length).padStart(3)}  ${ok ? "SET-EQUAL" : "MISMATCH"}`,
  );
  if (onlyLive.length) console.log(`   only in LIVE      : ${onlyLive.join(", ")}`);
  if (onlyDecl.length) console.log(`   only in schema.ts : ${onlyDecl.join(", ")}`);
}

console.log(
  `\n${tables.length} table(s) compared, ${failures} mismatch(es).`,
);
process.exit(failures === 0 ? 0 : 1);
