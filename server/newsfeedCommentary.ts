/**
 * newsfeedCommentary.ts — AI-generated LinkedIn commentary in Pedram's voice.
 *
 * Generates a 200-350 word LinkedIn thought-leadership post for each article.
 * NOT a summary — a perspective piece that connects the research finding to
 * practical wisdom and ends with a CTA toward the most relevant Urban Monk program.
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

const PEDRAM_VOICE_SYSTEM = `You are Dr. Pedram Shojai, OMD — a New York Times bestselling author, filmmaker, and founder of The Urban Monk. You trained as a Taoist monk, studied Oriental medicine, and have spent 25 years bridging ancient wisdom with modern science.

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
- Open naturally by referencing the article or its source — CHOOSE the opener that best fits the specific article's tone, finding, and emotional weight. Do NOT default to the same structure every time.

OPENER LIBRARY — pick the one that fits the article, or invent a new structure entirely:

  SURPRISING FINDING openers:
  "[Source] just published data that challenges everything we thought we knew about [topic]..."
  "I had to read this [Source] piece twice before I believed it..."
  "[Source] confirmed something this week that most doctors still won't say out loud..."
  "The numbers in this [Source] study are not what I expected..."

  VALIDATION openers:
  "I've been saying this for years. Now [Source] has the data to back it up..."
  "[Source] just gave us the science for what practitioners have known for decades..."
  "Finally — [Source] is asking the right questions about [topic]..."
  "This [Source] finding validates something I see in practice every single week..."

  CURIOSITY / SHARE openers:
  "Something in [Source] this week made me put down what I was doing..."
  "[Source] published a piece that I keep thinking about..."
  "I came across this in [Source] and immediately wanted to share it..."
  "A [Source] article landed in my feed this week that's worth your time..."

  TREND / PATTERN openers:
  "[Source] just published something that fits a pattern I've been tracking for years..."
  "New data from [Source] is reshaping how I think about [topic]..."
  "The science is catching up — [Source] just published what practitioners have long suspected..."
  "[Source] is now reporting what integrative medicine has been saying for a generation..."

  DIRECT INSIGHT openers:
  "[Source] dropped a study this week with one finding that changes the conversation on [topic]..."
  "There's a line in this [Source] piece that every high-performer needs to hear..."
  "[Source] published research this week that reframes a question I get asked constantly..."
  "One statistic in this [Source] study stopped me cold — and it should stop you too..."

  PERSONAL REFLECTION openers:
  "Twenty-five years of clinical work and this [Source] finding still surprised me..."
  "I've worked with thousands of patients on [topic]. This [Source] data adds important context..."
  "Reading this [Source] piece reminded me of a pattern I see constantly in practice..."
  "This [Source] research connects to something I've been thinking about a lot lately..."

- BANNED PHRASES — never use any of these, ever:
  "This stopped me in my tracks"
  "stopped me in my tracks"
  "Worth your attention"
  "For your attention"
  "I had to share this"
  "you need to read this"
  "game changer"
  "game-changer"
- NEVER use the same opening phrase twice — vary the structure, the emotional register, and the angle based on what the article actually says
- Do NOT summarize the article — share your PERSPECTIVE and what this means for real people
- Connect the research to a broader pattern you've observed in your clinical work or personal practice
- Include one concrete, actionable insight they can apply today
- End with a soft CTA that invites them to take the next step with The Urban Monk. Match the CTA to the article topic: gut/microbiome topics → upstream.theurbanmonk.com; energy/vitality/longevity → lightson.theurbanmonk.com; health assessment/testing → gth.theurbanmonk.com; sleep topics → theacademy.theurbanmonk.com/the-restorative-sleep-masterclass-replay. Keep it warm and genuine, never salesy.
- Do NOT include the article URL in the post body — the URL will be appended automatically after the hashtags
- No hashtags in the body — add 3-5 relevant hashtags at the very end on a new line
- No emojis
- Write as if you're speaking to a smart friend over coffee`;

// ─── Topic-Specific CTA Endings ───────────────────────────────────────────────

const TOPIC_CTAS: Record<string, string> = {
  integrative_medicine: "If you're ready to go beyond symptom management and understand the root causes driving your health, the Lights On program is where that conversation lives. lightson.theurbanmonk.com",
  longevity: "If you want to build a life that lasts — not just a long one, but a vital one — the Lights On program is where we do that work together. lightson.theurbanmonk.com",
  gut_health: "If you want to understand what your gut is actually telling you and how to work with it instead of against it, come find us at Upstream. upstream.theurbanmonk.com",
  sleep_science: "If you're ready to stop fighting your biology and start sleeping like the high performer you are, the Restorative Sleep Masterclass has the framework. theacademy.theurbanmonk.com/the-restorative-sleep-masterclass-replay",
  mental_health: "If you're ready to build real resilience — not just cope, but actually thrive — the Lights On program is where that practice begins. lightson.theurbanmonk.com",
  cardiometabolic: "If you want to understand what your metabolic health is really telling you and how to course-correct before it becomes a crisis, start with the Gateway to Health test. gth.theurbanmonk.com",
  consciousness: "If you're curious about the deeper nature of mind, awareness, and what it means to be fully awake — not just alive — the Lights On program is where that inquiry goes deep. lightson.theurbanmonk.com",
  enlightenment: "If you're ready to move beyond information and into genuine transformation — the kind that changes how you see everything — the Lights On program is where that path begins. lightson.theurbanmonk.com",
  metaphysics: "If you want to explore the big questions — what reality actually is, what mind truly is, and how to live from that understanding — the Lights On program is the place for that conversation. lightson.theurbanmonk.com",
  stress_physiology: "If you're ready to understand what chronic stress is actually doing to your hormones, your gut, and your brain — and build a real protocol to reverse it — the Upstream program is where that work happens. upstream.theurbanmonk.com",
  biohacking: "If you want to go beyond the gadgets and build a data-driven, clinically grounded approach to optimizing your biology, start with the Gateway to Health test. It tells you exactly where to focus. gth.theurbanmonk.com",
  ancient_practices: "If you're ready to take these ancient practices off the page and into your daily life — with the science to back them up — the Lights On program is where that integration happens. lightson.theurbanmonk.com",
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
1. Opens by naturally referencing this article and its source — choose the opener style that fits the EMOTIONAL TONE of this specific article (surprising? validating? alarming? hopeful?). Do NOT use "stopped me in my tracks" or any banned phrase. Do NOT default to the same opener structure you used before.
2. Adds my expert perspective and connects it to broader patterns from clinical work or personal practice
3. Includes one concrete actionable insight
4. Ends with this CTA (you can rephrase slightly to fit the flow): "${ctaEnding}"
5. Then on a new line: 3-5 relevant hashtags

IMPORTANT: Do NOT include the article URL anywhere in the post — it will be appended automatically after the hashtags. Just write the commentary and hashtags.
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

  // Strip any URL the LLM may have included (safety net — URL is appended by the router)
  const stripped = text
    .split(`Read more: ${article.url}`).join('')
    .split(`Read more:${article.url}`).join('')
    .split(article.url).join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return stripped;
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
  // Twitter wraps ALL URLs to exactly 23 chars (t.co), regardless of raw length.
  // So the text budget is: 280 - 23 (t.co URL) - 2 ("\n\n" separator) = 255 chars.
  // We ask the LLM for ≤250 to leave a 5-char safety buffer.
  const TEXT_BUDGET = 250;
  const userPrompt = `Here is a LinkedIn post I wrote. Condense it into a single punchy X/Twitter post of ≤${TEXT_BUDGET} characters that captures the sharpest insight.

LINKEDIN POST:
${linkedInCommentary}

Write ONLY the tweet text (no URL, no hashtags). Maximum ${TEXT_BUDGET} characters. Count carefully — this is a hard limit.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: X_VERSION_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty X version");
  let tweet = typeof content === "string" ? content.trim() : JSON.stringify(content);

  // Hard truncate at TEXT_BUDGET chars if LLM went over (safety net)
  if (tweet.length > TEXT_BUDGET) {
    tweet = tweet.slice(0, TEXT_BUDGET - 1).replace(/\s+\S*$/, "") + "…";
  }

  // Append the article URL so the post always links back to the source.
  // Twitter counts the t.co-wrapped URL as 23 chars, so total ≤ 250 + 2 + 23 = 275 chars.
  return `${tweet}\n\n${articleUrl}`;
}
