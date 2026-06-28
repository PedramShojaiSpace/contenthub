/**
 * Generate and publish the Gut Health pillar page to WordPress
 * Uses the server's built-in invokeLLM helper (routes through platform API)
 */
import { invokeLLM } from "./server/_core/llm.js";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";

const WP_URL = process.env.WORDPRESS_URL!;
const WP_USER = process.env.WORDPRESS_USERNAME!;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD!;

function wpPost(path: string, data: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
    const body = JSON.stringify(data);
    const url = new URL(`${WP_URL}/wp-json/wp/v2/${path}`);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const GUT_HEALTH_PROMPT = `You are Dr. Pedram Shojai (The Urban Monk), a Doctor of Oriental Medicine, Qigong master, and New York Times bestselling author. Write a comprehensive, authoritative pillar page for the keyword "gut health" targeting the Urban Monk Academy audience.

REQUIREMENTS:
- 3,500-4,500 words
- Format as clean HTML (h2, h3, p, ul, ol tags only — no divs, no classes)
- Tone: warm, authoritative, first-person, integrative medicine perspective
- Include these sections:
  1. Opening hook (personal story or patient case)
  2. What Is Gut Health? (definition, why it matters)
  3. The Gut-Brain Connection (your specialty — vagus nerve, microbiome-mood link)
  4. Signs Your Gut Health Is Compromised (symptoms list)
  5. The Root Causes of Poor Gut Health (stress, diet, antibiotics, toxins, sleep)
  6. The Urban Monk Approach to Gut Healing (Daoist principles + functional medicine)
  7. 7 Evidence-Based Strategies to Improve Gut Health Naturally
  8. The Role of Probiotics, Prebiotics, and Fermented Foods
  9. Gut Health and Longevity (connection to aging, inflammation, chronic disease)
  10. When to Seek Help (functional medicine vs. conventional)
  11. Conclusion with CTA to Urban Monk Academy

- Weave in references to your books (The Urban Monk, Exhausted, Grow a Pair) naturally
- Include a CTA near the end: "Ready to take control of your gut health? Join thousands of members inside the Urban Monk Academy at theurbanmonkacademy.com"
- Do NOT include any markdown — pure HTML only
- Start directly with <h1>The Urban Monk's Complete Guide to Gut Health</h1>`;

const SLEEP_PROMPT = `You are Dr. Pedram Shojai (The Urban Monk), a Doctor of Oriental Medicine, Qigong master, and New York Times bestselling author. Write a comprehensive, authoritative pillar page for the keyword "sleep optimization" targeting the Urban Monk Academy audience.

REQUIREMENTS:
- 3,500-4,500 words
- Format as clean HTML (h2, h3, p, ul, ol tags only — no divs, no classes)
- Tone: warm, authoritative, first-person, integrative medicine perspective
- Include these sections:
  1. Opening hook (personal story about sleep deprivation and its effects)
  2. What Is Sleep Optimization? (definition, why it matters for modern life)
  3. The Science of Sleep (circadian rhythm, sleep stages, what happens during deep sleep)
  4. Signs Your Sleep Is Not Optimized (symptoms list)
  5. The Root Causes of Poor Sleep (blue light, cortisol, EMF, stress, diet)
  6. The Urban Monk Approach to Sleep (Daoist principles + functional medicine)
  7. 7 Evidence-Based Sleep Optimization Strategies
  8. The Role of Melatonin, Adaptogens, and Sleep Supplements
  9. Sleep and Longevity (connection to aging, immune function, cognitive decline)
  10. Sleep Tracking and Biohacking for Better Rest
  11. Conclusion with CTA to Urban Monk Academy

- Weave in references to your books (The Urban Monk, Exhausted) naturally
- Include a CTA near the end: "Ready to optimize your sleep and transform your health? Join thousands of members inside the Urban Monk Academy at theurbanmonkacademy.com"
- Do NOT include any markdown — pure HTML only
- Start directly with <h1>Sleep Optimization: The Urban Monk's Complete Guide</h1>`;

async function generateAndPublish(
  prompt: string,
  title: string,
  slug: string,
  focusKw: string,
  seoTitle: string,
  metaDesc: string
) {
  console.log(`\nGenerating: ${title}...`);
  
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are Dr. Pedram Shojai, The Urban Monk. Write comprehensive, authoritative health content in first person." },
      { role: "user", content: prompt }
    ]
  });
  
  const content = (response as any).choices?.[0]?.message?.content;
  if (!content) {
    console.error("No content returned:", JSON.stringify(response).slice(0, 200));
    return;
  }
  
  console.log(`Generated ${content.length} chars`);
  
  // Save locally as backup
  fs.writeFileSync(`/tmp/${slug}.html`, content);
  console.log(`Saved to /tmp/${slug}.html`);
  
  // Publish to WordPress
  console.log("Publishing to WordPress...");
  const result = await wpPost("posts", {
    title,
    content,
    status: "publish",
    slug,
    meta: {
      _yoast_wpseo_focuskw: focusKw,
      _yoast_wpseo_title: seoTitle,
      _yoast_wpseo_metadesc: metaDesc,
    }
  });
  
  if (result.id) {
    console.log(`✓ Published! ID: ${result.id} URL: ${result.link}`);
    return result;
  } else {
    console.error("Publish error:", result.message || JSON.stringify(result).slice(0, 300));
  }
}

async function main() {
  // Generate gut health pillar page
  const gutResult = await generateAndPublish(
    GUT_HEALTH_PROMPT,
    "The Urban Monk's Complete Guide to Gut Health",
    "gut-health-complete-guide",
    "gut health",
    "Gut Health: The Urban Monk's Complete Guide | Dr. Pedram Shojai",
    "Dr. Pedram Shojai's complete guide to gut health: heal your microbiome, restore the gut-brain connection, and reclaim your vitality with integrative medicine."
  );
  
  if (gutResult) {
    console.log("\nGut health pillar published:", gutResult.link);
  }
  
  // Generate sleep optimization pillar page
  const sleepResult = await generateAndPublish(
    SLEEP_PROMPT,
    "Sleep Optimization: The Urban Monk's Complete Guide",
    "sleep-optimization-complete-guide",
    "sleep optimization",
    "Sleep Optimization: The Urban Monk's Complete Guide | Dr. Pedram Shojai",
    "Dr. Pedram Shojai's complete guide to sleep optimization: restore your circadian rhythm, deepen your sleep, and wake up energized with ancient wisdom and modern science."
  );
  
  if (sleepResult) {
    console.log("\nSleep optimization pillar published:", sleepResult.link);
  }
  
  console.log("\nDone!");
}

main().catch(console.error);
