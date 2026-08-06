# Gate 3 — Deploy mechanism: HALT. I do not own it.

**Established 2026-08-06 18:1x UTC, before any merge.**

## The question

Does merging to `main` auto-deploy the Urban Monk Content Hub? Is there a separate
trigger? Do I own it?

## Answer: no, and I cannot reach it from this sandbox.

### What I checked

| Check | Result |
|---|---|
| `.github/workflows/` in the repo | **does not exist** — no CI/CD |
| `vercel.json`, `netlify.toml`, `Procfile`, `Dockerfile`, `fly.toml`, `render.yaml` | **none present** |
| `package.json` scripts | `dev`, `build`, `start`, `check`, `format`, `test`, `db:push` — **no deploy script** |
| Git remotes on `chfresh-plan` | **GitHub only** (`PedramShojaiSpace/contenthub`). No platform deploy remote. |
| Webdev project registered at `/home/ubuntu/chfresh-plan` | **no** — see below |
| Webdev project active in this session | `contenthub-troubleshooting` (`web-static`) at `/home/ubuntu/contenthub-troubleshooting` — **a different project** |
| Dev server on :3000 | pid 1408, cwd `/home/ubuntu/contenthub-troubleshooting` — **the troubleshooting site, not chfresh** |

### The decisive detail

`/home/ubuntu/chfresh-plan/.project-config.json` does contain a webdev git remote:

```
backend : GIT_BACKEND_S3
repo_url: s3://vida-prod-gitrepo/webdev-git/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ
expired : 2026-08-01T10:53:57.000Z
```

The app id `iUgsiz76NwfDUVHZHV7CyJ` matches both `VITE_APP_ID` and the production
database name, so this **is** the Content Hub's webdev project. Two problems:

1. **The credential expired on 2026-08-01.** Today is 2026-08-06.
2. The same file reports `name: lights-on-optin`, `path: /home/ubuntu/lights-on-optin`
   — a directory that does not exist. The config was inherited from another project
   through a sandbox reset, not generated for this working copy.

There is no `webdev_*` tool binding to `/home/ubuntu/chfresh-plan` in this session. The
session's active webdev project is `contenthub-troubleshooting`, a separate static site.
**Publishing from this session would publish the wrong project.**

## What this means for the runbook

Part 5 step 10 reads "Merge the PR and deploy the application." The merge I can do — it is
a GitHub operation and `gh` is authenticated. The deploy I cannot: the Content Hub is
deployed through the Manus platform's webdev publish mechanism, which is bound to a
project session that this sandbox does not hold, with a credential that expired five days
ago.

Steps 8 and 9 (`LLM_MODEL=gpt-5.5`, `NODE_ENV=production`) are the same story. Production
env for a webdev app is set in the Management UI under Settings → Secrets, or injected at
publish time. The `secrets` block in the stale config shows **neither `LLM_MODEL`,
`NODE_ENV`, nor `ALLOW_DEV_LOGIN`** — but that block is a snapshot from before the
expiry, so it is evidence about the past, not the current production environment. I cannot
read the live env from here, and I will not report a stale snapshot as the current state.

## Halted

Per the reviewer's standing instruction — *"If anything in the deploy step is outside your
control, halt and tell me rather than improvising — a half-merged state is worse than a
paused one"* — I have not merged. The database is migrated and ahead of `main`; that is
the safe direction (additive columns the old code ignores) and it can sit there
indefinitely without harm.
