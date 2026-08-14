# Urban Monk Content-First Meta Draft Matrix

## Operating design

This is a **draft-only** traffic test designed to introduce cold audiences to short relationship-education content before asking them to take the Tantra quiz. The recommended initial structure is one campaign, seven ad sets (one landing page each), and three static-image ads per ad set. Each ad uses a neutral **Learn More** call to action and links to the educational page—not directly to a product or checkout.

The proposed campaign objective is **Traffic**, optimized for **Landing Page Views** rather than raw link clicks. Landing Page Views retain the front-end learning goal while filtering out clicks that never load the content. A later conversion campaign can optimize for the standard Meta **Lead** event only after the quiz produces a stable volume of completed email registrations.

| Configuration | Draft value |
|---|---|
| Campaign name | `DRAFT — UM — Tantra Content Education — Traffic — US` |
| Objective | Traffic / Website / Landing Page Views |
| Geography | United States only |
| Audience | Broad adults 35–65+, no health-condition, sexual-behavior, relationship-status, or sensitive-interest targeting |
| Budget proposal | $14/day at campaign level, approximately $2/day of initial learning room for each content angle; do not publish until owner approves the exact budget |
| CTA | Learn More |
| Optimization ladder | Landing Page View → Lead (quiz email registration) → Purchase when volume permits |
| Destination measurement | Standard PageView on content pages; standard CompleteRegistration at quiz completion; standard Lead at email registration; standard InitiateCheckout and Purchase downstream |
| Retargeting guardrail | Use a neutral `UM Content Engagement — 30D` audience name and generic educational creative. Do not create targeting rules, copy, or labels that infer a person’s sexual behavior, health status, relationship status, or symptoms. |

## Draft assets

| Content page | Destination | Draft image | UTM content prefix |
|---|---|---|---|
| Considering Divorce? | `https://content.theurbanmonk.com/tantra/considering-divorce` | `/manus-storage/tantra_ad_divorce_5211e08c.jpg` | `divorce` |
| The King and the Queen | `https://content.theurbanmonk.com/tantra/king-and-queen` | `/manus-storage/tantra_ad_king_queen_445f055d.jpg` | `kingqueen` |
| Sex Is the Flower | `https://content.theurbanmonk.com/tantra/sex-is-the-flower` | `/manus-storage/tantra_ad_flower_d7bbf1ec.jpg` | `flower` |
| Why He Stopped Wanting To | `https://content.theurbanmonk.com/tantra/why-stopped` | `/manus-storage/tantra_ad_him_6abb183d.jpg` | `whyhe` |
| The Love Bank | `https://content.theurbanmonk.com/tantra/love-bank` | `/manus-storage/tantra_ad_love_bank_a0e1cb99.jpg` | `lovebank` |
| Why She Stopped Wanting To | `https://content.theurbanmonk.com/tantra/why-she-stopped` | `/manus-storage/tantra_ad_why_she_stopped_a395587f.jpg` | `whyshe` |
| The Female Orgasm | `https://content.theurbanmonk.com/tantra/female-orgasm` | `/manus-storage/tantra_ad_female_orgasm_44d8b251.jpg` | `femaleorgasm` |

Every destination should append these shared UTMs, changing only the `utm_content` suffix: `utm_source=meta&utm_medium=paid_social&utm_campaign=tantra_content_education&utm_content={prefix}_{a|b|c}`.

## Ads Manager progress

The user-authorized draft-only campaign shell and its first destination are saved in Meta Ads Manager. No campaign, ad set, or ad has been published.

| Level | Saved value |
|---|---|
| Campaign | `DRAFT — UM — Tantra Content Education — Traffic — US` |
| Ad set | `DRAFT — Content — Considering Divorce — US — LPV` |
| First draft ad | `DRAFT — Divorce — A — Big Decision` |
| Destination URL | `https://content.theurbanmonk.com/tantra/considering-divorce?utm_source=meta&utm_medium=paid_social&utm_campaign=um_tantra_content&utm_content=divorce_a_big_decision` |
| Display link | `theurbanmonk.com` |
| Ad status | Draft only; no publication action taken |

The first draft uses the standard Website destination and contains no sensitive condition, relationship-status, or sexual-behavior targeting parameter. Image attachment, ad copy, and the remaining variants are intentionally pending review.

The Meta **Media** dialog is currently open for this first draft. It exposes the account, Instagram, and Urban Monk image libraries plus a native Upload control. No media has been selected and no publish action has been taken.

After returning to the saved editor, the draft still shows the intended Urban Monk Facebook identity, Manual upload, Single image or video, Website destination, and Draft status. The creative configuration is available under the ad form but continues to require the native media selector; no text, media, or publish step has been finalized.

The authenticated editor also confirms that the destination and tracking sections are available, including website events and URL-parameter builder controls. The current draft remains under the intended campaign and ad set and has no active publication state.

## Creative-asset safety check

The first generated image batch resolved to an SVG failure placeholder rather than a usable image. Those failed assets are explicitly **not approved for upload**. The draft will use only verified valid media; creative attachment remains pending replacement image generation or approved existing account media.

## Verified static-card fallback

