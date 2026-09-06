# HeyGen Security Containment Record

**Prepared:** September 6, 2026  
**Status:** Content Hub outbound HeyGen access is code-disabled pending provider-side key revocation and a separate owner-approved re-enable decision.

## Scope and immediate containment

The owner reported suspected compromise of the Content Hub / HeyGen API integration and possible unapproved external posting. The Content Hub now uses a deny-by-default application control (`server/heygenControl.ts`) that blocks every known HeyGen request before it can read a credential or send a network request. This action does **not** reveal, recover, replace, or log an API key.

| Integration surface | Containment state |
|---|---|
| New avatar renders from the HeyGen router | Blocked before API authentication/request |
| Scheduled and manually resumed avatar jobs | Skipped before quota, render, or status calls |
| Video-pipeline legacy HeyGen status fallback | Blocked before direct API request |
| YouTube intelligence “send to HeyGen” path | Blocked before any script, content item, or pending video job is created |
| Existing test suite | Former live key-validation request removed; containment-only test now runs with no provider call |
| Inbound HeyGen webhook / callback route | No HeyGen-specific inbound webhook or callback route was found in the Content Hub codebase |

The application was restarted after the safeguard was added. Focused containment tests passed **4/4** and the bounded-memory production build passed. A read-only aggregate database check found no HeyGen-backed job in `pending`, `rendering`, `importing`, or `editing` status at review time; the existing jobs were only in ready-for-review, uploaded-unlisted, published, or failed states. No content was sent, published, deleted, or modified as part of this containment step.

## Required provider-side credential action

Application blocking prevents further Content Hub use of the credential, but it cannot stop a copied key from being used outside the Content Hub. The HeyGen account owner should revoke/rotate the suspected key in HeyGen now.

1. Sign in directly to the [HeyGen API dashboard](https://app.heygen.com/home?from=&nav=API).
2. Open **Settings → API** if the dashboard lands elsewhere.
3. Identify the API key associated with the Content Hub. Do not paste or send it in chat, email, or a screenshot.
4. Use the dashboard control to **revoke, delete, or rotate** that suspected key. The exact label can differ by account tier; the required result is that the old key is no longer active.
5. Check API usage, generated videos, account/team access, and connected publishing destinations for activity you do not recognize. Capture timestamps and internal record IDs for HeyGen Support; do not share keys.
6. If unexpected content reached YouTube or another social channel, secure that destination separately: review its connected-app permissions, revoke unrecognized sessions/tokens, and remove or set unapproved content to private through the destination’s own interface. Disabling HeyGen alone cannot undo destination-side publication.
7. Open a HeyGen Support case with the approximate first-seen time, the account email, and the request to review API usage and revoke unauthorized access. Do not include the plaintext key.

HeyGen’s official documentation directs users to manage API keys in the API dashboard, states that keys should never be exposed in client-side code, and recommends regular rotation and usage monitoring.[1]

## Safe re-enable sequence

Do **not** re-enable the Content Hub integration just because a new key exists. After the old provider key is revoked, use the following sequence:

1. Confirm the suspect key is revoked and the account/destination access review is complete.
2. Store the replacement key only through the project’s secure secret-management interface; never paste it into source code, chat, logs, or a browser URL.
3. Keep the application kill switch in place until a separate, explicit owner approval authorizes a controlled re-enable.
4. Before any live render, run one approved non-publishing functional check from the Content Hub and confirm the resulting asset is not automatically distributed.
5. Re-enable only the minimum necessary routes and preserve the existing approval gate for any external publishing workflow.

## Limits

This record confirms only the Content Hub code path is contained. It cannot confirm what happened inside the HeyGen account, whether the copied credential was used elsewhere, or whether a separate publishing destination was compromised. Provider-side revocation and destination-platform access review remain required.

## Reference

[1]: https://developers.heygen.com/docs/api-key "HeyGen API Key documentation"
