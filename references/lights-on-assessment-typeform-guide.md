# Lights On: Perceptual Baseline Assessment
## Typeform Build Guide + Kajabi Embed Instructions

*Prepared for Dr. Pedram Shojai · Urban Monk Academy*

---

## Overview

This document contains two things:

1. **The complete Typeform build specification** for the enhanced Perceptual Baseline Assessment — a merger of the original 9-statement quiz from the *Lights On* ebook and a deeper 9-channel scored instrument. The combined assessment gives you richer lead data, a more personalized result, and a natural bridge into the Lights On course.

2. **The Kajabi embed strategy** for placing the "Ask the Urban Monk" chatbot and the quiz inside the Urban Monk Academy members area, with a token-based authentication approach that keeps access gated to paying members without requiring a separate login.

---

## The Correct Nine Channels

The nine perceptual channels are distinct senses, though Thermoception and Nociception are presented together in a single week of the curriculum because they share a common physiological pathway and practice framework. The complete list is:

| # | Channel | Core Sense |
|---|---|---|
| 1 | Exteroception | The classical five senses — your interface with the external world |
| 2 | Interoception | Internal bodily awareness — organs, heartbeat, digestion |
| 3 | Proprioception | Body position and movement in space |
| 4 | Neuroception | Subconscious safety radar — reading threats and social cues |
| 5 | Chronoception | Perception and experience of time |
| 6 | Thermoception | Awareness and regulation of temperature |
| 7 | Nociception | The body's pain and threat detection intelligence |
| 8 | Energy Perception | Sensitivity to subtle energetic fields (Qi) |
| 9 | Multiceptual Awareness | Synthesis of all channels simultaneously |

*Note: Channels 6 and 7 are taught together in one week of the Lights On curriculum, but they are distinct perceptual channels with separate diagnostic profiles.*

---

## Part 1: Typeform Build Specification

### Design Intent

The ebook quiz (9 yes/no statements) tells you *whether* a channel is dormant. The deeper scored section (9 questions, one per channel) tells you *how severely* it is suppressed and *which specific channels* to address first. Merged together, the Typeform delivers a richer diagnostic in under 4 minutes, produces a personalized result page, and captures the respondent's email for follow-up.

The Typeform should feel like a conversation, not a clinical intake form. Use Pedram's voice: direct, warm, slightly irreverent, grounded in both science and lineage wisdom.

---

### Typeform Structure

#### Welcome Screen

**Title:** Which of Your Nine Senses Has Gone Dark?

**Body copy:**
> You were born with nine perceptual channels — not five. Modern life has dimmed most of them. This 4-minute assessment will show you exactly which ones are offline and what it's costing you. Based on the work of Dr. Pedram Shojai, OMD, and the *Lights On* program.

**Button label:** Start My Assessment →

---

#### Section 1: The Perceptual Baseline
*From the opening pages of the Lights On ebook. Use Yes/No buttons. Each "Yes" answer adds 1 point to a hidden score variable (`baseline_score`).*

**Intro statement (Statement block, not a question):**
> Answer honestly. There are no wrong answers — only blind spots waiting to be seen.

---

**Question 1 — Channel 3: Proprioception**
*Type: Yes/No*

> I often feel "stuck in my head" and disconnected from the physical sensations in my body.

---

**Question 2 — Channel 3: Proprioception**
*Type: Yes/No*

> I find myself bumping into things, tripping, or feeling clumsy when I'm stressed or distracted.

---

**Question 3 — Channel 4: Neuroception**
*Type: Yes/No*

> I frequently misread the mood of a room or the emotional state of the people around me.

---

**Question 4 — Channel 5: Chronoception**
*Type: Yes/No*

> My sense of time is distorted — days slip by in a blur, or I constantly feel like I'm rushing and running late.

---

**Question 5 — Channel 6 & 7: Thermoception / Nociception**
*Type: Yes/No*

> I struggle to regulate my body temperature, or I find myself ignoring physical discomfort and pain signals until they become impossible to dismiss.

---

**Question 6 — Channel 8: Energy Perception**
*Type: Yes/No*

> I feel drained, agitated, or "off" after being in crowded places, without understanding why.

---

**Question 7 — Channel 1: Exteroception**
*Type: Yes/No*

