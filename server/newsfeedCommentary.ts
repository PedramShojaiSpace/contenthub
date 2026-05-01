/**
 * newsfeedCommentary.ts — AI-generated LinkedIn commentary in Pedram's voice.
 *
 * Generates a 200-350 word LinkedIn thought-leadership post for each article.
 * NOT a summary — a perspective piece that connects the research finding to
 * practical wisdom and ends with a CTA toward the Urban Monk Academy.
 *
 * v133: Commentary always references the source article and includes the URL
 * so the LinkedIn post functions as a curated share, not a standalone opinion.
 * Pedram is positioned as a purveyor of important information — someone who
 * finds the signal in the noise and adds expert context.
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
- You are SHARING an article and adding your expert commentary — you are a curator and thought leader, not just an opinion writer
- Open naturally by referencing the article or its source (e.g. "I came across this piece in [Source]...", "This research from [Source] stopped me in my tracks...", "Worth your attention — [Source] just published something important about...")
- Do NOT summarize the article — share your PERSPECTIVE and what this means for real people
- Connect the research to a broader pattern you've observed in your clinical work or personal practice
- Include one concrete, actionable insight they can apply today
- End with a soft CTA that invites them into the Urban Monk Academy community
- ALWAYS end the post with the article URL on its own line, preceded by "Read more:" — this is the link back to the original article
- No hashtags in the body — add 3-5 relevant hashtags at the very end on a new line (after the URL)
- No emojis
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

  const userPrompt = `Here is an article I want to share and respond to on LinkedIn:

TITLE: ${article.title}
SOURCE: ${article.source}
URL: ${article.url}
TOPIC CLUSTER: ${topicLabel}
EXCERPT: ${article.description || "(no excerpt available)"}

Write a LinkedIn post in my voice (Dr. Pedram Shojai) that:
1. Opens by naturally referencing this article and its source — I am sharing this piece with my audience as a curator
2. Adds my expert perspective and connects it to broader patterns from clinical work or personal practice
3. Includes one concrete actionable insight
4. Ends with this CTA (you can rephrase slightly to fit the flow): "${ctaEnding}"
5. Then on its own line: "Read more: ${article.url}"
6. Then on a new line: 3-5 relevant hashtags

Remember: I am SHARING this article, not just writing about the topic. The URL must appear at the end so readers can click through to the original piece.
200-350 words (not counting the URL line and hashtags).`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: PEDRAM_VOICE_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty commentary");
  const text = typeof content === "string" ? content.trim() : JSON.stringify(content);

  // Safety net: if the LLM forgot to include the URL, append it
  if (!text.includes(article.url)) {
    return `${text}\n\nRead more: ${article.url}`;
  }

  return text;
}

// ─── X/Twitter Version Generator ─────────────────────────────────────────────
//
// Condenses the LinkedIn commentary into a ≤280-char X/Twitter post.
// The X version must:
//   - Fit within 280 characters (including the article URL)
//   - Preserve the sharpest single insight from the LinkedIn post
//   - End with the article URL (counts toward the 280 char limit)
//   - Sound like Pedram — direct, no fluff, no hashtags in body
//
// Note: Twitter counts URLs as 23 chars regardless of actual length (t.co wrapping).
// We target ≤257 chars of text + the URL to stay safely under 280.

const X_VERSION_SYSTEM = `You are Dr. Pedram Shojai, OMD. You write punchy, high-signal X/Twitter posts.

Rules:
- Maximum 257 characters of text (NOT counting the URL — it will be appended separately)
- Extract the single sharpest insight from the LinkedIn post
- Direct, confident, no filler words
- No hashtags
- No emojis
- Do NOT include the URL in your response — it will be appended automatically
- End with a period or natural sentence ending`;

export async function generateXVersion(
  linkedInCommentary: string,
  articleUrl: string
): Promise<string> {
  // URL will be appended as a link attachment in Buffer, but we include it in
  // the text as a fallback so the post always has the source reference.
  // Twitter wraps URLs to 23 chars (t.co), so we budget 257 chars for text.
  const userPrompt = `Here is a LinkedIn post I wrote. Condense it into a single punchy X/Twitter post of ≤257 characters that captures the sharpest insight.

LINKEDIN POST:
${linkedInCommentary}

Write ONLY the tweet text (no URL, no hashtags). Maximum 257 characters.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: X_VERSION_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty X version");
  let tweet = typeof content === "string" ? content.trim() : JSON.stringify(content);

  // Hard truncate at 257 chars if LLM went over (safety net)
  if (tweet.length > 257) {
    // Truncate at last word boundary
    tweet = tweet.slice(0, 254).replace(/\s+\S*$/, "") + "…";
  }

  // Append the article URL so the post always links back to the source
  return `${tweet}\n\n${articleUrl}`;
}
