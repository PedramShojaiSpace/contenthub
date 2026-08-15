# Klaviyo Template Update API Reference

This note records the official API contract consulted before updating the live Interconnected Day 0 template link.

| Item | Verified contract |
|---|---|
| Endpoint | `PATCH https://a.klaviyo.com/api/templates/{id}` |
| Required scope | `templates:write` |
| Request content type | `application/vnd.api+json` |
| API revision | `2026-07-15` |
| HTML templates | For `CODE` and `USER_DRAGGABLE` templates, update the `html` attribute within a JSON:API `data` object. |
| Native drag-and-drop templates | For `SYSTEM_DRAGGABLE` templates, update the structured `definition` rather than rendered `html`. |

The live Day 0 template must be fetched immediately before mutation. The update is limited to replacing the existing Kajabi checkout destination with the first-party Day 0 offer-page URL; its sender, subject, preview text, flow status, timing, and all other HTML remain unchanged.

## Official sources

1. [Klaviyo — Update Template](https://developers.klaviyo.com/en/reference/update_template)
2. [Klaviyo — Templates API overview](https://developers.klaviyo.com/en/reference/templates_api_overview)
