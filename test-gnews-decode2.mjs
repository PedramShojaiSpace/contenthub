// Test Google News URL decoding via batchexecute
// Using exact format from https://gist.github.com/huksley/bc3cb046157a99cd9d1517b32f91a99e
const base64 = 'CBMib0FVX3lxTE9RM1Q5alM1SU1NUElnWmNzMVEtZFFJb05IcWloWWhobE1CSUpJdFpYeXZnY3pLY2dYMklfdGVucE5wMnVlY0RvZWlhNmhMUVdmRkxLWGVWeWRmSE41VHFjdlJ0X2FkbFkzbFRvNnVSQQ';

// Build the exact request body as shown in the gist
const innerJson = JSON.stringify(["garturlreq", [["en-US", "US", ["FINANCE_TOP_INDICES", "WEB_TEST_1_0_0"], null, null, 1, 1, "US:en", null, 180, null, null, null, null, null, 0, null, null, [1608992183, 723341000]], "en-US", "US", 1, [2, 3, 4, 8], 1, 0, "655000234", 0, 0, null, 0], base64]);

const outerArray = [[["Fbv4je", innerJson, null, "generic"]]];
const s = JSON.stringify(outerArray);

console.log('f.req value (first 300):', s.slice(0, 300));

const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    'Referer': 'https://news.google.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Same-Domain': '1',
  },
  body: 'f.req=' + encodeURIComponent(s),
  signal: AbortSignal.timeout(10000),
});

const text = await res.text();
console.log('Status:', res.status);
console.log('Response (first 800):', text.slice(0, 800));

// Try to find the URL in the response
const patterns = [
  '["garturlres","',
  '"garturlres","',
  'garturlres',
];
for (const p of patterns) {
  if (text.includes(p)) {
    console.log('Found pattern:', p);
    const idx = text.indexOf(p);
    console.log('Context:', text.slice(idx, idx + 200));
    break;
  }
}
