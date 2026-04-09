const BUFFER_GQL_ENDPOINT = "https://api.buffer.com";
const UMP_ORG_ID = "6577bd3c147566efe2fa9201";
const TOKEN = "poKz3ynLtuvgotw0sWkHiFyGDFbXZPDtX8_qO9Y48y3";

// Test 1: channels query with variable
const res1 = await fetch(BUFFER_GQL_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({
    query: `query GetChannels($orgId: OrganizationId!) {
      channels(input: { organizationId: $orgId }) {
        id service name
      }
    }`,
    variables: { orgId: UMP_ORG_ID }
  })
});
const data1 = await res1.json();
console.log("=== channels query with variable ===");
console.log(JSON.stringify(data1, null, 2));

// Test 2: account.currentOrganization.channels (fallback)
const res2 = await fetch(BUFFER_GQL_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({
    query: `{ account { currentOrganization { id name channels { id name service } } } }`
  })
});
const data2 = await res2.json();
console.log("\n=== account.currentOrganization.channels ===");
console.log(JSON.stringify(data2, null, 2));
