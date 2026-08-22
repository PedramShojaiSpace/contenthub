# Yrmis & Elvira Activation Brief — Internal Research Notes

## Guardrails

This research supports a **post-restoration preparation brief only**. It does not authorize outreach, Apollo changes, Sendy/AWS configuration, list loading, Kajabi or Klaviyo routing, newsletter sends, or any live funnel modification.

## Existing Content Hub Intelligence

The Avatar Intelligence Engine is described in the product as drawing from hundreds of real discovery-call transcripts and sales-team training. It organizes audience signals as pain points across a customer journey—surface pain, practitioner maze, deep pain, and root cause—and makes personas, messaging frameworks, objections, emotional hooks, quotes, and buying triggers available to content-generation surfaces.

The webinar-intelligence system imports pre-registration and post-webinar responses and extracts themes, pain points, motivations, questions, and audience language. The system’s explicit intent is to feed actionable audience intelligence into content generation. Any source-derived language used in the activation brief must be framed as a message-testing hypothesis, not a population-wide clinical fact.

## Existing Apollo Operations

The current scheduled Apollo workflow searches U.S. professionals in nine categories: medical doctors, nurses, dentists, wellness coaches, functional-medicine professionals, nutritionists, meditation teachers, biohacking/longevity professionals, and stress/burnout coaches. It is configured for sequential, deduplicated candidate discovery and email quality screening, then sends accepted emails to Meta Custom Audiences.

The proposed future Apollo-to-newsletter effort is therefore **a separate operating motion** from the current audience-building workflow. It should not automatically repurpose existing Apollo discoveries into Sendy/AWS messaging without a post-restoration data-governance, consent, suppression, and deliverability review.

## Professional Email and Health-Marketing Constraints

The FTC states that CAN-SPAM applies to commercial email, including business-to-business messages. Commercial sends require accurate sender information and non-deceptive subject lines, clear ad identification, a valid postal address, a clear opt-out method, and opt-out processing within ten business days. A company cannot contract away responsibility when another company sends the outreach on its behalf.

Amazon SES provides account-level suppression management for bounces and complaints and offers list/subscription-management capabilities, including automatic unsubscribe links. The Sendy/AWS operating design should make suppression and opt-out decisions durable across every sender, segment, and future CRM handoff—not merely inside one newsletter tool.

The FTC’s health-products guidance applies truthfulness and substantiation principles to health-related marketing, including digital content and marketing through practitioners or intermediaries. The staff brief should therefore avoid disease-treatment or guaranteed-outcome claims, avoid turning personal health narratives into universal claims, and route any objective product, test, or outcome claim through a pre-approved evidence and compliance review.

## References

[1]: [FTC — CAN-SPAM Act: A Compliance Guide for Business](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)

[2]: [AWS SES — Managing Lists and Subscriptions](https://docs.aws.amazon.com/ses/latest/dg/lists-and-subscriptions.html)

[3]: [AWS SES — Account-Level Suppression List](https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html)

[4]: [FTC — Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
