import { readFileSync } from "fs";
import { config } from "dotenv";

// Load env from the project directory
config();

// Load the markdown content
const markdownContent = readFileSync("/home/ubuntu/burnout_recovery_guide.md", "utf-8");

// Read WordPress credentials from environment
const WP_URL = process.env.WORDPRESS_URL || "https://theurbanmonk.com";
const WP_USERNAME = process.env.WORDPRESS_USERNAME;
const WP_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_USERNAME || !WP_APP_PASSWORD) {
  console.error("Missing WORDPRESS_USERNAME or WORDPRESS_APP_PASSWORD environment variables");
  process.exit(1);
}

console.log("Publishing to:", WP_URL);
console.log("Username:", WP_USERNAME);

const credentials = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64");

const postData = {
  title: "The East-West Approach to Burnout Recovery: A Definitive Guide",
  content: markdownContent,
  status: "draft",
  slug: "east-west-approach-burnout-recovery-definitive-guide",
  excerpt: "Burnout is not a productivity problem — it is a biological event. This definitive guide integrates Eastern and Western medicine to explain what burnout actually is, why it happens, and how to recover using evidence-based tools from both traditions.",
  format: "standard"
};

try {
  const response = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
    body: JSON.stringify(postData),
  });

  const result = await response.json();
  
  if (response.ok) {
    console.log("\nSUCCESS: Post created as draft!");
    console.log("Post ID:", result.id);
    console.log("Post URL:", result.link);
    console.log("Status:", result.status);
    console.log("Edit URL:", `${WP_URL}/wp-admin/post.php?post=${result.id}&action=edit`);
  } else {
    console.error("\nERROR:", response.status, response.statusText);
    console.error("Details:", JSON.stringify(result, null, 2));
  }
} catch (err) {
  console.error("Network error:", err.message);
}
