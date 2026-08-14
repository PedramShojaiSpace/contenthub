# Platform Deployment Escalation — 2026-08-13

## Summary

The current application build is reproducibly successful in the project environment. The remote deployment fails before its builder emits any project build output, immediately after reporting that a Metal builder has been scheduled.

## Verified local result

The production command `pnpm build` completed successfully using `scripts/build.mjs`. The runner completed each stage in sequence:

| Stage | Result |
|---|---|
| Public funnel bundle | Completed; finalized `dist/public/index.html` |
| Hub core bundle | Completed; finalized `dist/public/hub/core/index.html` |
| Hub content bundle | Completed; finalized `dist/public/hub/content/index.html` |
| Hub growth bundle | Completed; finalized `dist/public/hub/growth/index.html` |
| Hub analytics bundle | Completed; finalized `dist/public/hub/analytics/index.html` |
| Server bundle | Completed; emitted `dist/index.js` |

A locally started production server returned HTTP 200 for `/tantra/love-bank` and `/hub/content/email-optimizer`. Focused route regression coverage also passed.

## Remote result

The most recent remote deployment error contains only:

> `[info] 2026-08-13T21:43:40.696610849Z scheduling build on Metal builder "builder-oykvtw"`

There is no `pnpm build` line, no output from the staged runner, no Vite output, and no application error. The builder therefore stops before it runs the project build command or before it can stream any command output.

## Conclusion

This is **not presently attributable to an application source-code build error**. The project has a validated, stage-logged production build. The failure boundary is the remote platform build/publication layer.

## Support handoff

Submit this report with the screenshot showing the version stuck in Publishing and the checkpoint ID `eaa575c1` to [Manus Help](https://help.manus.im). Request inspection of the Metal-builder job and the project publication queue. Do not disconnect `content.theurbanmonk.com` or `ch.theurbanmonk.com`; both are correctly attached to the current project.
