/**
 * videoSocialPoster.ts
 *
 * Generates platform-specific social captions for a video job and
 * posts them to the appropriate Buffer channels via Buffer GraphQL API.
 *
 * Called by uploadWorker.ts after a successful YouTube upload.
 *
 * Connected Buffer channels (Urban Monk Productions):
 *   facebook  → 6585ac6e30da3c08a74a1ded  (The Urban Monk page)
 *   instagram → 6585add230da3c08a756bee6  (drpedramshojai — main)
 *   twitter   → 6585ade330da3c08a75766cb  (PedramShojai)
 *   tiktok    → 6585ae1230da3c08a758a498  (drpedramshojai)
 *   youtube   → 6585ae8030da3c08a75d6bc6  (The Urban Monk — handled separately)
 *   linkedin  → 668e9375602872be45f64bb6  (pedramshojai)
 *
 * Output channel → Buffer service mapping:
 *   "meta"      → facebook page
 *   "instagram" → instagram main account
 *   "x"         → twitter
 *   "tiktok"    → tiktok
 */

import { invokeLLM } from "./_core/llm";
import { pushToBuffer } from "./buffer";

// ─── Channel ID constants ─────────────────────────────────────────────────────
const BUFFER_CHANNELS: Record<string, { id: string; service: string; name: string }> = {
  facebook: { id: "6585ac6e30da3c08a74a1ded", service: "facebook", name: "The Urban Monk (FB Page)" },
  instagram: { id: "6585add230da3c08a756bee6", service: "instagram", name: "drpedramshojai" },
  twitter:   { id: "6585ade330da3c08a75766cb", service: "twitter",   name: "PedramShojai" },
  tiktok:    { id: "6585ae1230da3c08a758a498", service: "tiktok",    name: "drpedramshojai (TikTok)" },
};

// Map from outputChannels value → Buffer service key
const CHANNEL_TO_SERVICE: Record<string, string> = {
  meta:      "facebook",
  instagram: "instagram",
  x:         "twitter",
  tiktok:    "tiktok",
};

export type SocialPostResult = {
  channel: string;
  service: string;
  success: boolean;
  bufferId?: string;
  dueAt?: string;
  error?: string;
};

/**
 * Generate platform-specific social captions for a video using the LLM.
 */
