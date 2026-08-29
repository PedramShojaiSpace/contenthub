# Content Domain 404 Browser Discrepancy — 2026-08-28

## Reproduction

After `content.theurbanmonk.com` was reattached and displayed a connected/verified state in the project Domains panel, verification produced divergent results across public paths and browser context.

| Test surface | URL | Result |
|---|---|---|
| Public shell check | `https://content.theurbanmonk.com/upstream/program` | HTTP 200 with the expected **Upstream Program — Direct Sales VSL** title. |
| Owner-connected browser | `https://content.theurbanmonk.com/interconnected` | Loaded the expected Interconnected landing page. |
| Owner-connected browser | `https://content.theurbanmonk.com/upstream/program` | Returned the project’s legacy-style **404 — Page Not Found** response. |
| Owner-connected browser, unique query string | `https://content.theurbanmonk.com/upstream/program?recovery_check=20260828T1544` | Returned the same legacy-style **404 — Page Not Found** response. |
| Owner-connected browser baseline | `https://lightsebook-iugsiz76.manus.space/upstream/program` | Loaded the expected Upstream Program page. |

## Working Diagnosis

The successful managed-domain browser test confirms that the restored project and its published hosted-page database record are healthy. The discrepancy is isolated to the custom-domain delivery path in the owner-connected browser. The repeated result using a unique query string rules out a normal browser page-cache response. Because the same custom-host route returns the correct page in a fresh public request while the owner-connected browser can receive the legacy 404, the most likely remaining cause is a stale DNS/origin route cached upstream of the page request. The next safe action is to identify its DNS TTL and recheck after the cache window, while retaining the successful Manus-domain fallback for immediate owner review.

No page data, offer, form, checkout, redirect, tracking configuration, or additional hostname has been changed. The diagnosis remains read-only until a persistent custom-domain mapping fault is proven.
