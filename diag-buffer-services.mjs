import "dotenv/config";

const BUFFER_GQL_ENDPOINT = "https://api.buffer.com";
const UMP_ORG_ID = "6577bd3c147566efe2fa9201";
const TOKEN = process.env.BUFFER_ACCESS_TOKEN;

const res = await fetch(BUFFER_GQL_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({
    query: `query GetChannels($orgId: OrganizationId!) {
      channels(input: { organizationId: $orgId }) {
        id service name
      }
    }`,
    variables: { orgId: UMP_ORG_ID },
  }),
});
const json = await res.json();
console.log("All channels:");
for (const ch of json.data?.channels ?? []) {
  console.log(JSON.stringify(ch));
}
