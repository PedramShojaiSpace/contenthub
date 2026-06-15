/**
 * Test the B-roll prompt generator directly to see if Anthropic API is working
 */
import { generateBrollPrompt } from "../server/brollPromptGenerator";

async function test() {
  console.log("Testing B-roll prompt generator...");
  try {
    const result = await generateBrollPrompt({
      scriptTitle: "100-Day Goal Setting: Ancient Wisdom to Master Your Life",
      scriptText: "Today we're talking about goal setting using ancient wisdom from Taoist and Buddhist traditions. The 100-day practice is a powerful framework for transformation.",
      topic: "Goal Setting",
      keywords: ["goal setting", "ancient wisdom", "100 days"],
    });
    console.log("✅ B-roll prompt generated successfully");
    console.log("  YouTube title:", result.youtubeTitle);
    console.log("  Underlord prompt (first 100 chars):", result.underlordPrompt?.slice(0, 100));
  } catch (err) {
    console.log("❌ B-roll generator failed:", err);
    
    // Also test raw Anthropic API
    console.log("\nTesting raw Anthropic API...");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 50,
          messages: [{ role: "user", content: "Say hello" }],
        }),
      });
      const body = await res.json() as any;
      if (res.ok) {
        console.log("✅ Anthropic API works:", body.content?.[0]?.text);
      } else {
        console.log("❌ Anthropic API error:", res.status, JSON.stringify(body));
      }
    } catch (e) {
      console.log("❌ Anthropic API fetch failed:", e);
    }
    
    // Test the built-in LLM instead
    console.log("\nTesting built-in LLM (BUILT_IN_FORGE_API)...");
    try {
      const res = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 50,
          messages: [{ role: "user", content: "Say hello" }],
        }),
      });
      const body = await res.json() as any;
      if (res.ok) {
        console.log("✅ Built-in LLM works:", body.choices?.[0]?.message?.content);
      } else {
        console.log("❌ Built-in LLM error:", res.status, JSON.stringify(body));
      }
    } catch (e) {
      console.log("❌ Built-in LLM fetch failed:", e);
    }
  }
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
