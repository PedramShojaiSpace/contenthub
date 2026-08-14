# Tantra Quiz Clinical Segmentation Map — 14 August 2026

## Purpose

The Tantra quiz is now designed as a relationship-and-intimacy entry point that can also identify whether a visitor may benefit from a licensed-clinician or health-coach conversation in an **oral health, gut health, sleep health, or hormone health** pathway. It is not a diagnostic tool. The routing signals are used to organize follow-up and should never be represented as a diagnosis, a confirmed condition, or a substitute for clinical assessment.

## Routing contract

| Derived pathway | Triggered when the quiz records | Primary next step in results | Current commercial / clinical vehicle | Required tags and profile fields | Status |
|---|---|---|---|---|---|
| **Intimacy** | Every completed quiz | Optional Tantra intake and relationship-reconnection education | Tantra Him, Tantra Her, or couple pathway | Kajabi: `tantra-path-intimacy`; Klaviyo: `tantra_primary_care_path`, `tantra_care_paths` | **Active** |
| **Gut health** | `q_symptoms` includes `gut_issues` | Persistent digestive symptoms warrant clinical evaluation; optional Fit22 discussion | Fit22 food-sensitivity and gut-permeability test resource | Kajabi: `tantra-path-gut-health`, `tantra-clinician-follow-up`; Klaviyo: `tantra_gut_flag=true` | **Active resource; follow-up workflow still needs operational ownership** |
| **Sleep health** | `q_symptoms` includes `poor_sleep` | Persistent sleep disruption warrants clinical evaluation; optional sleep resource | Sleep test-kit resource | Kajabi: `tantra-path-sleep-health`, `tantra-clinician-follow-up`; Klaviyo: `tantra_sleep_flag=true` | **Active resource; follow-up workflow still needs operational ownership** |
| **Oral health** | `q_symptoms` includes `oral_issues` | Persistent mouth or gum symptoms should be discussed with an appropriate clinician | Oral-health test resource / Orobiome pathway | Kajabi: `tantra-path-oral-health`, `tantra-clinician-follow-up`; Klaviyo: `tantra_oral_flag=true` | **Active resource; follow-up workflow still needs operational ownership** |
| **Hormone health** | A response other than `none` to either hormone-context question | Clinician-guided discussion; a broader panel only if the clinician decides it is appropriate; Fit22 remains an optional non-hormone baseline conversation | **No dedicated hormone referral or scheduling vehicle configured in this project** | Kajabi: `tantra-path-hormone-health`, `tantra-clinician-follow-up`; Klaviyo: `tantra_hormone_flag=true` | **Gap — build a defined clinician/health-coach handoff** |
| **Multifactor review** | More than one clinical pathway is flagged | Prioritize clinician or health-coach review rather than serial product offers | **No dedicated multifactor concierge/review vehicle configured** | Kajabi: `tantra-path-multifactor`, `tantra-clinician-follow-up`; Klaviyo: `tantra_primary_care_path=multifactor` | **Gap — build a review-and-assignment process** |

## CRM segmentation fields

The quiz now writes the existing result and symptom flags plus the following structured values to the lead record and customer profile. The Meta browser and server events remain deliberately neutral: they do **not** receive answers, flags, referral paths, or product recommendations.

| System | Fields / tags | Intended use |
|---|---|---|
| **Content Hub lead record** | `hormone_flag`, `referral_path`, the existing gut/sleep/oral flags, and the raw submitted answer record | Durable internal intake history and accurate funnel reporting |
| **Kajabi** | Existing product and symptom tags, plus `tantra-path-intimacy`, path-specific tags, `tantra-path-multifactor` when applicable, and `tantra-clinician-follow-up` | Entry conditions for clinical-path-specific sequences and staff work queues |
| **Klaviyo** | `tantra_gut_flag`, `tantra_sleep_flag`, `tantra_oral_flag`, `tantra_hormone_flag`, `tantra_primary_care_path`, `tantra_care_paths`, and `tantra_clinician_followup_needed` | Segments, controlled content branches, and a review queue for the appropriate clinical/health-coach follow-up |
| **Meta** | Standard neutral conversion events only | Measurement and optimization without passing health or quiz information |

## Recommended operational next step

The platform now distinguishes the five pathways and preserves the appropriate segmentation. The operational requirement is to name an owner and a first human or automated action for each of the four clinical flags. The highest-priority build is the **hormone-health referral vehicle**, followed by the **multifactor review workflow**. Until a dedicated scheduling or clinician-review step is defined, these paths should be routed to an internal review queue, not an unsupported automated clinical promise.

## Copy and safety boundary

All user-visible guidance must keep the following framing: **“Your answers suggest that these factors may be worth discussing with a licensed clinician. This quiz cannot diagnose a condition.”** Fit22 can appear only as an optional discussion resource; it is not represented as a hormone assay or as diagnostic testing for any condition.
