// Test Google News URL decoding via batchexecute
const base64 = 'CBMib0FVX3lxTE9RM1Q5alM1SU1NUElnWmNzMVEtZFFJb05IcWloWWhobE1CSUpJdFpYeXZnY3pLY2dYMklfdGVucE5wMnVlY0RvZWlhNmhMUVdmRkxLWGVWeWRmSE41VHFjdlJ0X2FkbFkzbFRvNnVSQQ';

// Method 1: The exact format from the working gist
const s = `'[[["Fbv4je","[\\\\\\"garturlreq\\\\\\",[[\\\\\\"en-US\\\\\\",\\\\\\"US\\\\\\",[\\\\\\"FINANCE_TOP_INDICES\\\\\\",\\\\\\"WEB_TEST_1_0_0\\\\\\"],null,null,1,1,\\\\\\"US:en\\\\\\",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],\\\\\\"en-US\\\\\\",\\\\\\"US\\\\\\",1,[2,3,4,8],1,0,\\\\\\"655000234\\\\\\",0,0,null,0],\\\\\\"${base64}\\\\\\"],null,"generic"]]]'`;

console.log('Request body (first 200):', s.slice(0, 200));

const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    'Referer': 'https://news.google.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  body: 'f.req=' + encodeURIComponent(s),
  signal: AbortSignal.timeout(10000),
});

const text = await res.text();
console.log('Status:', res.status);
console.log('Response (first 500):', text.slice(0, 500));

const header = '["garturlres","';
const footer = '",';
if (text.includes(header)) {
  const start = text.substring(text.indexOf(header) + header.length);
  const url = start.substring(0, start.indexOf(footer));
  console.log('RESOLVED URL:', url);
} else {
  console.log('Header not found. Trying alternative...');
  // Try alternative header format
  const alt = '"garturlres","';
  if (text.includes(alt)) {
    const start = text.substring(text.indexOf(alt) + alt.length);
    const url = start.substring(0, start.indexOf('"'));
    console.log('ALT RESOLVED URL:', url);
  }
}
