import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const outputPath = process.env.CREDENTIAL_AUDIT_OUTPUT ?? "/tmp/urban-monk-credential-exposure-audit.json";
const scanRoots = ["client", "server", "scripts", "docs", "dist", ".manus-logs"];
const ignoredDirectories = new Set(["node_modules", ".git", ".pnpm-store", "coverage"]);

const patterns = [
  { className: "Soro API key", pattern: /\bsoro_[A-Za-z0-9_-]{20,}\b/g },
  { className: "Meta access token", pattern: /\bEA[A-Za-z0-9]{20,}\b/g },
  { className: "Shopify Admin access token", pattern: /\bshpat_[A-Za-z0-9_-]{20,}\b/g },
  { className: "Shopify Storefront access token", pattern: /\bshp(?:ca|at)_[A-Za-z0-9_-]{20,}\b/g },
  { className: "Google OAuth client secret", pattern: /\bGOCSPX-[A-Za-z0-9_-]{10,}\b/g },
  { className: "Google API key", pattern: /\bAIza[A-Za-z0-9_-]{20,}\b/g },
  { className: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { className: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
];

function redactedMatch(match) {
  return {
    length: match.length,
    sha256: createHash("sha256").update(match).digest("hex"),
  };
}

function findCredentialMarkers(text, location) {
  const findings = [];
  for (const { className, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({ location, className, ...redactedMatch(match[0]) });
    }
  }
  return findings;
}

async function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

async function scanWorkingTree() {
  const findings = [];
  let filesScanned = 0;
  for (const scanRoot of scanRoots) {
    for (const file of await listFiles(path.join(root, scanRoot))) {
      const stat = await readFile(file);
      if (stat.includes(0)) continue;
      filesScanned += 1;
      findings.push(...findCredentialMarkers(stat.toString("utf8"), path.relative(root, file)));
    }
  }
  return { filesScanned, findings };
}

function scanGitHistory() {
  try {
    const commits = execFileSync("git", ["rev-list", "--all"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().split("\n").filter(Boolean);

    const findings = [];
    let scannedCommits = 0;
    for (const commit of commits) {
      const diff = execFileSync("git", ["show", "--format=", "--no-ext-diff", "--no-renames", "--unified=0", commit], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
      scannedCommits += 1;
      let currentPath = "unknown";
      for (const line of diff.split("\n")) {
        if (line.startsWith("+++ b/")) currentPath = line.slice("+++ b/".length);
        if (!line.startsWith("+") || line.startsWith("+++")) continue;
        findings.push(...findCredentialMarkers(line.slice(1), `git:${commit}:${currentPath}`));
      }
    }
    return { historyScanned: true, scannedCommits, findings };
  } catch {
    return { historyScanned: false, scannedCommits: 0, findings: [] };
  }
}

const workingTree = await scanWorkingTree();
const history = scanGitHistory();
const allFindings = [...workingTree.findings, ...history.findings];
const result = {
  scannedAt: new Date().toISOString(),
  outputRedaction: "Credential values are never written to this report. Findings include only class, path, length, and SHA-256 fingerprint.",
  workingTreeFilesScanned: workingTree.filesScanned,
  gitHistoryScanned: history.historyScanned,
  gitCommitsScanned: history.scannedCommits,
  totalFindings: allFindings.length,
  findings: allFindings,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({
  status: "complete",
  workingTreeFilesScanned: result.workingTreeFilesScanned,
  gitHistoryScanned: result.gitHistoryScanned,
  gitCommitsScanned: result.gitCommitsScanned,
  totalFindings: result.totalFindings,
  reportPath: outputPath,
}));
