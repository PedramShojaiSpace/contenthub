# Kajabi Live Opt-In Sanity Check — Aug. 22, 2026

## Scope

Owner reports many current opt-ins with weak recent sales and requested a **Kajabi-only** check. Unbounce is explicitly out of scope because it is not carrying live traffic.

## Authenticated Kajabi Dashboard Snapshot

At the time of inspection, the authenticated Kajabi dashboard for **The Urban Monk Academy** displayed the following last-24-hour top-line metrics:

| Metric | Dashboard value |
|---|---:|
| Opt-ins | 885 |
| Offers sold | 19 |
| Gross revenue | $1,206.00 |
| Subscription revenue | $5,281.59 |

This confirms that Kajabi is receiving opt-ins and recording offer sales at the platform level. It does not, by itself, identify the exact Interconnected landing page, thank-you page, or offer attribution for the reported surge.

## Live Page Inventory

The authenticated Kajabi landing-page inventory shows 282 pages. Published Interconnected-relevant entries visible in the current inventory include:

- `[IC] Interconnected Free Screening META LEADS`
- `[IC] Interconnected Free Screening META LEADS 1`
- `Interconnected Purchased — Redirect`
- Multiple published Interconnected episode-view pages.

The next read-only step is to identify the actual currently trafficked page and inspect its public URL, rendered form, and post-submit behavior. No Kajabi page, webhook, checkout, pixel, or form configuration has been changed.

## Live Browser Submission Verification

The active public route was confirmed as `https://theacademy.theurbanmonk.com/interconnected`. It rendered a Kajabi-native form with **First Name**, **Email**, and **REGISTER NOW!** controls.

With owner authorization, one marked browser submission was made using a test name and a dedicated test email. The browser immediately reached the published Kajabi thank-you page:

`https://theacademy.theurbanmonk.com/aamp-ic-interconnected-free-screening-TY`

The displayed confirmation was **“You’re Registered!”** and instructed the registrant to look for The Urban Monk Academy login credentials. This verifies the actual on-screen form → thank-you redirect path on the live Kajabi traffic surface.

The authenticated Kajabi Contacts list did not apply its visible free-text search control during this session, so the specific test-contact row could not be independently isolated in the UI. That limitation does not affect the verified browser redirect. No page, form, offer, email, webhook, pixel, checkout, tag, or routing configuration was changed.

## Webhook Configuration Finding

The authenticated Kajabi **Webhooks** tab currently lists three `payment.succeeded` destinations only, including `https://content.theurbanmonk.com/api/kajabi/purchase`. It does **not** list a `form_submission` destination to `https://content.theurbanmonk.com/api/kajabi/optin`.

That configuration explains why the exact live browser test did not appear in the Content Hub’s `interconnected_leads` table after the normal delivery window: the form works natively inside Kajabi and reaches its thank-you page, but Kajabi is not currently configured to deliver form-submission events to the Content Hub opt-in receiver. This is a measurement and downstream-sync gap, not evidence that the Kajabi form or thank-you redirect has failed.

No webhook was added or edited. Adding one would be a separate, approval-gated configuration change.
