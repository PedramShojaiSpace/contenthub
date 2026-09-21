# Licensed Nutritionist Terminology Update

**Date:** 21 September 2026  
**Status:** Completed and verified

The requested terminology replacement is complete for the Urban Monk WordPress content found by the public WordPress search endpoint and for the current 5 Root Causes Masterclass source and delivery files.

## Public WordPress content

The search audit initially found three published posts containing the exact phrase **“registered dietitian.”** All occurrences were replaced with **“licensed nutritionist.”** A second pass also removed the remaining `RD` and plain `dietitian` credential variants from the archived Kristin Kirkpatrick episode page, as requested. This edit is a terminology substitution requested by the owner; it does not purport to validate or restate a guest’s professional credentials.

| Published post | WordPress ID | Result |
|---|---:|---|
| How to Practice Mindful Eating in a Busy Life | 11117 | One exact-phrase reference changed. |
| Your Best Shot: The Truth About GLP-1s and Natural Weight Health Hormones | 9423 | Two exact-phrase references changed. |
| Navigating the Maze of Nutritional Choices with Kristin Kirkpatrick | 7430 | Two exact-phrase references plus five remaining `RD` / `dietitian` variants changed. |

Authenticated WordPress read-back verified **zero** remaining exact “registered dietitian” references on all three posts. A public cache-busted fetch also returned zero exact phrase matches and the updated phrase on each live URL. The separate WordPress page search returned no matching pages.

## Masterclass production files

The exact phrase appeared in three Module 1 source files and was changed to **“licensed nutritionist.”** The following Markdown and PDF deliverables were refreshed and validated:

- `scripts/01-gut-barrier.md` and its corresponding PDF;
- `handouts/01-gut-barrier.md` and its corresponding PDF;
- `research/01-gut-barrier.md` and its corresponding PDF.

The production ZIP and team PDF ZIP were rebuilt. Archive-integrity tests passed, and source/PDF text scans returned no remaining exact phrase.

## Deliberately unchanged internal material

The Apollo lead-sourcing taxonomy retains plain `dietitian` as a job-title search term. That is internal audience-targeting vocabulary, not reader-facing credential language, and changing it would reduce the intended audience match quality.

## References

[1]: https://theurbanmonk.com/wp-json/wp/v2/search?search=dietitian&per_page=100&subtype=post "The Urban Monk WordPress post search"

[2]: https://theurbanmonk.com/wp-json/wp/v2/search?search=dietitian&per_page=100&subtype=page "The Urban Monk WordPress page search"
