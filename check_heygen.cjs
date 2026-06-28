require('dotenv').config();
const videoId = '1d7a2d6b617045bc93fd72788e604225';
const apiKey = process.env.HEYGEN_API_KEY;
console.log('API key present:', !!apiKey, 'length:', apiKey ? apiKey.length : 0);

fetch('https://api.heygen.com/v1/video_status.get?video_id=' + videoId, {
  headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
})
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
  .catch(e => console.error('Error:', e.message));
