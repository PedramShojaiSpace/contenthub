# Hub-Core Build Pressure Audit

**Date:** August 16, 2026  
**Scope:** Read-only analysis of the Hub-core entry and route module structure after repeated staged-build resource terminations.

## Findings

Hub-core already uses route-level `React.lazy` imports for all 25 owned tool pages. The root shell imports only the routing primitive, UI providers, and a suspense fallback. This means the currently reported Hub-core build pressure is not caused by an eager route import pattern in `HubCoreApp.tsx` or `HubShell.tsx`.

The largest owned source modules are **CommandCenter** (274,318 bytes) and **CreationStudio** (210,714 bytes); the next largest modules are LandingPageGenerator (81,108 bytes), ResearchIntelligence (76,593 bytes), BookLibrary (63,304 bytes), and ScriptLibrary (60,697 bytes). The aggregate source across the current Hub-core route set is 1,263,284 bytes.

| Assessment | Evidence | Safe conclusion |
|---|---|---|
| Route-level splitting | Every Hub-core tool is already dynamically imported | No low-risk eager-import fix remains in the Core entry. |
| Shell footprint | `HubShell` imports only providers, error boundary, toaster, tooltip, and suspense fallback | The shell is not the likely source of route-page build pressure. |
| Largest source modules | CommandCenter and CreationStudio account for 485,032 bytes combined | Moving either into a new bundle would be a product-ownership and navigation change, not a transparent build optimization. |
| Prior build outcome | Full staged Hub-core renders were externally terminated under safe heap caps | The remaining limitation is platform resource/publication behavior, pending support resolution or an explicitly approved bundle-ownership redesign. |

## Recommendation

Do **not** transfer CommandCenter or CreationStudio to another Hub bundle solely to work around the termination. Doing so would change bundle ownership, legacy-route behavior, and publication assumptions that have already required dedicated regression coverage. Retain the existing lazy architecture, keep the source-level bundle guards, and treat a future Core split as a separately scoped, approval-reviewed architectural change.
