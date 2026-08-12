const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_NAME = "[DRAFT] Interconnected $67 → $199 Member Offer — Klaviyo Treatment";
const TEMPLATE_NAME = "[DRAFT] Interconnected $199 Member Offer — Post-Purchase Email 1";
const TREATMENT_URL = "https://content.theurbanmonk.com/interconnected/post-purchase-199-klaviyo?utm_source=klaviyo&utm_medium=email&utm_campaign=interconnected_14day&utm_content=post_purchase_199_klaviyo_v1";
const PLACED_ORDER_METRIC_ID = "VkbnD6";
const INTERCONNECTED_67_ITEM = "Interconnected: The Complete Healing Protocol";

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
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

const emailHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your $199 member offer</title></head>
<body style="margin:0;background:#f4f2ed;color:#18332d;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">
      <tr><td style="padding:38px 34px 12px;text-align:center;border-bottom:3px solid #d7ad52;">
        <p style="margin:0;font-size:12px;letter-spacing:1.6px;color:#8a6630;text-transform:uppercase;">The Urban Monk • Member Offer</p>
        <h1 style="margin:16px 0 10px;font-family:Georgia,serif;font-size:31px;line-height:1.18;color:#18332d;">You took the first step. Here’s your next level.</h1>
      </td></tr>
      <tr><td style="padding:28px 34px 10px;font-size:17px;line-height:1.65;">
        <p style="margin:0 0 18px;">Hi {{ person.first_name|default:'there' }},</p>
        <p style="margin:0 0 18px;">Because you chose <strong>Interconnected</strong>, you can add the <strong>Gut Permeability Test + private one-hour Health Coach Call</strong> for the member price of <strong>$199</strong> (regularly $399).</p>
        <p style="margin:0 0 18px;">This is a separate purchase designed to give you a concrete next step: complete the kit, then use your private session to discuss your results and questions with a health coach.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f4f2ed;"><tr><td style="padding:18px 20px;">
          <p style="margin:0 0 8px;font-weight:bold;">Your member offer includes</p>
          <p style="margin:0;line-height:1.65;">• Gut Permeability Test kit<br>• Private one-hour Health Coach Call<br>• Member price: $199</p>
        </td></tr></table>
        <p style="margin:25px 0;text-align:center;"><a href="${TREATMENT_URL}" style="display:inline-block;background:#18332d;color:#ffffff;text-decoration:none;padding:15px 24px;font-weight:bold;">Review Your $199 Member Offer</a></p>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#5b625e;">The kit and coaching are not a diagnosis or a substitute for medical care. Please discuss health concerns with an appropriately licensed clinician. Opened kits are final sale.</p>
      </td></tr>
      <tr><td style="padding:18px 34px 32px;font-size:14px;line-height:1.55;color:#4d5c55;">With care,<br><strong>Dr. Pedram Shojai</strong><br>The Urban Monk</td></tr>
      <tr><td style="padding:18px 34px;background:#18332d;color:#d8e4de;font-size:12px;line-height:1.45;">{% unsubscribe %}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

const emailText = `Hi {{ person.first_name|default:'there' }},\n\nBecause you chose Interconnected, you can add the Gut Permeability Test + private one-hour Health Coach Call for the member price of $199 (regularly $399).\n\nReview your member offer: ${TREATMENT_URL}\n\nThe kit and coaching are not a diagnosis or a substitute for medical care. Opened kits are final sale.\n\nDr. Pedram Shojai\nThe Urban Monk\n\n{% unsubscribe %}`;

const existing = await request("/flows/?page%5Bsize%5D=50");
const found = (existing.data ?? []).find((flow) => flow.attributes?.name === FLOW_NAME);
if (found) {
  process.stdout.write(`${JSON.stringify({ status: "already_exists", flowId: found.id, flowName: FLOW_NAME }, null, 2)}\n`);
  process.exit(0);
}

const templateResponse = await request("/templates/", {
  method: "POST",
  body: JSON.stringify({
    data: {
      type: "template",
      attributes: {
        name: TEMPLATE_NAME,
        editor_type: "CODE",
        html: emailHtml,
        text: emailText,
      },
    },
  }),
});

const templateId = templateResponse.data.id;
const flowResponse = await request("/flows/", {
  method: "POST",
  body: JSON.stringify({
    data: {
      type: "flow",
      attributes: {
        name: FLOW_NAME,
        definition: {
          triggers: [{
            type: "metric",
            id: PLACED_ORDER_METRIC_ID,
            trigger_filter: {
              condition_groups: [{
                conditions: [{
                  type: "metric-property",
                  metric_id: PLACED_ORDER_METRIC_ID,
                  field: "Items",
                  filter: { type: "list", operator: "contains", value: INTERCONNECTED_67_ITEM },
                }],
              }],
            },
          }],
          profile_filter: {
            condition_groups: [{
              conditions: [{
                type: "profile-marketing-consent",
                consent: {
                  channel: "email",
                  can_receive_marketing: true,
                  consent_status: { subscription: "subscribed", filters: null },
                },
              }],
            }],
          },
          actions: [{
            temporary_id: "post_purchase_199_email_1",
            type: "send-email",
            links: { next: null },
            data: {
              message: {
                from_email: "support@theurbanmonk.com",
                from_label: "Dr. Pedram Shojai",
                reply_to_email: "support@theurbanmonk.com",
                cc_email: null,
                bcc_email: null,
                subject_line: "Your next Interconnected step is ready",
                preview_text: "Your private $199 member offer: test kit + one-hour health coach call.",
                template_id: templateId,
                smart_sending_enabled: false,
                transactional: false,
                add_tracking_params: false,
                custom_tracking_params: null,
                additional_filters: null,
                name: "$199 Member Offer — Email 1",
              },
              status: "draft",
            },
          }],
          entry_action_id: "post_purchase_199_email_1",
        },
      },
    },
  }),
});

process.stdout.write(`${JSON.stringify({
  status: "created_draft",
  flowId: flowResponse.data.id,
  flowName: FLOW_NAME,
  templateId,
  treatmentUrl: TREATMENT_URL,
  flowStatus: flowResponse.data.attributes?.status ?? "draft",
}, null, 2)}\n`);
