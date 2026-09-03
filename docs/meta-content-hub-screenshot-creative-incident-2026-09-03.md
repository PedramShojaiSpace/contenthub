# Meta Content Hub Screenshot Creative — Incident Audit

**Scope:** Owner-reported creative that appears to use a screenshot of the Content Hub command-center dashboard with green blocks. This is a read-only investigation until the exact ad is identified and the owner separately authorizes a pause.

## Owner report

The owner reported a live, budget-spending Meta ad that displays a screenshot resembling the Content Hub command-center loading/dashboard view with green blocks. The owner asked that the exact ad be isolated and shown before it is shut off.

## Current read-only findings

| Check | Result |
|---|---|
| Reporting account examined | `1153114224705920` — Urban Monk - Facebook |
| Meta Ads Manager state | Connected browser opens the account’s Ads view and displays 8,762 ads over the shown 30-day window; current active-ad filtering is being checked without a delivery change. |
| Meta connector configuration | The separate Meta Ads Manager connector is disabled, but the project’s server-side read-only reporting credential is functioning. |
| Creative inventory | 66 ads were retrieved through supported campaign → ad set → ad traversal; 54 were effective-active. |
| Text/destination heuristic | No active creative contained the obvious strings `content hub`, `command center`, `dashboard`, `screenshot`, `green squares`, `hub/analytics`, or `content.theurbanmonk.com` in the limited metadata returned by the API. |
| Thumbnail review | A local contact sheet of all 54 current active thumbnail previews was generated for read-only visual comparison. No confident match has yet been identified from the low-resolution 64 × 64 thumbnail assets; blank/white previews are not sufficient evidence of a dashboard screenshot. |
| Current Meta limitation | A broad account `/ads` creative read returned schema/access errors. The supported traversal succeeded. A subsequent expanded API scan reached Meta’s temporary request-rate limit; no write call was made. |

## Confirmed visual match

Meta’s public Ad Library active search for **Urban Monk** returned two currently active public ad cards that visibly match the owner-provided issue: a white dashboard-like image with dark-green header, sidebar, upper cards, and a wide green lower panel. These are not merely similar color treatments; they reproduce the distinct Content Hub command-center green-block layout.

The cards appear as the fourth and fifth search results in the current public Ad Library view and both route to `theurbanmonk.com`. Their full confirmed public Ad Library IDs are `2253237402136588` and `1095141142945685`; both show as **Active** and started running on August 16, 2026. The first card’s Ad Library detail view confirms the `2253237402136588` ID and the matching creative visual. The exact underlying account ad/ad-set/campaign records and same-day spend remain to be resolved.

## Immediate interpretation

The suspected creative is now **confirmed as two current active public Meta creatives** for The Urban Monk. The owner has authorized pausing every underlying active ad that uses either of these two confirmed dashboard creatives. The next step is to resolve the exact account ad IDs, pause only those records, and read their statuses back. No ad has been paused or changed yet.

## Cross-account mapping status

The public library IDs cannot be submitted directly as Ads Manager internal ad IDs and are not readable as standard Graph ad/creative objects. A direct select of public ID `2253237402136588` in account `1153114224705920` did not resolve a visible row. A preview of the most likely blank-thumbnail internal VIBE candidate in that account was a non-matching VIBE video, not the dashboard screenshot.

| Account reviewed through read-only API | Result |
|---|---|
| `1153114224705920` — Urban Monk - Facebook | 54 effective-active ads / 66 active-campaign-scoped ads; none was created August 16, 2026. Its public-facing generic VIBE candidates do not visually match the dashboard screenshot. |
| `2227181444228098` — Interconnected Series | No active ads and no current spend. |
| `1313968907357548` — MEGA - The Urban Monk | Eight effective-active ads / six with same-day spend; none was created August 16, 2026. |
| `904224497109311` — Urban Monk - HBA Account | Four effective-active ads, none with current spend and none created August 16, 2026. |
| `10207858653523297` | Browser access exists, but the server-side reporting credential returned 403 / access code 200. Its visible current active ads are unrelated historical creatives, not a confirmed match. |

