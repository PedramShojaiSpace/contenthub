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

Both video-pipeline heartbeat jobs were temporarily paused before the repair so the current job could not be falsely marked ready or exported repeatedly. Job 420001 was then recovered from its already completed editing stage by reusing its existing Descript project and targeting the verified non-empty composition. No duplicate project or script resubmission was created.

## Final recovery and verification

- The composition-aware replacement export completed with provider state `stopped` and result status `success`.
- The existing Content Hub row now has status `ready_for_review`, a Descript share URL, a rendered download URL, and no error message.
- The VA dashboard reports two videos awaiting review after the job returned to the review queue. New active jobs also have a dedicated **In Progress** filter and processing count.
- A direct dashboard capture confirms job `420001` is visible in **VA Dashboard → Video Review → Needs Review** with the title “3 Days in Nature for Anxiety Relief: The Ultimate Nervous Reset,” a **Ready for Review** status, and a Descript Only label. The review/download links were also verified from the retained job record without exposing them in this report.
- The 15-minute video-pipeline poll and the two-hour recovery poll were both resumed after the successful export.
- The detached upload worker and both VA recovery actions now resolve a retained non-empty composition from the completed Descript agent/import jobs before starting a fresh export. They reject a missing target instead of silently exporting the empty project default.
- Focused regression coverage and the bounded-memory production build passed before deployment.

The job is no longer running in Descript. Its edit and render are complete, and it is waiting for human review in the VA dashboard.