A verified 1080×1350 branded static card has been generated locally for the first draft at `/home/ubuntu/webdev-static-assets/tantra_card_divorce.jpg`. It uses a neutral Urban Monk relationship-education treatment, avoids medical, sexual, relationship-status, and product claims, and is suitable for a draft-only media upload. The ad remains Draft and no publication action has been taken.

## Copy matrix

The following copy is intentionally educational, avoids statements about a viewer’s presumed condition or relationship, avoids product claims, and avoids explicit imagery or language.

### 1. Considering Divorce?

| Draft | Primary text | Headline |
|---|---|---|
| A | Before any permanent decision, it can help to understand what stress, fatigue, disconnection, and unfinished conversations can do to a relationship. Dr. Pedram Shojai shares a calmer framework for finding a way back to each other. | A Thoughtful Conversation Before a Big Decision |
| B | Relationships rarely lose warmth all at once. This short educational video explores how connection can be rebuilt through attention, health, and honest conversation. | When Connection Feels Far Away |
| C | A difficult season does not have to be the final chapter. Explore a practical, relationship-centered perspective on rebuilding closeness. | A Different Starting Point for Reconnection |

### 2. The King and the Queen

| Draft | Primary text | Headline |
|---|---|---|
| A | The tone of a household is shaped in the quiet moments between two people. Dr. Pedram Shojai explores a Taoist lens on partnership, presence, and the shared energy of home. | The Shared Energy of a Home |
| B | When life gets loud, relationships need a place to return to. This short video offers a grounded practice for restoring attention and partnership. | A Practice for Returning to Each Other |
| C | Two people can build more than a schedule together. They can build a home that feels steadier, warmer, and more alive. | The King and the Queen |

### 3. Sex Is the Flower

| Draft | Primary text | Headline |
|---|---|
| A | Intimacy is often the flower of a healthier system: sleep, communication, energy, safety, and attention all matter. Explore a more complete way of thinking about closeness. | Intimacy Is a Whole-System Practice |
| B | A relationship is not improved by one grand gesture. It changes when the foundations of wellbeing and connection receive consistent care. | What Helps Connection Grow |
| C | Dr. Pedram Shojai shares why lasting closeness is built from the roots up, with both people moving toward the middle. | The Roots of Lasting Closeness |

### 4. Why He Stopped Wanting To

| Draft | Primary text | Headline |
|---|---|
| A | Desire and connection are more complex than a quick fix. This short educational video explores energy, stress, communication, and the deeper systems that support closeness. | A Broader Conversation About Desire |
| B | The body, the mind, and the relationship are not separate systems. Explore a practical Taoist perspective on vitality and connection. | The Connection Between Energy and Closeness |
| C | A more useful conversation begins with curiosity, not judgment. Watch Dr. Pedram Shojai’s perspective on rebuilding confidence and connection. | Start With Curiosity |

### 5. The Love Bank

| Draft | Primary text | Headline |
|---|---|
| A | Small deposits of warmth, attention, and appreciation can change how a couple moves through a difficult week. Dr. Pedram Shojai calls this the Love Bank. | Build the Love Bank |
| B | The relationships that weather pressure are not perfect. They have a reserve of goodwill to draw on. Explore how that reserve is built. | A Longer Fuse for Life’s Rough Patches |
| C | Connection is not only something to look for when it is missing. It is a practice that makes everyday life more resilient. | The Practice of Everyday Connection |

### 6. Why She Stopped Wanting To

| Draft | Primary text | Headline |
|---|---|
| A | Desire can be affected by sleep, stress, hormonal transitions, caregiving, comfort, and the quality of connection. This short video offers a more compassionate framework for the conversation. | A More Compassionate Conversation |
| B | When life asks too much of the body and relationship, closeness can become difficult. Explore a slower, more attentive way back. | Make Room for Connection Again |
| C | Better intimacy often begins with better listening. Dr. Pedram Shojai shares a relationship-centered perspective on returning to each other. | The Practice of Listening |

### 7. The Female Orgasm: The Missing Ingredient in Western Sexuality

| Draft | Primary text | Headline |
|---|---|
| A | Intimacy changes when it becomes a shared practice of attention, communication, and mutual care. Explore a Taoist perspective on presence and connection. | The Missing Ingredient Is Attention |
| B | Many couples were never given a useful language for comfort, pleasure, pace, and connection. This short educational video offers a better place to begin. | A Better Language for Closeness |
| C | Western culture often treats intimacy as a performance. Tantra begins somewhere else: with awareness, patience, and a willingness to learn together. | A Different Starting Point for Intimacy |

## Pre-publication checks

The owner should review each destination, install the final Wistia player before activating its three ad variants, and confirm the final image has rendered in the ad preview. The campaign must remain **Draft** until the owner approves image, copy, destination URL, placements, and budget.

## References

[1] [Meta Advertising Standards — Health and Wellness](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/)

[2] [Meta Advertising Standards — Personal Attributes](https://transparency.meta.com/policies/ad-standards/personal-attributes/)

[3] [Meta Business Help Center — Prohibited Information](https://www.facebook.com/business/help/361948878201809)
