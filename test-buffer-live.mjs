/**
 * Live diagnostic: sends a test post to Buffer using the exact v137 mutation format.
 * Uses the real LinkedIn channel ID and a known-good article URL.
 * Run: node test-buffer-live.mjs
 */
import "dotenv/config";

const BUFFER_GQL_ENDPOINT = "https://api.buffer.com";
const LINKEDIN_CHANNEL_ID = "668e9375602872be45f64bb6"; // pedramshojai LinkedIn
const TOKEN = process.env.BUFFER_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("BUFFER_ACCESS_TOKEN not set");
  process.exit(1);
}

// Use a real article URL from the DB (medicalxpress.com - ID 150001)
const articleUrl = "https://medicalxpress.com/news/2026-04-statement-highlights-brain-health-lifetime.html";
const postText = `Brain health is shaped across a lifetime — not just in old age. This is a test post from the Urban Monk Content Hub diagnostic tool.\n\n${articleUrl}`;

console.log("=== Testing Buffer push with v137 format ===");
console.log("Article URL:", articleUrl);
console.log("Post text length:", postText.length);
console.log("");

// Test 1: v137 format — imageUrl in assets + linkAttachment in metadata (no guard)
const mutation1 = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(postText)},
      channelId: "${LINKEDIN_CHANNEL_ID}",
      schedulingType: automatic,
      mode: addToQueue,
      metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(articleUrl)} } } }
    }) {
      ... on PostActionSuccess {
        post {
          id
          text
          dueAt
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

console.log("Sending mutation (no image, just linkAttachment)...");
const res1 = await fetch(BUFFER_GQL_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({ query: mutation1 }),
});
const json1 = await res1.json();
console.log("HTTP status:", res1.status);
console.log("Response:", JSON.stringify(json1, null, 2));
