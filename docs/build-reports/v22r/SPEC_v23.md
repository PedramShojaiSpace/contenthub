BUILD PROMPT — Script Factory v2.3: The Script Workspace

Read docs/build-reports/v22r/SPEC.md from disk before starting. This continues v2.2, which is live and operator-tested. All prior directives remain in force: read files before modifying, additive migrations only, no fabricated completions, raw output in every checkpoint (pnpm tsc --noEmit, vitest summary, git log --oneline -1), push after every part, redeploy the sandbox and post "now clickable" when each part lands.

Commit this document as docs/build-reports/v22r/SPEC_v23.md before writing code, and re-read it from disk at the start of every Part. Any decision I make in conversation that changes this spec gets committed to the spec in the same session.

Scope wall: client/src/pages/ScriptFactory.tsx (+ any new components under client/src/components/scriptFactory/), server/scriptFactoryRouter.ts (+ test), drizzle/schema.ts (append only) + migrations, server/routers.ts (wiring). Nothing else.

Context: The first real generation succeeded end to end. The generated script is good. The problem is now the workspace: a 2,000+ word script opens in a small modal with one long scroll, there is no way to jump between sections, and the only actions are approve/archive/delete. Everything a script needs after generation — reworking a section, trying a different length, targeting a different persona — currently requires abandoning it and starting over from the Generate tab.

PART 0 — PRE-BUILD BUG CHECK (report before building)

Generation #1 produced a script referencing "KBMO FIT 176" and "176 foods," but the seeded sales page says the panel screens 22 primary inflammatory food triggers ("KBMO FIT 22 Panel"). Investigate and report raw:

The stored offer_profile json on the seeded analog_data_entries row — does it contain 176, 22, or neither? This determines whether the extractor mis-parsed or the generator embellished.
Whether a claims_reviews row was created for that generation, and what its verdicts contain — a wrong product specification is precisely what claims review exists to catch. If no row was created, report why.
Whether the offer block in the system prompt instructs the model that deliverable specifics are verbatim facts, not paraphrasable.

Then fix at the appropriate layer: if extraction is wrong, fix the extractor prompt; if the generator embellished, add an explicit instruction that numbers, panel names, prices, and timelines from the offer profile must be reproduced exactly and never adjusted, rounded, or elaborated. Add a test with a fixture offer containing distinctive numbers, asserting they survive generation unchanged. Report which layer failed — do not fix both and call it done without saying which was actually at fault.

PART 1 — THE SCRIPT WORKSPACE (replace the modal)

Replace the current script detail modal with a full-screen (or near-full-screen, ≥90% viewport) workspace view. It opens from the Library tab and from idea-card script links, and it is the primary place an operator reads and works on a script.

1.1 Layout — three regions

Left rail — section navigator (sticky). Parsed from the script's own structure tags: [HOOK], [PAIN], [PROOF], [TEACH] (numbered when repeated — "Teach 1," "Teach 2"…), [OBJECTION], [STORY], [CTA], [CLOSE]. Each entry shows the tag label, its timestamp, and its word count. Clicking scrolls the body to that section; the active section highlights as the operator scrolls. Story-slot sections get a distinct marker so an unfilled slot is obvious at a glance. This is the Google Docs outline pattern — build it that way.

Center — the script body. Full width, comfortable reading measure, section headers visually distinct from prose. Timestamps render inline as they do now.

Right rail — metadata and actions (collapsible). Persona, North Star analog entries, offer tier, target length vs. actual word count, grounding coverage ("X of Y sections grounded") with the Grounding disclosure, research job link when present, claims-review badge, and the existing approve / archive / delete / send-to-production actions.

1.2 Requirements
Deep-linkable: ?scriptId=N opens the workspace directly; ?scriptId=N&section=teach-2 opens scrolled to a section.
Escape and a visible close control return to Library with scroll position preserved.
Section parsing must be resilient: an unrecognized tag renders as a generic section rather than breaking the navigator, and a script with no tags at all renders as one unsectioned body.
Mobile: the navigator collapses to a dropdown; the right rail collapses to a bottom sheet.

Acceptance: a 2,000-word script opens full-screen with a navigator listing every section including repeated TEACH blocks correctly numbered; clicking any entry scrolls to it; deep links work; a tagless script does not break the view (test with fixtures).

PART 2 — VARIANTS: THE DATA MODEL

The operator needs multiple takes on the same idea — a 10-minute and a 20-minute cut, a version for Persona A and one for Persona B — visible together, comparable, and independently deletable.

2.1 Schema (append-only)

ALTER script_factory_outputs:

parent_script_id int nullable — the script this was derived from. Null = original.
variant_label varchar(120) nullable — human-readable, auto-generated at creation ("20-min cut", "Persona: Burned-Out Optimizer", "Hook rework"), operator-editable.
variant_of_root_id int nullable — the ultimate ancestor, denormalized so an entire family is one indexed query. Original: null (or self — pick one, state which, be consistent).
generation_params json nullable — the exact inputs used: personaId, analogDataEntryIds, offerTier, targetLengthMinutes, storyMode, researchJobId, ctaOverride, model. This is what makes a regeneration reproducible and what a "regenerate with one thing changed" flow diffs against.

Backfill: existing rows get null parent and null root; they are originals.

