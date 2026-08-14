# Tantra Meta Launch Readiness and Destination Strategy

**Purpose:** Clarify what is already complete, what the Content Hub can complete without additional judgment, what requires a human account-control decision, and whether static Meta creative should send visitors to a video content page or directly to the Tantra quiz.

## Executive decision

Use **matched static creative → matched content page with the Wistia video → soft quiz invitation** as the primary cold-audience path.

Use **static creative → direct quiz** only as a controlled secondary path for neutral content-engagement retargeting, or as a small clean control after the content-page baseline is established. Do not lead the cold campaign with direct-to-quiz traffic.

This follows the actual business problem: the current quiz is asking a cold audience to give information before the audience has enough context or trust. The video page provides that context first. Meta describes Traffic campaigns as appropriate for education and consideration, while its own guidance describes landing-page-view optimization as delivery toward people likely to click and fully load the destination. [1] [2] A direct website-lead path becomes more useful after there is enough stable quiz-registration volume to train on the Lead event.

## What is already complete

| Area | Status | What it means |
|---|---|---|
| Seven public content pages | **Complete** | Each page has the relevant narrative, finalized Wistia video, and a soft CTA to `/quiz/tantra`. |
| Final Wistia mappings | **Complete** | All seven received Wistia video IDs are embedded on the matching page. |
| Thumbnails | **Complete** | Seven 2560×1440 Wistia-ready JPEG covers have been delivered for manual Wistia upload. |
| Page-specific ad copy | **Complete** | Each page has three policy-safe static ad variants in Content Hub. |
| UTM destinations | **Complete** | Standard source, medium, campaign, and content values are built into every page-specific draft package. |
| Measurement | **Complete** | Content pages produce PageView; the quiz sends standard CompleteRegistration and Lead after capture; downstream checkout and purchase events remain available. No quiz answers or health details are sent to Meta. |
| Content-to-quiz strategy | **Complete** | The exact T-A through T-F destination changes and the seven page-specific packages are documented for Curt. |
| Draft workflow | **Complete** | Content Hub can create an ad package as **Paused** draft objects; it cannot publish or spend without a human activation choice. |

## What I can do directly

| Task | Can be completed by Content Hub | Meta API cost / risk | Current state |
|---|---|---|---|
| Maintain pages, Wistia IDs, copy, thumbnails, CTA, and UTM URLs | Yes | None | Complete |
| Maintain standard browser/CAPI event code and saved reporting snapshot | Yes | None for page maintenance | Complete |
| Generate or revise page-specific ad copy and review package | Yes | None | Complete |
| Create one **Paused** campaign/ad set/ad package after written approval | Yes | One-time Meta write calls; no spend and no public delivery | Ready, but not needed until Curt approves exact package |
| Repoint a current ad destination in Ads Manager | Technically possible only through a deliberate account change | Changes active campaign behavior; should be reviewed first | Curt / owner review required |
| Activate a campaign, ad set, or ad | No autonomous activation | Starts spend and delivery | Owner or Curt must toggle |
| Verify current Meta performance on demand | Deliberately not on demand | Preserves API-call budget | Replaced with one saved previous-day morning batch |

## What Curt or the owner must toggle

The remaining work is intentionally small, but it is human-controlled because it changes active advertising or spends money.

| Required human action | Why a person must do it | Exact decision |
|---|---|---|
| Review the thumbnail in Wistia and set it as the video’s cover | Wistia media-library selection is a visual brand decision | Upload the corresponding JPEG and assign it to each Wistia video. |
| Approve the exact ads in Ads Manager | The final preview, placements, identity, and any account-warning resolution are visual/account decisions | Confirm headline, primary text, thumbnail/static creative, URL, and UTM. |
| Approve or make the six legacy destination changes | They modify existing active ad delivery | T-A/T-B → King and Queen; T-C → For Men; T-D/T-E/T-F → Considering Divorce. |
| Turn the selected draft campaign/ad set/ad objects from Paused to Active | This begins spend | Activate only after the final preview is approved. |
| Confirm ad-account billing / delivery / policy notices | Only the account owner can resolve account-level conditions | Resolve any Meta prompts in Ads Manager if they appear. |

## The recommended audience-destination architecture

