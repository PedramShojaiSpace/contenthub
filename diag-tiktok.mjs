import { config } from "dotenv";
config();

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
if (!BUFFER_TOKEN) { console.error("No BUFFER_ACCESS_TOKEN"); process.exit(1); }

const GQL = `query {
  channels {
    id
    name
    service
    serviceType
    isConnected
  }
}`;

const resp = await fetch("https://graph.buffer.com/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${BUFFER_TOKEN}`,
  },
  body: JSON.stringify({ query: GQL }),
});

const data = await resp.json();
const channels = data?.data?.channels ?? [];
console.log("All Buffer channels:");
channels.forEach(c => {
  console.log(`  ${c.service.padEnd(15)} | ${c.serviceType?.padEnd(15) ?? "n/a".padEnd(15)} | connected=${c.isConnected} | ${c.name} (${c.id})`);
});

const tiktok = channels.filter(c => c.service?.toLowerCase().includes("tiktok"));
console.log(`\nTikTok channels: ${tiktok.length}`);
if (tiktok.length === 0) {
  console.log("  → TikTok is NOT connected in Buffer.");
}
