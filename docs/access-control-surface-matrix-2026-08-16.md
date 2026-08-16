# Content Hub Access-Control Surface Matrix

**Audit date:** August 16, 2026  
**Scope:** The currently mounted Express HTTP routes and the remaining `publicProcedure` tRPC surface.  
**Method:** Source-level review of `server/_core/index.ts`, `server/_core/systemRouter.ts`, `server/routers/commerce.ts`, and focused anonymous-caller regression coverage. This is an inventory and classification document; it does not change any public funnel, checkout, webhook, or cron behavior.

## Confirmed tRPC Surface

| Surface | Intended accessibility | Evidence | Status |
|---|---|---|---|
| `system.health` | Public, stateless liveness probe | Returns `{ ok: true }` only. | Intentionally public; regression-covered. |
| `system.notifyOwner` | Admin only | Uses `adminProcedure`; anonymous caller regression rejects it with `FORBIDDEN`. | Protected; regression-covered. |
| Shopify Storefront product, collection, and cart contract | Public | Required for public storefront browsing and cart creation. | Intentionally public; checkout remains external. |
| Other Content Hub management routers | Protected or admin-only by prior tranche | Prior caller coverage covers UTM, Typeform, integration health, YouTube pipeline, and YouTube analytics. | Not reopened in this tranche. |

## Mounted HTTP Route Classification

| Route family | Intended accessibility | Authorization evidence | Classification |
|---|---|---|---|
| `/api/shopify/order-paid` | Shopify only | Mounted ahead of JSON parsing with the raw body retained for Shopify HMAC authorization. | Verified webhook surface; passive real-order validation remains pending. |
| `/api/ingest/research-report`, `/api/wp/publish-webhook` | Trusted external sender only | Require `INGEST_SECRET` request header. | Verified shared-secret webhook surfaces. |
| `/api/kajabi/purchase` | Kajabi only | Preserves signed body and validates an available Kajabi signature header. | Receiver hardened; passive real-sale validation remains pending. |
| `/api/kajabi/optin` | Kajabi only | Currently accepts the event before any sender-authentication check, then can write a lead, invoke CAPI, subscribe a contact, and notify the owner. | **Authorization gap — separate hardening required before closure.** |
| `/api/scheduled/*` | Manus cron only | Two newest handlers explicitly verify `user.isCron` and task UID. A source-wide search did not establish equivalent checks for all legacy schedule handlers. | **Incomplete legacy inventory — do not treat all as verified.** |
| Public Interconnected, Tantra, campaign, and advertorial GET pages | Public marketing traffic | Public rendering is required by funnel design; data access is limited to rendered published content. | Intentional public funnel surface. |
| `/bridge/:slug`, `/r/checkout`, `/r/ic67`, `/api/attribution/click` | Public marketing traffic | Required for published advertorials and first-party tracked checkout / attribution handoffs. | Intentional public marketing surface; input validation/rate controls remain separate concerns. |
| `/api/email-optimizer/optimize` | Authorized bookmarklet callers | Checks an optimizer key and allows configured Kajabi/Urban Monk/local origins. | Shared-key public utility; legacy fixed-key retirement should be assessed separately. |
| OAuth callback routes | OAuth-provider redirect | Auth URL/status/export routes authenticate operators; callback endpoints must remain provider-reachable. | Public callback surface; state/nonce and secret-return handling require a dedicated OAuth hardening review. |
| File-upload, stitch, and operator export routes | Authenticated operator | Inspected representative routes call `sdk.authenticateRequest`, with job ownership checks where applicable. | Protected management surface. |

## Regression Evidence Added

`server/accessControlMatrix.test.ts` now verifies that an anonymous caller can use the intentionally public health probe but cannot call the owner-notification procedure. This test performs no outbound notification.

## Closure Criteria

The full access-control matrix must remain open until the Kajabi opt-in receiver is sender-authenticated without interrupting real Kajabi delivery, every mounted scheduled callback has been classified or moved behind a common cron-only guard, and representative public funnel, commerce, webhook, and redirect endpoints have route-level regression coverage. No endpoint should be converted from public to protected without confirming its required external caller and rollback path.

## Kajabi Form-Webhook Constraint

Kajabi’s current official form-webhook guidance describes configuring a third-party webhook by pasting its URL into the form’s Webhooks setting; the documentation reviewed does not document a form-webhook signing secret or signature header. In contrast, the Payment Succeeded webhook has a separate site-level configuration surface. Therefore, the existing Form endpoint cannot safely be converted to mandatory HMAC validation without first confirming a supported form-level signing mechanism or changing the configured URL to carry a dedicated, high-entropy receiver token. The latter would require a coordinated Kajabi-form URL update, deployment order, delivery verification, and rollback plan. No Kajabi form or receiver behavior was changed in this audit. [1]

## References

[1] [Kajabi, “Use webhooks with Kajabi.”](https://help.kajabi.com/articles/api-integrations/webhooks/webhooks-explained)
