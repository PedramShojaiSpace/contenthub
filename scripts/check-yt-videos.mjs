const TOKEN = process.env.YOUTUBE_DATA_API_KEY;
const ids = ['5l3-TTChgIA', 'Rlk8jkRNJyM'];

const res = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.join(',')}&key=${TOKEN}`
);
const data = await res.json();

if (!data.items || data.items.length === 0) {
  console.log('No items found. API response:', JSON.stringify(data, null, 2));
  process.exit(1);
}

data.items.forEach(v => {
  console.log('ID:', v.id);
  console.log('Title:', v.snippet.title);
  console.log('Channel:', v.snippet.channelTitle, '(' + v.snippet.channelId + ')');
  console.log('Privacy:', v.status.privacyStatus);
  console.log('Published:', v.snippet.publishedAt);
  console.log('---');
});

// Also check which channel our OAuth token belongs to
const meRes = await fetch(
  `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${TOKEN}`
);
const meData = await meRes.json();
console.log('\nOAuth channel info:', JSON.stringify(meData, null, 2));
