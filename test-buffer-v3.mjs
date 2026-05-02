/**
 * test-buffer-v3.mjs
 * Fires the exact same logic as newsfeedRouter.pushToBuffer
 * and logs the exact postText sent to Buffer.
 */

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;

async function bufferGql(query, variables = {}) {
  const res = await fetch("https://api.bufferapp.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BUFFER_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// Step 1: Get LinkedIn channel IDs
const channelsRes = await bufferGql(`
  query GetChannels {
    channels {
      id
      name
      service
      serviceType
    }
  }
`);

const channels = channelsRes.data?.channels ?? [];
const linkedInChannels = channels.filter(c => c.service === "linkedin");
console.log("LinkedIn channels:", linkedInChannels.map(c => ({ id: c.id, name: c.name })));

if (linkedInChannels.length === 0) {
  console.error("No LinkedIn channels found!");
  process.exit(1);
}

// Step 2: Simulate the exact postText construction
const articleUrl = "https://www.healthline.com/nutrition/gut-microbiome-and-health";
const commentary = `I came across this piece in Healthline that stopped me in my tracks.

We've known for years that the gut microbiome influences digestion. But what this research makes clear is the scope of that influence — we're talking about mood, immunity, metabolic function, even how we respond to stress.

In my clinical work, I've seen this pattern repeatedly. Patients come in with what looks like a mental health issue — anxiety, brain fog, low resilience — and when we look deeper, the gut is almost always part of the story. The ancient traditions knew this. The Taoists called the gut the "second brain" thousands of years before Western science caught up.

Here's the one thing I'd encourage you to do today: eat something fermented. A tablespoon of sauerkraut, a small bowl of miso soup, a few sips of kefir. Not because it's a magic fix, but because it's a signal to your body that you're paying attention. That you're working with your biology, not against it.

If you want to understand what your gut is actually telling you and how to work with it instead of against it, come find us at the Urban Monk Academy.

#GutHealth #Microbiome #IntegrativeMedicine #Longevity #UrbanMonk`;

// Apply the same stripping logic as the router
const cleanCommentary = commentary
  .split(`Read more: ${articleUrl}`).join('')
  .split(`Read more:${articleUrl}`).join('')
  .split(articleUrl).join('')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const postText = `${cleanCommentary}\n\n${articleUrl}`;

console.log("\n=== postText being sent to Buffer ===");
console.log(postText);
console.log("\n=== URL present in postText:", postText.includes(articleUrl));
console.log("=== postText length:", postText.length);

// Step 3: Create the post as a DRAFT (so it doesn't auto-publish)
const channelId = linkedInChannels[0].id;
const createRes = await bufferGql(`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      post {
        id
        text
        status
      }
      errors {
        message
        type
      }
    }
  }
`, {
  input: {
    channelId,
    text: postText,
    status: "draft",
    metadata: {
      linkedin: {
        linkAttachment: {
          url: articleUrl,
        },
      },
    },
  },
});

console.log("\n=== Buffer createPost response ===");
console.log(JSON.stringify(createRes, null, 2));

const post = createRes.data?.createPost?.post;
if (post) {
  console.log("\n=== Post created successfully ===");
  console.log("Post ID:", post.id);
  console.log("Post text:", post.text);
  console.log("URL in post text:", post.text?.includes(articleUrl));
} else {
  console.log("Errors:", createRes.data?.createPost?.errors);
}
