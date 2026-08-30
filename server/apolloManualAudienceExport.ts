import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { manualAudienceCohorts } from "../scripts/lib/apolloManualAudienceCohorts.mjs";

const APPROVED_INITIAL_CATEGORY = "medical_doctor";
const APPROVED_INITIAL_SNAPSHOT_BEFORE_MS = 1788064039427;
const APPROVED_INITIAL_SNAPSHOT_CSV = "/home/ubuntu/secure-meta-audience-exports/2026-08-30-initial-apollo/01-medical-doctor.csv";

type ApprovedCohort = (typeof manualAudienceCohorts)[number];

function getApprovedInitialCohort(): ApprovedCohort {
  const cohort = manualAudienceCohorts.find(item => item.category === APPROVED_INITIAL_CATEGORY);
  if (!cohort) {
    throw new Error("The approved initial Meta audience cohort is not configured.");
  }
  return cohort;
}

export function buildManualAudienceCsv(cohort: ApprovedCohort, rawEmails: string[]): string {
  if (rawEmails.length !== cohort.expectedCount) {
    throw new Error(
      `Refusing to prepare ${cohort.name}: expected ${cohort.expectedCount} verified exclusive emails but found ${rawEmails.length}.`,
    );
  }

  const normalizedEmails = rawEmails.map(email => email.trim().toLowerCase());
  if (normalizedEmails.some((email, index) => email !== rawEmails[index])) {
    throw new Error(`Refusing to prepare ${cohort.name}: all emails must already be normalized.`);
  }
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    throw new Error(`Refusing to prepare ${cohort.name}: duplicate normalized emails were found.`);
  }
  if (normalizedEmails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error(`Refusing to prepare ${cohort.name}: an invalid email was found.`);
  }

  return `email\n${normalizedEmails.join("\n")}\n`;
}

async function getVerifiedExclusiveEmails(category: string): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [rows] = await db.execute(sql`
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
        AND lp_createdAt <= ${APPROVED_INITIAL_SNAPSHOT_BEFORE_MS}
        AND emailFound IS NOT NULL
        AND TRIM(emailFound) <> ''
    )
    SELECT normalized_email
    FROM eligible
    WHERE cohort_rank = 1
      AND category = ${category}
    ORDER BY normalized_email
  `) as unknown as [Array<{ normalized_email: string }>];

  return rows.map(row => row.normalized_email);
}

async function getApprovedInitialSnapshotCsv(cohort: ApprovedCohort): Promise<string> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("The protected initial snapshot is available only from the authenticated development preview.");
  }

  const csv = await readFile(APPROVED_INITIAL_SNAPSHOT_CSV, "utf8");
  const rows = csv.trimEnd().split("\n");
  if (rows[0] !== "email") {
    throw new Error("The protected initial snapshot has an invalid CSV header.");
  }

  return buildManualAudienceCsv(cohort, rows.slice(1));
}

/**
 * This router intentionally exposes only the one cohort approved for the
 * immediate manual upload. It is admin-only, never calls Meta, and returns
 * data only to the authenticated owner’s browser so it can be saved locally.
 */
export const apolloManualAudienceExportRouter = router({
  downloadApprovedInitialCsv: adminProcedure.mutation(async () => {
    const cohort = getApprovedInitialCohort();
    const csv = await getApprovedInitialSnapshotCsv(cohort);

    return {
      audienceName: cohort.name,
      category: cohort.category,
      verifiedExclusiveEmails: cohort.expectedCount,
      filename: "01-medical-doctor.csv",
      csv,
      metaApiCalled: false,
    };
  }),
});
