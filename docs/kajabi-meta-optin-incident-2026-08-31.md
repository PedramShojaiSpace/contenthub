# Kajabi Meta Opt-In Incident Check — August 31, 2026

**Scope:** Read-only response and rendering verification after Facebook visitors reported a “Bad Gateway” message. No form was submitted, no lead was created, and no campaign, page, webhook, redirect, tracking configuration, or ad setting was changed.

| URL checked | Current observed result | Interpretation |
|---|---|---|
| `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` | Loaded in the authenticated browser as **Interconnected Series Free Screening** with the embedded video, name/email fields, and **REGISTER NOW!** button visible. | The main Meta opt-in page was not returning a gateway error at the time of this check. |
| `https://theacademy.theurbanmonk.com/interconnected/thank-you-b` | Returned Kajabi’s branded **404 Page not found** page. | This is a wrong-host URL, not the configured Meta opt-in destination. It is not evidence that the live Meta path is broken. |
| `https://content.theurbanmonk.com/interconnected/thank-you-b` | Loaded the Urban Monk Interconnected thank-you / $67 offer page with no gateway response. | This is the actual URL configured in the Meta opt-in page’s hidden `thank_you_url` field and was available during the incident check. |

## Current conclusion

The live opt-in page itself and its actual configured Content Hub thank-you destination were both available during the check. The wrong-host Kajabi 404 does not explain the reported Facebook “Bad Gateway” message. The report does not establish that a customer-facing Kajabi or Content Hub page is currently broken; the reported wording remains compatible with a transient Meta in-app-browser, CDN, or upstream-origin incident. The next read-only step is to inspect the current active Agora campaign destinations and request examples/timestamps from affected visitors if the customer reports recur.

The current Meta Ads Manager view for Urban Monk account `1153114224705920` loaded during the same read-only check, showing 1,935 total campaigns and 90 unpublished drafts for the August 24–30 date range. The table did not expose a selected Agora campaign’s destination URL without an additional drill-in. The presence of drafts is not evidence that any draft was published or caused the customer reports; no draft, campaign, or ad was selected or changed.

The loaded campaign markup includes multiple Agora Interconnected campaign names ending in `ic-interconnected-free-screening-Meta`, consistent with the live Kajabi opt-in URL checked above. A final bounded HTTP check returned **200** for both the opt-in page (6.34 seconds) and the actual Content Hub thank-you destination (5.71 seconds). No current Bad Gateway response was reproduced.

## Incident assessment and next response

At the time of the check, there is **no evidence of a current persistent Kajabi opt-in or configured thank-you-page outage**. The form was not submitted because that would create a live lead. The reported Facebook message may have been a transient Meta in-app-browser/CDN/upstream error or may have affected a different ad destination; the currently available evidence cannot distinguish those explanations.

If reports recur, ask the affected person for a screenshot that includes the full browser address, approximate time and timezone, whether they used Facebook/Instagram’s in-app browser or an external browser, and whether retrying/reopening resolved it. Use that evidence to correlate against the exact ad and server/provider status without changing a live funnel while incident evidence is incomplete.
