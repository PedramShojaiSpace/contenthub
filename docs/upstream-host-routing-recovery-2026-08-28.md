# Upstream Hostname Recovery — 2026-08-28

## Finding

The intended Upstream page is present and healthy at the restored project route:

`https://lightsebook-iugsiz76.manus.space/upstream`

The main customer hostname, `https://upstream.theurbanmonk.com/`, is separately configured at DNS but is not attached to an active project. Its CNAME is already correct (`cname.manus.space`) and its certificate is valid; however, the public request returns the Manus maintenance response with an original 404. This proves the fault is a missing hostname-to-project attachment, not a GoDaddy record, TLS failure, or missing Upstream page.

## Correct Root-URL Design

DNS can direct a hostname to a project, but it cannot direct that hostname to `/upstream`. Attaching the host to the shared Content Hub project would normally make the project root (`/`) render the Content Hub root page.

To preserve the customer-facing URL `https://upstream.theurbanmonk.com/`, the restored client now uses a hostname-specific rule:

| Request hostname and path | Rendered page |
|---|---|
| `upstream.theurbanmonk.com/` | Existing public **UpstreamHome** page—the same page currently available at `/upstream` on the managed project domain. |
| `content.theurbanmonk.com/` | Existing Content Hub root, unchanged. |
| `upstream.theurbanmonk.com/upstream` | Existing explicit `/upstream` route, unchanged. |

This is not a redirect. The browser stays on the clean root URL `https://upstream.theurbanmonk.com/`; it simply receives the intended Upstream page rather than the internal Content Hub root.

## Validation

The hostname-routing logic has focused regression coverage for the intended host root, a trailing-dot/port normalization case, the Content Hub root, and explicit routes. The focused Vitest suite passed **3/3**. The public customer-facing bundle completed successfully. After stopping the temporary development watcher to release memory, the complete staged public, Hub core, Hub content, Hub growth, Hub analytics, and server production build also completed successfully. The development service was then restarted with no TypeScript errors.

## Remaining Owner Action

After this code is published, add only `upstream.theurbanmonk.com` under this project’s **Settings → Domains** panel and wait for its green verified state. Do not edit GoDaddy—the current CNAME and certificate are already correct. The final external verification should then confirm that `https://upstream.theurbanmonk.com/` renders the Upstream page at its root.

No offer, checkout, form, tracking configuration, redirect, traffic destination, Content Hub root, or unrelated hostname was changed.
