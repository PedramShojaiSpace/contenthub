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
