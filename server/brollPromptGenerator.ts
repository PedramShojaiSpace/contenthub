/**
 * B-roll Prompt Generator
 * Generates Underlord AI prompts for Descript that instruct it to:
 * - Apply Pedram's AI voice clone
 * - Add B-roll based on script content
 * - Apply Studio Sound, captions, and cleanup
 *
 * Also generates fully-optimized YouTube metadata:
 * - vidIQ-optimized title (55-65 chars, front-loaded keyword)
 * - Full description with UTM-tagged ecosystem links and channel footer
 * - Up to 20 tags (channel base tags + topic-specific long-tail tags)
 * - 3 hashtags appended to description for discoverability
 * - Chapter timestamps for vidIQ score boost
 */

import { invokeLLM } from "./_core/llm";
import { vidiqKeywordResearch } from "./vidiq";

// ── Channel Constants ─────────────────────────────────────────────────────────
// Update this block when URLs, pricing, or program names change.

export const CHANNEL_FOOTER = `---
🔔 Subscribe for weekly health wisdom from Dr. Pedram Shojai → https://www.youtube.com/@TheUrbanMonk?sub_confirmation=1

📖 READ THE FULL ARTICLE: BLOG_URL_PLACEHOLDER

---
🚀 FREE MASTERCLASS — Stop Chasing Symptoms. Fix the Root Cause.
Join thousands of high-performers who have used our Upstream Framework to rebuild their gut health, reclaim their energy, and build a protocol that actually works.
👉 Watch Free: https://upstream.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=upstream-bundle&utm_content=video-description&utm_term=youtube_cold_upstream

💡 LIGHTS ON — Wake Up & Live With Purpose ($299/year)
10 modules. 52 weeks. The systematic perceptual training program Dr. Pedram Shojai spent 30 years building. Break through the noise and optimize your mind, body, and spirit.
👉 Enroll Now: https://lightson.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=lights-on&utm_content=video-description&utm_term=youtube_cold_LO

🌿 INTERCONNECTED — Free Documentary Screening
Is your gut the root of everything? Watch this groundbreaking docu-series and discover what modern medicine keeps missing about the microbiome and your health.
👉 Watch Free: https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta?utm_source=youtube&utm_medium=video&utm_campaign=ic-free-screening&utm_content=video-description&utm_term=youtube_cold_IC

📚 EXPLORE THE URBAN MONK ECOSYSTEM
→ Main Site: https://www.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=brand-awareness&utm_content=video-description&utm_term=youtube_cold_UM
→ Urban Monk Nutrition (Supplements): https://www.theurbanmonk.com/urban-monk-nutrition/?utm_source=youtube&utm_medium=video&utm_campaign=supplements&utm_content=video-description&utm_term=youtube_cold_supplements
→ Free Resources & Articles: https://www.theurbanmonk.com/blog/?utm_source=youtube&utm_medium=video&utm_campaign=blog&utm_content=video-description&utm_term=youtube_cold_blog

---
About Dr. Pedram Shojai:
Dr. Pedram Shojai, OMD is a Doctor of Oriental Medicine, Taoist monk, New York Times bestselling author, filmmaker, and host of The Urban Monk podcast. He has spent 30 years studying ancient wisdom traditions and modern functional medicine to help people reclaim their energy, health, and purpose.`;

// ── Channel-specific base tags (always included in every video) ───────────────
const CHANNEL_BASE_TAGS = [
  "Urban Monk",
  "Pedram Shojai",
  "Dr Pedram Shojai",
  "holistic health",
  "functional medicine",
  "Taoist medicine",
  "gut health",
  "longevity",
  "mindfulness",
  "ancient wisdom modern science",
];

export interface BrollPromptResult {
  underlordPrompt: string;
  sceneDirections: string[];
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  hashtags: string[];
  primaryKeyword: string;
}

