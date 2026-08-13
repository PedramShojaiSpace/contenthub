# Interconnected Day 0 Gmail Promotions Diagnosis — 2026-08-12

## Official Gmail Context

Google describes Promotions as the category for “deals, offers, newsletters and other call to action” messages. Gmail’s placement uses a machine-learning classification system that considers sender identity, message content, and how Gmail users interact with similar content; direct recipient action is the most important individual preference signal. [1]

Google also requires authentication for personal Gmail delivery: all senders need SPF or DKIM, while bulk senders need SPF, DKIM, and DMARC. It specifically cautions against mixing message types in a single email, recommends clear sender identity, visible links, recipient consent, gradual changes to sending format, and Postmaster Tools monitoring. [2]

## Initial Attachment Observation

Both supplied files are Klaviyo-rendered HTML emails. The original is formatted across many lines, while the Content Hub version is compressed into one line. Initial visible-content review shows the same sender text, offer claims, two Kajabi checkout links, header logo, two supplementary images, seven social links, unsubscribe footer, heavy sales language, and P.S./P.P.S. calls to action. A semantic comparison is still required to confirm whether the enhancement changed any underlying content or only minified the markup.

## Attachment Comparison Result

The two files have **the same link inventory, image inventory, and promotional-text count**. Both include two checkout links, the same 10 remote image calls (including a duplicate TikTok icon), the same header image and support-address links, and 18 repeated offer/urgency phrases such as “unlock,” “lowest price,” “2 hours,” “permanent,” “all-access,” and “guarantee.” The visible email copy is materially unchanged; the Content Hub file is 1,333 bytes smaller because it minifies whitespace and omits spaces within CSS declarations. That formatting difference is not a plausible cause of Promotions placement.

## Likely Classification Cause

This is a marketing offer placed in a registration-confirmation wrapper: a two-hour limited-price offer, all-access upgrade, permanent ownership claims, two checkout CTAs, a 30-day guarantee, a P.S. urgency reminder, a P.P.S. action request, multiple images, and seven social destinations. Google explicitly describes Promotions as the category for deals, offers, newsletters, and other call-to-action emails. [1] This is a content-category result, not evidence that the Content Hub enhancement harmed delivery.

## Authentication Findings Requiring Repair

The public DNS response for `theurbanmonk.com` contains **two SPF TXT records**, each beginning `v=spf1`. SPF permits only one SPF record per domain; multiple records can cause a permanent SPF evaluation error. The public lookup also returned no DMARC TXT record at `_dmarc.theurbanmonk.com`. These items do not explain Promotions categorization by themselves, but they are meaningful inbox-delivery and sender-reputation risks. Google requires SPF or DKIM for all senders and SPF, DKIM, and DMARC for bulk senders; Klaviyo also recommends a branded sending domain and DMARC alignment. [2] [3]

## Corrective Plan

1. **Do not attribute the tab change to the Content Hub HTML.** The email’s visible content and assets are effectively unchanged.
2. **Split the message type.** Make Day 0 a plain, personal confirmation/onboarding email with no price, urgency, checkout link, guarantee, P.S. offer, or social-icon strip. Send any $67 offer separately as a clearly promotional follow-up. This does not attempt to manipulate Gmail; it aligns the message content to its stated transactional/onboarding purpose.
3. **Repair DNS authentication before sending material volume.** Consolidate SPF into one record that includes every legitimate sender, publish DMARC initially with `p=none` and an inbox for aggregate reports, and verify the actual Klaviyo message header shows `spf=pass`, `dkim=pass`, and `dmarc=pass`.
4. **Remove low-value template noise.** Delete the literal `HTML Block` artifact if it renders, the duplicate TikTok icon, and the broad social-icon row from the confirmation email.
5. **Measure placement responsibly.** Use seed Gmail accounts plus Postmaster Tools, and compare open/click/reply rates for the confirmation and promotional emails separately. Gmail’s category is not itself a deliverability failure; Spam placement, authentication failure, complaint rate, and delivery deferrals are the urgent metrics.

## Prepared Day 0 Draft

`interconnected-day0-confirmation-draft.html` is a deliberately plain Day 0 confirmation draft. It uses no images, no offer price, no checkout link, no urgency, no social strip, no P.S., and no claim beyond the requested series delivery. It is not an attempt to disguise a promotion; the $67 offer belongs in a separate marketing message and can continue to be measured as promotional content. The draft has not been applied to Klaviyo.

## Klaviyo Draft Created

The draft-only Klaviyo code template `[DRAFT] Interconnected Day 0 — Plain Confirmation Deliverability Test` was created with template ID `Smbiqi`. Its subject is **“You’re in — Interconnected starts tomorrow”** and its preview is **“Your episode schedule and a note from Dr. Pedram.”** The template is not attached to a flow or a live email action, so no recipient can receive it without a separate explicit configuration change.

The dedicated draft regression test passed. The broader suite retains unrelated legacy failures in `emailBoost.test.ts` and `metaAdPush.test.ts`; those failures predate this draft and do not involve the Day 0 email template.

## Visual Layout Repair

The draft template was updated in place with a compact email-safe layout: a warm neutral outer canvas, a high-contrast off-white reading card, a restrained Urban Monk masthead, 34px desktop and 24px mobile content margins, 17px body type with 1.7 line height, and a clearly separated “What happens next” context panel. The message remains text-first and non-promotional; no image, checkout CTA, price, urgency, social strip, or live flow action was added.

The shared `buildEmailHtml` helper now uses the same reusable reading frame for future direct emails generated by the Content Hub. Focused visual-layout and non-promotional draft tests passed.

## Active Template Mobile Repair

The phone screenshot was not showing the draft template `Smbiqi`. It was showing the separate active Klaviyo code template **Day 0 opt in EG sp26** (`XTHuPY`). That template retained the dense legacy builder markup: 14px body copy, repeated empty blocks, a full-bleed 600px logo, zero effective content-frame margins on mobile, a saturated coral page background, and multiple visual strips.

The active template was updated in place after guarded template-ID and name verification. The existing copy, name, text version, and flow linkage were preserved. The repair adds a warm neutral outer canvas, 38px desktop content padding, 28px mobile side padding, 17px readable body type, more generous line height, a constrained mobile logo, and simplified vertical rhythm. API readback confirmed the readability marker and spacing changes were stored on `XTHuPY`.

## Direct Draft Review Route

The Day 0 draft can be opened in an authenticated Klaviyo browser session at `https://www.klaviyo.com/email-template-editor/universal/template/Smbiqi`. The route opens the editor shell, but Klaviyo currently reports a template-load error for this API-created code template. This is an editor-preview limitation; the draft HTML remains saved via API and is not associated with any flow. A separate `/code/` editor route is not available.

## Sources

[1] Google Workspace, “Making Gmail’s tabbed inbox work better for you,” https://workspace.google.com/blog/productivity-collaboration/how-gmail-sorts-your-email-based-on-your-preferences

[2] Google, “Email sender guidelines,” https://support.google.com/a/answer/81126?hl=en
