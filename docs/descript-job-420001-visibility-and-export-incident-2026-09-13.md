# Descript Job 420001 — VA Visibility and Export Incident

**Date:** September 13, 2026  
**Scope:** Newest blog-to-YouTube submission only; no duplicate project or resubmission

## Identified job

The newest Content Hub video job is **420001**, linked to **“3 Days in Nature for Anxiety Relief.”** It was created as a `descript_only` job at 23:36 UTC. Descript accepted the request and created project `49c24e12-d16f-4028-a746-17957fea8ff5`.

## Verified provider timeline

| Stage | Provider outcome |
| --- | --- |
| Narration/project creation | Stopped successfully at 23:38 UTC; project changed and a target composition was created |
| B-roll editing agent | Started by the 23:45 pipeline poll and stopped successfully at 23:51 UTC |
| Export | Started at 23:53 UTC but stopped with provider status `error`: **“Composition is empty.”** |

The script was therefore genuinely sent to Descript and processed. It was not visible in the VA dashboard’s default view because that page opened on **Syndication**, and its Video Review tab defaulted to **Needs Review**, which excludes active `importing`, `editing`, and `rendering` jobs.

## Root causes

1. The pipeline received the correct target composition ID inside Descript’s agent response, but later edit/export requests omitted `composition_id`. Descript attempted to export a different/default empty composition.
2. The export guard recognized `failed` but not the provider’s actual `error` result, so an empty export could have been incorrectly advanced.
3. The Descript-only B-roll prompt assumed a talking-head presenter track and requested a persistent circular presenter overlay even though the project contained AI narration only. The editing agent consequently declined the presenter instruction instead of applying the intended audio-only visual treatment.
4. The VA dashboard had no dedicated in-progress filter or processing count, and the post-submission action opened the dashboard’s unrelated default tab.

## Implemented repair

- Parse and reuse the exact Descript composition ID from structured provider results or the agent response target tag.
- Send `composition_id` to the editing and export requests.
- Treat provider result `error` as a failure and require a successful export plus a usable download URL before marking a job ready for review.
- Use an audio-only Underlord prompt for `descript_only` jobs; it explicitly preserves narration and forbids presenter/avatar/PIP instructions.
- Add **Video Review → In Progress** to the VA dashboard, a visible processing count, and direct links from new submissions to `/va?tab=video&filter=processing`.
- Add focused regression coverage for composition parsing, provider error handling, audio-only prompting, active-job filtering, and direct dashboard links.

## Recovery boundary

Both video-pipeline heartbeat jobs were temporarily paused before the repair so the current job could not be falsely marked ready or exported repeatedly. After the repaired build is deployed, job 420001 can be resumed from its already completed editing stage by clearing only the failed publish-job reference and returning its database status to `editing`. The existing Descript project and completed edit job must be reused; no duplicate project or script resubmission is needed.
