const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_NAME = "[READY] Interconnected $67 → $199 Member Offer — Klaviyo Treatment V2";
const TEMPLATE_ID = "RnBvaa";
const PLACED_ORDER_METRIC_ID = "VkbnD6";
const INTERCONNECTED_67_ITEM = "Interconnected: The Complete Healing Protocol";
const MEMBER_OFFER_199_ITEM = "Gut Permeability Test + Health Coach Call — $199 Member Offer";

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

const existing = await request("/flows/?page%5Bsize%5D=50");
const found = (existing.data ?? []).find((flow) => flow.attributes?.name === FLOW_NAME);
if (found) {
  process.stdout.write(`${JSON.stringify({ status: "already_exists", flowId: found.id, flowName: FLOW_NAME }, null, 2)}\n`);
  process.exit(0);
}

const response = await request("/flows/", {
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
              conditions: [
                {
                  type: "profile-marketing-consent",
                  consent: {
                    channel: "email",
                    can_receive_marketing: true,
                    consent_status: { subscription: "subscribed", filters: null },
                  },
                },
                {
                  type: "profile-metric",
                  metric_id: PLACED_ORDER_METRIC_ID,
                  measurement: "count",
                  measurement_filter: { type: "numeric", operator: "equals", value: 0 },
                  timeframe_filter: { type: "date", operator: "alltime" },
                  metric_filters: [{
                    property: "Items",
                    filter: { type: "list", operator: "contains-any", value: [MEMBER_OFFER_199_ITEM] },
                  }],
                },
              ],
            }],
          },
          actions: [{
            temporary_id: "post_purchase_199_email_1_v2",
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
                template_id: TEMPLATE_ID,
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
          entry_action_id: "post_purchase_199_email_1_v2",
        },
      },
    },
  }),
});

process.stdout.write(`${JSON.stringify({
  status: "created_draft",
  flowId: response.data.id,
  flowName: FLOW_NAME,
  flowStatus: response.data.attributes?.status ?? "draft",
  safeguards: ["Shopify $67 trigger", "email consent", "exclude profiles with prior $199 member-offer purchase"],
}, null, 2)}\n`);
