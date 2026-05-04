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

const resp = await fetch("https://api.buffer.com/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${BUFFER_TOKEN}`,
  },
  body: JSON.stringify({ query: GQL }),
});

const data = await resp.json();
if (data.errors) { console.error("GQL errors:", JSON.stringify(data.errors)); }
const channels = data?.data?.channels ?? [];
console.log(`Total channels: ${channels.length}\n`);
channels.forEach(c => {
  console.log(`service="${c.service}" serviceType="${c.serviceType}" name="${c.name}" connected=${c.isConnected} id=${c.id}`);
});
