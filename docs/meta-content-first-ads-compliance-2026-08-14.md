# Meta Content-First Ads Compliance — 14 August 2026

## Advertising policy guardrails

Meta permits sexual-health awareness and educational material when it is informational, non-suggestive, and focused on health rather than sexual pleasure or enhancement. Ads promoting sexual/reproductive health or wellness must target adults aged 18 or older. Meta does not permit ads for adult sexual arousal products or services, including instructional sexual services, tantric services, or orgasmic therapy. [1]

Ads must not assert or imply that a viewer has a sensitive personal attribute or medical condition. Copy should describe the educational material or a general experience, not speak as though the advertiser knows a viewer’s health, menopause status, relationship state, sexual practices, or family circumstances. [2]

Meta Business Tools must not receive prohibited health or sexual/reproductive information in URL parameters, custom event names, custom-conversion criteria, audience names, custom parameters, or custom data. Meta specifically identifies sexual and reproductive health among prohibited information and requires advertisers to ensure event and audience names do not reflect or imply it. [3]

## Approved campaign posture

| Area | Required implementation |
|---|---|
| Cold ads | Educational framing only: relationship resilience, communication, connection, life transitions, or a doctor-led educational video. Avoid explicit sexual-pleasure, product, protocol, medical-outcome, or personal-condition language. |
| Targeting | United States only, ages 18+, broad or contextual interests without audience labels that identify health/sexual status. |
| Landing pages | Use neutral page-view measurement only. No sensitive URL parameters, page titles, or event parameters sent to Meta. |
| Quiz | Retain the standard `CompleteRegistration` event only if Meta diagnostics show it is accepted; do not pass Tantra, menopause, desire, orgasm, relationship condition, result, answer, product, or health attributes as custom data. |
| Retargeting | Do not create a custom audience named after sexual health, a diagnosis, menopause, desire, orgasm, or quiz answers. Use a neutral website-engagement audience only if Meta permits the audited website event data; otherwise use platform-native video engagement as the primary retargeting source. |
| Optimization | Begin with Landing Page Views or link clicks for cold educational traffic. Move any eligible campaign to standard `CompleteRegistration` only after sufficient accepted event volume and Events Manager diagnostics confirm the event is not restricted. |

## Compliance-sensitive scripts

The new “Female Orgasm” and “Why She Stopped Wanting To” content pages may be used as **educational destinations**, but cold-ad headlines and primary text should remain relationship/connection oriented. The phrase “tantric services” must not appear in ads. Sexualized imagery, adult-product imagery, before/after framing, and outcome guarantees are prohibited for this test.

## Sources

[1] [Meta Transparency Center — Health and Wellness](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/)

[2] [Meta Transparency Center — Privacy Violations and Personal Attributes](https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/)

[3] [Meta Business Help Center — About Prohibited Information](https://www.facebook.com/business/help/361948878201809)
