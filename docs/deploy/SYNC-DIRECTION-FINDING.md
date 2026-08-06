# Which repository is upstream: the Manus webdev project, or GitHub?

**Answer: the Manus webdev project is upstream. GitHub is a downstream mirror.**

**Consequence: merging PR #1 into GitHub `main` does not reach the live app.**

Determined 2026-08-06 by reading the Manus project's own git backend, not by inference.

---

## The decisive evidence

The Manus project's git backend is an S3-hosted repo declared in
`.project-config.json`. A `git-remote-s3` helper is installed in the sandbox, so it
can be queried read-only with the credentials in that file:

```
$ git ls-remote s3://vida-prod-gitrepo/webdev-git/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ
216c2f28b7270ff36e9388ce640af8cd3a3306cc	HEAD
216c2f28b7270ff36e9388ce640af8cd3a3306cc	refs/heads/main
```

`216c2f2` is **exactly** the commit GitHub `main` sat at before the PR #1 merge.

| Repository | HEAD |
|---|---|
| Manus S3 git backend | `216c2f2` |
| GitHub `main`, before merge | `216c2f2` — identical |
| GitHub `main`, now | `3e894e0` — **2 commits ahead** |

The Manus backend has **one ref**: `refs/heads/main`. No feature branches, no PR refs,
no `refs/remotes/*`. It is not a clone that tracks GitHub — it is a standalone repo
that GitHub receives copies from.

## Three corroborating facts

**1. The webdev working copy has no GitHub remote.** The active project in this session
(`contenthub-troubleshooting`) has exactly one remote, its own artifacts git:

```
origin  https://…artifacts.cloudflare.net/git/prod/5qZi7JR5fZfSFnbxcXix2z.git
```

No `github.com` remote exists in a webdev project. Webdev projects do not fetch from
GitHub, so nothing merged on GitHub can flow back automatically.

**2. main's history is Manus checkpoints.** Of the last 60 commits on GitHub `main`:

```
51  authored by "Manus"
 9  authored by "LagoMi"
46  have subject lines beginning "Checkpoint:"
```

"Checkpoint:" is the message format `webdev_save_checkpoint` writes. GitHub is
receiving the output of Manus checkpoints, which is the signature of a mirror.

**3. The Management UI's GitHub feature is an export.** Settings → GitHub is described
as exporting code *to* a repository. One direction, outbound.

---

## What this means for the deploy

The v2.4 code — the strict schema union, the three Script Factory tables, the 15
columns, both documentation commits — exists **only on GitHub**, at `3e894e0`. The
Manus project, which is what actually builds and serves the live app, is still at
`216c2f2` and knows nothing about any of it.

Publishing from the Content Hub project right now would deploy `216c2f2`: the
pre-merge code, against a database that has already been migrated. That is the safe
direction (the new columns are additive and the old code ignores them), but it would
ship none of the v2.4 feature work while looking like a successful deploy.

**The merge was still correct and necessary** — GitHub is where the code is reviewed
and where the history lives. It is just not the path to production.

---

## The path that does reach the live app

The code has to enter the Manus project's own git backend. Three ways, in order of
preference:

### A. Push GitHub `main` into the Manus S3 backend, then publish

The S3 remote is reachable from a sandbox holding valid credentials. A push of
`3e894e0` to `refs/heads/main` on that backend, followed by a checkpoint and publish
from the Content Hub session, would deploy the merged code.

**Not attempted here.** The credentials in `chfresh-plan/.project-config.json` expire
`2026-08-06T23:52:27Z` and, more importantly, that config was inherited through a
sandbox reset — it names `lights-on-optin` at a path that does not exist. Writing to a
production git backend on the strength of a config whose own identity fields are stale
is not a risk worth taking without the owner's explicit go-ahead. A read-only
`ls-remote` was safe; a push is not.

### B. Reproduce the changes inside the Content Hub session

Open the Content Hub project in a session where its webdev project is active, apply
the same file changes there, checkpoint, publish. Slower and duplicates work already
done, but it uses only supported mechanisms and needs no credential handling.

### C. Ask whether an inbound sync exists

The Management UI may offer a GitHub *import* alongside the export. If it does, that is
the cleanest route. This could not be verified from the sandbox.

---

## Why the Content Hub project could not be found

A separate but related problem: the reviewer's task opens the troubleshooting site
instead. The Content Hub project (`iUgsiz76NwfDUVHZHV7CyJ`, "Urban Monk Content Hub")
is a `web-db-user` project and exists — the S3 backend responded, and the app id matches
`VITE_APP_ID` and the production database name. It is simply not the project bound to
this session or to the reviewer's.

It should be reachable by opening the task or project where the Content Hub webdev
project was originally created, rather than by starting a new one.
