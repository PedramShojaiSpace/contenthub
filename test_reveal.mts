import "dotenv/config";

const apiKey = process.env.APOLLO_API_KEY || "";
console.log("Testing fixed reveal endpoint...\n");

// Search for 3 wellness coaches
const searchRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
  body: JSON.stringify({
    person_titles: ["wellness coach", "health coach", "meditation teacher"],
    person_locations: ["United States"],
    per_page: 5,
    page: 3,
  }),
});
const searchData = await searchRes.json() as any;
const people = searchData.people ?? [];
console.log("Found", people.length, "people to test\n");

let realEmails = 0;
let lockedEmails = 0;
let nullEmails = 0;

for (const p of people.slice(0, 5)) {
  if (!p.id) continue;
  
  const revealRes = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ id: p.id, reveal_personal_emails: true, reveal_phone_number: false }),
  });
  const revealData = await revealRes.json() as any;
  const email = revealData.person?.email ?? null;
  
  if (!email) {
    nullEmails++;
    console.log(`  [null]  ${p.id}`);
  } else if (email.includes("email_not_unlocked") || email.includes("not_unlocked")) {
    lockedEmails++;
    console.log(`  [LOCKED] ${email}`);
  } else {
    realEmails++;
    console.log(`  [REAL]  ${email} (${revealData.person?.email_status})`);
  }
}

console.log(`\nResults: ${realEmails} real, ${lockedEmails} locked, ${nullEmails} null`);
console.log(realEmails > 0 ? "\n✅ Fix confirmed — real emails are coming through!" : "\n❌ Still getting locked emails");
