import dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/lights-on-optin/.env" });

const apiKey = process.env.TYPEFORM_API_KEY;
console.log("API key present:", !!apiKey);
if (apiKey) console.log("API key prefix:", apiKey.substring(0, 8) + "...");

// Test 1: Check /me endpoint (auth test)
const meResp = await fetch("https://api.typeform.com/me", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
console.log("\n=== /me endpoint ===");
console.log("Status:", meResp.status);
const meData = await meResp.text();
console.log("Response:", meData.substring(0, 300));

// Test 2: Try creating a minimal form
const testPayload = {
  title: "API Test Form - Delete Me",
  fields: [
    { ref: "q1", title: "How are you feeling today?", type: "short_text" },
    { ref: "q2", title: "Rate your experience 1-10", type: "rating", properties: { steps: 10 } },
  ],
  settings: { is_public: true, is_trial: false },
};

console.log("\n=== Create form test ===");
const createResp = await fetch("https://api.typeform.com/forms", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(testPayload),
});
console.log("Status:", createResp.status);
const createData = await createResp.text();
console.log("Response:", createData.substring(0, 500));

// If created, delete it
if (createResp.ok) {
  const parsed = JSON.parse(createData);
  console.log("\nForm created! ID:", parsed.id, "URL:", parsed._links?.display);
  // Clean up
  const delResp = await fetch(`https://api.typeform.com/forms/${parsed.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  console.log("Cleanup delete status:", delResp.status);
}
