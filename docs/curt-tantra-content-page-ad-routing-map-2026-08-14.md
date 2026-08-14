# Tantra Content Page → Ad Routing Map

**Prepared for:** Curt  
**Purpose:** Route relationship-education ads to the correct Urban Monk content video before inviting people to take the Tantra quiz.  
**Status:** All seven landing pages now contain their finalized Wistia video. The content-first ad packages remain review-only until deliberately published.

> **Operating principle:** Cold traffic should arrive at the one story that matches the ad they clicked. The page’s video builds relevance and trust first; the soft, consistent next step is the Tantra quiz. Do not send cold content traffic directly to a product or checkout.

## Non-negotiable campaign setup

| Setting | Use this value |
|---|---|
| Campaign | `DRAFT — UM — Tantra Content Education — Traffic — US` |
| Objective | Traffic → Website → **Landing Page Views** |
| Geography | United States only |
| Audience | Broad adults 35–65+; do not use health-condition, sexual-behavior, relationship-status, or other sensitive-personal-attribute targeting |
| CTA | **Learn More** |
| Destination behavior | Ad → matched video page → soft quiz CTA → `/quiz/tantra` |
| Measurement ladder | PageView on content page → CompleteRegistration / Lead on quiz completion and email capture → InitiateCheckout / Purchase downstream |
| Retargeting | Use a neutral content-engagement audience and generic educational creative. Do not label or target people by presumed symptoms, sexual behavior, or relationship status. |

## First priority: redirect the six existing Tantra ads now that the videos are ready

These are the existing ad labels previously associated with the current Tantra test. Do **not** duplicate them. Update their destination URL to the content page below when Curt makes the content-first change.

| Existing ad | New destination | Matching video | Why this is the correct match | What happens next |
|---|---|---|---|---|
| **T-A** | `https://content.theurbanmonk.com/tantra/king-and-queen` | **King and Queen** — Wistia `onvqm5rc7p` | Household-energy, partnership, and relationship-leadership angle. | Video → soft quiz CTA |
| **T-B** | `https://content.theurbanmonk.com/tantra/king-and-queen` | **King and Queen** — Wistia `onvqm5rc7p` | Same broad relationship-foundation angle; preserve the creative distinction, but send both to one coherent page. | Video → soft quiz CTA |
| **T-C** | `https://content.theurbanmonk.com/tantra/why-he-stopped` | **For Men** — Wistia `kcvtkpe34a` | Best fit for the men’s stress, energy, confidence, and reconnection conversation. | Video → soft quiz CTA |
| **T-D** | `https://content.theurbanmonk.com/tantra/considering-divorce` | **Considering Divorce** — Wistia `sq3dol4frw` | The strongest content-first warm-up for the relationship-repair / difficult-decision angle. | Video → soft quiz CTA |
| **T-E** | `https://content.theurbanmonk.com/tantra/considering-divorce` | **Considering Divorce** — Wistia `sq3dol4frw` | Same message family; the page provides needed trust before the quiz. | Video → soft quiz CTA |
| **T-F** | `https://content.theurbanmonk.com/tantra/considering-divorce` | **Considering Divorce** — Wistia `sq3dol4frw` | Same message family; preserve the ad’s creative testing while aligning the destination with its story. | Video → soft quiz CTA |

### UTM format for the existing-ad redirects

Use the standardized content-first taxonomy below. The final part should identify the actual existing creative, for example `t_a`, `t_b`, or `t_d`.

```text
?utm_source=meta&utm_medium=paid_social&utm_campaign=tantra_content_education&utm_content=king-and-queen_t_a
```

> **Important routing correction:** Do not use the older `/tantra/why-stopped` destination appearing in an early draft matrix. The correct live route is `/tantra/why-he-stopped`.

## Full seven-page content-ad map

Each page has three matched, policy-safe review variants. The `A`, `B`, and `C` versions are different creative/copy tests for the **same** story and destination—not three different funnel stages.

