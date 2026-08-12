import "dotenv/config";

const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const TEMPLATE_ID = "XTHuPY";
const EXPECTED_NAME = "Day 0 opt in EG sp26";

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

function readableLegacyDay0Html(html) {
  const legacyDenseCell = '<td style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;vertical-align:top;padding-top:9px;padding-right:18px;padding-bottom:9px;padding-left:18px" valign="top">';
  const readableContentCell = '<td class="um-content-frame" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;vertical-align:top;padding-top:34px;padding-right:38px;padding-bottom:34px;padding-left:38px" valign="top">';
  const mobileStyles = `
<style>
  body.um-day0-readable { background:#f3f0e9 !important; }
  .um-day0-readable strong { font-weight:600 !important; }
  @media only screen and (max-width:620px) {
    .um-day0-readable .um-content-frame { padding-left:28px !important; padding-right:28px !important; }
    .um-day0-readable .um-logo { max-width:360px !important; width:78% !important; }
    .um-day0-readable .um-mobile-copy { font-size:17px !important; line-height:1.65 !important; }
  }
</style>`;

  let updated = html
    .replace("</head>", `${mobileStyles}</head>`)
    .replace("<body ", '<body class="um-day0-readable" ')
    .replaceAll("background-color:#e97268", "background-color:#f3f0e9")
    .replaceAll("background:#e97268", "background:#f3f0e9")
    .replaceAll("padding-top:50px!important", "padding-top:24px!important")
    .replaceAll("padding-bottom:20px!important", "padding-bottom:24px!important")
    .replace(legacyDenseCell, readableContentCell)
    .replaceAll("font-size:14px", "font-size:17px;line-height:1.65")
    .replaceAll("font-size:16px", "font-size:17px;line-height:1.65")
    .replace(
      'alt="Urban Monk Productions Logo" height="auto"',
      'class="um-logo" alt="Urban Monk Productions Logo" height="auto"'
    );

  return updated;
}

const existing = await request(`/templates/${TEMPLATE_ID}/`);
const attributes = existing.data?.attributes ?? {};
if (attributes.name !== EXPECTED_NAME || attributes.editor_type !== "CODE") {
  throw new Error(`Safety guard: expected CODE template "${EXPECTED_NAME}", found "${attributes.name}" (${attributes.editor_type})`);
}

const updatedHtml = readableLegacyDay0Html(attributes.html ?? "");
if (!updatedHtml.includes("um-day0-readable") || !updatedHtml.includes("padding-left:38px")) {
  throw new Error("Safety guard: mobile readability transformations did not apply");
}

const updated = await request(`/templates/${TEMPLATE_ID}/`, {
  method: "PATCH",
  body: JSON.stringify({
    data: {
      type: "template",
      id: TEMPLATE_ID,
      attributes: {
        name: attributes.name,
        html: updatedHtml,
        text: attributes.text,
      },
    },
  }),
});

console.log(JSON.stringify({
  status: "updated_active_day0_visual_layout",
  templateId: updated.data?.id,
  templateName: updated.data?.attributes?.name,
  copyPreserved: true,
  flowLinkageChanged: false,
}, null, 2));
