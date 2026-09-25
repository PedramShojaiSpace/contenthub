const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

async function request(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/vnd.api+json",
      revision: "2026-07-15",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 800)}`);
  return JSON.parse(text);
}

const list = await request("/flows/?page%5Bsize%5D=50");
const candidates = list.data.filter(flow => flow.attributes?.status !== "draft").slice(0, 100);
const result = [];
for (const flow of candidates) {
  const detail = await request(`/flows/${encodeURIComponent(flow.id)}/?additional-fields%5Bflow%5D=definition`);
  const definition = detail.data?.attributes?.definition ?? {};
  if (definition.profile_filter) {
    result.push({
      id: detail.data.id,
      name: detail.data.attributes?.name,
      status: detail.data.attributes?.status,
      profileFilter: definition.profile_filter,
      trigger: definition.triggers?.[0] ?? null,
    });
  }
}
process.stdout.write(`${JSON.stringify({ inspected: candidates.length, profileFilteredFlows: result }, null, 2)}\n`);
