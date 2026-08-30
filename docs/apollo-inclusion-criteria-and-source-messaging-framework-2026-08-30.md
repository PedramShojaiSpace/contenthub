# Apollo Inclusion Criteria and Source-Aware Messaging Framework

**Status:** Strategy and review document only. It does not activate Apollo, create an Apollo list, enrich a contact, send outreach, move any contact to Sendy/Kajabi, or alter an existing audience.

> **Core finding:** The existing Apollo system is a professional-title database strategy—not a direct-to-consumer working-professional strategy. It presently finds health and wellness professionals with business email addresses. It should be separated from the D-to-C working-professional pilot instead of treating the two audiences as interchangeable.

## 1. What the Current Apollo System Is Doing

The current daily Apollo workflow searches the United States only, rotates sequentially through nine professional categories, retrieves up to 50 profiles per category, and caps email reveals at 15 per category. The stated operational ceiling is approximately 135 revealed email addresses a day and roughly 4,000 Apollo export credits per month.

| Current category | Existing title examples | Current records | Usable work emails | Intended current use |
|---|---|---:|---:|---|
| Medical doctors | physician, internal medicine physician, family medicine physician, general practitioner, integrative physician | 1,164 | 1,164 | Professional education / physician pathway |
| Dentists | dentist, dental surgeon, holistic dentist, biological dentist, periodontist | 1,076 | 1,076 | Oral-health education / Gateway to Health pathway |
| Biohackers / longevity | biohacker, longevity coach, anti-aging specialist | 967 | 967 | Practical longevity education |
| Nurses | nurse practitioner, registered nurse, advanced practice nurse, clinical nurse specialist, holistic nurse | 930 | 930 | Professional wellness education |
| Nutritionists | nutritionist, dietitian, holistic nutritionist | 909 | 909 | Ecology and nutrition education |
| Functional medicine | functional medicine doctor, integrative medicine physician, naturopathic doctor | 898 | 898 | Systems-level education |
| Wellness coaches | wellness coach, health coach, life coach | 750 | 750 | Educational collaboration / professional resource |
| Meditation teachers | meditation teacher, mindfulness coach, yoga instructor | 598 | 598 | Practical mind-body education |
| Stress / burnout coaches | burnout coach, stress management coach, executive wellness coach | 588 | 588 | Stress-resilience educational resource |
| **Total** |  | **7,880** | **7,880** |  |

The current code requires an email before saving the record. It blocks obvious placeholders, common no-reply formats, examples/test domains, known bounce domains, and Apollo statuses such as `invalid`, `do_not_email`, `spam`, `deactivated`, `unsubscribed`, and `bounced`. It also deduplicates the daily discovery pass by LinkedIn URL before reveal.

### What is working

The system has strong **basic acquisition hygiene**: U.S. geography, title-based category, business-email availability, email-status filtering, placeholder suppression, daily page rotation, and a reveal-credit cap. Current aggregate data shows **5,895 distinct usable emails** across the 7,880 Apollo records, which means list-level email deduplication is now a material priority before any outreach.

### What is missing

The system does not currently apply a clear hierarchy of audience intent, seniority, organization fit, company-size guardrails, frequency caps, global suppression, customer suppression, meaningful duplicate rules by email/domain, or a source-specific messaging plan. It also currently has a direct Meta Custom Audience push in the daily process; that should remain paused while the criteria are redesigned and reviewed.

## 2. Critical Audience Separation

| Stream | Who it is for | What Apollo can responsibly select | What it must not assume |
|---|---|---|---|
| **A. Professional education / partnership stream** | Physicians, dentists, nurses, nutrition professionals, functional medicine professionals, and coaches | Profession, public job title, organization, geography, and valid work email | Their health status, patient population, clinical views, purchasing ability, or interest in a diagnosis/treatment claim |
| **B. D-to-C working-professional stream** | Consumers who work at companies and may seek practical wellbeing education | Job function, seniority band, non-sensitive company attributes, U.S. business email, and self-declared future interest | That a person is burned out, sick, sleep-deprived, gut-impaired, wealthy, or in need of treatment because of title, employer, or browsing behavior |
| **C. Inbound-intent stream** | People who voluntarily opt in through a landing page, QR code, webinar, or email form | Consent record, selected topic, page/form source, engagement, and declared preferences | That a single opt-in authorizes unrelated list enrollment or SMS consent |
| **D. Public-community engagement stream** | Reddit/YouTube participants | Public content context only, subject to each platform’s rules | That public participation permits off-platform enrichment and unsolicited email contact |

