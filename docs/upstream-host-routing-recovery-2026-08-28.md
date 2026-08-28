# Upstream Hostname Recovery — 2026-08-28

## Finding

The intended Upstream page is present and healthy at the restored project route:

`https://lightsebook-iugsiz76.manus.space/upstream`

The main customer hostname, `https://upstream.theurbanmonk.com/`, is separately configured at DNS but is not attached to an active project. Its CNAME is already correct (`cname.manus.space`) and its certificate is valid; however, the public request returns the Manus maintenance response with an original 404. This proves the fault is a missing hostname-to-project attachment, not a GoDaddy record, TLS failure, or missing Upstream page.

## Approved Temporary Root-URL Recovery

DNS can direct a hostname to a project, but it cannot direct that hostname to `/upstream`. Attaching the host to the shared Content Hub project made the old root application load at `/`, which in turn sent unauthenticated visitors to Manus login. Because live traffic is active, the owner approved a temporary 301 redirect instead of continuing to expose that login path.

The new server-side behavior is narrowly scoped:

| Request hostname and path | Behavior |
|---|---|
| `upstream.theurbanmonk.com/` | **301** to `https://content.theurbanmonk.com/hub/growth/upstream`. Incoming campaign query parameters are preserved. |
| `content.theurbanmonk.com/` | Existing Content Hub root, unchanged. |
| Any other hostname | Unchanged. |

The redirect is intentionally limited to the exact Upstream hostname root. It does not alter any offer, checkout, form, tracking configuration, customer data, or unrelated Content Hub route.

## Validation

The server-side redirect has focused regression coverage for hostname recognition, the exact fallback target, and preservation of common campaign parameters. The redirect and existing WordPress safeguards passed **19/19** focused Vitest checks. A local host-header test confirmed `upstream.theurbanmonk.com/?utm_source=meta&utm_campaign=live_upstream&fbclid=abc123` returns **301** to the verified fallback URL while preserving all three parameters; `content.theurbanmonk.com/` remained a direct **200**. After stopping the temporary development watcher to release memory, the complete staged public, Hub core, Hub content, Hub growth, Hub analytics, and server production build also completed successfully. The development service was then restarted with no TypeScript errors.

## Remaining Owner Action

`upstream.theurbanmonk.com` is already attached with its existing GoDaddy CNAME unchanged. The only remaining step is publication and public verification of the 301 response. Do not edit GoDaddy or remove any domain attachment during that step.

No offer, checkout, form, tracking configuration, traffic destination, Content Hub root, or unrelated hostname was changed. The sole approved behavior change is the temporary 301 at `upstream.theurbanmonk.com/`.

## Urgent Traffic Fallback Verification

While the dedicated hostname release is being resolved, the owner-connected browser confirmed that the existing public Upstream page is available without authentication at:

`https://content.theurbanmonk.com/upstream`

The active Content Hub delivery layer normalizes that request to `https://content.theurbanmonk.com/hub/growth/upstream` and renders the expected customer-facing Upstream offer page. This is the verified rapid fallback page for immediate traffic protection; it is not a change to offers, checkout destinations, or the underlying Upstream page.
