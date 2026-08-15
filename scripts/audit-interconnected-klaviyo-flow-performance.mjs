const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_ID = "VMpbLV";
const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path, options = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

const metricsPayload = await request("/metrics/");
const metrics = (metricsPayload.data ?? []).map((metric) => ({
  id: metric.id,
  name: metric.attributes?.name ?? "",
  integration: metric.attributes?.integration?.name ?? null,
}));
const normalized = (name) => name.toLowerCase().replace(/[^a-z]/g, "");
const conversionMetric = metrics.find((metric) => normalized(metric.name) === "placedorder");
if (!conversionMetric) {
  throw new Error("Could not locate a Placed Order metric for the read-only flow report.");
}

const now = new Date();
const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
const reportPayload = {
  data: {
    type: "flow-values-report",
    attributes: {
      timeframe: { start: start.toISOString(), end: now.toISOString() },
      conversion_metric_id: conversionMetric.id,
      filter: `equals(flow_id,\"${FLOW_ID}\")`,
      statistics: [
        "recipients",
        "delivered",
        "delivery_rate",
        "opens",
        "open_rate",
        "clicks",
        "click_rate",
        "conversion_uniques",
        "conversion_value",
      ],
      group_by: ["flow_message_id", "flow_id", "flow_message_name", "send_channel"],
    },
  },
};

const report = await request("/flow-values-reports/", {
  method: "POST",
  body: JSON.stringify(reportPayload),
});

process.stdout.write(
  `${JSON.stringify(
    {
      flowId: FLOW_ID,
      timeframe: { start: start.toISOString(), end: now.toISOString() },
      conversionMetric,
      availableRelevantMetrics: metrics.filter((metric) =>
        ["receivedemail", "openedemail", "clickedemail", "placedorder", "startedcheckout"].includes(normalized(metric.name))
      ),
      results: report.data?.attributes?.results ?? [],
    },
    null,
    2
  )}\n`
);
