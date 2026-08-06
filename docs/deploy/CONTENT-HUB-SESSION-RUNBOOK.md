# Content Hub session runbook — getting v2.4 into the live app

**Read this aloud while the owner drives. Commands are given to Manus in that session.**

**The one hash that matters:**

```
dfb5eaa09a686da10c16f9d44a01969f0d20e00e
```

Short form `dfb5eaa`. That is GitHub `main` HEAD, and what the deploy must match.

> **On the earlier `3e894e0`:** `SYNC-DIRECTION-FINDING.md` states `3e894e0` because
> that was HEAD while the document was being written — committing the document itself
> advanced main to `dfb5eaa`. `3e894e0` is an ancestor of `dfb5eaa`, so nothing was
> lost or rewritten; the document is simply self-stale by one commit. **Use `dfb5eaa`.**

---

## Before you start — three standing rules for this session

**1. NO DDL RUNS IN THIS SESSION.** The migration is complete and verified against
production: 17 statements, 9/9 verifications, 2026-08-06. If Manus offers to run a
migration, apply a schema, or execute `pnpm db:push` — **decline**. Re-running it is at
best a no-op and at worst leaves the state ambiguous. This session's job is **code only**.

**2. The database is intentionally ahead of the code.** Production already has all 29
columns on `script_factory_outputs`, the three new tables, and `offer_profile`. That is
the safe direction and needs no action.

**3. If anything is unexpected, stop and report rather than improvise.** Same rule that
has held through every gate so far.

### Why `pnpm db:push` is specifically dangerous here

The branch carries four `drizzle/*.sql` migration files, and **two are not in the
journal**:

```
0124_script_factory_v2                IN JOURNAL
0125_script_factory_v21_topic_tree    IN JOURNAL
0126_script_factory_v23_variants      NOT in journal
0127_script_factory_v23_section_history  NOT in journal
```

`db:push` runs `drizzle-kit generate && drizzle-kit migrate`. Against a database whose
schema was changed outside drizzle, `generate` can produce DDL that tries to re-add
columns that already exist, or worse, reconcile toward a state nobody intended.

**Good news:** nothing runs it automatically.

```
build : vite build && esbuild ...      -> no migration
start : node dist/index.js             -> no migration
```

No `migrate()` call at server boot. `db:push` is manual only. So the risk is only if
someone types it. Don't.

---

## Step 1 — check for drift

```
git log -1 --format='%H %ai %s'
```

**Expected:** `216c2f28b7270ff36e9388ce640af8cd3a3306cc`, dated 2026-08-06 17:48:04,
subject beginning `Checkpoint: Root cause found: drizzle-orm v0.44+…`.

That is what the Manus S3 git backend reported. If you see it, go to Step 2.

### If it shows anything else — the project has drifted

Someone has worked in the project since. Do **not** proceed with the merge as written.
Run:

```
git log --oneline -10
git status --short
```

Then report the output and stop. The merge becomes a real merge rather than a
fast-forward, and the same `schema.ts` conflict that took a full session to resolve on
PR #1 can reappear — this time live on a call, against a project that serves the funnel.

**Specifically do not:** run `git reset --hard`, force-push, discard local changes, or
let Manus "clean up" the working tree. Any of those can destroy work that exists only in
that project. If a rollback is genuinely needed, use the Management UI's version history,
not git.

---

## Step 2 — bring in the code

The Content Hub project has no GitHub remote (webdev projects never do), so add one:

```
git remote add github https://github.com/PedramShojaiSpace/contenthub.git
git fetch github main
```

Confirm the fetch landed:

```
git rev-parse github/main
```

**Expected:** `dfb5eaa09a686da10c16f9d44a01969f0d20e00e`

Then verify a fast-forward is possible **before** merging:

```
git merge-base --is-ancestor HEAD github/main && echo "FAST-FORWARD OK" || echo "NOT A FAST-FORWARD — STOP"
```

If it prints `FAST-FORWARD OK`:

```
git merge --ff-only github/main
```

`--ff-only` is deliberate: it **refuses** rather than creating a merge commit if the
situation isn't what we expect. If it errors, that is the guard working. Stop and report.

Confirm:

```
git log -1 --format='%H'
```

**Expected:** `dfb5eaa09a686da10c16f9d44a01969f0d20e00e`

This brings 48 commits and 148 changed files (69 of them documentation).

---

## Step 3 — sanity-check before publishing

Ask Manus to run:

```
pnpm check
```

**Expected: 35 errors.** That is not a failure — it is the recorded baseline. 22 are
pre-existing on the branch, 13 pre-existing on main, all verified in a detached worktree
as present before this work. If the number is materially different, stop and report.

```
pnpm test
```

