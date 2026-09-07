const templateId = process.argv[2];

if (!templateId) {
  throw new Error("Usage: node scripts/export-klaviyo-template.mjs <template-id>");
}

const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) {
  throw new Error("KLAVIYO_PRIVATE_KEY is not configured");
}

const url = new URL(`https://a.klaviyo.com/api/templates/${templateId}`);
url.searchParams.set("fields[template]", "name,editor_type,html,text,updated");

const response = await fetch(url, {
  headers: {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    Accept: "application/vnd.api+json",
    Revision: "2026-07-15",
  },
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  const details = body?.errors?.map(item => item?.detail ?? item?.title).filter(Boolean).join("; ");
  throw new Error(`Klaviyo template read failed (${response.status})${details ? `: ${details}` : ""}`);
}

const attributes = body?.data?.attributes ?? {};
if (attributes.editor_type !== "CODE" || typeof attributes.html !== "string") {
  throw new Error("Expected a code-editor template with HTML content");
}

process.stdout.write(`${JSON.stringify({
  id: body.data.id,
  name: attributes.name,
  editor_type: attributes.editor_type,
  updated: attributes.updated,
  html: attributes.html,
  text: attributes.text ?? null,
}, null, 2)}\n`);