> I rarely notice the subtle sounds, smells, or textures of my immediate environment unless they are overwhelming.

---

**Question 8 — Channel 4: Neuroception / Channel 2: Interoception**
*Type: Yes/No*

> I have a hard time trusting my "gut feeling" or intuition when making decisions.

---

**Question 9 — Channel 9: Multiceptual Awareness**
*Type: Yes/No*

> I feel a general sense of disconnection from nature and the larger rhythms of the world around me — like I am watching life rather than living it.

---

#### Transition Statement (after Question 9)

*Type: Statement block*

> Good. Now let's go deeper. The next nine questions will pinpoint which channels need the most attention — and give you a personalized roadmap.

---

#### Section 2: The Channel Depth Assessment
*Each question uses a 1–5 Opinion Scale. Map 1 = "Rarely/Never" to 5 = "Almost Always." Each answer feeds a channel-specific score variable.*

**Intro statement:**
> For each statement below, choose how often it applies to you. Be honest — the accuracy of your results depends on it.

*Scale labels for all questions: 1 = Rarely/Never · 3 = Sometimes · 5 = Almost Always*

---

**Question 10 — Channel 1: Exteroception**
*Type: Opinion Scale 1–5*

> When I walk outside, I notice the quality of light, the texture of surfaces, or the layered sounds of the environment around me.

---

**Question 11 — Channel 2: Interoception**
*Type: Opinion Scale 1–5*

> I can sense what my body needs — rest, food, movement, stillness — before I reach a point of exhaustion or hunger.

---

**Question 12 — Channel 3: Proprioception**
*Type: Opinion Scale 1–5*

> I feel physically grounded and coordinated in my body, even when under stress.

---

**Question 13 — Channel 4: Neuroception**
*Type: Opinion Scale 1–5*

> I can walk into a new situation and quickly sense whether it feels safe, trustworthy, or off — without needing to analyze it.

---

**Question 14 — Channel 5: Chronoception**
*Type: Opinion Scale 1–5*

> I move through my days with a sense of time abundance rather than time scarcity — I rarely feel rushed or behind.

---

**Question 15 — Channel 6: Thermoception**
*Type: Opinion Scale 1–5*

> My body handles temperature shifts well. I don't feel easily drained or destabilized by heat, cold, or environmental changes.

---

**Question 16 — Channel 7: Nociception**
*Type: Opinion Scale 1–5*

> When I feel physical discomfort or pain, I treat it as information rather than something to suppress or push through. I can distinguish between productive discomfort and genuine warning signals.

---

**Question 17 — Channel 8: Energy Perception**
*Type: Opinion Scale 1–5*

> I can sense the energy or "vibe" of people and spaces — and I know how to protect my own energy when needed.

---

**Question 18 — Channel 9: Multiceptual Awareness**
*Type: Opinion Scale 1–5*

> I regularly experience states of flow — where time disappears, my senses sharpen, and I perform at my best without effort.

---

#### Email Capture

*Type: Email question (required)*

**Label:** Where should we send your results?

**Description:** Your personalized Perceptual Bandwidth Report will be delivered here. Dr. Pedram will also send you the one practice he recommends starting with, based on your results.

*Tag this contact in Kajabi or your email provider as: `lights-on-assessment`*

---

#### Thank You Screen

**Title:** Your results are ready.

**Body:**
> Scroll down to see your Perceptual Bandwidth Report — or check your inbox for your personalized breakdown.

---

### Result Logic (Three Endings Based on Combined Score)

Configure three ending screens. The combined score is the sum of all Section 2 answers (Questions 10–18, each scored 1–5, maximum 45) plus a modifier from Section 1 (subtract 1 point for every 2 "Yes" answers, maximum deduction of 4 points). Effective range: approximately 5–45.

| Score Range | Result Label | Ending Screen Title |
|---|---|---|
| 5–20 | Lights Off | "Your Perceptual System Is Running on Emergency Power" |
| 21–33 | Lights Dimmed | "You're Navigating Life with Half Your Sensors Offline" |
| 34–45 | Lights Flickering | "Your Channels Are Waking Up — Here's What to Do Next" |

---

**Ending Screen — "Lights Off" (Score 5–20):**

**Title:** Your Perceptual System Is Running on Emergency Power

