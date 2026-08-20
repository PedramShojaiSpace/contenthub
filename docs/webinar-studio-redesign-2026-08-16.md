# Webinar Studio Redesign — 2026-08-16

## Purpose

The Webinar Studio now treats a webinar as a **repeatable live asset**, not a one-time slide-generation job. The underlying webinar funnel workflow remains available for outline, landing-page, thank-you-page, and automation work. The new layer above it is a live-run board that preserves the base Zoom deck and identifies the small group of slides or spoken transitions that should be tuned for the next room.

## Extracted Visual Direction

The available **Upstream** webinar deck establishes the reusable presentation language: a deep forest-green field, a restrained warm radial glow, gold hierarchy cues, editorial serif headlines, quiet sans-serif support copy, thin gold rules, and generous horizontal breathing room. The visual system is purposeful rather than decorative: it gives authority to the core idea on each slide and reserves emphasis for the decision moments.

| Design element | Webinar Studio translation |
|---|---|
| Deep forest background | Dark green studio panels that separate live preparation from administrative setup. |
| Restrained gold accents | Gold is used for sectional labels, active state, and action buttons—not as a generic dashboard color. |
| Editorial type hierarchy | The studio uses a presentation-style title and compact uppercase overlines to echo the deck’s cadence. |
| Spacious slide architecture | The interface distinguishes the stable base deck from a four-part, deliberately limited refresh plan. |
| Offer clarity | The repeat rule prevents session preparation from accidentally rebuilding offer architecture or core narrative. |

## Deep Sleep Deck Evidence

The uploaded `Deep_Sleep_Solution_Keynote_Backup.pptx` is a **57-slide, 16:9** webinar deck titled **The Deep Sleep Solution**. Its stable architecture is more developed than the provisional Sleep profile: it opens with the 3 AM recognition moment, distinguishes two audience motivations, moves through sleep-anxiety and systems education, frames the gut–vagus–autonomic pathway, and closes with a defined Sleep Assessment Bundle invitation, QR/checkout moment, and questions-and-answers finish.

The deck alternates a **midnight navy** teaching field with a **warm ivory** explainer field. Dark slides carry white, high-contrast declarative headlines and thin muted-gold divider rules; light slides use deep navy headline text with compact information modules. Across both modes, the layout uses a restrained warm tan/gold eyebrow, left-aligned editorial hierarchy, generous margins, and a deliberate alternation between short recognition slides, visual-system diagrams, and denser evidence modules. This is the verified design direction for the Sleep base—distinct from, but compatible with, the Upstream deck’s forest-green root-cause field.

| Verified Sleep base element | Stable for repeat webinars | Session-refresh candidate |
|---|---|---|
| 3 AM recognition opening | Yes — preserve the structure and time-based recognition device | Update the opening line with current respondent language. |
| Audience motivations | Yes — preserve the two-audience frame | Adjust priority and examples based on Typeform themes. |
| Gut, vagus, and autonomic teaching arc | Yes — preserve science and diagrams | Select the most relevant one or two examples for the room. |
| Sleep Assessment Bundle invitation | Yes — preserve offer sequence and checkout/QR mechanics | Update proof language and Q&A bridge only. |
| Questions-and-answers close | Yes — preserve closing cadence | Pre-answer the most repeated Typeform questions. |

## Repeatable Live-Webinar Process

1. Choose the **Upstream** or **Sleep** base from the studio board. This presets only the working topic and call to action; it does not modify any saved session or deck.
2. Select the appropriate saved webinar session from the left rail. The board then reads only its already extracted Typeform intelligence.
3. Import and extract any new Typeform responses in **Webinar Intelligence**. The existing flow keeps raw responses, themes, repeated questions, and exact audience language connected to the session.
4. Refresh only four marked moments: the opening recognition, symptom or night-pattern mirror, audience-question bridge, and invitation.
5. Keep the base deck, science, visual foundation, offer sequence, and Zoom delivery mechanics stable. Copy the generated live-run brief for the presenter or production team.

