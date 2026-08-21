# Orobiome CRO Audit — Evidence Log

## Live Page Observations

The published affiliate route is `https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds`. The first viewport presents Natalie Jill community context, a long, high-certainty headline, a broad health-symptom lead paragraph, a generic community-offer CTA, a text anchor to the educational section, and four proof claims. The offer, package detail, $399 pricing, timeline, FAQ, and final offer do not appear until later in the scroll path.

The page contains three native Shopify cart CTAs carrying the same verified Natalie Jill parameter (`bg_ref=109Nl4h0Ds`). It has no fabricated reviews, ratings, or customer testimonials.

## First-Party Signal Availability

Shopify Analytics is available at the store level, but the initial dashboard did not expose a page-specific session-to-cart-to-purchase funnel for the newly launched `/pages/oral` route. The current audit therefore treats actual page-level conversion performance as unconfirmed and frames recommendations as testable hypotheses, not established causal conclusions.

The authenticated BixGrow profile for Natalie Jill Hollan provided an initial first-party partner signal for the current day: **18 clicks**, **1 order**, and **$399.00** in attributed sales. This is a point-in-time, small-sample signal—approximately **5.6% clicks-to-orders**—and should not be treated as a stable conversion rate. It does confirm that her approved `bg_ref=109Nl4h0Ds` attribution is functioning and that at least one purchase has completed through the partner path.

## External Research Sources

1. Baymard Institute’s product-page research emphasizes product-page UX as a conversion-critical experience and publishes a benchmark database based on large-scale manual review: https://baymard.com/research/product-page
2. Baymard Institute’s checkout usability research provides research-backed ecommerce checkout criteria relevant to minimizing transaction friction: https://baymard.com/research/checkout-usability
3. A peer-reviewed study examined the relationship between landing-page text readability and conversion-rate prediction: https://pmc.ncbi.nlm.nih.gov/articles/PMC8621191/
4. A 2023 persuasive ecommerce landing-page study identifies headline, body, trust indicators, benefit statements, and calls to action as core persuasive page components: https://pubs.aip.org/aip/acp/article-abstract/2706/1/020057/2889308

## Guardrails

No recommendation should add fabricated testimonials, ratings, availability claims, disease diagnoses, outcome guarantees, unapproved refunds, or a false clinical promise. Each implementation must retain the native Shopify cart route and Natalie Jill affiliate parameter unless separately approved.
