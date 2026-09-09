# vidIQ Keyword Metrics — Zero-Value Incident Record

**Date:** September 8, 2026  
**Affected workflow:** Content Hub → Video to Blog → SEO Focus Keyword → vidIQ detail panel  
**Reported symptom:** The panel rendered zero for volume, competition, opportunity, and estimated monthly searches while topic recommendations were present.

## Root cause

The live vidIQ keyword-research response completed successfully but supplied its structured payload inside a human-readable response under the marker `Keyword data (JSON):` rather than in the optional `structuredContent` field. The generic adapter correctly kept the prose as `_text`; the keyword-specific normalizer then interpreted that object as having no metric fields and silently supplied zeros.

This meant the screen displayed an all-zero result even though the provider had returned direct keyword data. For the reported phrase, the live response contained a direct competition score of **13.3** and opportunity score of **34.68**; the direct volume and estimated-monthly-search fields were both genuinely zero. The prior UI obscured that distinction by replacing every field with zero.

## Corrective behavior

The keyword adapter now extracts and parses the JSON object following the provider’s `Keyword data (JSON):` marker. It validates the seed keyword metrics before returning them. If the provider supplies only prose, malformed data, or an incomplete metric object, the request fails normally rather than manufacturing a zero-valued research result.

The Video-to-Blog panel now displays a clear unavailable/retry state when the request fails and explicitly tells the operator that no zero scores were recorded. When vidIQ reports a true direct zero for volume, the panel retains the true number and explains that competition/opportunity are direct-phrase scores while related terms can provide adjacent-topic ideas.

The sibling Video Production Session keyword panel uses the same server adapter and had the same missing unavailable-data presentation. It now follows the same behavior: loading, an explicit unavailable/retry state, and an explanation when a direct phrase legitimately has no volume score. This protects both first-party places where the shared vidIQ response is surfaced.

## Verification

| Check | Result |
|---|---|
| Focused adapter tests | Passed: 20/20, including markdown-wrapped payload parsing and unavailable-data regression coverage. |
| Live adapter check for the reported phrase | Passed: direct values returned `volume: 0`, `competition: 13.3`, `overall: 34.68`, `estimatedMonthlySearch: 0`, with 10 related keywords; the returned object was not all-zero. |
| Production build after both panels were updated | Passed with the bounded-memory build configuration. |
| Browser page check | The custom-domain Video-to-Blog route remained on an application loading spinner during two read-only checks, so it could not be used to reproduce the panel or capture a post-fix visual state in this session. This is recorded as a browser verification limitation, not as evidence the correction failed. |

No focus keyword, blog content, DataForSEO result, WordPress/Substack publishing behavior, or external credential changed during this repair.
