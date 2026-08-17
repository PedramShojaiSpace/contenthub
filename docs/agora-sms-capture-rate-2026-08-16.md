# Agora Mobile and SMS Capture Analysis

**Measurement window:** August 1, 2026 through the time of analysis on August 16, 2026.  
**Scope:** Unique Interconnected leads with first-party Meta/Agora evidence.  
**Privacy:** All calculations were deduplicated by normalized email; no contact-level data is retained in this report.

## Cohort Definition

The cohort contains a lead if at least one first-party record has a Meta/Facebook UTM source, an Agora campaign marker, or an `fbclid`. This produces **126** unique lead identities. The narrow literal campaign-name-only condition (`utm_campaign` contains `agora`) captures just seven identities and includes test/partial UTM variants, so it is not the representative campaign denominator.

## Reconciled Result

| Measure | Unique leads | Rate |
|---|---:|---:|
| First-party Agora/Meta cohort | 126 | 100.0% |
| Matched to a Klaviyo profile | 125 | 99.2% |
| Usable phone in either first-party ledger or Klaviyo | 85 | **67.5%** |
| First-party `sms_consent` flag | 95 | 75.4% |
| Klaviyo `sms_consent` profile property | 92 | 73.0% |

The operational mobile-capture answer is therefore **85 of 126 unique Agora/Meta-attributed leads, or 67.5%**. Klaviyo contains a phone for 81 of those 85 identities. Four phones appear only in the local lead ledger, and Klaviyo adds no phone to a lead missing one locally.

> **Important:** The SMS-consent fields exceed the usable-phone count. They should not be interpreted as an immediately contactable SMS audience until the phone-less consent records are reconciled. The local lead records and Klaviyo profiles carry 95 and 92 consent flags respectively, but only 85 unique identities have a usable phone in either source.

## Coverage and Attribution Limitations

The cohort predates the current Kajabi-versus-KO/Klaviyo A/B path bucketing; qualifying historical records are therefore correctly treated as an **all-path** group rather than assigned to a CRM path. The local lead ledger has no post hoc path value on this historical cohort. Klaviyo profile matching is highly complete at 99.2%, but the data cannot establish that an SMS-consent flag without a phone number represents a legally or technically deliverable SMS subscription.

## Strict Agora-Only Reconciliation

The broader diagnostic above is not the final Agora-only measurement. The Content Hub reconciliation registry defines the authoritative **Interconnected Agora** filter as the keyword `agora` appearing in the Meta campaign or ad-set name. Applying the matching explicit `utm_campaign` criterion to the local lead ledger produces **7** unique strict Agora records from August 1 onward. Klaviyo lookup matched all seven records and confirmed the same **4** usable phone numbers and **4** SMS-consent properties; it added no phone number absent from the local record.

| Strict campaign-mapped cohort | Unique leads | Usable phone / SMS record | Rate |
|---|---:|---:|---:|
| All UTM campaigns containing `agora` | 7 | 4 | **57.1%** |
| Excluding one explicit `agora_test` UTM row | 6 | 4 | **66.7%** |

The recommended business read is **66.7%** for the non-test strict Agora UTM records, while **57.1%** is the conservative rate if the test-tagged row remains in the cohort. Both are small-sample first-party UTM measurements and must not be conflated with Meta’s larger Lead-event count.

## Exact Campaign-Mapping Limitation

Two explicitly approved, single-call Meta campaign-inventory requests were made for **August 1–16** and the supplemental historical window **August 1–9**. They returned 57 and 56 Agora-named campaigns respectively. Neither inventory could be joined exactly to the lead ledger because the Meta Insights campaign response contains campaign names and performance but no landing-page UTM value, while historical lead records store UTM labels rather than Meta campaign or ad-set IDs. No exact name-to-UTM equality match was present.

Consequently, the 57.1% and 66.7% values remain clearly labeled **keyword/UTM proxies**, not campaign-ID-verified historical Agora rates. The broader 67.5% value is a valid Meta/Agora-evidence diagnostic only. No additional Meta API call is warranted or planned. Future exact measurement requires lead capture to persist `campaign_id`, `adset_id`, or a canonical campaign-key populated directly from the ad URL at opt-in time.

## Klaviyo Phone-Sync Scope Check

The four local-only phone records observed in the broad Meta/Agora-evidence diagnostic are **not** part of the strict seven-record Agora keyword cohort. In that strict cohort, all four local phone records are present in the matched Klaviyo profiles; there is no strict-Agora phone-sync discrepancy to repair. The existing `pushInterconnectedOptIn` contract already sends a provided phone as `phone_number` during profile creation and patches the existing profile after a duplicate-profile response. It also includes the E.164 phone in the SMS subscription payload when consent and the configured SMS list are present.

The broad-cohort difference should therefore be investigated only if that broader data-quality diagnostic becomes an operating priority. It does not change the strict Agora proxy measurement or justify a backfill without a separately approved source-of-truth and consent review.