**Body:**
> You are operating almost entirely from your analytical mind, cut off from the deep intelligence of your body and environment. This is a state of chronic perceptual starvation — and it explains the brain fog, the anxiety, the sense that something is missing even when life looks fine on paper.
>
> The good news: these channels are not broken. They are dormant. And dormant things can be woken up.
>
> The *Lights On* program was built specifically for this. Nine channels. One practice at a time. Progressive, systematic, and grounded in both neuroscience and the Yellow Dragon lineage.

**Button:** Start the Lights On Program →

---

**Ending Screen — "Lights Dimmed" (Score 21–33):**

**Title:** You're Navigating Life with Half Your Sensors Offline

**Body:**
> Several of your sensory channels are offline, likely suppressed by stress, screens, and the pace of modern life. You are navigating reality with a restricted data feed — and your nervous system is working overtime to compensate.
>
> The practices that will help you most are targeted, not general. Your results show which channels need the most attention first. The *Lights On* program gives you a structured path to bring each one back online, in the right sequence.

**Button:** See Your Full Channel Report + Start Lights On →

---

**Ending Screen — "Lights Flickering" (Score 34–45):**

**Title:** Your Channels Are Waking Up — Here's What to Do Next

**Body:**
> You have a solid baseline of awareness, but there are blind spots in your perception that are costing you energy and clarity. The subtler channels — nociception, energy perception, multiceptual awareness — are likely the ones holding you back from the next level.
>
> The *Lights On* advanced modules were designed for exactly where you are. This is where the real work begins.

**Button:** Explore the Advanced Curriculum →

---

### Typeform Hidden Fields & Score Variables

Configure the following in Typeform's Logic panel:

| Variable Name | Type | Description |
|---|---|---|
| `baseline_score` | Number | Count of "Yes" answers from Questions 1–9 |
| `ch1_score` | Number | Answer value from Question 10 (Exteroception) |
| `ch2_score` | Number | Answer value from Question 11 (Interoception) |
| `ch3_score` | Number | Average of Q12 and inverted Q1+Q2 (Proprioception) |
| `ch4_score` | Number | Average of Q13 and inverted Q3+Q8 (Neuroception) |
| `ch5_score` | Number | Average of Q14 and inverted Q4 (Chronoception) |
| `ch6_score` | Number | Average of Q15 and inverted Q5 (Thermoception) |
| `ch7_score` | Number | Answer value from Question 16 (Nociception) |
| `ch8_score` | Number | Average of Q17 and inverted Q6 (Energy Perception) |
| `ch9_score` | Number | Average of Q18 and inverted Q9 (Multiceptual Awareness) |
| `total_score` | Number | Sum of ch1 through ch9 scores |

*Inversion note: For Yes/No questions in Section 1, a "Yes" indicates suppression. When combining with Section 2 scores, treat each "Yes" as reducing the channel score by 1 (minimum 1). Typeform's calculator logic can handle this with conditional score adjustments.*

---

### Webhook / Integration Setup

After submission, configure a Typeform webhook to:

1. **Tag the contact in Kajabi** with `lights-on-assessment-complete` and one of `result-lights-off`, `result-lights-dimmed`, or `result-lights-flickering` based on the score.
2. **Trigger a 3-email sequence in Kajabi** — Email 1: deliver the channel-specific practice for their lowest-scoring channel; Email 2: a testimonial from someone with a similar profile; Email 3: a CTA to the Lights On course.
3. **Pass the score data** to the platform database via the `/api/trpc/presenceAssessment.submitAssessment` endpoint (already built) so results appear in the member's profile inside the app.

---

## Part 2: Kajabi Embed Strategy

### The Core Challenge

Kajabi's members area does not natively support OAuth or token-based authentication with external apps. However, it exposes **Liquid template variables** in course and product themes, and it allows **custom code blocks** (HTML/JavaScript/CSS) anywhere on a page or course post. This creates a clean, workable path.

### Recommended Approach: Signed Token Embed

The cleanest way to embed the chatbot and quiz inside Kajabi without requiring members to log in again is a **signed token handoff**. Here is how it works:

**Step 1 — Kajabi injects the member's email via Liquid.**
Kajabi exposes `{{ member.email }}` as a Liquid variable inside course and product templates — but *only* when a logged-in member is viewing a gated product. This is the access control hook. It renders nothing for logged-out visitors.

