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

## Corrected Live Meta Traffic Path

The owner identified the actual live Meta traffic page as:

`https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta`

This page is the Kajabi **IC META LEADS - SP 26 Test** form. It rendered normally with required first-name and email inputs. With the owner-authorized marked browser submission, it redirected to:

`https://content.theurbanmonk.com/interconnected/thank-you-b`

That is the active $67 offer page, not the legacy Kajabi-only registration confirmation page. The page presents the $67 all-access offer and purchase controls.

The test browser displayed “This special offer has expired.” This must be interpreted carefully: the Thank You B component stores a 15-minute offer end time in the browser’s `localStorage` under a shared key. The test browser had already visited this same page during earlier diagnostic work, so its stored timer was expired. The purchase buttons themselves do **not** depend on the expired state in the source implementation; they still execute the checkout handoff. A fresh visitor browser starts a fresh 15-minute timer.

The remaining technical validation is a non-purchase check of the active $67 checkout URL plus review of the live-email offer path. No offer, timer, page, routing, or Kajabi configuration was changed.

## Corrected Funnel Verification Result

The owner-authorized marked browser submission on the actual live Meta page successfully redirected to `https://content.theurbanmonk.com/interconnected/thank-you-b`.

That Thank You B page rendered the $67 all-access offer and its purchase controls. A non-purchase navigation to the configured Kajabi offer destination, `https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout`, loaded the expected secure Kajabi checkout for **Interconnected: The Complete Healing Protocol** at **$67.00**.

> **Conclusion:** No form, redirect, thank-you-page, offer-handoff, or checkout-load failure was observed on the live Meta path.

The conversion decline cannot currently be attributed to a broken handoff. Precise page-level lead-to-sale measurement is not available from the Content Hub because the Kajabi site does not send `form_submission` events to the Content Hub receiver. Therefore, the earlier Content Hub lead cohort must not be treated as a reliable cohort for this exact Kajabi Meta form until that independently approved instrumentation gap is addressed.
