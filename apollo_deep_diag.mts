import "dotenv/config";

const apiKey = process.env.APOLLO_API_KEY || "";
if (!apiKey) { console.log("No Apollo API key"); process.exit(1); }

console.log("=== Apollo Deep Diagnostic ===\n");
console.log("API Key (last 6):", apiKey.slice(-6));

// ── 1. Check account info / credits ──────────────────────────────────────────
console.log("\n[1] Checking account...");
const accountRes = await fetch("https://api.apollo.io/api/v1/auth/health", {
  headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
});
console.log("  Status:", accountRes.status);
const account = await accountRes.json() as any;
console.log("  Response:", JSON.stringify(account));

// ── 2. Search for a person and inspect raw response ──────────────────────────
console.log("\n[2] Searching for wellness coaches...");
const searchRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
  body: JSON.stringify({
    person_titles: ["wellness coach", "health coach"],
    person_locations: ["United States"],
    per_page: 5,
    page: 1,
  }),
});
const searchData = await searchRes.json() as any;
const people = searchData.people ?? [];
console.log("  Found:", people.length, "people");
console.log("  Pagination:", JSON.stringify(searchData.pagination));

if (people.length > 0) {
  const p = people[0];
  console.log("\n  First person raw fields:");
  console.log("    id:", p.id);
  console.log("    name:", p.name);
  console.log("    has_email:", p.has_email);
  console.log("    email:", p.email);
  console.log("    email_status:", p.email_status);
  console.log("    revealed_for_current_team:", p.revealed_for_current_team);
  console.log("    contact_emails:", JSON.stringify(p.contact_emails));
  console.log("    personal_emails:", JSON.stringify(p.personal_emails));

  // ── 3. Try the people/match endpoint (different from people/:id) ──────────
  if (p.id) {
    console.log("\n[3] Testing GET /api/v1/people/" + p.id + " (reveal)...");
    const revealRes = await fetch(`https://api.apollo.io/api/v1/people/${p.id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    });
    console.log("  Status:", revealRes.status);
    const revealData = await revealRes.json() as any;
    console.log("  email:", revealData.person?.email);
    console.log("  email_status:", revealData.person?.email_status);
    console.log("  contact_emails:", JSON.stringify(revealData.person?.contact_emails));
    if (revealData.error) console.log("  ERROR:", revealData.error);

    // ── 4. Try the people/match POST endpoint ─────────────────────────────
    console.log("\n[4] Testing POST /api/v1/people/match...");
    const matchRes = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        id: p.id,
        reveal_personal_emails: true,
        reveal_phone_number: false,
      }),
    });
    console.log("  Status:", matchRes.status);
    const matchData = await matchRes.json() as any;
    console.log("  email:", matchData.person?.email);
    console.log("  email_status:", matchData.person?.email_status);
    console.log("  contact_emails:", JSON.stringify(matchData.person?.contact_emails));
    if (matchData.error) console.log("  ERROR:", matchData.error);

    // ── 5. Try the contacts/create endpoint (another reveal path) ─────────
    console.log("\n[5] Testing POST /api/v1/contacts (create/reveal)...");
    const contactRes = await fetch("https://api.apollo.io/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        person_id: p.id,
      }),
    });
    console.log("  Status:", contactRes.status);
    const contactData = await contactRes.json() as any;
    console.log("  contact email:", contactData.contact?.email);
    console.log("  contact email_status:", contactData.contact?.email_status);
    if (contactData.error) console.log("  ERROR:", contactData.error);
    if (contactData.message) console.log("  Message:", contactData.message);
  }
}

// ── 6. Try searching with reveal_personal_emails in the search itself ─────────
console.log("\n[6] Testing search with reveal_personal_emails=true...");
const searchRevealRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
  body: JSON.stringify({
    person_titles: ["wellness coach"],
    person_locations: ["United States"],
    per_page: 3,
    page: 2,
    reveal_personal_emails: true,
  }),
});
const searchRevealData = await searchRevealRes.json() as any;
const revealPeople = searchRevealData.people ?? [];
console.log("  Found:", revealPeople.length, "people");
if (revealPeople.length > 0) {
  revealPeople.forEach((p: any, i: number) => {
    console.log(`  [${i}] ${p.name}: email=${p.email} has_email=${p.has_email} email_status=${p.email_status}`);
  });
}
if (searchRevealData.error) console.log("  ERROR:", searchRevealData.error);

console.log("\n=== Done ===");
