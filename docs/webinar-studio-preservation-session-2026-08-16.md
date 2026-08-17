# Webinar Studio Combined Preservation Validation

## Authenticated Baseline

After the `content.theurbanmonk.com` HTTPS binding was restored, the authenticated production Webinar Studio rendered successfully at `/hub/content/webinar`. The initial loaded base was **Upstream**. The page exposed the intended non-persistent controls—**Use Upstream base**, **Use Sleep base**, and **Copy live-run brief**—while showing the explicit instruction to select a saved webinar before audience intelligence is displayed.

The selected intelligence-backed Upstream session was ID `1`. Before the workflow, it had `updatedAt = 2026-04-23 02:15:43`, eight related intelligence records, and 584 responses across six extracted imports. The linked Upstream presentation-project tree checksum was `8b4bdd59a186b8c821cb64787de779e535b276301925675b35b72303f2d68b58`.

## Combined Read-Only Workflow Result

The authenticated production workflow was completed in one browser session. The Studio loaded session `1`, rendered its 584-response / six-import Typeform digest, switched to the non-persistent **Sleep** base, and copied the live-run brief. The browser confirmed both **“Sleep base selected”** and **“Live webinar run brief copied.”** No edit, save, generation, publish, Gamma, or webinar-setup action was used.

| Evidence point | Before workflow | After workflow | Result |
|---|---|---|---|
| Session ID | `1` | `1` | Unchanged |
| Session `updatedAt` | `2026-04-23 02:15:43` | `2026-04-23 02:15:43` | Unchanged |
| Intelligence records | 8 | 8 | Unchanged |
| Extracted response count | 584 | 584 | Unchanged |
| Linked Upstream project checksum | `8b4bdd59a186b8c821cb64787de779e535b276301925675b35b72303f2d68b58` | `8b4bdd59a186b8c821cb64787de779e535b276301925675b35b72303f2d68b58` | Unchanged |

The combined workflow therefore confirms that base selection and brief copying remain in-memory operations. They can use the attached Typeform intelligence to tailor the four live-run moments without modifying the saved webinar row, intelligence records, or linked deck asset.
