# Tantra Video-Page Meta Copy Package — Build Standard

## Purpose and Guardrail

This package contains **review-ready copy only** for seven planned content-first video landing pages. It does not create, duplicate, publish, edit, or reactivate any Meta campaign, ad set, ad, creative, audience, budget, pixel, or checkout setting.

Each package sends an educational Meta ad to its matched Urban Monk video page, where the visitor may voluntarily continue to the Tantra quiz. The copy must not presume a viewer’s relationship status, sexual behavior, health status, symptoms, age-related condition, or personal circumstance.

## Standard Naming Convention

Use the following exact structure. It includes the **date**, **audience/targeting**, **optimization**, and **destination slug** in every campaign name.

| Meta object | Exact naming format |
| --- | --- |
| Campaign | `UM | Tantra | Content | <slug> | US35-65+ Broad | Traffic-LPV | 2026-08-16` |
| Ad set | `UM | Tantra | AS | <slug> | US | 35-65+ | Broad | LPV | 2026-08-16` |
| Ad | `UM | Tantra | Ad | <slug> | H<1-5> | V<1-7> | 2026-08-16` |

The final campaign name is intentionally designed so an exported Meta report can be sorted by destination slug without relying on an informal creative label.

## Common Ad-Set Specification

| Setting | Required value |
| --- | --- |
| Objective | Traffic |
| Conversion location | Website |
| Performance goal | Landing Page Views |
| Geography | United States only |
| Age | 35–65+ |
| Audience | Broad; do not use relationship status, sexual-behavior, health-condition, hormonal-status, or other sensitive-personal-attribute targeting or exclusions |
| Placements | Advantage+ placements initially; review breakdown before any optimization decision |
| CTA | Learn More |
| Budget | Draft-only: leave uncommitted until the owner approves a per-ad spend plan; no spend is authorized by this document |
| Destination | Exact page URL plus the package-specific UTM string |

## Measurement Standard

The working targets are **2%+ outbound CTR** and **35%+ landing-page-to-quiz opt-in rate**. They are measurement goals, not outcome guarantees. Use the following event ladder:

`PageView on video page → CompleteRegistration / Lead on voluntary quiz completion and email capture → InitiateCheckout → Purchase`

Each package must use:

```text
utm_source=meta&utm_medium=paid_social&utm_campaign=tantra_content_education&utm_content=<slug>_h<1-5>_v<1-7>
```

Do not optimize the content-first packages to purchases before there is enough downstream data. The initial optimization is **Landing Page Views**; downstream quiz registrations and purchases are diagnostic metrics and future optimization candidates.

## Creative Standard

Each package includes seven **AI image prompts** for a 4:5 Meta feed image. Use a human, warm editorial visual language with natural expressions, real household environments, and a clear text-safe area. Do not generate an AI likeness of Dr. Pedram; use an anonymous adult or symbolic, non-explicit environment. Do not render medical claims, sexual content, nudity, explicit anatomy, breakup threats, or sensationalized distress. Every prompt should specify **“no text in image”** because the ad copy and Meta headline carry the message.

## Copy Standard

Each landing-page document includes five headline/post pairs. The five posts are written in Dr. Pedram’s first-person voice and designed for paste-in use. Each post must fall between **1,800 and 2,200 characters including spaces**, with a radically different narrative entry point while preserving the same matched landing-page story.

## References

[1] [Tantra content-page routing and video map](../curt-tantra-content-page-ad-routing-map-2026-08-14.md)

[2] [Corrected actual Meta inventory audit](../tantra-meta-actual-inventory-audit-2026-08-16.md)
