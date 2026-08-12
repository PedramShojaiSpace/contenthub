import "dotenv/config";

const templateId = process.argv[2];
if (!templateId) throw new Error("Usage: node scripts/inspect-klaviyo-template.mjs <template-id>");
const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const response = await fetch(`https://a.klaviyo.com/api/templates/${templateId}/`, {
  headers: {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    accept: "application/vnd.api+json",
    revision: "2024-10-15",
  },
});
if (!response.ok) throw new Error(`Klaviyo template inspection failed: ${response.status} ${await response.text()}`);

const template = await response.json();
const attributes = template.data?.attributes ?? {};
console.log(JSON.stringify({
  id: template.data?.id,
  name: attributes.name,
  editorType: attributes.editor_type,
  html: attributes.html,
  text: attributes.text,
  subject: attributes.subject,
  previewText: attributes.preview_text,
}, null, 2));
