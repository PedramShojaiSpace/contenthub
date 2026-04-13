import "dotenv/config";

const imageUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ/generated/1775785924178.png";
const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const username = process.env.WORDPRESS_USERNAME ?? "";
const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
const authHeader = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");

console.log("WP Base URL:", baseUrl);
console.log("Username:", username);
console.log("Auth header prefix:", authHeader.substring(0, 20) + "...");

// Step 1: Fetch the image
console.log("\nFetching image from CDN...");
const imgRes = await fetch(imageUrl);
console.log("Image fetch status:", imgRes.status, imgRes.statusText);
console.log("Content-Type:", imgRes.headers.get("content-type"));
const imgBuffer = await imgRes.arrayBuffer();
console.log("Image size (bytes):", imgBuffer.byteLength);

// Step 2: Upload to WP media
console.log("\nUploading to WordPress media...");
const uploadRes = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
  method: "POST",
  headers: {
    Authorization: authHeader,
    "Content-Disposition": `attachment; filename="test-hero.png"`,
    "Content-Type": "image/png",
  },
  body: imgBuffer,
});

console.log("WP upload status:", uploadRes.status, uploadRes.statusText);
const responseText = await uploadRes.text();
if (uploadRes.ok) {
  const media = JSON.parse(responseText);
  console.log("SUCCESS! Media ID:", media.id);
  console.log("Media URL:", media.source_url);
} else {
  console.log("FAILED. Response body:", responseText.substring(0, 500));
}
