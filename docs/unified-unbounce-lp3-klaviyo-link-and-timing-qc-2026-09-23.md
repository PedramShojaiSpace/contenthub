# Unified Unbounce LP-3 Klaviyo Draft — Link and Timing Quality Control

**Scope:** This review covers the draft-only unified flow **[DRAFT — JIM REVIEW] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** (`WaMDnA`). It did not send mail or SMS, add a person to a list, change a live flow, modify a template, alter access timing, or adjust any checkout, offer, traffic, or consent setting.

## Conclusion

The eleven email templates in the unified draft are **exact copies** of the eleven templates in the current live email sequence. Their HTML, links, subject lines, sender/message configuration, and ten one-day delay records match the source flow. The draft therefore preserves the prior schedule rather than introducing a new timer or page-opening sequence.

All three fixed web destinations in the email templates returned successful public responses. The ten episode links also render correctly through Klaviyo’s template engine: each resolves its `{{ person.KlaviyoID }}` tag into the recipient-specific `ic_access` value and points to the corresponding episode number. This is not an unresolved placeholder defect. Klaviyo documents `{{ person.KlaviyoID }}` as its built-in profile identifier personalization tag. [1]

> The only remaining validation that cannot be done without using a real recipient context is one internal **Klaviyo Preview with Profile** for an existing consenting staff profile. That confirms the recipient-specific episode access claim succeeds end-to-end in the screening application. No test email should be sent and no new lead should be enrolled during this draft review.

## Template, link, and cadence results

| Control | Result | Detail |
|---|---:|---|
| Draft email positions reviewed | Passed | 11 of 11 |
| Draft HTML equals live source HTML | Passed | Each cloned draft template is byte-for-byte identical to its paired live template. |
| Email link sets equal live source | Passed | All 11 link sets match their paired live templates. |
| Email action configuration equals source | Passed | Sender/message configuration matched after excluding the intentionally separate template ID and draft/live action status. |
| Email subject lines match source | Passed | 11 of 11 |
| Delay records equal source | Passed | 10 of 10, each set to **1 day** in the recipient’s profile timezone. |
| Fixed HTTP destinations reachable | Passed | 3 of 3 returned HTTP 200 with no unintended redirect. |
| Personalized episode links rendered by Klaviyo | Passed | 10 of 10 rendered with a safe synthetic profile ID. |
| Personalized episode order | Passed | Email positions 2–11 route to Episodes 1–10 respectively. |
| Unresolved personalization tags in rendered episode URLs | None | All ten rendered URLs contained the supplied ID value rather than literal tag text. |

## Destination map

| Email position | Destination | Verification result |
|---:|---|---|
| 1 | Content Hub Interconnected thank-you page | HTTP 200; remained on `content.theurbanmonk.com/interconnected/thank-you-klaviyo`. |
| 2 | Episode 1 with personalized `ic_access` | Klaviyo rendered an episode-1 URL with the synthetic value; the public page reached its secure access-verification state. |
| 3 | Episode 2 with personalized `ic_access`; testing product page | Episode 2 link rendered correctly. The Shopify testing product page returned HTTP 200. |
| 4 | Episode 3 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 5 | Episode 4 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 6 | Episode 5 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 7 | Episode 6 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 8 | Episode 7 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 9 | Episode 8 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 10 | Episode 9 with personalized `ic_access` | Correct episode-specific dynamic URL rendered. |
| 11 | Episode 10 with personalized `ic_access`; Platinum bundle product page | Episode 10 link rendered correctly. The Shopify Platinum bundle page returned HTTP 200. |

## Timing verification

The live source email flow and the unified draft each contain ten delay records after Email positions 1 through 10. Every compared delay is **one day**, with no secondary value, in the recipient’s profile timezone. The final eleventh email does not have a following delay. This is exactly the prior email cadence.

The unified draft adds SMS consent gates without changing that cadence. After each email, the current SMS-marketing-subscribed condition is evaluated. A consented person may enter the paired draft SMS action and then rejoins the same existing delay. An email-only person bypasses the SMS action and proceeds directly to that same delay. Thus the consent branch does not create a second clock or change the next email’s scheduled interval.

## Episode access and expiry behavior

The episode application exposes a secure `ic_access` claim process. A synthetic, non-live value appropriately reached the public page but failed secure verification with the message that the access link could not be verified. This is expected and confirms the application does not grant access merely because a value exists in the URL.

The application distinguishes **waiting**, **active**, and **expired** access phases. It only renders an episode when the access status is active and that episode is within the available count. The email audit did not alter those rules. Because a real profile identifier cannot safely be guessed or disclosed, the final receiving-side claim check is intentionally reserved for Jim’s authenticated Klaviyo preview using an existing internal profile. The preview should be used rather than a new live trigger or test send. Klaviyo recommends previewing profile-based personalization with a real profile before a live send. [2]

## Jim’s five-minute final review

1. Open the [draft flow `WaMDnA`](https://www.klaviyo.com/flow/WaMDnA/edit) and confirm it remains **Draft**.
2. Open Email 2, choose **Preview**, and select an existing internal profile that is already authorized for review. Confirm its Episode 1 button URL contains a resolved identifier rather than the literal `{{ person.KlaviyoID }}` text.
3. In the same preview, open the generated episode link in a new tab. Confirm the secure verifier completes and the page is in the expected access state for that internal profile. Do not use a customer profile or create a new lead.
4. Spot-check Email 3 and Email 11 for the same resolved URL behavior, plus the fixed Shopify CTA in each relevant email.
5. In the flow canvas, confirm every delay after Emails 1–10 still displays **1 day** and that each SMS consent gate routes both branches into the same next-delay position.

Do **not** activate the flow, turn individual messages live, send a test, add a contact, or stop either current live flow. The separate production repair that changes the future order of SMS subscription and list-trigger creation remains unapproved and out of scope for this review.

## References

[1]: https://help.klaviyo.com/hc/en-us/articles/4408802648731 "Klaviyo message personalization reference"
[2]: https://help.klaviyo.com/hc/en-us/articles/115005081907 "How to preview and send test emails in Klaviyo"
