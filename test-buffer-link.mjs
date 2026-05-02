/**
 * Test script: fires the exact Buffer createPost mutation with metadata.linkedin.linkAttachment
 * and logs the raw response so we can diagnose why the link preview isn't appearing.
 * 
 * Run: node test-buffer-link.mjs
 */
import { readFileSync } from 'fs';

const TOKEN = 'poKz3ynLtuvgotw0sWkHiFyGDFbXZPDtX8_qO9Y48y3';

const BUFFER_GQL = 'https://api.buffer.com';

// LinkedIn channel ID (from earlier log)
const LINKEDIN_CHANNEL_ID = '668e9375602872be45f64bb6';

// Test article URL
const TEST_URL = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6566799/';
const TEST_TEXT = `This is a fascinating look at gut microbiome research. The science here is clear: what we eat directly shapes our microbial ecosystem. Worth reading.\n\n${TEST_URL}`;

// Test 1: Using metadata.linkedin.linkAttachment (our current approach)
const mutation1 = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(TEST_TEXT)},
      channelId: "${LINKEDIN_CHANNEL_ID}",
      schedulingType: automatic,
      mode: addToQueue,
      saveToDraft: true,
      metadata: { linkedin: { linkAttachment: { url: ${JSON.stringify(TEST_URL)} } } }
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

console.log('=== TEST: metadata.linkedin.linkAttachment ===');
console.log('Mutation:\n', mutation1.trim());
console.log('\nSending to Buffer API...');

const res1 = await fetch(BUFFER_GQL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({ query: mutation1 }),
});

const json1 = await res1.json();
console.log('\nResponse:', JSON.stringify(json1, null, 2));

// Test 2: Using assets.link (the old approach — to confirm it doesn't work)
const mutation2 = `
  mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(TEST_TEXT)},
      channelId: "${LINKEDIN_CHANNEL_ID}",
      schedulingType: automatic,
      mode: addToQueue,
      saveToDraft: true,
      assets: { link: { url: ${JSON.stringify(TEST_URL)} } }
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

console.log('\n\n=== TEST 2: assets.link (old approach) ===');
console.log('Mutation:\n', mutation2.trim());
console.log('\nSending to Buffer API...');

const res2 = await fetch(BUFFER_GQL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({ query: mutation2 }),
});

const json2 = await res2.json();
console.log('\nResponse:', JSON.stringify(json2, null, 2));
