# Jim’s Quick Review Guide: Unified LP-3 Klaviyo Draft

**Purpose:** Confirm that the new unified Interconnected email + consent-only SMS flow is ready for owner review. This is a review-only task. **Do not activate the flow, send a test, add anyone to a list, or change the current live flows.**

**Flow to open:** [DRAFT — JIM REVIEW] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS](https://www.klaviyo.com/flow/WaMDnA/edit)  
**Flow ID:** `WaMDnA`  
**Expected status:** Draft

## What is already verified

The technical audit already confirmed that the draft has the same eleven emails, links, subjects, and one-day delays as the current live email flow. It also confirmed that the draft’s ten personalized episode links render to Episodes 1 through 10 in the correct order. All three fixed web destinations are live and reachable.

Your job is the last visual check inside Klaviyo. You are confirming that the canvas looks correct and that one authorized internal profile sees a working personalized episode link. You are not testing the live audience.

## The flow should look like this

```text
Email 1 → SMS consent check → Yes: SMS 1 / No: skip SMS → 1-day delay → Email 2
Email 2 → SMS consent check → Yes: SMS 2 / No: skip SMS → 1-day delay → Email 3
...
Email 10 → SMS consent check → Yes: SMS 10 / No: skip SMS → 1-day delay → Email 11
Email 11 → SMS consent check → Yes: SMS 11 / No: skip SMS → End
```

The purpose of each consent check is simple: **only people who are currently subscribed to marketing SMS can enter the SMS branch.** Everyone still receives the email path. A phone number by itself is not permission to receive SMS.

## Five-minute review checklist

### 1. Confirm this is the correct draft

Open the flow link above. Confirm that the title begins with **[DRAFT — JIM REVIEW]** and that the flow status is **Draft**. If it says Live, do not touch anything. Take a screenshot and stop.

Confirm the trigger is the existing **Interconnected Free Screening Opt-Ins** list condition. Do not replace it with a different list, a broader audience, or a phone-number condition.

### 2. Check the beginning, middle, and end of the canvas

Review three spots on the canvas: the first position, a middle position, and the final position. Use Email 1, Email 6, and Email 11.

For Emails 1 and 6, make sure the map is: **Email → SMS marketing-consent check → allowed SMS or skip → same 1-day delay → next email.** Both the Yes and No routes must come back together at the same delay. The No route must not pass through an SMS.

For Email 11, confirm the same consent check is present, but there is no additional delay after the final email. Both the permitted-SMS route and the no-SMS route should end there.

### 3. Check the consent rule itself

Open one of the SMS consent checks. It must say that the person is currently subscribed to **marketing SMS**. The condition must not be based only on a phone number, a custom property, or a list membership that could include non-consented people.

The **Yes** path should lead to a draft SMS. The **No** path should skip the SMS. Do not change the condition or turn either branch on.

### 4. Check the email timing

Open the delay after Email 1, Email 6, and Email 10. Each should display **1 day**, using the recipient’s **profile timezone**. The final Email 11 should have no following delay.

Do not change a delay even if it looks different from a prior campaign. This draft is intended to keep the existing LP-3 cadence unchanged.

### 5. Check one personalized episode link

Open **Email 2** and choose **Preview**. Select an existing internal Urban Monk reviewer profile that is already authorized to review this experience. Do not select a customer or create a new contact.

Check the Episode 1 button/link. The URL must contain a real resolved value after `ic_access=`. It must **not** show the literal text `{{ person.KlaviyoID }}`.

Open the generated Episode 1 link in a new tab. With an authorized internal review profile, the secure verification should complete and the page should enter the expected access state. If the page shows a secure-access failure, expired message, or a loop, take a screenshot and stop. Do not try to “fix” this by activating the flow or adding a new lead.

### 6. Spot-check the two fixed purchase links

Still in Preview, open **Email 3** and verify that the testing offer CTA opens the intended Shopify product page. Then open **Email 11** and verify that the Platinum bundle CTA opens the intended Shopify product page.

These pages were already checked technically. This visual check simply confirms that the buttons still look and behave correctly in Klaviyo’s editor.

### 7. Check message status before closing

Open one early, one middle, and one final email, plus one early, one middle, and one final SMS. Each must still show **Draft**. Do not publish individual actions.

The final approval process will handle activation later. Jim’s role today is confirmation and reporting only.

## Stop and report immediately if any of these occurs

| If you see this | Do this |
|---|---|
| The unified flow is Live, not Draft | Stop. Take a screenshot. Do not change anything. |
| The trigger is not Interconnected Free Screening Opt-Ins | Stop. Take a screenshot. |
| A consent check relies only on a phone number | Stop. Take a screenshot. |
| The No branch goes into an SMS | Stop. Take a screenshot. |
| A delay after Emails 1–10 is not 1 day | Stop. Take a screenshot. |
| The episode URL contains `{{ person.KlaviyoID }}` as literal text | Stop. Take a screenshot. |
| The internal preview profile cannot pass secure episode access | Stop. Take a screenshot of the error. |
| Any email or SMS action is already Live | Stop. Take a screenshot. |

## What to send back after the review

Copy and complete this note:

> I reviewed Klaviyo flow **WaMDnA**. The flow remains Draft. The trigger is Interconnected Free Screening Opt-Ins. I checked Email 1, Email 6, and Email 11; the SMS consent branches and one-day delays look correct. I previewed Email 2 with an authorized internal profile and the Episode 1 link [worked / did not work]. I spot-checked the Email 3 and Email 11 purchase links [worked / did not work]. I did not activate, edit, send, or enroll anyone. [Attach screenshots only if something did not match.]

## Important: do not take these actions

Do not activate the unified flow. Do not turn any individual email or SMS live. Do not add a person to the trigger list. Do not send a test email or text. Do not pause, stop, rename, edit, or delete either existing live LP-3 flow.

The separate improvement that changes the order of SMS consent subscription and list-trigger creation is also not part of this review. It requires owner approval and a controlled test before any production change.

## References

[1]: https://www.klaviyo.com/flow/WaMDnA/edit "Unified LP-3 Klaviyo draft flow"
[2]: https://help.klaviyo.com/hc/en-us/articles/115005081907 "How to preview and send test emails in Klaviyo"
[3]: https://help.klaviyo.com/hc/en-us/articles/4408802648731 "Klaviyo message personalization reference"
