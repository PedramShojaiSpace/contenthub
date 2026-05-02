import * as dotenv from "dotenv";
dotenv.config();

const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
const baseUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();

console.log('Calling:', fullUrl);

// Try Google News search via the data API
const newsApis = [
  'GoogleNews/search',
  'News/search',
  'news/search',
  'Bing/news',
  'BingNews/search',
];

for (const apiId of newsApis) {
  try {
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'connect-protocol-version': '1',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        apiId,
        query: { q: 'integrative medicine' },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    console.log(`${apiId}: ${res.status} - ${text.slice(0, 150)}`);
  } catch (e) {
    console.log(`${apiId}: ERROR - ${e.message}`);
  }
}
