# Klaviyo Flow Optimizer — API Capability Notes

## Verified on 2026-08-11

The existing project credential successfully performed read-only requests against the Klaviyo `2026-07-15` API revision. It can list flows, retrieve the live **Tantra Quiz — 5-Day Sequence** (`RhyYF2`), list its flow actions, and retrieve the associated CODE templates. The first Tantra email uses flow action `114157389` and template `UUcvP4`; this confirmed the implementation’s `definition.data.message` parsing path and HTML review workflow without changing a live message.

## Design implications

Klaviyo treats flows, flow actions, flow messages, and templates as separate resources. The managed optimizer therefore discovers a flow’s send-email actions, retrieves each associated template’s HTML, calculates the existing delivery/copy review, and only writes through the template endpoint after explicit in-app confirmation. The Content Hub stores an immutable original/optimized snapshot before every write and a second snapshot before a restore.

## Official references

1. [Klaviyo Flows API overview](https://developers.klaviyo.com/en/reference/flows_api_overview) — describes flow actions, associated messages/templates, and the flow/action data model.
2. [Klaviyo Get Flow Message](https://developers.klaviyo.com/en/reference/get_flow_message) — documents flow-message retrieval and message/template fields in revision `2026-07-15`.
3. [Klaviyo API changelog](https://developers.klaviyo.com/en/docs/changelog_) — notes updates to Flow Action APIs and current template editor capabilities.
