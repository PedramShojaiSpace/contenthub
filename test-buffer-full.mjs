/**
 * test-buffer-full.mjs
 * Full end-to-end simulation of newsfeedRouter.pushToBuffer
 * Shows EXACTLY what mutation is sent to Buffer and what response comes back.
 */

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const ORG_ID = "6577bd3c147566efe2fa9201";

async function bufferGql(query, variables = {}) {
  console.log("\n=== MUTATION BEING SENT TO BUFFER ===");
  console.log(query.trim());
  console.log("=== VARIABLES ===", JSON.stringify(variables));
  
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BUFFER_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  console.log("\n=== BUFFER RESPONSE ===");
  console.log(JSON.stringify(json, null, 2));
  return json;
}

// Step 1: Get channels
const channelsRes = await bufferGql(`
  query GetChannels($orgId: OrganizationId!) {
    channels(input: { organizationId: $orgId }) {
      id service name
    }
  }
`, { orgId: ORG_ID });

const channels = channelsRes.data?.channels ?? [];
const linkedInChannels = channels.filter(c => c.service === "linkedin");
console.log("\nLinkedIn channels:", linkedInChannels);

if (!linkedInChannels.length) { console.error("No LinkedIn!"); process.exit(1); }

const channelId = linkedInChannels[0].id;
const channelService = "linkedin"; // from service map

// Step 2: Build the exact mutation the router builds
const articleUrl = "https://www.healthline.com/nutrition/gut-microbiome-and-health";
const commentary = `I came across this piece in Healthline that stopped me in my tracks.

The gut microbiome influences far more than digestion — mood, immunity, metabolic function, stress response.

In my clinical work, patients come in with anxiety, brain fog, low resilience — and the gut is almost always part of the story.

#GutHealth #Microbiome #IntegrativeMedicine #UrbanMonk`;

// Strip URL from commentary (same logic as router)
const cleanCommentary = commentary
  .split(`Read more: ${articleUrl}`).join('')
  .split(`Read more:${articleUrl}`).join('')
  .split(articleUrl).join('')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const postText = `${cleanCommentary}\n\n${articleUrl}`;
const imageUrl = undefined; // no custom image
const linkAsset = { url: articleUrl };

console.log("\n=== POST TEXT ===");
console.log(postText);
console.log("\n=== URL in postText:", postText.includes(articleUrl));

// Build assets fragment (same logic as buffer.ts)
const isLinkedInWithLink = channelService === "linkedin" && !!linkAsset;
let assetsInner = "";
if (imageUrl && !isLinkedInWithLink) {
  assetsInner += `images: [{ url: ${JSON.stringify(imageUrl)} }]`;
}
const assetsFragment = assetsInner ? `, assets: { ${assetsInner} }` : "";

// Build metadata fragment (same logic as buffer.ts)
let metadataFragment = "";
if (channelService === "linkedin" && linkAsset) {
  metadataFragment = `, metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(linkAsset.url)} } } }`;
}

console.log("\n=== assetsFragment:", assetsFragment || "(empty)");
console.log("=== metadataFragment:", metadataFragment || "(empty)");

const mode = "addToQueue";

const mutation = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(postText)},
      channelId: "${channelId}",
      schedulingType: automatic,
      mode: ${mode}${assetsFragment}${metadataFragment}
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

// Step 3: Fire it as a DRAFT to avoid polluting the queue
const draftMutation = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(postText)},
      channelId: "${channelId}",
      schedulingType: automatic,
      mode: addToQueue,
      status: "draft"${assetsFragment}${metadataFragment}
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

await bufferGql(draftMutation);