> The studio is intentionally not a slide generator. Its job is to make a recurring Zoom webinar feel current to each audience without losing the polished foundation that makes the presentation effective.

## Validation

The revised interface was rendered in the local Content Hub preview. The Studio board correctly presents the Upstream base, its visual-system rules, stable foundation sections, a four-zone Typeform-informed refresh plan, links to Webinar Intelligence, Zoom registration, and a copyable live-run brief. When no saved session is selected, the interface now explicitly directs the operator to select a session before treating the displayed Typeform count as a completed data read. Focused webinar tests passed: **3 files / 16 tests**. The full suite has one unrelated external DataForSEO connection timeout; the webinar-specific tests and all other local checks in that run passed.

## Verified Sleep Base Integration

The supplied PowerPoint source deck is now represented as the verified **Deep Sleep** base in Webinar Studio, including its real 57-slide count, 16:9 format, content architecture, visual-system rules, and a managed source-deck asset reference. The Studio deliberately treats choosing **Upstream** or **Sleep** as an editor-only preset: it supplies the topic and call-to-action defaults in the unsaved setup form, but it does not write to an existing `webinar_sessions` record. A read-only post-validation database check confirms the existing seven saved webinar sessions retain their last saved update timestamp of `2026-05-27 15:33:10`.

The shared refresh engine is tested against representative Typeform themes, repeated questions, and exact audience language. It limits changes to the recognition opening, audience mirror, systems/questions bridge, and offer/Q&A bridge; it does not regenerate source slides, alter the science sequence, replace the existing Zoom deck, or change the offer mechanics. Focused Webinar Studio coverage now passes **3 files / 18 tests**, and the complete project suite passes **167 files / 1,568 tests / 2 intentional skips**.

The final local Studio render displayed the verified Upstream base with its 37-slide metadata, the Upstream/Sleep preset controls, the explicit “select a saved webinar to load intelligence” state, and the four-zone refresh plan. Switching the base only changed the unsaved editor defaults and surfaced a confirmation; the read-only `webinar_sessions` check confirms no saved session update occurred. The Deep Sleep base exposes its managed 57-slide source-deck reference once selected.

## Content-Bundle Publication Evidence

The initial published checkpoint continued to serve the old Content entry (`index-Be3H2vCS.js`) and the pre-Studio Webinar Funnel Builder screen, while the local rebuilt Content artifact contains `WebinarBuilder-6yoVxaLi.js` with the Webinar Studio marker. The staged build pipeline now explicitly fails if a Hub Content deployment lacks a `WebinarBuilder` chunk containing both **“repeat the deck, refresh the room”** and **“The Deep Sleep Solution.”** The fresh local Content build passed this check, focused pipeline and Studio tests passed **3 files / 7 tests**, and the full suite passed **168 files / 1,570 tests / 2 intentional skips**. The pending task is live artifact publication, not UI code, source-deck metadata, or data persistence.

## Live Release Verification

The production route now serves the Webinar Studio rather than the legacy-only Funnel Builder. The verified **Upstream** base rendered its 37-slide masterclass metadata and the **Deep Sleep** base rendered its 57-slide source-deck metadata, managed **Open source deck** link, stable teaching architecture, and four Typeform-informed refresh moments. Selecting Deep Sleep made only unsaved setup defaults (topic and offer) and visibly confirmed that a session still needs to be completed below; it did not persist an update. Selecting an existing Upstream session rendered the explicit no-data state when that session contained zero attached Typeform responses and zero analyzed imports, directing the operator to Webinar Intelligence rather than fabricating audience insights.

The repeatable preparation process is now: select **Upstream** or **Sleep**, select the saved webinar session, review the attached Typeform signals where present, revise only the four named live moments, copy the live-run brief, and deliver the unchanged foundation deck over Zoom. The first actual webinar session with imported/attached Typeform intelligence remains the needed production proof of the populated-signal state.

## Populated Typeform and Preservation Validation

