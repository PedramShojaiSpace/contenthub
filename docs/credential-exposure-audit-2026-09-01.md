# Credential Exposure Audit — September 1, 2026

**Purpose.** This controlled audit followed a concern that a credential may have been exposed publicly. It scanned Content Hub source, generated assets, project documentation, development logs, and available Git history using pattern matching that records only credential class, path, length, and SHA-256 fingerprint. The audit **never outputs a credential value**.

## Result

| Audit surface | Coverage | Result |
|---|---:|---|
| Current project working tree | 1,147 text files across client, server, scripts, docs, build output, and operational logs | **0 credential-pattern findings** |
| Project Git history | 1,299 commits scanned added-line-by-added-line | **0 credential-pattern findings** |
| Scanner safeguards | 2 focused automated tests | **2/2 passed** |

The scan covered patterns for Soro API keys, Meta access tokens, Shopify Admin/Storefront access tokens, Google OAuth client secrets/API keys, AWS access keys, and common OpenAI-style API keys. It found no matching live values in the scanned Content Hub project surfaces or Git history.

## Interpretation and limits

This is reassuring evidence that the Content Hub codebase and its reachable build/log artifacts do **not** currently contain an obvious plaintext credential matching the inspected classes. It does not prove that no credential has ever been exposed anywhere: the scan cannot inspect the task-chat transcript, user-supplied screenshots held outside the repository, browser history, third-party dashboards, provider audit logs, or secret-vault contents.

The Soro API key was visibly included in a user-supplied WordPress/Soro settings screenshot during this task. It was not added to project code, repository history, published Content Hub assets, or logs by the audited work. The owner subsequently regenerated the key and reconnected Soro. Because a plaintext API key was visible in the screenshot, the rotation was appropriate regardless of the scan result.

## Containment status

| Service | Current evidence | Required action |
|---|---|---|
| Soro | Key appeared in user-supplied image; no project/Git exposure found; key was regenerated and integration reconnected by owner. | Keep the newly issued key private. No further action is required unless Soro reports unauthorized use. |
| Google OAuth | No plaintext Google secret found in audited project/Git surfaces. The attempted replacement validation had not yet succeeded before the task was interrupted. | Keep old Google client secret enabled until the matching new pair is validated; do not delete credentials based on this audit alone. |
| Meta | No plaintext Meta token found in audited project/Git surfaces. Separate app-tier/business-limit permissions remain the known custom-audience blockers. | Do not rotate a Meta token solely because of this scan; inspect provider activity and rotate only if an exposure or unauthorized use is observed. |
| Shopify | No plaintext Shopify token found in audited project/Git surfaces. | Diagnose the reported connector issue separately with a read-only connection test before changing any store credential or integration. |

## Remaining verification path

If external dashboards indicate a specific exposure, preserve the evidence (provider, approximate time, credential class, and where it appeared) without copying the value into chat. The next action should be a targeted provider-side audit and, if confirmed, service-specific rotation/revocation. Do not revoke multiple credentials blindly: that can break storefront, advertising, analytics, and publishing workflows without proving containment.