**Expected: 35 failed | 1360 passed (1395).** Again the baseline: 33 pre-existing plus 2
from main's own `metaAdPush.test.ts`. All environment-dependent.

Also confirm the schema landed:

```
grep -c 'mysqlTable(' drizzle/schema.ts
```

**Expected: `143`.**

---

## Step 4 — environment variables

**Management UI → Settings → Secrets.**

| Variable | Value | Action |
|---|---|---|
| `LLM_MODEL` | `gpt-5.5` | set or confirm |
| `NODE_ENV` | `production` | set or confirm |
| `ALLOW_DEV_LOGIN` | — | **must be ABSENT** — delete if present |

On `ALLOW_DEV_LOGIN`: absent is not the same as `false`. Read the list and confirm the
key does not appear at all. If it exists with any value, delete the entry.

Read all three back aloud after saving. Env changes may require a restart to take
effect — if the app does not reflect them, restart the dev server from the Management UI
before publishing.

---

## Step 5 — checkpoint and publish

Ask Manus to save a checkpoint with a description such as:

> Script Factory v2.4 — merged from GitHub main dfb5eaa. Production migration already
> applied and verified 2026-08-06 (17 statements, 9/9 verifications). Code only.

Then publish. **Check whether this project has auto-publish enabled** — if it does, the
checkpoint publishes immediately and there is no separate button. If not, use Publish in
the Management UI header.

---

## Step 6 — verify the deployed commit

Do not accept "the deploy finished." Verify the hash.

In the Management UI, check the published version against:

```
dfb5eaa09a686da10c16f9d44a01969f0d20e00e
```

If the deployed commit is anything else — particularly `216c2f2` — the merge did not
reach the build. Stop and report before smoke-testing, because a smoke test against
pre-merge code will fail in confusing ways.

---

## Step 7 — smoke test

The nine verifications proved the schema's *shape*. They did not prove the app's queries
behave against it. This is the test that matters.

**1. Load the live app.** It should boot without an error overlay.

**2. Open Script Factory.** Confirm the page renders and the Generate tab is present.

**3. Fill the Generate panel.** Six inputs, in order as they appear:

| # | Input | What to enter |
|---|---|---|
| 1 | Topic / Brief | any real topic, e.g. "morning light and circadian rhythm" |
| 2 | Format | pick any |
| 3 | Persona / Voice | pick one, or leave "No persona" |
| 4 | Target Length | pick one, or leave "Model default" |
| 5 | Corpus source types | leave "All source types" |
| 6 | North Star — proven analog assets | select at least one if any exist |

**4. Run one real generation.** Server-side, against `gpt-5.5`. Expect it to take
noticeably longer than a UI interaction — this is a real LLM call.

**5. Confirm the saved row.** After generation, the script should appear with a database
id. This is the first write to the new columns — the whole point of the exercise.

**6. Check the lint reports.** They should render, not error. Empty is acceptable; a
crash is not.

**7. Check the sell-density output.** It should display in the rail.

> **Expected behaviour worth knowing in advance:** sell-density is **session-scoped and
> not persisted** — there is no `sell_density` column. The rail is written to say so. If
> you reload the page the report is gone, and **that is correct, not a bug.** Do not
> report it as a failure.

**8. Confirm it appears in Library.** Switch to the Library tab and find the script.

---

## What to watch for

The newly merged code is the first thing to read those 15 columns against real data. One
specific thing could surprise us:

Four of the JSON-bearing columns are physically `longtext` in production and four are
physically `json` — verified 2026-08-06, and **not** what `schema.ts` claimed until this
week. `longtextJson()` handles both by design (it passes an already-parsed object
through and JSON-parses a string). But that is reasoning from its source code, not from
having watched it run against production.

If a generation saves but reading it back produces a string where an array is expected —
or `inArray` throws — that is this, and it is worth stopping for rather than retrying.

---

## If something fails

Report raw output. Do not improvise fixes on a live call.

The database needs no rollback in any failure scenario here: the migration is additive,
already verified, and independent of the code. A code problem is a code problem.

`docs/deploy/v24-production-rollback.sql` exists if it is ever needed, but reverting the
deploy is a Management UI rollback to the previous checkpoint, not a database operation.

---

## Quick reference

```
Target hash        dfb5eaa09a686da10c16f9d44a01969f0d20e00e
Expected start     216c2f28b7270ff36e9388ce640af8cd3a3306cc
Commits gained     48
schema.ts tables   143
pnpm check         35 errors (baseline — not a failure)
pnpm test          35 failed | 1360 passed (baseline)
Env                LLM_MODEL=gpt-5.5, NODE_ENV=production, ALLOW_DEV_LOGIN absent
NEVER              pnpm db:push, git reset --hard, force-push, any DDL
```
