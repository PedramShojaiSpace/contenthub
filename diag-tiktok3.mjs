import { config } from "dotenv";
config();

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const ORG_ID = "6577bd3c147566efe2fa9201";

if (!BUFFER_TOKEN) { console.error("No BUFFER_ACCESS_TOKEN"); process.exit(1); }

const resp = await fetch("https://api.buffer.com", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${BUFFER_TOKEN}`,
  },
  body: JSON.stringify({
    query: `query GetChannels($orgId: OrganizationId!) {
      channels(input: { organizationId: $orgId }) {
        id
        service
        name
      }
    }`,
    variables: { orgId: ORG_ID },
  }),
});

const data = await resp.json();
if (data.errors) { console.error("GQL errors:", JSON.stringify(data.errors, null, 2)); }
const channels = data?.data?.channels ?? [];
console.log(`Total channels: ${channels.length}\n`);
channels.forEach(c => {
  console.log(`service="${c.service}" | name="${c.name}" | id=${c.id}`);
});

const tiktok = channels.filter(c => c.service?.toLowerCase().includes("tiktok"));
console.log(`\nTikTok channels found: ${tiktok.length}`);
