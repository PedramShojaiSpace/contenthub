# Klaviyo $199 Post-Purchase Flow API Notes — 2026-08-12

## Verified API Capability

Klaviyo’s current Flows API supports creating a new encoded flow definition with `POST /api/flows/` when the account key has the `flows:write` scope. Created flows are Draft by default unless action status is explicitly set otherwise. Klaviyo’s documented safe workflow is to retrieve an existing flow definition, remove instance fields, replace action IDs with temporary IDs, and create the new definition from that modified payload. [1]

The API can retrieve and update flow statuses, retrieve flow actions, and retrieve message/template data. Klaviyo cautions against pre-creating flows without a guided workflow; the $199 treatment will therefore be created only as an explicitly named **Draft** flow and will not send to any profile before an activation review. [1]

## Required Treatment Architecture

The appropriate trigger is the Shopify `Placed Order` metric, with a trigger filter for the $67 Interconnected variant and a profile or flow filter that excludes the $199 member-offer variant. The first email action must remain Draft. It must link to the staged Manus $199 landing page with the preserved UTM and cohort URL.

## Source

[1] Klaviyo, “Flows API overview,” https://developers.klaviyo.com/en/reference/flows_api_overview
