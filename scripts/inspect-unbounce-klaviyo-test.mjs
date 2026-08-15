const email = process.argv[2] ?? "pedram@theurbanmonk.com";
const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is unavailable in this runtime");

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  "Content-Type": "application/json",
  revision: "2026-07-15",
};

async function api(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { rawPreview: text.slice(0, 180) }; }
  return { ok: response.ok, status: response.status, body };
}

const profile = await api(`/profiles/?filter=${encodeURIComponent(`equals(email,"${email}")`)}`);
const profileId = profile.body?.data?.[0]?.id ?? null;

const output = {
  email,
  profileLookup: {
    ok: profile.ok,
    status: profile.status,
    profileId,
    created: profile.body?.data?.[0]?.attributes?.created ?? null,
    updated: profile.body?.data?.[0]?.attributes?.updated ?? null,
    subscriptions: profile.body?.data?.[0]?.attributes?.subscriptions ?? null,
    properties: {
      source: profile.body?.data?.[0]?.attributes?.properties?.$source ?? null,
      consentFormId: profile.body?.data?.[0]?.attributes?.properties?.$consent_form_id ?? null,
      consentTimestamp: profile.body?.data?.[0]?.attributes?.properties?.$consent_timestamp ?? null,
    },
    error: profile.ok ? null : profile.body,
  },
  metrics: null,
};

if (profileId) {
  const events = await api(`/events/?filter=${encodeURIComponent(`equals(profile_id,"${profileId}")`)}&page%5Bsize%5D=50&sort=-datetime`);
  const metricIds = [...new Set((events.body?.data ?? [])
    .map((entry) => entry?.relationships?.metric?.data?.id)
    .filter(Boolean))];
  const metricNames = {};
  for (const metricId of metricIds.slice(0, 20)) {
    const metric = await api(`/metrics/${metricId}/`);
    metricNames[metricId] = metric.ok ? metric.body?.data?.attributes?.name ?? null : null;
  }
  output.recentEvents = {
    ok: events.ok,
    status: events.status,
    events: (events.body?.data ?? []).map((entry) => ({
      metricId: entry?.relationships?.metric?.data?.id ?? null,
      metricName: metricNames[entry?.relationships?.metric?.data?.id] ?? null,
      datetime: entry?.attributes?.datetime ?? null,
      properties: entry?.attributes?.event_properties ?? entry?.attributes?.properties ?? null,
    })).slice(0, 20),
    error: events.ok ? null : events.body,
  };
}

const flow = await api(`/flows/YyFZPu/?additional-fields%5Bflow%5D=definition`);
output.interconnectedFlow = {
  ok: flow.ok,
  status: flow.status,
  statusValue: flow.body?.data?.attributes?.status ?? null,
  triggerType: flow.body?.data?.attributes?.trigger_type ?? null,
  definitionKeys: Object.keys(flow.body?.data?.attributes?.definition ?? {}),
  trigger: flow.body?.data?.attributes?.definition?.triggers ?? null,
  relationships: flow.body?.data?.relationships ?? null,
  filters: flow.body?.data?.attributes?.definition?.profile_filter ?? null,
  entryActionId: flow.body?.data?.attributes?.definition?.entry_action_id ?? null,
  emailActions: (flow.body?.data?.attributes?.definition?.actions ?? [])
    .filter((action) => action.type === "send-email")
    .map((action) => ({
      actionId: action.id,
      name: action.data?.message?.name ?? null,
      status: action.data?.status ?? null,
      subject: action.data?.message?.subject_line ?? null,
      smartSending: action.data?.message?.smart_sending_enabled ?? null,
    })).slice(0, 4),
  error: flow.ok ? null : flow.body,
};

const actions = await api(`/flow-actions/?filter=${encodeURIComponent('equals(flow_id,"YyFZPu")')}&page%5Bsize%5D=100`);
output.interconnectedFlowActions = {
  ok: actions.ok,
  status: actions.status,
  count: actions.body?.data?.length ?? 0,
  actions: (actions.body?.data ?? []).map((entry) => ({
    id: entry.id,
    type: entry.attributes?.action_type ?? entry.attributes?.type ?? null,
    status: entry.attributes?.status ?? null,
  })),
  error: actions.ok ? null : actions.body,
};

console.log(JSON.stringify(output, null, 2));
