/**
 * Syndication Adapter
 *
 * Takes a published WordPress blog post and generates four distinct adapted versions:
 *
 * 1. Substack Letter — Pedram's personal founder voice (600–1,000 words)
 *    - Opens with a personal hook or question
 *    - Delivers the core insight in plain, warm language
 *    - Links back to the WordPress post as the "full breakdown"
 *    - Closes with a community engagement prompt (reply, share)
 *    - CTA: drives back to WordPress/Academy, NOT Substack paid upgrade
 *
 * 2. Medium Article — Cold-audience adapted version (1,200–2,000 words)
 *    - Rewrites the opening for readers who don't know Pedram
 *    - Removes newsletter-native language
 *    - Canonical URL is set to the WordPress post URL (handled by mediumPublisher.ts)
 *    - CTA: "Follow me on Substack" link
 *
 * 3. Quora Answer — Fresh expert answer (300–600 words)
 *    - Written as a direct answer to the most relevant question on Quora
 *    - Never copy-pastes from the WordPress article
 *    - No promotional links in body
 *    - Includes the target question to search/answer on Quora
 *
 * 4. Reddit Post — Community-native post for r/health or relevant subreddit (200–400 words)
 *    - Written in Reddit's conversational, peer-to-peer style
 *    - Suggests the best subreddit(s) to post in
 *    - Includes a link to the WordPress article as the source
 *    - Framed as sharing a discovery, not promoting a brand
 */

import { invokeLLM } from "./_core/llm";

export interface WordPressPostContext {
  title: string;
  slug: string;
  wordpressUrl: string; // Full canonical URL e.g. https://theurbanmonk.com/gut-health/
  bodyHtml: string;     // Full HTML content of the WordPress post
  metaDescription?: string;
  focusKeyword?: string;
}

export interface SyndicationAdaptations {
  substack: {
    title: string;
    subtitle: string;
    bodyHtml: string;
  };
  medium: {
    title: string;
    bodyMarkdown: string;
    canonicalUrl: string; // Always = wordpressUrl
  };
  quora: {
    targetQuestion: string; // The Quora question to answer
    answerMarkdown: string;
  };
  reddit: {
    suggestedSubreddits: string[]; // e.g. ["r/Microbiome", "r/Nootropics", "r/Biohackers"]
    postTitle: string;
    postBody: string; // Plain text, Reddit markdown
    sourceLink: string; // Always = wordpressUrl
  };
}

/**
 * Strip HTML tags to get plain text for LLM input.
 * Preserves paragraph structure with newlines.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Generate all four syndication adaptations from a WordPress post.
 */
