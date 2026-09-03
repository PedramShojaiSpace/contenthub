const objectId = process.argv[2];
const accessToken = process.env.META_AD_ACCESS_TOKEN;

if (!objectId || !accessToken) {
  throw new Error("Usage: META_AD_ACCESS_TOKEN=... node scripts/lookup-meta-library-object.mjs <public-library-id>");
}

const url = new URL(`https://graph.facebook.com/v21.0/${objectId}`);
url.searchParams.set("access_token", accessToken);
url.searchParams.set(
  "fields",
  "id,name,status,effective_status,thumbnail_url,object_story_id,effective_object_story_id,actor_id,ad_snapshot_url",
);

const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
const body = await response.json().catch(() => ({}));

console.log(JSON.stringify({
  readOnly: true,
  objectId,
  httpStatus: response.status,
  object: response.ok
    ? body
    : { errorCode: body.error?.code ?? null, errorType: body.error?.type ?? null },
}, null, 2));
