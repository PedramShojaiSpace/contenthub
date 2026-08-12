import "dotenv/config";

const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const response = await fetch("https://a.klaviyo.com/api/templates/?page%5Bsize%5D=10", {
  headers: {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    accept: "application/vnd.api+json",
    revision: "2024-10-15",
  },
});
if (!response.ok) throw new Error(`Klaviyo template audit failed: ${response.status} ${await response.text()}`);

const payload = await response.json();
const rows = (payload.data ?? [])
  .map((template) => ({
    id: template.id,
    name: template.attributes?.name ?? "",
    subject: template.attributes?.subject ?? "",
    editorType: template.attributes?.editor_type ?? "",
    created: template.attributes?.created ?? "",
  }))
  .filter((template) => /interconnected|your spot is confirmed|happens next|day 0/i.test(`${template.name} ${template.subject}`));

console.log(JSON.stringify(rows, null, 2));