export async function generateSyndicationAdaptations(
  post: WordPressPostContext
): Promise<SyndicationAdaptations> {
  const plainText = htmlToPlainText(post.bodyHtml);
  // Truncate to ~4,000 chars for LLM context efficiency
  const truncatedText = plainText.length > 4000
    ? plainText.slice(0, 4000) + "\n\n[... article continues ...]"
    : plainText;

  const systemPrompt = `You are the content strategist for Dr. Pedram Shojai, the Urban Monk — a New York Times bestselling author, Doctor of Oriental Medicine, Daoist monk, and founder of The Urban Monk wellness platform. 

Pedram's voice is: warm, direct, intellectually curious, grounded in both ancient wisdom and modern science. He speaks to busy, intelligent adults who are tired of being told to "just try harder." He never lectures — he invites discovery. He uses questions to open doors, not statements to close them.

The Urban Monk Academy is the primary business goal. The Substack list exists to build relationship and drive traffic back to the website and Academy — NOT to monetize directly on Substack. Every Substack post should make the reader want to visit theurbanmonk.com or join the Academy.`;

  // ─── 1. Substack Letter ────────────────────────────────────────────────────
  const substackPrompt = `The following is a published blog post from theurbanmonk.com. Your job is to write a Substack founder letter based on this content.

WORDPRESS POST TITLE: ${post.title}
WORDPRESS POST URL: ${post.wordpressUrl}
FOCUS KEYWORD: ${post.focusKeyword ?? "not specified"}

ARTICLE CONTENT:
${truncatedText}

Write a Substack founder letter from Dr. Pedram Shojai with these requirements:
- Length: 600–900 words
- Tone: Personal, warm, conversational — like Pedram writing to a friend who trusts him
- Opening: Start with a personal hook, a patient story, a question Pedram has been sitting with, or a moment from his own life. Do NOT start with "I" as the first word.
- Body: Deliver the core insight from the article in plain language. No academic jargon. No bullet lists.
- Mid-point: Include exactly ONE link back to the WordPress article with this text: "I wrote the full breakdown — with all the science and the protocol — on the site this week." Link to: ${post.wordpressUrl}
- Close: End with a Socratic question for the reader to reflect on. Then add: "Hit reply and tell me what you think." 
- CTA: One final line pointing to the Academy or the Presence Assessment — NOT a Substack paid upgrade.
- Do NOT include: newsletter-native language like "this week's issue," "subscribe," or "paid tier"

Return a JSON object with:
{
  "title": "Subject line for the email (compelling, personal, not clickbait)",
  "subtitle": "One sentence deck/subtitle (optional but recommended)",
  "bodyHtml": "Full HTML body of the letter using <p>, <strong>, <em>, <a href='...'> tags only"
}`;

  // ─── 2. Medium Article ─────────────────────────────────────────────────────
  const mediumPrompt = `The following is a published blog post from theurbanmonk.com. Your job is to adapt it for Medium — a platform where readers do NOT know who Pedram Shojai is.

WORDPRESS POST TITLE: ${post.title}
WORDPRESS POST URL: ${post.wordpressUrl}
META DESCRIPTION: ${post.metaDescription ?? "not specified"}

ARTICLE CONTENT:
${truncatedText}

Adapt this article for Medium with these requirements:
- Length: 1,200–1,800 words
- Opening paragraph: Must stand completely alone for a cold reader. Do NOT assume they know Pedram. Open with the problem or insight, not with who Pedram is.
- Introduce Pedram briefly in paragraph 2 or 3: "Dr. Pedram Shojai, a Doctor of Oriental Medicine and New York Times bestselling author, has spent 20 years..."
- Body: Keep the core science and insights from the original. You may restructure for Medium's reading style (shorter paragraphs, subheadings).
- Remove all newsletter-native language ("this week," "subscribe," "our community," etc.)
- Closing CTA: End with: "Dr. Pedram Shojai publishes a weekly letter on gut health, energy, and reclaiming your biology. You can find him at [The Urban Monk on Substack](${post.wordpressUrl.replace("theurbanmonk.com", "substack.theurbanmonk.com") || "https://theurbanmonk.com"})"
- Note: The canonical URL will be set to ${post.wordpressUrl} — you do not need to include this in the text.

Return a JSON object with:
{
  "title": "Medium headline (can differ slightly from WordPress title for Medium's audience)",
  "bodyMarkdown": "Full article in Markdown format with ## subheadings, **bold**, and [links](url)"
}`;

  // ─── 3. Quora Answer ───────────────────────────────────────────────────────
  const quoraPrompt = `The following is a published blog post from theurbanmonk.com. Your job is to write a fresh Quora answer based on the same knowledge — NOT a copy of the article.

WORDPRESS POST TITLE: ${post.title}
FOCUS KEYWORD: ${post.focusKeyword ?? "not specified"}

ARTICLE CONTENT (for reference only — do NOT copy-paste):
${truncatedText}

Write a Quora expert answer with these requirements:
- First: Identify the single most relevant Quora question this article answers. It should be a question real people search for (e.g. "Why am I always tired no matter how much I sleep?"). Write this as the "targetQuestion" field.
- Length: 350–550 words
- Tone: Direct, expert, first-person. Pedram is answering as a clinician who has seen this pattern hundreds of times.
- Opening: Answer the question directly in the first sentence. Do NOT start with "Great question" or any filler.
- Body: Explain the mechanism in plain language. Use one specific clinical example or data point. 
- Do NOT include any promotional links in the body text.
- Do NOT copy-paste sentences from the article — this must be original writing.
- Close: End with a thought-provoking statement that leaves the reader wanting to know more.

Return a JSON object with:
{
  "targetQuestion": "The exact Quora question to search for and answer",
  "answerMarkdown": "Full answer in Markdown format (no links, no promotion)"
}`;

  // ─── 4. Reddit Post ────────────────────────────────────────────────────────
  const redditPrompt = `The following is a published blog post from theurbanmonk.com. Your job is to write a Reddit post that shares the core insight from this article in Reddit's native community style.

WORDPRESS POST TITLE: ${post.title}
WORDPRESS POST URL: ${post.wordpressUrl}
FOCUS KEYWORD: ${post.focusKeyword ?? "not specified"}

ARTICLE CONTENT (for reference):
${truncatedText}

Write a Reddit post with these requirements:
- Suggest 2–3 specific subreddits that would be most receptive to this content (e.g. r/Microbiome, r/Nootropics, r/Biohackers, r/Supplements, r/Health, r/Meditation, r/Longevity, r/Fitness, r/Anxiety, r/ChronicIllness). Choose based on the article topic.
- Post title: Compelling, curiosity-driven, NOT promotional. Reddit rewards genuine sharing, not marketing headlines. 80 chars max.
- Post body: 200–350 words. Written in first-person as someone who discovered something interesting and wants to share it. NOT as a brand or marketer.
  - Open with a personal observation or question
  - Share the core insight in plain, peer-to-peer language
  - End with a question to invite discussion
  - Last line: "Full article with sources: [link]" — this is where the WordPress URL goes
- Tone: Conversational, curious, humble. Reddit users are smart and will downvote anything that feels like an ad.
- Do NOT use marketing language, superlatives, or brand names in the title.

Return a JSON object with:
{
  "suggestedSubreddits": ["r/SubredditName1", "r/SubredditName2", "r/SubredditName3"],
  "postTitle": "The Reddit post title",
  "postBody": "The full post body in plain Reddit markdown"
}`;

  // Run all four adaptations in parallel
  const [substackRaw, mediumRaw, quoraRaw, redditRaw] = await Promise.all([
    invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: substackPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "substack_letter",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              bodyHtml: { type: "string" },
            },
            required: ["title", "subtitle", "bodyHtml"],
            additionalProperties: false,
          },
        },
      },
    }),
    invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: mediumPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "medium_article",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              bodyMarkdown: { type: "string" },
            },
            required: ["title", "bodyMarkdown"],
            additionalProperties: false,
          },
        },
      },
    }),
    invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: quoraPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "quora_answer",
          strict: true,
          schema: {
            type: "object",
            properties: {
              targetQuestion: { type: "string" },
              answerMarkdown: { type: "string" },
            },
            required: ["targetQuestion", "answerMarkdown"],
            additionalProperties: false,
          },
        },
      },
    }),
    invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: redditPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reddit_post",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestedSubreddits: {
                type: "array",
                items: { type: "string" },
              },
              postTitle: { type: "string" },
              postBody: { type: "string" },
            },
            required: ["suggestedSubreddits", "postTitle", "postBody"],
            additionalProperties: false,
          },
        },
      },
    }),
  ]);

  const parseContent = (raw: unknown, label: string) => {
    const r = raw as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = r?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error(`LLM returned no content for ${label}`);
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`LLM returned invalid JSON for ${label}: ${content.slice(0, 200)}`);
    }
  };

  const substackData = parseContent(substackRaw, "substack");
  const mediumData = parseContent(mediumRaw, "medium");
  const quoraData = parseContent(quoraRaw, "quora");
  const redditData = parseContent(redditRaw, "reddit");

  return {
    substack: {
      title: substackData.title,
      subtitle: substackData.subtitle,
      bodyHtml: substackData.bodyHtml,
    },
    medium: {
      title: mediumData.title,
      bodyMarkdown: mediumData.bodyMarkdown,
      canonicalUrl: post.wordpressUrl,
    },
    quora: {
      targetQuestion: quoraData.targetQuestion,
      answerMarkdown: quoraData.answerMarkdown,
    },
    reddit: {
      suggestedSubreddits: redditData.suggestedSubreddits,
      postTitle: redditData.postTitle,
      postBody: redditData.postBody,
      sourceLink: post.wordpressUrl,
    },
  };
}
