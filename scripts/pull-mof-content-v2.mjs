/**
 * pull-mof-content-v2.mjs
 * Uses the same OAuth pattern as the app (refresh token from DB or env)
 * to pull top-performing videos from Pedram's YouTube channel.
 */
import 'dotenv/config';
import { google } from 'googleapis';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const META_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const META_PAGE_ID = process.env.META_PAGE_ID;

// MOF topic keywords — aligned with Interconnected funnel
const MOF_KEYWORDS = [
  'gut', 'microbiome', 'detox', 'inflammation', 'healing', 'sleep', 'energy',
  'leaky gut', 'bacteria', 'digest', 'immune', 'toxic', 'cleanse', 'health',
  'food', 'medicine', 'interconnected', 'upstream', 'parasite', 'candida',
  'probiotic', 'fasting', 'breath', 'stress', 'cortisol', 'liver', 'kidney',
  'hormone', 'weight', 'fat', 'sugar', 'insulin', 'blood', 'heart', 'brain',
  'mind', 'meditation', 'qigong', 'taoist', 'monk', 'spiritual', 'trauma',
  'anxiety', 'depression', 'chronic', 'autoimmune', 'thyroid', 'adrenal',
];

function mofTopicScore(title, description = '') {
  const text = (title + ' ' + description).toLowerCase();
  let score = 0;
  for (const kw of MOF_KEYWORDS) {
    if (text.includes(kw)) score += kw.split(' ').length > 1 ? 3 : 1;
  }
  return Math.min(score, 10);
}

function scoreVideo(v) {
  const topicScore = mofTopicScore(v.title, v.description);
  const engagementScore = Math.min(10, (v.likes + v.comments * 3) / Math.max(v.views, 1) * 1000);
  const ageMonths = (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  const recencyScore = Math.max(0, 10 - ageMonths * 0.3);
  const volumeScore = Math.min(10, Math.log10(Math.max(v.views, 1)) * 2);
  const total = topicScore * 0.40 + engagementScore * 0.30 + volumeScore * 0.20 + recencyScore * 0.10;
  return {
    ...v,
    scores: {
      topic: parseFloat(topicScore.toFixed(1)),
      engagement: parseFloat(engagementScore.toFixed(1)),
      volume: parseFloat(volumeScore.toFixed(1)),
      recency: parseFloat(recencyScore.toFixed(1)),
      total: parseFloat(total.toFixed(1)),
    },
  };
}

// ── YouTube via OAuth ──────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const yt = google.youtube({ version: 'v3', auth: oauth2Client });

// Get channel ID
const chRes = await yt.channels.list({ part: ['id', 'contentDetails', 'statistics'], mine: true });
const channel = chRes.data.items?.[0];
const channelId = channel?.id;
const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
const subscriberCount = parseInt(channel?.statistics?.subscriberCount || '0');

console.log(`Channel: ${channelId} | Subscribers: ${subscriberCount.toLocaleString()}`);
console.log(`Uploads playlist: ${uploadsPlaylistId}`);

if (!uploadsPlaylistId) {
  console.error('Could not find uploads playlist');
  process.exit(1);
}

// Get recent 50 videos from uploads playlist
const plRes = await yt.playlistItems.list({
  part: ['contentDetails'],
  playlistId: uploadsPlaylistId,
  maxResults: 50,
});

const videoIds = plRes.data.items?.map(i => i.contentDetails?.videoId).filter(Boolean) || [];
console.log(`Got ${videoIds.length} video IDs`);

// Get stats for all videos
const statsRes = await yt.videos.list({
  part: ['statistics', 'snippet', 'contentDetails'],
  id: videoIds,
});

const ytVideos = (statsRes.data.items || []).map(v => ({
  id: v.id,
  title: v.snippet?.title || '',
  description: v.snippet?.description?.slice(0, 300) || '',
  publishedAt: v.snippet?.publishedAt || '',
  thumbnail: v.snippet?.thumbnails?.medium?.url || '',
  url: `https://www.youtube.com/watch?v=${v.id}`,
  views: parseInt(v.statistics?.viewCount || '0'),
  likes: parseInt(v.statistics?.likeCount || '0'),
  comments: parseInt(v.statistics?.commentCount || '0'),
  duration: v.contentDetails?.duration || '',
  platform: 'youtube',
}));

// ── Meta Page Videos ───────────────────────────────────────────────────────────
let metaVideos = [];
try {
  const fields = 'id,title,description,permalink_url,created_time,views,likes.summary(true),comments.summary(true),shares';
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${META_PAGE_ID}/videos?fields=${fields}&limit=50&access_token=${META_TOKEN}`
  );
  const data = await res.json();
  if (data.data) {
    metaVideos = data.data.map(v => ({
      id: v.id,
      title: v.title || '(untitled)',
      description: v.description?.slice(0, 300) || '',
      publishedAt: v.created_time,
      url: v.permalink_url || `https://www.facebook.com/video/${v.id}`,
      views: v.views || 0,
      likes: v.likes?.summary?.total_count || 0,
      comments: v.comments?.summary?.total_count || 0,
      shares: v.shares?.count || 0,
      platform: 'meta_video',
    }));
    console.log(`Got ${metaVideos.length} Meta videos`);
  } else {
    console.log('Meta videos:', JSON.stringify(data).slice(0, 200));
  }
} catch (e) {
  console.log('Meta video fetch failed:', e.message);
}

// ── Score and rank ─────────────────────────────────────────────────────────────
const all = [...ytVideos, ...metaVideos].map(scoreVideo);
const ranked = all.sort((a, b) => b.scores.total - a.scores.total);

console.log('\n=== TOP 25 MOF CONTENT PIECES ===');
for (const v of ranked.slice(0, 25)) {
  const age = Math.round((Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  console.log(`\n[${v.platform.toUpperCase()}] ${v.title.slice(0, 80)}`);
  console.log(`  MOF Score: ${v.scores.total.toFixed(1)} | Topic:${v.scores.topic} Eng:${v.scores.engagement.toFixed(1)} Vol:${v.scores.volume.toFixed(1)} Recency:${v.scores.recency.toFixed(1)}`);
  console.log(`  Views: ${v.views.toLocaleString()} | Likes: ${v.likes.toLocaleString()} | Age: ${age}mo`);
  console.log(`  ${v.url}`);
}

console.log('\n=== BOTTOM 5 (for reference) ===');
for (const v of ranked.slice(-5)) {
  console.log(`  [${v.platform}] ${v.title.slice(0, 60)} | Score: ${v.scores.total.toFixed(1)} | Views: ${v.views.toLocaleString()}`);
}
