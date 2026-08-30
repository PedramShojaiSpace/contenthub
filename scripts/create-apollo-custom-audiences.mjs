import crypto from "node:crypto";
import mysql from "mysql2/promise";

const accountId = "10207858653523297";
const graphVersion = "v21.0";
const requiredConfirmation = "YES";

const cohorts = [
  { category: "medical_doctor", name: "UM Apollo — Medical Doctors" },
  { category: "dentist", name: "UM Apollo — Dentists" },
  { category: "functional_med", name: "UM Apollo — Functional Medicine" },
  { category: "nutritionist", name: "UM Apollo — Nutrition Professionals" },
  { category: "nurse", name: "UM Apollo — Nurses & NPs" },
  { category: "biohacker", name: "UM Apollo — Longevity Professionals" },
  { category: "wellness_coach", name: "UM Apollo — Wellness Coaches" },
  { category: "burnout", name: "UM Apollo — Resilience & Workplace Wellbeing Professionals" },
  { category: "meditation_teacher", name: "UM Apollo — Meditation & Yoga Professionals" },
];

const categoryPriority = new Map(cohorts.map((cohort, index) => [cohort.category, index + 1]));

if (process.env.CONFIRM_CUSTOM_AUDIENCE_UPLOAD !== requiredConfirmation) {
  throw new Error("Refusing to upload contact data. Set CONFIRM_CUSTOM_AUDIENCE_UPLOAD=YES after owner approval.");
}

if (!process.env.DATABASE_URL || !process.env.META_AD_ACCESS_TOKEN) {
  throw new Error("DATABASE_URL and META_AD_ACCESS_TOKEN are both required.");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

function hashEmail(email) {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function graphPost(path, params) {
  const form = new URLSearchParams({ access_token: process.env.META_AD_ACCESS_TOKEN, ...params });
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    data = { raw: body };
  }
  if (!response.ok || data?.error) {
    throw new Error(`Meta ${response.status}: ${data?.error?.message ?? body.slice(0, 300)}`);
  }
  return data;
}

async function getExclusiveEmailsByCategory() {
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

  const grouped = new Map(cohorts.map(cohort => [cohort.category, []]));
  for (const row of rows) {
    if (!categoryPriority.has(row.category)) continue;
    grouped.get(row.category).push(row.normalized_email);
  }
  return grouped;
}

async function createOrRetrieveAudience(cohort) {
  const [existingRows] = await connection.execute(
    "SELECT meta_audience_id, name FROM meta_custom_audiences WHERE category = ? ORDER BY id DESC LIMIT 1",
    [cohort.category],
  );
  if (existingRows.length) {
    return { id: existingRows[0].meta_audience_id, created: false, name: existingRows[0].name };
  }

  const created = await graphPost(`act_${accountId}/customaudiences`, {
    name: cohort.name,
    subtype: "CUSTOM",
    description: "Verified, deduplicated Apollo business-email professional-role cohort. Daily category-specific sync only; no fallback audience.",
    customer_file_source: "PARTNER_PROVIDED_ONLY",
  });

  if (!created?.id) {
    throw new Error(`Meta did not return a Custom Audience ID for ${cohort.name}.`);
  }

  await connection.execute(
    "INSERT INTO meta_custom_audiences (meta_audience_id, name, description, category, email_count) VALUES (?, ?, ?, ?, 0)",
    [
      created.id,
      cohort.name,
      "Verified, deduplicated Apollo business-email professional-role cohort. Daily category-specific sync only; no fallback audience.",
      cohort.category,
    ],
  );

  return { id: created.id, created: true, name: cohort.name };
}

async function uploadEmails(audienceId, emails) {
  const payload = JSON.stringify({
    schema: ["EMAIL_SHA256"],
    data: emails.map(email => [hashEmail(email)]),
  });
  const result = await graphPost(`${audienceId}/users`, { payload });
  return Number(result?.num_received ?? emails.length);
}

try {
  const emailsByCategory = await getExclusiveEmailsByCategory();
  const createdAudiences = [];

  for (const cohort of cohorts) {
    const emails = emailsByCategory.get(cohort.category) ?? [];
    if (!emails.length) {
      console.log(JSON.stringify({ category: cohort.category, status: "skipped_empty" }));
      continue;
    }

    const audience = await createOrRetrieveAudience(cohort);
    const uploaded = await uploadEmails(audience.id, emails);
    await connection.execute(
      "UPDATE meta_custom_audiences SET email_count = ? WHERE meta_audience_id = ?",
      [emails.length, audience.id],
    );

    createdAudiences.push({
      category: cohort.category,
      name: audience.name,
      audienceId: audience.id,
      created: audience.created,
      verifiedEmails: emails.length,
      metaReceived: uploaded,
    });
    console.log(JSON.stringify(createdAudiences.at(-1)));
  }

  console.log(JSON.stringify({ status: "complete", cohorts: createdAudiences.length }));
} finally {
  await connection.end();
}