> **Required policy:** Do not use Apollo to identify or label a person as medically unwell, burned out, dealing with a condition, or likely to need a health intervention. Use voluntary inbound choices for health-topic personalization. For cold professional outreach, personalize only to public professional context and the educational resource being offered.

## 3. Refined Inclusion and Exclusion Rules

### Universal inclusion gate

Every prospect should pass all of the following before entering a proposed outreach cohort:

| Gate | Rule |
|---|---|
| Geography | United States for the initial pilot. Separate international programs before using other regions. |
| Identity | Named individual—not a generic inbox, role account, or unverified record. |
| Email | Valid business email; no placeholder/bounce/unsubscribed/do-not-email status; deduplicated by normalized email before any message. |
| Professional context | Fits one approved stream and segment below; clear public title and organization context. |
| Suppression | Not in a global do-not-contact list, Sendy unsubscribe list, prior complaint list, existing customer exclusion, active prospect cadence, or prior hard bounce. |
| Frequency | No more than one active introductory sequence per person; no overlapping program sequences. |
| Review | Each new segment needs a sample-list review before full-scale enrollment. |

### Exclusions

Exclude any record that is a role inbox, personal/free email for cold professional outreach, invalid/likely invalid/bounced/unsubscribed/do-not-email status, duplicate normalized email, duplicate person at the same company, obvious competitor/vendor list, current paid customer, minor/unknown-age individual, or a person already in another active outreach sequence.

Do not enrich Reddit or YouTube usernames into work-email outreach solely because of their public comment or post. Keep those sources on-platform, or wait for a direct opt-in.

### Professional stream priorities

| Priority | Segment | Inclusion refinement | First educational entry |
|---:|---|---|---|
| 1 | Burned-out / systems-minded physicians | MD/DO titles in direct-care or clinical leadership roles; U.S.; valid work email; exclude generic hospital inboxes | **Interconnected** systems-level microbiome education |
| 2 | Dentists and periodontists | Dentist, periodontist, dental surgeon, biological/holistic dentist; U.S.; valid work email | **Gateway to Health** oral-health education |
| 3 | Functional medicine and nutrition professionals | Functional/integrative physician, naturopathic doctor, RD/dietitian/nutritionist; valid work email | Microbiome/ecology education with evidence-aware framing |
| 4 | Nurses and wellness practitioners | NP/RN and credible wellness professionals; valid work email; separate clinical from coaching messages | Practical resilience and whole-person education |
| 5 | Coaches, meditation, and longevity educators | Explicit professional titles; valid work email; no health-condition inference | Practical middle-path content and general education |

### D-to-C working-professional pilot criteria

Build this as a **separate pilot**, rather than adding it to the clinician/coach list. Use non-sensitive professional context only: U.S. office-based/knowledge-work titles, employed at qualifying companies, valid work email, and a reasonable company-size band. Begin with a small approval-reviewed cohort. The first message should invite an educational resource; it should not say or imply that the recipient is sick, exhausted, stressed, or clinically unwell.

## 4. Source-Aware Messaging Architecture

Messages must branch by both **who the person is** and **how they arrived**. A physician who independently signs up for Interconnected should not receive the same first message as a physician reached at a work email. The entry message should be concise, resource-led, and easy to decline.

| Source | Permitted context | Message goal | Initial CTA | Do not do |
|---|---|---|---|---|
| Apollo cold professional | Public title, organization, general role | Offer a relevant educational resource; earn permission for follow-up | View the profession-specific series or opt in to the newsletter | Assert a health problem, use sensitive inference, pitch supplements first, or move to SMS |
| Apollo D-to-C work email | Public role/company only | Offer a general practical resource for modern wellbeing | Choose a general education track / newsletter | Mention fatigue, burnout, gut problems, or health assumptions as though known facts |
| Website / webinar / QR opt-in | Declared topic and source URL/form | Deliver what was requested, then deepen education | Requested resource and closely related next step | Add to unrelated program or SMS without recorded consent |
| YouTube comment | Public video and stated comment context | Respond publicly and helpfully; earn opt-in | Relevant video/education link | Enrich and email the commenter off-platform |
| Reddit post | Public post context | Participate respectfully and resource-first within platform norms | Relevant public educational resource where appropriate | Identify, enrich, or cold-email poster off-platform |
| Referral / partner introduction | Referrer and consent context | Make the referral explicit and helpful | Resource matching referral context | Treat it as generic cold outreach |

## 5. Draft Message Paths for Review

