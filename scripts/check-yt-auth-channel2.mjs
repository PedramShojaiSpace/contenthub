import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get the stored refresh token
const [rows] = await conn.execute(
  'SELECT youtubeChannelTitle, youtubeRefreshToken FROM user_credentials WHERE youtubeRefreshToken IS NOT NULL LIMIT 1'
);
await conn.end();

if (!rows.length || !rows[0].youtubeRefreshToken) {
  console.log('No YouTube refresh token found in DB');
  process.exit(1);
}

const refreshToken = rows[0].youtubeRefreshToken;
const channelTitleInDb = rows[0].youtubeChannelTitle;
console.log('Channel title stored in DB:', channelTitleInDb);
console.log('Refresh token prefix:', refreshToken.substring(0, 20) + '...');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

// Exchange refresh token for access token
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
});
const tokenData = await tokenRes.json();

if (!tokenData.access_token) {
  console.log('Failed to get access token:', JSON.stringify(tokenData));
  process.exit(1);
}
console.log('\nGot fresh access token successfully');

// Check which channel this token belongs to
const channelRes = await fetch(
  'https://www.googleapis.com/youtube/v3/channels?part=snippet,id&mine=true',
  { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
);
const channelData = await channelRes.json();

if (channelData.items && channelData.items.length > 0) {
  channelData.items.forEach(ch => {
    console.log('\n=== AUTHENTICATED CHANNEL ===');
    console.log('  ID:', ch.id);
    console.log('  Title:', ch.snippet.title);
    console.log('  Custom URL:', ch.snippet.customUrl);
    console.log('  YouTube Studio URL: https://studio.youtube.com/channel/' + ch.id + '/videos/upload');
  });
} else {
  console.log('No channels found:', JSON.stringify(channelData, null, 2));
}

// Look up the two video IDs with OAuth
console.log('\n=== LOOKING UP VIDEO IDs ===');
const videoRes = await fetch(
  'https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=5l3-TTChgIA,Rlk8jkRNJyM',
  { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
);
const videoData = await videoRes.json();
if (videoData.items && videoData.items.length > 0) {
  videoData.items.forEach(v => {
    console.log('\nVideo:', v.id);
    console.log('  Title:', v.snippet.title);
    console.log('  Channel:', v.snippet.channelTitle, '(' + v.snippet.channelId + ')');
    console.log('  Privacy:', v.status.privacyStatus);
    console.log('  YouTube Studio edit URL: https://studio.youtube.com/video/' + v.id + '/edit');
  });
} else {
  console.log('Videos not found with OAuth. Response:', JSON.stringify(videoData, null, 2));
}
