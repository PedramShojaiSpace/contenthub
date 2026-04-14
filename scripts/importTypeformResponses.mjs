/**
 * One-time script: Import Typeform form gKuZd1tj responses into the DB
 * Creates the "Upstream Health" webinar session if it doesn't exist,
 * then imports all responses as a webinar_intelligence record.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const TYPEFORM_API_KEY = process.env.TYPEFORM_API_KEY;
const FORM_ID = "gKuZd1tj";
const DATABASE_URL = process.env.DATABASE_URL;

if (!TYPEFORM_API_KEY) throw new Error("TYPEFORM_API_KEY not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

// ─── Fetch from Typeform ──────────────────────────────────────────────────────
console.log("Fetching form structure...");
const formRes = await fetch(`https://api.typeform.com/forms/${FORM_ID}`, {
  headers: { Authorization: `Bearer ${TYPEFORM_API_KEY}` },
});
if (!formRes.ok) throw new Error(`Form fetch failed: ${formRes.status}`);
const form = await formRes.json();
console.log(`Form: "${form.title}"`);

const fieldMap = {};
for (const f of form.fields ?? []) {
  fieldMap[f.id] = f.title;
}
console.log(`Fields: ${Object.keys(fieldMap).length}`);

console.log("Fetching responses...");
const respRes = await fetch(
  `https://api.typeform.com/forms/${FORM_ID}/responses?page_size=200`,
  { headers: { Authorization: `Bearer ${TYPEFORM_API_KEY}` } }
);
if (!respRes.ok) throw new Error(`Responses fetch failed: ${respRes.status}`);
const respData = await respRes.json();
const items = respData.items ?? [];
console.log(`Responses: ${items.length}`);

// ─── Format responses as readable text ───────────────────────────────────────
const lines = [
  `=== ${form.title} ===`,
  `Total responses: ${items.length}`,
  `Fetched: ${new Date().toISOString()}`,
  "",
];

items.forEach((item, idx) => {
  lines.push(`--- Response ${idx + 1} (${new Date(item.submitted_at).toLocaleDateString()}) ---`);
  for (const answer of item.answers ?? []) {
    const label = fieldMap[answer.field.id] ?? answer.field.id;
    let value = "";
    if (["text", "short_text", "long_text"].includes(answer.type)) {
      value = answer.text ?? "";
    } else if (answer.type === "choice") {
      value = answer.choice?.label ?? "";
    } else if (answer.type === "choices") {
      value = (answer.choices?.labels ?? []).join(", ");
    } else if (["number", "rating"].includes(answer.type)) {
      value = String(answer.number ?? "");
    } else if (["boolean", "yes_no"].includes(answer.type)) {
      value = answer.boolean ? "Yes" : "No";
    } else if (answer.type === "email") {
      value = answer.email ?? "";
    }
    if (value.trim()) {
      lines.push(`Q: ${label.substring(0, 100)}`);
      lines.push(`A: ${value}`);
      lines.push("");
    }
  }
});

const rawResponses = lines.join("\n");
const responseCount = items.length;

// ─── Insert into DB ───────────────────────────────────────────────────────────
const conn = await mysql.createConnection(DATABASE_URL);

// Ensure the webinar session exists
const [existingSessions] = await conn.execute(
  "SELECT id FROM webinar_sessions WHERE topic = ? LIMIT 1",
  ["Upstream Health: How to Find and Fix Your Root Cause"]
);

let sessionId;
if (existingSessions.length > 0) {
  sessionId = existingSessions[0].id;
  console.log(`Using existing session ID: ${sessionId}`);
} else {
  const [insertResult] = await conn.execute(
    `INSERT INTO webinar_sessions (topic, webinar_date, status, target_length_minutes, created_at, updated_at)
     VALUES (?, ?, 'draft', 60, NOW(), NOW())`,
    ["Upstream Health: How to Find and Fix Your Root Cause", "2026-04-17"]
  );
  sessionId = insertResult.insertId;
  console.log(`Created new session ID: ${sessionId}`);
}

// Check if this form has already been imported
const [existing] = await conn.execute(
  "SELECT id FROM webinar_intelligence WHERE webinarSessionId = ? AND notes LIKE ? LIMIT 1",
  [sessionId, `%${FORM_ID}%`]
);

if (existing.length > 0) {
  console.log(`Already imported (record ID: ${existing[0].id}). Skipping.`);
  await conn.end();
  process.exit(0);
}

// Insert the intelligence record
const [insertResult] = await conn.execute(
  `INSERT INTO webinar_intelligence 
   (webinarSessionId, surveyType, rawResponses, responseCount, notes, importedAt)
   VALUES (?, 'post_webinar', ?, ?, ?, NOW())`,
  [
    sessionId,
    rawResponses,
    responseCount,
    `Typeform ${FORM_ID} — auto-imported ${new Date().toLocaleDateString()} — ${responseCount} responses`,
  ]
);

console.log(`Inserted webinar_intelligence record ID: ${insertResult.insertId}`);
console.log(`\n✓ Done! ${responseCount} responses imported for session ID ${sessionId}`);
console.log(`  Go to Webinar Intelligence, select "Upstream Health", and click "Extract Intelligence"`);

await conn.end();
