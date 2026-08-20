# Support Tickets: Interconnected Klaviyo Embedded Form Does Not Auto-Mount in Chrome

**Affected page:** `https://try.theurbanmonk.com/interconnected-lp/`  
**Klaviyo form ID:** `SJAKDW`  
**Status:** Launch blocked. Do not direct traffic to the Klaviyo/Unbounce path until a fresh Chrome visit renders the form automatically and an email-only test reaches both Klaviyo and the Content Hub bridge.

## Unbounce Ticket

**Subject:** Custom JavaScript loaders do not execute on published page; Klaviyo embedded form never mounts in Chrome

**Message:**

> We need help diagnosing a published-page JavaScript execution issue on `https://try.theurbanmonk.com/interconnected-lp/`.
>
> The page contains the correct Klaviyo form placeholder: `<div class="klaviyo-form-SJAKDW"></div>`. The Klaviyo form is live, targeted to all visitors, enabled for all devices, and is configured as an embedded form.
>
> In a fresh Chrome visit, the placeholder remains empty: there is no email input, phone input, or submit button. We tested the Klaviyo loader in all supported Unbounce placements: page-head `async`, page-head `defer`, a DOMContentLoaded loader, and a guarded dynamic loader inside the form’s Custom HTML element. The source confirms each loader is present after publishing, but Chrome makes no Klaviyo network request and the embedded form never mounts.
>
> By contrast, manually appending the identical `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=XiGgUa` script through the Chrome Console causes the form to render immediately. This proves the form configuration is valid and suggests Unbounce is not executing or is sandboxing the published custom-loader code.
>
> We removed obsolete Refersion/Everflow affiliate scripts that were generating `ReferenceError: EF is not defined`; the Chrome console is now clear of those errors. The form still does not auto-mount.
>
> Please identify why custom scripts visible in the published page source do not execute on this page in Chrome, and advise the supported Unbounce method for loading a third-party embedded-form library after the Custom HTML placeholder exists.

## Klaviyo Ticket

**Subject:** Live embedded form `SJAKDW` does not auto-mount in Chrome, although manual loader injection renders it

**Message:**

> We need help with live embedded form `SJAKDW` on `https://try.theurbanmonk.com/interconnected-lp/`.
>
> The form is live, configured as an embed, targeted to all audience members, and enabled for all devices. Its published placeholder is exactly `<div class="klaviyo-form-SJAKDW"></div>`. The phone field is now optional, while the SMS consent opportunity remains visible.
>
> In a fresh Chrome page load, the placeholder remains blank. Chrome records zero Klaviyo requests, even though the published HTML contains the loader URL `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=XiGgUa`.
>
> A manual browser-console injection of that identical loader causes the form to render immediately with first name, email, phone, and SMS consent fields. A successful test then enters the correct Klaviyo Interconnected email path. This indicates the form definition and account configuration are valid, but the Onsite loader is not initializing from the published Unbounce execution context.
>
> Can you confirm whether there is any account-level, form-level, or loader requirement that would prevent a live embedded form from mounting automatically on this domain, despite the placeholder and loader URL being present? Please also confirm the recommended supported embed implementation for a third-party page builder where page-level scripts may be injected asynchronously.

## Evidence Summary

| Check | Verified result |
|---|---|
| Form live status, all-device targeting, and embed code | Confirmed in Klaviyo editor. |
| Phone/SMS requirement | Phone field changed to optional; SMS opportunity retained. |
| Legacy Everflow/Refersion scripts | Removed; previous `EF is not defined` exceptions cleared. |
| Manual loader injection in Chrome | Form renders immediately. |
| Published automatic loader variants | Present in source but do not mount the form in fresh Chrome. |
| Klaviyo form submission | Reaches the correct Klaviyo Interconnected path. |
| Content Hub bridge | Not yet verified; requires form auto-mount plus final email-only bridge test. |

## Required Launch Test

The launch path is ready only when a fresh Chrome visit displays the embedded form automatically, an email-only test can submit without phone/SMS consent, Klaviyo receives the lead, and the Content Hub records the corresponding bridge event. The VA-review flow must remain inactive until all four conditions are met.
