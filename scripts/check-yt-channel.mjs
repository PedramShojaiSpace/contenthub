// Use OAuth access token to find which channel we're authenticated as
// and look up the videos
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

// Try to find stored OAuth tokens
const tokenPaths = [
  path.join(homedir(), '.youtube-token.json'),
  path.join(homedir(), '.config', 'youtube', 'token.json'),
  '/home/ubuntu/lights-on-optin/.youtube-token.json',
];

let accessToken = null;
for (const p of tokenPaths) {
  if (existsSync(p)) {
    try {
      const t = JSON.parse(readFileSync(p, 'utf8'));
      accessToken = t.access_token;
      console.log('Found token at:', p);
      break;
    } catch {}
  }
}

if (!accessToken) {
  console.log('No stored OAuth token found. Checking env...');
  // The YouTube upload uses OAuth via the server's YouTube router
  // Let's check what channel ID is stored in the DB for recent uploads
  process.exit(1);
}

// Check which channel this token belongs to
const channelRes = await fetch(
  'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const channelData = await channelRes.json();
console.log('Authenticated channel:', JSON.stringify(channelData?.items?.[0]?.snippet, null, 2));
console.log('Channel ID:', channelData?.items?.[0]?.id);
