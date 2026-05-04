/**
 * Full diagnostic: replicates the exact pushToBuffer call from newsfeedRouter.ts
 * and logs the mutation string + Buffer response.
 */
import "dotenv/config";

const BUFFER_GQL_ENDPOINT = "https://api.buffer.com";
const TOKEN = process.env.BUFFER_ACCESS_TOKEN;

// Real values from the DB
const LINKEDIN_CHANNEL_ID = "668e9375602872be45f64bb6";
const LINKEDIN_SERVICE = "linkedin";
const ARTICLE_URL = "https://medicalxpress.com/news/2026-04-statement-highlights-brain-health-lifetime.html";
const COMMENTARY = "Brain health is shaped across a lifetime — not just in old age. New research shows that mental health, sleep, environment, lifestyle, and social conditions all powerfully shape how the brain functions and ages. This is a reminder that what we do every day matters deeply.";

// Replicate the exact postText logic from newsfeedRouter.ts
const postText = COMMENTARY
  .split(`Read more: ${ARTICLE_URL}`).join('')
  .split(`Read more:${ARTICLE_URL}`).join('')
  .split(ARTICLE_URL).join('')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

console.log("=== Post text ===");
console.log(postText);
console.log("\n=== Article URL ===");
console.log(ARTICLE_URL);

// Replicate the exact channelServiceMap
const channelServiceMap = { [LINKEDIN_CHANNEL_ID]: LINKEDIN_SERVICE };

// Replicate the exact mutation building from buffer.ts
const channelId = LINKEDIN_CHANNEL_ID;
const channelService = channelServiceMap[channelId]?.toLowerCase() ?? "";
const isLinkedInWithLink = channelService === "linkedin"; // linkAsset is provided

// No imageUrl for this test
const assetsInner = "";
const assetsFragment = assetsInner ? `, assets: { ${assetsInner} }` : "";

// linkAsset
const linkAsset = { url: ARTICLE_URL };
const thumbFragment = linkAsset.thumbnailUrl
  ? `, thumbnailUrl: ${JSON.stringify(linkAsset.thumbnailUrl)}`
  : "";
const metadataFragment = `, metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(linkAsset.url)}${thumbFragment} } } }`;

const mutation = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(postText)},
      channelId: "${channelId}",
      schedulingType: automatic,
      mode: addToQueue${assetsFragment}${metadataFragment}
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

console.log("\n=== Exact mutation being sent ===");
console.log(mutation);

console.log("\n=== Sending to Buffer... ===");
const res = await fetch(BUFFER_GQL_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ query: mutation }),
});
const json = await res.json();
console.log("\n=== Buffer response ===");
console.log(JSON.stringify(json, null, 2));