### Primary path: content-first for cold traffic

```text
Static relationship-education creative
        ↓
Matching article / Wistia video page
        ↓
Voluntary soft quiz invitation
        ↓
Tantra quiz → appropriate next step
```

This path gives the visitor a clear message match. Someone who clicks a Love Bank creative sees Love Bank Account. Someone who clicks a For Men creative sees For Men. That reduces the feeling of bait-and-switch and gives the content a chance to establish why the quiz is worth taking.

Use the Traffic objective with **Landing Page Views**, not raw link clicks, at this stage. Meta defines an LPV as a click that results in the destination page fully loading and says the optimization aims for people likely to click and load the page. [1]

### Secondary path: direct quiz for warm content engagement

```text
Neutral relationship-education creative
        ↓
Direct Tantra quiz
        ↓
Appropriate next step
```

This is appropriate only after a visitor has engaged with the content page or video in a neutral 30-day content-engagement audience. The creative must remain generic: it must not imply the person has a specific relationship, health, sleep, hormonal, or sexual concern.

The direct-quiz route is valuable as a **control**, not as the primary cold path. It answers a useful question: after someone has seen the education, does removing the extra click create more qualified quiz registrations? It should use a distinct UTM content value, such as `retarget_quiz_a`, and optimize to the standard Lead event only when the quiz has a stable volume of registrations.

### Why not send all cold traffic straight to the quiz?

The existing evidence is behavioral, not theoretical: the quiz has had meaningful completion activity but weak purchase conversion, and the stated concern is that people do not yet know or trust Dr. Pedram Shojai. A direct quiz removes a click but also removes the trust-building narrative. It risks buying inexpensive quiz starts from people willing to answer questions rather than people motivated to act.

Meta itself distinguishes Traffic campaigns—useful for educating people and sending them to a website—from conversion-oriented objectives when the desired action can be measured by the pixel. [2] That supports a staged approach: earn attention and a completed page load first, then shift toward the observed quiz-registration or purchase action only when enough event signal exists.

## Recommended first launch configuration

Do **not** create or activate all 21 content-ad variants at once. That would fragment learning and add unnecessary Meta write calls while the campaign is being throttled for API use.

| Priority | Existing asset / package | Destination | Reason |
|---|---|---|---|
| 1 | T-D, T-E, T-F | Considering Divorce | Three existing creatives already share the strongest relationship-repair angle; the new video gives them a proper educational destination. |
| 2 | T-A, T-B | King and Queen | Broadest household / partnership message, appropriate for cold education. |
| 3 | T-C | For Men | Clear narrative match to the existing men’s creative. |
| 4 | Love Bank, Root and Flower | Their matching pages | Add as the second content-wave after the first three paths show reliable LPVs and quiz registrations. |
| 5 | Why She Stopped Showing Up, Ladies First | Their matching pages | Add after the first wave, with carefully reviewed non-explicit creative and neutral audience language. |
| 6 | Direct-quiz retargeting control | `/quiz/tantra` | Add only after neutral content engagement accumulates and use a generic relationship-education message. |

This keeps the total spend governed by the existing approved cap rather than adding seven new ad sets at once. It also means Curt reviews only the three content routes that already align with the six current ad labels.

## I can prepare this now; Curt only reviews and toggles

1. I can keep the landing pages, creative packages, UTM map, Wistia links, and measurement exactly as they are.
2. I can produce paused, review-only Meta draft packages once you tell me which **first-wave** packages to create. The recommended first wave is the existing T-A through T-F redirects; no new cold ad-set proliferation is needed on day one.
3. Curt should review the actual creative preview, choose the Wistia cover image in Wistia, confirm the exact destination URLs, and toggle only the selected ads from Paused to Active.
4. After content engagement exists, I can prepare a separate **direct quiz retargeting control** that Curt can activate later. It should not be blended into the cold content campaign.

## Sources

[1] [Meta Business Help Center — About landing page view optimization](https://www.facebook.com/business/help/417293491972212)

[2] [Meta for Business — Traffic objective](https://www.facebook.com/business/ads/ad-objectives/traffic)

[3] [Meta for Business — Lead ads](https://www.facebook.com/business/ads/ad-objectives/lead-generation)
