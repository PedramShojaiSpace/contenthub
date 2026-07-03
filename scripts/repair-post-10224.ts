/**
 * One-time repair script: regenerate WordPress post 10224 (What is Gut Dysbiosis?)
 * Run with: cd /home/ubuntu/lights-on-optin && npx tsx scripts/repair-post-10224.ts
 */
import "dotenv/config";
import { invokeLLM } from "../server/_core/llm";
import { updateWpPostContent } from "../server/wordpress";

const SYSTEM = `You are Dr. Pedram Shojai, the Urban Monk — a doctor of Oriental Medicine, Taoist abbot, filmmaker, and New York Times bestselling author. Your writing voice is warm, direct, and authoritative. You blend ancient Eastern wisdom with modern science. You use "we" and "you" to connect with readers. You are practical and actionable. You reference Taoist principles and qi naturally. You cite real science to back up ancient wisdom. You end with a call to explore the Urban Monk Academy.`;

const PROMPT = `Write a comprehensive, SEO-optimized WordPress blog post body (NO title H1 — WordPress adds it automatically) titled "What is Gut Dysbiosis? Your Health Guide" for theurbanmonk.com.

The article should be 1,800-2,200 words and cover:
1. Introduction — Hook with brain fog/fatigue/bloating symptoms connected to gut dysbiosis. Mention 70% of immune system lives in the gut.
2. What is Gut Dysbiosis? — Define it. Explain balance between beneficial bacteria (Lactobacillus, Bifidobacterium) and harmful bacteria.
3. Signs and Symptoms — Digestive issues, brain fog, fatigue, skin issues, mood changes, frequent illness. Connect to gut-brain axis.
4. Root Causes — Antibiotics, poor diet, chronic stress (cortisol disrupts microbiome), environmental toxins, lack of sleep.
5. How to Heal Gut Dysbiosis — Dietary changes (fermented foods, fiber, prebiotics), stress management, sleep, targeted probiotics.
6. The Ancient Wisdom Angle — TCM view of digestive system, Spleen/Stomach network, middle burner (Zhong Jiao).
7. Conclusion — Encourage readers to take action. Mention Urban Monk Academy.

Format requirements:
- Use WordPress Gutenberg block HTML format
- Use H2 for main sections, H3 for subsections
- Include this YouTube embed block after the first H2 section:
<!-- wp:embed {"url":"https://www.youtube.com/watch?v=PFAaZMdoE34","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper">
https://www.youtube.com/watch?v=PFAaZMdoE34
</div></figure>
<!-- /wp:embed -->
- Include 2-3 WordPress quote blocks for key insights
- End with a CTA paragraph linking to Urban Monk Academy
- Return ONLY the HTML content, no markdown, no preamble, no title H1`;

async function main() {
  console.log("[Repair] Generating article content via LLM...");
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: PROMPT },
    ],
  });

  const articleHtml = (response.choices?.[0]?.message?.content as string) ?? "";
  if (!articleHtml || articleHtml.length < 500) {
    throw new Error(`LLM returned empty or too-short content (${articleHtml.length} chars)`);
  }

  console.log(`[Repair] Generated ${articleHtml.length} chars of content`);
  console.log("[Repair] Pushing to WordPress post 10224...");

  await updateWpPostContent(10224, articleHtml);
  console.log("[Repair] ✅ Post 10224 restored successfully!");
}

main().catch((err) => {
  console.error("[Repair] ❌ Failed:", err);
  process.exit(1);
});
