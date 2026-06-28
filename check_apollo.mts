import "dotenv/config";

const apiKey = process.env.APOLLO_API_KEY || "";
if (!apiKey) {
  console.log("No Apollo API key configured");
  process.exit(1);
}

// Check account health / plan
const healthRes = await fetch("https://api.apollo.io/api/v1/auth/health", {
  headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
});
console.log("Health status:", healthRes.status);
const health = await healthRes.json() as any;
console.log("Health:", JSON.stringify(health, null, 2));

// Try a single person reveal to see what we get back
const searchRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
  body: JSON.stringify({
    person_titles: ["wellness coach"],
    person_locations: ["United States"],
    per_page: 3,
    page: 1,
  }),
});
const searchData = await searchRes.json() as any;
const people = searchData.people ?? [];
console.log("\nSearch returned", people.length, "people");
if (people.length > 0) {
  const p = people[0];
  console.log("First person:", p.name, "| has_email:", p.has_email, "| email:", p.email, "| email_status:", p.email_status);
  if (p.id) {
    // Try to reveal email
    const revealRes = await fetch(`https://api.apollo.io/api/v1/people/${p.id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    });
    console.log("Reveal status:", revealRes.status);
    const revealData = await revealRes.json() as any;
    console.log("Reveal email:", revealData.person?.email, "| status:", revealData.person?.email_status);
    if (revealData.error) console.log("Reveal error:", revealData.error);
  }
}
