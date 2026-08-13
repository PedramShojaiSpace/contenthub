const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const SOURCE_FLOW_ID = "VMpbLV";
const SOURCE_FLOW_NAME = "[EG] Interconnected Free Screening - KO";
const DRAFT_FLOW_NAME = "[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67";
const SOURCE_DAY0_TEMPLATE_ID = "XASdst";
const APPROVED_DAY0_DRAFT_TEMPLATE_ID = "Smbiqi";

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path, init = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : {};
}

function asDraftAction(action, templateIds) {
  const cloned = structuredClone(action);
  cloned.temporary_id = action.id;
  delete cloned.id;

  if (cloned.type === "send-email" || cloned.type === "send-sms") {
    cloned.data.status = "draft";
    delete cloned.data.message?.id;
    delete cloned.data.message?.automation_id;
  }

  if (cloned.type === "send-email") {
    const sourceTemplateId = cloned.data.message?.template_id;
    if (!sourceTemplateId) {
      throw new Error(`Safety guard: email action ${action.id} has no template ID.`);
    }
    cloned.data.message.template_id = templateIds.get(sourceTemplateId);
    if (!cloned.data.message.template_id) {
      throw new Error(`Safety guard: no draft template mapping for email action ${action.id}.`);
    }
  }

  return cloned;
}

const existingFlows = await request("/flows/?page%5Bsize%5D=50");
const existingDraft = (existingFlows.data ?? []).find(
  (flow) => flow.attributes?.name === DRAFT_FLOW_NAME
);
if (existingDraft) {
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "already_exists",
        flowId: existingDraft.id,
        flowName: existingDraft.attributes?.name,
        flowStatus: existingDraft.attributes?.status,
        liveFlowChanged: false,
      },
      null,
      2
    )}\n`
  );
  process.exit(0);
}

const sourceResponse = await request(
  `/flows/${SOURCE_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const sourceFlow = sourceResponse.data;
if (
  sourceFlow?.attributes?.name !== SOURCE_FLOW_NAME ||
  sourceFlow?.attributes?.status !== "live"
) {
  throw new Error(
    `Safety guard: expected live source flow "${SOURCE_FLOW_NAME}", found "${sourceFlow?.attributes?.name}" (${sourceFlow?.attributes?.status}).`
  );
}

const sourceDefinition = sourceFlow.attributes?.definition;
const sourceActions = sourceDefinition?.actions ?? [];
const sourceEmailActions = sourceActions.filter((action) => action.type === "send-email");
const sourceSmsActions = sourceActions.filter((action) => action.type === "send-sms");
if (!sourceActions.length || !sourceEmailActions.length) {
  throw new Error("Safety guard: source flow does not contain the expected action sequence.");
}

const templateIds = new Map([[SOURCE_DAY0_TEMPLATE_ID, APPROVED_DAY0_DRAFT_TEMPLATE_ID]]);

for (const action of sourceEmailActions) {
  const templateId = action.data?.message?.template_id;
  if (!templateId || templateIds.has(templateId)) continue;

  const templateName = `[DRAFT — VA REVIEW] ${action.data.message?.name ?? "Interconnected Email"} — ${templateId}`;
  const matchingTemplates = await request(
    `/templates/?filter=${encodeURIComponent(`equals(name,"${templateName}")`)}`
  );
  const existingTemplateId = matchingTemplates.data?.[0]?.id;
  if (existingTemplateId) {
    templateIds.set(templateId, existingTemplateId);
    continue;
  }

  const clonedTemplate = await request("/template-clone", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "template",
        id: templateId,
        attributes: { name: templateName },
      },
    }),
  });
  templateIds.set(templateId, clonedTemplate.data?.id);
}

const draftDefinition = structuredClone(sourceDefinition);
draftDefinition.actions = sourceActions.map((action) => asDraftAction(action, templateIds));

const created = await request("/flows/", {
  method: "POST",
  body: JSON.stringify({
    data: {
      type: "flow",
      attributes: {
        name: DRAFT_FLOW_NAME,
        definition: draftDefinition,
      },
    },
  }),
});

const createdFlowId = created.data?.id;
const verification = await request(
  `/flows/${createdFlowId}/?additional-fields%5Bflow%5D=definition`
);
const verificationActions = verification.data?.attributes?.definition?.actions ?? [];
const draftMessageActions = verificationActions.filter(
  (action) => action.type === "send-email" || action.type === "send-sms"
);
const allMessagesDraft = draftMessageActions.every((action) => action.data?.status === "draft");
const day0Action = verificationActions.find(
  (action) => action.type === "send-email" && action.data?.message?.template_id === APPROVED_DAY0_DRAFT_TEMPLATE_ID
);

if (
  verification.data?.attributes?.status !== "draft" ||
  verificationActions.length !== sourceActions.length ||
  !allMessagesDraft ||
  !day0Action
) {
  throw new Error("Safety guard: created flow did not preserve the sequence as a fully draft review flow.");
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "created_draft_clone",
      flowId: createdFlowId,
      flowName: verification.data?.attributes?.name,
      flowStatus: verification.data?.attributes?.status,
      sourceFlowId: SOURCE_FLOW_ID,
      sourceFlowName: SOURCE_FLOW_NAME,
      sourceActionCount: sourceActions.length,
      draftActionCount: verificationActions.length,
      sourceEmailCount: sourceEmailActions.length,
      sourceSmsCount: sourceSmsActions.length,
      allEmailAndSmsActionsDraft: allMessagesDraft,
      day0UsesApprovedSingleLinkDraft: Boolean(day0Action),
      liveFlowChanged: false,
    },
    null,
    2
  )}\n`
);
