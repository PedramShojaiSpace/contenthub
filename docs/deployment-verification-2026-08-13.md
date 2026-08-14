# Deployment Verification — 2026-08-13

## Local validation

Checkpoint `77ea1630` completed a full split production build successfully. A local production server built from that checkpoint returned HTTP 200 for both the public route `/tantra/love-bank` and the internal route `/hub/content/email-optimizer`.

## Public-domain result

Two separate browser checks of `https://content.theurbanmonk.com/tantra/love-bank`, including a cache-busting `?deploy=77ea1630` query, returned the prior application's Not Found page. The public domain has therefore not yet advanced to the split-bundle checkpoint despite the local build and static-server validation passing.

After a fresh publication checkpoint (`eaa575c1`) with a logged staged build runner, `content.theurbanmonk.com/tantra/love-bank?deploy=eaa575c1` still returned the same prior application Not Found page. `ch.theurbanmonk.com/tantra/love-bank?deploy=eaa575c1` returned the same result. Both custom domains are attached to the current project in the Domains panel, so the unresolved issue is platform deployment/publishing rather than one domain pointing at a different project.

The project version-history UI showed checkpoint `eaa575c1` as **Publishing…**. After an additional 60-second wait, `content.theurbanmonk.com/tantra/love-bank?deploy=eaa575c1` still returned the prior application's Not Found page. The public route will be rechecked only after the publish status changes from in-progress to completed or failed.

After a further 120-second wait, a cache-busting browser request to `content.theurbanmonk.com/tantra/love-bank?deploy=eaa575c1&check=2` still returned the same prior application's Not Found page. The issue remains an active/stalled platform publication; no paid traffic should be sent to the new URLs.

## Safety note

Do not send paid traffic to the new Tantra content-page URLs until a fresh public-domain verification returns the actual landing page. The production build configuration is valid locally; the remaining issue is deployment propagation or the platform deployment step, not route code.

## 14 August reporting-route result

Following the platform’s deployment-success notice, the public reconciliation URL redirected to the split internal route at `/hub/analytics/reconciliation`. The shell loaded but the Analytics Hub content did not render in the browser session, so the newly published dashboard labels could not yet be visually confirmed on the custom domain. The authenticated local reconciliation endpoint remains the verified source for the corrected $1,269.00 / 1.93x result described in `interconnected-reporting-methodology-2026-08-14.md`.
