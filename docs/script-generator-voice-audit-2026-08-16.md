# Script Generator Voice Audit — Dr. Pedram Shojai

## Executive Assessment

The user’s concern is **well founded**. The current Viral Studio Script Generator does not use the uploaded books, the extracted book voice profiles, or the 345 curated book snippets at generation time. It relies on a short static paragraph called `PEDRAM_VOICE`, a free-text persona, a free-text topic, a supplied hook, and a generic viral-script structure.[1](../server/viralStudioRouter.ts) The system is therefore not performing retrieval-grounded writing in Dr. Pedram’s voice; it is asking a general model to imitate a high-level description of that voice.

This is the primary reason the outputs can sound polished yet generic, formulaic, or marketing-led rather than recognizably like Dr. Pedram. The good news is that the Content Hub already contains substantial source material that could support a better system; it is simply disconnected from this generator.

> **No Script Generator prompt, data source, book, persona, or workflow has been changed as part of this audit.**

## Evidence Summary

| Audit area | What is present | What is missing from Script Generator | Consequence |
| --- | --- | --- | --- |
| Static voice prompt | A seven-line `PEDRAM_VOICE` description names a warm, authoritative, science-backed Daoist physician. | No book passage, distinctive phrase bank, real opening/closing pattern, or voice-profile field is injected. | The model defaults to generic wellness language. |
| Book corpus | Five ready books contain **318,262 words / 1,769,022 extracted characters**; all five have extracted voice profiles. | The Script Generator imports none of `uploadedBooks`, `bookSnippets`, or `voiceProfileJson`. | The trained corpus is available but unused. |
| Curated snippets | **345 snippets** across the five books, averaging 170 characters, have already passed editorial extraction. | No topic-to-snippet retrieval or source-ranking step exists. | Scripts cannot be anchored in Pedram’s real language or conceptual moves. |
| Persona input | A user can enter a free-text target persona, which is stored as the last-used preference. | No approved avatar intelligence, pain-point library, or persona schema is selected automatically. | Output quality depends on ad hoc human input. |
| Topic integrity | The UI requires a topic for one-at-a-time generation. | The batch pipeline stores `topic` as `undefined` in **50 of 61** stored scripts. | The model is often generating from only a hook and generic persona. |
| Quality control | The JSON schema guarantees script sections, length estimate, hashtags, and CTA fields. | There is no source-fidelity gate, banned-phrase gate, “sounds like Pedram” judge, or regeneration pass. | A structurally valid script can still sound wrong. |

The book-library source is designed to extract unusually detailed voice evidence—tone, sentence rhythm, distinctive vocabulary, metaphors, authority markers, openings, closings, and CTA style.[2](../server/bookLibraryRouter.ts) That information exists in the database but is not referenced by the current Script Generator procedure.[1](../server/viralStudioRouter.ts)

## What the Current Generator Actually Does

The generation request is assembled from these variables only:

| Input | Current behavior |
| --- | --- |
| Topic | Passed directly into the prompt; it is often absent in batch records. |
| Hook | Required and copied verbatim into the script opening. |
| Platform / length | Alters pace and approximate word count. |
| Persona | Free text appended as `Target persona`. |
| SEO keywords / CTA / program | Appended as operational instructions. |
| Voice | One static paragraph plus directives such as “spoken word,” “no filler,” and “directly to one person.” |
| Structure | Fixed Hook → Problem → Agitate → Value/Solution → Proof → CTA sequence. |

This is competent for standard response-marketing content. It is not a system that has actually “scrubbed against” the books. The fixed **Problem / Agitate / Solution** instruction also naturally pulls a model toward a familiar direct-response voice, which is often the opposite of the measured, clinical, philosophical, and story-driven cadence in the books.

## Observed Output Risks

The recent stored scripts demonstrate the likely result. They repeatedly lean on stock phrases such as “peak performance,” “optimizing every aspect,” “brain isn’t firing on all cylinders,” “leaving potential on the table,” and “true cognitive mastery.” These phrases are plausible wellness marketing language, but they are not grounded in a retrieved Pedram source passage. In the reviewed sample, the scripts also made broad scientific claims and patient/student references without a source anchor.

The more serious operational defect is the missing topic context in 50 of 61 stored scripts. Even a strong retrieval system cannot reliably choose the relevant source material if the batch request loses its subject. This should be corrected before judging a new voice layer.

## Recommended Architecture — Approval Required

The recommended change is a **retrieval-grounded Pedram Voice Layer** rather than one larger static prompt.

### 1. Make topic integrity mandatory

