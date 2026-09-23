# Kajabi Interconnected Buyer Emails: Link Hotfix

**Prepared for:** Pedram and Jim  
**Date:** 23 September 2026  
**Status:** Required before any buyer-facing test or activation

## The problem

The current HTML package contains **literal placeholder text** inside its links, for example:

```html
<a href="{{PAID_SERIES_CONTINUE_URL}}">Continue with the next episode →</a>
```

That is not a web address. It is an unfinished content-production token. Kajabi can show the text as a link while editing, but an email inbox has no valid `https://` destination to open. The same defect affects support links such as:

```html
<a href="mailto:{{SUPPORT_EMAIL}}">{{SUPPORT_EMAIL}}</a>
```

The correct support version is:

```html
<a href="mailto:support@theurbanmonk.com">support@theurbanmonk.com</a>
```

> **Do not activate or send a buyer-facing test while any `{{TOKEN}}` remains inside an `href="…"` value.**

## The code rule

Every clickable email link must use a complete, real destination beginning with `https://` or, for email support, `mailto:`.

| Incorrect | Correct |
|---|---|
| `href="{{PAID_LIBRARY_URL}}"` | `href="https://theacademy.theurbanmonk.com/library"` |
| `href="{{PAID_EPISODE_1_URL}}"` | `href="https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided"` |
| `href="www.example.com"` | `href="https://www.example.com"` |
| `href="#"` | A real `https://` destination |
| `href="mailto:{{SUPPORT_EMAIL}}"` | `href="mailto:support@theurbanmonk.com"` |

A standard link with the existing visual style should look like this:

```html
<a href="https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided" style="color:#1a4b7a;text-decoration:underline;font-weight:700">Watch Episode 1 →</a>
```

Do not add JavaScript, a button script, a relative path such as `/products/...`, or a link shortener. Kajabi supports ordinary HTML `<a>` links in email content. [1]

## Links that can be repaired now

These are verified buyer destinations and may replace the corresponding placeholders immediately.

| Placeholder | Replace with this exact value | Used in |
|---|---|---|
| `{{PAID_LIBRARY_URL}}` | `https://theacademy.theurbanmonk.com/library` | Access delivery; Day 24 re-engagement |
| `{{PAID_EPISODE_1_URL}}` | `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` | Day 1 orientation |
| `{{PAID_SERIES_CONTINUE_URL}}` | `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` | Day 3 series activation |
| `{{SUPPORT_EMAIL}}` | `support@theurbanmonk.com` | Access delivery support link |

### Exact before-and-after examples

**Access delivery CTA**

```html
<!-- Before: invalid -->
<a href="{{PAID_LIBRARY_URL}}" style="color:#1a4b7a;text-decoration:underline;font-weight:700">Open your complete protocol →</a>

<!-- After: valid -->
<a href="https://theacademy.theurbanmonk.com/library" style="color:#1a4b7a;text-decoration:underline;font-weight:700">Open your complete protocol →</a>
```

**Day 1 orientation CTA**

```html
<!-- Before: invalid -->
<a href="{{PAID_EPISODE_1_URL}}" style="color:#1a4b7a;text-decoration:underline;font-weight:700">Watch Episode 1 and open your guide →</a>

<!-- After: valid -->
<a href="https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided" style="color:#1a4b7a;text-decoration:underline;font-weight:700">Watch Episode 1 →</a>
```

The visible words should match the destination. Remove **“and open your guide”** until the companion-guide URL is real.

## Links that cannot be fixed with code yet

These are not HTML failures. The underlying buyer destination is not live, not approved, or no longer matches the active commercial strategy. Do **not** substitute a made-up URL or a free-screening page.

| Current placeholder or message | Why it must not be sent as-is | Correct action |
|---|---|---|
| `{{STARTER_PROTOCOL_URL}}` | The Gut Restoration Protocol is still a Kajabi draft module. | Publish it and supply its buyer URL, or remove/rewrite the promise and CTA. |
| `{{COMPANION_GUIDE_URL}}` | The named Companion Guide has not been verified as a live buyer asset. | Publish it and supply its buyer URL, or remove the named inclusion. |
| `{{MASTERCLASS_URL}}` | The 5 Root Causes Masterclass is not yet a published buyer-accessible Kajabi module. | Publish it and supply its buyer URL, or remove the named inclusion. |
| `{{COMMUNITY_URL}}` | No verified community route/entitlement is available. | Provide an approved buyer-community URL, or remove the claim. |
| Day 6 `{{STARTER_PROTOCOL_URL}}` | It promises a resource that is not live. | Rewrite the email around a live series episode or wait for the protocol. |
| Day 13 and Day 30 `{{NEXT_WEBINAR_OR_EVERGREEN_URL}}` | No approved current webinar registration or evergreen page has been supplied. | Provide one URL, or hold/rewrite those emails. |
| Day 17 `{{BUYER_NEXT_STEP_HUB_URL}}` | No buyer next-step hub exists. | Supply/create the hub, or rewrite around one verified CTA. |
| Day 2 / Day 9 old $199 testing CTAs | The sequence was written for the old testing offer. The active strategy has moved to the $99 Upstream Course OCU. | Do not activate these messages until the recovery strategy and copy are intentionally revised. |

## Exact Kajabi procedure for Jim

1. Work only in **[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99**. Do not attach a subscriber trigger or add subscribers.
2. Open one message, click **Edit content**, select the main text block, and open the `<>` source-code editor.
3. Replace each approved `{{TOKEN}}` inside the HTML with its full value from the table above. Do not change the quotation marks around `href="…"`.
4. For a message containing an unresolved destination, do **not** send a test from it. Mark the message **HOLD — missing approved destination**.
5. In the source editor, paste only the body content. Do not add a second `<html>`, `<head>`, or `<body>` wrapper around the Kajabi template.
6. Save the text block, then save the email. Return to the sequence list, reopen the message, and confirm that the change persisted.
7. Send an internal test only after every CTA in that specific email has a real destination. In the received message, hover over each link before clicking; the status bar or long-press preview must show the same full URL from the table.
8. Test a delivered email, not only Kajabi’s visual editor. Kajabi notes that some preview-only links can behave differently from a received campaign message. [2]

## Required test result

A message passes only if every visible CTA meets all four conditions:

- The source contains a full `https://` or `mailto:` URL.
- The received email makes the CTA clickable.
- The clicked destination opens without an error.
- A buyer who signs in can reach the entitled Interconnected content.

If any raw token remains, the result is **not ready**. Do not solve that by changing it to `#`, by using a free-screening URL, or by silently routing the buyer to an unrelated product.

## References

[1]: https://help.kajabi.com/articles/marketing/email-campaigns/how-to-add-custom-html-to-your-emails "Add custom HTML to emails"

[2]: https://help.kajabi.com/articles/marketing/email-campaigns/why-is-the-view-in-browser-and-unsubscribe-link-in-my-email-campaign-not-working "Fix broken View in Browser and unsubscribe links"

[3]: ./interconnected-buyer-destination-map-2026-09-21.md "Interconnected Buyer Email Destination Map"
