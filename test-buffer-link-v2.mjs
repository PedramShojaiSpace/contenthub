/**
 * Diagnostic: fire the exact same mutation as newsfeedRouter.pushToBuffer
 * using a real news article URL, then query the post back to see what Buffer stored.
 */
import { readFileSync } from 'fs';

// Load token from running process env via .env file
const envPath = '/home/ubuntu/lights-on-optin/.env';
let TOKEN = '';
try {
  const env = readFileSync(envPath, 'utf8');
  const match = env.match(/BUFFER_ACCESS_TOKEN=(.+)/);
  if (match) TOKEN = match[1].trim();
} catch {}

if (!TOKEN) {
  // Try to get from process env directly
  TOKEN = process.env.BUFFER_ACCESS_TOKEN || '';
}

if (!TOKEN) {
  console.error('ERROR: BUFFER_ACCESS_TOKEN not found. Run: node -e "console.log(process.env.BUFFER_ACCESS_TOKEN)" from the server process.');
  process.exit(1);
}

const GQL = 'https://api.buffer.com';
const ORG_ID = '6577bd3c147566efe2fa9201';

async function gql(query, variables) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// Step 1: Get LinkedIn channel IDs
console.log('\n=== Step 1: Fetching LinkedIn channels ===');
const channelsResult = await gql(`
  query GetChannels($orgId: OrganizationId!) {
    channels(input: { organizationId: $orgId }) {
      id service name
    }
  }
`, { orgId: ORG_ID });

const channels = channelsResult.data?.channels ?? [];
console.log('All channels:', channels.map(c => `${c.name} (${c.service})`).join(', '));

const linkedInChannels = channels.filter(c => c.service === 'linkedin');
console.log('LinkedIn channels:', linkedInChannels.map(c => `${c.name} (${c.id})`).join(', '));

if (linkedInChannels.length === 0) {
  console.error('No LinkedIn channels found!');
  process.exit(1);
}

// Step 2: Fire the exact mutation with linkAttachment using a real news article URL
const ARTICLE_URL = 'https://www.healthline.com/nutrition/gut-microbiome-and-health';
const ARTICLE_TEXT = `The gut-brain connection is one of the most exciting frontiers in medicine right now. What we're learning is that the 38 trillion microbes living in your gut aren't just digesting food — they're running a parallel operating system that influences your mood, cognition, and immune response. This isn't fringe science anymore. The evidence is compelling and the implications are profound. Read more: ${ARTICLE_URL}`;

const channelId = linkedInChannels[0].id;
console.log(`\n=== Step 2: Creating post on channel ${linkedInChannels[0].name} (${channelId}) ===`);
console.log('Article URL:', ARTICLE_URL);

const mutation = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(ARTICLE_TEXT)},
      channelId: "${channelId}",
      schedulingType: automatic,
      mode: addToQueue,
      metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(ARTICLE_URL)} } } }
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

console.log('\nMutation being sent:');
console.log(mutation);

const createResult = await gql(mutation);
console.log('\nBuffer createPost response:');
console.log(JSON.stringify(createResult, null, 2));

const postId = createResult.data?.createPost?.post?.id;
if (!postId) {
  console.error('Failed to create post:', JSON.stringify(createResult));
  process.exit(1);
}

console.log(`\n=== Step 3: Querying post ${postId} back from Buffer ===`);
const postQuery = `
  query GetPost {
    post(id: "${postId}") {
      id
      text
      dueAt
      status
    }
  }
`;

const postResult = await gql(postQuery);
console.log('\nPost details from Buffer:');
console.log(JSON.stringify(postResult, null, 2));

console.log(`\n=== DONE ===`);
console.log(`Post ID: ${postId}`);
console.log(`Check Buffer drafts at: https://publish.buffer.com/schedule?tab=drafts`);
console.log(`Look for the post and click Edit to see if the link preview card is attached.`);
