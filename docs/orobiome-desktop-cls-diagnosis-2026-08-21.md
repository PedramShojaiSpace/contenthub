# Orobiome Desktop Layout-Shift Diagnosis

## Scope

This is a read-only diagnosis of the published Natalie Jill Orobiome route. No page content, theme, offer, pricing, CTA, cart route, or affiliate configuration was modified during the investigation.[1]

## Finding

The desktop Lighthouse run recorded cumulative layout shift (CLS) of **0.369**. The audit attributes approximately **0.302** of that score to the soft-background section beginning with *“A Note From Dr. Pedram Shojai & Natalie Jill”* and another **0.067** to the same section. In both cases, the stated cause is late loading of the Shopify-hosted Poppins regular and medium web fonts. A much smaller **0.001** shift occurs at the hero CTA when the Poppins bold font loads.[2]

| Affected element | Layout-shift score | Recorded cause |
|---|---:|---|
| `section.oral-section.oral-section--soft` | 0.302 | Poppins regular web font loaded |
| `section.oral-section.oral-section--soft` | 0.067 | Poppins medium web font loaded |
| Hero primary native-cart CTA | 0.001 | Poppins bold web font loaded |

The page’s images have explicit dimensions, so the audit did not identify unsized-image shifts. The inspection did identify a separately optimizable 120 px note image that downloads a much larger source image, but it is not the CLS source.[2]

## Proposed Remediation — Not Implemented

The narrow, low-risk fix is to make the Orobiome page’s font metrics stable before the Poppins files resolve. The proposed page-scoped approach is to define `font-display: swap` with metric-compatible local fallbacks for the Poppins weights used by the page, or to preload only the critical Poppins regular, medium, and bold files that Lighthouse identified.

The preferred first step is a page-scoped metric-stable fallback because it avoids changing the active theme’s global font behavior. It would preserve the visual font once loaded, reduce the content reflow in the soft note section, and leave the product offer, page copy, CTA, cart destination, and BixGrow `bg_ref` unchanged.

> **Approval boundary:** This is a performance/CRO-adjacent technical change. It is not implemented and requires separate owner approval.

## Approved Implementation and Re-Test

The owner approved the proposed page-scoped stabilization. The published oral page now declares page-local Poppins regular, medium, and bold font faces using `font-display: optional`, and uses that family only inside the `oral-nj` container. The page remains published; its text, $399 offer, three native cart CTAs, CTA destinations, and BixGrow `bg_ref=109Nl4h0Ds` parameter are unchanged.

| Desktop Lighthouse metric | Before | After | Change |
|---|---:|---:|---:|
| Performance score | 57 | 71 | +14 points |
| CLS | 0.369 | 0.337 | -0.032 |
| LCP | 1.709 s | 1.216 s | -0.493 s |
| FCP | 1.424 s | 0.859 s | -0.565 s |
| Total Blocking Time | 191 ms | 159 ms | -32 ms |

The updated run did not report individual layout-shift elements, whereas the baseline traced the largest shifts to late Poppins regular and medium font resolution. The re-test indicates a clear overall desktop performance improvement, although residual CLS remains above an ideal threshold and should be monitored rather than prompting any unapproved visual change.

## References

[1]: https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds "Published Natalie Jill Orobiome route"

[2]: /home/ubuntu/oral-desktop-cls-analysis.json "Read-only Lighthouse desktop layout-shift analysis"
