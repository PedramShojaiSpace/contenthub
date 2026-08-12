const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const [metrics, flows] = await Promise.all([
  request("/metrics/"),
  request("/flows/?page%5Bsize%5D=50"),
]);

const placedOrder = (metrics.data ?? []).find((metric) => metric.attributes?.name === "Placed Order");
const candidates = (flows.data ?? [])
  .filter((flow) => /interconnected/i.test(flow.attributes?.name ?? ""))
  .map((flow) => ({ id: flow.id, name: flow.attributes?.name ?? "", status: flow.attributes?.status ?? "" }));

const result = {
  placedOrderMetric: placedOrder
    ? { id: placedOrder.id, name: placedOrder.attributes?.name ?? "Placed Order" }
    : null,
  interconnectedFlows: candidates,
};

if (candidates.length) {
  result.existingDefinitions = await Promise.all(candidates.map(async (candidate) => {
    const definition = await request(
      `/flows/${encodeURIComponent(candidate.id)}/?additional-fields%5Bflow%5D=definition`
    );
    const flow = definition.data;
    return {
      id: flow.id,
      name: flow.attributes?.name ?? "",
      status: flow.attributes?.status ?? "",
      triggerType: flow.attributes?.trigger_type ?? "",
      actionTypes: (flow.attributes?.definition?.actions ?? []).map((action) => action.type),
      trigger: flow.attributes?.definition?.triggers?.[0] ?? null,
    };
  }));
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
