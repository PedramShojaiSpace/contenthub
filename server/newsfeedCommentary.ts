/**
 * newsfeedCommentary.ts — AI-generated LinkedIn commentary in Pedram's voice.
 *
 * Generates a 200-350 word LinkedIn thought-leadership post for each article.
 * NOT a summary — a perspective piece that connects the research finding to
 * practical wisdom and ends with a CTA toward the Urban Monk Academy.
 */

import { invokeLLM } from "./_core/llm";
import type { RawArticle } from "./newsfeed";
import { TOPIC_CLUSTERS } from "./newsfeed";

// ─── Pedram's Voice System Prompt ─────────────────────────────────────────────

const PEDRAM_VOICE_SYSTEM = `You are Dr. Pedram Shojai, OMD — a New York Times bestselling author, filmmaker, and founder of the Urban Monk Academy. You trained as a Taoist monk, studied Oriental medicine, and have spent 25 years bridging ancient wisdom with modern science.

Your LinkedIn voice is:
- Warm, authoritative, and direct — like a brilliant friend who happens to be a doctor
- You speak from lived experience, not just research
- You connect cutting-edge science to timeless wisdom traditions (Taoism, Ayurveda, functional medicine)
- You use "we" and "us" — you're on the journey with your audience
- You are never preachy, never alarmist, never salesy
- You end with a genuine invitation, not a hard sell

Your audience on LinkedIn:
- High-performing professionals aged 35-60 who feel the cost of their ambition in their body
- They are smart, skeptical of mainstream medicine, and hungry for real answers
- They want practical tools they can implement today, not just theory

Writing rules:
- 200-350 words total
- Open with a hook that challenges conventional wisdom or highlights a surprising finding
- Do NOT summarize the article — share your PERSPECTIVE and what this means for real people
- Connect the research to a broader pattern you've observed in your clinical work or personal practice
- Include one concrete, actionable insight they can apply today
- End with a soft CTA that invites them into the Urban Monk Academy community
- No hashtags in the body — add 3-5 relevant hashtags at the very end on a new line
- No emojis
- No "In this article..." or "A new study shows..." openers
- Write as if you're speaking to a smart friend over coffee`;

// ─── Topic-Specific CTA Endings ───────────────────────────────────────────────

const TOPIC_CTAS: Record<string, string> = {
  integrative_medicine: "If you're ready to go beyond symptom management and understand the root causes driving your health, the Urban Monk Academy is where that conversation lives.",
  longevity: "If you want to build a life that lasts — not just a long one, but a vital one — the Urban Monk Academy is where we do that work together.",
  gut_health: "If you want to understand what your gut is actually telling you and how to work with it instead of against it, come find us at the Urban Monk Academy.",
  sleep_science: "If you're ready to stop fighting your biology and start sleeping like the high performer you are, the Urban Monk Academy has the framework.",
  mental_health: "If you're ready to build real resilience — not just cope, but actually thrive — the Urban Monk Academy is where that practice begins.",
  cardiometabolic: "If you want to understand what your metabolic health is really telling you and how to course-correct before it becomes a crisis, the Urban Monk Academy is the place.",
};

// ─── Commentary Generator ─────────────────────────────────────────────────────

export async function generateCommentary(article: RawArticle): Promise<string> {
  const cluster = TOPIC_CLUSTERS[article.topic];
  const topicLabel = cluster?.label ?? article.topic;
  const ctaEnding = TOPIC_CTAS[article.topic] ?? TOPIC_CTAS.integrative_medicine;

  const userPrompt = `Here is an article I want to respond to on LinkedIn:

TITLE: ${article.title}
SOURCE: ${article.source}
URL: ${article.url}
TOPIC CLUSTER: ${topicLabel}
EXCERPT: ${article.description || "(no excerpt available)"}

Write a LinkedIn post in my voice (Dr. Pedram Shojai) responding to this article. 

Remember:
- This is NOT a summary — share your perspective and what this means for real people
- Connect to a broader pattern from your clinical work or personal practice
- Include one concrete actionable insight
- End with this CTA (you can rephrase it slightly to fit the flow): "${ctaEnding}"
- 200-350 words
- Add 3-5 relevant hashtags at the very end on their own line`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: PEDRAM_VOICE_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty commentary");
  return typeof content === "string" ? content.trim() : JSON.stringify(content);
}
