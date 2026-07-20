/**
 * Substack Sequence Router
 *
 * Generates and publishes standalone Substack posts for the 900k cold list
 * re-engagement strategy:
 *
 *  1. Permission Pass — a single "should I keep emailing you?" email
 *  2. Re-Introduction Letter — Pedram's personal re-intro to the full list
 *  3. Academy Launch Sequence (5 emails) — trust-build → offer → close
 *  4. Supplement Sequence (5 emails) — product-specific educational funnel
 *
 * These are NOT derived from WordPress blog posts — they are standalone
 * Substack-native letters written in Pedram's voice by the LLM.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { publishToSubstack } from "./substackPublisher";

// ─── Shared voice / persona system prompt ─────────────────────────────────────

const PEDRAM_VOICE = `You are writing as Dr. Pedram Shojai — the Urban Monk.

Pedram is a Doctor of Oriental Medicine, a Daoist monk, a New York Times bestselling author, and the founder of The Urban Monk wellness platform. He is also the producer of the Interconnected documentary series. He has spent 20 years in clinical practice and has studied ancient wisdom alongside modern science.

IMPORTANT — Recognition triggers: Subscribers on this list came from multiple sources. Some remember "Dr. Pedram Shojai". Some remember "The Urban Monk" brand. Some remember the "Interconnected" documentary series. Every email must include all three recognition anchors naturally within the first 2–3 paragraphs so that regardless of how someone originally found Pedram, they recognize who is writing to them. Work them in naturally — do not list them robotically.

His voice is:
- Warm, direct, and intellectually honest
- Grounded in both clinical experience and personal practice
- Conversational but substantive — he writes like he's talking to a smart friend, not lecturing a patient
- He uses specific details and stories, not vague platitudes
- He never hypes, never uses fake urgency, never says "game-changer" or "life-changing"
- He acknowledges complexity without getting lost in it
- He is comfortable saying "I don't know" and "here's what I've seen work"

All emails come from "Dr. Pedram Shojai" and should feel like a personal letter, not a newsletter blast.

Format rules:
- Write in plain paragraphs — no bullet points, no headers, no bold text
- Short paragraphs (2–4 sentences each)
- Conversational transitions between ideas
- End with a signature: "Talk soon,\n\nDr. Pedram Shojai\nThe Urban Monk | Producer, Interconnected"
- The unsubscribe note at the very end (after signature): "P.S. — If this isn't for you, the unsubscribe link is below. I'll remove you immediately — no hard feelings."
`;

// ─── Helper: generate email body via LLM ──────────────────────────────────────

async function generateEmailBody(userPrompt: string): Promise<string> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: PEDRAM_VOICE },
      { role: "user", content: userPrompt },
    ],
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  return typeof content === "string" ? content : JSON.stringify(content);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const substackSequenceRouter = router({

  /**
   * Generate (and optionally publish) the Permission Pass email.
   * This is the first email to send to the 900k cold list.
   * Its only goal: let people confirm they want to stay, or unsubscribe cleanly.
   */
  generatePermissionPass: protectedProcedure
    .input(z.object({
      publish: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const title = "Should I keep sending you emails?";
      const subtitle = "A quick question before I write to you again";

      const body = await generateEmailBody(`
Write a short permission pass email (150–200 words maximum) for Dr. Pedram Shojai to send to his full 900,000-person Substack list.

Context: These subscribers came from multiple sources — some subscribed through The Urban Monk website, some through the Interconnected documentary series, and some directly to Dr. Pedram Shojai's content. Many may not remember exactly how they found him. The opening sentence must naturally anchor all three: his name (Dr. Pedram Shojai), his brand (The Urban Monk), and the documentary (Interconnected) — so that no matter how someone originally found him, they immediately recognize who is writing.

This email's ONLY goal is to:
1. Trigger recognition across all three entry points in the first sentence
2. Tell them what they'll receive if they stay subscribed
3. Give them a clear, graceful way to unsubscribe if they're not interested

Do NOT include any offer, promotion, or CTA beyond staying subscribed.
Do NOT use fake urgency or guilt.
The tone should be respectful, honest, and low-pressure.

The email should feel like a genuine "hey, is this still useful to you?" check-in from a real person.
`);

      if (input.publish) {
        const result = await publishToSubstack({
          title,
          subtitle,
          bodyHtml: `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
          sendEmail: true,
        });
        return { title, subtitle, body, published: true, postUrl: result.postUrl };
      }

      return { title, subtitle, body, published: false };
    }),

  /**
   * Generate (and optionally publish) the Re-Introduction Letter.
   * This is the second email — sent after the permission pass.
   * It re-establishes the relationship and delivers immediate value.
   */
  generateReintroductionLetter: protectedProcedure
    .input(z.object({
      publish: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const title = "From Dr. Pedram Shojai: I want to start fresh";
      const subtitle = "Something I've been sitting with for a while...";

      const body = await generateEmailBody(`
Write a personal re-introduction letter (350–450 words) from Dr. Pedram Shojai to his Substack list.

Context: This is the second email after a permission pass. Many subscribers haven't heard from Pedram in a while. Some are brand new. Subscribers came from three different entry points — The Urban Monk website/brand, the Interconnected documentary series, and Dr. Pedram Shojai's direct content. The opening must naturally weave in all three so every subscriber recognizes who is writing, regardless of how they originally found him.

This letter should:
1. Open with a specific, vivid clinical story or personal moment that anchors the reader (not a generic opening)
2. Within the first 2 paragraphs, naturally mention all three recognition anchors: "Dr. Pedram Shojai", "The Urban Monk", and "Interconnected" — woven in conversationally, not listed
3. Acknowledge the gap honestly ("Some of you have been on this list for years. Some signed up recently. Either way, I want to earn your attention again.")
4. Deliver one piece of immediate, actionable health insight — something specific and useful, not vague wellness advice
5. Tell them what they'll receive going forward (one email per week, real clinical insights, no fluff)
6. End with a soft, honest close — not a hard sell

Do NOT mention the Academy or any product in this email. This is purely about re-establishing trust.
`);

      if (input.publish) {
        const result = await publishToSubstack({
          title,
          subtitle,
          bodyHtml: `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
          sendEmail: true,
        });
        return { title, subtitle, body, published: true, postUrl: result.postUrl };
      }

      return { title, subtitle, body, published: false };
    }),

  /**
   * Generate one email from the 5-part Academy Launch Sequence.
   * Email 1: The Problem
   * Email 2: The Mechanism
   * Email 3: The Story
   * Email 4: The Offer
   * Email 5: The Close
   */
  generateAcademyLaunchEmail: protectedProcedure
    .input(z.object({
      emailNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      publish: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const emailSpecs: Record<number, { title: string; subtitle: string; prompt: string }> = {
        1: {
          title: "Why smart people stay stuck",
          subtitle: "The paradox of the informed but unwell",
          prompt: `Write Academy Launch Email 1 of 5: "The Problem" (400–500 words).

This email identifies the core paradox Pedram's audience faces: they are intelligent, health-conscious people who have read the books, tried the protocols, and still don't feel the way they want to feel. The problem isn't information — it's integration.

Do NOT mention the Academy or any product. This email purely names the problem and makes the reader feel deeply understood. End with a teaser: "Next week I'm going to show you what's actually blocking your health — and it's probably not what you think."`,
        },
        2: {
          title: "What's actually blocking your health (it's not what you think)",
          subtitle: "The biology most practitioners miss",
          prompt: `Write Academy Launch Email 2 of 5: "The Mechanism" (450–550 words).

This is the most educational email in the sequence. Explain the HPA axis dysregulation → cortisol cascade → gut permeability → LPS endotoxemia cycle that underlies most chronic health complaints. Use clinical language but make it accessible. Show why most health interventions fail: they address symptoms, not the underlying biological cascade.

Do NOT mention the Academy yet. This email builds credibility and makes the reader feel like they've just learned something genuinely important. End with a teaser: "Next week I'm going to tell you about a patient who changed how I practice medicine."`,
        },
        3: {
          title: "The patient who changed how I practice medicine",
          subtitle: "A story I've been wanting to share",
          prompt: `Write Academy Launch Email 3 of 5: "The Story" (450–550 words).

Tell a specific, anonymized clinical story about a patient who came to Pedram after years of failed conventional treatment. The story should illustrate the transformation possible when someone addresses root causes rather than symptoms. Be specific about the patient's situation, the turning point, and the outcome. The reader should see themselves in this patient.

This is the most emotional email in the sequence. Do NOT mention the Academy yet. End with: "I built something for people like her. I'll tell you about it next week."`,
        },
        4: {
          title: "What I built for people like you",
          subtitle: "Two years in the making",
          prompt: `Write Academy Launch Email 4 of 5: "The Offer" (400–500 words).

Introduce the Urban Monk Academy for the first time. Explain:
- What it is: a curriculum-based membership that teaches the integration of ancient wisdom and modern science for lasting health
- What's inside: structured curriculum, community, live sessions with Pedram
- The price: $297/year (less than $1/day)
- The guarantee: 30 days, full refund, no questions asked
- One clear CTA: a link to join (use https://lightson.theurbanmonk.com as the URL)

Write this as a personal recommendation from Pedram, not a sales pitch. He built this because he couldn't reach everyone in a clinical setting. This is his way of scaling his practice.`,
        },
        5: {
          title: "This is for you if...",
          subtitle: "Being honest about who the Academy is for",
          prompt: `Write Academy Launch Email 5 of 5: "The Close" (350–450 words).

This is the final email in the Academy launch sequence. Be direct and honest:
- Describe specifically who the Academy IS for (intelligent, motivated people who are tired of surface-level health advice and want to understand the root causes)
- Describe honestly who it is NOT for (people looking for a quick fix, people who want someone to do the work for them)
- Remind them of the price ($297/year) and the 30-day guarantee
- One final CTA with the link: https://lightson.theurbanmonk.com

Create urgency through specificity and honesty, not artificial deadlines. End with a personal note from Pedram about why this work matters to him.`,
        },
      };

      const spec = emailSpecs[input.emailNumber];
      const body = await generateEmailBody(spec.prompt);

      if (input.publish) {
        const result = await publishToSubstack({
          title: spec.title,
          subtitle: spec.subtitle,
          bodyHtml: `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
          sendEmail: true,
        });
        return { ...spec, body, published: true, postUrl: result.postUrl };
      }

      return { ...spec, body, published: false };
    }),

  /**
   * Generate one email from the 5-part Supplement Sequence.
   * Educates on a specific health topic, then introduces the relevant supplement.
   */
  generateSupplementEmail: protectedProcedure
    .input(z.object({
      emailNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      productName: z.string().describe("Name of the supplement product to feature"),
      productUrl: z.string().url().describe("URL to the product page"),
      productBenefit: z.string().describe("Primary health benefit the product addresses"),
      publish: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const sequenceRole = {
        1: "educational — explain the health problem this supplement addresses, no product mention",
        2: "mechanism — explain the biology/science behind why this problem is so common, no product mention",
        3: "story — share a clinical story of someone who resolved this problem, soft product mention at end",
        4: "offer — introduce the supplement directly, explain what it does and why Pedram uses/recommends it",
        5: "close — final reminder, address objections, strong CTA",
      }[input.emailNumber];

      const prompt = `Write Supplement Sequence Email ${input.emailNumber} of 5 for the product "${input.productName}" (${input.productUrl}).

Primary health benefit: ${input.productBenefit}
Role of this email: ${sequenceRole}

Write 350–500 words in Pedram's voice. Follow the role instructions exactly regarding when to mention the product.
${input.emailNumber >= 4 ? `Include a clear CTA linking to: ${input.productUrl}` : "Do NOT include any product link or CTA in this email."}`;

      const title = input.emailNumber <= 2
        ? `The truth about ${input.productBenefit.toLowerCase()}`
        : input.emailNumber === 3
        ? `What I've seen work for ${input.productBenefit.toLowerCase()}`
        : input.emailNumber === 4
        ? `Why I recommend ${input.productName}`
        : `Last chance: ${input.productName}`;

      const body = await generateEmailBody(prompt);

      if (input.publish) {
        const result = await publishToSubstack({
          title,
          bodyHtml: `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
          sendEmail: true,
        });
        return { title, body, published: true, postUrl: result.postUrl };
      }

      return { title, body, published: false };
    }),

  /**
   * Publish a fully custom standalone Substack post (not derived from WordPress).
   * Used for one-off letters, announcements, or manually written content.
   */
  publishStandalonePost: protectedProcedure
    .input(z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      bodyHtml: z.string(),
      sendEmail: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const result = await publishToSubstack({
        title: input.title,
        subtitle: input.subtitle,
        bodyHtml: input.bodyHtml,
        sendEmail: input.sendEmail,
      });
      return { postUrl: result.postUrl, postId: result.postId };
    }),
});
