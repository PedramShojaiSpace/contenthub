/**
 * Check the status of the existing Descript publish job for project 48d5bc58
 * Uses DESCRIPT_API_KEY from the running environment
 */

const DESCRIPT_API_KEY = process.env.DESCRIPT_API_KEY;
const PROJECT_ID = "48d5bc58-22ca-4bad-8cde-b2db7b16e5fe";
const DESCRIPT_BASE_URL = "https://descriptapi.com/v1";

if (!DESCRIPT_API_KEY) {
  console.error("No DESCRIPT_API_KEY in env");
  process.exit(1);
}

console.log("DESCRIPT_API_KEY found:", DESCRIPT_API_KEY.substring(0, 30) + "...");
console.log("Checking Descript project:", PROJECT_ID);

// Try to list jobs for the project
const endpoints = [
  `/projects/${PROJECT_ID}`,
  `/jobs?project_id=${PROJECT_ID}`,
  `/projects/${PROJECT_ID}/jobs`,
];

for (const endpoint of endpoints) {
  console.log(`\n--- Trying: ${endpoint} ---`);
  const res = await fetch(`${DESCRIPT_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${DESCRIPT_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  console.log("Status:", res.status);
  const body = await res.text();
  console.log("Response:", body.slice(0, 800));
}
