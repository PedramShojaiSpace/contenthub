import { config } from "dotenv";
config();

const login = process.env.DATAFORSEO_LOGIN;
const password = process.env.DATAFORSEO_PASSWORD;
console.log("Login present:", !!login, "| Password present:", !!password);
if (login) console.log("Login value:", login.substring(0, 5) + "...");

const auth = "Basic " + Buffer.from(login + ":" + password).toString("base64");

// Test 1: Credential check
console.log("\n--- Test 1: Credential check ---");
const credRes = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
  method: "GET",
  headers: { Authorization: auth },
});
const credJson = await credRes.json();
console.log("HTTP status:", credRes.status);
console.log("Status code:", credJson.status_code, credJson.status_message);
if (credJson.tasks?.[0]?.result?.[0]) {
  const r = credJson.tasks[0].result[0];
  console.log("Money balance:", r.money_balance);
  console.log("Login:", r.login);
}

// Test 2: Keyword overview for "gut health"
console.log("\n--- Test 2: Keyword overview for 'gut health' ---");
const kwRes = await fetch(
  "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live",
  {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify([
      { keywords: ["gut health"], location_code: 2840, language_code: "en" },
    ]),
  }
);
const kwJson = await kwRes.json();
console.log("HTTP status:", kwRes.status);
console.log("Status code:", kwJson.status_code, kwJson.status_message);
const task = kwJson.tasks?.[0];
console.log("Task status:", task?.status_code, task?.status_message);
const items = task?.result?.[0]?.items;
console.log("Items count:", items?.length ?? 0);
if (items?.[0]) {
  console.log("First item:", JSON.stringify(items[0], null, 2));
} else {
  console.log("Full task result:", JSON.stringify(task?.result, null, 2));
}
