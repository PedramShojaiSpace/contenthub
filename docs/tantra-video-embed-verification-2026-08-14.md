# Tantra Video Embed Verification

## Representative page check

The local preview route `/tantra/considering-divorce` was checked after the finalized media mapping was applied.

| Check | Result |
|---|---|
| Finalized Wistia ID | `sq3dol4frw` is present in the page source and served iframe URL. |
| Player availability | Wistia player controls rendered after load; the video duration displayed as 9:03. |
| Layout | The 16:9 video frame remained above the written narrative. |
| Conversion path | The soft “Take the 2-Minute Quiz” CTA remained below the educational narrative. |

The seven media IDs are covered by the focused route regression test in `server/tantraContentLandingPages.test.ts`.
