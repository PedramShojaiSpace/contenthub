/**
 * B-roll Prompt Generator
 * Generates Underlord AI prompts for Descript that instruct it to:
 * - Apply Pedram's AI voice clone
 * - Add B-roll based on script content
 * - Apply Studio Sound, captions, and cleanup
 */

import { invokeLLM } from "./_core/llm";

export interface BrollPromptResult {
  underlordPrompt: string;
  sceneDirections: string[];
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
}

export async function generateBrollPrompt(params: {
  scriptTitle: string;
  scriptText: string;
  topic: string;
  keywords?: string[];
}): Promise<BrollPromptResult> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a video production director for The Urban Monk (Dr. Pedram Shojai). 
You create Descript Underlord AI prompts that produce professional YouTube videos.
The channel focuses on health, wellness, Taoist medicine, gut health, energy, longevity, and mindfulness.
Pedram's voice is calm, authoritative, and educational. Videos are 8-15 minutes long.
Always output valid JSON matching the requested schema.`,
      },
      {
        role: "user",
        content: `Generate a Descript Underlord prompt and YouTube metadata for this script.

TITLE: ${params.scriptTitle}
TOPIC: ${params.topic}
KEYWORDS: ${(params.keywords ?? []).join(", ")}

SCRIPT (first 2000 chars):
${params.scriptText.substring(0, 2000)}

Return JSON with this exact structure:
{
  "underlordPrompt": "A single detailed natural language prompt for Descript Underlord that instructs it to: (1) generate voiceover using Pedram's AI voice, (2) apply Studio Sound enhancement, (3) remove filler words and long pauses, (4) add auto-captions, (5) insert HEAVY B-roll from the stock library — CRITICAL: cut to a new B-roll clip every 5 to 12 seconds throughout the ENTIRE video with NO exceptions, never linger on a single shot longer than 12 seconds, use a high density of B-roll cuts to maintain visual momentum, describe exactly what B-roll to use at each specific moment in the script",
  "sceneDirections": ["array of 10-15 specific B-roll direction strings with timestamps, e.g. 'At 0:00-0:10 show aerial nature footage; at 0:10-0:20 cut to close-up of person meditating' — every direction must specify a short 5-12 second clip with a clear cut to the next shot"],
  "youtubeTitle": "SEO-optimized YouTube title under 60 chars",
  "youtubeDescription": "YouTube description 150-200 words with timestamps placeholder, key points, and CTA to Urban Monk Academy",
  "youtubeTags": ["array", "of", "10-15", "relevant", "tags"]
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
          },
          required: ["underlordPrompt", "sceneDirections", "youtubeTitle", "youtubeDescription", "youtubeTags"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No response from LLM for B-roll prompt generation");
  
  return JSON.parse(content) as BrollPromptResult;
}