async function generateSocialCaptions(params: {
  title: string;
  description: string;
  youtubeUrl: string;
  channels: string[];
}): Promise<Record<string, string>> {
  const channelList = params.channels.join(", ");

  const prompt = `You are the social media voice for Dr. Pedram Shojai, OMD — The Urban Monk.
Write platform-specific social media captions for this YouTube video.

VIDEO TITLE: ${params.title}
YOUTUBE URL: ${params.youtubeUrl}
CHANNELS NEEDED: ${channelList}

BRAND VOICE: Wise, direct, no-fluff. Speaks to high-performers who want real results. 
Blends ancient wisdom with modern science. Never preachy. Calls out the real problem.

Write a caption for each requested channel. Return JSON with these keys (only include requested channels):
- "meta": Facebook caption (150-300 words, include the YouTube URL, 3-5 hashtags, conversational tone)
- "instagram": Instagram caption (100-200 words, NO URLs in caption — say "link in bio", 5-8 hashtags, hook-first)
- "x": Twitter/X post (max 240 chars including URL, punchy one-liner + URL)
- "tiktok": TikTok caption (50-100 words, hook-first, 3-5 trending hashtags, call to action)

For all captions:
- Start with a strong hook that calls out the problem or creates curiosity
- Reference Dr. Pedram Shojai or The Urban Monk naturally
- End with a clear call to action
- The YouTube URL is: ${params.youtubeUrl}

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a social media expert for The Urban Monk brand. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_captions",
        strict: false,
        schema: {
          type: "object",
          properties: {
            meta:      { type: "string" },
            instagram: { type: "string" },
            x:         { type: "string" },
            tiktok:    { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content ?? "{}";
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  try {
    return JSON.parse(content) as Record<string, string>;
  } catch {
    console.error("[videoSocialPoster] Failed to parse LLM caption JSON:", content.slice(0, 200));
    return {};
  }
}

/**
 * Post a video job to all selected social channels via Buffer.
 * Called after a successful YouTube upload.
 *
 * @param jobId - The video job ID (for logging)
 * @param title - YouTube video title
 * @param description - YouTube video description (used for context)
 * @param youtubeVideoId - YouTube video ID (to build the URL)
 * @param outputChannels - Array of selected channels: ["tiktok", "meta", "instagram", "x"]
 * @param log - Logger function from the upload worker
 * @returns Array of per-channel results
 */
export async function postVideoToSocialChannels(params: {
  jobId: number;
  title: string;
  description: string;
  youtubeVideoId: string;
  outputChannels: string[];
  log: (msg: string) => void;
}): Promise<SocialPostResult[]> {
  const { jobId, title, description, youtubeVideoId, outputChannels, log } = params;

  // Filter to only social channels (exclude youtube — that's handled by the upload worker directly)
  const socialChannels = outputChannels.filter(ch => ch !== "youtube");

  if (!socialChannels.length) {
    log(`[Social] No social channels selected — skipping social posting.`);
    return [];
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  log(`[Social] Posting to channels: ${socialChannels.join(", ")}`);

  // ── Step 1: Generate captions ──────────────────────────────────────────────
  log(`[Social] Generating platform-specific captions via LLM...`);
  let captions: Record<string, string> = {};
  try {
    captions = await generateSocialCaptions({
      title,
      description,
      youtubeUrl,
      channels: socialChannels,
    });
    log(`[Social] Captions generated for: ${Object.keys(captions).join(", ")}`);
  } catch (err) {
    log(`[Social] ⚠️ Caption generation failed: ${err}. Will use fallback captions.`);
  }

  // ── Step 2: Post to each channel ───────────────────────────────────────────
  const results: SocialPostResult[] = [];

  for (const channel of socialChannels) {
    const serviceKey = CHANNEL_TO_SERVICE[channel];
    if (!serviceKey) {
      log(`[Social] ⚠️ Unknown channel "${channel}" — skipping.`);
      results.push({ channel, service: channel, success: false, error: `Unknown channel: ${channel}` });
      continue;
    }

    const bufferChannel = BUFFER_CHANNELS[serviceKey];
    if (!bufferChannel) {
      log(`[Social] ⚠️ No Buffer channel configured for "${serviceKey}" — skipping.`);
      results.push({ channel, service: serviceKey, success: false, error: `No Buffer channel for ${serviceKey}` });
      continue;
    }

    // Get caption for this channel (fall back to a simple default if LLM failed)
    let caption = captions[channel];
    if (!caption) {
      // Fallback caption
      if (channel === "x") {
        caption = `${title.substring(0, 200)} ${youtubeUrl}`;
      } else if (channel === "instagram") {
        caption = `${title}\n\nWatch the full video — link in bio.\n\n#UrbanMonk #DrPedramShojai #Wellness`;
      } else {
        caption = `${title}\n\nWatch now: ${youtubeUrl}\n\n#UrbanMonk #DrPedramShojai #Wellness`;
      }
      log(`[Social] Using fallback caption for ${channel}.`);
    }

    log(`[Social] Posting to ${bufferChannel.name} (${serviceKey})...`);

    try {
      const result = await pushToBuffer({
        text: caption,
        profileIds: [bufferChannel.id],
        platform: serviceKey === "twitter" ? "x" : serviceKey,
        metaPostType: "post",
        channelServiceMap: { [bufferChannel.id]: bufferChannel.service },
        // Instagram: CTA URL goes in first comment (not caption)
        ctaUrl: channel === "instagram" ? youtubeUrl : undefined,
      });

      if (result.success) {
        log(`[Social] ✅ ${bufferChannel.name}: queued in Buffer (ID: ${result.bufferId}, due: ${result.dueAt ?? "next slot"})`);
        results.push({
          channel,
          service: serviceKey,
          success: true,
          bufferId: result.bufferId,
          dueAt: result.dueAt,
        });
      } else {
        log(`[Social] ❌ ${bufferChannel.name}: ${result.error}`);
        results.push({ channel, service: serviceKey, success: false, error: result.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[Social] ❌ ${bufferChannel.name} error: ${msg}`);
      results.push({ channel, service: serviceKey, success: false, error: msg });
    }
  }

  const successCount = results.filter(r => r.success).length;
  log(`[Social] Done. ${successCount}/${results.length} channels queued successfully.`);
  return results;
}
