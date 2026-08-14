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
