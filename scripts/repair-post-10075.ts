/**
 * One-time repair script: replace third-party video embed in WordPress post 10075
 * Run with: cd /home/ubuntu/lights-on-optin && npx tsx scripts/repair-post-10075.ts
 */
import "dotenv/config";

const WP_BASE = (process.env.WORDPRESS_URL ?? "https://theurbanmonk.com").replace(/\/$/, "");
const WP_AUTH = "Basic " + Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString("base64");

const OLD_VIDEO_ID = "CgVs-Lg0fG0";
const NEW_VIDEO_ID = "KfsVfAdso7o";
const NEW_VIDEO_URL = `https://www.youtube.com/embed/${NEW_VIDEO_ID}`;

async function main() {
  console.log("[Repair] Fetching post 10075 raw content...");
  const getRes = await fetch(`${WP_BASE}/wp-json/wp/v2/posts/10075?context=edit`, {
    headers: { Authorization: WP_AUTH },
  });

  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`GET post 10075 failed (${getRes.status}): ${text.substring(0, 200)}`);
  }

  const post = await getRes.json() as { content: { raw: string } };
  const rawContent = post.content.raw;
  console.log(`[Repair] Got ${rawContent.length} chars of raw content`);

  if (!rawContent.includes(OLD_VIDEO_ID)) {
    console.log(`[Repair] Old video ID ${OLD_VIDEO_ID} not found — post may already be fixed`);
    return;
  }

  // Replace the video ID in the embed src and title
  const updatedContent = rawContent
    .replace(new RegExp(`youtube\\.com/embed/${OLD_VIDEO_ID}`, "g"), `youtube.com/embed/${NEW_VIDEO_ID}`)
    .replace(new RegExp(OLD_VIDEO_ID, "g"), NEW_VIDEO_ID)
    .replace(/Pedram Shojai 7 Day Urban Monk[^"']*/g, "This Chinese Medicine Can Heal Your Gut And MORE");

  if (updatedContent === rawContent) {
    throw new Error("Content unchanged after replacement");
  }

  console.log("[Repair] Replacement made. Pushing update to WordPress...");

  const updateRes = await fetch(`${WP_BASE}/wp-json/wp/v2/posts/10075`, {
    method: "POST",
    headers: {
      Authorization: WP_AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: updatedContent }),
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`POST update failed (${updateRes.status}): ${text.substring(0, 300)}`);
  }

  const result = await updateRes.json() as { id: number; link: string };
  console.log(`[Repair] Post 10075 updated! Live URL: ${result.link}`);
  console.log(`[Repair] Old video: https://www.youtube.com/watch?v=${OLD_VIDEO_ID} (Dr. Alan Christianson)`);
  console.log(`[Repair] New video: https://www.youtube.com/watch?v=${NEW_VIDEO_ID} (Urban Monk TCM Gut Health)`);
}

main().catch((err) => {
  console.error("[Repair] FAILED:", err);
  process.exit(1);
});