The remaining browser-visible Bpossible account is `688998571776996` (Wholetv, inc); server-side lookup is also denied with Meta 403 / access code 200. The browser-visible Well.Org account `24408021` contains 316 historic ads, but the initial visible rows are non-delivering Well.Org assets and do not match. Its Active Ads filter is being reviewed read-only. The public-library creative has not been found in any of the accounts that the reporting token can inspect.

The Well.Org active-ad view shows no spend and only historic Well.Org placements, so it is not the source of the public Urban Monk dashboard creative. The original Urban Monk account’s two active `CONTROL Interconnected Image` ads `52588740963205` and `52588740960805`, whose campaign/ad-set names reference `content-theurbanmonk-com-interconnected-b`, were visually checked and are both non-matching Interconnected cover art—not the green dashboard screenshot.

The browser-visible account `10207858653523297` remains the strongest internal lead because it has two current active ads carrying $343.34 and $341.94 in shown 30-day spend but cannot be queried with the project reporting token. Its ad names are `DRAFT — Divorce — A — Big Decision` and `DRAFT — King and Queen — A — Rebuild the Field`; both must be previewed in-browser before any pause. The owner-approved scope remains limited to exact visual matches only.

The owner-approved pause remains pending because neither confirmed public Library ID has yet been proven to map to a specific internal ad ID. The next read-only route is to inspect the remaining accessible business-portfolio account(s) in Ads Manager or resolve the public library record through an account with broader Marketing API permissions. Pausing any of the candidate VIBE or Interconnected ads before that mapping would risk stopping the wrong creative.

## Exact ad isolated and pause initiated

The remaining accessible account `10207858653523297` surfaced two currently spending ads. A Meta Ads Manager preview visually confirmed that `DRAFT — Divorce — A — Big Decision`, internal ad ID `52524355583076`, is the green Content Hub command-center screenshot. It showed $343.34 in the current 30-day selected window, 1,523 landing-page views, and $0.23 reported cost per landing-page view.

After the owner’s explicit authorization, its delivery toggle was switched off and Meta accepted a **one-item publish** for the exact selected ad. The table has advanced from Active to Processing, indicating the authorized pause is propagating. Existing unrelated draft items were deliberately not published: an earlier review dialog showed only three unrelated draft ads with errors, so that dialog was cancelled before any action.

The second visually matching active green-thumbnail ad, `DRAFT — King and Queen — A — Rebuild the Field`, remains active at this point and must be independently previewed and paused after the first confirmed pause finishes. No campaign, ad set, budget, audience, pixel, destination, or unrelated draft has been changed.

## Second confirmation and completed pause request

The remaining active ad was resolved from the Ads Manager page data as internal ID `52524476029876`. Its in-browser preview also visibly matched the same green Content Hub command-center screenshot. It had $341.94 in the selected 30-day window, 1,634 landing-page views, and $0.21 reported cost per landing-page view.

Under the owner’s authorization, Meta accepted one publish operation for each exact ad. The delivery controls now show **off**, while each row is in Meta’s transient **Processing** state. The Ads Manager tooltip independently states “Ad is off.” This confirms the pause commands have been accepted and delivery should not continue once Meta propagation completes.

| Confirmed creative | Internal ad ID | Pre-pause delivery | Selected-window spend | Pause request state |
|---|---:|---|---:|---|
| DRAFT — Divorce — A — Big Decision | `52524355583076` | Active | $343.34 | Off / Processing |
| DRAFT — King and Queen — A — Rebuild the Field | `52524476029876` | Active | $341.94 | Off / Processing |

No campaign, ad set, budget, audience, pixel, destination, creative asset, or unrelated draft was changed. The pre-existing `Review and publish (9)` draft queue was not published or discarded.

No campaign, ad set, budget, audience, pixel, destination, creative asset, or connector setting was changed. The only ad-level changes were the two exact owner-authorized dashboard-creative pauses documented above.