The batch path should refuse to generate if its normalized topic is blank, missing, or the literal string `undefined`. Preserve the Hook Generator’s topic when it passes a batch to Script Generator, and store the normalized value with every script. This is a reliability fix, not a voice preference.

### 2. Build a focused source pack before every generation

For each valid topic, retrieve a compact, auditable source pack:

| Source-pack element | Target content | Purpose |
| --- | --- | --- |
| Voice profile | Aggregated profile from the relevant 1–3 books | Gives the model syntax, vocabulary, pacing, and rhetorical guidance. |
| Passage anchors | 3–5 ranked snippets, with book/chapter references, totalling roughly 800–1,200 words of input | Grounds concepts and makes the writing sound lived-in rather than invented. |
| Approved avatar brief | Structured audience need, tension, objection, and desired transformation | Replaces free-form persona-only prompting. |
| Current program constraints | CTA, claim, compliance, and product boundaries | Keeps the offer accurate without overpowering the voice. |

The source pack should be assembled server-side and should never force verbatim quotations into a social script. It should guide the script’s concepts, metaphors, sentence rhythm, and authority markers. The UI can show “grounded in: *The Urban Monk* / *Focus*” for editorial transparency while keeping source text private.

### 3. Replace the generic PAS dominance with a Pedram narrative pattern

Keep the hook and CTA fields, but use a more natural default sequence:

1. **Observed moment or clinical paradox.** Start from a real-world pattern rather than generic pain agitation.
2. **Physiology plus meaning.** Explain the mechanism in plain language, then show why it matters in a human life.
3. **Specific reframe.** Use a Daoist, systems, clinical, or lived-experience insight only where relevant to the source material.
4. **Practical invitation.** Give one clear next step without turning the whole script into a funnel.
5. **Source-aligned CTA.** Use the program invitation only after the teaching has earned it.

This preserves platform performance without making every script sound like a generic fear–agitate–sell sequence.

### 4. Add a two-pass quality gate

After draft generation, a separate low-temperature judge should score the draft against explicit criteria before it appears as “ready.”

| Gate | Pass condition |
| --- | --- |
| Source fidelity | Contains at least two concepts or rhetorical moves traceable to the retrieved pack. |
| Voice specificity | Uses Pedram-like cadence and vocabulary without forced esotericism. |
| Generic-language screen | Rejects stock phrases such as generic “optimize,” “unlock potential,” or unsupported transformation claims unless source-supported. |
| Clinical integrity | Does not invent studies, patient outcomes, or claims. |
| Spoken-word quality | Sounds natural aloud and meets the chosen duration. |
| Persona relevance | Speaks to the approved avatar without asserting sensitive personal attributes. |

The judge should return a short internal revision brief and regenerate once if the score misses the threshold. The editor should always be able to view the selected source anchors and override the draft.

### 5. Create an editorial calibration set before rollout

Before replacing the generator, select 12–20 scripts that Dr. Pedram considers authentic—split across clinical education, personal philosophy, sleep, gut, longevity, and relationship themes. Each example should be tagged with why it sounds right: opening, claim discipline, metaphor, clinical voice, closing, and CTA restraint. Use these as a benchmark, not as a corpus to copy.

Run the old generator and the proposed grounded generator on the same six briefs. Blind-score the results with Dr. Pedram or a designated editor on **voice authenticity, intellectual specificity, spoken rhythm, usefulness, and over-marketing**. Adopt the new path only if it clearly wins.

## Recommended Sequence

| Step | Change type | Approval needed? |
| --- | --- | --- |
| 1 | Fix the batch topic-loss path and add regression coverage | Yes, because it changes live generation inputs. |
| 2 | Build read-only source-pack retrieval from existing books, voice profiles, snippets, and approved avatar briefs | Yes. |
| 3 | Add the Pedram narrative prompt and two-pass quality gate behind a feature flag | Yes. |
| 4 | Produce side-by-side outputs for six real briefs; no default behavior change | Yes, but low-risk because it is shadow mode. |
| 5 | Review the comparison and choose whether to make grounded mode the default | Explicit final approval. |

## Honest Bottom Line

The Script Generator does not currently make meaningful use of the book database or the trained voice materials. It has enough source material to become much better, but the connection has not been built. The most important immediate repair is not “make the prompt longer.” It is to ensure every generation receives a valid topic plus a compact, relevant, traceable source pack—and is rejected if it falls back into generic wellness-copy language.

## References

[1] [Viral Studio Script Generator procedure](../server/viralStudioRouter.ts)

[2] [Book Library voice-profile and snippet extraction](../server/bookLibraryRouter.ts)