These are **frameworks, not activated sequences**. Review for brand, legal/compliance, deliverability, and partner methodology before use.

### A. Physician — Apollo professional outreach → Interconnected

**Subject:** A systems-level education resource for clinicians

> Dr. {{last_name}}, I’m reaching out because your work in {{public specialty or role}} sits close to questions many clinicians are asking about whole-person health and the microbiome.
>
> Dr. Pedram Shojai is a physician, an early functional-medicine practitioner, and a former monk. His approach is practical and science-informed: neither symptom-by-symptom treatment algorithms nor wellness hype.
>
> We created **Interconnected**, a no-pressure educational series on the ecology of health and the microbiome. If useful, you can review it here: {{approved Interconnected URL}}.
>
> If this is not relevant, reply and we will not follow up.

**Branch after click/opt-in:** Deliver the requested resource; then offer one profession-relevant educational follow-up. Do not begin with a product offer.

### B. Dentist / periodontist — Apollo professional outreach → Gateway to Health

**Subject:** An oral-systemic health education resource for your review

> Dr. {{last_name}}, we are sharing a practical education resource with dental professionals interested in the broader oral-systemic health conversation.
>
> Dr. Pedram Shojai’s work brings a physician and functional-medicine perspective to modern health without turning the discussion into a supplement pitch or a clinical claim.
>
> **Gateway to Health** is our education path for this conversation. If you would like to review it, here is the resource: {{approved Gateway URL}}.
>
> If you prefer not to receive future notes, reply and we will remove you.

### C. Working professional — Apollo work-email outreach → choose-your-topic resource

**Subject:** A practical resource for life, work, and health

> Hi {{first_name}}, I’m sharing a practical education resource from The Urban Monk for people navigating the demands of modern work and life.
>
> Dr. Pedram Shojai is a physician, early functional-medicine practitioner, and former monk. His work focuses on a practical middle path—grounded, evidence-aware education without health promises or hype.
>
> If you are interested, choose the topic most useful to you: {{approved general resource / preference page}}.
>
> If you would rather not hear from us, reply and we will not follow up.

**Branch after expressed interest:** Use the person’s chosen topic (gut/oral, sleep, Lights On, or general vitality) rather than inference from employer or role.

### D. Inbound opt-in — source and topic matched

**Subject:** Here is the resource you requested

> Hi {{first_name}}, thanks for requesting {{resource title}}. Here is your access: {{resource URL}}.
>
> Based on your selected topic, the next most relevant education piece is {{one related resource}}. You can explore it whenever it is useful; there is no obligation.

**Branching rule:** Match only declared form/page topic plus explicit consent choices. Do not apply cold-Apollo assumptions to the inbound sequence.

## 6. Pilot Design and Measurement

| Pilot | Cohort | Proposed size | Success signal | Stop / review signal |
|---|---|---:|---|---|
| P1 | Physicians | 100 review-approved contacts | Positive reply, opt-in, relevant resource click | Complaints, high bounce, repeated irrelevance feedback |
| P2 | Dentists | 100 review-approved contacts | Resource click and constructive reply | Same as P1 |
| P3 | Functional/nutrition professionals | 100 review-approved contacts | Opt-in and meaningful engagement | Same as P1 |
| P4 | Working professionals | 100 review-approved contacts | Voluntary topic selection / newsletter opt-in | Any indication of inappropriate health inference or poor relevance |

Measure delivered, bounced, replied positively/negatively, opted in, resource clicked, unsubscribe/complaint, and later first-party program enrollment. Keep the source, segment, message version, and consent state attached to every record. Do not treat an email open as consent or purchase intent.

## 7. Required Approval Gates Before Activation

1. Review and approve the revised categories, universal exclusion list, suppression process, and campaign-frequency limits.
2. Confirm the approved URL for each professional resource and each D-to-C education track.
3. Review the 100-contact pilot samples manually before any use.
4. Confirm who owns opt-out processing, complaint monitoring, deliverability, and record retention in Sendy/AWS.
5. Obtain explicit approval before enabling Apollo search/reveal, Meta Custom Audience sync, Sendy list enrollment, scheduled automation, or any outbound send.

## Recommended Next Step

Approve the **two-stream separation** first: keep Apollo professional outreach and D-to-C working-professional outreach as distinct cohorts. Then approve a 100-contact physician pilot and a separate 100-contact dentist pilot with messages reviewed by Yrmis and Elvira using their own sending methodology. No system activation should occur until those decisions are confirmed.
