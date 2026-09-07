const [mode, identifier] = process.argv.slice(2);

if (!mode || !identifier || !["action", "flow"].includes(mode)) {
  throw new Error("Usage: node scripts/inspect-klaviyo-flow-message-template.mjs action <flow-action-id> | flow <flow-id>");
}

const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) {
  throw new Error("KLAVIYO_PRIVATE_KEY is not configured");
}

const baseUrl = "https://a.klaviyo.com/api";
const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  Revision: "2026-07-15",
};

async function requestJson(url) {
  const response = await fetch(url, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Klaviyo read failed (${response.status})`);
    error.status = response.status;
    error.details = body?.errors?.map(item => item?.detail ?? item?.title).filter(Boolean) ?? [];
    throw error;
  }
  return body;
}

if (mode === "flow") {
  const actionsUrl = new URL(`${baseUrl}/flows/${identifier}/relationships/flow-actions`);
  const relationships = await requestJson(actionsUrl);
  const actions = [];

  for (const action of relationships.data ?? []) {
    const actionId = action?.id;
    if (!actionId) continue;
    const actionUrl = new URL(`${baseUrl}/flow-actions/${actionId}`);
    actionUrl.searchParams.set("fields[flow-action]", "definition,updated");
    const actionResponse = await requestJson(actionUrl);
    const definition = actionResponse.data?.attributes?.definition?.data ?? {};
    const message = definition.message ?? definition.main_action?.data?.message ?? null;
    if (!message) continue;
    actions.push({
      action_id: actionId,
      status: definition.status ?? null,
      title: message.title ?? message.name ?? null,
      subject_present: Boolean(message.subject_line),
      template_id: message.template_id ?? null,
    });
  }

  process.stdout.write(`${JSON.stringify({ flow_id: identifier, actions }, null, 2)}\n`);
  process.exit(0);
}

const actionId = identifier;
const relationshipUrl = new URL(`${baseUrl}/flow-actions/${actionId}/flow-messages`);
relationshipUrl.searchParams.set("fields[flow-message]", "channel,definition,updated");
const relationshipResponse = await requestJson(relationshipUrl);

const messages = [];
for (const relationship of relationshipResponse.data ?? []) {
  const flowMessageId = relationship?.id;
  if (!flowMessageId) continue;

  const messageUrl = new URL(`${baseUrl}/flow-messages/${flowMessageId}`);
  messageUrl.searchParams.set("include", "template");
  messageUrl.searchParams.set("fields[flow-message]", "channel,definition,updated");
  messageUrl.searchParams.set("fields[template]", "id,name,editor_type,updated");
  const messageResponse = await requestJson(messageUrl);
  const includedTemplate = (messageResponse.included ?? []).find(item => item?.type === "template");
  const relationshipTemplateId = messageResponse.data?.relationships?.template?.data?.id;
  const templateId = includedTemplate?.id ?? relationshipTemplateId ?? messageResponse.data?.attributes?.definition?.template_id;

  messages.push({
    flow_message_id: flowMessageId,
    channel: messageResponse.data?.attributes?.channel ?? null,
    updated: messageResponse.data?.attributes?.updated ?? null,
    template_id: templateId ?? null,
    template_name: includedTemplate?.attributes?.name ?? null,
    editor_type: includedTemplate?.attributes?.editor_type ?? null,
    relationship_present: Boolean(relationshipTemplateId),
  });
}

const result = { action_id: actionId, messages };

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