export async function generateBrollPrompt(params: {
  scriptTitle: string;
  scriptText: string;
  topic: string;
  keywords?: string[];
  blogUrl?: string;
}): Promise<BrollPromptResult> {

  // ── Step 1: vidIQ keyword research ────────────────────────────────────────
  let vidiqData: { keyword: string; volume: number; competition: number; overall: number } | null = null;
  const titleWords = params.scriptTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  try {
    const research = await vidiqKeywordResearch(titleWords, true);
    vidiqData = {
      keyword: research.keyword,
      volume: research.volume,
      competition: research.competition,
      overall: research.overall,
    };
    console.log(`[brollPromptGenerator] vidIQ: keyword="${research.keyword}" volume=${research.volume} competition=${research.competition} overall=${research.overall}`);
  } catch (err) {
    console.warn(`[brollPromptGenerator] vidIQ keyword research failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  const vidiqContext = vidiqData
    ? `vidIQ KEYWORD INTELLIGENCE (use this to optimize the title and tags):
- Best keyword: "${vidiqData.keyword}"
- Search volume score: ${vidiqData.volume}/100
- Competition score: ${vidiqData.competition}/100 (lower = easier to rank)
- Opportunity score: ${vidiqData.overall}/100
- INSTRUCTION: Front-load the title with this keyword or a close variant. Use it in the first sentence of the description. Include it and related variants in the tags array.`
    : `vidIQ data unavailable — use your best judgment for keyword optimization based on the topic.`;

  // Resolve blog URL placeholder
  const resolvedBlogUrl = params.blogUrl ?? "https://www.theurbanmonk.com";
  const footerWithBlogUrl = CHANNEL_FOOTER.replace(/BLOG_URL_PLACEHOLDER/g, resolvedBlogUrl);

  // ── Step 2: Generate B-roll prompt + YouTube metadata via LLM ────────────
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the head of video production and YouTube SEO for The Urban Monk (Dr. Pedram Shojai, OMD).

CHANNEL IDENTITY:
- Channel: The Urban Monk (youtube.com/@TheUrbanMonk)
- Host: Dr. Pedram Shojai — Doctor of Oriental Medicine, Taoist monk, NY Times bestselling author, filmmaker
- Niche: holistic health, gut health, longevity, Taoist medicine, functional medicine, mindfulness, ancient wisdom + modern science
- Audience: health-conscious professionals aged 30-55, ambitious parents and seekers optimizing biology and purpose
- Tone: calm, authoritative, educational, evidence-based with ancient wisdom grounding
- Video length: 7-12 minutes

YOUTUBE SEO RULES (vidIQ best practices — non-negotiable):
1. TITLE: 55-65 characters. Front-load the primary keyword in the first 3 words. Use a number, power word, or question when natural. No clickbait. No ALL CAPS. No emojis in title.
2. DESCRIPTION HOOK: First 2-3 lines (before "Show More") must contain the primary keyword and a compelling reason to watch. Do NOT start with "In this video."
3. TAGS: 10 topic-specific tags — mix of: 3-4 exact-match long-tail phrases (3-5 words), 4-5 broad category terms, 2-3 related topic terms. Each tag max 30 chars. Do NOT include channel brand tags (those are added automatically).
4. HASHTAGS: Exactly 3 hashtags. Always include #UrbanMonk and #PedramShojai plus one topic-specific hashtag.
5. DESCRIPTION BODY: 200-300 words of original SEO content before the channel footer. Include natural keyword variations. Second person (you/your). Mention Dr. Pedram Shojai.
6. TIMESTAMPS: Include 5-7 chapter markers (00:00, 01:30, etc.) estimated from script flow — these dramatically improve vidIQ score.

Always output valid JSON matching the requested schema.`,
      },
      {
        role: "user",
        content: `Generate a Descript Underlord B-roll prompt and fully optimized YouTube metadata for this video.

TITLE: ${params.scriptTitle}
TOPIC: ${params.topic}
INITIAL KEYWORDS: ${(params.keywords ?? []).join(", ")}
BLOG URL: ${resolvedBlogUrl}

${vidiqContext}

SCRIPT (first 3000 chars):
${params.scriptText.substring(0, 3000)}

CHANNEL FOOTER (paste EXACTLY at the end of youtubeDescription):
${footerWithBlogUrl}

Return JSON with this exact structure:
{
  "underlordPrompt": "A detailed Descript Underlord prompt. MANDATORY B-ROLL RULE: You MUST place a new B-roll clip at EVERY 5 to 8 seconds — non-negotiable. No single shot may remain on screen longer than 8 seconds. Cut to a new clip immediately at the 8-second mark throughout the ENTIRE video from start to finish with zero gaps. VOICE: Generate voiceover using Pedram's AI voice clone named 'Pedram FOR GUT COURSE READ'. CLEANUP: Remove all filler words (um, uh, like, you know) and long pauses over 0.3 seconds. CAPTIONS: Add auto-captions in white text, lower third position. MUSIC: Add subtle ambient background music at -18dB (nature/meditation style). B-ROLL CONTENT: Describe specific stock footage clips that match the content being discussed — nature, science, wellness, people meditating, healthy food, anatomy visuals, etc. END CARD: Add a 5-second end card with white text on dark background: 'Learn More at theurbanmonk.com'",
  "sceneDirections": ["array of 10-15 specific B-roll direction strings with timestamps, e.g. 'At 0:00-0:08: aerial shot of mountains at sunrise to establish calm tone; cut at 8 seconds'"],
  "youtubeTitle": "vidIQ-optimized title 55-65 chars, primary keyword front-loaded",
  "youtubeDescription": "Full description: 200-300 words of original SEO content with chapter timestamps, then EXACT channel footer provided above",
  "youtubeTags": ["exactly 10 topic-specific tags — do NOT include channel brand tags like Urban Monk or Pedram Shojai"],
  "hashtags": ["#UrbanMonk", "#PedramShojai", "#TopicSpecificHashtag"],
  "primaryKeyword": "the single best keyword phrase for this video (3-5 words)"
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "broll_prompt",
        strict: true,
        schema: {
          type: "object",
          properties: {
            underlordPrompt: { type: "string" },
            sceneDirections: { type: "array", items: { type: "string" } },
            youtubeTitle: { type: "string" },
            youtubeDescription: { type: "string" },
            youtubeTags: { type: "array", items: { type: "string" } },
            hashtags: { type: "array", items: { type: "string" } },
            primaryKeyword: { type: "string" },
          },
          required: ["underlordPrompt", "sceneDirections", "youtubeTitle", "youtubeDescription", "youtubeTags", "hashtags", "primaryKeyword"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No response from LLM for B-roll prompt generation");

  const result = JSON.parse(content) as BrollPromptResult;

  // ── Step 3: Merge channel base tags with generated tags (deduplicated, max 20) ─
  const allTags = Array.from(new Set([...CHANNEL_BASE_TAGS, ...result.youtubeTags])).slice(0, 20);
  result.youtubeTags = allTags;

  // ── Step 4: Append hashtags to end of description if not already present ──
  const hashtagLine = result.hashtags.join(" ");
  if (!result.youtubeDescription.includes("#UrbanMonk")) {
    result.youtubeDescription = result.youtubeDescription.trimEnd() + "\n\n" + hashtagLine;
  }

  return result;
}
