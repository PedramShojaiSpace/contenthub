/**
 * pull-mof-content.mjs
 * Pulls top-performing organic content from YouTube and Meta
 * and scores each piece for Middle-of-Funnel suitability.
 *
 * MOF scoring criteria for the Interconnected funnel audience:
 * - Topic relevance: gut health, microbiome, detox, sleep, inflammation, healing, energy
 * - Engagement rate (views relative to subscriber base)
 * - Watch time / retention signal (avg view duration %)
 * - Comment sentiment (questions, personal stories = high MOF intent)
 * - Recency (fresher content performs better in retargeting)
 */

import 'dotenv/config';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;
const META_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const META_PAGE_ID = process.env.META_PAGE_ID;

// MOF topic keywords — aligned with Interconnected funnel (gut, microbiome, healing)
const MOF_KEYWORDS = [
  'gut', 'microbiome', 'detox', 'inflammation', 'healing', 'sleep', 'energy',
  'leaky gut', 'bacteria', 'digest', 'immune', 'toxic', 'cleanse', 'health',
  'food', 'medicine', 'monk', 'urban monk', 'interconnected', 'upstream',
  'parasite', 'candida', 'probiotic', 'fasting', 'breath', 'stress', 'cortisol',
];

function mofTopicScore(title, description = '') {
  const text = (title + ' ' + description).toLowerCase();
  let score = 0;
  for (const kw of MOF_KEYWORDS) {
    if (text.includes(kw)) score += kw.split(' ').length > 1 ? 3 : 1; // multi-word = higher signal
  }
  return Math.min(score, 10); // cap at 10
}

// ── YouTube ────────────────────────────────────────────────────────────────────

async function getYouTubeChannelId() {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&mine=true&key=${YT_API_KEY}`,
    { headers: { Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}` } }
  );
  const data = await res.json();
  return data.items?.[0];
}

async function getTopYouTubeVideos() {
  // Use search API to get recent popular videos
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCVTlvUkGslCV_h-nSAId8Sw&order=viewCount&type=video&maxResults=50&key=${YT_API_KEY}`
  );
  const data = await res.json();
  if (!data.items) {
    console.error('YouTube search error:', JSON.stringify(data));
    return [];
  }

  const videoIds = data.items.map(v => v.id.videoId).join(',');

  // Get stats for each video
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YT_API_KEY}`
  );
  const statsData = await statsRes.json();

  return (statsData.items || []).map(v => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description?.slice(0, 200),
    publishedAt: v.snippet.publishedAt,
    thumbnail: v.snippet.thumbnails?.medium?.url,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    views: parseInt(v.statistics.viewCount || '0'),
    likes: parseInt(v.statistics.likeCount || '0'),
    comments: parseInt(v.statistics.commentCount || '0'),
    duration: v.contentDetails.duration, // ISO 8601
    platform: 'youtube',
  }));
}

// ── Meta ───────────────────────────────────────────────────────────────────────

async function getTopMetaVideos() {
  // Pull page videos with engagement metrics
  const fields = 'id,title,description,permalink_url,created_time,views,likes.summary(true),comments.summary(true),shares';
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${META_PAGE_ID}/videos?fields=${fields}&limit=50&access_token=${META_TOKEN}`
  );
  const data = await res.json();
  if (!data.data) {
    console.error('Meta videos error:', JSON.stringify(data).slice(0, 300));
    return [];
  }

  return data.data.map(v => ({
    id: v.id,
    title: v.title || '(untitled)',
    description: v.description?.slice(0, 200) || '',
    publishedAt: v.created_time,
    url: v.permalink_url || `https://www.facebook.com/video/${v.id}`,
    views: v.views || 0,
    likes: v.likes?.summary?.total_count || 0,
    comments: v.comments?.summary?.total_count || 0,
    shares: v.shares?.count || 0,
    platform: 'meta',
  }));
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreVideo(v) {
  const topicScore = mofTopicScore(v.title, v.description);
  
  // Engagement score (normalized)
  const engagementScore = v.platform === 'youtube'
    ? Math.min(10, (v.likes + v.comments * 3) / Math.max(v.views, 1) * 1000)
    : Math.min(10, (v.likes + v.comments * 3 + (v.shares || 0) * 5) / Math.max(v.views, 1) * 1000);

  // Recency score (fresher = better for retargeting)
  const ageMonths = (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  const recencyScore = Math.max(0, 10 - ageMonths * 0.5);

  // Volume score (more views = more social proof)
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

// ── Main ───────────────────────────────────────────────────────────────────────

console.log('Pulling YouTube top videos...');
const ytVideos = await getTopYouTubeVideos();
console.log(`Got ${ytVideos.length} YouTube videos`);

console.log('Pulling Meta page videos...');
const metaVideos = await getTopMetaVideos();
console.log(`Got ${metaVideos.length} Meta videos`);

const all = [...ytVideos, ...metaVideos].map(scoreVideo);
const ranked = all.sort((a, b) => b.scores.total - a.scores.total).slice(0, 20);

console.log('\n=== TOP 20 MOF CONTENT PIECES ===');
for (const v of ranked) {
  const age = Math.round((Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  console.log(`\n[${v.platform.toUpperCase()}] ${v.title.slice(0, 70)}`);
  console.log(`  Score: ${v.scores.total.toFixed(1)} | Topic:${v.scores.topic} Eng:${v.scores.engagement.toFixed(1)} Vol:${v.scores.volume.toFixed(1)}`);
  console.log(`  Views: ${v.views.toLocaleString()} | Age: ${age}mo | ${v.url}`);
}
