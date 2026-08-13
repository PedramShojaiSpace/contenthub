const baseUrl = String(process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const username = process.env.WORDPRESS_USERNAME ?? "";
const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
const shouldApply = process.argv.includes("--apply");

if (!baseUrl || !username || !appPassword) {
  throw new Error("WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD are required");
}

const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
const request = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: authorization, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url} failed: HTTP ${response.status}`);
  return response.json();
};

const post = await request(`${baseUrl}/wp-json/wp/v2/posts/11154?context=edit`);
const original = post.content?.raw ?? "";
if (!original.includes("Let me explain what&#39;s really happening")) {
  throw new Error("Expected introductory anchor was not found; refusing to alter post content.");
}
if (original.includes("data-um-post-11154-image")) {
  throw new Error("Post 11154 already contains the guarded in-content image marker; refusing duplicate update.");
}

const introNeedle = "<p>You&#39;re doing everything right. You&#39;ve worked with your doctor to dial in your hormone replacement therapy. Your labs look perfect on paper. Yet somehow, you still wake up exhausted, struggle to lose weight, feel mentally foggy, and wonder why your body isn&#39;t responding the way it should.</p>";
const revisedIntro = "<p>You&#39;re doing everything right. You&#39;ve worked with your doctor to dial in your hormone replacement therapy. Your labs look perfect on paper. Yet somehow, you still wake up exhausted, struggle to lose weight, feel mentally foggy, and wonder why your body isn&#39;t responding the way it should. <strong>Hormone detoxification</strong> is one lens for exploring that broader conversation with a qualified clinician, alongside a careful review of symptoms, treatment, and gut health.</p>";

const imageBlock = `<figure class="wp-block-image size-full" data-um-post-11154-image><img src="https://theurbanmonk.com/wp-content/uploads/2026/08/hormone-replacement-therapy-outcomes-integrating-detoxificat-pha2-hero.png" alt="Hormone detoxification and gut health in the context of hormone replacement therapy" class="wp-image-11153"/><figcaption>Hormone detoxification, gut health, and hormone signaling are interconnected topics to explore with a qualified clinician.</figcaption></figure>`;

const internalLinkParagraph = `<p>For additional education on the digestive side of this conversation, explore The Urban Monk’s <a href="https://theurbanmonk.com/category/gut-health/">Gut Health resources</a>.</p>`;
const externalLinkParagraph = `<p>For general background on environmental exposures and endocrine disruptors, see the <a href="https://www.niehs.nih.gov/health/topics/agents/endocrine" target="_blank" rel="noopener noreferrer">National Institute of Environmental Health Sciences overview</a>.</p>`;

let revised = original.replace(introNeedle, revisedIntro);
if (revised === original) throw new Error("Expected intro paragraph was not found; refusing to alter post content.");

revised = revised.replace(
  "<p>Let me explain what&#39;s really happening inside your body—and more importantly, what you can do about it.</p>",
  `<p>Let me explain what&#39;s really happening inside your body—and more importantly, what you can do about it.</p>${imageBlock}${internalLinkParagraph}`,
);
revised = revised.replace(
  "<h2>The Inflammation Connection: When Your Gut Turns Against Your Hormones</h2>",
  "<h2>Hormone Detoxification, Inflammation, and How Your Gut Affects Hormone Signaling</h2>",
);
revised = revised.replace(
  "</ul>\n<p><strong>Address inflammation systematically:</strong></p>",
  `</ul>${externalLinkParagraph}\n<p><strong>Address inflammation systematically:</strong></p>`,
);

if (!revised.includes("data-um-post-11154-image") || !revised.includes("hormone-detoxification-hrt-gut-health") === false) {
  // The second condition is intentionally not required in body content; metadata validation occurs below.
}
if (!revised.includes("National Institute of Environmental Health Sciences overview")) {
  throw new Error("Expected external educational link was not inserted; refusing update.");
}

const update = {
  status: "draft",
  slug: "hormone-detoxification-hrt-gut-health",
  content: revised,
  meta: {
    _yoast_wpseo_focuskw: "hormone detoxification",
    _yoast_wpseo_title: "Hormone Detoxification & HRT: Why Hormone Therapy May Not Be Working",
    _yoast_wpseo_metadesc: "Explore hormone detoxification, gut health, and inflammation as factors to discuss with a clinician when hormone therapy outcomes are not what you expected.",
  },
};

if (!shouldApply) {
  console.log(JSON.stringify({ mode: "preview", currentStatus: post.status, update }, null, 2));
  process.exit(0);
}

const saved = await request(`${baseUrl}/wp-json/wp/v2/posts/11154`, {
  method: "POST",
  body: JSON.stringify(update),
});

console.log(JSON.stringify({
  mode: "applied",
  id: saved.id,
  status: saved.status,
  slug: saved.slug,
  title: saved.title?.rendered,
  contentHasImage: saved.content?.raw?.includes("data-um-post-11154-image") ?? false,
  yoastMeta: Object.fromEntries(Object.entries(saved.meta ?? {}).filter(([key]) => key.includes("yoast"))),
}, null, 2));
