# Unbounce → Klaviyo Interconnected Readiness Check

**Scope:** Read-only verification. No form submission, flow edit, activation, traffic swap, or live-message action has been taken.

| Surface | URL | Initial observed state |
|---|---|---|
| Public Unbounce page | https://try.theurbanmonk.com/interconnected-lp/ | The page resolves over HTTPS and renders the Interconnected content, Wistia player, footer links, and registration-oriented content. The browser’s extracted public content did not expose a visible editable form control in the inspected render, so a form-provider/lead-delivery verification remains required. |
| Klaviyo flow | https://www.klaviyo.com/flow/YyFZPu/edit | Authenticated editor title confirms: **`[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67`**. This matches the owner’s described VA-review flow, but trigger/list binding and draft-message status still require inspection. |

The remaining readiness checks are: identify the form submit target and Klaviyo list/profile binding, verify a recent non-destructive test or real lead reaches that profile path, and inspect the flow trigger plus message statuses without activating or editing the flow.

## Bridge Inspection

The public Unbounce page contains the Klaviyo onsite loader for company `XiGgUa` and form ID `SJAKDW`. Its form-submission bridge listens only for that form’s successful Klaviyo submit event, keeps the Klaviyo subscription uninterrupted, and posts the anonymous conversion context to the Content Hub endpoint `https://content.theurbanmonk.com/api/interconnected/unbounce-lead`.

The bridge endpoint accepts only browser requests whose origin is `https://try.theurbanmonk.com` and whose page URL is exactly `/interconnected-lp/`; a command-line preflight without that browser origin correctly returns `403` and is not a production failure. On a valid submission with an email, the bridge records the lead as `funnel_path = ko_klaviyo`, `page_variant = unbounce`, and `klaviyo_synced = true`, then makes the matched Meta browser/CAPI Lead event attempt.

## Current Decision Gate

As of this read-only inspection, the local first-party record count for `page_variant = unbounce` is **zero**. That means the public page and Klaviyo form configuration are present, but there is not yet a genuine or prior bridge-recorded lead with which to prove end-to-end delivery. **Do not switch traffic or activate the VA-review flow on this evidence alone.** The safe next action is a single controlled test submission using a disposable address, followed by confirmation in both the Klaviyo profile/list path and the Content Hub bridge record; that action will create an external subscriber/profile and is therefore awaiting owner confirmation.

## Chrome Render Blocker: Exact Form Checks

The Unbounce container itself has a valid positive desktop size (`364 × 504px`) and mobile size (`283 × 587px`), so the present evidence does not support a zero-height or off-canvas container diagnosis. The highest-priority corrective checks are in **Klaviyo → Sign-up forms → the embedded form with ID `SJAKDW`**:

| Check | Required safe state |
|---|---|
| Form status | **Live** rather than draft or archived. |
| Form type | **Embed**. |
| Embed code | Exactly matches `<div class="klaviyo-form-SJAKDW"></div>` on the Unbounce page. |
| Targeting | Includes `https://try.theurbanmonk.com/interconnected-lp/` and does not exclude Chrome, the current device, or new visitors. |
| Display conditions | No restrictive rule that prevents the embed from appearing to a fresh Chrome visitor. |
| Onsite code | Only the single Klaviyo onsite script for company `XiGgUa` is loaded. |

Klaviyo’s official troubleshooting guidance confirms that an embedded form must be live, use the matching embed code, have enabled onsite tracking, and satisfy its targeting/display conditions before it will render. A clean incognito test is also recommended to eliminate cookie-based targeting effects.[1] [2]

## Post-Publish Chrome Finding

After the form was published, Chrome still rendered the Unbounce black form container without an email field or submit control. The Chrome-rendered DOM contains exactly one `klaviyo-form-SJAKDW` placeholder and exactly one `klaviyo.js?company_id=XiGgUa` loader, followed by Klaviyo’s signup-form runtime modules. The modules are therefore loading, but no interactive form nodes are mounting beneath the placeholder.

The next smallest corrective change is to move the single Klaviyo onsite loader out of the Unbounce form-box custom-code element and into Unbounce’s global page-level header/footer JavaScript area, while leaving only `<div class="klaviyo-form-SJAKDW"></div>` inside the visible form-box element. This separates the page-wide loader from the in-page mounting target and removes the remaining likely Chrome timing/mounting conflict. No duplicate loader should be added.

## Confirmed Chrome JavaScript Blocker

Chrome Console evidence identified the page exception precisely. The published Unbounce source loads `https://www.wt64trk.com/scripts/sdk/everflow.js` twice, then immediately calls `EF.click(...)` and `EF.impression(...)` while `EF` is undefined. The failing calls are at published source lines 11638 and 11656. Both scripts run before the Content Hub bridge and can terminate dependent page initialization in Chrome.

The smallest safe correction is to remove the obsolete **Refersion Click** / Everflow tracking scripts from this Interconnected Unbounce page or replace each direct `EF` call with a guarded block that runs only when `window.EF` exists. Removing the old Refersion scripts is preferred unless their attribution is still an explicitly required live dependency; the page is not using them for the approved Klaviyo, Content Hub, or Meta tracking path.

## References

[1]: https://help.klaviyo.com/hc/en-us/articles/115005249348 "Troubleshooting sign-up forms — Klaviyo Help Center"
[2]: https://help.klaviyo.com/hc/en-us/articles/360006897412 "How to embed a sign-up form on your website — Klaviyo Help Center"
