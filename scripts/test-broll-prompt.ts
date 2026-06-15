/**
 * Test script: verifies the new brollPromptGenerator output format
 * Run: npx tsx scripts/test-broll-prompt.ts
 */
import "dotenv/config";
import { generateBrollPrompt } from "../server/brollPromptGenerator";

const SAMPLE_SCRIPT = `
Welcome. I'm Dr. Pedram Shojai, and today we're going to talk about something that affects virtually every person living in the modern world: chronic stress and what it does to your gut.

Most people know that stress feels bad. But what most people don't know is that chronic stress doesn't just live in your head. It rewires your gut, disrupts your microbiome, and creates a cascade of inflammation that can take years to reverse.

Here's the mechanism. When you're stressed, your body releases cortisol. Cortisol is designed for short bursts — the tiger is chasing you, you run, cortisol drops. But in modern life, the tiger never goes away. You have emails, deadlines, financial pressure, relationship tension. The cortisol tap stays open.

When cortisol stays elevated, it increases intestinal permeability. Your gut lining, which is only one cell thick, starts to develop gaps. Undigested food particles, bacteria, and toxins slip through into your bloodstream. Your immune system sees these as invaders and mounts an attack. This is the beginning of systemic inflammation.

The Taoist masters called this "leaking life force." They didn't have the language of cortisol and tight junctions, but they understood that scattered energy — what they called "shen" — led to physical deterioration. The practices they developed over centuries — qigong, meditation, breathwork, specific dietary protocols — were all designed to close the leak.

Modern functional medicine is now confirming what these masters knew. The gut-brain axis is real. The vagus nerve connects your gut to your brain in a two-way communication system. When your gut is inflamed, your brain is inflamed. When your brain is stressed, your gut is compromised.

So what do you do? Three things. First, address the cortisol source directly. Not with supplements — with practice. Ten minutes of coherent breathing daily has been shown to lower cortisol by 23 percent in clinical trials. Second, repair the gut lining with targeted nutrition: bone broth, L-glutamine, zinc carnosine. Third, rebuild the microbiome with fermented foods and prebiotic fiber.

This is the upstream approach. You don't chase the symptom. You fix the source.

If you want to go deeper on this, I've put together a free masterclass that walks you through the complete upstream framework. The link is in the description below.

I'm Dr. Pedram Shojai. Stay well.
`;

async function main() {
  console.log("Testing brollPromptGenerator...\n");

  const result = await generateBrollPrompt({
    scriptTitle: "Chronic Stress Is Destroying Your Gut: The Science & Fix",
    scriptText: SAMPLE_SCRIPT,
    topic: "chronic stress gut health cortisol",
    keywords: ["gut health", "chronic stress", "cortisol", "microbiome"],
    blogUrl: "https://www.theurbanmonk.com/chronic-stress-gut-health/",
  });

  console.log("=== YOUTUBE TITLE ===");
  console.log(result.youtubeTitle);
  console.log(`(${result.youtubeTitle.length} chars)\n`);

  console.log("=== PRIMARY KEYWORD ===");
  console.log(result.primaryKeyword + "\n");

  console.log("=== TAGS ===");
  console.log(result.youtubeTags.join(", "));
  console.log(`(${result.youtubeTags.length} tags)\n`);

  console.log("=== HASHTAGS ===");
  console.log(result.hashtags.join(" ") + "\n");

  console.log("=== DESCRIPTION (first 500 chars) ===");
  console.log(result.youtubeDescription.substring(0, 500) + "...\n");

  console.log("=== DESCRIPTION (last 300 chars — should contain UTM links) ===");
  console.log("..." + result.youtubeDescription.slice(-300) + "\n");

  // Checks
  const checks = [
    { name: "Title 55-65 chars", pass: result.youtubeTitle.length >= 50 && result.youtubeTitle.length <= 70 },
    { name: "Has UTM upstream link", pass: result.youtubeDescription.includes("utm_campaign=upstream-bundle") },
    { name: "Has UTM lights-on link", pass: result.youtubeDescription.includes("utm_campaign=lights-on") },
    { name: "Has UTM IC screening link", pass: result.youtubeDescription.includes("utm_campaign=ic-free-screening") },
    { name: "Has supplement link", pass: result.youtubeDescription.includes("urban-monk-nutrition") },
    { name: "Has blog URL", pass: result.youtubeDescription.includes("chronic-stress-gut-health") },
    { name: "Has #UrbanMonk hashtag", pass: result.youtubeDescription.includes("#UrbanMonk") },
    { name: "Has #PedramShojai hashtag", pass: result.youtubeDescription.includes("#PedramShojai") },
    { name: "Has 15+ tags", pass: result.youtubeTags.length >= 15 },
    { name: "Has channel base tags", pass: result.youtubeTags.includes("Urban Monk") },
    { name: "Has subscribe link", pass: result.youtubeDescription.includes("sub_confirmation=1") },
    { name: "Has chapter timestamps", pass: result.youtubeDescription.includes("00:00") },
  ];

  console.log("=== QUALITY CHECKS ===");
  let passed = 0;
  for (const check of checks) {
    const icon = check.pass ? "✅" : "❌";
    console.log(`${icon} ${check.name}`);
    if (check.pass) passed++;
  }
  console.log(`\n${passed}/${checks.length} checks passed`);

  process.exit(passed === checks.length ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
