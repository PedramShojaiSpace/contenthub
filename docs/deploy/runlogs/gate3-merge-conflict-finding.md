# Gate 3 — Second halt: PR #1 does NOT merge cleanly, and merging it as-is would regress production

**Established 2026-08-06 18:4x UTC, before any merge was attempted.**

## GitHub's own verdict

```
{ "mergeable": "CONFLICTING", "mergeStateStatus": "DIRTY" }
```

`git merge-tree --write-tree` (a dry run that touches no working tree) confirms:

```
CONFLICT (content): Merge conflict in drizzle/schema.ts
CONFLICT (content): Merge conflict in server/_core/index.ts
```

## The divergence is not small

| | commits |
|---|---|
| merge-base | `08c6efe` |
| branch ahead of main | **43** |
| **main ahead of branch** | **80** |

`main` has moved 80 commits since this branch left it. That work is a different
workstream entirely — the Interconnected documentary funnel: opt-in pages, Meta CAPI,
Kajabi enrollment, Klaviyo sync, A/B split tests, lead watchdogs, Shopify checkout.

## The serious part: the branch's schema.ts is missing four tables that main has

```
main   schema.ts: 140 mysqlTable declarations
branch schema.ts: 139

in main, MISSING from branch:
  funnel_economics_scenarios
  interconnected_leads
  kajabi_purchases
  kajabi_retry_queue

in branch, not in main (the v2.2-v2.4 work):
  research_jobs
  suggested_ideas
  topic_nodes
```

**All four of main's tables exist in live production and three hold real data:**

```
+----------------------------+------------+
| table_name                 | table_rows |
+----------------------------+------------+
| funnel_economics_scenarios |          0 |
| interconnected_leads       |        795 |
| kajabi_purchases           |         18 |
| kajabi_retry_queue         |          2 |
+----------------------------+------------+
```

`interconnected_leads` holds **795 lead records** — and it is the table the live write
traffic observed during Gate 1 and Gate 2 was landing in. `kajabi_purchases` holds 18
purchase records.

A naive conflict resolution that favours the branch would delete those four table
declarations from `schema.ts`. The tables and their rows would survive in the database
(drizzle does not drop what it does not declare), but the application code would lose all
typed access to them: the opt-in form, the Kajabi purchase webhook, the retry queue, and
the funnel economics page would break on a deploy. That is a live revenue funnel taking
real traffic today.

Also note `server/_core/index.ts`: main added **253 lines** there since the merge-base
(webhook endpoints, static opt-in page routes, scheduled handler mounts) while the branch
added 40. Those are genuinely different edits to the same regions.

## What is NOT at risk

- The **database migration is unaffected.** It was purely additive and is verified. The
  three new tables and 15 new columns are in place regardless of what happens to the PR.
- `main` did **not** touch any Script Factory table in `schema.ts`, so there is no
  competing definition of the v2.4 work.
- Nothing has been merged. `main` is untouched at `216c2f2`.

## Why I did not resolve it

Resolving 2 conflicting files across an 80-commit divergence is not a mechanical
operation. `schema.ts` needs the union of both sides; `server/_core/index.ts` needs both
sets of route registrations, in an order I cannot verify without running the app. Getting
that wrong on a repo whose `main` is serving a live ad-funded funnel is a materially worse
outcome than a paused merge.

The reviewer's standing instruction — *"a half-merged state is worse than a paused
one"* — applies directly, and more strongly than when it was written: at that point the
concern was a merge that could not be deployed. The actual situation is a merge that
would silently break a live funnel.

## Halted. `main` remains at `216c2f2`.
