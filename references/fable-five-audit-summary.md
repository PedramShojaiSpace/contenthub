# Fable Five Audit v2 — Key Findings & Recommendations

**Source:** /home/ubuntu/upload/urban-monk-content-hub-audit-v2.md
**Date:** July 2026

## Business Model (Corrected)
- Three front-end funnels: Lights On course ($369/yr), Oral Biome testing ($399), Gut testing ($399)
- Testing funnels ascend to ~$10K clinical programs at ~20% take rate
- Test buyer EV = $399 + (20% × $10K) = **~$2,399**
- 100 test buyers/month = ~$240K/month = ~$2.9M/year run rate
- 1 point of take-rate improvement = ~$120K/year at 1,200 buyers/year

## Funnel Coverage Gap
1. Symptom content — heavily tooled (40+ modules)
2. Lead capture/quiz — weak (eBook only, no quiz)
3. Test/course purchase — partial (no real A/B testing)
4. Results → consult → enrollment (the 20% take rate) — **ZERO tooling**
5. 80% recovery path — **ZERO tooling**

## Top 10 Recommendations (Status)
- **Rec 1** — Three-Funnel Command (/funnels scorecards + take-rate cohorts) — **NOT BUILT**
- **Rec 2** — Post-Test Ascension System (/ascension enrollment tracker + 80% recovery) — **NOT BUILT**
- **Rec 3** — Decommission covert Reddit personas; build disclosed-presence queue — **NOT BUILT**
- **Rec 4** — Consolidation sprint + role-based nav (3 workspaces, ~25 modules, funnel_id tag) — **NOT BUILT**
- **Rec 5** — Diagnostic Quiz Funnel (/quiz engine, "Gut Check" + "Oral Biome Score") — **NOT BUILT**
- **Rec 6** — Observability layer (/system-health, TS errors fixed) — **DONE**
- **Rec 7** — Attribution reconciliation (nightly Shopify diff, confidence tiers, EV-ROAS) — **DONE**
- **Rec 8** — Real A/B testing engine for pages — **NOT BUILT**
- **Rec 9** — Claims-review gate for health content/ads — **NOT BUILT**
- **Rec 10** — Substack first-class UI + cookie health — **DONE**

## Rec 4 — Consolidation Sprint Details
Three workspaces:
- **OWNER**: /funnels (home), unified approvals queue, /ascension pipeline
- **VA**: single merged queue (VA Task Hub + VA Dashboard + Scoreboard), inline instructions
- **SYSTEM**: everything else, grouped, plus Archive

Module merges:
- 4 landing-page tools → /pages
- 8 intelligence surfaces → /intelligence
- Viral Studio + Video Variant Factory → /shortform
- Media Vault + Asset Library → /library
- UTM + QR → /links

Add funnel_id tag (lights_on | oral_biome | gut | none) to:
- keyword campaigns, content pipeline items, pages, email sequences
- Require on creation; migration screen to retag existing records
- Archive anything still targeting Academy-as-primary

Archive: Kids Research, Collective Sourcing, Presence Assessment, Press Intelligence, ManyChat Wizard, Channel Watchlist, Strategy Brain, LLM Projects

## Rec 1 — Three-Funnel Command Details
Build /funnels as Owner workspace home:
- Three funnel records: Lights On, Oral Biome, Gut Testing
- Stages per funnel: sessions → leads → purchases → results delivered → consult booked → consult held → enrolled
- Per-funnel weekly scorecards with stage-to-stage conversion, 12-week trends, "biggest leak" callout
- Take-rate cohort table: monthly test-buyer cohorts with take rate at 30/60/90 days
- Plot actual monthly revenue against target (100 test buyers/month = ~$240K/month)
- Monday digest replacing scattered current digests

## Audit Sequencing
Month 1: Recs 3, 4, 6 (subtraction + safety)
Months 2-3: Recs 1, 2, 5 (money layer)
Thereafter: Recs 7-10
