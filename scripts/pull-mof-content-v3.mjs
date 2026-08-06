/**
 * pull-mof-content-v3.mjs
 * Uses the stored YouTube refresh token from DB to pull Pedram's channel videos
 * and scores them for Middle-of-Funnel retargeting suitability.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { google } from 'googleapis';

// ── Get refresh token from DB ──────────────────────────────────────────────────
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [creds] = await conn.query('SELECT youtubeRefreshToken, youtubeChannelId, youtubeChannelTitle FROM user_credentials LIMIT 1');
await conn.end();

const refreshToken = creds[0]?.youtubeRefreshToken;
if (!refreshToken) {
  console.error('No YouTube refresh token found in DB');
  process.exit(1);
}
console.log('YouTube channel:', creds[0]?.youtubeChannelTitle || 'unknown');

// ── Build authenticated YouTube client ────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: refreshToken });
const yt = google.youtube({ version: 'v3', auth: oauth2Client });

// ── Get channel info ───────────────────────────────────────────────────────────
const chRes = await yt.channels.list({
  part: ['id', 'contentDetails', 'statistics', 'snippet'],
  mine: true,
});
const channel = chRes.data.items?.[0];
const channelId = channel?.id;
const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
const subscriberCount = parseInt(channel?.statistics?.subscriberCount || '0');
const totalViews = parseInt(channel?.statistics?.viewCount || '0');

console.log(`Channel ID: ${channelId}`);
console.log(`Subscribers: ${subscriberCount.toLocaleString()} | Total views: ${totalViews.toLocaleString()}`);
console.log(`Uploads playlist: ${uploadsPlaylistId}`);

if (!uploadsPlaylistId) {
  console.error('Could not find uploads playlist');
  process.exit(1);
}

// ── Pull last 50 videos from uploads playlist ─────────────────────────────────
const plRes = await yt.playlistItems.list({
  part: ['contentDetails'],
  playlistId: uploadsPlaylistId,
  maxResults: 50,
});
const videoIds = plRes.data.items?.map(i => i.contentDetails?.videoId).filter(Boolean) || [];
console.log(`\nFetching stats for ${videoIds.length} videos...`);

// ── Get full stats ─────────────────────────────────────────────────────────────
const statsRes = await yt.videos.list({
  part: ['statistics', 'snippet', 'contentDetails'],
  id: videoIds,
});

const videos = (statsRes.data.items || []).map(v => ({
  id: v.id,
  title: v.snippet?.title || '',
  description: v.snippet?.description?.slice(0, 400) || '',
  publishedAt: v.snippet?.publishedAt || '',
  thumbnail: v.snippet?.thumbnails?.medium?.url || '',
  url: `https://www.youtube.com/watch?v=${v.id}`,
  views: parseInt(v.statistics?.viewCount || '0'),
  likes: parseInt(v.statistics?.likeCount || '0'),
  comments: parseInt(v.statistics?.commentCount || '0'),
  duration: v.contentDetails?.duration || '',
  platform: 'youtube',
}));

// ── MOF Scoring ───────────────────────────────────────────────────────────────
const MOF_KEYWORDS = [
  // Core funnel topics (highest weight)
  { kw: 'gut health', w: 5 }, { kw: 'microbiome', w: 5 }, { kw: 'leaky gut', w: 5 },
  { kw: 'interconnected', w: 5 }, { kw: 'upstream', w: 4 }, { kw: 'detox', w: 4 },
  { kw: 'inflammation', w: 4 }, { kw: 'parasite', w: 4 }, { kw: 'candida', w: 4 },
  { kw: 'probiotic', w: 3 }, { kw: 'gut', w: 3 }, { kw: 'digest', w: 3 },
  // Secondary health topics
  { kw: 'sleep', w: 3 }, { kw: 'energy', w: 2 }, { kw: 'healing', w: 3 },
  { kw: 'immune', w: 3 }, { kw: 'toxic', w: 3 }, { kw: 'cleanse', w: 3 },
  { kw: 'liver', w: 3 }, { kw: 'hormone', w: 3 }, { kw: 'thyroid', w: 3 },
  { kw: 'adrenal', w: 3 }, { kw: 'autoimmune', w: 3 }, { kw: 'chronic', w: 2 },
  { kw: 'stress', w: 2 }, { kw: 'cortisol', w: 3 }, { kw: 'blood sugar', w: 3 },
  { kw: 'insulin', w: 3 }, { kw: 'weight', w: 2 }, { kw: 'fasting', w: 3 },
  // Mind-body / brand topics
  { kw: 'meditation', w: 2 }, { kw: 'qigong', w: 2 }, { kw: 'taoist', w: 2 },
  { kw: 'monk', w: 2 }, { kw: 'urban monk', w: 3 }, { kw: 'breath', w: 2 },
  { kw: 'trauma', w: 2 }, { kw: 'anxiety', w: 2 }, { kw: 'depression', w: 2 },
  { kw: 'brain', w: 2 }, { kw: 'food', w: 1 }, { kw: 'health', w: 1 },
  { kw: 'medicine', w: 1 }, { kw: 'bacteria', w: 2 },
];

function mofTopicScore(title, description = '') {
  const text = (title + ' ' + description).toLowerCase();
  let score = 0;
  for (const { kw, w } of MOF_KEYWORDS) {
    if (text.includes(kw)) score += w;
  }
  return Math.min(score, 10);
}

function parseDurationSeconds(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

function scoreVideo(v) {
  const topicScore = mofTopicScore(v.title, v.description);
  const engRate = (v.likes + v.comments * 3) / Math.max(v.views, 1) * 1000;
  const engagementScore = Math.min(10, engRate);
  const ageMonths = (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  const recencyScore = Math.max(0, 10 - ageMonths * 0.3);
  const volumeScore = Math.min(10, Math.log10(Math.max(v.views, 1)) * 2);
  // Duration bonus: 5-20 min videos are ideal for MOF (enough depth, not too long)
  const durSecs = parseDurationSeconds(v.duration);
  const durationBonus = (durSecs >= 300 && durSecs <= 1200) ? 1 : 0;
  const total = topicScore * 0.40 + engagementScore * 0.30 + volumeScore * 0.20 + recencyScore * 0.10 + durationBonus;
  return {
    ...v,
    durationSecs: durSecs,
    scores: {
      topic: parseFloat(topicScore.toFixed(1)),
      engagement: parseFloat(engagementScore.toFixed(1)),
      volume: parseFloat(volumeScore.toFixed(1)),
      recency: parseFloat(recencyScore.toFixed(1)),
      total: parseFloat(total.toFixed(1)),
    },
  };
}

const scored = videos.map(scoreVideo).sort((a, b) => b.scores.total - a.scores.total);

// ── Output ─────────────────────────────────────────────────────────────────────
console.log('\n=== TOP 20 MOF CONTENT PIECES FOR $1/DAY RETARGETING ===\n');
for (const v of scored.slice(0, 20)) {
  const age = Math.round((Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  const durMin = Math.round(v.durationSecs / 60);
  const engRate = ((v.likes + v.comments * 3) / Math.max(v.views, 1) * 100).toFixed(2);
  console.log(`#${scored.indexOf(v) + 1} [MOF: ${v.scores.total.toFixed(1)}] ${v.title}`);
  console.log(`   Topic:${v.scores.topic} | Eng:${v.scores.engagement.toFixed(1)} | Vol:${v.scores.volume.toFixed(1)} | Recency:${v.scores.recency.toFixed(1)}`);
  console.log(`   ${v.views.toLocaleString()} views | ${v.likes.toLocaleString()} likes | ${v.comments} comments | ${durMin}min | ${age}mo old`);
  console.log(`   Eng rate: ${engRate}% | ${v.url}`);
  console.log();
}

console.log('\n=== FULL RANKED LIST (for DB storage) ===');
console.log(JSON.stringify(scored.map(v => ({
  id: v.id,
  title: v.title,
  url: v.url,
  thumbnail: v.thumbnail,
  views: v.views,
  likes: v.likes,
  comments: v.comments,
  durationSecs: v.durationSecs,
  publishedAt: v.publishedAt,
  platform: v.platform,
  scores: v.scores,
})), null, 2));
