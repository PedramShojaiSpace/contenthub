/**
 * Get the full details of the completed Descript publish job including download URL
 */

const DESCRIPT_API_KEY = process.env.DESCRIPT_API_KEY;
const DESCRIPT_BASE_URL = "https://descriptapi.com/v1";

// The completed job ID from the previous check
const JOB_ID = "project-media-publish-48d5bc58-22ca-4bad-8cde-b2db7b16e5fe-b833885b-e1bb-4c23-80bb-6e43226cc782";

if (!DESCRIPT_API_KEY) {
  console.error("No DESCRIPT_API_KEY in env");
  process.exit(1);
}

console.log("Getting full job details for:", JOB_ID);

const res = await fetch(`${DESCRIPT_BASE_URL}/jobs/${JOB_ID}`, {
  headers: {
    Authorization: `Bearer ${DESCRIPT_API_KEY}`,
    "Content-Type": "application/json",
  },
});

console.log("Status:", res.status);
const body = await res.text();
console.log("Full response:");
console.log(JSON.stringify(JSON.parse(body), null, 2));
