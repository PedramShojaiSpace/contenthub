import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import {
  MANUAL_AUDIENCE_TOTAL,
  categoryPriority,
  manualAudienceCohorts,
} from "./lib/apolloManualAudienceCohorts.mjs";

const requiredConfirmation = "CREATE_LOCAL_CSV_ONLY";
const exportRoot = process.env.MANUAL_AUDIENCE_EXPORT_DIR;
const approvedRoot = "/home/ubuntu/secure-meta-audience-exports/";

function requireSafeExportDestination() {
  if (!exportRoot) {
    throw new Error("Refusing to export: MANUAL_AUDIENCE_EXPORT_DIR is required.");
  }

  const resolvedRoot = path.resolve(exportRoot);
  if (!`${resolvedRoot}${path.sep}`.startsWith(approvedRoot)) {
    throw new Error(`Refusing to export outside ${approvedRoot}`);
  }

  return resolvedRoot;
}

async function getExclusiveEmailsByCategory(connection) {
  const [rows] = await connection.execute(`
    WITH eligible AS (
      SELECT LOWER(TRIM(emailFound)) AS normalized_email,
             category,
             ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(emailFound))
               ORDER BY CASE category
                 WHEN 'medical_doctor' THEN 1
                 WHEN 'dentist' THEN 2
                 WHEN 'functional_med' THEN 3
                 WHEN 'nutritionist' THEN 4
                 WHEN 'nurse' THEN 5
                 WHEN 'biohacker' THEN 6
                 WHEN 'wellness_coach' THEN 7
                 WHEN 'burnout' THEN 8
                 WHEN 'meditation_teacher' THEN 9
                 ELSE 99 END,
                 id
             ) AS cohort_rank
      FROM lead_prospects
      WHERE lp_source = 'apollo'
        AND lp_status = 'email_found'
        AND emailConfidence = 'verified'
        AND emailFound IS NOT NULL
        AND TRIM(emailFound) <> ''
    )
    SELECT category, normalized_email
    FROM eligible
    WHERE cohort_rank = 1
    ORDER BY category, normalized_email
  `);

  const grouped = new Map(manualAudienceCohorts.map(cohort => [cohort.category, []]));
  for (const row of rows) {
    if (categoryPriority.has(row.category)) {
      grouped.get(row.category).push(row.normalized_email);
    }
  }

  return grouped;
}

function fileStem(index, category) {
  return `${String(index + 1).padStart(2, "0")}-${category.replaceAll("_", "-")}`;
}

if (process.env.CONFIRM_MANUAL_AUDIENCE_EXPORT !== requiredConfirmation) {
  throw new Error(
    "Refusing to write customer-list files. Set CONFIRM_MANUAL_AUDIENCE_EXPORT=CREATE_LOCAL_CSV_ONLY after action-level approval. This utility never calls Meta.",
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const safeExportRoot = requireSafeExportDestination();
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await fs.mkdir(safeExportRoot, { recursive: true, mode: 0o700 });
  const emailsByCategory = await getExclusiveEmailsByCategory(connection);
  const manifest = [];

  for (const [index, cohort] of manualAudienceCohorts.entries()) {
    const emails = emailsByCategory.get(cohort.category) ?? [];
    if (emails.length !== cohort.expectedCount) {
      throw new Error(
        `Refusing to export ${cohort.category}: expected ${cohort.expectedCount} verified exclusive emails but found ${emails.length}.`,
      );
    }

    const filename = `${fileStem(index, cohort.category)}.csv`;
    const outputPath = path.join(safeExportRoot, filename);
    await fs.writeFile(outputPath, `email\n${emails.join("\n")}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });

    manifest.push({
      category: cohort.category,
      audienceName: cohort.name,
      filename,
      verifiedExclusiveEmails: emails.length,
      emailColumnSha256: crypto.createHash("sha256").update(emails.join("\n")).digest("hex"),
    });
  }

  await fs.writeFile(
    path.join(safeExportRoot, "manifest.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalVerifiedExclusiveEmails: MANUAL_AUDIENCE_TOTAL,
      transferRule: "Local manual Meta upload only. Never attach, email, log, or commit these files.",
      cohorts: manifest,
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );

  console.log(JSON.stringify({
    status: "local_csv_export_ready",
    cohorts: manifest.map(({ category, audienceName, filename, verifiedExclusiveEmails }) => ({
      category,
      audienceName,
      filename,
      verifiedExclusiveEmails,
    })),
    totalVerifiedExclusiveEmails: MANUAL_AUDIENCE_TOTAL,
    metaApiCalled: false,
  }));
} finally {
  await connection.end();
}
