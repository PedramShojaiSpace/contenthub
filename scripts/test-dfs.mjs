/**
 * Quick DataForSEO credential check — run with:
 *   node scripts/test-dfs.mjs
 */
import { config } from "dotenv";
config({ path: ".env" });

const login = process.env.DATAFORSEO_LOGIN;
const password = process.env.DATAFORSEO_PASSWORD;

console.log("LOGIN set:", !!login, "| length:", login?.length);
console.log("PASSWORD set:", !!password, "| length:", password?.length);

if (!login || !password) {
  console.error("Missing credentials");
  process.exit(1);
}

const cred = Buffer.from(`${login}:${password}`).toString("base64");
console.log("Auth header (first 20 chars):", ("Basic " + cred).substring(0, 20) + "...");

const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
  headers: { Authorization: "Basic " + cred },
});

console.log("HTTP status:", res.status);
const text = await res.text();
console.log("Response (first 300 chars):", text.substring(0, 300));
