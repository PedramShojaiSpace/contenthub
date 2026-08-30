# Signal Lab Data Boundaries and Approval Model

The internal Signal Lab is an **admin-only, review-first workspace** for planning message/creative experiments and recording aggregate outcomes. It is designed to capture a complete human decision trail without becoming another live ad-launch, budget-control, audience-management, or customer-data system.

| Record | Stores | Does not store |
|---|---|---|
| Test brief | Offer, destination URL, fixed variables, objective, primary metric, optional approved maximum exposure. | Customer lists, targeting settings, budgets applied to Meta, launch state, credentials. |
| Message cluster | Hypothesis, copy modules, creative reference, manual policy-review status. | Medical/health classification of a viewer, individual traits, test or treatment history. |
| Aggregate result | Daily totals for delivery, traffic, funnel events, spend and revenue, plus data-coverage status. | Email, name, phone, Meta user identifier, customer-list membership, or a per-person conversion trace. |
| Decision log | Human decision, rationale, next step, actor, time. | An automatic instruction to activate, pause, scale, or edit an external object. |

The test lifecycle is deliberately narrow: `draft` → `pending_policy_review` → `ready_for_owner_review` → `owner_approved_for_manual_setup`. The final state means only that the **internal brief has been approved for human/manual setup**; it neither calls Meta nor creates a campaign, ad set, ad, creative, audience, or budget change. Any external action needs a separate, contemporaneous owner confirmation.

The schema supports controlled comparison: a brief specifies one primary metric and its fixed variables; message clusters are the only intentional test variable; the dashboard preserves Meta-reported versus first-party result coverage as a visible distinction. The policy reviewer must reject or revise a cluster that makes an unsupported health claim, implies a viewer’s personal medical or mental-health status, or does not match the landing-page promise.