**Step 2 — A JavaScript snippet requests a short-lived embed token.**
The snippet calls a lightweight endpoint on the platform. That endpoint issues a JWT (valid for 30 minutes) signed with a shared secret, encoding the member's email and user ID.

**Step 3 — The token is passed to the iframe via URL parameter.**
The iframe loads the chatbot or quiz page with `?token=...` appended. The platform validates the token, looks up the user, and auto-authenticates the session. The member is inside the app with no second login.

**Step 4 — Unauthenticated fallback.**
If the token is missing or expired, the iframe shows: *"This tool is available to Urban Monk Academy members. [Log in to Kajabi →]"*

---

### The Kajabi Custom Code Snippet

Paste this into a **Custom Code block** inside the relevant Kajabi course template or page. Your Kajabi developer will place it using the code editor under **Products → Course → Customize → Edit Code**.

```html
<!-- Ask the Urban Monk — Kajabi Embed -->
<!-- Place inside a Custom Code block in the course template -->

<div id="urban-monk-embed-wrapper" style="width:100%; min-height:700px;">
  <div id="urban-monk-loading" style="text-align:center; padding:40px; color:#888; font-family:sans-serif;">
    Loading Ask the Urban Monk...
  </div>
  <iframe 
    id="urban-monk-chatbot"
    style="display:none; width:100%; height:700px; border:none; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.12);"
    allow="microphone"
    title="Ask the Urban Monk">
  </iframe>
</div>

<script>
  // Kajabi injects the member's email via Liquid before serving this page.
  // This variable is only populated for logged-in members inside a gated product.
  var memberEmail = "{{ member.email }}";
  var platformUrl = "https://YOUR-PLATFORM-URL"; // Replace with your deployed URL

  if (!memberEmail || memberEmail === "") {
    document.getElementById("urban-monk-loading").innerHTML =
      'This tool is available to Urban Monk Academy members. <a href="/login">Log in →</a>';
  } else {
    fetch(platformUrl + "/api/embed-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail, source: "kajabi" })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.token) {
        var iframe = document.getElementById("urban-monk-chatbot");
        iframe.src = platformUrl + "/ask-urban-monk?token=" + data.token;
        iframe.style.display = "block";
        document.getElementById("urban-monk-loading").style.display = "none";
      } else {
        document.getElementById("urban-monk-loading").innerHTML =
          'Unable to load. Please refresh the page or contact support.';
      }
    })
    .catch(function() {
      document.getElementById("urban-monk-loading").innerHTML =
        'Unable to load. Please refresh the page or contact support.';
    });
  }
</script>
```

*To embed the quiz instead of the chatbot, change `/ask-urban-monk` to `/presence-assessment` in the iframe src.*

---

### Where to Place the Embed in Kajabi

| Location | Placement Method | Best For |
|---|---|---|
| Course lesson page | Custom Code block inside a lesson | Chatbot as a study companion per lesson |
| Course overview page | Custom Code block in the header section | Quiz as a course entry point / onboarding |
| Community page | Custom Code block | Chatbot for community Q&A |
| Member welcome page | Custom Code block | Quiz as onboarding assessment |
| Standalone gated Kajabi page | Page-level Custom Code block | Dedicated chatbot or quiz page |

The highest-impact placement for the **chatbot** is inside individual course lessons — so a member can ask "What does Pedram say about this in his other books?" while working through the curriculum. The highest-impact placement for the **quiz** is on the course overview page, so it runs before the member starts the curriculum and sets their personalized learning path.

---

### Important: Where `{{ member.email }}` Works

The Liquid variable `{{ member.email }}` is available **only in course/product templates** accessed through the Kajabi code editor. It is **not available** in standard public-facing website pages or landing pages. This is the intended behavior — it means the embed only activates for logged-in members inside a gated product, which is exactly the access control needed.

---

### What Needs to Be Built on the Platform Side

The following endpoint needs to be added to the existing platform to complete the embed:

**`POST /api/embed-token`** (public endpoint, rate-limited to 10 requests/minute per IP)

- Accepts: `{ email: string, source: "kajabi" }`
- Validates: email must match an existing user in the `users` table
- Returns: `{ token: string }` — a JWT valid for 30 minutes, signed with `JWT_SECRET`
- Token payload: `{ email, userId, exp, iat, source: "kajabi" }`