| Page and finalized video | Exact destination | Matched review ads | Why this page exists | Suggested content-ad audience role |
|---|---|---|---|---|
| **Considering Divorce**  
Wistia `sq3dol4frw` | `https://content.theurbanmonk.com/tantra/considering-divorce` | `DRAFT — Content — considering-divorce — A/B/C` | A thoughtful relationship-repair conversation before a difficult season becomes a permanent decision. | Cold broad relationship-education traffic; also the first legacy-ad redirect priority. |
| **King and Queen**  
Wistia `onvqm5rc7p` | `https://content.theurbanmonk.com/tantra/king-and-queen` | `DRAFT — Content — king-and-queen — A/B/C` | The emotional atmosphere of a home, shared leadership, attention, and repair. | Cold broad traffic interested in partnership, family cohesion, and relationship practices. |
| **The Root and the Flower**  
Wistia `093er5q16m` | `https://content.theurbanmonk.com/tantra/sex-is-the-flower` | `DRAFT — Content — sex-is-the-flower — A/B/C` | Intimacy as the flower of communication, safety, energy, health, and mutual attention—not an isolated problem. | Broad whole-relationship education; a strong bridge to the quiz’s systems-aware pathways. |
| **For Men**  
Wistia `kcvtkpe34a` | `https://content.theurbanmonk.com/tantra/why-he-stopped` | `DRAFT — Content — why-he-stopped — A/B/C` | A curiosity-first conversation about stress, energy, pressure, confidence, and connection. | Men-oriented creative without personal-attribute targeting; use the existing T-C redirect first. |
| **Love Bank Account**  
Wistia `w2aws6tqfv` | `https://content.theurbanmonk.com/tantra/love-bank` | `DRAFT — Content — love-bank — A/B/C` | Small deposits of warmth and attention create a longer fuse for difficult seasons. | Broad relationship-resilience traffic; excellent evergreen education angle. |
| **Why She Stopped Showing Up**  
Wistia `zpqgfbnjp1` | `https://content.theurbanmonk.com/tantra/why-she-stopped` | `DRAFT — Content — why-she-stopped — A/B/C` | A compassionate conversation about life pressure, care work, sleep, stress, hormonal transition, communication, and attention. | Women-centered educational creative without inferring a viewer’s health status or sexual behavior. |
| **Ladies First**  
Wistia `1foy9s4idy` | `https://content.theurbanmonk.com/tantra/female-orgasm` | `DRAFT — Content — female-orgasm — A/B/C` | Respectful education on sensual attention, communication, comfort, mutual presence, and learning together. | Couples/relationship education creative using neutral, non-explicit copy and visuals. |

## Creative-to-page rule

Curt should use the matching creative, copy, and page as one unit:

| Ad package | Landing-page slug | Required UTM content values |
|---|---|---|
| Considering Divorce A / B / C | `considering-divorce` | `considering-divorce_a`, `_b`, `_c` |
| King and Queen A / B / C | `king-and-queen` | `king-and-queen_a`, `_b`, `_c` |
| Root and Flower A / B / C | `sex-is-the-flower` | `sex-is-the-flower_a`, `_b`, `_c` |
| For Men A / B / C | `why-he-stopped` | `why-he-stopped_a`, `_b`, `_c` |
| Love Bank Account A / B / C | `love-bank` | `love-bank_a`, `_b`, `_c` |
| Why She Stopped Showing Up A / B / C | `why-she-stopped` | `why-she-stopped_a`, `_b`, `_c` |
| Ladies First A / B / C | `female-orgasm` | `female-orgasm_a`, `_b`, `_c` |

## How the visitor moves through the funnel

```text
Policy-safe relationship-education ad
        ↓
Matched content landing page + finalized Wistia video
        ↓
Soft “Take the Tantra Quiz” invitation
        ↓
Quiz identifies relationship, gut, sleep, oral-health, or hormone context
        ↓
Appropriate education / clinician-guided next step or Tantra Him/Her path
```

The video page is a trust-building layer. It should not be converted into a hard-sales product page. The product or clinical-next-step discussion is deliberately downstream of the visitor’s voluntary quiz response.

## Curt’s implementation checklist

1. **Do not publish** the seven new content ad sets until the owner approves the exact budget, imagery, copy, and preview.
2. Repoint **T-A through T-F** using the first-priority table above; do not change the existing creative, audience, or spend at the same time unless specifically instructed.
3. Confirm that the destination URL includes the standardized Meta UTM pattern and that the page loads the matching Wistia video.
4. Choose **Landing Page Views**, not raw link clicks, for the content campaign.
5. Keep the ads United States-only and avoid sensitive-personal-attribute targeting or copy.
6. Check the standard events after launch: PageView on the content page, CompleteRegistration / Lead on the quiz, then checkout and Purchase downstream.
7. For retargeting, use only a neutral content-engagement audience and generic education creative that sends people to the quiz—not a label that implies why someone watched a video.

## Sources inside the Content Hub

- `shared/tantraContentAds.ts` — source of truth for the seven page-specific three-ad packages and standard destination URLs.
- `docs/tantra-video-embed-map-2026-08-14.md` — source of truth for the seven finalized Wistia video IDs and current public routes.
- `docs/meta-tantra-content-ad-draft-matrix-2026-08-14.md` — campaign-level launch guardrails, policy-safe copy matrix, and prior draft context.
