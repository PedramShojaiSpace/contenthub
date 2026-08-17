# Kajabi Opt-In Webhook Authentication Rollout Proposal

**Status:** Proposal only. No webhook URL, server route, lead, CAPI event, Klaviyo subscription, or notification behavior has been changed.

## Current Risk

The existing `POST /api/kajabi/optin` route accepts `form_submission`, `member_added`, and `contact_created` payloads without an authentication boundary before it can write a lead, emit a server-side Meta Lead, attempt Klaviyo SMS sync, and notify the owner. Kajabi’s documented form-webhook path does not provide a guaranteed raw-body signing contract comparable to the purchase receiver, so treating the webhook as authenticated today would be unsafe.

## Proposed Compatible Design

Create a new opt-in endpoint that requires an opaque URL token, while retaining the existing endpoint during the transition:

| Stage | Active callback | Behavior | Safety boundary |
|---|---|---|---|
| 0. Preflight | Existing `/api/kajabi/optin` | Unchanged | No impact before approval. |
| 1. Parallel deployment | Existing route plus `/api/kajabi/optin/v2?token=…` | Both routes call the same normalized processor; v2 requires a constant-time token check before parsing or side effects. | Existing Kajabi delivery remains intact. |
| 2. Kajabi cutover | Kajabi webhook URL changes to v2 with opaque token | Observe first genuine submission in logs/ledger, then confirm one lead, one CAPI event, and expected CRM behavior. | New traffic is authenticated at the URL boundary. |
| 3. Sunset | Existing unauthenticated route returns a safe non-processing response after a verified quiet window | Remove legacy intake only after no delivery failures and explicit owner confirmation. | No unauthenticated opt-in writes remain. |

The token belongs in a dedicated `KAJABI_OPTIN_WEBHOOK_TOKEN` project secret. It must not be logged, rendered in the UI, sent to Meta, stored in lead records, or copied into documentation.

## Validation and Rollback

The first validation must be a **genuine Kajabi form submission**, not a fabricated lead. Validate that the v2 request creates at most one local lead, produces one deterministic Lead event record, preserves the Kajabi path label, and does not create an unintended Klaviyo SMS subscription when no phone is present. If any step fails, restore the pre-existing Kajabi callback URL immediately; do not alter Pixel, checkout, email, or CRM routing as part of rollback.

> **Owner approval required:** This rollout needs explicit approval before any server acceptance logic, secret, or Kajabi webhook URL is changed. It is an operational security change, not a CRO or content change.