**`GET /ask-urban-monk?token=...`** and **`GET /presence-assessment?token=...`** (existing pages, need token handling added)

- If `?token` is present: validate the JWT, extract the user, auto-authenticate the session
- If valid: render the page as normal for an authenticated user
- If invalid or expired: render a "Members only" message with a link back to Kajabi

This is a small addition — approximately 50 lines of server code — and can be built into a new `embedRouter.ts` on the platform.

---

### Alternative: Kajabi Expert Agents (Native Option)

Kajabi recently launched **Expert Agents** — a native AI chatbot feature built into the platform. If you prefer to keep everything inside Kajabi without a separate platform, this is worth evaluating. However, Expert Agents cannot be trained on your specific books, cannot maintain conversation history across sessions, and cannot be customized with your voice profile. The custom-built "Ask the Urban Monk" chatbot on this platform is significantly more capable and on-brand. The signed token embed approach above is the recommended path.

---

## Part 3: Implementation Checklist

### Typeform Setup (Your Team)

- [ ] Create a new Typeform for the Perceptual Baseline Assessment using the spec above
- [ ] Configure score variables and logic jumps for the three result endings
- [ ] Set up the email capture field and connect to Kajabi via Zapier or native Typeform webhook
- [ ] Create three Kajabi email sequences — one per result tier (Lights Off, Lights Dimmed, Lights Flickering)
- [ ] Add Kajabi tags: `lights-on-assessment-complete`, `result-lights-off`, `result-lights-dimmed`, `result-lights-flickering`
- [ ] Test the full flow with three different score profiles before publishing

### Platform Development (Manus)

- [ ] Build `POST /api/embed-token` endpoint with JWT issuance and rate limiting
- [ ] Add token validation to the `/ask-urban-monk` page (auto-authenticate on valid token)
- [ ] Add token validation to the `/presence-assessment` page
- [ ] Test end-to-end with a real Kajabi member session

### Kajabi Configuration (Your Team / Kajabi Developer)

- [ ] Access the course code editor: Products → Course → Customize → Edit Code
- [ ] Paste the chatbot embed snippet into the lesson template (or specific lessons)
- [ ] Paste the quiz embed snippet into the course overview page
- [ ] Replace `YOUR-PLATFORM-URL` in the snippet with the deployed platform URL
- [ ] Verify that `{{ member.email }}` renders correctly for a logged-in member
- [ ] Verify that the iframe does not load for logged-out visitors

---

## Appendix: The Nine Channels Reference Card

*For use as a Typeform result page element, printed handout, or course overview graphic.*

| # | Channel | Core Sense | When Blocked | When Open |
|---|---|---|---|---|
| 1 | Exteroception | Classical five senses | Sensory overwhelm or numbness | Vivid, high-resolution engagement with reality |
| 2 | Interoception | Internal bodily awareness | Anxiety, ignoring physical needs | Deep bodily intelligence and emotional regulation |
| 3 | Proprioception | Body position and movement | Clumsiness, feeling ungrounded | Physical grace, flow, structural confidence |
| 4 | Neuroception | Subconscious safety radar | Chronic defensiveness or missing red flags | Social ease and accurate intuition |
| 5 | Chronoception | Perception of time | Time anxiety, rushing, feeling time-poor | Time abundance, presence, rhythmic alignment |
| 6 | Thermoception | Temperature awareness and regulation | Energetic leakage, physical discomfort | Metabolic efficiency and elemental resilience |
| 7 | Nociception | Pain and threat detection intelligence | Ignoring warning signals; chronic pain desensitization | Body as messenger; intelligent response to discomfort |
| 8 | Energy Perception | Sensitivity to subtle energetic fields (Qi) | Feeling drained by others, energetic blindness | Vitality, boundaries, energetic literacy |
| 9 | Multiceptual Awareness | Synthesis of all channels simultaneously | Fragmented attention, tunnel vision | Flow state, peak performance, holistic knowing |

*Channels 6 and 7 (Thermoception and Nociception) are presented together in a single week of the Lights On curriculum, as they share a common physiological pathway and complementary practices.*

*Source: Lights On — The Nine Senses You Were Never Taught, by Pedram Shojai, OMD*