The production Studio was then opened on the existing **Upstream Health: How to Find and Fix Your Root Cause** session with real imported intelligence. It rendered a populated Typeform summary, including four themes, repeated audience questions, and exact audience language, then mapped those signals only into the four marked refresh zones. The UI’s session roll-up displayed **584 responses / 6 analyzed imports** and gave concrete examples such as *Gut Health & Digestion*, *Chronic Fatigue & Low Energy*, *“How to fix my leaky gut?”*, and *“weight loss.”* No audience language, question, or theme was fabricated.

The session selection was read-only. A post-interaction database check on the selected session confirms it remains at its pre-existing `updatedAt` timestamp of **2026-05-27 15:33:10**, with its original persisted webinar record intact; no deck, outline, landing-page copy, or intelligence record was written during base switching, session loading, or brief review. The stored intelligence relationship continues to exist and the Studio’s visible roll-up is used solely as an operational summary.

## Final Preservation Check

The production **Copy live-run brief** control was explicitly exercised and returned the expected confirmation. After the action, the selected intelligence-backed webinar still held the same pre-existing `updatedAt` timestamp of **2026-05-27 15:33:10**. The verified Deep Sleep PowerPoint source deck also retained the identical SHA-256 checksum before and after the workflow: `40a084128931a91395889e172543acb521cd42b3e26af1ae20785b051c68ba41`. This completes a read-only validation of base switching, session loading, populated intelligence display, brief copying, and source-deck preservation.

### Combined-flow validation in progress

The live Studio has been reopened for a single-session combined preservation pass. Before any selection, the Upstream presentation project state was recorded as `slide_state.json` SHA-256 `70e8d16545ed5903468282dfe03498a712ec951fbd11275d412e749763e161e3` and `explorer_tier.html` SHA-256 `c014c2d91249c194553f82051d7240b2272d3c12311993c86edaace0a7ea86aa`. The next steps are intentionally read-only: select the known intelligence-backed Upstream session, copy the live-run brief in the same browser flow, then compare the session timestamp and project checksums.

### Combined-flow validation complete

The same production browser session selected the real intelligence-backed Upstream webinar, rendered its **584-response / 6-import** Typeform summary, and then executed **Copy live-run brief** with the visible success confirmation. After that exact sequence, the selected webinar still reported `updatedAt` **2026-05-27 15:33:10**. The linked Upstream presentation project assets were unchanged: `slide_state.json` remained `70e8d16545ed5903468282dfe03498a712ec951fbd11275d412e749763e161e3` and `explorer_tier.html` remained `c014c2d91249c194553f82051d7240b2272d3c12311993c86edaace0a7ea86aa`. This completes the combined populated-session and linked-deck preservation check without any database, deck, or asset mutation.

### Final base-switch preservation state

For the stricter pass, the selected webinar’s persisted outputs were recorded before interaction: `outline` MD5 `ca3501305737b8d3c05b73f36601c964`, landing-page copy MD5 `600197092096a11c3fd16f9e82ed435c`, thank-you copy MD5 `f4794582810b80cb41e06dfbfd62338f`, with existing Gamma IDs/URLs retained. In production, the **Deep Sleep** base was selected without a save action; the editor showed the session-default Deep Sleep topic and offer while the saved webinar list remained intact. The next read-only steps are to load the same intelligence-backed Upstream session, copy the brief, and compare this persisted-output metadata afterward.

## Session-to-Intelligence Linkage Audit

The apparent mismatch was resolved without a code or data change. The Studio correctly filters a session’s imports to records with an `extractedAt` timestamp, because only extracted records contain usable themes, questions, and audience language. The legacy saved session `30002` has a valid imported post-webinar row (`webinar_intelligence.id = 1`, 49 responses) but its `extractedAt` is null, so its intentional Studio state is **0 responses / 0 analyzed imports** and the transparent next step is to extract that import in Webinar Intelligence.

The original Upstream session `1` has six extracted imports totaling **584** source responses, so it correctly renders the populated Studio state. Session `90001` likewise has one extracted 149-response import. The query, filtering logic, and displayed states are therefore consistent: there is no broken foreign key and no need to rewrite stored webinar or Typeform data. The only legacy data-quality follow-up is optional extraction of old raw imports that deliberately remain unextracted.