2.2 Retrieval
listScripts gains groupVariants: boolean (default true): originals are returned as top-level rows carrying a variants array (id, label, wordCount, targetLength, persona name, status, createdAt). Variants never appear as separate top-level rows when grouping is on.
New getScriptFamily({ scriptId }) → the root plus all descendants with their generation_params, for the comparison view.

Acceptance: creating a variant leaves Library showing one row with a variant count, not two rows; getScriptFamily returns the full set; existing scripts are unaffected (regression test).

PART 3 — REGENERATION ACTIONS (in the workspace)

All of these live in the workspace's right rail under a Regenerate group. Every one of them shows the parameters it will use before running, with the changed parameter highlighted, and requires an explicit confirm — regeneration costs tokens and the operator should never be surprised by what was sent.

3.1 New variant, changed parameters — regenerateVariant

Input: { sourceScriptId, overrides: { personaId?, targetLengthMinutes?, storyMode?, offerTier?, analogDataEntryIds?, ctaOverride?, format? }, variantLabel? }.

Behavior: load the source's generation_params, apply overrides, run the existing generate path with the merged params (do not fork the generation logic — extract a shared internal function if generate is currently procedure-bound, exactly as executeDeepResearch was extracted). Research is reused from the source's researchJobId when present rather than re-run (this is the same topic; re-running costs credits for nothing). The new row gets parent_script_id = sourceScriptId, variant_of_root_id = source's root (or source id if source is a root), and an auto-generated label describing what changed ("20-min cut", "Persona: X"), operator-editable.

UI surface — three buttons that all funnel into this one procedure with different pre-filled overrides:

Different length → length picker (10/15/20), everything else held.
Different persona → persona picker, everything else held. This is the operator's stated case: keep the Persona A script, get a Persona B script, both in the library.
Change parameters → full panel (same six inputs as Generate), pre-filled from source, anything editable.
3.2 Section regeneration — regenerateSection

Input: { scriptId, sectionKey, instruction?: string } where sectionKey identifies a parsed section ("hook", "teach-2", "cta").

Behavior: regenerate only that section, with the full script supplied as context so the replacement fits its neighbors — the model must be told what precedes and follows it and instructed to maintain continuity, voice, and the section's word budget. All v2.2 guards still apply to the regenerated text: story integrity lint, cadence lint, offer-fact fidelity. Optional instruction lets the operator steer ("make it more contrarian," "cut 30 seconds").

This edits in place — it does not create a variant. Preserve the prior text: append the replaced section to a section_history json column on the row (append-only column, array of { sectionKey, previousText, replacedAt }, capped at the last 10 entries) so an operator can undo. After replacement, recompute timestamps deterministically for the whole script (they will have shifted) and recompute grounding coverage.

UI: each section in the workspace body gets a hover action — Regenerate section — opening a small popover with the optional instruction field and a confirm. Show a spinner on that section only; the rest of the script stays readable. An Undo control appears on any section with history.

3.3 Fresh script from the same idea — regenerateAsNew

Input: { sourceScriptId, overrides? }. Same as regenerateVariant but the result is a new root — parent_script_id and variant_of_root_id both null — for when the operator wants an entirely separate script from the same starting point rather than a variant in the same family.

3.4 Comparison view

From any script with variants: a side-by-side comparison of two family members. Columns show each script's parameters (persona, length, story mode, offer tier), word count, grounding coverage, and body. The operator can approve one, delete another, or send one to production directly from this view. Do not build a word-level diff — these are independently generated texts, and a diff of two different generations is noise. Parallel scroll with synced section anchors is what's useful here.

Acceptance (Part 3): each of the three regeneration paths produces the expected row shape (tests asserting parent/root/label/params); a persona variant provably injects the new persona and keeps everything else identical (mocked-LLM prompt assertion comparing to the source's params); section regeneration replaces exactly one section, preserves the rest byte-for-byte, recomputes timestamps, and stores undo history; research is reused rather than re-run when the source has a job (test asserting no new research_jobs row); the story and cadence lints run on regenerated sections (test with a violating mock).

PART 4 — LIBRARY TAB UPDATES
Rows show: title, format, persona, length, word count, status, grounding coverage, variant count ("+2 variants" expanding inline).
Filters: status, format, persona, has-variants.
Clicking a row opens the workspace (Part 1), not a modal.
Bulk delete for variants (a family can accumulate quickly).
FINAL REPORT
Part 0 findings: which layer produced "FIT 176," with the raw offer_profile json, and which layer you fixed.
git log --oneline for the branch, PR link, sandbox URL.
Full vitest summary + pnpm tsc --noEmit raw, with the pre-existing baseline shown unchanged.
Migration/schema table; files touched; deviations stated plainly with evidence.
OPERATOR WALKTHROUGH (run at the sandbox URL)
Open a generated script from Library → full-screen workspace, section navigator on the left listing Hook / Pain / Proof / Teach 1–6 / Objection 1–2 / Story / CTA / Close with timestamps and word counts. Click "Teach 4" → jumps there.
Hover the Hook → Regenerate section → instruction "open with the 2 AM wake-up instead" → only the hook changes, timestamps recompute, undo is available.
Right rail → Different length → 10 minutes → confirm → a variant appears in the family, ~1,450 words, research reused, no new research job.
Right rail → Different persona → pick another persona → confirm → second variant; the original Persona A script is untouched and still in the library.
Compare view → the two personas side by side → approve one, delete the other.
Library shows one row with "+2 variants," expandable.