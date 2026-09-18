import { readFileSync } from "node:fs";

const source = readFileSync("/tmp/unbounce-lp3.html", "utf8");
const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match, index) => ({ index: index + 1, body: match[1] }));

const trackingScripts = scripts.filter(({ body }) =>
  /1498608757116877|FORM_ID\s*=\s*['"]SJAKDW|unbounce-lead|fbq\(/.test(body),
);

console.log(`Total inline scripts: ${scripts.length}`);
console.log(`Tracking-related scripts: ${trackingScripts.length}`);
for (const script of trackingScripts) {
  console.log(`\n--- SCRIPT ${script.index} ---`);
  console.log(script.body.trim());
}

const leadScriptCount = (source.match(/trackSingle\s*\(\s*PIXEL_ID\s*,\s*['"]Lead['"]/g) || []).length;
const bridgeCount = (source.match(/api\/interconnected\/unbounce-lead/g) || []).length;
console.log(`\nLead trackSingle call sites: ${leadScriptCount}`);
console.log(`Bridge URL references: ${bridgeCount}`);
process.exitCode = leadScriptCount === 1 && bridgeCount === 1 ? 0 : 2;
