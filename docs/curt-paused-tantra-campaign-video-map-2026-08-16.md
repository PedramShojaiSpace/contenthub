# Curt Review Map — Paused Tantra Campaigns and Video Landing Pages

**Current status:** All six listed campaign records are **PAUSED**. This document is for review and destination planning only. Do not reactivate or edit campaign settings during the review call unless the owner explicitly approves the exact next change.

## The Six Existing Paused Campaigns

| Record | Current campaign title | Direct Meta review link | Verified status | Intended content destination when the content-first path is approved |
| --- | --- | --- | --- | --- |
| T-A | *Is Your Life Force Running on Empty?* | [Open T-A in Meta Ads Manager](https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=52590261991605) | Paused | [King and Queen](https://content.theurbanmonk.com/tantra/king-and-queen) — Wistia `onvqm5rc7p` |
| T-B | *Why Don’t I Want to Anymore?* | [Open T-B in Meta Ads Manager](https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=52590262019805) | Paused | [King and Queen](https://content.theurbanmonk.com/tantra/king-and-queen) — Wistia `onvqm5rc7p` |
| T-C | *The Taoist Secret to Sexual Vitality* | [Open T-C in Meta Ads Manager](https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=52590262032405) | Paused | [For Men](https://content.theurbanmonk.com/tantra/why-he-stopped) — Wistia `kcvtkpe34a` |
| T-D | *Before You Call a Lawyer* | [Open T-D in Meta Ads Manager](https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=52591069310805) | Paused | [Considering Divorce](https://content.theurbanmonk.com/tantra/considering-divorce) — Wistia `sq3dol4frw` |
| T-E | *You Didn’t Fall Out of Love* | [Open T-E in Meta Ads Manager](https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=52591069324605) | Paused | [Considering Divorce](https://content.theurbanmonk.com/tantra/considering-divorce) — Wistia `sq3dol4frw` |
| T-F | *The Divorce Industry Doesn’t Want You to Know This* | [Open T-F in Meta Ads Manager](https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=52591069339605) | Paused | [Considering Divorce](https://content.theurbanmonk.com/tantra/considering-divorce) — Wistia `sq3dol4frw` |

> The direct links use each verified Meta campaign identifier. Meta will open the selected campaign inside the account associated with Curt’s login.

## Important: Six Existing Campaigns Do Not Cover Seven Video Pages

The paused six map to **three** live content pages: King and Queen, For Men, and Considering Divorce. They do **not** yet provide a live existing-campaign path for the other four videos below. Do not force a mismatched existing campaign to these pages.

| Video landing page ready for a later matched draft | URL | Required future content package |
| --- | --- | --- |
| The Root and the Flower | [Open landing page](https://content.theurbanmonk.com/tantra/sex-is-the-flower) | `DRAFT — Content — sex-is-the-flower — A/B/C` |
| Love Bank Account | [Open landing page](https://content.theurbanmonk.com/tantra/love-bank) | `DRAFT — Content — love-bank — A/B/C` |
| Why She Stopped Showing Up | [Open landing page](https://content.theurbanmonk.com/tantra/why-she-stopped) | `DRAFT — Content — why-she-stopped — A/B/C` |
| Ladies First | [Open landing page](https://content.theurbanmonk.com/tantra/female-orgasm) | `DRAFT — Content — female-orgasm — A/B/C` |

## What Curt Should Do During This Review Call

1. Open each of the six Meta links above and confirm it remains **Paused**. Do not click **Activate**.
2. Compare the ad’s creative and first line of copy with the mapped video page. The match should be a coherent story, not merely a generic Tantra destination.
3. Check that the target content page loads the named Wistia video and includes only a soft path to the Tantra quiz.
4. When the owner approves the content-first relaunch, replace the current destination with the exact mapped URL plus this UTM pattern:

   ```text
   ?utm_source=meta&utm_medium=paid_social&utm_campaign=tantra_content_education&utm_content=<page-slug>_t_<letter>
   ```

   Example for T-A:

   ```text
   https://content.theurbanmonk.com/tantra/king-and-queen?utm_source=meta&utm_medium=paid_social&utm_campaign=tantra_content_education&utm_content=king-and-queen_t_a
   ```

5. Keep the campaign **Traffic → Website → Landing Page Views**, United States only, with neutral relationship-education creative and no sensitive-personal-attribute targeting.
6. Verify the page event ladder before any reactivation: `PageView` on the content page; `CompleteRegistration` / `Lead` on the quiz; then `InitiateCheckout` and `Purchase` downstream.
7. Do not create or activate the four missing page-specific packages until each has approved creative, copy, preview, UTM, audience, and budget. The existing six are enough for the first content-first wave.

## Recommended First Content-First Wave

Use the existing paused six only after approval: T-A and T-B to King and Queen; T-C to For Men; T-D, T-E, and T-F to Considering Divorce. This preserves the existing creative test records while giving cold traffic a relevant trust-building video before the quiz. The other four video pages should be a separate second-wave build, not a hurried edit to the paused campaigns.

## Evidence Source

Campaign IDs and paused status were verified through a read-only Meta object-status query after the owner-approved pause. Landing-page and Wistia mappings follow the existing seven-page content-ad routing plan in `docs/curt-tantra-content-page-ad-routing-map-2026-08-14.md`.
